 (() => {
"use strict";

/* =========================================================
   J.A.R.V.I.S. - COMPLETE FRONT-END ENGINE
   Works with the supplied HTML IDs:
   chat, msg, send, mic-btn, cam-btn, clear-btn, img-input
   ========================================================= */

const STORAGE_KEY = "jarvis_memory";
const API_KEY_STORAGE = "jarvis_key";

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const chat = $("chat");
const input = $("msg");
const sendBtn = $("send");
const micBtn = $("mic-btn");
const camBtn = $("cam-btn");
const clearBtn = $("clear-btn");
const imgInput = $("img-input");
const coreText = document.querySelector(".core-text");

/* ---------- State ---------- */
let MEMORY = [];
let recognition = null;
let recognitionRunning = false;
let selectedImageData = null;
let speechEnabled = true;
const timers = new Map();
let timerId = 0;
let cachedModel = null;

/* ---------- Safe HTML ---------- */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ---------- Memory ---------- */
function loadMemory() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    MEMORY = Array.isArray(raw)
      ? raw.filter(
          (m) =>
            m &&
            (m.role === "user" || m.role === "model") &&
            typeof m.text === "string"
        )
      : [];
  } catch {
    MEMORY = [];
  }
}

function saveMemory() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(MEMORY.slice(-80))
    );
  } catch {}
}

function add(text, role = "ai", save = true) {
  if (!chat) return;

  const message = String(text ?? "");

  const el = document.createElement("div");
  el.className = `message ${role === "user" ? "user" : "ai"}`;
  el.textContent = message;

  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;

  if (save && (role === "user" || role === "ai")) {
    MEMORY.push({
      role: role === "user" ? "user" : "model",
      text: message
    });

    MEMORY = MEMORY.slice(-80);
    saveMemory();
  }
}

function renderMemory() {
  if (!chat) return;

  chat.innerHTML = "";

  MEMORY.forEach((m) => {
    add(
      m.text,
      m.role === "user" ? "user" : "ai",
      false
    );
  });
}

function clearMemory() {
  MEMORY = [];

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}

  if (chat) chat.innerHTML = "";

  add(
    "J.A.R.V.I.S: Memory cleared.",
    "ai",
    false
  );
}

/* ---------- Live clock ---------- */
function updateLiveClock() {
  if (!coreText) return;

  const now = new Date();

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  coreText.textContent =
    `SYSTEM READY • ${time}`;
}

updateLiveClock();

setInterval(updateLiveClock, 1000);

/* ---------- Speech ---------- */
function speak(text) {
  if (
    !speechEnabled ||
    !("speechSynthesis" in window)
  ) {
    return;
  }

  try {
    window.speechSynthesis.cancel();

    const clean = String(text)
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 1200);

    const utterance =
      new SpeechSynthesisUtterance(clean);

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  } catch {}
}

