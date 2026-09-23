/* J.A.R.V.I.S. — Complete JavaScript Controller */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const msg = $("msg");
  const send = $("send");
  const micBtn = $("mic-btn");
  const camBtn = $("cam-btn");
  const clearBtn = $("clear-btn");
  const imgInput = $("img-input");
  const chat = $("chat");

  if (!msg || !send || !chat) return;

  const MEMORY_KEY = "jarvis_memory_v1";
  const timers = new Set();

  let recognition = null;
  let listening = false;
  let lastImage = null;

  async function fetchWithTimeout(url, options = {}, timeout = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchJSON(url, options = {}, timeout = 12000) {
    const response = await fetchWithTimeout(url, options, timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  function cleanText(value) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function addMessage(text, who = "J.A.R.V.I.S.") {
    const item = document.createElement("div");

    item.className = "message";

    item.innerHTML =
      `<b>${escapeHTML(who)}</b><div>${escapeHTML(text)}</div>`;

    chat.appendChild(item);
    chat.scrollTop = chat.scrollHeight;
    chat.style.display = "block";

    return item;
  }

  function addUserMessage(text) {
    return addMessage(text, "YOU");
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(
        cleanText(text)
      );

      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voices = window.speechSynthesis.getVoices();

      const preferred =
        voices.find(v => /^en-IN$/i.test(v.lang)) ||
        voices.find(v => /^en-US$/i.test(v.lang)) ||
        voices.find(v => /^en-GB$/i.test(v.lang));

      if (preferred) {
        utterance.voice = preferred;
      }

      window.speechSynthesis.speak(utterance);
    } catch (_) {}
  }

  function reply(text, options = {}) {
    const answer = cleanText(text);

    addMessage(answer);

    if (options.speak !== false) {
      speak(answer);
    }

    saveMemory("lastResponse", answer);

    return answer;
  }

  function saveMemory(key, value) {
    try {
      const memory = JSON.parse(
        localStorage.getItem(MEMORY_KEY) || "{}"
      );

      memory[key] = value;

      localStorage.setItem(
        MEMORY_KEY,
        JSON.stringify(memory)
      );
    } catch (_) {}
  }

  function getMemory() {
    try {
      return JSON.parse(
        localStorage.getItem(MEMORY_KEY) || "{}"
      );
    } catch (_) {
      return {};
    }
  }

  function clearMemory() {
    try {
      localStorage.removeItem(MEMORY_KEY);
    } catch (_) {}

    chat.innerHTML = "";
    chat.style.display = "none";
    msg.value = "";

    reply("Memory cleared, Boss.");
  }

  function setBusy(state) {
    if (send) {
      send.disabled = state;
      send.dataset.busy = state ? "1" : "0";
      send.textContent = state ? "WAIT..." : "EXECUTE";
    }

    document.body.classList.toggle(
      "jarvis-busy",
      state
    );
  }

  function openURL(url) {
    try {
      const w = window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );

      if (!w) {
        window.location.href = url;
      }
    } catch (_) {
      window.location.href = url;
    }
  }

  function normalize(text) {
    return cleanText(text).toLowerCase();
  }

  function randomItem(array) {
    return array[
      Math.floor(Math.random() * array.length)
    ];
  }

  function parseDuration(text) {
    const match = normalize(text).match(
      /(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/i
    );

    if (!match) return null;

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    let factor = 1000;

    if (/^(minutes?|mins?|m)$/.test(unit)) {
      factor = 60000;
    }

    if (/^(hours?|hrs?|h)$/.test(unit)) {
      factor = 3600000;
    }

    const duration = Math.max(
      1000,
      Math.round(amount * factor)
    );

    return {
      amount,
      unit,
      duration
    };
  }

  async function handleTools(text) {
    const t = normalize(text);

    /* 1. TIME */

    if (
      /\btime\b/.test(t) ||
      t.includes("what time") ||
      t.includes("current time") ||
      t.includes("టైమ్") ||
      t.includes("సమయం")
    ) {
      return `The time is ${new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit"
      })}, Boss.`;
    }

    /* 2. WEATHER */

    if (
      t.includes("weather") ||
      t.includes("temperature") ||
      t.includes("వాతావరణం") ||
      t.includes("టెంపరేచర్")
    ) {
      return await getWeather();
    }

    /* 3. TIMER */

    const durationInfo = parseDuration(t);

    if (
      (
        t.includes("timer") ||
        t.includes("alarm") ||
        t.includes("టైమర్")
      ) &&
      durationInfo
    ) {
      const {
        amount,
        unit,
        duration
      } = durationInfo;

      const id = setTimeout(() => {
        timers.delete(id);

        const completed =
          `Timer complete. ${amount} ${unit} is finished, Boss.`;

        addMessage(completed);
        speak(completed);
      }, duration);

      timers.add(id);

      return `Timer set for ${amount} ${unit}.`;
    }

    /* 4. DICE / COIN */

    if (
      /\b(dice|roll|coin|flip|toss)\b/.test(t) ||
      t.includes("డైస్") ||
      t.includes("కాయిన్")
    ) {
      if (
        /\b(coin|flip|toss)\b/.test(t) ||
        t.includes("కాయిన్")
      ) {
        return `Coin toss result: ${
          Math.random() < 0.5
            ? "Heads"
            : "Tails"
        }.`;
      }

      const sidesMatch = t.match(
        /\b(?:d|dice)\s*(\d{1,3})\b/
      );

      const sides = Math.max(
        2,
        Math.min(
          1000,
          Number(sidesMatch?.[1] || 6)
        )
      );

      return `Dice roll: ${
        Math.floor(Math.random() * sides) + 1
      } on a ${sides}-sided die.`;
    }

    /* 5. JOKE */

    if (
      t.includes("joke") ||
      t.includes("tell me a joke") ||
      t.includes("జోక్")
    ) {
      try {
        const d = await fetchJSON(
          "https://v2.jokeapi.dev/joke/Any?safe-mode&type=single"
        );

        if (d.joke) {
          return d.joke;
        }

        if (d.setup && d.delivery) {
          return `${d.setup} ${d.delivery}`;
        }
      } catch (_) {}

      return randomItem([
        "Why did the computer get cold? It left its Windows open.",
        "I told my code to behave. It responded with another bug.",
        "Why do programmers prefer dark mode? Because light attracts bugs."
      ]);
    }

    /* 6. QUOTE */

    if (
      t.includes("quote") ||
      t.includes("motivation") ||
      t.includes("motivational") ||
      t.includes("కోట్") ||
      t.includes("మోటివేషన్")
    ) {
      try {
        const d = await fetchJSON(
          "https://api.quotable.io/random",
          {},
          10000
        );

        if (d.content) {
          return `"${d.content}" — ${d.author || "Unknown"}`;
        }
      } catch (_) {}

      return randomItem([
        "Small progress is still progress.",
        "Discipline turns intentions into results.",
        "The best way to learn is to build."
      ]);
    }

    /* 7. NEWS */

    if (
      /\b(news|headlines|latest news)\b/.test(t) ||
      t.includes("వార్తలు")
    ) {
      return await getNews();
    }

    /* 8. TRANSLATE */

    if (
      t.includes("translate") ||
      t.includes("అనువదించ") ||
      t.includes("ట్రాన్స్‌లేట్")
    ) {
      return await translateText(text);
    }

    /* 9. CURRENCY */

    if (
      /\b(currency|convert|exchange rate|forex)\b/.test(t) ||
      t.includes("కరెన్సీ") ||
      t.includes("కన్వర్ట్")
    ) {
      return await convertCurrency(text);
    }

    /* 10. MEANING */

    if (
      /\b(meaning|define|definition|dictionary)\b/.test(t) ||
      t.includes("meaning of") ||
      t.includes("అర్థం")
    ) {
      return await getMeaning(text);
    }

    /* 11. PASSWORD */

    if (
      t.includes("password") ||
      t.includes("generate password") ||
      t.includes("strong password") ||
      t.includes("పాస్‌వర్డ్")
    ) {
      const match = t.match(/\b(\d{2,3})\b/);

      const length = Math.max(
        8,
        Math.min(
          64,
          Number(match?.[1] || 16)
        )
      );

      return `Generated password: ${generatePassword(length)}`;
    }

    /* 12. SEARCH */

    if (
      t === "search" ||
      t.startsWith("search ") ||
      t.includes("search for ") ||
      t.includes("వెతుకు")
    ) {
      const q = text
        .replace(/^search\s*(for)?/i, "")
        .replace(/^వెతుకు/i, "")
        .trim();

      if (!q) {
        return "Tell me what you want me to search for.";
      }

      openURL(
        `https://www.google.com/search?q=${encodeURIComponent(q)}`
      );

      return `Searching the web for ${q}.`;
    }

    /* 13. OPEN APPS */

    if (
      t.includes("open youtube") ||
      t.includes("open google") ||
      t.includes("open gmail") ||
      t.includes("open whatsapp") ||
      t.includes("open instagram") ||
      t.includes("open facebook") ||
      t.includes("open maps") ||
      t.includes("open spotify") ||
      t.includes("open calculator") ||
      t.includes("open apps") ||
      t.includes("ఓపెన్")
    ) {
      return openAppCommand(t);
    }

    /* 14. PLAY SONGS / YOUTUBE */

    if (
      t.includes("play song") ||
      t.includes("play music") ||
      t.includes("youtube") ||
      t.startsWith("play ") ||
      t.includes("పాట")
    ) {
      const q = text
        .replace(/^(please\s+)?play\s+/i, "")
        .replace(/^youtube\s*/i, "")
        .replace(/^(search\s+)?youtube\s*(for)?/i, "")
        .trim();

      if (!q) {
        openURL("https://www.youtube.com/");
        return "Opening YouTube, Boss.";
      }

      openURL(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
      );

      return `Searching YouTube for ${q}.`;
    }

    /* 15. CRYPTO */

    if (
      /\b(crypto|bitcoin|btc|ethereum|eth|dogecoin|doge|solana|sol)\b/.test(t) ||
      t.includes("క్రిప్టో")
    ) {
      return await getCrypto(text);
    }

    return null;
  }

  async function getWeather() {
    try {
      const position = await new Promise(
        (resolve, reject) => {
          if (!navigator.geolocation) {
            reject(
              new Error("Geolocation unsupported")
            );
            return;
          }

          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: false,
              timeout: 8000,
              maximumAge: 300000
            }
          );
        }
      );

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      const data = await fetchJSON(
        `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`
      );

      const c = data.current || {};

      const temp = c.temperature_2m;
      const unit =
        data.current_units?.temperature_2m || "°C";

      return `Current temperature is ${temp ?? "unavailable"}${unit}, humidity ${c.relative_humidity_2m ?? "unavailable"}%, wind ${c.wind_speed_10m ?? "unavailable"} km/h.`;

    } catch (_) {
      try {
        const ip = await fetchJSON(
          "https://ipapi.co/json/",
          {},
          8000
        );

        if (ip.latitude && ip.longitude) {
          const data = await fetchJSON(
            `https://api.open-meteo.com/v1/forecast?latitude=${ip.latitude}&longitude=${ip.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto`
          );

          const c = data.current || {};

          return `Current temperature near ${
            ip.city || "your area"
          } is ${
            c.temperature_2m ?? "unavailable"
          }°C, humidity ${
            c.relative_humidity_2m ?? "unavailable"
          }%.`;
        }
      } catch (_) {}

      return "I couldn't get live weather right now. Please allow location access and try again.";
    }
  }

  async function getNews() {
    try {
      const rss =
        "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en";

      const d = await fetchJSON(
        `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rss)}`,
        {},
        12000
      );

      const items = Array.isArray(d.items)
        ? d.items.slice(0, 5)
        : [];

      if (!items.length) {
        throw new Error("No headlines");
      }

      items.forEach((item, index) => {
        const title = cleanText(item.title);

        if (title) {
          addMessage(
            `${index + 1}. ${title}`,
            "NEWS"
          );
        }
      });

      return "Here are the latest headlines I could retrieve.";

    } catch (_) {
      return "Live news is temporarily unavailable. I can still open Google News for the latest headlines.";
    }
  }

  async function translateText(original) {
    let q = original
      .replace(/^.*?\btranslate\b/i, "")
      .replace(/^.*?అనువదించ(?:ు|ండి)?/i, "")
      .replace(/^.*?ట్రాన్స్‌లేట్/i, "")
      .trim();

    q = q
      .replace(
        /^(this|it|to telugu|into telugu)\s*/i,
        ""
      )
      .trim();

    if (!q) {
      q = msg.value.trim() || "hello";
    }

    try {
      const url =
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=auto|te`;

      const d = await fetchJSON(
        url,
        {},
        12000
      );

      const translated =
        d?.responseData?.translatedText;

      if (translated) {
        return `In Telugu: ${translated}`;
      }
    } catch (_) {}

    return "Translation service is unavailable right now.";
  }

  async function convertCurrency(text) {
    const match = text.match(
      /(\d+(?:\.\d+)?)\s*([A-Za-z]{3})\s*(?:to|in|into)\s*([A-Za-z]{3})/i
    );

    if (!match) {
      return "Use a format such as: 100 USD to INR.";
    }

    const amount = Number(match[1]);
    const from = match[2].toUpperCase();
    const to = match[3].toUpperCase();

    try {
      const d = await fetchJSON(
        `https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`,
        {},
        12000
      );

      const rate = d?.rates?.[to];

      if (typeof rate !== "number") {
        throw new Error("Currency unavailable");
      }

      return `${amount} ${from} is approximately ${(amount * rate).toFixed(2)} ${to}.`;

    } catch (_) {
      return `I couldn't retrieve the live ${from} to ${to} exchange rate right now.`;
    }
  }

  async function getMeaning(text) {
    let word = text
      .replace(
        /^(what is the )?meaning (of)?/i,
        ""
      )
      .replace(/^define\s+/i, "")
      .replace(/^dictionary\s+/i, "")
      .trim()
      .split(/\s+/)[0]
      .replace(/[^\w'-]/g, "");

    if (!word) {
      return "Tell me the word you want defined.";
    }

    try {
      const d = await fetchJSON(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        {},
        10000
      );

      const meaning =
        d?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;

      if (meaning) {
        return `${word}: ${meaning}`;
      }

    } catch (_) {}

    return `I couldn't find a dictionary definition for "${word}".`;
  }

  function generatePassword(length) {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=";

    const values = new Uint32Array(length);

    if (window.crypto?.getRandomValues) {
      crypto.getRandomValues(values);

      return Array
        .from(
          values,
          n => chars[n % chars.length]
        )
        .join("");
    }

    let output = "";

    for (let i = 0; i < length; i++) {
      output += chars[
        Math.floor(
          Math.random() * chars.length
        )
      ];
    }

    return output;
  }

  function openAppCommand(t) {
    const apps = [
      ["youtube", "https://www.youtube.com/"],
      ["google", "https://www.google.com/"],
      ["gmail", "https://mail.google.com/"],
      ["whatsapp", "https://web.whatsapp.com/"],
      ["instagram", "https://www.instagram.com/"],
      ["facebook", "https://www.facebook.com/"],
      ["maps", "https://maps.google.com/"],
      ["spotify", "https://open.spotify.com/"],
      [
        "calculator",
        "https://www.google.com/search?q=calculator"
      ]
    ];

    for (const [name, url] of apps) {
      if (t.includes(name)) {
        openURL(url);
        return `Opening ${name}.`;
      }
    }

    return "Tell me which app you want to open.";
  }

  async function getCrypto(text) {
    const t = normalize(text);

    const known = {
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

    let id = Object.keys(known)
      .find(k => t.includes(k));

    id = id ? known[id] : "bitcoin";

    try {
      const d = await fetchJSON(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd,inr&include_24hr_change=true`,
        {},
        12000
      );

      const coin = d?.[id];

      if (!coin) {
        throw new Error("Coin unavailable");
      }

      const usd = coin.usd;
      const inr = coin.inr;
      const change = coin.usd_24h_change;

      return `${id} price: $${Number(usd).toLocaleString()} or ₹${Number(inr).toLocaleString()}${
        typeof change === "number"
          ? `, 24-hour change ${change.toFixed(2)}%`
          : ""
      }.`;

    } catch (_) {
      return "Live crypto data is temporarily unavailable. Please try again shortly.";
    }
  }

  function setupVoice() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition || !micBtn) {
      return;
    }

    recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      listening = true;

      micBtn.classList.add("listening");

      micBtn.setAttribute(
        "aria-label",
        "Stop voice input"
      );
    };

    recognition.onresult = (event) => {
      const result =
        event.results?.[0]?.[0]?.transcript || "";

      msg.value = result;
      msg.focus();

      runCommand();
    };

    recognition.onerror = () => {
      listening = false;

      micBtn.classList.remove("listening");

      micBtn.setAttribute(
        "aria-label",
        "Activate voice input"
      );
    };

    recognition.onend = () => {
      listening = false;

      micBtn.classList.remove("listening");

      micBtn.setAttribute(
        "aria-label",
        "Activate voice input"
      );
    };

    micBtn.addEventListener(
      "click",
      () => {
        try {
          if (listening) {
            recognition.stop();
          } else {
            recognition.start();
          }
        } catch (_) {}
      }
    );
  }

  function analyzeImage(file) {
    return new Promise((resolve, reject) => {
      if (
        !file ||
        !file.type.startsWith("image/")
      ) {
        reject(
          new Error("Please select an image file.")
        );
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        const dataURL = reader.result;
        const img = new Image();

        img.onload = async () => {
          lastImage = {
            file,
            dataURL,
            width: img.naturalWidth,
            height: img.naturalHeight
          };

          let ocrText = "";

          try {
            const form = new FormData();

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

            const d = await fetchJSON(
              "https://api.ocr.space/parse/image",
              {
                method: "POST",
                body: form
              },
              20000
            );

            ocrText = cleanText(
              (d?.ParsedResults || [])
                .map(
                  x => x.ParsedText || ""
                )
                .join(" ")
            );

          } catch (_) {}

          const sizeKB =
            Math.round(file.size / 1024);

          let result =
            `Image received: ${file.name}. Resolution ${img.naturalWidth}×${img.naturalHeight}, ${sizeKB} KB.`;

          if (ocrText) {
            result +=
              ` Detected text: ${ocrText.slice(0, 700)}`;
          } else {
            result +=
              " I could not extract readable text from this image.";
          }

          resolve(result);
        };

        img.onerror = () => {
          reject(
            new Error(
              "The selected image could not be read."
            )
          );
        };

        img.src = dataURL;
      };

      reader.onerror = () => {
        reject(
          new Error(
            "Could not read the image file."
          )
        );
      };

      reader.readAsDataURL(file);
    });
  }

  async function handleImageFile(file) {
    if (!file) return;

    addUserMessage(
      `Analyze image: ${file.name}`
    );

    setBusy(true);

    try {
      const result =
        await analyzeImage(file);

      reply(result);

    } catch (e) {
      reply(
        e.message ||
        "Image analysis failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function askAI(text) {
    const memory = getMemory();

    const context = [
      "You are J.A.R.V.I.S., a concise personal AI assistant.",
      "Answer clearly and helpfully. Do not claim to have performed actions you did not perform.",
      `Previous response: ${memory.lastResponse || "none"}`,
      `User: ${text}`
    ].join("\n");

    try {
      const response =
        await fetchWithTimeout(
          "https://text.pollinations.ai/openai",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              model: "openai",
              messages: [
                {
                  role: "user",
                  content: context
                }
              ],
              temperature: 0.4
            })
          },
          20000
        );

      if (!response.ok) {
        throw new Error(
          `AI HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      const answer =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        data?.output_text;

      if (answer) {
        return cleanText(answer);
      }

    } catch (_) {}

    return localAssistant(text);
  }

  function localAssistant(text) {
    const t = normalize(text);

    if (
      /^(hi|hello|hey|good morning|good evening)\b/.test(t)
    ) {
      return "Hello, Boss. Systems are ready.";
    }

    if (
      t.includes("who are you") ||
      t.includes("what are you")
    ) {
      return "I am J.A.R.V.I.S., your browser-based personal AI assistant.";
    }

    if (t.includes("thank")) {
      return "You're welcome, Boss.";
    }

    if (
      t.includes("help") ||
      t.includes("what can you do")
    ) {
      return "I can handle time, weather, timers, dice and coins, jokes, quotes, news, translation, currency, meanings, passwords, web search, apps, YouTube, crypto, voice input, image OCR, memory, and chat.";
    }

    return `I received: "${cleanText(text)}". My online AI service is unavailable right now, but my local tools are still operational.`;
  }

  async function runCommand() {
    const text = cleanText(msg.value);

    if (!text) return;

    addUserMessage(text);

    msg.value = "";

    setBusy(true);

    try {
      const toolResult =
        await handleTools(text);

      if (toolResult !== null) {
        reply(toolResult);
        return;
      }

      const aiResult =
        await askAI(text);

      reply(aiResult);

    } catch (_) {
      reply(
        "Command failed safely. Please try again."
      );

    } finally {
      setBusy(false);
      msg.focus();
    }
  }

  /* SEND */

  send.addEventListener(
    "click",
    runCommand
  );

  /* ENTER */

  msg.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        runCommand();
      }
    }
  );

  /* CLEAR MEMORY */

  if (clearBtn) {
    clearBtn.addEventListener(
      "click",
      clearMemory
    );
  }

  /* CAMERA / IMAGE */

  if (camBtn && imgInput) {
    camBtn.addEventListener(
      "click",
      () => imgInput.click()
    );
  }

  if (imgInput) {
    imgInput.addEventListener(
      "change",
      () => {
        const file =
          imgInput.files?.[0];

        if (file) {
          handleImageFile(file);
        }

        imgInput.value = "";
      }
    );
  }

  /* VOICE */

  setupVoice();

  /* VISIBILITY */

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        msg.focus();
      }
    }
  );

  /* PREVENT ACCIDENTAL FORM SUBMIT */

  document.addEventListener(
    "submit",
    (event) => {
      if (
        event.target?.contains?.(msg)
      ) {
        event.preventDefault();
      }
    }
  );

  /* GLOBAL TEST FUNCTIONS */

  window.handleTools = handleTools;
  window.jarvisRun = runCommand;
  window.jarvisSpeak = speak;

  if (micBtn && !recognition) {
    micBtn.setAttribute(
      "title",
      (
        window.SpeechRecognition ||
        window.webkitSpeechRecognition
      )
        ? "Activate voice input"
        : "Voice input is not supported by this browser"
    );
  }
})();
```0
