  /* =========================================================
   J.A.R.V.I.S — COMPLETE script.js
   Compatible with the supplied HTML
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     HTML ELEMENTS
     ========================================================= */

  const $ = (id) => document.getElementById(id);

  const chat = $("chat");
  const msg = $("msg");
  const sendBtn = $("send");
  const micBtn = $("mic-btn");
  const camBtn = $("cam-btn");
  const clearBtn = $("clear-btn");
  const imgInput = $("img-input");

  const STORAGE_KEY = "jarvis_chat_history_v1";

  let recognition = null;
  let listening = false;
  let selectedImage = null;
  let timerIds = [];

  if (
    !chat ||
    !msg ||
    !sendBtn ||
    !micBtn ||
    !camBtn ||
    !clearBtn ||
    !imgInput
  ) {
    console.error("JARVIS: Required HTML elements are missing.");
    return;
  }

  /* =========================================================
     BASIC HELPERS
     ========================================================= */

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function scrollChat() {
    requestAnimationFrame(() => {
      chat.scrollTop = chat.scrollHeight;
    });
  }

  /* =========================================================
     CHAT STORAGE
     ========================================================= */

  function saveMessage(role, text, imageData = null) {
    try {
      const history = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      history.push({
        role: role,
        text: String(text ?? ""),
        imageData: imageData,
        time: Date.now()
      });

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(history.slice(-100))
      );
    } catch (error) {
      console.warn(
        "JARVIS: Could not save chat history.",
        error
      );
    }
  }

  function addMessage(role, text, options = {}) {
    const item = document.createElement("div");

    item.className =
      role === "user"
        ? "message user-message"
        : "message jarvis-message";

    const body = document.createElement("div");

    body.className = "message-content";

    body.textContent = String(text ?? "");

    item.appendChild(body);

    /* Uploaded image */

    if (options.imageData) {
      const image = document.createElement("img");

      image.src = options.imageData;
      image.alt = "Uploaded image";
      image.className = "jarvis-uploaded-image";

      image.style.maxWidth = "100%";
      image.style.maxHeight = "280px";
      image.style.display = "block";
      image.style.marginTop = "10px";
      image.style.borderRadius = "12px";
      image.style.objectFit = "contain";

      item.appendChild(image);
    }

    chat.appendChild(item);

    scrollChat();

    if (!options.skipSave) {
      saveMessage(
        role,
        text,
        options.imageData || null
      );
    }

    return item;
  }

  function addSystem(text) {
    addMessage("jarvis", text);
  }

  /* =========================================================
     LOAD CHAT HISTORY
     ========================================================= */

  function loadHistory() {
    try {
      const history = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      if (!Array.isArray(history)) return;

      history.forEach((message) => {
        if (
          message &&
          (
            message.role === "user" ||
            message.role === "jarvis"
          )
        ) {
          addMessage(
            message.role,
            message.text,
            {
              imageData:
                message.imageData || null,
              skipSave: true
            }
          );
        }
      });
    } catch (error) {
      console.warn(
        "JARVIS: Invalid saved history.",
        error
      );
    }
  }

  /* =========================================================
     TEXT TO SPEECH
     ========================================================= */

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const cleanText = String(text)
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[*_`#]/g, "")
        .slice(0, 1800);

      const utterance =
        new SpeechSynthesisUtterance(cleanText);

      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voices =
        window.speechSynthesis.getVoices();

      const preferred = voices.find(
        (voice) =>
          /en-IN|en-US|en-GB|te-IN/i.test(
            voice.lang
          )
      );

      if (preferred) {
        utterance.voice = preferred;
      }

      window.speechSynthesis.speak(
        utterance
      );
    } catch (error) {
      console.warn(
        "JARVIS: Speech error.",
        error
      );
    }
  }

  /* =========================================================
     BUSY STATE
     ========================================================= */

  function setBusy(value) {
    document.documentElement.classList.toggle(
      "jarvis-busy",
      value
    );

    sendBtn.disabled = value;
  }

  /* =========================================================
     MICROPHONE
     ========================================================= */

  function setupSpeechRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      micBtn.title =
        "Voice input is not supported in this browser.";

      return;
    }

    recognition =
      new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onstart = () => {
      listening = true;

      micBtn.classList.add("active");

      micBtn.setAttribute(
        "aria-pressed",
        "true"
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

      if (finalText) {
        msg.value = finalText.trim();
      } else if (interimText) {
        msg.value = interimText;
      }
    };

    recognition.onerror = (event) => {
      console.warn(
        "JARVIS voice error:",
        event.error
      );

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        addSystem(
          "Microphone permission was not granted."
        );
      }
    };

    recognition.onend = () => {
      listening = false;

      micBtn.classList.remove("active");

      micBtn.setAttribute(
        "aria-pressed",
        "false"
      );
    };
  }

  micBtn.addEventListener(
    "click",
    () => {
      if (!recognition) {
        addSystem(
          "Voice input is not supported by this browser. Try Chrome on Android."
        );

        return;
      }

      try {
        if (listening) {
          recognition.stop();
        } else {
          recognition.start();
        }
      } catch (error) {
        console.warn(
          "JARVIS microphone error:",
          error
        );
      }
    }
  );

  /* =========================================================
     CAMERA
     ========================================================= */

  function createCameraInput() {
    const input =
      document.createElement("input");

    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";

    input.style.display = "none";

    document.body.appendChild(input);

    input.addEventListener(
      "change",
      () => {
        handleImageFile(
          input.files &&
          input.files[0]
        );

        setTimeout(
          () => input.remove(),
          1000
        );
      }
    );

    input.click();
  }

  camBtn.addEventListener(
    "click",
    createCameraInput
  );

  /* =========================================================
     IMAGE UPLOAD
     ========================================================= */

  function handleImageFile(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addSystem(
        "Please select a valid image."
      );

      return;
    }

    const reader =
      new FileReader();

    reader.onload = () => {
      selectedImage = {
        name:
          file.name || "image",
        type: file.type,
        data: reader.result
      };

      addMessage(
        "user",
        `Image uploaded: ${
          file.name || "camera image"
        }`,
        {
          imageData:
            reader.result
        }
      );

      addSystem(
        "Image received, Boss. The image is displayed correctly. Visual AI analysis requires an image-capable AI API."
      );
    };

    reader.onerror = () => {
      addSystem(
        "I could not read that image."
      );
    };

    reader.readAsDataURL(file);
  }

  imgInput.addEventListener(
    "change",
    () => {
      handleImageFile(
        imgInput.files &&
        imgInput.files[0]
      );

      imgInput.value = "";
    }
  );

  /* =========================================================
     TIME
     ========================================================= */

  function getTime() {
    return (
      "The time is " +
      new Date().toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }
      ) +
      ", Boss."
    );
  }

  /* =========================================================
     DATE
     ========================================================= */

  function getDate() {
    return (
      "Today is " +
      new Date().toLocaleDateString(
        [],
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        }
      ) +
      "."
    );
  }

  /* =========================================================
     WEATHER
     ========================================================= */

  function getWeather() {
    return new Promise(
      (resolve) => {
        if (!navigator.geolocation) {
          resolve(
            "Geolocation is not supported on this device, Boss."
          );

          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const latitude =
                position.coords.latitude;

              const longitude =
                position.coords.longitude;

              const url =
                "https://api.open-meteo.com/v1/forecast" +
                "?latitude=" +
                encodeURIComponent(
                  latitude
                ) +
                "&longitude=" +
                encodeURIComponent(
                  longitude
                ) +
                "&current=" +
                "temperature_2m," +
                "relative_humidity_2m," +
                "apparent_temperature," +
                "weather_code," +
                "wind_speed_10m";

              const response =
                await fetch(url);

              if (!response.ok) {
                throw new Error(
                  "Weather request failed"
                );
              }

              const data =
                await response.json();

              const current =
                data.current || {};

              const temp =
                current.temperature_2m;

              const feels =
                current.apparent_temperature;

              resolve(
                "Current temperature is " +
                (temp ?? "unknown") +
                "°C" +
                (
                  feels != null
                    ? ", feels like " +
                      feels +
                      "°C"
                    : ""
                ) +
                "."
              );
            } catch (error) {
              console.error(error);

              resolve(
                "I could not retrieve the live weather right now, Boss."
              );
            }
          },

          () => {
            resolve(
              "I need location permission to get live weather, Boss."
            );
          },

          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000
          }
        );
      }
    );
  }

  /* =========================================================
     TIMER
     ========================================================= */

  function parseDuration(text) {
    const match =
      text.match(
        /(?:set\s+)?(?:a\s+)?timer(?:\s+for)?\s+(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)/i
      );

    if (!match) {
      return null;
    }

    const amount =
      Number(match[1]);

    const unit =
      match[2].toLowerCase();

    let factor = 1000;

    if (
      /minutes?|mins?|m/.test(unit)
    ) {
      factor = 60000;
    }

    if (
      /hours?|hrs?|h/.test(unit)
    ) {
      factor = 3600000;
    }

    return {
      amount,
      unit,
      ms: Math.max(
        1,
        amount * factor
      )
    };
  }

  function setTimer(text) {
    const parsed =
      parseDuration(text);

    if (!parsed) {
      return (
        "Say something like: set a timer for 5 minutes."
      );
    }

    const id =
      setTimeout(
        () => {
          const message =
            "Timer complete, Boss. Your " +
            parsed.amount +
            " " +
            parsed.unit +
            " timer has finished.";

          addSystem(message);

          speak(message);

          timerIds =
            timerIds.filter(
              (x) => x !== id
            );
        },
        parsed.ms
      );

    timerIds.push(id);

    return (
      "Timer set for " +
      parsed.amount +
      " " +
      parsed.unit +
      ", Boss."
    );
  }

  /* =========================================================
     TRANSLATE
     ========================================================= */

  async function translateText(text) {
    let query =
      text
        .replace(
          /^translate\b/i,
          ""
        )
        .trim();

    if (!query) {
      query = "hello";
    }

    try {
      const url =
        "https://api.mymemory.translated.net/get" +
        "?q=" +
        encodeURIComponent(query) +
        "&langpair=en|te";

      const response =
        await fetch(url);

      if (!response.ok) {
        throw new Error(
          "Translation failed"
        );
      }

      const data =
        await response.json();

      const translated =
        data?.responseData?.translatedText;

      if (!translated) {
        return (
          "I could not translate that text right now, Boss."
        );
      }

      return (
        "In Telugu: " +
        translated
      );
    } catch (error) {
      console.error(error);

      return (
        "Translation service is unavailable right now, Boss."
      );
    }
  }

  /* =========================================================
     YOUTUBE
     ========================================================= */

  function youtubeSearch(text) {
    const query =
      text
        .replace(
          /^(play|youtube|search youtube)\b/i,
          ""
        )
        .trim();

    if (!query) {
      return (
        "Tell me what you want to search on YouTube."
      );
    }

    window.open(
      "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(query),
      "_blank",
      "noopener,noreferrer"
    );

    return (
      "Searching YouTube for " +
      query +
      ", Boss."
    );
  }

  /* =========================================================
     GOOGLE SEARCH
     ========================================================= */

  function googleSearch(text) {
    const query =
      text
        .replace(
          /^(search|google|web search)\b/i,
          ""
        )
        .trim();

    if (!query) {
      return (
        "Tell me what you want me to search for."
      );
    }

    window.open(
      "https://www.google.com/search?q=" +
        encodeURIComponent(query),
      "_blank",
      "noopener,noreferrer"
    );

    return (
      "Searching the web for " +
      query +
      ", Boss."
    );
  }

  /* =========================================================
     DICE / COIN
     ========================================================= */

  function rollDiceOrCoin(text) {
    if (
      /\bcoin\b/i.test(text)
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

    const sidesMatch =
      text.match(
        /\b(\d+)\s*sided?\b/i
      );

    const sides =
      sidesMatch
        ? Math.max(
            2,
            Number(
              sidesMatch[1]
            )
          )
        : 6;

    const result =
      Math.floor(
        Math.random() * sides
      ) + 1;

    return (
      "Dice result: " +
      result +
      " on a " +
      sides +
      "-sided die."
    );
  }

  /* =========================================================
     JOKE
     ========================================================= */

  async function getJoke() {
    try {
      const response =
        await fetch(
          "https://official-joke-api.appspot.com/random_joke"
        );

      if (!response.ok) {
        throw new Error(
          "Joke API failed"
        );
      }

      const data =
        await response.json();

      return (
        data.setup +
        " — " +
        data.punchline
      );
    } catch {
      return (
        "Why did the computer go to the doctor? Because it had a byte problem."
      );
    }
  }

  /* =========================================================
     QUOTE
     ========================================================= */

  function getQuote() {
    const quotes = [
      "Small progress is still progress.",
      "Focus on the next useful step.",
      "Consistency turns effort into results.",
      "Keep learning, keep building, keep improving."
    ];

    return quotes[
      Math.floor(
        Math.random() *
          quotes.length
      )
    ];
  }

  /* =========================================================
     NEWS
     ========================================================= */

  function openNews() {
    window.open(
      "https://news.google.com/",
      "_blank",
      "noopener,noreferrer"
    );

    return (
      "Opening the latest news, Boss."
    );
  }

  /* =========================================================
     CURRENCY
     ========================================================= */

  async function convertCurrency(text) {
    const match =
      text.match(
        /(?:convert\s+)?(\d+(?:\.\d+)?)\s*([A-Za-z]{3})\s*(?:to|in)\s*([A-Za-z]{3})/i
      );

    if (!match) {
      return (
        "Use a command like: convert 100 USD to INR."
      );
    }

    const amount =
      Number(match[1]);

    const from =
      match[2].toUpperCase();

    const to =
      match[3].toUpperCase();

    try {
      const url =
        "https://api.frankfurter.app/latest" +
        "?amount=" +
        encodeURIComponent(amount) +
        "&from=" +
        encodeURIComponent(from) +
        "&to=" +
        encodeURIComponent(to);

      const response =
        await fetch(url);

      if (!response.ok) {
        throw new Error(
          "Currency API failed"
        );
      }

      const data =
        await response.json();

      const value =
        data?.rates?.[to];

      if (value == null) {
        throw new Error(
          "No conversion"
        );
      }

      return (
        amount +
        " " +
        from +
        " = " +
        Number(value).toFixed(2) +
        " " +
        to +
        "."
      );
    } catch {
      return (
        "I could not convert that currency right now."
      );
    }
  }

  /* =========================================================
     WORD MEANING
     ========================================================= */

  async function getMeaning(text) {
    const word =
      text
        .replace(
          /^(meaning|define|definition)\b/i,
          ""
        )
        .trim()
        .split(/\s+/)[0];

    if (!word) {
      return (
        "Tell me a word to define."
      );
    }

    try {
      const response =
        await fetch(
          "https://api.dictionaryapi.dev/api/v2/entries/en/" +
            encodeURIComponent(word)
        );

      if (!response.ok) {
        throw new Error(
          "Dictionary request failed"
        );
      }

      const data =
        await response.json();

      const definition =
        data?.[0]
          ?.meanings?.[0]
          ?.definitions?.[0]
          ?.definition;

      return definition
        ? word +
          ": " +
          definition
        : "I could not find a definition for " +
          word +
          ".";
    } catch {
      return (
        "I could not find a definition for " +
        word +
        "."
      );
    }
  }

  /* =========================================================
     PASSWORD GENERATOR
     ========================================================= */

  function generatePassword(text) {
    const lengthMatch =
      text.match(
        /\b(\d{1,3})\b/
      );

    const length =
      Math.min(
        64,
        Math.max(
          8,
          lengthMatch
            ? Number(
                lengthMatch[1]
              )
            : 16
        )
      );

    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";

    const array =
      new Uint32Array(
        length
      );

    crypto.getRandomValues(
      array
    );

    let password = "";

    for (
      let i = 0;
      i < length;
      i++
    ) {
      password +=
        chars[
          array[i] %
            chars.length
        ];
    }

    return (
      "Generated password: " +
      password
    );
  }

  /* =========================================================
     OPEN APPS
     ========================================================= */

  function openApp(text) {
    const lower =
      text.toLowerCase();

    const apps = [
      {
        keys: ["whatsapp"],
        url:
          "https://web.whatsapp.com/"
      },

      {
        keys: ["youtube"],
        url:
          "https://www.youtube.com/"
      },

      {
        keys: ["gmail", "mail"],
        url:
          "https://mail.google.com/"
      },

      {
        keys: ["maps", "google maps"],
        url:
          "https://maps.google.com/"
      },

      {
        keys: ["instagram"],
        url:
          "https://www.instagram.com/"
      },

      {
        keys: ["facebook"],
        url:
          "https://www.facebook.com/"
      },

      {
        keys: ["spotify"],
        url:
          "https://open.spotify.com/"
      }
    ];

    const app =
      apps.find(
        (item) =>
          item.keys.some(
            (key) =>
              lower.includes(key)
          )
      );

    if (!app) {
      return (
        "Tell me the app name, for example: open YouTube."
      );
    }

    window.open(
      app.url,
      "_blank",
      "noopener,noreferrer"
    );

    return (
      "Opening " +
      app.keys[0] +
      ", Boss."
    );
  }

  /* =========================================================
     PLAY SONGS
     ========================================================= */

  function playSongs(text) {
    const query =
      text
        .replace(
          /^(play songs?|play music)\b/i,
          ""
        )
        .trim();

    return youtubeSearch(
      query || "music"
    );
  }

  /* =========================================================
     CRYPTO
     ========================================================= */

  async function getCrypto(text) {
    const match =
      text.match(
        /\b(bitcoin|btc|ethereum|eth|solana|sol|dogecoin|doge)\b/i
      );

    const symbol =
      match
        ? match[1].toLowerCase()
        : "bitcoin";

    const ids = {
      bitcoin: "bitcoin",
      btc: "bitcoin",
      ethereum: "ethereum",
      eth: "ethereum",
      solana: "solana",
      sol: "solana",
      dogecoin: "dogecoin",
      doge: "dogecoin"
    };

    const id =
      ids[symbol];

    try {
      const response =
        await fetch(
          "https://api.coingecko.com/api/v3/simple/price" +
            "?ids=" +
            id +
            "&vs_currencies=usd,inr"
        );

      if (!response.ok) {
        throw new Error(
          "Crypto API failed"
        );
      }

      const data =
        await response.json();

      const coin =
        data[id];

      if (!coin) {
        throw new Error(
          "Crypto not found"
        );
      }

      return (
        symbol.toUpperCase() +
        ": $" +
        (coin.usd ?? "N/A") +
        " USD / ₹" +
        (coin.inr ?? "N/A") +
        " INR."
      );
    } catch {
      return (
        "Crypto price service is unavailable right now, Boss."
      );
    }
  }

  /* =========================================================
     LOCAL CHAT
     ========================================================= */

  function localChat(text) {
    const t =
      text
        .toLowerCase()
        .trim();

    if (
      /^(hi|hello|hey|hai|హాయ్|నమస్తే)\b/i.test(
        t
      )
    ) {
      return (
        "Hello, Boss. JARVIS is online. How can I help?"
      );
    }

    if (
      t.includes("who are you") ||
      t.includes("what are you")
    ) {
      return (
        "I am JARVIS, your browser-based personal assistant."
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
      t.includes("help")
    ) {
      return (
        "Try: time, weather, set a timer for 5 minutes, translate hello, play music, search web, news, convert 100 USD to INR, meaning computer, generate password, open YouTube, dice, coin, joke, quote, or crypto bitcoin."
      );
    }

    if (
      /\b(date|today)\b/i.test(t)
    ) {
      return getDate();
    }

    return (
      'I received: "' +
      text +
      '". General ChatGPT-style answers require an AI backend/API connection.'
    );
  }

  /* =========================================================
     TOOL ROUTER
     ========================================================= */

  async function handleTools(text) {
    const t =
      text
        .toLowerCase()
        .trim();

    /* TIME */

    if (
      /\bwhat(?:'s| is)?\s*(the\s*)?time\b/i.test(t) ||
      /\btime now\b/i.test(t) ||
      t.includes("సమయం")
    ) {
      return getTime();
    }

    /* WEATHER */

    if (
      /\bweather\b/i.test(t) ||
      t.includes("వాతావరణం") ||
      t.includes("temperature")
    ) {
      return await getWeather();
    }

    /* TIMER */

    if (
      /\btimer\b/i.test(t) ||
      t.includes("టైమర్") ||
      /\bset\s+(a\s+)?timer\b/i.test(t)
    ) {
      return setTimer(text);
    }

    /* TRANSLATE */

    if (
      /\btranslate\b/i.test(t) ||
      t.includes("అనువద")
    ) {
      return await translateText(text);
    }

    /* YOUTUBE */

    if (
      /\b(play|youtube)\b/i.test(t) ||
      t.includes("youtube")
    ) {
      return youtubeSearch(text);
    }

    /* DICE / COIN */

    if (
      /\b(coin|dice|roll)\b/i.test(t)
    ) {
      return rollDiceOrCoin(text);
    }

    /* JOKE */

    if (
      /\bjoke\b/i.test(t)
    ) {
      return await getJoke();
    }

    /* QUOTE */

    if (
      /\bquote\b/i.test(t)
    ) {
      return getQuote();
    }

    /* NEWS */

    if (
      /\b(news|headlines)\b/i.test(t)
    ) {
      return openNews();
    }

    /* CURRENCY */

    if (
      /\bconvert\b/i.test(t) ||
      /\b\d+(?:\.\d+)?\s*[A-Za-z]{3}\s+(?:to|in)\s+[A-Za-z]{3}\b/i.test(t)
    ) {
      return await convertCurrency(text);
    }

    /* MEANING */

    if (
      /\b(meaning|define|definition)\b/i.test(t)
    ) {
      return await getMeaning(text);
    }

    /* PASSWORD */

    if (
      /\b(password|generate password)\b/i.test(t)
    ) {
      return generatePassword(text);
    }

    /* OPEN APPS */

    if (
      /\b(open|launch)\b/i.test(t) &&
      /\b(whatsapp|youtube|gmail|mail|maps|instagram|facebook|spotify)\b/i.test(t)
    ) {
      return openApp(text);
    }

    /* PLAY MUSIC */

    if (
      /\b(play songs?|play music)\b/i.test(t)
    ) {
      return playSongs(text);
    }

    /* CRYPTO */

    if (
      /\b(crypto|bitcoin|btc|ethereum|eth|solana|dogecoin|doge)\b/i.test(t)
    ) {
      return await getCrypto(text);
    }

    /* WEB SEARCH */

    if (
      /^(search|google|web search)\b/i.test(t) ||
      /\bsearch (for|the web)\b/i.test(t)
    ) {
      return googleSearch(text);
    }

    return null;
  }

  /* =========================================================
     PROCESS COMMAND
     ========================================================= */

  async function processCommand(text) {
    const cleaned =
      String(text || "")
        .trim();

    if (!cleaned) {
      return;
    }

    addMessage(
      "user",
      cleaned
    );

    msg.value = "";

    setBusy(true);

    try {
      const toolResult =
        await handleTools(
          cleaned
        );

      const reply =
        toolResult ??
        localChat(cleaned);

      addSystem(reply);

      speak(reply);
    } catch (error) {
      console.error(
        "JARVIS command error:",
        error
      );

      const reply =
        "I encountered an error while processing that command, Boss.";

      addSystem(reply);

      speak(reply);
    } finally {
      setBusy(false);

      msg.focus();
    }
  }

  /* =========================================================
     SEND BUTTON
     ========================================================= */

  sendBtn.addEventListener(
    "click",
    () => {
      processCommand(
        msg.value
      );
    }
  );

  /* =========================================================
     ENTER KEY
     ========================================================= */

  msg.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        processCommand(
          msg.value
        );
      }
    }
  );

  /* =========================================================
     CLEAR MEMORY
     ========================================================= */

  clearBtn.addEventListener(
    "click",
    () => {
      timerIds.forEach(
        clearTimeout
      );

      timerIds = [];

      if (
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }

      if (
        recognition &&
        listening
      ) {
        try {
          recognition.stop();
        } catch {}
      }

      localStorage.removeItem(
        STORAGE_KEY
      );

      chat.innerHTML = "";

      selectedImage = null;

      addSystem(
        "Memory cleared, Boss. JARVIS is ready."
      );
    }
  );

  /* =========================================================
     GLOBAL JARVIS API
     ========================================================= */

  window.JARVIS = {
    send: processCommand,

    upload: () => {
      imgInput.click();
    },

    camera: createCameraInput,

    speak: speak,

    clearMemory: () => {
      clearBtn.click();
    }
  };

  /* =========================================================
     INITIALIZE
     ========================================================= */

  setupSpeechRecognition();

  loadHistory();

  if (!chat.children.length) {
    addSystem(
      "JARVIS online. System ready, Boss."
    );
  }

  /* =========================================================
     SYSTEM DIAGNOSTICS
     ========================================================= */

  document
    .querySelectorAll(".status .row")
    .forEach((row) => {
      const label =
        row
          .querySelector("span")
          ?.textContent
          ?.trim()
          .toLowerCase();

      const value =
        row.querySelector("b");

      if (!value) return;

      if (
        label?.includes(
          "ai engine"
        )
      ) {
        value.textContent =
          "● OPERATIONAL";
      }

      else if (
        label?.includes(
          "connection"
        )
      ) {
        value.textContent =
          navigator.onLine
            ? "● ONLINE"
            : "● OFFLINE";
      }

      else if (
        label?.includes(
          "voice interface"
        )
      ) {
        value.textContent =
          recognition
            ? "● READY"
            : "● UNSUPPORTED";
      }

      else if (
        label?.includes(
          "memory"
        )
      ) {
        value.textContent =
          "● ACTIVE";
      }
    });

  /* =========================================================
     ONLINE / OFFLINE
     ========================================================= */

  window.addEventListener(
    "online",
    () => {
      const row =
        [
          ...document.querySelectorAll(
            ".status .row"
          )
        ].find(
          (r) =>
            /connection/i.test(
              r.querySelector(
                "span"
              )?.textContent || ""
            )
        );

      const value =
        row?.querySelector("b");

      if (value) {
        value.textContent =
          "● ONLINE";
      }
    }
  );

  window.addEventListener(
    "offline",
    () => {
      const row =
        [
          ...document.querySelectorAll(
            ".status .row"
          )
        ].find(
          (r) =>
            /connection/i.test(
              r.querySelector(
                "span"
              )?.textContent || ""
            )
        );

      const value =
        row?.querySelector("b");

      if (value) {
        value.textContent =
          "● OFFLINE";
      }
    }
  );

})();