/* ---------- Network helper ---------- */
async function fetchToolJson(
  url,
  options = {},
  timeoutMs = 12000
) {
  const controller =
    typeof AbortController === "function"
      ? new AbortController()
      : null;

  const timeout = controller
    ? setTimeout(
        () => controller.abort(),
        timeoutMs
      )
    : null;

  try {
    const response = await fetch(url, {
      ...options,
      ...(controller
        ? { signal: controller.signal }
        : {})
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return await response.json();
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function fetchText(
  url,
  options = {},
  timeoutMs = 12000
) {
  const controller =
    typeof AbortController === "function"
      ? new AbortController()
      : null;

  const timeout = controller
    ? setTimeout(
        () => controller.abort(),
        timeoutMs
      )
    : null;

  try {
    const response = await fetch(url, {
      ...options,
      ...(controller
        ? { signal: controller.signal }
        : {})
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return await response.text();
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/* ---------- General helpers ---------- */
function normalize(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ");
}

function formatDateTime(date = new Date()) {
  return date.toLocaleString([], {
    dateStyle: "full",
    timeStyle: "medium"
  });
}

function parseDuration(text) {
  const t = text.toLowerCase();

  let total = 0;

  const h = t.match(
    /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/
  );

  const m = t.match(
    /(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/
  );

  const s = t.match(
    /(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/
  );

  if (h) {
    total += Number(h[1]) * 3600;
  }

  if (m) {
    total += Number(m[1]) * 60;
  }

  if (s) {
    total += Number(s[1]);
  }

  if (!total) {
    const simple = t.match(
      /(?:timer|countdown)\s+(\d+)\b/
    );

    if (simple) {
      total = Number(simple[1]) * 60;
    }
  }

  return Math.max(
    0,
    Math.round(total)
  );
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(
    (seconds % 3600) / 60
  );
  const s = seconds % 60;

  return [
    h ? `${h}h` : "",
    m ? `${m}m` : "",
    `${s}s`
  ]
    .filter(Boolean)
    .join(" ");
}

function openUrl(url) {
  const w = window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );

  return w ? true : false;
}

/* ---------- API key / Gemini ---------- */
function getApiKey() {
  let key = "";

  try {
    key =
      localStorage.getItem(
        API_KEY_STORAGE
      ) || "";
  } catch {}

  if (!key) {
    key = window.prompt(
      "Enter your Gemini API Key:"
    );

    if (key) {
      key = key.trim();

      try {
        localStorage.setItem(
          API_KEY_STORAGE,
          key
        );
      } catch {}
    }
  }

  return key;
}

function extractGeminiText(data) {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text || "")
      .join("") || ""
  ).trim();
}

async function findGeminiModel(apiKey) {
  if (cachedModel) {
    return cachedModel;
  }

  const data =
    await fetchToolJson(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
        apiKey
      )}`,
      {},
      12000
    );

  const models =
    Array.isArray(data?.models)
      ? data.models
      : [];

  const usable = models
    .filter((m) =>
      Array.isArray(
        m.supportedGenerationMethods
      )
        ? m.supportedGenerationMethods.includes(
            "generateContent"
          )
        : true
    )
    .map((m) =>
      String(m.name || "").replace(
        /^models\//,
        ""
      )
    );

  const preferred = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash"
  ];

  cachedModel =
    preferred.find((name) =>
      usable.includes(name)
    ) ||
    usable.find((name) =>
      /flash/i.test(name)
    ) ||
    usable[0] ||
    null;

  if (!cachedModel) {
    throw new Error(
      "No Gemini generateContent model is available."
    );
  }

  return cachedModel;
}

async function callGemini(
  prompt,
  options = {}
) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error(
      "Gemini API key is missing."
    );
  }

  const model =
    await findGeminiModel(apiKey);

  const contents =
    Array.isArray(options.contents)
      ? options.contents
      : MEMORY.slice(-12).map((m) => ({
          role:
            m.role === "model"
              ? "model"
              : "user",
          parts: [
            {
              text: m.text
            }
          ]
        }));

  if (!options.contents) {
    contents.push({
      role: "user",
      parts: [
        {
          text: String(prompt)
        }
      ]
    });
  }

  const body = {
    contents,
    generationConfig: {
      temperature:
        options.temperature ?? 0.45,
      maxOutputTokens:
        options.maxOutputTokens ?? 900
    }
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const detail =
      await response.text().catch(
        () => ""
      );

    throw new Error(
      `Gemini API error ${response.status}${
        detail
          ? `: ${detail.slice(0, 250)}`
          : ""
      }`
    );
  }

  const data =
    await response.json();

  const text =
    extractGeminiText(data);

  if (!text) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  return text;
}

/* ---------- Weather ---------- */
async function getWeather(
  location = ""
) {
  let place = normalize(location);

  if (!place) {
    place = "Tirupati";
  }

  const geo =
    await fetchToolJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        place
      )}&count=1&language=en&format=json`
    );

  const hit = geo?.results?.[0];

  if (!hit) {
    return `I could not find the location "${place}".`;
  }

  const forecast =
    await fetchToolJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`
    );

  const c = forecast?.current;

  if (!c) {
    return "Weather data is unavailable right now.";
  }

  const codes = {
    0: "clear sky",
    1: "mainly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "fog",
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
    80: "rain showers",
    81: "moderate rain showers",
    82: "violent rain showers",
    95: "thunderstorm"
  };

  return `Weather in ${
    hit.name
  }${
    hit.country
      ? `, ${hit.country}`
      : ""
  }: ${
    c.temperature_2m
  }°C, ${
    codes[c.weather_code] ||
    "current conditions"
  }, humidity ${
    c.relative_humidity_2m
  }%, wind ${
    c.wind_speed_10m
  } km/h.`;
}

/* ---------- Currency ---------- */
async function convertCurrency(text) {
  const match = text.match(
    /(?:convert\s+)?(?:([0-9]+(?:\.[0-9]+)?)\s*)?([A-Z]{3})\s*(?:to|in)\s*([A-Z]{3})/i
  );

  if (!match) {
    return "Use a command like: convert 100 USD to INR.";
  }

  const amount =
    Number(match[1] || 1);

  const from =
    match[2].toUpperCase();

  const to =
    match[3].toUpperCase();

  const data =
    await fetchToolJson(
      `https://api.frankfurter.app/latest?amount=${encodeURIComponent(
        amount
      )}&from=${encodeURIComponent(
        from
      )}&to=${encodeURIComponent(to)}`
    );

  const result =
    data?.rates?.[to];

  if (result == null) {
    return "I could not get that currency conversion.";
  }

  return `${amount} ${from} = ${Number(
    result
  ).toFixed(2)} ${to}.`;
}

/* ---------- Translation ---------- */
async function translateText(text) {
  let match = text.match(
    /^(?:translate)\s+(.+?)\s+(?:to|into)\s+([a-zA-Z -]+)$/i
  );

  if (!match) {
    return "Use: translate hello world to Telugu.";
  }

  const phrase =
    match[1].trim();

  const language =
    match[2].trim().toLowerCase();

  const langMap = {
    telugu: "te",
    english: "en",
    hindi: "hi",
    tamil: "ta",
    kannada: "kn",
    malayalam: "ml",
    spanish: "es",
    french: "fr",
    german: "de",
    japanese: "ja",
    chinese: "zh"
  };

  const target =
    langMap[language] ||
    language.slice(0, 2);

  const data =
    await fetchToolJson(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        phrase
      )}&langpair=en|${encodeURIComponent(
        target
      )}`
    );

  const translated =
    data?.responseData
      ?.translatedText;

  return translated
    ? `Translation (${language}): ${translated}`
    : "Translation service did not return a result.";
}

/* ---------- Dictionary / meaning ---------- */
async function getMeaning(text) {
  const match = text.match(
    /^(?:meaning|define|definition|dictionary)\s+(?:of\s+)?(.+)$/i
  );

  if (!match) {
    return "Use: meaning of resilience.";
  }

  const word = match[1]
    .trim()
    .split(/\s+/)[0]
    .toLowerCase();

  const data =
    await fetchToolJson(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
        word
      )}`
    );

  const entry = data?.[0];

  const meanings =
    entry?.meanings || [];

  const defs = [];

  for (const meaning of meanings) {
    for (const d of
      meaning.definitions || []) {
      if (d.definition) {
        defs.push(
          `${
            meaning.partOfSpeech ||
            "word"
          }: ${d.definition}`
        );
      }

      if (defs.length >= 3) {
        break;
      }
    }

    if (defs.length >= 3) {
      break;
    }
  }

  return defs.length
    ? `${word}: ${defs.join(
        " | "
      )}`
    : `No dictionary definition found for "${word}".`;
}

/* ---------- Crypto ---------- */
async function getCrypto(text) {
  const match = text.match(
    /(?:crypto|price of|value of)\s*(bitcoin|btc|ethereum|eth|solana|sol)?/i
  );

  const coin =
    (
      match?.[1] ||
      "bitcoin"
    ).toLowerCase();

  const id =
    coin === "btc" ||
    coin === "bitcoin"
      ? "bitcoin"
      : coin === "eth" ||
        coin === "ethereum"
      ? "ethereum"
      : coin === "sol" ||
        coin === "solana"
      ? "solana"
      : coin;

  const data =
    await fetchToolJson(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
        id
      )}&vs_currencies=usd,inr`
    );

  const price =
    data?.[id];

  if (!price) {
    return `I could not get the ${coin} price right now.`;
  }

  return `${id}: $${
    price.usd ?? "N/A"
  } | ₹${
    price.inr ?? "N/A"
  }.`;
}
    /* ---------- News ---------- */
