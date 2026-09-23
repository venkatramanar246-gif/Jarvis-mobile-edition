"use strict";

/* =========================================================
   J.A.R.V.I.S. - SCRIPT.JS
   PART 1 OF 2
   ========================================================= */

(function () {

  /* =========================
     ELEMENTS
     ========================= */

  const msg = document.getElementById("msg");
  const send = document.getElementById("send");
  const micBtn = document.getElementById("mic-btn");
  const camBtn = document.getElementById("cam-btn");
  const clearBtn = document.getElementById("clear-btn");
  const imgInput = document.getElementById("img-input");
  const chat = document.getElementById("chat");

  if (!msg || !send || !chat) {
    console.error("JARVIS: Required HTML elements not found.");
    return;
  }

  let recognition = null;
  let isListening = false;
  let isBusy = false;

  const timers = [];

  const MEMORY_KEY = "JARVIS_MEMORY";

  /* =========================
     BASIC HELPERS
     ========================= */

  function clean(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function lower(text) {
    return clean(text).toLowerCase();
  }

  function escapeHTML(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function addChat(sender, text) {

    const box = document.createElement("div");

    box.style.margin = "10px 0";
    box.style.padding = "8px 10px";
    box.style.wordBreak = "break-word";

    box.innerHTML =
      "<strong>" +
      escapeHTML(sender) +
      "</strong><br>" +
      escapeHTML(text);

    chat.appendChild(box);

    chat.scrollTop = chat.scrollHeight;

    return box;
  }

  function userMessage(text) {
    return addChat("YOU", text);
  }

  function jarvisMessage(text) {
    return addChat("J.A.R.V.I.S.", text);
  }

  function setBusy(value) {

    isBusy = value;

    if (send) {
      send.disabled = value;
      send.textContent = value
        ? "WAIT..."
        : "EXECUTE";
    }

    document.body.classList.toggle(
      "jarvis-busy",
      value
    );
  }

  /* =========================
     TEXT TO SPEECH
     ========================= */

  function speak(text) {

    if (!("speechSynthesis" in window)) {
      return;
    }

    try {

      window.speechSynthesis.cancel();

      const speech =
        new SpeechSynthesisUtterance(
          clean(text)
        );

      speech.rate = 1;
      speech.pitch = 1;
      speech.volume = 1;

      const voices =
        window.speechSynthesis.getVoices();

      const voice =
        voices.find(v =>
          /en-IN/i.test(v.lang)
        ) ||
        voices.find(v =>
          /en-US/i.test(v.lang)
        ) ||
        voices.find(v =>
          /en-GB/i.test(v.lang)
        );

      if (voice) {
        speech.voice = voice;
      }

      window.speechSynthesis.speak(speech);

    } catch (error) {
      console.warn(
        "Speech error:",
        error
      );
    }
  }

  function reply(text, speakNow = true) {

    const answer = clean(text);

    if (!answer) {
      return;
    }

    jarvisMessage(answer);

    if (speakNow) {
      speak(answer);
    }

    saveMemory("lastResponse", answer);
  }

  /* =========================
     MEMORY
     ========================= */

  function getMemory() {

    try {

      return JSON.parse(
        localStorage.getItem(
          MEMORY_KEY
        ) || "{}"
      );

    } catch (error) {

      return {};
    }
  }

  function saveMemory(key, value) {

    try {

      const memory = getMemory();

      memory[key] = value;

      localStorage.setItem(
        MEMORY_KEY,
        JSON.stringify(memory)
      );

    } catch (error) {

      console.warn(
        "Memory save failed:",
        error
      );
    }
  }

  function clearMemory() {

    try {

      localStorage.removeItem(
        MEMORY_KEY
      );

    } catch (error) {}

    chat.innerHTML = "";
    chat.style.display = "none";

    msg.value = "";

    reply(
      "Memory cleared successfully, Boss."
    );
  }

  /* =========================
     FETCH HELPERS
     ========================= */

  async function fetchWithTimeout(
    url,
    options = {},
    timeout = 15000
  ) {

    const controller =
      new AbortController();

    const timeoutID =
      setTimeout(
        () => controller.abort(),
        timeout
      );

    try {

      const response =
        await fetch(
          url,
          {
            ...options,
            signal:
              controller.signal
          }
        );

      return response;

    } finally {

      clearTimeout(timeoutID);
    }
  }

  async function getJSON(
    url,
    options = {},
    timeout = 15000
  ) {

    const response =
      await fetchWithTimeout(
        url,
        options,
        timeout
      );

    if (!response.ok) {
      throw new Error(
        "HTTP " +
        response.status
      );
    }

    return await response.json();
  }

  /* =========================
     OPEN URL
     ========================= */

  function openURL(url) {

    try {

      const newWindow =
        window.open(
          url,
          "_blank"
        );

      if (!newWindow) {
        window.location.href =
          url;
      }

    } catch (error) {

      window.location.href =
        url;
    }
  }

  /* =========================
     TIME
     ========================= */

  function toolTime() {

    const now =
      new Date();

    return (
      "The current time is " +
      now.toLocaleTimeString(
        [],
        {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit"
        }
      ) +
      ", Boss."
    );
  }

  /* =========================
     WEATHER
     ========================= */

  async function toolWeather() {

    try {

      const position =
        await new Promise(
          (resolve, reject) => {

            if (
              !navigator.geolocation
            ) {
              reject(
                new Error(
                  "Location unavailable"
                )
              );

              return;
            }

            navigator.geolocation
              .getCurrentPosition(
                resolve,
                reject,
                {
                  enableHighAccuracy:
                    false,
                  timeout: 8000,
                  maximumAge:
                    300000
                }
              );
          }
        );

      const latitude =
        position.coords.latitude;

      const longitude =
        position.coords.longitude;

      const url =
        "https://api.open-meteo.com/v1/forecast" +
        "?latitude=" +
        encodeURIComponent(latitude) +
        "&longitude=" +
        encodeURIComponent(longitude) +
        "&current=" +
        "temperature_2m," +
        "relative_humidity_2m," +
        "wind_speed_10m" +
        "&timezone=auto";

      const data =
        await getJSON(url);

      const current =
        data.current || {};

      return (
        "Current temperature is " +
        (current.temperature_2m ??
          "unavailable") +
        "°C. Humidity is " +
        (current.relative_humidity_2m ??
          "unavailable") +
        "%. Wind speed is " +
        (current.wind_speed_10m ??
          "unavailable") +
        " km/h."
      );

    } catch (error) {

      return (
        "I could not access live weather. " +
        "Please allow location permission and try again."
      );
    }
  }

  /* =========================
     TIMER
     ========================= */

  function toolTimer(text) {

    const match =
      lower(text).match(
        /(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i
      );

    if (!match) {

      return (
        "Please specify the timer duration, " +
        "for example: timer 10 seconds."
      );
    }

    const amount =
      Number(match[1]);

    const unit =
      match[2].toLowerCase();

    let multiplier = 1000;

    if (
      /minutes?|mins?/.test(unit)
    ) {
      multiplier = 60000;
    }

    if (
      /hours?|hrs?/.test(unit)
    ) {
      multiplier = 3600000;
    }

    const duration =
      amount * multiplier;

    const timerID =
      setTimeout(
        () => {

          const text =
            "Timer complete, Boss.";

          jarvisMessage(text);
          speak(text);

        },
        duration
      );

    timers.push(timerID);

    return (
      "Timer set for " +
      amount +
      " " +
      unit +
      "."
    );
  }

  /* =========================
     DICE / COIN
     ========================= */

  function toolDiceCoin(text) {

    const t = lower(text);

    if (
      t.includes("coin") ||
      t.includes("flip") ||
      t.includes("toss") ||
      t.includes("కాయిన్")
    ) {

      const result =
        Math.random() < 0.5
          ? "Heads"
          : "Tails";

      return (
        "Coin toss result: " +
        result +
        "."
      );
    }

    let sides = 6;

    const match =
      t.match(
        /(?:d|dice)\s*(\d+)/
      );

    if (match) {

      sides =
        Math.max(
          2,
          Math.min(
            1000,
            Number(match[1])
          )
        );
    }

    const result =
      Math.floor(
        Math.random() * sides
      ) + 1;

    return (
      "Dice roll result: " +
      result +
      " out of " +
      sides +
      "."
    );
  }

  /* =========================
     JOKE
     ========================= */

  async function toolJoke() {

    try {

      const data =
        await getJSON(
          "https://v2.jokeapi.dev/joke/Any?safe-mode"
        );

      if (data.type === "single") {
        return data.joke;
      }

      if (
        data.setup &&
        data.delivery
      ) {

        return (
          data.setup +
          " " +
          data.delivery
        );
      }

    } catch (error) {}

    return (
      "Why did the computer get cold? " +
      "Because it left its Windows open."
    );
  }

  /* =========================
     QUOTE
     ========================= */

  async function toolQuote() {

    try {

      const data =
        await getJSON(
          "https://api.quotable.io/random"
        );

      if (data.content) {

        return (
          "\"" +
          data.content +
          "\" — " +
          (data.author ||
            "Unknown")
        );
      }

    } catch (error) {}

    return (
      "Small progress is still progress. " +
      "Keep moving forward, Boss."
    );
  }

  /* =========================
     NEWS
     ========================= */

  async function toolNews() {

    try {

      const rss =
        "https://news.google.com/rss" +
        "?hl=en-IN&gl=IN&ceid=IN:en";

      const url =
        "https://api.rss2json.com/v1/api.json" +
        "?rss_url=" +
        encodeURIComponent(rss);

      const data =
        await getJSON(url);

      const items =
        Array.isArray(data.items)
          ? data.items.slice(0, 5)
          : [];

      if (!items.length) {
        throw new Error(
          "No news"
        );
      }

      items.forEach(
        (item, index) => {

          const title =
            clean(item.title);

          if (title) {

            addChat(
              "NEWS " +
              (index + 1),
              title
            );
          }
        }
      );

      return (
        "Here are the latest headlines."
      );

    } catch (error) {

      return (
        "Live news is temporarily unavailable. " +
        "You can ask me to search the web for the latest news."
      );
    }
  }

  /* =========================
     TRANSLATE
     ========================= */

  async function toolTranslate(text) {

    let query =
      text
        .replace(
          /^.*?translate/i,
          ""
        )
        .replace(
          /^.*?అనువదించ/i,
          ""
        )
        .trim();

    query =
      query
        .replace(
          /^this\s+/i,
          ""
        )
        .trim();

    if (!query) {

      return (
        "Tell me what you want me to translate."
      );
    }

    try {

      const url =
        "https://api.mymemory.translated.net/get" +
        "?q=" +
        encodeURIComponent(query) +
        "&langpair=auto|te";

      const data =
        await getJSON(url);

      const translated =
        data?.responseData
          ?.translatedText;

      if (translated) {

        return (
          "Telugu translation: " +
          translated
        );
      }

    } catch (error) {}

    return (
      "Translation service is unavailable right now."
    );
  }

  /* =========================
     CURRENCY
     ========================= */

  async function toolCurrency(text) {

    const match =
      text.match(
        /(\d+(?:\.\d+)?)\s*([A-Za-z]{3})\s*(?:to|in|into)\s*([A-Za-z]{3})/i
      );

    if (!match) {

      return (
        "Use this format: 100 USD to INR."
      );
    }

    const amount =
      Number(match[1]);

    const from =
      match[2].toUpperCase();

    const to =
      match[3].toUpperCase();

    try {

      const data =
        await getJSON(
          "https://open.er-api.com/v6/latest/" +
          encodeURIComponent(from)
        );

      const rate =
        data?.rates?.[to];

      if (
        typeof rate !==
        "number"
      ) {
        throw new Error(
          "Rate unavailable"
        );
      }

      return (
        amount +
        " " +
        from +
        " is approximately " +
        (amount * rate)
          .toFixed(2) +
        " " +
        to +
        "."
      );

    } catch (error) {

      return (
        "I could not retrieve the live exchange rate right now."
      );
    }
  }

  /* =========================
     MEANING
     ========================= */

  async function toolMeaning(text) {

    let word =
      text
        .replace(
          /what\s+is\s+the\s+meaning\s+of/i,
          ""
        )
        .replace(
          /meaning\s+of/i,
          ""
        )
        .replace(
          /^define\s+/i,
          ""
        )
        .trim();

    word =
      word
        .split(/\s+/)[0]
        .replace(
          /[^a-zA-Z'-]/g,
          ""
        );

    if (!word) {

      return (
        "Tell me the word you want defined."
      );
    }

    try {

      const data =
        await getJSON(
          "https://api.dictionaryapi.dev/api/v2/entries/en/" +
          encodeURIComponent(word)
        );

      const definition =
        data?.[0]
          ?.meanings?.[0]
          ?.definitions?.[0]
          ?.definition;

      if (definition) {

        return (
          word +
          ": " +
          definition
        );
      }

    } catch (error) {}

    return (
      "I could not find a definition for " +
      word +
      "."
    );
  }

  /* =========================
     PASSWORD
     ========================= */

  function toolPassword(text) {

    const match =
      text.match(
        /\b(\d{1,2})\b/
      );

    const length =
      Math.max(
        8,
        Math.min(
          64,
          Number(
            match?.[1] || 16
          )
        )
      );

    const characters =
      "ABCDEFGHJKLMNPQRSTUVWXYZ" +
      "abcdefghijkmnopqrstuvwxyz" +
      "23456789" +
      "!@#$%^&*_-+=";

    let result = "";

    if (
      window.crypto &&
      window.crypto.getRandomValues
    ) {

      const values =
        new Uint32Array(length);

      window.crypto
        .getRandomValues(values);

      for (
        let i = 0;
        i < length;
        i++
      ) {

        result +=
          characters[
            values[i] %
            characters.length
          ];
      }

    } else {

      for (
        let i = 0;
        i < length;
        i++
      ) {

        result +=
          characters[
            Math.floor(
              Math.random() *
              characters.length
            )
          ];
      }
    }

    return (
      "Generated password: " +
      result
    );
  }

  /* =========================
     SEARCH
     ========================= */

  function toolSearch(text) {

    let query =
      text
        .replace(
          /^search\s*(for)?/i,
          ""
        )
        .replace(
          /^వెతుకు/i,
          ""
        )
        .trim();

    if (!query) {

      return (
        "Tell me what you want me to search for."
      );
    }

    openURL(
      "https://www.google.com/search?q=" +
      encodeURIComponent(query)
    );

    return (
      "Searching Google for " +
      query +
      "."
    );
  }

  /* =========================
     OPEN APPS
     ========================= */

  function toolOpenApp(text) {

    const t = lower(text);

    const apps = [

      {
        names: [
          "youtube"
        ],
        url:
          "https://www.youtube.com/"
      },

      {
        names: [
          "google"
        ],
        url:
          "https://www.google.com/"
      },

      {
        names: [
          "gmail",
          "mail"
        ],
        url:
          "https://mail.google.com/"
      },

      {
        names: [
          "whatsapp"
        ],
        url:
          "https://web.whatsapp.com/"
      },

      {
        names: [
          "instagram"
        ],
        url:
          "https://www.instagram.com/"
      },

      {
        names: [
          "facebook"
        ],
        url:
          "https://www.facebook.com/"
      },

      {
        names: [
          "maps",
          "google maps"
        ],
        url:
          "https://maps.google.com/"
      },

      {
        names: [
          "spotify"
        ],
        url:
          "https://open.spotify.com/"
      },

      {
        names: [
          "calculator"
        ],
        url:
          "https://www.google.com/search?q=calculator"
      }

    ];

    for (
      const app of apps
    ) {

      if (
        app.names.some(
          name =>
            t.includes(name)
        )
      ) {

        openURL(app.url);

        return (
          "Opening " +
          app.names[0] +
          "."
        );
      }
    }

    return (
      "Tell me which app you want to open."
    );
  }

  /* =========================
     YOUTUBE / SONG
     ========================= */

  function toolYouTube(text) {

    let query =
      text
        .replace(
          /^please\s+/i,
          ""
        )
        .replace(
          /^play\s+/i,
          ""
        )
        .replace(
          /^youtube\s*/i,
          ""
        )
        .replace(
          /^search\s+youtube\s*(for)?/i,
          ""
        )
        .trim();

    if (!query) {

      openURL(
        "https://www.youtube.com/"
      );

      return (
        "Opening YouTube, Boss."
      );
    }

    openURL(
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(query)
    );

    return (
      "Searching YouTube for " +
      query +
      "."
    );
  }
  /* =========================================================
   J.A.R.V.I.S. - SCRIPT.JS
   PART 2 OF 2
   Paste this DIRECTLY after PART 1.
   ========================================================= */

  /* =========================
     CRYPTO
     ========================= */

  async function toolCrypto(text) {

    const t = lower(text);

    const coins = {
      bitcoin: "bitcoin",
      btc: "bitcoin",
      ethereum: "ethereum",
      eth: "ethereum",
      dogecoin: "dogecoin",
      doge: "dogecoin",
      solana: "solana",
      sol: "solana",
      xrp: "ripple",
      ripple: "ripple",
      cardano: "cardano",
      ada: "cardano"
    };

    let coinID = "bitcoin";

    for (const key in coins) {

      if (t.includes(key)) {
        coinID = coins[key];
        break;
      }
    }

    try {

      const data =
        await getJSON(
          "https://api.coingecko.com/api/v3/simple/price" +
          "?ids=" +
          encodeURIComponent(coinID) +
          "&vs_currencies=usd,inr" +
          "&include_24hr_change=true"
        );

      const coin =
        data?.[coinID];

      if (!coin) {
        throw new Error(
          "Crypto unavailable"
        );
      }

      let result =
        coinID +
        " price is $" +
        Number(
          coin.usd
        ).toLocaleString();

      if (
        typeof coin.inr ===
        "number"
      ) {

        result +=
          " or ₹" +
          Number(
            coin.inr
          ).toLocaleString();
      }

      if (
        typeof coin.usd_24h_change ===
        "number"
      ) {

        result +=
          ". 24-hour change: " +
          coin.usd_24h_change
            .toFixed(2) +
          "%";
      }

      return result + ".";

    } catch (error) {

      return (
        "Live crypto data is unavailable right now. Please try again."
      );
    }
  }


  /* =========================================================
     TOOL DISPATCHER
     ========================================================= */

  async function handleTools(text) {

    const t = lower(text);

    /* TIME */

    if (
      /\btime\b/.test(t) ||
      t.includes("current time") ||
      t.includes("what time") ||
      t.includes("టైమ్") ||
      t.includes("సమయం")
    ) {

      return toolTime();
    }


    /* WEATHER */

    if (
      t.includes("weather") ||
      t.includes("temperature") ||
      t.includes("వాతావరణం") ||
      t.includes("టెంపరేచర్")
    ) {

      return await toolWeather();
    }


    /* TIMER */

    if (
      t.includes("timer") ||
      t.includes("alarm") ||
      t.includes("టైమర్")
    ) {

      return toolTimer(text);
    }


    /* DICE / COIN */

    if (
      t.includes("dice") ||
      t.includes("roll dice") ||
      t.includes("coin") ||
      t.includes("flip coin") ||
      t.includes("toss coin") ||
      t.includes("డైస్") ||
      t.includes("కాయిన్")
    ) {

      return toolDiceCoin(text);
    }


    /* JOKE */

    if (
      t.includes("joke") ||
      t.includes("tell me a joke") ||
      t.includes("జోక్")
    ) {

      return await toolJoke();
    }


    /* QUOTE */

    if (
      t.includes("quote") ||
      t.includes("motivation") ||
      t.includes("motivational") ||
      t.includes("కోట్") ||
      t.includes("మోటివేషన్")
    ) {

      return await toolQuote();
    }


    /* NEWS */

    if (
      t === "news" ||
      t.includes("latest news") ||
      t.includes("headlines") ||
      t.includes("వార్తలు")
    ) {

      return await toolNews();
    }


    /* TRANSLATE */

    if (
      t.includes("translate") ||
      t.includes("translation") ||
      t.includes("అనువదించ") ||
      t.includes("ట్రాన్స్‌లేట్")
    ) {

      return await toolTranslate(text);
    }


    /* CURRENCY */

    if (
      t.includes("currency") ||
      t.includes("exchange rate") ||
      t.includes("convert") ||
      /\b\d+\s*[a-z]{3}\s+(to|in|into)\s*[a-z]{3}\b/i.test(text) ||
      t.includes("కరెన్సీ") ||
      t.includes("కన్వర్ట్")
    ) {

      return await toolCurrency(text);
    }


    /* MEANING */

    if (
      t.includes("meaning") ||
      t.includes("definition") ||
      t.startsWith("define ") ||
      t.includes("dictionary") ||
      t.includes("అర్థం")
    ) {

      return await toolMeaning(text);
    }


    /* PASSWORD */

    if (
      t.includes("password") ||
      t.includes("generate password") ||
      t.includes("strong password") ||
      t.includes("పాస్‌వర్డ్")
    ) {

      return toolPassword(text);
    }


    /* SEARCH */

    if (
      t === "search" ||
      t.startsWith("search ") ||
      t.startsWith("search for ") ||
      t.startsWith("వెతుకు ")
    ) {

      return toolSearch(text);
    }


    /* OPEN APP */

    if (
      t.startsWith("open ") ||
      t.includes("open youtube") ||
      t.includes("open google") ||
      t.includes("open gmail") ||
      t.includes("open whatsapp") ||
      t.includes("open instagram") ||
      t.includes("open facebook") ||
      t.includes("open maps") ||
      t.includes("open spotify") ||
      t.includes("open calculator") ||
      t.includes("ఓపెన్")
    ) {

      return toolOpenApp(text);
    }


    /* PLAY SONG / YOUTUBE */

    if (
      t.startsWith("play ") ||
      t.includes("play song") ||
      t.includes("play music") ||
      t.includes("youtube") ||
      t.includes("పాట")
    ) {

      return toolYouTube(text);
    }


    /* CRYPTO */

    if (
      t.includes("crypto") ||
      t.includes("bitcoin") ||
      t.includes("btc") ||
      t.includes("ethereum") ||
      t.includes("eth") ||
      t.includes("dogecoin") ||
      t.includes("doge") ||
      t.includes("solana") ||
      t.includes("xrp") ||
      t.includes("ripple") ||
      t.includes("క్రిప్టో")
    ) {

      return await toolCrypto(text);
    }


    /* NO TOOL MATCH */

    return null;
  }


  /* =========================================================
     LOCAL AI FALLBACK
     ========================================================= */

  function localAI(text) {

    const t = lower(text);

    if (
      t === "hi" ||
      t === "hello" ||
      t === "hey" ||
      t.includes("good morning") ||
      t.includes("good evening")
    ) {

      return (
        "Hello, Boss. J.A.R.V.I.S. is online and ready."
      );
    }


    if (
      t.includes("who are you") ||
      t.includes("what are you")
    ) {

      return (
        "I am J.A.R.V.I.S., your personal browser-based AI assistant."
      );
    }


    if (
      t.includes("thank you") ||
      t.includes("thanks")
    ) {

      return (
        "You're welcome, Boss."
      );
    }


    if (
      t.includes("help") ||
      t.includes("what can you do")
    ) {

      return (
        "I can handle time, weather, timers, dice, coins, jokes, quotes, news, translation, currency, meanings, passwords, web search, apps, YouTube, crypto, voice input, image analysis, memory and AI chat."
      );
    }


    return (
      "I received your command: " +
      text +
      ". The online AI service is currently unavailable, but all local J.A.R.V.I.S. tools are still working."
    );
  }


  /* =========================================================
     ONLINE AI CHAT
     ========================================================= */

  async function askAI(text) {

    const memory =
      getMemory();

    const systemPrompt =
      "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
      "Answer clearly and naturally. " +
      "Keep normal answers concise unless the user asks for detail.";

    const userPrompt =
      systemPrompt +
      "\nPrevious response: " +
      (memory.lastResponse || "None") +
      "\nUser: " +
      text;

    /*
      Public fallback AI endpoint.

      If this service is unavailable, the local
      fallback below prevents the button from
      becoming stuck.
    */

    try {

      const response =
        await fetchWithTimeout(
          "https://text.pollinations.ai/",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                messages: [
                  {
                    role: "user",
                    content:
                      userPrompt
                  }
                ]
              })
          },
          20000
        );

      if (!response.ok) {
        throw new Error(
          "AI request failed"
        );
      }

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      if (
        contentType.includes(
          "application/json"
        )
      ) {

        const data =
          await response.json();

        const answer =
          data?.choices?.[0]
            ?.message?.content ||
          data?.output ||
          data?.response ||
          data?.text;

        if (answer) {
          return clean(answer);
        }
      } else {

        const textResult =
          await response.text();

        if (clean(textResult)) {
          return clean(textResult);
        }
      }

    } catch (error) {

      console.warn(
        "Online AI unavailable:",
        error
      );
    }

    return localAI(text);
  }


  /* =========================================================
     IMAGE ANALYSIS
     ========================================================= */

  async function analyzeImage(file) {

    if (!file) {
      throw new Error(
        "No image selected."
      );
    }

    if (
      !file.type.startsWith("image/")
    ) {

      throw new Error(
        "Please select a valid image."
      );
    }

    const dataURL =
      await new Promise(
        (resolve, reject) => {

          const reader =
            new FileReader();

          reader.onload = () =>
            resolve(
              reader.result
            );

          reader.onerror = () =>
            reject(
              new Error(
                "Unable to read image."
              )
            );

          reader.readAsDataURL(
            file
          );
        }
      );


    const dimensions =
      await new Promise(
        (resolve, reject) => {

          const image =
            new Image();

          image.onload = () =>
            resolve({
              width:
                image.naturalWidth,
              height:
                image.naturalHeight
            });

          image.onerror = () =>
            reject(
              new Error(
                "Invalid image."
              )
            );

          image.src =
            dataURL;
        }
      );


    /*
      OCR is used when possible.
      The image itself is not sent to
      the chat endpoint.
    */

    let detectedText = "";

    try {

      const form =
        new FormData();

      form.append(
        "apikey",
        "helloworld"
      );

      form.append(
        "language",
        "eng"
      );

      form.append(
        "isOverlayRequired",
        "false"
      );

      form.append(
        "base64Image",
        dataURL
      );

      const response =
        await fetchWithTimeout(
          "https://api.ocr.space/parse/image",
          {
            method: "POST",
            body: form
          },
          20000
        );

      if (response.ok) {

        const data =
          await response.json();

        detectedText =
          clean(
            (data.ParsedResults || [])
              .map(
                item =>
                  item.ParsedText || ""
              )
              .join(" ")
          );
      }

    } catch (error) {

      console.warn(
        "OCR unavailable:",
        error
      );
    }


    let result =
      "Image analysis complete. " +
      "Resolution: " +
      dimensions.width +
      " × " +
      dimensions.height +
      ".";


    if (detectedText) {

      result +=
        " Detected text: " +
        detectedText.substring(
          0,
          1000
        );

    } else {

      result +=
        " No readable text was detected in the image.";
    }


    return result;
  }


  async function handleImage(file) {

    if (!file) {
      return;
    }

    userMessage(
      "Analyze image: " +
      file.name
    );

    setBusy(true);

    try {

      const result =
        await analyzeImage(file);

      reply(result);

    } catch (error) {

      reply(
        error.message ||
        "Image analysis failed."
      );

    } finally {

      setBusy(false);
    }
  }


  /* =========================================================
     VOICE INPUT
     ========================================================= */

  function setupVoice() {

    if (!micBtn) {
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

      micBtn.title =
        "Voice input is not supported by this browser.";

      micBtn.addEventListener(
        "click",
        () => {

          reply(
            "Voice input is not supported by this browser. Please use Chrome or another browser with speech recognition."
          );
        }
      );

      return;
    }


    recognition =
      new SpeechRecognition();

    recognition.lang =
      "en-IN";

    recognition.continuous =
      false;

    recognition.interimResults =
      false;

    recognition.maxAlternatives =
      1;


    recognition.onstart =
      function () {

        isListening = true;

        micBtn.classList.add(
          "listening"
        );

        micBtn.setAttribute(
          "aria-label",
          "Stop voice input"
        );
      };


    recognition.onresult =
      function (event) {

        const transcript =
          event
            ?.results?.[0]?.[0]
            ?.transcript || "";

        if (!transcript) {
          return;
        }

        msg.value =
          transcript;

        /*
          Small delay gives the browser
          time to update the input.
        */

        setTimeout(
          runCommand,
          100
        );
      };


    recognition.onerror =
      function (event) {

        console.warn(
          "Speech recognition:",
          event.error
        );

        isListening =
          false;

        micBtn.classList.remove(
          "listening"
        );

        micBtn.setAttribute(
          "aria-label",
          "Activate voice input"
        );

        if (
          event.error ===
          "not-allowed"
        ) {

          reply(
            "Microphone permission was denied. Please allow microphone access."
          );
        }
      };


    recognition.onend =
      function () {

        isListening =
          false;

        micBtn.classList.remove(
          "listening"
        );

        micBtn.setAttribute(
          "aria-label",
          "Activate voice input"
        );
      };


    micBtn.addEventListener(
      "click",
      function () {

        try {

          if (isListening) {

            recognition.stop();

          } else {

            recognition.start();
          }

        } catch (error) {

          console.warn(
            "Recognition start error:",
            error
          );
        }
      }
    );
  }


  /* =========================================================
     MAIN COMMAND
     ========================================================= */

  async function runCommand() {

    if (isBusy) {
      return;
    }

    const text =
      clean(msg.value);

    if (!text) {
      return;
    }


    userMessage(text);

    msg.value = "";

    setBusy(true);


    try {

      /*
        First check local tools.
        This guarantees commands such as
        time/weather/timer/etc. don't depend
        on the AI server.
      */

      const toolResult =
        await handleTools(text);


      if (
        toolResult !== null &&
        toolResult !== undefined
      ) {

        reply(
          toolResult
        );

        return;
      }


      /*
        Only unknown/custom commands
        go to AI.
      */

      const aiAnswer =
        await askAI(text);

      reply(
        aiAnswer
      );

    } catch (error) {

      console.error(
        "JARVIS command error:",
        error
      );

      reply(
        "I encountered an error while processing that command. Please try again."
      );

    } finally {

      setBusy(false);

      msg.focus();
    }
  }


  /* =========================================================
     EVENT LISTENERS
     ========================================================= */

  /* EXECUTE BUTTON */

  send.addEventListener(
    "click",
    function (event) {

      event.preventDefault();

      runCommand();
    }
  );


  /* ENTER KEY */

  msg.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();

        runCommand();
      }
    }
  );


  /* CLEAR MEMORY BUTTON */

  if (clearBtn) {

    clearBtn.addEventListener(
      "click",
      function (event) {

        event.preventDefault();

        clearMemory();
      }
    );
  }


  /* CAMERA BUTTON */

  if (camBtn && imgInput) {

    camBtn.addEventListener(
      "click",
      function (event) {

        event.preventDefault();

        imgInput.click();
      }
    );
  }


  /* IMAGE FILE */

  if (imgInput) {

    imgInput.addEventListener(
      "change",
      function () {

        const file =
          this.files &&
          this.files[0];

        if (file) {
          handleImage(file);
        }

        /*
          Allows selecting the same
          image again later.
        */

        this.value = "";
      }
    );
  }


  /* VOICE */

  setupVoice();


  /* =========================================================
     GLOBAL FUNCTIONS
     ========================================================= */

  window.jarvisRun =
    runCommand;

  window.handleTools =
    handleTools;

  window.jarvisSpeak =
    speak;

  window.jarvisClearMemory =
    clearMemory;

  window.jarvisAnalyzeImage =
    handleImage;


  /* =========================================================
     STARTUP
     ========================================================= */

  try {

    /*
      Don't automatically speak on page load.
      Just make the input ready.
    */

    msg.focus();

    console.log(
      "J.A.R.V.I.S. system ready."
    );

  } catch (error) {

    console.warn(
      "JARVIS startup warning:",
      error
    );
  }

})();
