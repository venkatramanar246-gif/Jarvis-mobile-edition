 "use strict";

(() => {

  /* =========================================================
     J.A.R.V.I.S. SCRIPT
     PART 1 / 2
     ========================================================= */

  const chat = document.getElementById("chat");
  const msg = document.getElementById("msg");
  const send = document.getElementById("send");
  const micBtn = document.getElementById("mic-btn");
  const camBtn = document.getElementById("cam-btn");
  const clearBtn = document.getElementById("clear-btn");
  const imgInput = document.getElementById("img-input");

  if (!chat || !msg || !send) {
    console.error("JARVIS: Required HTML elements are missing.");
    return;
  }

  let recognition = null;
  let listening = false;
  let busy = false;
  let timerNumber = 0;

  const MEMORY_KEY = "JARVIS_MEMORY";

  /* =========================================================
     HELPERS
     ========================================================= */

  const clean = value =>
    String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();

  const lower = value =>
    clean(value).toLowerCase();

  function showChat() {
    chat.style.display = "block";
  }

  function addMessage(title, text, type = "") {

    showChat();

    const box = document.createElement("div");

    box.className =
      "jarvis-message " + type;

    box.style.margin = "8px 0";
    box.style.padding = "9px 12px";
    box.style.borderRadius = "10px";
    box.style.whiteSpace = "pre-wrap";
    box.style.wordBreak = "break-word";

    const name = document.createElement("div");

    name.textContent = title;

    name.style.fontWeight = "bold";
    name.style.marginBottom = "4px";

    const content = document.createElement("div");

    content.textContent = clean(text);

    box.appendChild(name);
    box.appendChild(content);

    chat.appendChild(box);

    chat.scrollTop = chat.scrollHeight;

    return box;
  }

  function userMessage(text) {
    addMessage("YOU", text, "user-message");
  }

  function jarvisMessage(text) {
    addMessage("J.A.R.V.I.S.", text, "assistant-message");
  }

  function reply(text, speakIt = true) {

    const answer = clean(text);

    if (!answer) return;

    jarvisMessage(answer);

    saveMemory("lastResponse", answer);

    if (speakIt) {
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
    } catch {
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

    } catch (e) {
      console.warn("Memory error:", e);
    }
  }

  function clearMemory() {

    try {
      localStorage.removeItem(MEMORY_KEY);
    } catch {}

    chat.innerHTML = "";
    showChat();

    reply(
      "Memory cleared successfully, Boss."
    );
  }

  /* =========================================================
     SPEECH
     ========================================================= */

  function speak(text) {

    if (!("speechSynthesis" in window)) {
      return;
    }

    try {

      speechSynthesis.cancel();

      const u =
        new SpeechSynthesisUtterance(
          clean(text)
        );

      u.rate = 0.95;
      u.pitch = 1;
      u.volume = 1;

      const voices =
        speechSynthesis.getVoices();

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
        u.voice = voice;
      }

      speechSynthesis.speak(u);

    } catch (e) {
      console.warn("TTS error:", e);
    }
  }

  /* =========================================================
     SAFE FETCH
     ========================================================= */

  async function fetchJSON(
    url,
    options = {},
    timeout = 12000
  ) {

    const controller =
      new AbortController();

    const timer =
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
            signal: controller.signal
          }
        );

      if (!response.ok) {
        throw new Error(
          "HTTP " + response.status
        );
      }

      return await response.json();

    } finally {

      clearTimeout(timer);
    }
  }

  /* =========================================================
     01. TIME
     ========================================================= */

  function getTime() {

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
     02. WEATHER
     ========================================================= */

  function getLocation() {

    return new Promise(
      (resolve, reject) => {

        if (!navigator.geolocation) {

          reject(
            new Error(
              "Geolocation unavailable"
            )
          );

          return;
        }

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
  }

  function weatherText(code) {

    const map = {

      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",

      45: "Fog",
      48: "Fog",

      51: "Light drizzle",
      53: "Moderate drizzle",
      55: "Heavy drizzle",

      61: "Light rain",
      63: "Moderate rain",
      65: "Heavy rain",

      71: "Light snow",
      73: "Moderate snow",
      75: "Heavy snow",

      80: "Light rain showers",
      81: "Moderate rain showers",
      82: "Heavy rain showers",

      95: "Thunderstorm",
      96: "Thunderstorm with hail",
      99: "Thunderstorm with heavy hail"
    };

    return map[code] || "Unknown conditions";
  }

  async function getWeather() {

    try {

      const position =
        await getLocation();

      const lat =
        position.coords.latitude;

      const lon =
        position.coords.longitude;

      const url =
        "https://api.open-meteo.com/v1/forecast" +
        "?latitude=" + encodeURIComponent(lat) +
        "&longitude=" + encodeURIComponent(lon) +
        "&current=" +
        "temperature_2m," +
        "apparent_temperature," +
        "relative_humidity_2m," +
        "wind_speed_10m," +
        "weather_code" +
        "&timezone=auto";

      const data =
        await fetchJSON(url);

      const c =
        data.current;

      return (
        "Current weather: " +
        weatherText(c.weather_code) +
        ". Temperature is " +
        c.temperature_2m +
        "°C. Feels like " +
        c.apparent_temperature +
        "°C. Humidity is " +
        c.relative_humidity_2m +
        "%. Wind speed is " +
        c.wind_speed_10m +
        " km/h."
      );

    } catch (e) {

      return (
        "I could not get live weather. " +
        "Please allow location permission and try again."
      );
    }
  }

  /* =========================================================
     03. TIMER
     ========================================================= */

  function createTimer(text) {

    const match =
      clean(text).match(
        /(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i
      );

    if (!match) {

      return (
        "Please specify the timer duration, for example: " +
        "timer 10 seconds."
      );
    }

    const amount =
      Number(match[1]);

    const unit =
      match[2].toLowerCase();

    let milliseconds;

    if (/hour|hr/.test(unit)) {

      milliseconds =
        amount * 60 * 60 * 1000;

    } else if (/minute|min/.test(unit)) {

      milliseconds =
        amount * 60 * 1000;

    } else {

      milliseconds =
        amount * 1000;
    }

    const id =
      ++timerNumber;

    setTimeout(
      () => {

        const text =
          "Timer " +
          id +
          " is complete, Boss.";

        jarvisMessage(text);
        speak(text);

      },
      milliseconds
    );

    return (
      "Timer " +
      id +
      " set for " +
      amount +
      " " +
      unit +
      "."
    );
  }

  /* =========================================================
     04. DICE / COIN
     ========================================================= */

  function diceCoin(text) {

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
      "Dice result: " +
      result +
      " out of " +
      sides +
      "."
    );
  }

  /* =========================================================
     05. JOKE
     ========================================================= */

  async function getJoke() {

    try {

      const data =
        await fetchJSON(
          "https://v2.jokeapi.dev/joke/Any?safe-mode",
          {},
          10000
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

    } catch {}

    return (
      "Why did the computer get cold? " +
      "Because it left its Windows open."
    );
  }

  /* =========================================================
     06. QUOTE
     ========================================================= */

  async function getQuote() {

    try {

      const data =
        await fetchJSON(
          "https://dummyjson.com/quotes/random",
          {},
          10000
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

    } catch {}

    return (
      "Success is built from small steps taken consistently."
    );
  }

  /* =========================================================
     07. NEWS
     ========================================================= */

  async function getNews() {

    try {

      const rss =
        "https://news.google.com/rss" +
        "?hl=en-IN&gl=IN&ceid=IN:en";

      const url =
        "https://api.rss2json.com/v1/api.json" +
        "?rss_url=" +
        encodeURIComponent(rss);

      const data =
        await fetchJSON(
          url,
          {},
          15000
        );

      const items =
        Array.isArray(data.items)
          ? data.items.slice(0, 5)
          : [];

      if (!items.length) {
        throw new Error("No news");
      }

      const headlines =
        items
          .map(
            (item, i) =>
              (i + 1) +
              ". " +
              clean(item.title)
          )
          .join("\n");

      return (
        "Latest headlines:\n" +
        headlines
      );

    } catch {

      return (
        "Live news is temporarily unavailable. " +
        "Please try again."
      );
    }
  }

  /* =========================================================
     08. TRANSLATE
     ========================================================= */

  async function translateText(text) {

    let query =
      clean(text)
        .replace(
          /^translate\s*/i,
          ""
        )
        .replace(
          /^translation\s*/i,
          ""
        )
        .trim();

    let target = "te";

    if (
      /\bto\s+english\b/i.test(query)
    ) {

      target = "en";

      query =
        query
          .replace(
            /\bto\s+english\b/i,
            ""
          )
          .trim();
    }

    if (
      /\bto\s+telugu\b/i.test(query)
    ) {

      target = "te";

      query =
        query
          .replace(
            /\bto\s+telugu\b/i,
            ""
          )
          .trim();
    }

    if (!query) {

      return (
        "Tell me what you want to translate."
      );
    }

    try {

      const url =
        "https://api.mymemory.translated.net/get" +
        "?q=" +
        encodeURIComponent(query) +
        "&langpair=auto|" +
        target;

      const data =
        await fetchJSON(
          url,
          {},
          15000
        );

      const result =
        data?.responseData?.translatedText;

      if (result) {

        return (
          "Translation: " +
          result
        );
      }

    } catch {}

    return (
      "Translation service is temporarily unavailable."
    );
  }

  /* =========================================================
     09. CURRENCY
     ========================================================= */

  async function currency(text) {

    const match =
      clean(text).match(
        /(\d+(?:\.\d+)?)\s*([A-Za-z]{3})\s*(?:to|into|in)\s*([A-Za-z]{3})/i
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
        await fetchJSON(
          "https://open.er-api.com/v6/latest/" +
          encodeURIComponent(from),
          {},
          12000
        );

      const rate =
        data?.rates?.[to];

      if (
        typeof rate !== "number"
      ) {
        throw new Error("No rate");
      }

      const result =
        amount * rate;

      return (
        amount +
        " " +
        from +
        " = " +
        result.toFixed(2) +
        " " +
        to +
        " at the current available exchange rate."
      );

    } catch {

      return (
        "I could not retrieve the live exchange rate right now."
      );
    }
  }

  /* =========================================================
     10. MEANING
     ========================================================= */

  async function meaning(text) {

    let word =
      clean(text)
        .replace(
          /^what\s+is\s+the\s+meaning\s+of\s*/i,
          ""
        )
        .replace(
          /^meaning\s+of\s*/i,
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
        "Tell me the word you want the meaning of."
      );
    }

    try {

      const data =
        await fetchJSON(
          "https://api.dictionaryapi.dev/api/v2/entries/en/" +
          encodeURIComponent(word),
          {},
          10000
        );

      const m =
        data?.[0]?.meanings?.[0];

      const definition =
        m?.definitions?.[0]?.definition;

      const example =
        m?.definitions?.[0]?.example;

      const part =
        m?.partOfSpeech;

      if (definition) {

        return (
          word +
          (part ? " (" + part + ")" : "") +
          " means: " +
          definition +
          (
            example
              ? " Example: " + example
              : ""
          )
        );
      }

    } catch {}

    return (
      "I could not find a dictionary definition for " +
      word +
      "."
    );
  }
    /* =========================================================
     11. PASSWORD
     ========================================================= */

  function generatePassword(text) {

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

    const upper =
      "ABCDEFGHJKLMNPQRSTUVWXYZ";

    const lowerChars =
      "abcdefghijkmnopqrstuvwxyz";

    const numbers =
      "23456789";

    const symbols =
      "!@#$%^&*_-+=";

    const all =
      upper +
      lowerChars +
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
          all[
            values[i] % all.length
          ];
      }

    } else {

      for (
        let i = 0;
        i < length;
        i++
      ) {

        password +=
          all[
            Math.floor(
              Math.random() * all.length
            )
          ];
      }
    }

    return (
      "Generated secure password: " +
      password
    );
  }

  /* =========================================================
     12. SEARCH
     ========================================================= */

  function webSearch(text) {

    let query =
      clean(text)
        .replace(
          /^search\s+for\s+/i,
          ""
        )
        .replace(
          /^search\s+/i,
          ""
        )
        .replace(
          /^google\s+/i,
          ""
        )
        .replace(
          /^look\s+up\s+/i,
          ""
        )
        .trim();

    if (!query) {

      return (
        "Tell me what you want to search for."
      );
    }

    const url =
      "https://www.google.com/search?q=" +
      encodeURIComponent(query);

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );

    return (
      "Searching Google for: " +
      query
    );
  }

  /* =========================================================
     13. OPEN APPS
     ========================================================= */

  function openApp(text) {

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
      const name in apps
    ) {

      if (
        t.includes(name)
      ) {

        window.open(
          apps[name],
          "_blank",
          "noopener,noreferrer"
        );

        return (
          "Opening " +
          name +
          ", Boss."
        );
      }
    }

    return (
      "Tell me which app you want to open."
    );
  }

  /* =========================================================
     14. PLAY SONGS
     ========================================================= */

  function playSong(text) {

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

      window.open(
        "https://www.youtube.com/",
        "_blank",
        "noopener,noreferrer"
      );

      return (
        "Opening YouTube."
      );
    }

    window.open(
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(query),
      "_blank",
      "noopener,noreferrer"
    );

    return (
      "Searching YouTube for: " +
      query
    );
  }

  /* =========================================================
     15. CRYPTO
     ========================================================= */

  async function cryptoPrice(text) {

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

    let coin = "bitcoin";

    for (
      const key in coins
    ) {

      if (
        t.includes(key)
      ) {

        coin =
          coins[key];

        break;
      }
    }

    try {

      const data =
        await fetchJSON(
          "https://api.coingecko.com/api/v3/simple/price" +
          "?ids=" +
          encodeURIComponent(coin) +
          "&vs_currencies=usd,inr" +
          "&include_24hr_change=true",
          {},
          15000
        );

      const item =
        data?.[coin];

      if (!item) {
        throw new Error("No data");
      }

      let answer =
        coin.toUpperCase() +
        " current price: $" +
        Number(
          item.usd
        ).toLocaleString();

      if (
        typeof item.inr === "number"
      ) {

        answer +=
          " | ₹" +
          Number(
            item.inr
          ).toLocaleString();
      }

      if (
        typeof item.usd_24h_change ===
        "number"
      ) {

        answer +=
          " | 24h change: " +
          item.usd_24h_change.toFixed(2) +
          "%";
      }

      return answer + ".";

    } catch {

      return (
        "Live cryptocurrency data is temporarily unavailable."
      );
    }
  }

  /* =========================================================
     EXACT TOOL ROUTER
     ========================================================= */

  async function runTool(text) {

    const t =
      lower(text);

    /* TIME */

    if (
      t === "time" ||
      t.includes("what time") ||
      t.includes("current time") ||
      t.includes("tell me the time") ||
      t.includes("సమయం") ||
      t.includes("టైమ్")
    ) {
      return getTime();
    }


    /* WEATHER */

    if (
      t.includes("weather") ||
      t.includes("temperature") ||
      t.includes("forecast") ||
      t.includes("వాతావరణం") ||
      t.includes("వెదర్")
    ) {
      return await getWeather();
    }


    /* TIMER */

    if (
      t.includes("timer") ||
      t.includes("set timer") ||
      t.includes("టైమర్")
    ) {
      return createTimer(text);
    }


    /* DICE / COIN */

    if (
      t.includes("dice") ||
      t.includes("roll") ||
      t.includes("coin") ||
      t.includes("flip coin") ||
      t.includes("toss coin") ||
      t.includes("డైస్") ||
      t.includes("కాయిన్")
    ) {
      return diceCoin(text);
    }


    /* JOKE */

    if (
      t === "joke" ||
      t.includes("tell me a joke") ||
      t.includes("tell joke") ||
      t.includes("joke please") ||
      t.includes("జోక్")
    ) {
      return await getJoke();
    }


    /* QUOTE */

    if (
      t === "quote" ||
      t.includes("give me a quote") ||
      t.includes("motivational quote") ||
      t.includes("motivation") ||
      t.includes("inspiration") ||
      t.includes("కోట్")
    ) {
      return await getQuote();
    }


    /* NEWS */

    if (
      t === "news" ||
      t.includes("latest news") ||
      t.includes("today news") ||
      t.includes("latest headlines") ||
      t.includes("headlines") ||
      t.includes("వార్తలు")
    ) {
      return await getNews();
    }


    /* TRANSLATE */

    if (
      t.startsWith("translate ") ||
      t.startsWith("translation ") ||
      t.includes("translate this") ||
      t.includes("translate to english") ||
      t.includes("translate to telugu") ||
      t.includes("అనువదించ")
    ) {
      return await translateText(text);
    }


    /* CURRENCY */

    if (
      t.includes("currency") ||
      t.includes("exchange rate") ||
      t.includes("convert currency") ||
      /\d+(?:\.\d+)?\s*[a-z]{3}\s+(?:to|into|in)\s*[a-z]{3}/i.test(text)
    ) {
      return await currency(text);
    }


    /* MEANING */

    if (
      t.includes("meaning of") ||
      t.includes("what is the meaning") ||
      t.includes("define ") ||
      t.includes("definition of") ||
      t.includes("dictionary") ||
      t.includes("అర్థం")
    ) {
      return await meaning(text);
    }


    /* PASSWORD */

    if (
      t.includes("password") ||
      t.includes("generate password") ||
      t.includes("strong password") ||
      t.includes("create password") ||
      t.includes("పాస్‌వర్డ్")
    ) {
      return generatePassword(text);
    }


    /* SEARCH */

    if (
      t === "search" ||
      t.startsWith("search ") ||
      t.startsWith("google ") ||
      t.startsWith("look up ") ||
      t.startsWith("వెతుకు ")
    ) {
      return webSearch(text);
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
      t.includes("open calendar") ||
      t.includes("open drive") ||
      t.includes("open chatgpt")
    ) {
      return openApp(text);
    }


    /* PLAY SONG */

    if (
      t.startsWith("play ") ||
      t.includes("play song") ||
      t.includes("play music") ||
      t.includes("youtube") ||
      t.includes("పాట")
    ) {
      return playSong(text);
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
      t.includes("ripple") ||
      t.includes("xrp") ||
      t.includes("cardano") ||
      t.includes("ada") ||
      t.includes("క్రిప్టో")
    ) {
      return await cryptoPrice(text);
    }


    return null;
  }

  /* =========================================================
     AI FALLBACK
     ========================================================= */

  async function aiFallback(text) {

    const memory =
      getMemory();

    const prompt =
      "You are J.A.R.V.I.S., a personal AI assistant. " +
      "Give a direct, accurate and concise answer. " +
      "Do not claim to have performed actions that you did not perform. " +
      "User question: " +
      text +
      "\nPrevious response: " +
      (memory.lastResponse || "None");

    try {

      const response =
        await fetch(
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
          }
        );

      if (!response.ok) {
        throw new Error("AI unavailable");
      }

      const type =
        response.headers.get(
          "content-type"
        ) || "";

      if (
        type.includes("application/json")
      ) {

        const data =
          await response.json();

        const answer =
          data?.choices?.[0]
            ?.message?.content ||
          data?.response ||
          data?.text;

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

    } catch (e) {

      console.warn(
        "AI fallback unavailable:",
        e
      );
    }

    return (
      "I can handle your J.A.R.V.I.S. tools. " +
      "For a general question, please try again."
    );
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
        "Please select an image file."
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
                "Could not read image."
              )
            );

          reader.readAsDataURL(file);
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
        await fetch(
          "https://api.ocr.space/parse/image",
          {
            method: "POST",
            body: form
          }
        );

      if (response.ok) {

        const data =
          await response.json();

        detectedText =
          clean(
            (data.ParsedResults || [])
              .map(
                x =>
                  x.ParsedText || ""
              )
              .join(" ")
          );
      }

    } catch (e) {

      console.warn(
        "OCR unavailable:",
        e
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
        "\nDetected text: " +
        detectedText.substring(
          0,
          2000
        );

    } else {

      result +=
        "\nNo readable text was detected.";
    }

    return result;
  }

  /* =========================================================
     IMAGE BUTTON
     ========================================================= */

  if (camBtn && imgInput) {

    camBtn.addEventListener(
      "click",
      event => {

        event.preventDefault();

        imgInput.click();
      }
    );
  }

  if (imgInput) {

    imgInput.addEventListener(
      "change",
      async () => {

        const file =
          imgInput.files?.[0];

        if (!file) return;

        userMessage(
          "Analyze image: " +
          file.name
        );

        try {

          const result =
            await analyzeImage(file);

          reply(result);

        } catch (e) {

          reply(
            e.message ||
            "Image analysis failed."
          );
        }

        imgInput.value = "";
      }
    );
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
        () => {

          reply(
            "Voice input is not supported in this browser."
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
      () => {

        listening = true;

        micBtn.classList.add(
          "listening"
        );

        micBtn.setAttribute(
          "aria-label",
          "Stop voice input"
        );
      };

    recognition.onresult =
      event => {

        const transcript =
          event.results?.[0]?.[0]
            ?.transcript;

        if (!transcript) return;

        msg.value =
          clean(transcript);

        setTimeout(
          runCommand,
          50
        );
      };

    recognition.onerror =
      event => {

        listening = false;

        micBtn.classList.remove(
          "listening"
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
      () => {

        listening = false;

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
      event => {

        event.preventDefault();

        try {

          if (listening) {
            recognition.stop();
          } else {
            recognition.start();
          }

        } catch (e) {
          console.warn(
            "Recognition error:",
            e
          );
        }
      }
    );
  }

  /* =========================================================
     MAIN EXECUTION
     ========================================================= */

  async function runCommand() {

    if (busy) return;

    const text =
      clean(msg.value);

    if (!text) return;

    userMessage(text);

    msg.value = "";

    busy = true;

    send.disabled = true;
    send.textContent = "WAIT...";

    try {

      /*
       * IMPORTANT:
       * Screenshot features are handled FIRST.
       * Therefore they do not get random AI answers.
       */

      const toolAnswer =
        await runTool(text);

      if (
        toolAnswer !== null &&
        toolAnswer !== undefined
      ) {

        reply(toolAnswer);

        return;
      }

      /*
       * Only unknown/general questions reach AI.
       */

      const answer =
        await aiFallback(text);

      reply(answer);

    } catch (error) {

      console.error(
        "JARVIS error:",
        error
      );

      reply(
        "Sorry Boss, I could not complete that command."
      );

    } finally {

      busy = false;

      send.disabled = false;
      send.textContent = "EXECUTE";

      try {
        msg.focus();
      } catch {}
    }
  }

  /* =========================================================
     EXECUTE BUTTON
     ========================================================= */

  send.addEventListener(
    "click",
    event => {

      event.preventDefault();

      runCommand();
    }
  );

  /* =========================================================
     ENTER KEY
     ========================================================= */

  msg.addEventListener(
    "keydown",
    event => {

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
      event => {

        event.preventDefault();

        clearMemory();
      }
    );
  }

  /* =========================================================
     FEATURE CARDS
     ========================================================= */

  function setupFeatureCards() {

    const commands = {

      "time":
        "what is the time",

      "weather":
        "weather",

      "timer":
        "timer 10 seconds",

      "dice / coin":
        "roll dice",

      "dice":
        "roll dice",

      "coin":
        "flip coin",

      "joke":
        "tell me a joke",

      "quote":
        "give me a quote",

      "news":
        "latest news",

      "translate":
        "translate hello",

      "currency":
        "100 USD to INR",

      "meaning":
        "meaning of assistant",

      "password":
        "generate password",

      "search":
        "search Google",

      "open apps":
        "open Google",

      "play songs":
        "play music",

      "crypto":
        "bitcoin price"
    };

    const elements =
      document.querySelectorAll(
        "body *"
      );

    elements.forEach(
      element => {

        if (
          element.children.length > 0
        ) {
          return;
        }

        const label =
          lower(
            element.textContent
          );

        if (!commands[label]) {
          return;
        }

        element.style.cursor =
          "pointer";

        element.addEventListener(
          "click",
          event => {

            /*
             * Do not interfere with normal
             * buttons/input controls.
             */

            if (
              event.target.closest(
                "button,input"
              )
            ) {
              return;
            }

            msg.value =
              commands[label];

            runCommand();
          }
        );
      }
    );
  }

  /* =========================================================
     STARTUP
     ========================================================= */

  setupVoice();

  setupFeatureCards();

  window.jarvisRun =
    runCommand;

  window.jarvisSpeak =
    speak;

  window.jarvisClearMemory =
    clearMemory;

  window.jarvisAnalyzeImage =
    analyzeImage;

  window.jarvisTool =
    runTool;

  console.log(
    "J.A.R.V.I.S. ONLINE — ALL 15 TOOLS READY"
  );

  try {
    msg.focus();
  } catch {}

})();