async function getNews(text) {
  const match = text.match(
    /(?:news|headlines)(?:\s+(?:about|on|for))?\s*(.*)$/i
  );

  const topic = normalize(
    match?.[1] || ""
  );

  const query =
    topic || "India";

  const url =
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(
      query
    )}&mode=artlist&maxrecords=5&format=json&sort=HybridRel`;

  try {
    const data =
      await fetchToolJson(
        url,
        {},
        15000
      );

    const articles =
      Array.isArray(data?.articles)
        ? data.articles.slice(0, 5)
        : [];

    if (articles.length) {
      return (
        `Latest results for "${query}":\n` +
        articles
          .map(
            (a, i) =>
              `${i + 1}. ${
                a.title ||
                "Untitled"
              } — ${
                a.domain || ""
              }`
          )
          .join("\n")
      );
    }
  } catch {}

  openUrl(
    `https://news.google.com/search?q=${encodeURIComponent(
      query
    )}`
  );

  return `I opened Google News for "${query}".`;
}

/* ---------- Joke / Quote ---------- */
async function getJoke() {
  try {
    const data =
      await fetchToolJson(
        "https://official-joke-api.appspot.com/random_joke"
      );

    if (
      data?.setup &&
      data?.punchline
    ) {
      return `${data.setup}\n${data.punchline}`;
    }
  } catch {}

  return "Why did the developer go broke? Because they used up all their cache.";
}

async function getQuote() {
  try {
    const data =
      await fetchToolJson(
        "https://dummyjson.com/quotes/random"
      );

    if (data?.quote) {
      return `"${data.quote}" — ${
        data.author ||
        "Unknown"
      }`;
    }
  } catch {}

  return `"The best way to predict the future is to create it." — Peter Drucker`;
}

/* ---------- Timer ---------- */
function startTimer(seconds) {
  if (!seconds) {
    return "Tell me a duration, for example: timer 5 minutes.";
  }

  const id = ++timerId;

  const end =
    Date.now() +
    seconds * 1000;

  const tick = () => {
    const remaining =
      Math.max(
        0,
        Math.ceil(
          (end - Date.now()) /
            1000
        )
      );

    if (remaining <= 0) {
      clearInterval(interval);

      timers.delete(id);

      add(
        `J.A.R.V.I.S: Timer ${id} finished.`,
        "ai"
      );

      speak(
        `Timer ${id} finished.`
      );

      return;
    }

    if (
      remaining <= 5 ||
      remaining % 60 === 0
    ) {
      add(
        `Timer ${id}: ${formatDuration(
          remaining
        )} remaining.`,
        "ai",
        false
      );
    }
  };

  const interval =
    setInterval(tick, 1000);

  timers.set(
    id,
    interval
  );

  return `Timer ${id} started for ${formatDuration(
    seconds
  )}.`;
}

function cancelTimers() {
  for (const id of
    timers.values()) {
    clearInterval(id);
  }

  timers.clear();

  return "All active timers cancelled.";
}

/* ---------- Dice / Coin ---------- */
function rollDice(text) {
  const match = text.match(
    /(?:roll|throw)\s+(?:(\d+)\s*)?d(\d+)/i
  );

  const count = Math.min(
    Number(match?.[1] || 1),
    50
  );

  const sides = Number(
    match?.[2] || 6
  );

  if (
    !Number.isInteger(sides) ||
    sides < 2 ||
    sides > 1000
  ) {
    return "Dice sides must be between 2 and 1000.";
  }

  const rolls =
    Array.from(
      { length: count },
      () =>
        Math.floor(
          Math.random() *
            sides
        ) + 1
    );

  return `🎲 ${count}d${sides}: ${rolls.join(
    ", "
  )} | Total: ${rolls.reduce(
    (a, b) => a + b,
    0
  )}`;
}

/* ---------- Search / Open / YouTube ---------- */
function handleNavigation(text) {
  const t = normalize(text);
  const lower =
    t.toLowerCase();

  if (
    /^(?:open|launch)\s+(?:youtube|yt)$/i.test(
      t
    )
  ) {
    openUrl(
      "https://www.youtube.com/"
    );

    return "Opening YouTube, Boss.";
  }

  if (
    /^(?:open|launch)\s+(?:google)$/i.test(
      t
    )
  ) {
    openUrl(
      "https://www.google.com/"
    );

    return "Opening Google, Boss.";
  }

  const urlMatch = t.match(
    /^(?:open|visit|go to)\s+(https?:\/\/\S+)$/i
  );

  if (urlMatch) {
    try {
      const url =
        new URL(urlMatch[1]);

      if (
        !/^https?:$/.test(
          url.protocol
        )
      ) {
        return "Only HTTP and HTTPS links can be opened.";
      }

      openUrl(url.href);

      return `Opening ${url.hostname}, Boss.`;
    } catch {
      return "That link does not look valid.";
    }
  }

  const googleMatch =
    t.match(
      /^(?:google\s+search|search\s+(?:on\s+)?google)(?:\s+for)?\s+(.+)$/i
    );

  if (googleMatch) {
    const query =
      googleMatch[1].trim();

    openUrl(
      `https://www.google.com/search?q=${encodeURIComponent(
        query
      )}`
    );

    return `Searching Google for ${query}, Boss.`;
  }

  const ytMatch = t.match(
    /^(?:play|youtube\s+search|search\s+(?:on\s+)?youtube)(?:\s+for)?\s+(.+)$/i
  );

  if (ytMatch) {
    const query =
      ytMatch[1].trim();

    openUrl(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(
        query
      )}`
    );

    return `Searching YouTube for ${query}, Boss.`;
  }

  const genericSearch =
    t.match(
      /^(?:search|look up)\s+(?:for\s+)?(.+)$/i
    );

  if (genericSearch) {
    const query =
      genericSearch[1].trim();

    openUrl(
      `https://www.google.com/search?q=${encodeURIComponent(
        query
      )}`
    );

    return `Searching for ${query}, Boss.`;
  }

  return null;
}

