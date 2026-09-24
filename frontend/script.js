 /* =========================================================
   J.A.R.V.I.S. - PERSONAL AI ASSISTANT
   script.js - PART 1/2
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     1. EXACT HTML ELEMENTS
     ========================================================= */

  const $ = (id) => document.getElementById(id);

  const chat = $("chat");
  const msg = $("msg");
  const send = $("send");
  const micBtn = $("mic-btn");
  const camBtn = $("cam-btn");
  const clearBtn = $("clear-btn");
  const imgInput = $("img-input");

  /* =========================================================
     2. MEMORY
     ========================================================= */

  const MEMORY_KEY = "JARVIS_MEMORY_V1";

  let memory = [];

  try {
    const saved = localStorage.getItem(MEMORY_KEY);
    memory = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(memory)) memory = [];
  } catch {
    memory = [];
  }

  function saveMemory() {
    try {
      localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
    } catch {
      /* Storage may be blocked */
    }
  }

  function remember(type, text) {
    memory.push({
      type,
      text,
      time: new Date().toISOString()
    });

    if (memory.length > 100) {
      memory = memory.slice(-100);
    }

    saveMemory();
  }

  function clearMemory() {
    memory = [];

    try {
      localStorage.removeItem(MEMORY_KEY);
    } catch {}

    addMessage(
      "Memory cleared successfully, Boss.",
      "jarvis"
    );
  }

  /* =========================================================
     3. CHAT UI
     ========================================================= */

  function addMessage(text, sender = "jarvis") {
    if (!chat) return;

    const item = document.createElement("div");

    item.className =
      sender === "user"
        ? "message user-message"
        : "message jarvis-message";

    item.textContent = String(text);

    chat.appendChild(item);
    chat.scrollTop = chat.scrollHeight;
  }

  function addImageMessage(src, name = "Image") {
    if (!chat) return;

    const wrapper = document.createElement("div");
    wrapper.className = "message jarvis-message";

    const title = document.createElement("div");
    title.textContent = "IMAGE PREVIEW: " + name;
    title.style.marginBottom = "8px";

    const image = document.createElement("img");

    image.src = src;
    image.alt = name;

    image.style.maxWidth = "100%";
    image.style.maxHeight = "320px";
    image.style.borderRadius = "10px";
    image.style.display = "block";
    image.style.objectFit = "contain";

    wrapper.appendChild(title);
    wrapper.appendChild(image);

    chat.appendChild(wrapper);
    chat.scrollTop = chat.scrollHeight;
  }

  function setInput(value) {
    if (msg) {
      msg.value = value;
      msg.focus();
    }
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;

    try {
      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(String(text));

      utterance.lang = "en-IN";
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      window.speechSynthesis.speak(utterance);
    } catch {}
  }

  function reply(text, voice = false) {
    addMessage(text, "jarvis");
    remember("assistant", text);

    if (voice) {
      speak(text);
    }

    return text;
  }

  /* =========================================================
     4. TEXT NORMALIZATION
     ========================================================= */

  function normalizeText(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[!?.,;:()[\]{}"'`]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanCommand(text) {
    return normalizeText(text)
      .replace(
        /^(hey|hi|hello|jarvis|jervis|jarvies|jarviss|boss)\s+/i,
        ""
      )
      .trim();
  }

  /* =========================================================
     5. SMART SPELLING / VOICE MISTAKE CORRECTION
     ========================================================= */

  function levenshtein(a, b) {
    a = String(a);
    b = String(b);

    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  const commandAliases = {
    time: [
      "time",
      "tim",
      "tym",
      "what time",
      "current time",
      "samayam",
      "సమయం"
    ],

    weather: [
      "weather",
      "wether",
      "wheather",
      "whether",
      "climate",
      "temperature",
      "vaathavaranam",
      "వాతావరణం"
    ],

    timer: [
      "timer",
      "timr",
      "tmier",
      "alarm",
      "countdown",
      "టైమర్"
    ],

    dice: [
      "dice",
      "die",
      "roll dice",
      "rol dice",
      "dise"
    ],

    coin: [
      "coin",
      "coin toss",
      "coin flip",
      "toss coin",
      "heads tails",
      "con toss"
    ],

    joke: [
      "joke",
      "jok",
      "jokes",
      "make me laugh",
      "funny"
    ],

    quote: [
      "quote",
      "quate",
      "quotation",
      "motivation",
      "motivational quote"
    ],

    news: [
      "news",
      "newz",
      "new",
      "latest news",
      "headlines"
    ],

    translate: [
      "translate",
      "translat",
      "tranlate",
      "translation",
      "telugu translation"
    ],

    currency: [
      "currency",
      "convert currency",
      "exchange rate",
      "forex",
      "money conversion"
    ],

    dictionary: [
      "dictionary",
      "dictonary",
      "meaning",
      "define",
      "definition",
      "word meaning"
    ],

    password: [
      "password",
      "pass word",
      "generate password",
      "password generator",
      "secure password"
    ],

    search: [
      "search",
      "serch",
      "google",
      "find",
      "look up",
      "lookup"
    ],

    youtube: [
      "youtube",
      "you tube",
      "youtub",
      "play song",
      "play music",
      "play video",
      "song"
    ],

    crypto: [
      "crypto",
      "cryptocurrency",
      "bitcoin",
      "btc",
      "ethereum",
      "eth",
      "crypto price"
    ],

    camera: [
      "camera",
      "camra",
      "take photo",
      "take picture",
      "capture photo",
      "open camera"
    ],

    clear: [
      "clear memory",
      "clear mem",
      "delete memory",
      "erase memory",
      "forget memory",
      "reset memory"
    ]
  };

  function detectCorrectedCommand(text) {
    const normalized = normalizeText(text);

    /* Exact / contains match first */
    for (const [command, aliases] of Object.entries(commandAliases)) {
      for (const alias of aliases) {
        const a = normalizeText(alias);

        if (
          normalized === a ||
          normalized.includes(a)
        ) {
          return command;
        }
      }
    }

    /* Word-level fuzzy correction */
    const words = normalized.split(/\s+/);

    let bestCommand = null;
    let bestScore = Infinity;

    for (const word of words) {
      if (!word || word.length < 3) continue;

      for (const [command, aliases] of Object.entries(
        commandAliases
      )) {
        for (const alias of aliases) {
          const cleanAlias = normalizeText(alias);

          if (cleanAlias.includes(" ")) continue;

          const distance = levenshtein(word, cleanAlias);

          const maxDistance =
            cleanAlias.length >= 7 ? 2 : 1;

          if (
            distance <= maxDistance &&
            distance < bestScore
          ) {
            bestScore = distance;
            bestCommand = command;
          }
        }
      }
    }

    return bestCommand;
  }

  function hasCommand(text, command) {
    const t = normalizeText(text);

    const aliases =
      commandAliases[command] || [command];

    return aliases.some((alias) =>
      t.includes(normalizeText(alias))
    );
  }

  /* =========================================================
     6. TIME
     ========================================================= */

  function getTime() {
    const now = new Date();

    return (
      "The current time is " +
      now.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit"
      }) +
      ", Boss."
    );
  }

  /* =========================================================
     7. WEATHER
     ========================================================= */

  async function getWeather() {
    if (!navigator.geolocation) {
      return "Geolocation is not supported by this browser, Boss.";
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
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
              "&current=temperature_2m,relative_humidity_2m," +
              "apparent_temperature,weather_code,wind_speed_10m";

            const response =
              await fetch(url);

            if (!response.ok) {
              throw new Error("Weather request failed");
            }

            const data =
              await response.json();

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

            resolve(
              "Current weather: " +
              temperature +
              "°C, feels like " +
              feels +
              "°C, humidity " +
              humidity +
              "%, wind " +
              wind +
              " km/h, Boss."
            );
          } catch {
            resolve(
              "I could not retrieve the weather right now, Boss."
            );
          }
        },

        () => {
          resolve(
            "I need location permission to check the weather, Boss."
          );
        },

        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  }

  /* =========================================================
     8. TIMER
     ========================================================= */

  function parseTimer(text) {
    const t = normalizeText(text);

    const match = t.match(
      /(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/i
    );

    if (!match) return null;

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    let multiplier = 1000;

    if (
      unit.startsWith("minute") ||
      unit === "min" ||
      unit === "mins" ||
      unit === "m"
    ) {
      multiplier = 60000;
    }

    if (
      unit.startsWith("hour") ||
      unit === "hr" ||
      unit === "hrs" ||
      unit === "h"
    ) {
      multiplier = 3600000;
    }

    return {
      amount,
      unit,
      duration: amount * multiplier
    };
  }

  function startTimer(text) {
    const parsed = parseTimer(text);

    if (!parsed) {
      return "Please specify a timer duration, for example: timer 10 seconds.";
    }

    const { amount, unit, duration } = parsed;

    window.setTimeout(() => {
      const message =
        "Timer complete, Boss. " +
        amount +
        " " +
        unit +
        " finished.";

      addMessage(message, "jarvis");
      speak(message);
    }, duration);

    return (
      "Timer set for " +
      amount +
      " " +
      unit +
      ", Boss."
    );
  }

  /* =========================================================
     9. DICE
     ========================================================= */

  function rollDice(text) {
    const match =
      normalizeText(text).match(
        /(?:dice|die|roll)\s*(\d+)?/i
      );

    const sides =
      match && match[1]
        ? Math.max(2, Number(match[1]))
        : 6;

    const result =
      Math.floor(Math.random() * sides) + 1;

    return (
      "Dice rolled: " +
      result +
      " out of " +
      sides +
      ", Boss."
    );
  }

  /* =========================================================
     10. COIN TOSS
     ========================================================= */

  function tossCoin() {
    const result =
      Math.random() < 0.5
        ? "Heads"
        : "Tails";

    return "Coin toss result: " + result + ", Boss.";
  }

  /* =========================================================
     11. JOKE
     ========================================================= */

  async function getJoke() {
    try {
      const response = await fetch(
        "https://v2.jokeapi.dev/joke/Any?type=single"
      );

      if (!response.ok) {
        throw new Error("Joke failed");
      }

      const data = await response.json();

      if (data.joke) {
        return data.joke;
      }

      throw new Error("No joke");
    } catch {
      const fallback = [
        "Why do programmers prefer dark mode? Because light attracts bugs.",
        "I told my computer I needed a break. Now it keeps sending me vacation ads.",
        "Why was the JavaScript developer calm? Because they knew how to handle their callbacks."
      ];

      return fallback[
        Math.floor(Math.random() * fallback.length)
      ];
    }
  }

  /* =========================================================
     12. QUOTE
     ========================================================= */

  async function getQuote() {
    try {
      const response = await fetch(
        "https://api.quotable.io/random"
      );

      if (!response.ok) {
        throw new Error("Quote failed");
      }

      const data = await response.json();

      if (data.content) {
        return (
          '"' +
          data.content +
          '"' +
          (data.author
            ? " — " + data.author
            : "")
        );
      }

      throw new Error("No quote");
    } catch {
      return (
        '"Success is the sum of small efforts, repeated consistently."'
      );
    }
  }

  /* =========================================================
     13. NEWS
     ========================================================= */

  function newsSearch(text) {
    let query = normalizeText(text)
      .replace(/\b(latest|news|newz|headlines)\b/gi, "")
      .trim();

    if (!query) {
      query = "latest news";
    }

    const url =
      "https://news.google.com/search?q=" +
      encodeURIComponent(query);

    window.open(url, "_blank", "noopener,noreferrer");

    return (
      "Opening the latest news for " +
      query +
      ", Boss."
    );
  }

  /* =========================================================
     14. TRANSLATION
     ========================================================= */

  async function translateText(text) {
    let query = String(text)
      .replace(
        /^(translate|translation|translat)\s*/i,
        ""
      )
      .trim();

    query = query
      .replace(/^this\s*/i, "")
      .trim();

    if (!query) {
      return "Tell me what you want me to translate, Boss.";
    }

    try {
      const url =
        "https://api.mymemory.translated.net/get?q=" +
        encodeURIComponent(query) +
        "&langpair=en|te";

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Translation failed");
      }

      const data = await response.json();

      const result =
        data &&
        data.responseData &&
        data.responseData.translatedText;

      if (!result) {
        throw new Error("No translation");
      }

      return "In Telugu: " + result;
    } catch {
      return (
        "Translation service is unavailable right now, Boss."
      );
    }
  }

  /* =========================================================
     15. CURRENCY
     ========================================================= */

  async function currencyConvert(text) {
    const t = normalizeText(text);

    const match = t.match(
      /(\d+(?:\.\d+)?)\s*([a-z]{3})\s*(?:to|in)\s*([a-z]{3})/i
    );

    if (!match) {
      return (
        "Use currency like: 100 USD to INR, Boss."
      );
    }

    const amount = Number(match[1]);
    const from = match[2].toUpperCase();
    const to = match[3].toUpperCase();

    try {
      const url =
        "https://api.frankfurter.app/latest?amount=" +
        encodeURIComponent(amount) +
        "&from=" +
        encodeURIComponent(from) +
        "&to=" +
        encodeURIComponent(to);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Currency failed");
      }

      const data = await response.json();

      if (
        !data.rates ||
        typeof data.rates[to] !== "number"
      ) {
        throw new Error("Currency unavailable");
      }

      return (
        amount +
        " " +
        from +
        " = " +
        data.rates[to] +
        " " +
        to +
        ", Boss."
      );
    } catch {
      return (
        "I could not retrieve that currency conversion right now, Boss."
      );
    }
  }

  /* =========================================================
     16. DICTIONARY
     ========================================================= */

  async function dictionary(text) {
    let word = normalizeText(text)
      .replace(
        /^(dictionary|define|meaning|definition|word meaning)\s*/i,
        ""
      )
      .trim();

    if (!word) {
      return "Tell me the word you want defined, Boss.";
    }

    word = word.split(/\s+/)[0];

    try {
      const response = await fetch(
        "https://api.dictionaryapi.dev/api/v2/entries/en/" +
        encodeURIComponent(word)
      );

      if (!response.ok) {
        throw new Error("Dictionary failed");
      }

      const data = await response.json();

      const entry = data[0];

      const meaning =
        entry &&
        entry.meanings &&
        entry.meanings[0];

      const definition =
        meaning &&
        meaning.definitions &&
        meaning.definitions[0] &&
        meaning.definitions[0].definition;

      if (!definition) {
        throw new Error("No definition");
      }

      return (
        word +
        ": " +
        definition
      );
    } catch {
      return (
        "I could not find a definition for " +
        word +
        ", Boss."
      );
    }
  }

  /* =========================================================
     17. PASSWORD GENERATOR
     ========================================================= */

  function generatePassword(text) {
    const match =
      normalizeText(text).match(
        /(?:password|pass word).{0,20}?(\d{1,3})/
      );

    let length =
      match && match[1]
        ? Number(match[1])
        : 16;

    length = Math.min(
      Math.max(length, 8),
      64
    );

    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
      "abcdefghijklmnopqrstuvwxyz" +
      "0123456789!@#$%^&*()_+-=[]{}";

    let password = "";

    if (
      window.crypto &&
      window.crypto.getRandomValues
    ) {
      const values =
        new Uint32Array(length);

      window.crypto.getRandomValues(values);

      for (let i = 0; i < length; i++) {
        password +=
          chars[values[i] % chars.length];
      }
    } else {
      for (let i = 0; i < length; i++) {
        password +=
          chars[
            Math.floor(
              Math.random() * chars.length
            )
          ];
      }
    }

    return (
      "Generated password (" +
      length +
      " characters): " +
      password
    );
  }
   /* =========================================================
     18. GOOGLE SEARCH
     ========================================================= */

  function webSearch(text) {
    let query = normalizeText(text)
      .replace(
        /^(search|serch|google|find|look up|lookup)\s*/i,
        ""
      )
      .trim();

    if (!query) {
      return "What should I search for, Boss?";
    }

    const url =
      "https://www.google.com/search?q=" +
      encodeURIComponent(query);

    window.open(url, "_blank", "noopener,noreferrer");

    return (
      "Searching Google for " +
      query +
      ", Boss."
    );
  }

  /* =========================================================
     19. YOUTUBE SEARCH / PLAY SONG
     ========================================================= */

  function youtubePlay(text) {
    let query = normalizeText(text)
      .replace(
        /^(play|youtube|you tube|song|music)\s*/i,
        ""
      )
      .replace(
        /^(on youtube|in youtube)\s*/i,
        ""
      )
      .trim();

    if (!query) {
      return "Tell me the song or video name, Boss.";
    }

    const url =
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(query);

    window.open(url, "_blank", "noopener,noreferrer");

    return (
      "Opening YouTube search for " +
      query +
      ", Boss."
    );
  }

  /* =========================================================
     20. CRYPTO
     ========================================================= */

  async function cryptoInfo(text) {
    const t = normalizeText(text);

    let coin = "bitcoin";

    if (
      /\b(ethereum|eth)\b/i.test(t)
    ) {
      coin = "ethereum";
    } else if (
      /\b(sol|solana)\b/i.test(t)
    ) {
      coin = "solana";
    } else if (
      /\b(doge|dogecoin)\b/i.test(t)
    ) {
      coin = "dogecoin";
    } else if (
      /\b(xrp)\b/i.test(t)
    ) {
      coin = "ripple";
    } else if (
      /\b(bnb)\b/i.test(t)
    ) {
      coin = "binancecoin";
    }

    try {
      const url =
        "https://api.coingecko.com/api/v3/simple/price" +
        "?ids=" +
        encodeURIComponent(coin) +
        "&vs_currencies=usd,inr" +
        "&include_24hr_change=true";

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Crypto failed");
      }

      const data = await response.json();

      const coinData = data[coin];

      if (!coinData) {
        throw new Error("Crypto unavailable");
      }

      const usd = coinData.usd;
      const inr = coinData.inr;
      const change =
        coinData.usd_24h_change;

      return (
        coin.toUpperCase() +
        " price: $" +
        usd +
        " / ₹" +
        inr +
        ". 24h change: " +
        (typeof change === "number"
          ? change.toFixed(2)
          : "N/A") +
        "%, Boss."
      );
    } catch {
      return (
        "Crypto price service is unavailable right now, Boss."
      );
    }
  }

  /* =========================================================
     21. OPEN APPS
     ========================================================= */

  function openApp(text) {
    const t = normalizeText(text);

    const apps = [
      {
        names: ["whatsapp", "what app", "whats app"],
        url: "https://wa.me/"
      },
      {
        names: ["telegram"],
        url: "https://t.me/"
      },
      {
        names: ["instagram", "insta"],
        url: "https://www.instagram.com/"
      },
      {
        names: ["facebook", "fb"],
        url: "https://www.facebook.com/"
      },
      {
        names: ["gmail", "mail"],
        url: "https://mail.google.com/"
      },
      {
        names: ["youtube", "you tube"],
        url: "https://www.youtube.com/"
      },
      {
        names: ["google"],
        url: "https://www.google.com/"
      }
    ];

    for (const app of apps) {
      if (
        app.names.some((name) =>
          t.includes(name)
        )
      ) {
        window.open(
          app.url,
          "_blank",
          "noopener,noreferrer"
        );

        return (
          "Opening " +
          app.names[0] +
          ", Boss."
        );
      }
    }

    return (
      "I cannot safely open that app from this browser, Boss."
    );
  }

  /* =========================================================
     22. CAMERA
     ========================================================= */

  function openCamera() {
    if (!imgInput) {
      return "Camera input is not available, Boss.";
    }

    /*
      capture=environment asks supported mobile browsers
      to use the rear camera.
    */

    imgInput.setAttribute(
      "capture",
      "environment"
    );

    imgInput.value = "";

    imgInput.click();

    return "Camera activated. Please capture an image, Boss.";
  }

  /* =========================================================
     23. IMAGE UPLOAD / PREVIEW
     ========================================================= */

  function handleImage(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      reply(
        "Please select a valid image file, Boss.",
        true
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      addImageMessage(
        reader.result,
        file.name || "Uploaded image"
      );

      remember(
        "image",
        file.name || "Uploaded image"
      );

      reply(
        "Image uploaded and previewed successfully, Boss.",
        false
      );
    };

    reader.onerror = () => {
      reply(
        "I could not read that image, Boss.",
        true
      );
    };

    reader.readAsDataURL(file);
  }

  /* =========================================================
     24. IMAGE BUTTON
     ========================================================= */

  if (camBtn) {
    camBtn.addEventListener("click", () => {
      openCamera();
    });
  }

  if (imgInput) {
    imgInput.addEventListener("change", () => {
      const file =
        imgInput.files &&
        imgInput.files[0];

      if (file) {
        handleImage(file);
      }
    });
  }

  /* =========================================================
     25. SIMPLE CHAT ENGINE
     ========================================================= */

  function localChat(text) {
    const t = normalizeText(text);

    if (
      /^(hi|hello|hey|hai|namaste)\b/i.test(t)
    ) {
      return "Hello, Boss. J.A.R.V.I.S. is online.";
    }

    if (
      t.includes("who are you") ||
      t.includes("what are you")
    ) {
      return (
        "I am J.A.R.V.I.S., your browser-based personal assistant, Boss."
      );
    }

    if (
      t.includes("thank") ||
      t.includes("thanks")
    ) {
      return "You're welcome, Boss.";
    }

    if (
      t.includes("good morning")
    ) {
      return "Good morning, Boss.";
    }

    if (
      t.includes("good night")
    ) {
      return "Good night, Boss.";
    }

    if (
      t.includes("how are you")
    ) {
      return "All systems are operational, Boss.";
    }

    if (
      t.includes("what can you do") ||
      t.includes("features")
    ) {
      return (
        "I can handle time, weather, timers, dice, coin tosses, jokes, quotes, news, translation, currency, dictionary, passwords, search, YouTube, crypto, voice commands, camera and image upload."
      );
    }

    return null;
  }

  /* =========================================================
     26. TOOL HANDLER
     ========================================================= */

  async function handleTools(text) {
    const original = String(text || "");
    const t = cleanCommand(original);

    if (!t) return null;

    const command =
      detectCorrectedCommand(t);

    /* ---------------- TIME ---------------- */

    if (
      command === "time" ||
      /\bwhat(?:'s| is)?\s+the\s+time\b/i.test(t)
    ) {
      return getTime();
    }

    /* ---------------- WEATHER ---------------- */

    if (
      command === "weather"
    ) {
      return await getWeather();
    }

    /* ---------------- TIMER ---------------- */

    if (
      command === "timer" ||
      /\bset\b.*\btimer\b/i.test(t)
    ) {
      return startTimer(t);
    }

    /* ---------------- DICE ---------------- */

    if (
      command === "dice" ||
      /\broll\b.*\bdice\b/i.test(t)
    ) {
      return rollDice(t);
    }

    /* ---------------- COIN ---------------- */

    if (
      command === "coin" ||
      /\b(heads|tails)\b/i.test(t) ||
      /\btoss\b.*\bcoin\b/i.test(t)
    ) {
      return tossCoin();
    }

    /* ---------------- JOKE ---------------- */

    if (
      command === "joke"
    ) {
      return await getJoke();
    }

    /* ---------------- QUOTE ---------------- */

    if (
      command === "quote"
    ) {
      return await getQuote();
    }

    /* ---------------- NEWS ---------------- */

    if (
      command === "news"
    ) {
      return newsSearch(t);
    }

    /* ---------------- TRANSLATE ---------------- */

    if (
      command === "translate"
    ) {
      return await translateText(t);
    }

    /* ---------------- CURRENCY ---------------- */

    if (
      command === "currency"
    ) {
      return await currencyConvert(t);
    }

    /* ---------------- DICTIONARY ---------------- */

    if (
      command === "dictionary"
    ) {
      return await dictionary(t);
    }

    /* ---------------- PASSWORD ---------------- */

    if (
      command === "password"
    ) {
      return generatePassword(t);
    }

    /* ---------------- YOUTUBE ---------------- */

    if (
      command === "youtube" ||
      /\bplay\b/i.test(t) &&
      (
        t.includes("song") ||
        t.includes("music") ||
        t.includes("youtube")
      )
    ) {
      return youtubePlay(t);
    }

    /* ---------------- CRYPTO ---------------- */

    if (
      command === "crypto"
    ) {
      return await cryptoInfo(t);
    }

    /* ---------------- CAMERA ---------------- */

    if (
      command === "camera"
    ) {
      return openCamera();
    }

    /* ---------------- CLEAR MEMORY ---------------- */

    if (
      command === "clear" ||
      /\b(clear|delete|erase|forget)\b.*\bmemory\b/i.test(t)
    ) {
      clearMemory();
      return null;
    }

    /* ---------------- OPEN APP ---------------- */

    if (
      /\b(open|launch|start)\b/i.test(t)
    ) {
      return openApp(t);
    }

    /* ---------------- SEARCH ---------------- */

    if (
      command === "search" ||
      /\bsearch\b/i.test(t)
    ) {
      return webSearch(t);
    }

    return null;
  }

  /* =========================================================
     27. EXECUTE COMMAND
     ========================================================= */

  let executing = false;

  async function executeCommand(commandText) {
    if (executing) return;

    const raw = String(commandText || "").trim();

    if (!raw) return;

    executing = true;

    try {
      addMessage(raw, "user");

      remember("user", raw);

      const cleaned = cleanCommand(raw);

      /*
        First try actual tools.
      */

      let result =
        await handleTools(cleaned);

      /*
        If no tool matched, use local chat.
      */

      if (result === null) {
        const local =
          localChat(cleaned);

        if (local) {
          result = local;
        }
      }

      /*
        Final browser search fallback.
      */

      if (result === null) {
        result =
          "I understood your command, Boss, but I do not have a built-in tool for that request yet. Try 'search " +
          cleaned +
          "'.";
      }

      /*
        handleTools may already have displayed
        the memory-clear response.
      */

      if (result !== null) {
        reply(result, false);
      }
    } catch (error) {
      console.error(
        "JARVIS command error:",
        error
      );

      reply(
        "Something went wrong while executing that command, Boss.",
        true
      );
    } finally {
      executing = false;
    }
  }

  /* =========================================================
     28. EXECUTE BUTTON
     ========================================================= */

  if (send) {
    send.addEventListener("click", () => {
      if (!msg) return;

      const command = msg.value.trim();

      if (!command) {
        reply(
          "Please enter a command, Boss.",
          true
        );
        return;
      }

      msg.value = "";

      executeCommand(command);
    });
  }

  /* =========================================================
     29. ENTER KEY
     ========================================================= */

  if (msg) {
    msg.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();

        if (send) {
          send.click();
        } else {
          executeCommand(msg.value);
          msg.value = "";
        }
      }
    });
  }

  /* =========================================================
     30. CLEAR MEMORY BUTTON
     ========================================================= */

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      clearMemory();
    });
  }

  /* =========================================================
     31. SPEECH RECOGNITION
     ========================================================= */

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  let recognition = null;
  let listening = false;

  if (SpeechRecognition) {
    recognition =
      new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;

    /*
      English + Indian English.
      Browser chooses the available speech model.
    */

    recognition.lang = "en-IN";

    recognition.onstart = () => {
      listening = true;

      if (micBtn) {
        micBtn.setAttribute(
          "aria-label",
          "Stop voice input"
        );

        micBtn.dataset.listening = "true";
      }

      addMessage(
        "Listening...",
        "jarvis"
      );
    };

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const transcript =
          event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      const spoken =
        (finalText || interimText).trim();

      if (spoken && msg) {
        msg.value = spoken;
      }

      /*
        Execute only when browser reports final result.
      */

      if (finalText.trim()) {
        const command =
          finalText.trim();

        if (msg) {
          msg.value = "";
        }

        executeCommand(command);
      }
    };

    recognition.onerror = (event) => {
      console.warn(
        "Speech recognition error:",
        event.error
      );

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        reply(
          "Microphone permission was denied, Boss.",
          true
        );
      } else if (
        event.error === "no-speech"
      ) {
        reply(
          "I did not hear anything, Boss.",
          false
        );
      } else {
        reply(
          "Voice recognition encountered an error, Boss.",
          false
        );
      }
    };

    recognition.onend = () => {
      listening = false;

      if (micBtn) {
        micBtn.setAttribute(
          "aria-label",
          "Activate voice input"
        );

        micBtn.dataset.listening = "false";
      }
    };
  }

  /* =========================================================
     32. MIC BUTTON
     ========================================================= */

  if (micBtn) {
    micBtn.addEventListener("click", () => {
      if (!recognition) {
        reply(
          "Voice recognition is not supported by this browser. Please use Chrome or a compatible browser.",
          true
        );
        return;
      }

      try {
        if (listening) {
          recognition.stop();
          return;
        }

        recognition.start();
      } catch (error) {
        /*
          Calling start twice can throw an InvalidStateError.
          Stop first and retry once.
        */

        try {
          recognition.stop();
        } catch {}

        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            reply(
              "I could not start the microphone, Boss.",
              true
            );
          }
        }, 200);
      }
    });
  }

  /* =========================================================
     33. OPTIONAL VOICE LANGUAGE SUPPORT
     ========================================================= */

  function setRecognitionLanguage(language) {
    if (!recognition) return;

    recognition.lang = language;
  }

  /*
    Default Indian English.

    The function is exposed so it can be changed from
    browser console if needed:

    setRecognitionLanguage("te-IN")
  */

  window.JARVIS_SET_VOICE_LANGUAGE =
    setRecognitionLanguage;

  /* =========================================================
     34. IMAGE PREVIEW DRAG/DROP SUPPORT
     ========================================================= */

  if (chat) {
    chat.addEventListener("dragover", (event) => {
      event.preventDefault();
    });

    chat.addEventListener("drop", (event) => {
      event.preventDefault();

      const files =
        event.dataTransfer &&
        event.dataTransfer.files;

      if (!files || !files.length) return;

      const file = files[0];

      handleImage(file);
    });
  }

  /* =========================================================
     35. PAGE LOAD STATUS
     ========================================================= */

  function initializeJarvis() {
    console.log(
      "J.A.R.V.I.S. initialized successfully."
    );

    console.log(
      "Available commands:",
      Object.keys(commandAliases).join(", ")
    );

    /*
      Do not automatically speak on page load.
      This avoids browser autoplay restrictions.
    */

    if (chat && chat.children.length === 0) {
      addMessage(
        "J.A.R.V.I.S. online. System ready, Boss.",
        "jarvis"
      );
    }
  }

  /* =========================================================
     36. PUBLIC API
     ========================================================= */

  window.JARVIS = {
    execute: executeCommand,
    speak,
    clearMemory,
    getTime,
    getWeather,
    rollDice,
    tossCoin,
    getJoke,
    getQuote,
    translateText,
    currencyConvert,
    dictionary,
    generatePassword,
    webSearch,
    youtubePlay,
    cryptoInfo,
    openCamera
  };

  /* =========================================================
     37. START
     ========================================================= */

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initializeJarvis,
      { once: true }
    );
  } else {
    initializeJarvis();
  }

})();
