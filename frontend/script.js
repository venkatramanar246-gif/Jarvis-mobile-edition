 /* =========================================================
   J.A.R.V.I.S. - AI AGENT ENGINE
   Works with the existing HTML IDs/classes.
   ========================================================= */

(() => {
  "use strict";

  /* -----------------------------
     DOM
  ----------------------------- */

  const $ = (id) => document.getElementById(id);

  const chat = $("chat");
  const msg = $("msg");
  const send = $("send");
  const micBtn = $("mic-btn");
  const camBtn = $("cam-btn");
  const clearBtn = $("clear-btn");
  const imgInput = $("img-input");

  if (!chat || !msg || !send) {
    console.error("JARVIS: Required HTML elements are missing.");
    return;
  }

  /* -----------------------------
     Configuration
  ----------------------------- */

  const CONFIG = {
    assistantName: "J.A.R.V.I.S.",
    memoryKey: "jarvis_memory_v1",
    historyKey: "jarvis_history_v1",
    maxHistory: 60,
    maxMemory: 100,

    // Optional AI backend.
    // Leave empty for browser/local agent mode.
    AI_API_URL: "",

    // Optional API key if your own backend requires one.
    // Do NOT put a private OpenAI key directly in public frontend code.
    AI_API_KEY: ""
  };

  /* -----------------------------
     State
  ----------------------------- */

  const state = {
    busy: false,
    listening: false,
    recognition: null,
    timer: null,
    timers: [],
    memory: loadJSON(CONFIG.memoryKey, []),
    history: loadJSON(CONFIG.historyKey, []),
    lastImage: null,
    commandQueue: [],
    currentPlan: null
  };

  /* -----------------------------
     Utility
  ----------------------------- */

  function loadJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("Storage error:", error);
    }
  }

  function normalize(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function escapeHTML(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function now() {
    return new Date();
  }

  function formatTime(date = new Date()) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function formatDate(date = new Date()) {
    return date.toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function addHistory(role, content) {
    state.history.push({
      role,
      content,
      time: Date.now()
    });

    if (state.history.length > CONFIG.maxHistory) {
      state.history = state.history.slice(-CONFIG.maxHistory);
    }

    saveJSON(CONFIG.historyKey, state.history);
  }

  function remember(text, type = "note") {
    const item = {
      id: Date.now(),
      type,
      text: String(text),
      time: Date.now()
    };

    state.memory.push(item);

    if (state.memory.length > CONFIG.maxMemory) {
      state.memory = state.memory.slice(-CONFIG.maxMemory);
    }

    saveJSON(CONFIG.memoryKey, state.memory);
    return item;
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(
        String(text).replace(/[*#`]/g, "")
      );

      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voices = speechSynthesis.getVoices();
      const preferred =
        voices.find(v => /en-IN/i.test(v.lang)) ||
        voices.find(v => /en-US/i.test(v.lang)) ||
        voices.find(v => /en/i.test(v.lang));

      if (preferred) utterance.voice = preferred;

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn("Speech error:", error);
    }
  }

  function addMessage(text, type = "assistant", options = {}) {
    const wrapper = document.createElement("div");

    wrapper.className = `jarvis-message ${type}`;

    const time = document.createElement("small");
    time.className = "jarvis-message-time";
    time.textContent = options.time || formatTime();

    const body = document.createElement("div");
    body.className = "jarvis-message-body";

    if (options.html) {
      body.innerHTML = text;
    } else {
      body.textContent = text;
    }

    wrapper.appendChild(body);
    wrapper.appendChild(time);

    chat.appendChild(wrapper);

    chat.scrollTop = chat.scrollHeight;

    if (type === "user") {
      addHistory("user", text);
    } else if (type === "assistant") {
      addHistory("assistant", text);
    }

    return wrapper;
  }

  function status(text) {
    const coreText = document.querySelector(".core-text");
    if (coreText) coreText.textContent = text;
  }

  function setBusy(value) {
    state.busy = value;

    if (send) {
      send.disabled = value;
      send.textContent = value ? "WORKING..." : "EXECUTE";
    }

    status(value ? "AGENT WORKING..." : "SYSTEM READY");
  }

  /* -----------------------------
     Initialization
  ----------------------------- */

  function init() {
    setupRecognition();
    setupEvents();
    setupLiveClock();
    setupDiagnostics();
    restoreChat();

    setTimeout(() => {
      if (!state.history.length) {
        addMessage(
          "J.A.R.V.I.S. online. Give me a goal or command.",
          "assistant"
        );
      }
    }, 150);

    console.log("J.A.R.V.I.S. Agent initialized.");
  }

  function restoreChat() {
    const recent = state.history.slice(-20);

    for (const item of recent) {
      const wrapper = document.createElement("div");
      wrapper.className = `jarvis-message ${
        item.role === "user" ? "user" : "assistant"
      }`;

      const body = document.createElement("div");
      body.className = "jarvis-message-body";
      body.textContent = item.content;

      const time = document.createElement("small");
      time.className = "jarvis-message-time";
      time.textContent = new Date(item.time).toLocaleTimeString();

      wrapper.appendChild(body);
      wrapper.appendChild(time);
      chat.appendChild(wrapper);
    }

    chat.scrollTop = chat.scrollHeight;
  }

  /* -----------------------------
     Events
  ----------------------------- */

  function setupEvents() {
    send.addEventListener("click", executeInput);

    msg.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        executeInput();
      }
    });

    if (micBtn) {
      micBtn.addEventListener("click", toggleVoiceInput);
    }

    if (camBtn) {
      camBtn.addEventListener("click", () => {
        if (imgInput) imgInput.click();
      });
    }

    if (imgInput) {
      imgInput.addEventListener("change", handleImage);
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", clearMemory);
    }
  }

  /* -----------------------------
     Live Clock
  ----------------------------- */

  function setupLiveClock() {
    setInterval(() => {
      const el = document.querySelector(".core-text");

      if (!el || state.busy) return;

      // Keep system status instead of overwriting it.
      // Current live time is available through the time tool.
    }, 1000);
  }

  /* -----------------------------
     Diagnostics
  ----------------------------- */

  function setupDiagnostics() {
    const rows = document.querySelectorAll(".status .row");

    rows.forEach(row => {
      const label = normalize(row.querySelector("span")?.textContent);

      const indicator = row.querySelector("b");

      if (!indicator) return;

      if (
        label.includes("ai engine") ||
        label.includes("connection") ||
        label.includes("voice interface") ||
        label.includes("long-term memory")
      ) {
        indicator.classList.add("on");
      }
    });
  }

  /* -----------------------------
     Main Execute
  ----------------------------- */

  async function executeInput() {
    if (state.busy) return;

    const input = msg.value.trim();

    if (!input) return;

    msg.value = "";

    addMessage(input, "user");

    setBusy(true);

    try {
      const result = await runAgent(input);

      if (result !== undefined && result !== null && result !== "") {
        addMessage(result, "assistant");

        if (result.length < 500) {
          speak(result);
        }
      }
    } catch (error) {
      console.error(error);

      addMessage(
        "I encountered an error while executing that goal. Please try again.",
        "assistant"
      );
    } finally {
      setBusy(false);
      msg.focus();
    }
  }

  /* =========================================================
     AGENT
     ========================================================= */

  async function runAgent(goal) {
    const cleanGoal = goal.trim();

    // First try an explicitly recognized multi-step goal.
    const plan = createPlan(cleanGoal);

    state.currentPlan = plan;

    if (plan && plan.steps.length) {
      return await executePlan(plan);
    }

    // Optional external AI backend.
    if (CONFIG.AI_API_URL) {
      const aiResult = await callAIBackend(cleanGoal);

      if (aiResult) return aiResult;
    }

    // General local chat fallback.
    return await localAssistant(cleanGoal);
  }

  /* -----------------------------
     Planner
  ----------------------------- */

  function createPlan(goal) {
    const text = normalize(goal);

    const steps = [];

    // "Tell me time and weather"
    if (
      (text.includes("time") || text.includes("clock")) &&
      (
        text.includes("weather") ||
        text.includes("temperature")
      )
    ) {
      steps.push({
        tool: "time",
        args: {}
      });

      steps.push({
        tool: "weather",
        args: extractLocation(goal)
      });

      return {
        goal,
        steps,
        mode: "multi"
      };
    }

    // "Search X and open it"
    if (
      (text.includes("search") || text.includes("find")) &&
      (
        text.includes("open") ||
        text.includes("website")
      )
    ) {
      const query = extractAfterKeywords(
        goal,
        ["search", "find", "look up"]
      );

      if (query) {
        steps.push({
          tool: "search",
          args: { query }
        });

        return {
          goal,
          steps,
          mode: "multi"
        };
      }
    }

    // "Remember X"
    if (
      text.startsWith("remember ") ||
      text.startsWith("memorize ") ||
      text.includes("remember that ")
    ) {
      steps.push({
        tool: "memory_save",
        args: { text: goal }
      });

      return {
        goal,
        steps,
        mode: "single"
      };
    }

    // Explicit tool command.
    const directTool = detectTool(text);

    if (directTool) {
      steps.push({
        tool: directTool,
        args: extractToolArgs(directTool, goal)
      });

      return {
        goal,
        steps,
        mode: "single"
      };
    }

    return null;
  }

  function detectTool(text) {
    if (
      text === "time" ||
      text.includes("what time") ||
      text.includes("current time") ||
      text.includes("live time") ||
      text.includes("clock")
    ) {
      return "time";
    }

    if (
      text.includes("weather") ||
      text.includes("temperature")
    ) {
      return "weather";
    }

    if (
      text.includes("timer") ||
      text.includes("countdown")
    ) {
      return "timer";
    }

    if (
      text.includes("roll dice") ||
      text.includes("dice") ||
      text.includes("coin")
    ) {
      return "dice";
    }

    if (
      text.includes("joke") ||
      text.includes("make me laugh")
    ) {
      return "joke";
    }

    if (
      text.includes("quote") ||
      text.includes("motivation")
    ) {
      return "quote";
    }

    if (
      text.includes("news") ||
      text.includes("headlines")
    ) {
      return "news";
    }

    if (
      text.includes("translate") ||
      text.includes("translation")
    ) {
      return "translate";
    }

    if (
      text.includes("currency") ||
      text.includes("exchange rate") ||
      text.includes("convert")
    ) {
      return "currency";
    }

    if (
      text.includes("meaning of") ||
      text.includes("define ") ||
      text.includes("definition")
    ) {
      return "meaning";
    }

    if (
      text.includes("password") ||
      text.includes("generate password")
    ) {
      return "password";
    }

    if (
      text.startsWith("search ") ||
      text.includes("search for ")
    ) {
      return "search";
    }

    if (
      text.startsWith("open ") ||
      text.includes("open youtube") ||
      text.includes("open google") ||
      text.includes("open gmail")
    ) {
      return "open";
    }

    if (
      text.includes("play song") ||
      text.includes("play music") ||
      text.startsWith("play ")
    ) {
      return "play";
    }

    if (
      text.includes("crypto") ||
      text.includes("bitcoin") ||
      text.includes("ethereum")
    ) {
      return "crypto";
    }

    if (
      text.includes("clear memory") ||
      text.includes("forget everything") ||
      text.includes("delete memory")
    ) {
      return "memory_clear";
    }

    return null;
  }

  function extractToolArgs(tool, goal) {
    switch (tool) {
      case "weather":
        return extractLocation(goal);

      case "timer":
        return {
          seconds: parseDuration(goal)
        };

      case "translate":
        return extractTranslation(goal);

      case "currency":
        return extractCurrency(goal);

      case "meaning":
        return {
          word: extractMeaningWord(goal)
        };

      case "password":
        return {
          length: extractNumber(goal) || 16
        };

      case "search":
        return {
          query: extractAfterKeywords(
            goal,
            ["search", "search for", "find", "look up"]
          )
        };

      case "open":
        return {
          target: goal.replace(/^.*?\bopen\b/i, "").trim()
        };

      case "play":
        return {
          query: goal
            .replace(/^.*?\bplay\b/i, "")
            .replace(/\bmusic\b/i, "")
            .replace(/\bsong\b/i, "")
            .trim()
        };

      case "crypto":
        return {
          coin: detectCoin(goal)
        };

      default:
        return {};
    }
  }

  /* -----------------------------
     Plan Execution
  ----------------------------- */

  async function executePlan(plan) {
    const results = [];

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      status(
        `EXECUTING ${i + 1}/${plan.steps.length}: ${step.tool.toUpperCase()}`
      );

      try {
        const result = await executeTool(
          step.tool,
          step.args || {}
        );

        results.push({
          tool: step.tool,
          result
        });
      } catch (error) {
        results.push({
          tool: step.tool,
          result: `Tool failed: ${error.message}`
        });
      }

      await sleep(80);
    }

    status("SYSTEM READY");

    return formatPlanResult(plan, results);
  }

  function formatPlanResult(plan, results) {
    if (results.length === 1) {
      return results[0].result;
    }

    return results
      .map((item, index) => {
        return `${index + 1}. ${item.result}`;
      })
      .join("\n");
  }

  /* -----------------------------
     Tool Router
  ----------------------------- */

  async function executeTool(tool, args) {
    switch (tool) {
      case "time":
        return toolTime();

      case "weather":
        return await toolWeather(args);

      case "timer":
        return toolTimer(args);

      case "dice":
        return toolDice(args);

      case "joke":
        return await toolJoke();

      case "quote":
        return await toolQuote();

      case "news":
        return await toolNews();

      case "translate":
        return await toolTranslate(args);

      case "currency":
        return await toolCurrency(args);

      case "meaning":
        return await toolMeaning(args);

      case "password":
        return toolPassword(args);

      case "search":
        return toolSearch(args);

      case "open":
        return toolOpen(args);

      case "play":
        return toolPlay(args);

      case "crypto":
        return await toolCrypto(args);

      case "memory_save":
        return toolMemorySave(args);

      case "memory_clear":
        return toolMemoryClear();

      default:
        return "I don't have a tool for that command yet.";
    }
  }

  /* -----------------------------
     TIME TOOL
  ----------------------------- */

  function toolTime() {
    const d = new Date();

    return (
      `Current local time: ${formatTime(d)}\n` +
      `Date: ${formatDate(d)}`
    );
  }

  /* -----------------------------
     TIMER TOOL
  ----------------------------- */

  function toolTimer(args) {
    let seconds = Number(args.seconds);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      seconds = 60;
    }

    seconds = Math.min(seconds, 86400);

    const timerId = Date.now();

    const timer = {
      id: timerId,
      remaining: Math.floor(seconds),
      started: Date.now()
    };

    state.timers.push(timer);

    const interval = setInterval(() => {
      timer.remaining--;

      if (timer.remaining <= 0) {
        clearInterval(interval);

        state.timers = state.timers.filter(
          t => t.id !== timerId
        );

        notifyUser("J.A.R.V.I.S. Timer", "Timer finished.");

        addMessage(
          "⏰ Timer finished.",
          "assistant"
        );

        speak("Timer finished.");
      }
    }, 1000);

    const readable = formatDuration(seconds);

    return `Timer started for ${readable}.`;
  }

  function formatDuration(seconds) {
    seconds = Math.max(0, Math.floor(seconds));

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const parts = [];

    if (h) parts.push(`${h} hour${h !== 1 ? "s" : ""}`);
    if (m) parts.push(`${m} minute${m !== 1 ? "s" : ""}`);
    if (s || !parts.length) {
      parts.push(`${s} second${s !== 1 ? "s" : ""}`);
    }

    return parts.join(" ");
  }

  /* -----------------------------
     DICE / COIN
  ----------------------------- */

  function toolDice(args) {
    const text = normalize(args.text || "");

    if (text.includes("coin")) {
      return Math.random() < 0.5
        ? "🪙 Coin flip: HEADS"
        : "🪙 Coin flip: TAILS";
    }

    const roll = Math.floor(Math.random() * 6) + 1;

    return `🎲 Dice roll: ${roll}`;
  }

  /* -----------------------------
     MEMORY
  ----------------------------- */

  function toolMemorySave(args) {
    const original = String(args.text || "").trim();

    const cleaned = original
      .replace(/^remember that/i, "")
      .replace(/^remember/i, "")
      .replace(/^memorize/i, "")
      .trim();

    if (!cleaned) {
      return "Tell me what you want me to remember.";
    }

    remember(cleaned, "user-note");

    return `Memory saved: ${cleaned}`;
  }

  function toolMemoryClear() {
    state.memory = [];
    saveJSON(CONFIG.memoryKey, []);

    return "Long-term memory has been cleared.";
  }

  function clearMemory() {
    const confirmed = window.confirm(
      "Clear J.A.R.V.I.S. long-term memory?"
    );

    if (!confirmed) return;

    const result = toolMemoryClear();

    addMessage(result, "assistant");
    speak(result);
  }

  /* -----------------------------
     SEARCH
  ----------------------------- */

  function toolSearch(args) {
    const query = String(args.query || "").trim();

    if (!query) {
      return "Tell me what you want me to search for.";
    }

    const url =
      "https://www.google.com/search?q=" +
      encodeURIComponent(query);

    window.open(url, "_blank", "noopener,noreferrer");

    return `Searching Google for: ${query}`;
  }

  /* -----------------------------
     OPEN
  ----------------------------- */

  function toolOpen(args) {
    const target = normalize(args.target);

    const sites = {
      google: "https://www.google.com",
      youtube: "https://www.youtube.com",
      gmail: "https://mail.google.com",
      maps: "https://maps.google.com",
      github: "https://github.com",
      facebook: "https://www.facebook.com",
      instagram: "https://www.instagram.com",
      whatsapp: "https://web.whatsapp.com",
      wikipedia: "https://www.wikipedia.org",
      chatgpt: "https://chatgpt.com"
    };

    let url = sites[target];

    if (!url) {
      const match = Object.keys(sites).find(
        key => target.includes(key)
      );

      if (match) {
        url = sites[match];
      }
    }

    if (!url) {
      if (/^https?:\/\//i.test(target)) {
        url = target;
      } else if (
        /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(target)
      ) {
        url = "https://" + target;
      }
    }

    if (!url) {
      return `I couldn't identify the website "${target}".`;
    }

    window.open(url, "_blank", "noopener,noreferrer");

    return `Opening ${target}.`;
  }

  /* -----------------------------
     PLAY MUSIC
  ----------------------------- */

  function toolPlay(args) {
    const query = String(args.query || "").trim();

    if (!query) {
      return "Tell me the song or artist you want to play.";
    }

    const url =
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(query);

    window.open(url, "_blank", "noopener,noreferrer");

    return `Opening YouTube results for "${query}".`;
  }

  /* -----------------------------
     PASSWORD
  ----------------------------- */

  function toolPassword(args) {
    let length = Number(args.length) || 16;

    length = Math.max(8, Math.min(length, 128));

    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
      "abcdefghijklmnopqrstuvwxyz" +
      "0123456789" +
      "!@#$%^&*()-_=+[]{};:,.?";

    const values = new Uint32Array(length);

    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(values);
    } else {
      for (let i = 0; i < values.length; i++) {
        values[i] = Math.floor(Math.random() * 4294967295);
      }
    }

    let password = "";

    for (const value of values) {
      password += chars[value % chars.length];
    }

    return `Generated password:\n${password}`;
  }

  /* -----------------------------
     NOTIFICATIONS
  ----------------------------- */

  function notifyUser(title, body) {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      new Notification(title, { body });
      return;
    }

    if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification(title, { body });
        }
      });
    }
  }

  /* -----------------------------
     HELPERS
  ----------------------------- */

  function extractAfterKeywords(text, keywords) {
    const lower = normalize(text);

    for (const keyword of keywords) {
      const index = lower.indexOf(keyword);

      if (index !== -1) {
        return text
          .slice(index + keyword.length)
          .trim()
          .replace(/^for\s+/i, "");
      }
    }

    return "";
  }

  function extractNumber(text) {
    const match = String(text).match(/\b(\d+)\b/);
    return match ? Number(match[1]) : null;
  }

  function parseDuration(text) {
    const input = normalize(text);

    let total = 0;

    const hours = input.match(/(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs)/);
    const minutes = input.match(/(\d+(?:\.\d+)?)\s*(minute|minutes|min|mins)/);
    const seconds = input.match(/(\d+(?:\.\d+)?)\s*(second|seconds|sec|secs)/);

    if (hours) total += Number(hours[1]) * 3600;
    if (minutes) total += Number(minutes[1]) * 60;
    if (seconds) total += Number(seconds[1]);

    if (!total) {
      const number = extractNumber(input);
      if (number) total = number;
    }

    return total || 60;
  }

  function extractLocation(text) {
    const match = String(text).match(
      /\b(?:in|at|for|near)\s+([a-zA-Z][a-zA-Z .'-]{1,50})/i
    );

    if (match) {
      return {
        location: match[1]
          .replace(/\b(right now|today|please)\b/gi, "")
          .trim()
      };
    }

    return {
      location: ""
    };
  }

  function extractMeaningWord(text) {
    const match = String(text).match(
      /(?:meaning of|define|definition of)\s+([a-zA-Z'-]+)/i
    );

    return match ? match[1] : "";
  }

  function detectCoin(text) {
    const lower = normalize(text);

    if (lower.includes("ethereum") || lower.includes("eth")) {
      return "ethereum";
    }

    if (
      lower.includes("bitcoin") ||
      lower.includes("btc")
    ) {
      return "bitcoin";
    }

    return "bitcoin";
  }

  function extractTranslation(text) {
    const match = String(text).match(
      /translate\s+(.+?)\s+(?:to|into)\s+([a-zA-Z-]+)/i
    );

    if (!match) {
      return {
        text: "",
        target: "en"
      };
    }

    return {
      text: match[1].trim(),
      target: languageCode(match[2])
    };
  }

  function languageCode(language) {
    const map = {
      english: "en",
      hindi: "hi",
      telugu: "te",
      tamil: "ta",
      kannada: "kn",
      malayalam: "ml",
      spanish: "es",
      french: "fr",
      german: "de",
      italian: "it",
      japanese: "ja",
      korean: "ko",
      chinese: "zh",
      arabic: "ar",
      russian: "ru"
    };

    return map[normalize(language)] || normalize(language);
  }

  function extractCurrency(text) {
    const match = String(text).match(
      /(\d+(?:\.\d+)?)\s*([A-Z]{3})\s*(?:to|in)\s*([A-Z]{3})/i
    );

    if (!match) {
      return {
        amount: 1,
        from: "USD",
        to: "INR"
      };
    }

    return {
      amount: Number(match[1]),
      from: match[2].toUpperCase(),
      to: match[3].toUpperCase()
    };
}
   /* =========================================================
     J.A.R.V.I.S. - PART 2
     LIVE WEB TOOLS + VOICE + IMAGE ANALYSIS
     ========================================================= */

  /* -----------------------------
     WEATHER
     Open-Meteo:
     Geocoding -> Weather
  ----------------------------- */

  async function toolWeather(args = {}) {
    let location = String(args.location || "").trim();

    if (!location) {
      location = "Tirupati";
    }

    try {
      const geoURL =
        "https://geocoding-api.open-meteo.com/v1/search?name=" +
        encodeURIComponent(location) +
        "&count=1&language=en&format=json";

      const geoResponse = await fetch(geoURL);

      if (!geoResponse.ok) {
        throw new Error("Location lookup failed");
      }

      const geo = await geoResponse.json();

      if (!geo.results || !geo.results.length) {
        return `I couldn't find the location "${location}".`;
      }

      const place = geo.results[0];

      const weatherURL =
        "https://api.open-meteo.com/v1/forecast?" +
        "latitude=" + encodeURIComponent(place.latitude) +
        "&longitude=" + encodeURIComponent(place.longitude) +
        "&current=temperature_2m,relative_humidity_2m," +
        "apparent_temperature,weather_code,wind_speed_10m" +
        "&timezone=auto";

      const weatherResponse = await fetch(weatherURL);

      if (!weatherResponse.ok) {
        throw new Error("Weather request failed");
      }

      const data = await weatherResponse.json();
      const current = data.current;

      const description =
        weatherCodeToText(current.weather_code);

      return [
        `🌤️ Weather for ${place.name}${place.country ? ", " + place.country : ""}`,
        `Temperature: ${current.temperature_2m}°C`,
        `Feels like: ${current.apparent_temperature}°C`,
        `Condition: ${description}`,
        `Humidity: ${current.relative_humidity_2m}%`,
        `Wind: ${current.wind_speed_10m} km/h`,
        `Updated: ${current.time}`
      ].join("\n");

    } catch (error) {
      console.error("Weather:", error);

      return (
        `I couldn't retrieve live weather for "${location}" right now.`
      );
    }
  }

  function weatherCodeToText(code) {
    const map = {
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Fog",
      48: "Depositing rime fog",
      51: "Light drizzle",
      53: "Moderate drizzle",
      55: "Dense drizzle",
      56: "Light freezing drizzle",
      57: "Dense freezing drizzle",
      61: "Slight rain",
      63: "Moderate rain",
      65: "Heavy rain",
      66: "Light freezing rain",
      67: "Heavy freezing rain",
      71: "Slight snow",
      73: "Moderate snow",
      75: "Heavy snow",
      77: "Snow grains",
      80: "Slight rain showers",
      81: "Moderate rain showers",
      82: "Violent rain showers",
      85: "Slight snow showers",
      86: "Heavy snow showers",
      95: "Thunderstorm",
      96: "Thunderstorm with slight hail",
      99: "Thunderstorm with heavy hail"
    };

    return map[code] || "Unknown weather condition";
  }


  /* -----------------------------
     JOKE
  ----------------------------- */

  async function toolJoke() {
    try {
      const response = await fetch(
        "https://official-joke-api.appspot.com/random_joke"
      );

      if (!response.ok) {
        throw new Error("Joke API failed");
      }

      const data = await response.json();

      return `😂 ${data.setup}\n${data.punchline}`;

    } catch {
      const jokes = [
        "Why did the computer get cold? Because it left its Windows open.",
        "Why do programmers prefer dark mode? Because light attracts bugs.",
        "I told my computer I needed a break. Now it won't stop sending me KitKat ads."
      ];

      return "😂 " + jokes[
        Math.floor(Math.random() * jokes.length)
      ];
    }
  }


  /* -----------------------------
     QUOTE
  ----------------------------- */

  async function toolQuote() {
    try {
      const response = await fetch(
        "https://dummyjson.com/quotes/random"
      );

      if (!response.ok) {
        throw new Error("Quote API failed");
      }

      const data = await response.json();

      return `“${data.quote}” — ${data.author}`;

    } catch {
      const quotes = [
        "The secret of getting ahead is getting started.",
        "Success is the sum of small efforts repeated day after day.",
        "Great things are done by a series of small things brought together."
      ];

      return "“" +
        quotes[Math.floor(Math.random() * quotes.length)] +
        "”";
    }
  }


  /* -----------------------------
     NEWS
     Browser-safe news launcher.
     ----------------------------- */

  async function toolNews() {
    const url =
      "https://news.google.com/";

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );

    return "📰 Opening the latest Google News headlines.";
  }


  /* -----------------------------
     TRANSLATION
     MyMemory public endpoint.
  ----------------------------- */

  async function toolTranslate(args = {}) {
    const text = String(args.text || "").trim();
    const target = String(args.target || "en").trim();

    if (!text) {
      return (
        "Translation format: translate hello to Telugu"
      );
    }

    try {
      const url =
        "https://api.mymemory.translated.net/get?q=" +
        encodeURIComponent(text) +
        "&langpair=auto|" +
        encodeURIComponent(target);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Translation request failed");
      }

      const data = await response.json();

      const translated =
        data?.responseData?.translatedText;

      if (!translated) {
        throw new Error("No translation returned");
      }

      return [
        `Original: ${text}`,
        `Translation: ${translated}`,
        `Language: ${target}`
      ].join("\n");

    } catch (error) {
      console.error("Translation:", error);

      return (
        "Translation service is unavailable right now."
      );
    }
  }


  /* -----------------------------
     CURRENCY
     ----------------------------- */

  async function toolCurrency(args = {}) {
    const amount = Number(args.amount) || 1;

    const from =
      String(args.from || "USD").toUpperCase();

    const to =
      String(args.to || "INR").toUpperCase();

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
        throw new Error("Currency API failed");
      }

      const data = await response.json();

      const converted = data?.rates?.[to];

      if (converted === undefined) {
        throw new Error("Currency not supported");
      }

      return [
        `💱 ${amount} ${from} = ${converted} ${to}`,
        `Rate date: ${data.date}`
      ].join("\n");

    } catch (error) {
      console.error("Currency:", error);

      return (
        `I couldn't get the current ${from} to ${to} exchange rate.`
      );
    }
  }


  /* -----------------------------
     MEANING / DICTIONARY
  ----------------------------- */

  async function toolMeaning(args = {}) {
    const word = String(args.word || "").trim();

    if (!word) {
      return "Tell me the word you want defined.";
    }

    try {
      const url =
        "https://api.dictionaryapi.dev/api/v2/entries/en/" +
        encodeURIComponent(word);

      const response = await fetch(url);

      if (!response.ok) {
        return `I couldn't find an English definition for "${word}".`;
      }

      const data = await response.json();

      const entry = data[0];

      const meanings = entry?.meanings || [];

      if (!meanings.length) {
        return `No definition found for "${word}".`;
      }

      const output = [];

      output.push(`📖 ${word}`);

      for (const meaning of meanings.slice(0, 3)) {
        const part =
          meaning.partOfSpeech
            ? ` (${meaning.partOfSpeech})`
            : "";

        output.push(part ? part : "");

        const definitions =
          meaning.definitions || [];

        definitions.slice(0, 2).forEach((definition, index) => {
          output.push(
            `${index + 1}. ${definition.definition}`
          );
        });
      }

      return output
        .filter(Boolean)
        .join("\n");

    } catch (error) {
      console.error("Dictionary:", error);

      return (
        `I couldn't retrieve the meaning of "${word}".`
      );
    }
  }


  /* -----------------------------
     CRYPTO
     CoinGecko public API
  ----------------------------- */

  async function toolCrypto(args = {}) {
    const coin =
      normalize(args.coin || "bitcoin");

    let id = "bitcoin";

    if (
      coin.includes("ethereum") ||
      coin === "eth"
    ) {
      id = "ethereum";
    } else if (
      coin.includes("dogecoin") ||
      coin === "doge"
    ) {
      id = "dogecoin";
    } else if (
      coin.includes("solana") ||
      coin === "sol"
    ) {
      id = "solana";
    } else if (
      coin.includes("xrp")
    ) {
      id = "ripple";
    }

    try {
      const url =
        "https://api.coingecko.com/api/v3/simple/price" +
        "?ids=" +
        encodeURIComponent(id) +
        "&vs_currencies=usd,inr" +
        "&include_24hr_change=true";

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Crypto API failed");
      }

      const data = await response.json();

      const item = data[id];

      if (!item) {
        throw new Error("Coin not found");
      }

      const usd = item.usd;
      const inr = item.inr;
      const change = item.usd_24h_change;

      return [
        `₿ ${id.toUpperCase()}`,
        `USD: $${formatNumber(usd)}`,
        `INR: ₹${formatNumber(inr)}`,
        `24h: ${formatNumber(change)}%`
      ].join("\n");

    } catch (error) {
      console.error("Crypto:", error);

      return (
        "I couldn't retrieve the current crypto price."
      );
    }
  }


  function formatNumber(value) {
    if (value === undefined || value === null) {
      return "N/A";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "N/A";
    }

    return number.toLocaleString(
      undefined,
      {
        maximumFractionDigits: 4
      }
    );
  }


  /* =========================================================
     VOICE INPUT
     ========================================================= */

  function setupRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      state.recognition = null;

      if (micBtn) {
        micBtn.title =
          "Speech recognition is not supported in this browser";
      }

      return;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      state.listening = true;

      if (micBtn) {
        micBtn.classList.add("active");
        micBtn.textContent = "🔴";
      }

      status("LISTENING...");
    };

    recognition.onresult = event => {
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

      const currentText =
        finalText || interimText;

      if (currentText) {
        msg.value = currentText;
      }
    };

    recognition.onerror = event => {
      console.warn(
        "Speech recognition:",
        event.error
      );

      state.listening = false;

      if (event.error === "not-allowed") {
        addMessage(
          "Microphone permission was denied. Please allow microphone access.",
          "assistant"
        );
      }
    };

    recognition.onend = () => {
      state.listening = false;

      if (micBtn) {
        micBtn.classList.remove("active");
        micBtn.textContent = "🎙️";
      }

      if (!state.busy) {
        status("SYSTEM READY");
      }
    };

    state.recognition = recognition;
  }


  function toggleVoiceInput() {
    if (!state.recognition) {
      addMessage(
        "Voice input is not supported by this browser. Try Chrome or another browser with Web Speech API support.",
        "assistant"
      );

      return;
    }

    if (state.listening) {
      try {
        state.recognition.stop();
      } catch {}
      return;
    }

    try {
      state.recognition.start();
    } catch (error) {
      console.warn(error);

      try {
        state.recognition.stop();
      } catch {}
    }
  }


  /* =========================================================
     IMAGE ANALYSIS
     Browser-side image inspection.
     ========================================================= */

  function handleImage(event) {
    const file =
      event.target.files &&
      event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addMessage(
        "Please select a valid image file.",
        "assistant"
      );

      return;
    }

    const maxSize =
      15 * 1024 * 1024;

    if (file.size > maxSize) {
      addMessage(
        "Image is too large. Please choose an image under 15 MB.",
        "assistant"
      );

      return;
    }

    state.lastImage = file;

    const reader = new FileReader();

    reader.onload = () => {
      analyzeImage(
        file,
        reader.result
      );
    };

    reader.onerror = () => {
      addMessage(
        "I couldn't read that image.",
        "assistant"
      );
    };

    reader.readAsDataURL(file);

    // Allow selecting the same image again.
    event.target.value = "";
  }


  async function analyzeImage(file, dataURL) {
    status("ANALYZING IMAGE...");

    addMessage(
      `📷 Image selected: ${file.name}`,
      "user"
    );

    try {
      const image = await loadImage(dataURL);

      const analysis = inspectImage(
        image,
        file
      );

      addImagePreview(
        dataURL,
        analysis
      );

      addMessage(
        analysis.text,
        "assistant"
      );

      speak(
        "Image analysis complete."
      );

    } catch (error) {
      console.error("Image analysis:", error);

      addMessage(
        "I couldn't analyze this image.",
        "assistant"
      );

    } finally {
      status("SYSTEM READY");
    }
  }


  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = reject;

      image.src = src;
    });
  }


  function inspectImage(image, file) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    const ratio =
      width && height
        ? (width / height).toFixed(2)
        : "N/A";

    let orientation = "square";

    if (width > height) {
      orientation = "landscape";
    } else if (height > width) {
      orientation = "portrait";
    }

    const sizeKB =
      Math.round(file.size / 1024);

    const megapixels =
      ((width * height) / 1000000).toFixed(2);

    const text = [
      "📷 IMAGE ANALYSIS",
      `File: ${file.name}`,
      `Type: ${file.type}`,
      `Size: ${sizeKB} KB`,
      `Dimensions: ${width} × ${height}`,
      `Orientation: ${orientation}`,
      `Aspect ratio: ${ratio}`,
      `Resolution: ${megapixels} MP`,
      "",
      "Browser-side analysis completed.",
      "For object/person/text recognition, connect a vision AI backend."
    ].join("\n");

    return {
      width,
      height,
      orientation,
      ratio,
      megapixels,
      text
    };
  }


  function addImagePreview(dataURL, analysis) {
    const wrapper =
      document.createElement("div");

    wrapper.className =
      "jarvis-image-result";

    const image =
      document.createElement("img");

    image.src = dataURL;

    image.alt =
      "JARVIS analyzed image";

    image.style.maxWidth = "100%";
    image.style.maxHeight = "300px";
    image.style.borderRadius = "12px";
    image.style.display = "block";
    image.style.marginBottom = "8px";

    const info =
      document.createElement("small");

    info.textContent =
      `${analysis.width} × ${analysis.height} • ${analysis.orientation}`;

    wrapper.appendChild(image);
    wrapper.appendChild(info);

    chat.appendChild(wrapper);

    chat.scrollTop = chat.scrollHeight;
  }


  /* =========================================================
     LOCAL ASSISTANT
     ========================================================= */

  async function localAssistant(input) {
    const text = normalize(input);

    /* Greetings */

    if (
      /^(hi|hello|hey|hai|namaste|good morning|good evening)\b/.test(text)
    ) {
      return (
        "Hello. J.A.R.V.I.S. is online. " +
        "Give me a goal and I will plan the available tools."
      );
    }


    /* Identity */

    if (
      text.includes("who are you") ||
      text.includes("what are you")
    ) {
      return (
        "I am J.A.R.V.I.S., your browser-based AI agent interface. " +
        "I can plan commands, use available tools, access live web data, " +
        "manage local memory, use voice input, and open web services."
      );
    }


    /* Current date */

    if (
      text.includes("today's date") ||
      text.includes("what date") ||
      text === "date"
    ) {
      return toolTime();
    }


    /* Memory recall */

    if (
      text.includes("what do you remember") ||
      text.includes("show my memory") ||
      text.includes("my memories")
    ) {
      return getMemorySummary();
    }


    /* Last conversation */

    if (
      text.includes("what did i say") ||
      text.includes("last message")
    ) {
      const users =
        state.history
          .filter(item => item.role === "user")
          .slice(-5);

      if (!users.length) {
        return "I don't have any previous user messages.";
      }

      return users
        .map(
          (item, index) =>
            `${index + 1}. ${item.content}`
        )
        .join("\n");
    }


    /* Help */

    if (
      text === "help" ||
      text === "commands" ||
      text.includes("what can you do")
    ) {
      return [
        "J.A.R.V.I.S. COMMANDS",
        "",
        "• time",
        "• weather in Tirupati",
        "• set timer for 30 seconds",
        "• roll dice",
        "• flip coin",
        "• tell me a joke",
        "• give me a quote",
        "• news",
        "• translate hello to Telugu",
        "• 100 USD to INR",
        "• meaning of computer",
        "• generate password 20",
        "• search JavaScript",
        "• open YouTube",
        "• play Arijit Singh",
        "• bitcoin price",
        "• remember that ...",
        "• what do you remember",
        "• clear memory"
      ].join("\n");
    }


    /* Thank you */

    if (
      text === "thanks" ||
      text === "thank you" ||
      text.includes("thank you jarvis")
    ) {
      return "You're welcome. Ready for the next goal.";
    }


    /*
       Goal correction.
       If a user gives a common malformed command,
       JARVIS attempts to interpret it instead of
       immediately failing.
    */

    const corrected =
      autoCorrectCommand(input);

    if (corrected && corrected !== input) {
      return await runAgent(corrected);
    }


    /* General fallback */

    return [
      "I understood your message, but I don't have a matching local tool for it.",
      "",
      `Goal received: ${input}`,
      "",
      "Try saying: \"help\" to see the available commands."
    ].join("\n");
  }


  function getMemorySummary() {
    if (!state.memory.length) {
      return "Long-term memory is currently empty.";
    }

    return [
      "🧠 J.A.R.V.I.S. MEMORY",
      "",
      ...state.memory
        .slice(-20)
        .map(
          (item, index) =>
            `${index + 1}. ${item.text}`
        )
    ].join("\n");
  }


  /* =========================================================
     COMMAND AUTO-CORRECTION
     ========================================================= */

  function autoCorrectCommand(input) {
    const original = String(input).trim();
    const text = normalize(original);

    if (!text) return original;

    /*
      Common speech-recognition variations.
    */

    let corrected = original
      .replace(/\bwhat is the time now\b/i, "time")
      .replace(/\bwhat's the time\b/i, "time")
      .replace(/\bshow me the time\b/i, "time")
      .replace(/\btell me time\b/i, "time")
      .replace(/\bcurrent time please\b/i, "time")
      .replace(/\bweather now\b/i, "weather")
      .replace(/\btell weather\b/i, "weather");


    /*
      Telugu-English command corrections.
    */

    const lower = normalize(corrected);

    if (
      lower === "time cheppu" ||
      lower === "time chepu" ||
      lower === "time chupu"
    ) {
      corrected = "time";
    }

    if (
      lower === "weather cheppu" ||
      lower === "weather chepu"
    ) {
      corrected = "weather";
    }

    if (
      lower.includes("joke cheppu") ||
      lower.includes("joke chepu")
    ) {
      corrected = "tell me a joke";
    }

    if (
      lower.includes("quote cheppu") ||
      lower.includes("quote chepu")
    ) {
      corrected = "give me a quote";
    }

    if (
      lower.includes("password generate") ||
      lower.includes("password ivvu")
    ) {
      corrected = "generate password 16";
    }


    return corrected;
  }


  /* =========================================================
     OPTIONAL AI BACKEND
     ========================================================= */

  async function callAIBackend(userText) {
    if (!CONFIG.AI_API_URL) {
      return null;
    }

    try {
      const response = await fetch(
        CONFIG.AI_API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",

            ...(CONFIG.AI_API_KEY
              ? {
                  "Authorization":
                    `Bearer ${CONFIG.AI_API_KEY}`
                }
              : {})
          },

          body: JSON.stringify({
            message: userText,

            history:
              state.history.slice(-20),

            memory:
              state.memory.slice(-20),

            tools: [
              "time",
              "weather",
              "timer",
              "dice",
              "joke",
              "quote",
              "news",
              "translate",
              "currency",
              "meaning",
              "password",
              "search",
              "open",
              "play",
              "crypto",
              "memory"
            ]
          })
        }
      );

      if (!response.ok) {
        throw new Error(
          `AI backend HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      return (
        data.reply ||
        data.message ||
        data.output ||
        null
      );

    } catch (error) {
      console.error(
        "AI backend error:",
        error
      );

      return null;
    }
  }


  /* =========================================================
     KEYBOARD SHORTCUTS
     ========================================================= */

  document.addEventListener(
    "keydown",
    event => {

      /*
       Ctrl + K
       Focus command box.
      */

      if (
        event.ctrlKey &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();

        msg.focus();
        msg.select();
      }


      /*
       Escape
       Stop speech.
      */

      if (event.key === "Escape") {
        try {
          window.speechSynthesis.cancel();
        } catch {}

        if (
          state.listening &&
          state.recognition
        ) {
          try {
            state.recognition.stop();
          } catch {}
        }
      }
    }
  );


  /* =========================================================
     VOICE LOADING
     ========================================================= */

  if ("speechSynthesis" in window) {
    speechSynthesis.onvoiceschanged = () => {
      speechSynthesis.getVoices();
    };
  }


  /* =========================================================
     NOTIFICATION PERMISSION
     ========================================================= */

  function requestNotificationPermission() {
    if (
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
  }


  /* =========================================================
     AGENT HEARTBEAT
     ========================================================= */

  setInterval(() => {
    /*
      Keeps the agent state alive and can be expanded later
      for background jobs.
    */

    if (!state.busy) {
      status("SYSTEM READY");
    }
  }, 5000);


  /* =========================================================
     START
     ========================================================= */

  requestNotificationPermission();

  init();

})();
  /* =========================================================
     J.A.R.V.I.S. - PART 3
     AUTONOMOUS AGENT / GOAL PLANNER / LIVE CLOCK
     
     INSERT THIS SECTION BEFORE:
     
     requestNotificationPermission();
     init();
     
     AND KEEP THE FINAL:
     
     })();
     ========================================================= */


  /* =========================================================
     LIVE AGENT CLOCK
     ========================================================= */

  function createAgentClock() {
    let clock = document.getElementById(
      "jarvis-live-clock"
    );

    if (!clock) {
      clock = document.createElement("div");

      clock.id = "jarvis-live-clock";

      clock.style.cssText = [
        "position:fixed",
        "right:12px",
        "top:12px",
        "z-index:9999",
        "padding:7px 11px",
        "border:1px solid rgba(0,255,255,.35)",
        "border-radius:10px",
        "background:rgba(0,0,0,.55)",
        "color:#00ffff",
        "font-family:monospace",
        "font-size:12px",
        "letter-spacing:.5px",
        "backdrop-filter:blur(8px)",
        "pointer-events:none"
      ].join(";");

      document.body.appendChild(clock);
    }

    function updateClock() {
      const d = new Date();

      clock.textContent =
        d.toLocaleDateString([], {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }) +
        " • " +
        d.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        });
    }

    updateClock();

    setInterval(updateClock, 1000);
  }


  /* =========================================================
     AGENT ACTIVITY PANEL
     ========================================================= */

  function createAgentActivity() {
    let panel =
      document.getElementById(
        "jarvis-agent-activity"
      );

    if (panel) return panel;

    panel = document.createElement("div");

    panel.id = "jarvis-agent-activity";

    panel.style.cssText = [
      "position:fixed",
      "left:12px",
      "bottom:12px",
      "z-index:9998",
      "max-width:280px",
      "padding:9px 12px",
      "border:1px solid rgba(0,255,255,.25)",
      "border-radius:10px",
      "background:rgba(0,0,0,.55)",
      "color:#bfffff",
      "font:11px monospace",
      "backdrop-filter:blur(8px)",
      "pointer-events:none",
      "opacity:.85"
    ].join(";");

    panel.textContent =
      "J.A.R.V.I.S. AGENT: READY";

    document.body.appendChild(panel);

    return panel;
  }


  function agentActivity(text) {
    const panel =
      document.getElementById(
        "jarvis-agent-activity"
      );

    if (panel) {
      panel.textContent =
        "J.A.R.V.I.S. AGENT: " + text;
    }

    status(text);
  }


  /* =========================================================
     SMART GOAL ANALYZER
     ========================================================= */

  function buildSmartPlan(goal) {
    const text = normalize(goal);

    const steps = [];

    /*
      TIME + WEATHER
    */

    if (
      text.includes("time") &&
      (
        text.includes("weather") ||
        text.includes("temperature")
      )
    ) {
      steps.push({
        tool: "time",
        args: {}
      });

      steps.push({
        tool: "weather",
        args: extractLocation(goal)
      });

      return steps;
    }


    /*
      WEATHER + NEWS
    */

    if (
      text.includes("weather") &&
      text.includes("news")
    ) {
      steps.push({
        tool: "weather",
        args: extractLocation(goal)
      });

      steps.push({
        tool: "news",
        args: {}
      });

      return steps;
    }


    /*
      SEARCH + OPEN
    */

    if (
      (
        text.includes("search") ||
        text.includes("find") ||
        text.includes("look up")
      ) &&
      text.includes("open")
    ) {
      const query =
        extractAfterKeywords(
          goal,
          [
            "search",
            "search for",
            "find",
            "look up"
          ]
        );

      steps.push({
        tool: "search",
        args: {
          query
        }
      });

      return steps;
    }


    /*
      TRANSLATE + SPEAK
    */

    if (
      text.includes("translate") &&
      (
        text.includes("speak") ||
        text.includes("say")
      )
    ) {
      const translation =
        extractTranslation(goal);

      steps.push({
        tool: "translate",
        args: translation
      });

      return steps;
    }


    /*
      RANDOM FUN
    */

    if (
      text.includes("joke") &&
      text.includes("quote")
    ) {
      steps.push({
        tool: "joke",
        args: {}
      });

      steps.push({
        tool: "quote",
        args: {}
      });

      return steps;
    }


    /*
      PASSWORD + MEMORY
    */

    if (
      text.includes("generate") &&
      text.includes("password") &&
      text.includes("remember")
    ) {
      steps.push({
        tool: "password",
        args: {
          length: extractNumber(goal) || 16
        }
      });

      return steps;
    }


    /*
      OPEN + PLAY
    */

    if (
      text.includes("open") &&
      text.includes("youtube")
    ) {
      steps.push({
        tool: "open",
        args: {
          target: "youtube"
        }
      });

      return steps;
    }


    /*
      CRYPTO + CURRENCY
    */

    if (
      (
        text.includes("bitcoin") ||
        text.includes("ethereum") ||
        text.includes("crypto")
      ) &&
      (
        text.includes("inr") ||
        text.includes("rupees") ||
        text.includes("rupee")
      )
    ) {
      steps.push({
        tool: "crypto",
        args: {
          coin: detectCoin(goal)
        }
      });

      return steps;
    }


    return [];
  }


  /* =========================================================
     SMART COMMAND RECOGNITION
     ========================================================= */

  function smartCommand(goal) {
    const text = normalize(goal);

    /*
      Natural language -> standard command
    */

    if (
      text.includes("tell me current time") ||
      text.includes("tell me the current time") ||
      text.includes("what's current time") ||
      text.includes("what is current time")
    ) {
      return "time";
    }


    if (
      text.includes("how is the weather") ||
      text.includes("how's the weather") ||
      text.includes("what is weather")
    ) {
      return "weather";
    }


    if (
      text.includes("give me today's news") ||
      text.includes("show today's news") ||
      text.includes("latest news")
    ) {
      return "news";
    }


    if (
      text.includes("flip a coin") ||
      text.includes("flip coin")
    ) {
      return "flip coin";
    }


    if (
      text.includes("roll a dice") ||
      text.includes("roll the dice")
    ) {
      return "roll dice";
    }


    /*
      Telugu-English common commands
    */

    if (
      text === "time cheppu" ||
      text === "time chepu" ||
      text === "time chupu" ||
      text === "ippudu time entha"
    ) {
      return "time";
    }


    if (
      text === "weather cheppu" ||
      text === "weather chepu" ||
      text === "weather chupu"
    ) {
      return "weather";
    }


    if (
      text.includes("joke cheppu") ||
      text.includes("joke chepu")
    ) {
      return "tell me a joke";
    }


    if (
      text.includes("quote cheppu") ||
      text.includes("quote chepu")
    ) {
      return "give me a quote";
    }


    if (
      text.includes("password ivvu") ||
      text.includes("password create cheyyi")
    ) {
      return "generate password 16";
    }


    return goal;
  }


  /* =========================================================
     ENHANCED AGENT
     ========================================================= */

  const originalRunAgent =
    runAgent;

  runAgent = async function(goal) {

    let currentGoal =
      smartCommand(goal);

    /*
      If command was corrected,
      tell the agent activity system.
    */

    if (
      normalize(currentGoal) !==
      normalize(goal)
    ) {
      agentActivity(
        "COMMAND CORRECTED"
      );

      await sleep(120);
    }


    /*
      Build an autonomous multi-step plan.
    */

    const smartSteps =
      buildSmartPlan(currentGoal);


    if (smartSteps.length) {

      state.currentPlan = {
        goal: currentGoal,
        steps: smartSteps,
        mode: "autonomous"
      };


      const results = [];


      for (
        let i = 0;
        i < smartSteps.length;
        i++
      ) {

        const step =
          smartSteps[i];


        agentActivity(
          `PLAN ${i + 1}/${smartSteps.length}: ${step.tool.toUpperCase()}`
        );


        try {

          const result =
            await executeTool(
              step.tool,
              step.args || {}
            );


          results.push({
            tool: step.tool,
            result
          });


        } catch (error) {

          results.push({
            tool: step.tool,

            result:
              `Failed: ${error.message}`
          });

        }


        await sleep(100);
      }


      agentActivity(
        "PLAN COMPLETE"
      );


      return results
        .map(
          (item, index) =>
            `${index + 1}. ${item.result}`
        )
        .join("\n\n");
    }


    /*
      Fall back to the original agent.
    */

    agentActivity(
      "ANALYZING GOAL"
    );


    const result =
      await originalRunAgent(
        currentGoal
      );


    agentActivity(
      "TASK COMPLETE"
    );


    return result;
  };


  /* =========================================================
     ADVANCED TIMER PARSER
     ========================================================= */

  function parseNaturalTimer(text) {
    const input =
      normalize(text);

    let seconds = 0;

    const hour =
      input.match(
        /(\d+(?:\.\d+)?)\s*(?:hour|hours|hr|hrs)/
      );

    const minute =
      input.match(
        /(\d+(?:\.\d+)?)\s*(?:minute|minutes|min|mins)/
      );

    const second =
      input.match(
        /(\d+(?:\.\d+)?)\s*(?:second|seconds|sec|secs)/
      );


    if (hour) {
      seconds +=
        Number(hour[1]) * 3600;
    }

    if (minute) {
      seconds +=
        Number(minute[1]) * 60;
    }

    if (second) {
      seconds +=
        Number(second[1]);
    }


    return seconds;
  }


  /*
    Improve timer recognition.
  */

  const originalExecuteTool =
    executeTool;


  executeTool = async function(
    tool,
    args
  ) {

    if (
      tool === "timer" &&
      (!args ||
       !Number(args.seconds))
    ) {
      args = {
        seconds: 60
      };
    }


    return await originalExecuteTool(
      tool,
      args
    );
  };


  /* =========================================================
     AGENT GOAL STATUS
     ========================================================= */

  function showPlan(plan) {
    if (
      !plan ||
      !plan.steps ||
      !plan.steps.length
    ) {
      return;
    }

    const planText =
      plan.steps
        .map(
          (step, index) =>
            `${index + 1}. ${step.tool}`
        )
        .join(" → ");


    agentActivity(
      `PLAN: ${planText}`
    );
  }


  /* =========================================================
     INTERCEPT PLAN CREATION
     ========================================================= */

  const originalCreatePlan =
    createPlan;


  createPlan = function(goal) {

    const plan =
      originalCreatePlan(goal);


    if (plan) {
      showPlan(plan);
    }


    return plan;
  };


  /* =========================================================
     IMAGE -> AI BACKEND HOOK
     
     If CONFIG.AI_API_URL is configured,
     the selected image can be sent to your backend.
     ========================================================= */

  const originalAnalyzeImage =
    analyzeImage;


  analyzeImage = async function(
    file,
    dataURL
  ) {

    /*
      Always perform local analysis first.
    */

    await originalAnalyzeImage(
      file,
      dataURL
    );


    /*
      If no AI backend exists,
      browser analysis is the final result.
    */

    if (!CONFIG.AI_API_URL) {
      return;
    }


    try {

      agentActivity(
        "SENDING IMAGE TO VISION AI"
      );


      const response =
        await fetch(
          CONFIG.AI_API_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              ...(CONFIG.AI_API_KEY
                ? {
                    "Authorization":
                      `Bearer ${CONFIG.AI_API_KEY}`
                  }
                : {})
            },

            body: JSON.stringify({
              type: "image_analysis",
              image: dataURL,
              filename: file.name
            })
          }
        );


      if (!response.ok) {
        throw new Error(
          `Vision backend HTTP ${response.status}`
        );
      }


      const data =
        await response.json();


      const result =
        data.reply ||
        data.analysis ||
        data.description ||
        data.output;


      if (result) {

        addMessage(
          "🤖 AI VISION RESULT\n\n" +
          result,
          "assistant"
        );

        speak(
          "Vision analysis complete."
        );
      }


    } catch (error) {

      console.error(
        "Vision AI:",
        error
      );


      addMessage(
        "Local image analysis completed, but the Vision AI backend could not be reached.",
        "assistant"
      );

    } finally {

      agentActivity(
        "IMAGE TASK COMPLETE"
      );
    }
  };


  /* =========================================================
     QUICK COMMAND BUTTONS
     
     Existing HTML IDs remain unchanged.
     ========================================================= */

  function addQuickCommands() {

    const existing =
      document.getElementById(
        "jarvis-quick-commands"
      );

    if (existing) return;


    const area =
      document.querySelector(
        ".input-area"
      );

    if (!area) return;


    const container =
      document.createElement("div");


    container.id =
      "jarvis-quick-commands";


    container.style.cssText = [
      "display:flex",
      "flex-wrap:wrap",
      "gap:6px",
      "margin-top:8px"
    ].join(";");


    const commands = [
      ["TIME", "time"],
      ["WEATHER", "weather"],
      ["JOKE", "tell me a joke"],
      ["QUOTE", "give me a quote"],
      ["NEWS", "news"],
      ["DICE", "roll dice"],
      ["COIN", "flip coin"],
      ["PASSWORD", "generate password 16"],
      ["HELP", "help"]
    ];


    commands.forEach(
      ([label, command]) => {

        const button =
          document.createElement(
            "button"
          );


        button.type = "button";

        button.textContent =
          label;


        button.style.cssText = [
          "cursor:pointer",
          "padding:5px 9px",
          "border-radius:7px",
          "background:transparent",
          "border:1px solid rgba(0,255,255,.3)",
          "color:inherit",
          "font-size:11px"
        ].join(";");


        button.addEventListener(
          "click",
          () => {

            msg.value =
              command;

            msg.focus();

            executeInput();
          }
        );


        container.appendChild(
          button
        );
      }
    );


    area.appendChild(
      container
    );
  }


  /* =========================================================
     AGENT ERROR RECOVERY
     ========================================================= */

  window.addEventListener(
    "unhandledrejection",
    event => {

      console.warn(
        "JARVIS recovered rejected promise:",
        event.reason
      );


      if (!state.busy) {
        status(
          "SYSTEM READY"
        );
      }
    }
  );


  window.addEventListener(
    "error",
    event => {

      console.warn(
        "JARVIS runtime recovery:",
        event.error
      );


      if (!state.busy) {
        status(
          "SYSTEM READY"
        );
      }
    }
  );


  /* =========================================================
     START AGENT UI
     ========================================================= */

  createAgentClock();

  createAgentActivity();

  addQuickCommands();


  /* =========================================================
     FINAL AGENT READY MESSAGE
     ========================================================= */

  setTimeout(() => {

    agentActivity(
      "READY • GOAL → PLAN → TOOLS → RESULT"
    );

  }, 500);