/* ---------- Local tool router ---------- */
async function handleTools(text) {
  const original =
    normalize(text);

  const t =
    original.toLowerCase();

  if (!original) {
    return "Please enter a command.";
  }

  const navigation =
    handleNavigation(
      original
    );

  if (navigation) {
    return navigation;
  }

  if (
    /^(?:time|what(?:'s| is)? the time|current time|what time is it)\??$/i.test(
      original
    )
  ) {
    return `Current time: ${new Date().toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }
    )}`;
  }

  if (
    /^(?:date|today(?:'s)? date|what day is it)\??$/i.test(
      original
    )
  ) {
    return `Today is ${new Date().toLocaleDateString(
      [],
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }
    )}.`;
  }

  if (
    /^(?:datetime|date and time|current date and time)$/i.test(
      original
    )
  ) {
    return formatDateTime();
  }

  if (
    /^(?:weather|weather today|temperature|forecast)(?:\s+.*)?$/i.test(
      original
    )
  ) {
    const place =
      original
        .replace(
          /^(?:weather|weather today|temperature|forecast)\s*/i,
          ""
        )
        .trim();

    return await getWeather(
      place
    );
  }

  if (
    /^(?:timer|countdown)\b/i.test(
      original
    )
  ) {
    if (
      /\b(?:cancel|stop|clear)\b/i.test(
        original
      )
    ) {
      return cancelTimers();
    }

    return startTimer(
      parseDuration(original)
    );
  }

  if (
    /\b(?:roll|throw)\s+\d*d\d+\b/i.test(
      original
    )
  ) {
    return rollDice(
      original
    );
  }

  if (
    /^(?:flip|toss)\s+(?:a\s+)?coin\b/i.test(
      original
    )
  ) {
    return `🪙 ${
      Math.random() < 0.5
        ? "Heads"
        : "Tails"
    }.`;
  }

  if (
    /^(?:joke|tell me a joke|make me laugh)$/i.test(
      original
    )
  ) {
    return await getJoke();
  }

  if (
    /^(?:quote|give me a quote|inspiration|inspirational quote)$/i.test(
      original
    )
  ) {
    return await getQuote();
  }

  if (
    /^(?:news|headlines)(?:\s+(?:about|on|for)\s+.*)?$/i.test(
      original
    )
  ) {
    return await getNews(
      original
    );
  }

  if (
    /^(?:crypto|bitcoin|btc|ethereum|eth|solana|sol|price of\b)/i.test(
      original
    )
  ) {
    return await getCrypto(
      original
    );
  }

  if (
    /^convert\b/i.test(
      original
    ) ||
    /\b[A-Z]{3}\s+(?:to|in)\s+[A-Z]{3}\b/i.test(
      original
    )
  ) {
    return await convertCurrency(
      original
    );
  }

  if (
    /^translate\b/i.test(
      original
    )
  ) {
    return await translateText(
      original
    );
  }

  if (
    /^(?:meaning|define|definition|dictionary)\b/i.test(
      original
    )
  ) {
    return await getMeaning(
      original
    );
  }

  if (
    /^(?:password|generate password|strong password)\b/i.test(
      original
    )
  ) {
    const lengthMatch =
      original.match(
        /\b(?:\d{1,3})\b/
      );

    const length =
      Math.min(
        Math.max(
          Number(
            lengthMatch?.[0] ||
              16
          ),
          8
        ),
        64
      );

    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=";

    const values =
      new Uint32Array(
        length
      );

    crypto.getRandomValues(
      values
    );

    let password = "";

    for (const n of values) {
      password +=
        chars[
          n % chars.length
        ];
    }

    return `Generated password: ${password}`;
  }

  if (
    /^(?:open|launch|visit|go to|search|look up|play|google search|youtube search)\b/i.test(
      original
    )
  ) {
    return handleNavigation(
      original
    );
  }

  return null;
}
    /* ---------- Agent mode ---------- */
const AGENT_TOOLS =
  Object.freeze({
    time: async () =>
      handleTools(
        "current time"
      ),

    weather: async () =>
      handleTools(
        "weather"
      ),

    news: async () =>
      handleTools(
        "news"
      ),

    crypto: async () =>
      handleTools(
        "bitcoin"
      )
  });

function isAgentModeRequest(
  text = ""
) {
  const value =
    String(text || "");

  if (
    /\b(?:agent(?:\s+mode)?|run\s+(?:the\s+)?agent|use\s+(?:the\s+)?agent)\b/i.test(
      value
    )
  ) {
    return true;
  }

  if (
    /\b(?:briefing|research|analy[sz]e|analysis)\b/i.test(
      value
    )
  ) {
    return true;
  }

  return (
    /\bplan\b/i.test(
      value
    ) &&
    /\b(?:time|weather|news|crypto|bitcoin|btc)\b/i.test(
      value
    )
  );
}

function fallbackAgentToolPlan(
  goal
) {
  const t =
    String(goal).toLowerCase();

  const plan = [];

  if (
    /\btime\b/.test(t)
  ) {
    plan.push("time");
  }

  if (
    /\bweather|temperature|forecast\b/.test(
      t
    )
  ) {
    plan.push("weather");
  }

  if (
    /\bnews|headlines|latest\b/.test(
      t
    )
  ) {
    plan.push("news");
  }

  if (
    /\bcrypto|bitcoin|btc|ethereum|eth|solana\b/.test(
      t
    )
  ) {
    plan.push("crypto");
  }

  return plan.length
    ? [...new Set(plan)]
    : ["time"];
}

function parseAgentToolPlan(
  responseText
) {
  const text =
    String(
      responseText || ""
    ).trim();

  const start =
    text.indexOf("[");

  const end =
    text.lastIndexOf("]");

  if (
    start < 0 ||
    end < start
  ) {
    throw new Error(
      "Agent plan format incorrect."
    );
  }

  const parsed =
    JSON.parse(
      text.slice(
        start,
        end + 1
      )
    );

  const allowed =
    new Set(
      Object.keys(
        AGENT_TOOLS
      )
    );

  return [
    ...new Set(
      (
        Array.isArray(
          parsed
        )
          ? parsed
          : []
      )
        .filter(
          (item) =>
            typeof item ===
            "string"
        )
        .map((item) =>
          item
            .trim()
            .toLowerCase()
        )
        .filter((item) =>
          allowed.has(item)
        )
    )
  ];
}

async function runAgent(
  goal
) {
  add(
    "J.A.R.V.I.S: Agent mode active.",
    "ai"
  );

  const planPrompt =
    'Return ONLY a JSON array of tool names from ["time","weather","news","crypto"]. ' +
    "Choose the tools needed for this goal: " +
    JSON.stringify(
      String(goal)
    );

  let toolsToRun;

  try {
    toolsToRun =
      parseAgentToolPlan(
        await callGemini(
          planPrompt,
          {
            maxOutputTokens: 120
          }
        )
      );
  } catch {
    toolsToRun =
      fallbackAgentToolPlan(
        goal
      );
  }

  const results = {};

  for (
    let i = 0;
    i < toolsToRun.length;
    i++
  ) {
    const tool =
      toolsToRun[i];

    add(
      `J.A.R.V.I.S: [${
        i + 1
      }/${toolsToRun.length}] ${tool} tool running...`,
      "ai",
      false
    );

    try {
      results[tool] =
        await AGENT_TOOLS[
          tool
        ]();
    } catch (e) {
      results[tool] =
        `Tool error: ${e.message}`;
    }
  }

  const summaryPrompt =
    "Goal: " +
    JSON.stringify(
      String(goal)
    ) +
    "\nTool results:\n" +
    JSON.stringify(
      results
    ) +
    "\nGive a concise, factual Telugu/English summary. Do not invent missing data.";

  return await callGemini(
    summaryPrompt
  );
}

/* ---------- Image analysis ---------- */
function readImageAsDataUrl(
  file
) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () =>
        resolve(
          String(
            reader.result || ""
          )
        );

      reader.onerror = () =>
        reject(
          new Error(
            "Could not read the image."
          )
        );

      reader.readAsDataURL(
        file
      );
    }
  );
}

