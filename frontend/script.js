"use strict";

(function () {

  /* =====================================================
     J.A.R.V.I.S. SCRIPT.JS
     PART 1 / 2
     ===================================================== */

  const msg = document.getElementById("msg");
  const send = document.getElementById("send");
  const micBtn = document.getElementById("mic-btn");
  const camBtn = document.getElementById("cam-btn");
  const clearBtn = document.getElementById("clear-btn");
  const imgInput = document.getElementById("img-input");
  const chat = document.getElementById("chat");

  if (!msg || !send || !chat) {
    console.error("JARVIS: HTML elements not found.");
    return;
  }

  let recognition = null;
  let listening = false;
  let busy = false;

  const MEMORY_KEY = "JARVIS_MEMORY";

  /* =====================================================
     HELPERS
     ===================================================== */

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

  /*
     THIS MAKES USER + JARVIS TEXT APPEAR
     INSIDE THE EXISTING CHAT BOX.
  */

  function showChat() {
    chat.style.display = "block";
  }

  function addChat(sender, text) {

    showChat();

    const box = document.createElement("div");

    box.className = "jarvis-message";

    const title = document.createElement("strong");
    title.textContent = sender;

    const content = document.createElement("div");
    content.textContent = clean(text);

    box.appendChild(title);
    box.appendChild(content);

    chat.appendChild(box);

    chat.scrollTop = chat.scrollHeight;

    return box;
  }

  function showUser(text) {
    addChat("YOU", text);
  }

  function showJarvis(text) {
    addChat("J.A.R.V.I.S.", text);
  }

  function reply(text, speakNow = true) {

    const answer = clean(text);

    if (!answer) return;

    showJarvis(answer);

    saveMemory(
      "lastResponse",
      answer
    );

    if (speakNow) {
      speak(answer);
    }
  }

  /* =====================================================
     BUTTON STATE
     ===================================================== */

  function setBusy(state) {

    busy = state;

    if (send) {

      send.disabled = state;

      send.textContent =
        state
          ? "WAIT..."
          : "EXECUTE";
    }
  }

  /* =====================================================
     TEXT TO SPEECH
     ===================================================== */

  function speak(text) {

    if (
      !("speechSynthesis" in window)
    ) {
      return;
    }

    try {

      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(
          clean(text)
        );

      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

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
        utterance.voice = voice;
      }

      window.speechSynthesis.speak(
        utterance
      );

    } catch (error) {
      console.warn(
        "Speech error:",
        error
      );
    }
  }

  /* =====================================================
     MEMORY
     ===================================================== */

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

      const memory =
        getMemory();

      memory[key] = value;

      localStorage.setItem(
        MEMORY_KEY,
        JSON.stringify(memory)
      );

    } catch (error) {}
  }

  function clearMemory() {

    try {
      localStorage.removeItem(
        MEMORY_KEY
      );
    } catch (error) {}

    chat.innerHTML = "";

    chat.style.display = "block";

    msg.value = "";

    reply(
      "Memory cleared successfully, Boss."
    );
  }

  /* =====================================================
     FETCH
     ===================================================== */

  async function fetchWithTimeout(
    url,
    options = {},
    timeout = 15000
  ) {

    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () => controller.abort(),
        timeout
      );

    try {

      return await fetch(
        url,
        {
          ...options,
          signal:
            controller.signal
        }
      );

    } finally {

      clearTimeout(timer);
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

  /* =====================================================
     OPEN URL
     ===================================================== */

  function openURL(url) {

    try {

      const win =
        window.open(
          url,
          "_blank"
        );

      if (!win) {
        window.location.href =
          url;
      }

    } catch (error) {

      window.location.href =
        url;
    }
  }

  /* =====================================================
     TIME
     ===================================================== */

  function toolTime() {

    return (
      "The current time is " +
      new Date().toLocaleTimeString(
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

  /* =====================================================
     WEATHER
     ===================================================== */

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
                  "Geolocation unavailable"
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

      const lat =
        position.coords.latitude;

      const lon =
        position.coords.longitude;

      const url =
        "https://api.open-meteo.com/v1/forecast" +
        "?latitude=" +
        encodeURIComponent(lat) +
        "&longitude=" +
        encodeURIComponent(lon) +
        "&current=" +
        "temperature_2m," +
        "relative_humidity_2m," +
        "wind_speed_10m" +
        "&timezone=auto";

      const data =
        await getJSON(url);

      const c =
        data.current || {};

      return (
        "Current temperature is " +
        (c.temperature_2m ??
          "unavailable") +
        "°C. Humidity is " +
        (c.relative_humidity_2m ??
          "unavailable") +
        "%. Wind speed is " +
        (c.wind_speed_10m ??
          "unavailable") +
        " km/h."
      );

    } catch (error) {

      return (
        "I could not get live weather. " +
        "Please allow location permission and try again."
      );
    }
  }

  /* =====================================================
     TIMER
     ===================================================== */

  function toolTimer(text) {

    const match =
      lower(text).match(
        /(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i
      );

    if (!match) {

      return (
        "Please say a duration, for example: timer 10 seconds."
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

    setTimeout(
      function () {

        const done =
          "Timer complete, Boss.";

        showJarvis(done);
        speak(done);

      },
      amount * multiplier
    );

    return (
      "Timer set for " +
      amount +
      " " +
      unit +
      "."
    );
  }

  /* =====================================================
     DICE / COIN
     ===================================================== */

  function toolDiceCoin(text) {

    const t =
      lower(text);

    if (
      t.includes("coin") ||
      t.includes("flip") ||
      t.includes("toss") ||
      t.includes("కాయిన్")
    ) {

      return (
        "Coin toss result: " +
        (
          Math.random() < 0.5
            ? "Heads"
            : "Tails"
        ) +
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

  /* =====================================================
     JOKE
     ===================================================== */

  async function toolJoke() {

    try {

      const data =
        await getJSON(
          "https://v2.jokeapi.dev/joke/Any?safe-mode"
        );

      if (
        data.type === "single"
      ) {
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

  /* =====================================================
     QUOTE
     ===================================================== */

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
          (
            data.author ||
            "Unknown"
          )
        );
      }

    } catch (error) {}

    return (
      "Small progress is still progress, Boss."
    );
  }

  /* =====================================================
     NEWS
     ===================================================== */

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
        function (item, index) {

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
        "Live news is temporarily unavailable."
      );
    }
  }

  /* =====================================================
     TRANSLATE
     ===================================================== */

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

  /* =====================================================
     CURRENCY
     ===================================================== */

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
        typeof rate !== "number"
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
        (
          amount * rate
        ).toFixed(2) +
        " " +
        to +
        "."
      );

    } catch (error) {

      return (
        "I could not retrieve the live exchange rate."
      );
    }
  }

  /* =====================================================
     MEANING
     ===================================================== */

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
        .trim()
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

  /* =====================================================
     PASSWORD
     ===================================================== */

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

    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZ" +
      "abcdefghijkmnopqrstuvwxyz" +
      "23456789!@#$%^&*_-+=";

    let password = "";

    const values =
      new Uint32Array(length);

    if (
      window.crypto &&
      window.crypto.getRandomValues
    ) {

      window.crypto.getRandomValues(
        values
      );

      for (
        let i = 0;
        i < length;
        i++
      ) {

        password +=
          chars[
            values[i] %
            chars.length
          ];
      }

    } else {

      for (
        let i = 0;
        i < length;
        i++
      ) {

        password +=
          chars[
            Math.floor(
              Math.random() *
              chars.length
            )
          ];
      }
    }

    return (
      "Generated password: " +
      password
    );
  }

  /* =====================================================
     SEARCH
     ===================================================== */

  function toolSearch(text) {

    const query =
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

  /* =====================================================
     OPEN APPS
     ===================================================== */

  function toolOpenApp(text) {

    const t =
      lower(text);

    const apps = [

      [
        "youtube",
        "https://www.youtube.com/"
      ],

      [
        "google",
        "https://www.google.com/"
      ],

      [
        "gmail",
        "https://mail.google.com/"
      ],

      [
        "whatsapp",
        "https://web.whatsapp.com/"
      ],

      [
        "instagram",
        "https://www.instagram.com/"
      ],

      [
        "facebook",
        "https://www.facebook.com/"
      ],

      [
        "maps",
        "https://maps.google.com/"
      ],

      [
        "spotify",
        "https://open.spotify.com/"
      ],

      [
        "calculator",
        "https://www.google.com/search?q=calculator"
      ]

    ];

    for (
      const app of apps
    ) {

      if (
        t.includes(app[0])
      ) {

        openURL(app[1]);

        return (
          "Opening " +
          app[0] +
          "."
        );
      }
    }

    return (
      "Tell me which app you want to open."
    );
  }

  /* =====================================================
     YOUTUBE / SONG
     ===================================================== */

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
     /* =====================================================
     J.A.R.V.I.S. SCRIPT.JS
     PART 2 / 2
     ===================================================== */

  /* =====================================================
     CRYPTO
     ===================================================== */

  async function toolCrypto(text) {

    const t =
      lower(text);

    const coins = {
      bitcoin: "bitcoin",
      btc: "bitcoin",
      ethereum: "ethereum",
      eth: "ethereum",
      dogecoin: "dogecoin",
      doge: "dogecoin",
      solana: "solana",
      sol: "solana",
      ripple: "ripple",
      xrp: "ripple",
      cardano: "cardano",
      ada: "cardano"
    };

    let id = "bitcoin";

    for (
      const key in coins
    ) {

      if (
        t.includes(key)
      ) {

        id = coins[key];
        break;
      }
    }

    try {

      const data =
        await getJSON(
          "https://api.coingecko.com/api/v3/simple/price" +
          "?ids=" +
          encodeURIComponent(id) +
          "&vs_currencies=usd,inr" +
          "&include_24hr_change=true"
        );

      const coin =
        data?.[id];

      if (!coin) {
        throw new Error(
          "Crypto unavailable"
        );
      }

      let result =
        id +
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
        "Live crypto data is unavailable right now."
      );
    }
  }


  /* =====================================================
     TOOL HANDLER
     ===================================================== */

  async function handleTools(text) {

    const t =
      lower(text);

    /* TIME */

    if (
      t.includes("time") ||
      t.includes("సమయం") ||
      t.includes("టైమ్")
    ) {

      return toolTime();
    }


    /* WEATHER */

    if (
      t.includes("weather") ||
      t.includes("temperature") ||
      t.includes("వాతావరణం")
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
      t.includes("జోక్")
    ) {

      return await toolJoke();
    }


    /* QUOTE */

    if (
      t.includes("quote") ||
      t.includes("motivation") ||
      t.includes("motivational") ||
      t.includes("కోట్")
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
      /\d+\s*[a-z]{3}\s+(to|in|into)\s*[a-z]{3}/i.test(text)
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


    /* OPEN APPS */

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
      t.includes("open calculator")
    ) {

      return toolOpenApp(text);
    }


    /* YOUTUBE / SONG */

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


    /* NO TOOL */

    return null;
  }


  /* =====================================================
     LOCAL AI FALLBACK
     ===================================================== */

  function localAI(text) {

    const t =
      lower(text);

    if (
      t === "hi" ||
      t === "hello" ||
      t === "hey"
    ) {

      return (
        "Hello, Boss. J.A.R.V.I.S. is online and ready."
      );
    }

    if (
      t.includes("who are you")
    ) {

      return (
        "I am J.A.R.V.I.S., your personal AI assistant."
      );
    }

    if (
      t.includes("thank")
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
        "I can handle time, weather, timers, dice, coins, jokes, quotes, news, translation, currency, meanings, passwords, search, apps, YouTube, crypto, voice input, image analysis, memory and chat."
      );
    }

    return (
      "I received your command: " +
      text +
      "."
    );
  }


  /* =====================================================
     AI CHAT
     ===================================================== */

  async function askAI(text) {

    const memory =
      getMemory();

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
                      "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
                      "Answer naturally and clearly. " +
                      "User says: " +
                      text +
                      "\nPrevious response: " +
                      (
                        memory.lastResponse ||
                        "none"
                      )
                  }
                ]
              })
          },
          20000
        );

      if (!response.ok) {
        throw new Error(
          "AI unavailable"
        );
      }

      const type =
        response.headers.get(
          "content-type"
        ) || "";

      if (
        type.includes(
          "application/json"
        )
      ) {

        const data =
          await response.json();

        const answer =
          data?.choices?.[0]
            ?.message?.content ||
          data?.response ||
          data?.text ||
          data?.output;

        if (answer) {
          return clean(answer);
        }

      } else {

        const answer =
          await response.text();

        if (clean(answer)) {
          return clean(answer);
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


  /* =====================================================
     IMAGE ANALYSIS
     ===================================================== */

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
        "Please select an image file."
      );
    }

    const imageData =
      await new Promise(
        (resolve, reject) => {

          const reader =
            new FileReader();

          reader.onload =
            () => resolve(
              reader.result
            );

          reader.onerror =
            () => reject(
              new Error(
                "Could not read image."
              )
            );

          reader.readAsDataURL(
            file
          );
        }
      );


    const size =
      await new Promise(
        (resolve, reject) => {

          const image =
            new Image();

          image.onload =
            () => resolve({
              width:
                image.naturalWidth,
              height:
                image.naturalHeight
            });

          image.onerror =
            () => reject(
              new Error(
                "Invalid image."
              )
            );

          image.src =
            imageData;
        }
      );


    let detected = "";

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
        imageData
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

        detected =
          clean(
            (data.ParsedResults || [])
              .map(
                x =>
                  x.ParsedText || ""
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
      size.width +
      " × " +
      size.height +
      ".";


    if (detected) {

      result +=
        " Detected text: " +
        detected.substring(
          0,
          1000
        );

    } else {

      result +=
        " No readable text was detected.";
    }


    return result;
  }


  async function handleImage(file) {

    if (!file) return;

    showUser(
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


  /* =====================================================
     VOICE INPUT
     ===================================================== */

  function setupVoice() {

    if (!micBtn) return;

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

      micBtn.addEventListener(
        "click",
        function () {

          reply(
            "Voice input is not supported by this browser."
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


    recognition.onstart =
      function () {

        listening = true;

        micBtn.classList.add(
          "listening"
        );
      };


    recognition.onresult =
      function (event) {

        const text =
          event.results?.[0]?.[0]
            ?.transcript || "";

        if (!text) return;

        msg.value = text;

        setTimeout(
          runCommand,
          100
        );
      };


    recognition.onerror =
      function (event) {

        console.warn(
          "Voice error:",
          event.error
        );

        listening = false;

        micBtn.classList.remove(
          "listening"
        );
      };


    recognition.onend =
      function () {

        listening = false;

        micBtn.classList.remove(
          "listening"
        );
      };


    micBtn.addEventListener(
      "click",
      function () {

        try {

          if (listening) {

            recognition.stop();

          } else {

            recognition.start();
          }

        } catch (error) {

          console.warn(
            error
          );
        }
      }
    );
  }


  /* =====================================================
     MAIN COMMAND
     ===================================================== */

  async function runCommand() {

    if (busy) return;

    const text =
      clean(msg.value);

    if (!text) return;

    /*
       COMMAND APPEARS INSIDE CHAT BOX
    */

    showUser(text);

    msg.value = "";

    setBusy(true);

    try {

      /*
         1. CHECK TOOL
      */

      const result =
        await handleTools(text);

      /*
         2. IF TOOL MATCHED,
            SHOW ITS RESULT IN CHAT BOX
      */

      if (
        result !== null &&
        result !== undefined
      ) {

        reply(result);

        return;
      }

      /*
         3. OTHERWISE SEND TO AI
      */

      const answer =
        await askAI(text);

      /*
         4. SHOW AI RESPONSE
            IN CHAT BOX
      */

      reply(answer);

    } catch (error) {

      console.error(
        "JARVIS error:",
        error
      );

      reply(
        "Command failed. Please try again."
      );

    } finally {

      setBusy(false);

      msg.focus();
    }
  }


  /* =====================================================
     EVENTS
     ===================================================== */

  send.addEventListener(
    "click",
    function (event) {

      event.preventDefault();

      runCommand();
    }
  );


  msg.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key === "Enter"
      ) {

        event.preventDefault();

        runCommand();
      }
    }
  );


  if (clearBtn) {

    clearBtn.addEventListener(
      "click",
      function (event) {

        event.preventDefault();

        clearMemory();
      }
    );
  }


  if (
    camBtn &&
    imgInput
  ) {

    camBtn.addEventListener(
      "click",
      function (event) {

        event.preventDefault();

        imgInput.click();
      }
    );
  }


  if (imgInput) {

    imgInput.addEventListener(
      "change",
      function () {

        const file =
          this.files?.[0];

        if (file) {
          handleImage(file);
        }

        this.value = "";
      }
    );
  }


  /* =====================================================
     START VOICE
     ===================================================== */

  setupVoice();


  /* =====================================================
     GLOBAL ACCESS
     ===================================================== */

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


  /* =====================================================
     READY
     ===================================================== */

  console.log(
    "J.A.R.V.I.S. READY"
  );

})();
