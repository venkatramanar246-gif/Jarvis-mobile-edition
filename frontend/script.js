"use strict";

(function () {

  /* =========================================================
     J.A.R.V.I.S. — COMPLETE SCRIPT
     PART 1 / 2

     Existing HTML IDs preserved:
     chat
     msg
     send
     mic-btn
     cam-btn
     clear-btn
     img-input
     ========================================================= */

  const chat = document.getElementById("chat");
  const msg = document.getElementById("msg");
  const send = document.getElementById("send");
  const micBtn = document.getElementById("mic-btn");
  const camBtn = document.getElementById("cam-btn");
  const clearBtn = document.getElementById("clear-btn");
  const imgInput = document.getElementById("img-input");

  if (!chat || !msg || !send) {
    console.error("J.A.R.V.I.S.: Required HTML elements not found.");
    return;
  }

  let recognition = null;
  let isListening = false;
  let isBusy = false;
  let timerCounter = 0;

  const MEMORY_KEY = "JARVIS_MEMORY_V2";

  /* =========================================================
     BASIC HELPERS
     ========================================================= */

  function clean(value) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showChat() {
    chat.style.display = "block";
  }

  /* =========================================================
     CHAT BOX OUTPUT
     ========================================================= */

  function addMessage(sender, text, type) {

    showChat();

    const wrapper = document.createElement("div");

    wrapper.className =
      "jarvis-message " +
      (type || "");

    wrapper.style.margin = "10px 0";
    wrapper.style.padding = "10px";
    wrapper.style.borderRadius = "10px";
    wrapper.style.whiteSpace = "pre-wrap";
    wrapper.style.wordBreak = "break-word";

    const title = document.createElement("div");

    title.className = "jarvis-message-title";
    title.textContent = sender;

    title.style.fontWeight = "700";
    title.style.marginBottom = "4px";

    const body = document.createElement("div");

    body.className = "jarvis-message-text";
    body.textContent = clean(text);

    wrapper.appendChild(title);
    wrapper.appendChild(body);

    chat.appendChild(wrapper);

    chat.scrollTop = chat.scrollHeight;

    return wrapper;
  }

  function userMessage(text) {
    return addMessage(
      "YOU",
      text,
      "user-message"
    );
  }

  function jarvisMessage(text) {
    return addMessage(
      "J.A.R.V.I.S.",
      text,
      "assistant-message"
    );
  }

  function reply(text, shouldSpeak = true) {

    const answer = clean(text);

    if (!answer) return;

    jarvisMessage(answer);

    saveMemory(
      "lastResponse",
      answer
    );

    if (shouldSpeak) {
      speak(answer);
    }
  }

  /* =========================================================
     MEMORY
     ========================================================= */

  function getMemory() {

    try {

      return JSON.parse(
        localStorage.getItem(MEMORY_KEY) || "{}"
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

  function clearMemory(showResponse = true) {

    try {
      localStorage.removeItem(MEMORY_KEY);
    } catch (error) {}

    if (chat) {
      chat.innerHTML = "";
      chat.style.display = "block";
    }

    if (showResponse) {
      reply(
        "Memory cleared successfully, Boss."
      );
    }
  }

  /* =========================================================
     SPEECH / TEXT TO SPEECH
     ========================================================= */

  function speak(text) {

    if (!("speechSynthesis" in window)) {
      return;
    }

    try {

      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(
          clean(text)
        );

      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voices =
        window.speechSynthesis.getVoices();

      const preferred =
        voices.find(v =>
          /en-IN/i.test(v.lang)
        ) ||
        voices.find(v =>
          /en-US/i.test(v.lang)
        ) ||
        voices.find(v =>
          /en-GB/i.test(v.lang)
        );

      if (preferred) {
        utterance.voice = preferred;
      }

      window.speechSynthesis.speak(
        utterance
      );

    } catch (error) {

      console.warn(
        "Speech synthesis error:",
        error
      );
    }
  }

  /* =========================================================
     FETCH WITH TIMEOUT
     ========================================================= */

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
          signal: controller.signal
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
        "HTTP " + response.status
      );
    }

    return await response.json();
  }

  /* =========================================================
     OPEN WEBSITE
     ========================================================= */

  function openURL(url) {

    try {

      const newWindow =
        window.open(
          url,
          "_blank",
          "noopener,noreferrer"
        );

      if (!newWindow) {
        window.location.href = url;
      }

    } catch (error) {

      window.location.href = url;
    }
  }

  /* =========================================================
     01 — TIME
     ========================================================= */

  function toolTime() {

    const now = new Date();

    const time =
      now.toLocaleTimeString(
        "en-IN",
        {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit"
        }
      );

    const date =
      now.toLocaleDateString(
        "en-IN",
        {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        }
      );

    return (
      "The current time is " +
      time +
      ". Today is " +
      date +
      ", Boss."
    );
  }

  /* =========================================================
     02 — WEATHER
     ========================================================= */

  async function toolWeather() {

    if (!navigator.geolocation) {

      return (
        "Your browser does not support location access."
      );
    }

    try {

      const position =
        await new Promise(
          (resolve, reject) => {

            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000
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
        "apparent_temperature," +
        "wind_speed_10m," +
        "weather_code" +
        "&timezone=auto";

      const data =
        await getJSON(url);

      const current =
        data.current || {};

      const temperature =
        current.temperature_2m;

      const feels =
        current.apparent_temperature;

      const humidity =
        current.relative_humidity_2m;

      const wind =
        current.wind_speed_10m;

      const description =
        weatherDescription(
          current.weather_code
        );

      return (
        "Current weather: " +
        description +
        ". Temperature is " +
        temperature +
        "°C, feels like " +
        feels +
        "°C. Humidity is " +
        humidity +
        "%. Wind speed is " +
        wind +
        " km/h."
      );

    } catch (error) {

      return (
        "I could not access live weather. " +
        "Please allow location permission and try again."
      );
    }
  }

  function weatherDescription(code) {

    const map = {
      0: "clear sky",
      1: "mainly clear",
      2: "partly cloudy",
      3: "overcast",
      45: "foggy",
      48: "depositing rime fog",
      51: "light drizzle",
      53: "moderate drizzle",
      55: "dense drizzle",
      61: "light rain",
      63: "moderate rain",
      65: "heavy rain",
      71: "light snow",
      73: "moderate snow",
      75: "heavy snow",
      80: "light rain showers",
      81: "moderate rain showers",
      82: "violent rain showers",
      95: "thunderstorm",
      96: "thunderstorm with hail",
      99: "thunderstorm with heavy hail"
    };

    return map[code] || "unknown conditions";
  }

  /* =========================================================
     03 — TIMER
     ========================================================= */

  function toolTimer(text) {

    const match =
      clean(text).match(
        /(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i
      );

    if (!match) {

      return (
        "Please specify a duration. " +
        "For example: timer 10 seconds."
      );
    }

    const amount =
      Number(match[1]);

    const unit =
      match[2].toLowerCase();

    let milliseconds = 1000;

    if (
      /minutes?|mins?/.test(unit)
    ) {
      milliseconds =
        amount * 60 * 1000;
    }

    if (
      /hours?|hrs?/.test(unit)
    ) {
      milliseconds =
        amount * 60 * 60 * 1000;
    }

    const timerID =
      ++timerCounter;

    setTimeout(
      function () {

        const message =
          "Timer " +
          timerID +
          " is complete, Boss.";

        jarvisMessage(message);
        speak(message);

      },
      milliseconds
    );

    return (
      "Timer " +
      timerID +
      " set for " +
      amount +
      " " +
      unit +
      "."
    );
  }

  /* =========================================================
     04 — DICE / COIN
     ========================================================= */

  function toolDiceCoin(text) {

    const t =
      lower(text);

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

  /* =========================================================
     05 — JOKE
     ========================================================= */

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

  /* =========================================================
     06 — QUOTE
     ========================================================= */

  async function toolQuote() {

    try {

      const data =
        await getJSON(
          "https://dummyjson.com/quotes/random"
        );

      if (data.quote) {

        return (
          "\"" +
          data.quote +
          "\" — " +
          (
            data.author ||
            "Unknown"
          )
        );
      }

    } catch (error) {}

    return (
      "Success is built from small steps taken consistently, Boss."
    );
  }

  /* =========================================================
     07 — NEWS
     ========================================================= */

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
        await getJSON(
          url,
          {},
          20000
        );

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

            addMessage(
              "NEWS " + (index + 1),
              title,
              "news-message"
            );
          }
        }
      );

      return (
        "Latest headlines loaded in the chat box."
      );

    } catch (error) {

      return (
        "Live news is temporarily unavailable. Please try again."
      );
    }
  }

  /* =========================================================
     08 — TRANSLATE
     ========================================================= */

  async function toolTranslate(text) {

    let query =
      clean(text)
        .replace(
          /^please\s+/i,
          ""
        )
        .replace(
          /^translate\s*/i,
          ""
        )
        .replace(
          /^translation\s*/i,
          ""
        )
        .replace(
          /^అనువదించ\s*/i,
          ""
        )
        .trim();

    if (!query) {

      return (
        "Tell me the sentence you want to translate."
      );
    }

    let target = "te";

    if (
      /\bto\s+english\b/i.test(query)
    ) {

      target = "en";

      query =
        query.replace(
          /\bto\s+english\b/i,
          ""
        ).trim();
    }

    try {

      const url =
        "https://api.mymemory.translated.net/get" +
        "?q=" +
        encodeURIComponent(query) +
        "&langpair=auto|" +
        target;

      const data =
        await getJSON(
          url,
          {},
          20000
        );

      const result =
        data?.responseData?.translatedText;

      if (result) {

        return (
          "Translation: " +
          result
        );
      }

    } catch (error) {}

    return (
      "Translation service is temporarily unavailable."
    );
  }

  /* =========================================================
     09 — CURRENCY
     ========================================================= */

  async function toolCurrency(text) {

    const match =
      clean(text).match(
        /(\d+(?:\.\d+)?)\s*([A-Za-z]{3})\s*(?:to|in|into)\s*([A-Za-z]{3})/i
      );

    if (!match) {

      return (
        "Use the format: 100 USD to INR."
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
          encodeURIComponent(from),
          {},
          15000
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

      const converted =
        amount * rate;

      return (
        amount +
        " " +
        from +
        " is approximately " +
        converted.toFixed(2) +
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

  /* =========================================================
     10 — MEANING
     ========================================================= */

  async function toolMeaning(text) {

    let word =
      clean(text)
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
        .replace(
          /^dictionary\s+/i,
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
        "Please tell me the word you want the meaning of."
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

      const example =
        data?.[0]
          ?.meanings?.[0]
          ?.definitions?.[0]
          ?.example;

      if (definition) {

        return (
          word +
          " means: " +
          definition +
          (
            example
              ? " Example: " + example
              : ""
          )
        );
      }

    } catch (error) {}

    return (
      "I could not find a definition for " +
      word +
      "."
    );
  }

  /* =========================================================
     11 — PASSWORD
     ========================================================= */

  function toolPassword(text) {

    const match =
      clean(text).match(
        /\b(\d{1,2})\b/
      );

    const length =
      Math.max(
        8,
        Math.min(
          64,
          Number(match?.[1] || 16)
        )
      );

    const uppercase =
      "ABCDEFGHJKLMNPQRSTUVWXYZ";

    const lowercase =
      "abcdefghijkmnopqrstuvwxyz";

    const numbers =
      "23456789";

    const symbols =
      "!@#$%^&*_-+=";

    const chars =
      uppercase +
      lowercase +
      numbers +
      symbols;

    let password = "";

    if (
      window.crypto &&
      window.crypto.getRandomValues
    ) {

      const values =
        new Uint32Array(length);

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
            values[i] % chars.length
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

  /* =========================================================
     12 — SEARCH
     ========================================================= */

  function toolSearch(text) {

    const query =
      clean(text)
        .replace(
          /^please\s+/i,
          ""
        )
        .replace(
          /^search\s*(for)?\s*/i,
          ""
        )
        .replace(
          /^వెతుకు\s*/i,
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
      "Searching Google for: " +
      query
    );
  }

  /* =========================================================
     13 — OPEN APPS
     ========================================================= */

  function toolOpenApps(text) {

    const t =
      lower(text);

    const apps = {

      youtube:
        "https://www.youtube.com/",

      google:
        "https://www.google.com/",

      gmail:
        "https://mail.google.com/",

      whatsapp:
        "https://web.whatsapp.com/",

      instagram:
        "https://www.instagram.com/",

      facebook:
        "https://www.facebook.com/",

      maps:
        "https://maps.google.com/",

      spotify:
        "https://open.spotify.com/",

      calculator:
        "https://www.google.com/search?q=calculator",

      calendar:
        "https://calendar.google.com/",

      drive:
        "https://drive.google.com/",

      chatgpt:
        "https://chatgpt.com/"

    };

    for (
      const app in apps
    ) {

      if (
        t.includes(app)
      ) {

        openURL(apps[app]);

        return (
          "Opening " +
          app +
          "."
        );
      }
    }

    return (
      "Tell me which app you want to open."
    );
  }

  /* =========================================================
     14 — PLAY SONGS / YOUTUBE
     ========================================================= */

  function toolPlaySong(text) {

    let query =
      clean(text)
        .replace(
          /^please\s+/i,
          ""
        )
        .replace(
          /^play\s+/i,
          ""
        )
        .replace(
          /^song\s+/i,
          ""
        )
        .replace(
          /^music\s+/i,
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
     15 — CRYPTO
     ========================================================= */

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

      xrp: "ripple",
      ripple: "ripple",

      cardano: "cardano",
      ada: "cardano"

    };

    let coinID = "bitcoin";

    for (
      const key in coins
    ) {

      if (
        t.includes(key)
      ) {

        coinID =
          coins[key];

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
          "&include_24hr_change=true",
          {},
          20000
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
        typeof coin.inr === "number"
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
          coin.usd_24h_change.toFixed(2) +
          "%";
      }

      return result + ".";

    } catch (error) {

      return (
        "Live crypto data is temporarily unavailable."
      );
    }
  }
    /* =========================================================
     PART 2 / 2
     ========================================================= */

  /* =========================================================
     FEATURE COMMAND DETECTOR
     ========================================================= */

  async function handleTools(text) {

    const t =
      lower(text);

    /* 01 TIME */

    if (
      t === "time" ||
      t.includes("what time") ||
      t.includes("current time") ||
      t.includes("tell me the time") ||
      t.includes("టైమ్") ||
      t.includes("సమయం")
    ) {

      return toolTime();
    }


    /* 02 WEATHER */

    if (
      t.includes("weather") ||
      t.includes("temperature") ||
      t.includes("forecast") ||
      t.includes("వాతావరణం") ||
      t.includes("టెంపరేచర్")
    ) {

      return await toolWeather();
    }


    /* 03 TIMER */

    if (
      t.includes("timer") ||
      t.includes("set timer") ||
      t.includes("alarm") ||
      t.includes("టైమర్")
    ) {

      return toolTimer(text);
    }


    /* 04 DICE / COIN */

    if (
      t.includes("dice") ||
      t.includes("roll dice") ||
      t.includes("roll a dice") ||
      t.includes("coin") ||
      t.includes("flip coin") ||
      t.includes("toss coin") ||
      t.includes("డైస్") ||
      t.includes("కాయిన్")
    ) {

      return toolDiceCoin(text);
    }


    /* 05 JOKE */

    if (
      t === "joke" ||
      t.includes("tell me a joke") ||
      t.includes("tell joke") ||
      t.includes("joke please") ||
      t.includes("జోక్")
    ) {

      return await toolJoke();
    }


    /* 06 QUOTE */

    if (
      t === "quote" ||
      t.includes("give me a quote") ||
      t.includes("motivational quote") ||
      t.includes("motivation") ||
      t.includes("inspiration") ||
      t.includes("కోట్") ||
      t.includes("మోటివేషన్")
    ) {

      return await toolQuote();
    }


    /* 07 NEWS */

    if (
      t === "news" ||
      t.includes("latest news") ||
      t.includes("today news") ||
      t.includes("headlines") ||
      t.includes("latest headlines") ||
      t.includes("వార్తలు")
    ) {

      return await toolNews();
    }


    /* 08 TRANSLATE */

    if (
      t.startsWith("translate ") ||
      t.startsWith("translation ") ||
      t.includes("translate this") ||
      t.includes("translate to english") ||
      t.includes("translate to telugu") ||
      t.includes("అనువదించ") ||
      t.includes("ట్రాన్స్‌లేట్")
    ) {

      return await toolTranslate(text);
    }


    /* 09 CURRENCY */

    if (
      t.includes("currency") ||
      t.includes("exchange rate") ||
      t.includes("convert currency") ||
      /\d+(?:\.\d+)?\s*[a-z]{3}\s+(?:to|in|into)\s*[a-z]{3}/i.test(text)
    ) {

      return await toolCurrency(text);
    }


    /* 10 MEANING */

    if (
      t.includes("meaning of") ||
      t.includes("what does") ||
      t.startsWith("define ") ||
      t.includes("definition of") ||
      t.includes("dictionary") ||
      t.includes("అర్థం")
    ) {

      return await toolMeaning(text);
    }


    /* 11 PASSWORD */

    if (
      t.includes("password") ||
      t.includes("generate password") ||
      t.includes("strong password") ||
      t.includes("create password") ||
      t.includes("పాస్‌వర్డ్")
    ) {

      return toolPassword(text);
    }


    /* 12 SEARCH */

    if (
      t === "search" ||
      t.startsWith("search ") ||
      t.startsWith("search for ") ||
      t.startsWith("google ") ||
      t.startsWith("look up ") ||
      t.startsWith("వెతుకు ")
    ) {

      return toolSearch(text);
    }


    /* 13 OPEN APPS */

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
      t.includes("open calendar") ||
      t.includes("open drive") ||
      t.includes("open chatgpt")
    ) {

      return toolOpenApps(text);
    }


    /* 14 PLAY SONGS */

    if (
      t.startsWith("play ") ||
      t.includes("play song") ||
      t.includes("play music") ||
      t.includes("youtube") ||
      t.includes("పాట")
    ) {

      return toolPlaySong(text);
    }


    /* 15 CRYPTO */

    if (
      t.includes("crypto") ||
      t.includes("bitcoin") ||
      t.includes("btc") ||
      t.includes("ethereum") ||
      t.includes("eth") ||
      t.includes("dogecoin") ||
      t.includes("doge") ||
      t.includes("solana") ||
      t.includes("ripple") ||
      t.includes("xrp") ||
      t.includes("cardano") ||
      t.includes("ada") ||
      t.includes("క్రిప్టో")
    ) {

      return await toolCrypto(text);
    }


    return null;
  }


  /* =========================================================
     LOCAL CHAT FALLBACK
     ========================================================= */

  function localAI(text) {

    const t =
      lower(text);

    if (
      t === "hi" ||
      t === "hello" ||
      t === "hey" ||
      t.includes("good morning") ||
      t.includes("good evening") ||
      t.includes("good afternoon")
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
        "I am J.A.R.V.I.S., your personal AI assistant."
      );
    }


    if (
      t.includes("how are you")
    ) {

      return (
        "All systems are operational, Boss."
      );
    }


    if (
      t.includes("thank you") ||
      t === "thanks" ||
      t.includes("thank")
    ) {

      return (
        "You're welcome, Boss."
      );
    }


    if (
      t.includes("what can you do") ||
      t === "help" ||
      t.includes("help me")
    ) {

      return (
        "I can handle time, weather, timers, dice, coin tosses, jokes, quotes, news, translation, currency conversion, word meanings, password generation, web search, apps, songs, cryptocurrency, voice input, image analysis, memory and AI chat."
      );
    }


    return (
      "I received your command: " +
      text +
      "."
    );
  }


  /* =========================================================
     AI CHAT
     ========================================================= */

  async function askAI(text) {

    const memory =
      getMemory();

    const prompt =
      "You are J.A.R.V.I.S., a helpful personal AI assistant. " +
      "Answer the user's question clearly and naturally. " +
      "Do not pretend that you performed an action you did not perform. " +
      "Keep normal answers concise.\n\n" +
      "Previous J.A.R.V.I.S. response: " +
      (
        memory.lastResponse ||
        "None"
      ) +
      "\n\nUser: " +
      text;


    /*
      Online AI fallback.
      If it is unavailable, localAI() keeps
      the chat button functional.
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
                    content: prompt
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

          reader.onload =
            () => resolve(
              reader.result
            );

          reader.onerror =
            () => reject(
              new Error(
                "Unable to read the image."
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
            dataURL;
        }
      );


    let detectedText = "";

    /*
      OCR is attempted so the image button
      has useful functionality without
      requiring another HTML element.
    */

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
      "Image size: " +
      dimensions.width +
      " × " +
      dimensions.height +
      ".";


    if (detectedText) {

      result +=
        " Detected text: " +
        detectedText.substring(
          0,
          1500
        );

    } else {

      result +=
        " I could not detect readable text in this image.";
    }

    return result;
  }


  async function handleImage(file) {

    if (!file) return;

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

    if (!micBtn) return;

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

      micBtn.addEventListener(
        "click",
        function () {

          reply(
            "Voice input is not supported by this browser. Please use a browser with Speech Recognition support."
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
          event?.results?.[0]?.[0]
            ?.transcript || "";

        if (!transcript) {
          return;
        }

        msg.value =
          transcript;

        setTimeout(
          function () {
            runCommand();
          },
          100
        );
      };


    recognition.onerror =
      function (event) {

        console.warn(
          "Speech recognition error:",
          event.error
        );

        isListening = false;

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

        isListening = false;

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
      function (event) {

        event.preventDefault();

        try {

          if (isListening) {

            recognition.stop();

          } else {

            recognition.start();
          }

        } catch (error) {

          console.warn(
            "Voice start error:",
            error
          );
        }
      }
    );
  }


  /* =========================================================
     BUSY STATE
     ========================================================= */

  function setBusy(state) {

    isBusy = state;

    if (send) {

      send.disabled = state;

      send.textContent =
        state
          ? "WAIT..."
          : "EXECUTE";
    }
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

    /*
      FIRST SHOW COMMAND IN CHAT BOX.
    */

    userMessage(text);

    msg.value = "";

    setBusy(true);

    try {

      /*
        LOCAL TOOLS FIRST.
        This makes the 15 tools work without
        waiting for an AI response.
      */

      const toolResult =
        await handleTools(text);


      if (
        toolResult !== null &&
        toolResult !== undefined
      ) {

        reply(toolResult);

        return;
      }


      /*
        UNKNOWN COMMAND -> AI CHAT
      */

      const answer =
        await askAI(text);

      reply(answer);

    } catch (error) {

      console.error(
        "J.A.R.V.I.S. command error:",
        error
      );

      reply(
        "I encountered an error while processing that command. Please try again."
      );

    } finally {

      setBusy(false);

      try {
        msg.focus();
      } catch (error) {}
    }
  }


  /* =========================================================
     EXECUTE BUTTON
     ========================================================= */

  send.addEventListener(
    "click",
    function (event) {

      event.preventDefault();

      runCommand();
    }
  );


  /* =========================================================
     ENTER KEY
     ========================================================= */

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


  /* =========================================================
     CLEAR MEMORY
     ========================================================= */

  if (clearBtn) {

    clearBtn.addEventListener(
      "click",
      function (event) {

        event.preventDefault();

        clearMemory();
      }
    );
  }


  /* =========================================================
     CAMERA / IMAGE
     ========================================================= */

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

        /*
          Allows selecting the same image
          again after analysis.
        */

        this.value = "";
      }
    );
  }


  /* =========================================================
     FEATURE BOX CLICK SUPPORT
     =========================================================

     Your screenshot shows 15 feature cards.
     If the cards do not have IDs, this detects
     their visible text and makes them clickable.
     Existing HTML/CSS is not changed.
     ========================================================= */

  function setupFeatureCards() {

    const all =
      document.querySelectorAll(
        "body *"
      );

    all.forEach(
      function (element) {

        if (
          element.children.length > 0
        ) {
          return;
        }

        const text =
          clean(element.textContent);

        if (!text) return;

        const commandMap = [

          {
            words: ["Time"],
            command: "what is the time"
          },

          {
            words: ["Weather"],
            command: "weather"
          },

          {
            words: ["Timer"],
            command: "timer 10 seconds"
          },

          {
            words: ["Dice / Coin", "Dice", "Coin"],
            command: "roll dice"
          },

          {
            words: ["Joke"],
            command: "tell me a joke"
          },

          {
            words: ["Quote"],
            command: "give me a motivational quote"
          },

          {
            words: ["News"],
            command: "latest news"
          },

          {
            words: ["Translate"],
            command: "translate hello"
          },

          {
            words: ["Currency"],
            command: "100 USD to INR"
          },

          {
            words: ["Meaning"],
            command: "meaning of assistant"
          },

          {
            words: ["Password"],
            command: "generate password"
          },

          {
            words: ["Search"],
            command: "search Google"
          },

          {
            words: ["Open Apps"],
            command: "open Google"
          },

          {
            words: ["Play Songs"],
            command: "play music"
          },

          {
            words: ["Crypto"],
            command: "bitcoin price"
          }

        ];


        for (
          const item of commandMap
        ) {

          const matched =
            item.words.some(
              word =>
                text.toLowerCase() ===
                word.toLowerCase()
            );

          if (!matched) {
            continue;
          }


          element.style.cursor =
            "pointer";


          element.addEventListener(
            "click",
            function () {

              msg.value =
                item.command;

              runCommand();
            }
          );


          break;
        }
      }
    );
  }


  /* =========================================================
     STARTUP
     ========================================================= */

  setupVoice();

  setupFeatureCards();


  /* =========================================================
     GLOBAL ACCESS
     ========================================================= */

  window.jarvisRun =
    runCommand;

  window.jarvisSpeak =
    speak;

  window.jarvisClearMemory =
    clearMemory;

  window.jarvisAnalyzeImage =
    handleImage;

  window.jarvisTools =
    handleTools;


  /* =========================================================
     READY
     ========================================================= */

  console.log(
    "J.A.R.V.I.S. — ALL SYSTEMS READY"
  );

  /*
     Do not automatically open or speak anything
     when the page loads.
  */

  try {
    msg.focus();
  } catch (error) {}

})();
  