async function analyzeImage(
  file
) {
  const apiKey =
    getApiKey();

  if (!apiKey) {
    throw new Error(
      "Gemini API key is missing."
    );
  }

  const dataUrl =
    await readImageAsDataUrl(
      file
    );

  const comma =
    dataUrl.indexOf(",");

  if (comma < 0) {
    throw new Error(
      "Invalid image data."
    );
  }

  const mimeType =
    file.type ||
    dataUrl.slice(
      5,
      dataUrl.indexOf(";")
    );

  const base64 =
    dataUrl.slice(
      comma + 1
    );

  const model =
    await findGeminiModel(
      apiKey
    );

  const contents = [
    {
      role: "user",
      parts: [
        {
          text:
            "Analyze this image carefully. Describe what is visible, read useful text if present, " +
            "and answer in concise Telugu/English. Do not invent details."
        },
        {
          inlineData: {
            mimeType,
            data: base64
          }
        }
      ]
    }
  ];

  const response =
    await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 1000
          }
        })
      }
    );

  if (!response.ok) {
    throw new Error(
      `Image analysis API error ${response.status}.`
    );
  }

  const result =
    await response.json();

  return (
    extractGeminiText(
      result
    ) ||
    "I could not analyze that image."
  );
}

/* ---------- Main command ---------- */
async function processCommand(
  command
) {
  const text =
    normalize(command);

  if (!text) return;

  add(
    text,
    "user"
  );

  if (input) {
    input.value = "";
  }

  sendBtn?.setAttribute(
    "disabled",
    "disabled"
  );

  try {
    if (
      /^(?:clear|clear memory|forget everything|erase memory)$/i.test(
        text
      )
    ) {
      clearMemory();
      return;
    }

    if (
      /^(?:stop speaking|be quiet|mute)$/i.test(
        text
      )
    ) {
      speechEnabled = false;

      window.speechSynthesis?.cancel();

      add(
        "J.A.R.V.I.S: Voice output muted.",
        "ai"
      );

      return;
    }

    if (
      /^(?:speak|enable voice|unmute)$/i.test(
        text
      )
    ) {
      speechEnabled = true;

      add(
        "J.A.R.V.I.S: Voice output enabled.",
        "ai"
      );

      return;
    }

    if (
      isAgentModeRequest(
        text
      )
    ) {
      const answer =
        await runAgent(
          text
        );

      add(
        answer,
        "ai"
      );

      speak(answer);

      return;
    }

    const toolResult =
      await handleTools(
        text
      );

    if (toolResult) {
      add(
        toolResult,
        "ai"
      );

      speak(
        toolResult
      );

      return;
    }

    const answer =
      await callGemini(
        `Answer the user's request accurately and concisely. If the user makes a factual mistake, correct it politely. ` +
        `Do not claim live/current information unless it is available from the tool layer. User request: ${text}`
      );

    add(
      answer,
      "ai"
    );

    speak(answer);
  } catch (error) {
    console.error(error);

    const message =
      error?.message ||
      "An unexpected error occurred.";

    add(
      `J.A.R.V.I.S: ${message}`,
      "ai"
    );

    speak(message);
  } finally {
    sendBtn?.removeAttribute(
      "disabled"
    );

    input?.focus();
  }
}

/* ---------- Voice input ---------- */
function setupSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    if (micBtn) {
      micBtn.title =
        "Voice input is not supported in this browser.";
    }

    return;
  }

  recognition =
    new SpeechRecognition();

  recognition.lang =
    "en-IN";

  recognition.continuous =
    false;

  recognition.interimResults =
    true;

  recognition.maxAlternatives =
    1;

  recognition.onstart =
    () => {
      recognitionRunning =
        true;

      micBtn?.classList.add(
        "active"
      );
    };

  recognition.onresult =
    (event) => {
      let finalText = "";

      for (
        let i =
          event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const transcript =
          event.results[i][0]
            ?.transcript || "";

        if (
          event.results[i]
            .isFinal
        ) {
          finalText +=
            transcript;
        }
      }

      if (
        finalText &&
        input
      ) {
        input.value =
          finalText.trim();
      }
    };

  recognition.onerror =
    (event) => {
      recognitionRunning =
        false;

      micBtn?.classList.remove(
        "active"
      );

      console.warn(
        "Speech recognition:",
        event.error
      );
    };

  recognition.onend =
    () => {
      recognitionRunning =
        false;

      micBtn?.classList.remove(
        "active"
      );
    };
}

function toggleVoiceInput() {
  if (!recognition) {
    add(
      "J.A.R.V.I.S: Voice input is not supported in this browser.",
      "ai"
    );

    return;
  }

  if (
    recognitionRunning
  ) {
    recognition.stop();
    return;
  }

  try {
    recognition.start();
  } catch {
    recognitionRunning =
      false;
  }
}

/* ---------- Image button ---------- */
function chooseImage() {
  imgInput?.click();
}

async function handleImageChange(
  event
) {
  const file =
    event.target
      ?.files?.[0];

  if (!file) return;

  if (
    !file.type.startsWith(
      "image/"
    )
  ) {
    add(
      "J.A.R.V.I.S: Please select an image file.",
      "ai"
    );

    return;
  }

  try {
    add(
      `Image selected: ${file.name}`,
      "user"
    );

    add(
      "J.A.R.V.I.S: Analyzing image...",
      "ai",
      false
    );

    const result =
      await analyzeImage(
        file
      );

    add(
      result,
      "ai"
    );

    speak(result);
  } catch (error) {
    add(
      `J.A.R.V.I.S: Image analysis failed — ${error.message}`,
      "ai"
    );
  } finally {
    event.target.value = "";
  }
}

/* ---------- Events ---------- */
sendBtn?.addEventListener(
  "click",
  () =>
    processCommand(
      input?.value || ""
    )
);

input?.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      processCommand(
        input.value
      );
    }
  }
);

micBtn?.addEventListener(
  "click",
  toggleVoiceInput
);

camBtn?.addEventListener(
  "click",
  chooseImage
);

clearBtn?.addEventListener(
  "click",
  clearMemory
);

imgInput?.addEventListener(
  "change",
  handleImageChange
);

/* ---------- Startup ---------- */
loadMemory();

renderMemory();

setupSpeechRecognition();

if (
  chat &&
  MEMORY.length === 0
) {
  add(
    "J.A.R.V.I.S: System ready. Enter a command.",
    "ai",
    false
  );
}

if (input) {
  input.focus();
}

/* Expose a small public API for live testing/debugging. */
window.JARVIS =
  Object.freeze({
    processCommand,
    handleTools,
    clearMemory,
    speak,
    getMemory: () =>
      MEMORY.slice(),
    getLiveTime: () =>
      new Date()
  });

})();
