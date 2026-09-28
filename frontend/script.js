/* J.A.R.V.I.S. - script.js
   Kept compatible with the supplied HTML IDs/classes.
   No HTML changes are required.
*/

/* ===== 1. API KEY ===== */
let API_KEY = localStorage.getItem('jarvis_key');

if (!API_KEY) {
  API_KEY = window.prompt('Enter your Gemini API Key:') || '';
  if (API_KEY) localStorage.setItem('jarvis_key', API_KEY);
}

/* Keep the original model order, plus a safe fallback. */
const MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash'
];

/* ===== 2. MEMORY ===== */
let MEMORY = [];

try {
  const storedMemory = JSON.parse(localStorage.getItem('jarvis_memory') || '[]');

  if (Array.isArray(storedMemory)) {
    MEMORY = storedMemory.filter(
      m =>
        m &&
        (m.role === 'user' || m.role === 'model') &&
        typeof m.text === 'string' &&
        !(
          m.role === 'model' &&
          /(?:Your strong password:|strong password:)/i.test(m.text)
        )
    );

    if (MEMORY.length !== storedMemory.length) {
      localStorage.setItem('jarvis_memory', JSON.stringify(MEMORY));
    }
  } else {
    localStorage.removeItem('jarvis_memory');
  }
} catch (e) {
  localStorage.removeItem('jarvis_memory');
}

function saveMemory() {
  try {
    localStorage.setItem('jarvis_memory', JSON.stringify(MEMORY));
  } catch (e) {
    console.warn('Memory save failed:', e);
  }
}

/* ===== 2.1 EXACT HTML ELEMENTS ===== */
const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const sendBtn = document.getElementById('send');
const micBtn = document.getElementById('mic-btn');
const clearBtn = document.getElementById('clear-btn');
const camBtn = document.getElementById('cam-btn');
const imgInput = document.getElementById('img-input');

/* ===== 2.2 CHAT UI ===== */
function add(text, role = 'ai') {
  if (!chat) return;

  const item = document.createElement('div');
  item.className = `message ${role}`;
  item.textContent = String(text ?? '');

  chat.appendChild(item);
  chat.scrollTop = chat.scrollHeight;
}

function addImagePreview(src, label = 'Image attached') {
  if (!chat) return;

  const wrap = document.createElement('div');
  wrap.className = 'message user image-message';

  const title = document.createElement('div');
  title.textContent = label;

  const img = document.createElement('img');
  img.src = src;
  img.alt = 'Uploaded image';
  img.style.maxWidth = '100%';
  img.style.borderRadius = '12px';
  img.style.marginTop = '8px';

  wrap.appendChild(title);
  wrap.appendChild(img);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

MEMORY.forEach(m => {
  add(
    (m.role === 'user' ? 'YOU: ' : 'J.A.R.V.I.S: ') + m.text,
    m.role === 'user' ? 'user' : 'ai'
  );
});

/* ===== 3. TOOLS (THE HANDS) ===== */

async function fetchToolJson(url, options = {}, timeoutMs = 10000) {
  const controller =
    typeof AbortController === 'function' ? new AbortController() : null;

  const timeoutId = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetch(url, {
      ...options,
      ...(controller ? { signal: controller.signal } : {})
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/* ===== 3.1 SMART COMMAND NORMALIZER ===== */
function normalizeCommand(text = '') {
  let t = String(text).trim();

  const replacements = [
    [/\bwathe?r\b/gi, 'weather'],
    [/\bweathe?r\b/gi, 'weather'],
    [/\btemprature\b/gi, 'temperature'],
    [/\btemparature\b/gi, 'temperature'],
    [/\btym\b/gi, 'time'],
    [/\btimee\b/gi, 'time'],
    [/\bgoogal\b/gi, 'google'],
    [/\byoutub\b/gi, 'youtube'],
    [/\byutube\b/gi, 'youtube'],
    [/\bnews?s\b/gi, 'news'],
    [/\bbitcoin\b/gi, 'bitcoin'],
    [/\bbitcion\b/gi, 'bitcoin'],
    [/\bcrypto currency\b/gi, 'cryptocurrency'],
    [/\bcryptoo\b/gi, 'crypto'],
    [/\bdicee\b/gi, 'dice'],
    [/\bcoinflip\b/gi, 'coin toss'],
    [/\bflipcoin\b/gi, 'coin toss'],
    [/\bjokes\b/gi, 'joke'],
    [/\bquot\b/gi, 'quote'],
    [/\btranslater\b/gi, 'translate'],
    [/\bdictionery\b/gi, 'dictionary'],
    [/\bpasswrod\b/gi, 'password'],
    [/\bsearchh\b/gi, 'search'],
    [/\bclera\b/gi, 'clear']
  ];

  for (const [pattern, replacement] of replacements) {
    t = t.replace(pattern, replacement);
  }

  return t.replace(/\s+/g, ' ').trim();
}

/* ===== 3.2 TIME ===== */
function toolTime() {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'medium'
  }).format(new Date());
}

/* ===== 3.3 WEATHER ===== */
async function toolWeather(text) {
  const match = String(text).match(
    /\b(?:weather|temperature|forecast)\b(?:\s+(?:in|at|for|of)\s+(.+?))?\s*$/i
  );

  const city = (match?.[1] || '').trim() || 'Tirupati';

  const geoUrl =
    'https://geocoding-api.open-meteo.com/v1/search?name=' +
    encodeURIComponent(city) +
    '&count=1&language=en&format=json';

  const geo = await fetchToolJson(geoUrl);
  const place = geo?.results?.[0];

  if (!place) return `I could not find the location "${city}".`;

  const weatherUrl =
    'https://api.open-meteo.com/v1/forecast?latitude=' +
    encodeURIComponent(place.latitude) +
    '&longitude=' +
    encodeURIComponent(place.longitude) +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m' +
    '&timezone=auto';

  const data = await fetchToolJson(weatherUrl);
  const c = data?.current;

  if (!c) return 'Weather data is unavailable right now.';

  const codes = {
    0: 'clear sky',
    1: 'mainly clear',
    2: 'partly cloudy',
    3: 'overcast',
    45: 'fog',
    48: 'depositing rime fog',
    51: 'light drizzle',
    53: 'moderate drizzle',
    55: 'dense drizzle',
    61: 'light rain',
    63: 'moderate rain',
    65: 'heavy rain',
    71: 'light snow',
    73: 'moderate snow',
    75: 'heavy snow',
    80: 'light rain showers',
    81: 'moderate rain showers',
    82: 'violent rain showers',
    95: 'thunderstorm',
    96: 'thunderstorm with hail',
    99: 'thunderstorm with heavy hail'
  };

  return (
    `Weather in ${place.name}, ${place.country}: ` +
    `${c.temperature_2m}°C, feels like ${c.apparent_temperature}°C, ` +
    `${codes[c.weather_code] || 'unknown conditions'}, ` +
    `humidity ${c.relative_humidity_2m}%, wind ${c.wind_speed_10m} km/h.`
  );
}

/* ===== 3.4 TIMER ===== */
let activeTimer = null;

function toolTimer(text) {
  const value = String(text).match(
    /(?:timer|countdown)\s*(?:for\s*)?(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)?/i
  );

  if (!value) {
    return 'Tell me a duration, for example: timer 10 seconds or timer 2 minutes.';
  }

  const amount = Number(value[1]);
  const unit = (value[2] || 'seconds').toLowerCase();

  let multiplier = 1000;
  if (unit.startsWith('m')) multiplier = 60 * 1000;
  if (unit.startsWith('h')) multiplier = 60 * 60 * 1000;

  const ms = Math.max(1000, amount * multiplier);

  if (activeTimer) clearTimeout(activeTimer);

  activeTimer = setTimeout(() => {
    add('J.A.R.V.I.S: Timer complete, Boss.', 'ai');
    speak('Timer complete, Boss.');
    activeTimer = null;
  }, ms);

  return `Timer started for ${amount} ${unit}.`;
}

/* ===== 3.5 DICE ===== */
function toolDice(text) {
  const match = String(text).match(/\b(\d+)\s*d\s*(\d+)\b/i);
  const count = Math.min(20, Math.max(1, Number(match?.[1] || 1)));
  const sides = Math.min(1000, Math.max(2, Number(match?.[2] || 6)));

  const rolls = Array.from(
    { length: count },
    () => Math.floor(Math.random() * sides) + 1
  );

  const total = rolls.reduce((a, b) => a + b, 0);

  return `${count}d${sides}: ${rolls.join(', ')} | Total: ${total}`;
}

/* ===== 3.6 COIN ===== */
function toolCoin() {
  return Math.random() < 0.5 ? 'Heads.' : 'Tails.';
}

/* ===== 3.7 JOKE ===== */
async function toolJoke() {
  const data = await fetchToolJson(
    'https://official-joke-api.appspot.com/random_joke'
  );

  if (data?.setup && data?.punchline) {
    return `${data.setup} — ${data.punchline}`;
  }

  return 'I could not fetch a joke right now, Boss.';
}

/* ===== 3.8 QUOTE ===== */
async function toolQuote() {
  const data = await fetchToolJson('https://api.quotable.io/random');

  if (data?.content) {
    return `"${data.content}" — ${data.author || 'Unknown'}`;
  }

  return 'I could not fetch a quote right now, Boss.';
}

/* ===== 3.9 NEWS ===== */
function toolNews(text) {
  const query = String(text)
    .replace(/\b(?:latest|today|give me|show me|tell me|the)\b/gi, '')
    .replace(/\bnews\b/gi, '')
    .trim();

  const q = query || 'India';

  window.open(
    'https://news.google.com/search?q=' + encodeURIComponent(q),
    '_blank',
    'noopener,noreferrer'
  );

  return `Opening Google News for ${q}, Boss.`;
}

/* ===== 3.10 TRANSLATE ===== */
async function toolTranslate(text) {
  const match = String(text).match(
    /translate\s+(.+?)\s+(?:to|into)\s+([a-zA-Z-]+)\s*$/i
  );

  if (!match) {
    return 'Use: translate hello to Telugu';
  }

  const phrase = match[1].trim();
  const target = match[2].trim().toLowerCase();

  const langMap = {
    telugu: 'te',
    english: 'en',
    hindi: 'hi',
    tamil: 'ta',
    kannada: 'kn',
    malayalam: 'ml',
    spanish: 'es',
    french: 'fr',
    german: 'de',
    japanese: 'ja',
    korean: 'ko',
    chinese: 'zh'
  };

  const targetCode = langMap[target] || target;

  const url =
    'https://api.mymemory.translated.net/get?q=' +
    encodeURIComponent(phrase) +
    '&langpair=en|' +
    encodeURIComponent(targetCode);

  const data = await fetchToolJson(url);
  const translated = data?.responseData?.translatedText;

  if (!translated) return 'Translation failed, Boss.';

  return `${target}: ${translated}`;
}

/* ===== 3.11 CURRENCY ===== */
async function toolCurrency(text) {
  const match = String(text).match(
    /(?:convert\s+)?(\d+(?:\.\d+)?)\s*([A-Z]{3})\s*(?:to|in)\s*([A-Z]{3})/i
  );

  if (!match) {
    return 'Use: 100 USD to INR';
  }

  const amount = Number(match[1]);
  const from = match[2].toUpperCase();
  const to = match[3].toUpperCase();

  const data = await fetchToolJson(
    'https://open.er-api.com/v6/latest/' + encodeURIComponent(from)
  );

  const rate = data?.rates?.[to];

  if (!rate) return `I could not find the ${from} to ${to} rate.`;

  return `${amount} ${from} = ${(amount * rate).toFixed(2)} ${to}`;
}

/* ===== 3.12 DICTIONARY ===== */
async function toolDictionary(text) {
  const match = String(text).match(
    /(?:dictionary|define|meaning of)\s+(.+?)\s*$/i
  );

  if (!match) return 'Use: dictionary resilience';

  const word = match[1].trim().split(/\s+/)[0];

  const data = await fetchToolJson(
    'https://api.dictionaryapi.dev/api/v2/entries/en/' +
      encodeURIComponent(word)
  );

  const entry = data?.[0];
  const meaning = entry?.meanings?.[0];
  const definition = meaning?.definitions?.[0]?.definition;

  if (!definition) return `I could not find a definition for "${word}".`;

  return `${word}: ${definition}`;
}

/* ===== 3.13 PASSWORD GENERATOR ===== */
function toolPassword(text) {
  const match = String(text).match(/\b(?:password|pass)\b.*?(\d{1,3})/i);
  const length = Math.min(64, Math.max(8, Number(match?.[1] || 16)));

  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=';

  let password = '';

  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(length);
    crypto.getRandomValues(values);

    for (let i = 0; i < length; i++) {
      password += chars[values[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  return `Generated password: ${password}`;
}

/* ===== 3.14 SEARCH / WIKIPEDIA ===== */
async function toolSearch(text) {
  const match = String(text).match(
    /(?:search|look up|find|what is)\s+(?:for\s+)?(.+?)\s*$/i
  );

  if (!match) return 'Tell me what to search for.';

  const query = match[1].trim();

  if (!query) return 'Tell me what to search for.';

  try {
    const url =
      'https://en.wikipedia.org/w/api.php?action=query&list=search&srnamespace=0&srprop=snippet&format=json&origin=*&srlimit=1&srsearch=' +
      encodeURIComponent(query);

    const data = await fetchToolJson(url);
    const result = data?.query?.search?.[0];

    if (!result) {
      window.open(
        'https://www.google.com/search?q=' + encodeURIComponent(query),
        '_blank',
        'noopener,noreferrer'
      );

      return `Searching Google for ${query}, Boss.`;
    }

    const snippet = String(result.snippet || '')
      .replace(/<[^>]*>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    return `Wikipedia summary: ${result.title}${snippet ? '. ' + snippet : ''}`;
  } catch (e) {
    window.open(
      'https://www.google.com/search?q=' + encodeURIComponent(query),
      '_blank',
      'noopener,noreferrer'
    );

    return `Searching Google for ${query}, Boss.`;
  }
}

/* ===== 3.15 CRYPTO ===== */
async function toolCrypto(text) {
  const raw = String(text).toLowerCase();

  const aliases = {
    btc: 'bitcoin',
    bitcoin: 'bitcoin',
    eth: 'ethereum',
    ethereum: 'ethereum',
    sol: 'solana',
    solana: 'solana',
    doge: 'dogecoin',
    dogecoin: 'dogecoin'
  };

  let coin = 'bitcoin';

  for (const key of Object.keys(aliases)) {
    if (new RegExp(`\\b${key}\\b`, 'i').test(raw)) {
      coin = aliases[key];
      break;
    }
  }

  const url =
    'https://api.coingecko.com/api/v3/simple/price?ids=' +
    encodeURIComponent(coin) +
    '&vs_currencies=usd,inr';

  const data = await fetchToolJson(url);
  const price = data?.[coin];

  if (!price) {
    return `Crypto price for ${coin} is unavailable right now.`;
  }

  return `${coin}: $${price.usd} USD | ₹${price.inr} INR`;

 /* ===== 3.16 YOUTUBE / GOOGLE / URL ===== */
async function handleTools(text) {
  const normalized = normalizeCommand(text);
  const t = normalized.toLowerCase();

  if (
    /^(?:please\s+)?(?:open\s+youtube|youtube\s+open|youtube)(?:\s+please)?[.!?]*$/i.test(
      normalized
    )
  ) {
    window.open(
      'https://www.youtube.com/',
      '_blank',
      'noopener,noreferrer'
    );
    return 'Opening YouTube, Boss.';
  }

  if (
    /^(?:please\s+)?(?:open\s+google|google\s+open|google)(?:\s+please)?[.!?]*$/i.test(
      normalized
    )
  ) {
    window.open(
      'https://www.google.com/',
      '_blank',
      'noopener,noreferrer'
    );
    return 'Opening Google, Boss.';
  }

  const urlCommand = normalized.match(
    /^(?:open|visit|go to)\s+(https?:\/\/\S+)\s*$/i
  );

  if (urlCommand) {
    try {
      const destination = new URL(urlCommand[1]);

      if (
        destination.protocol !== 'https:' &&
        destination.protocol !== 'http:'
      ) {
        return 'Only HTTP and HTTPS links can be opened.';
      }

      window.open(
        destination.href,
        '_blank',
        'noopener,noreferrer'
      );

      return `Opening ${destination.hostname}, Boss.`;
    } catch (e) {
      return 'That link does not look valid.';
    }
  }

  const googleSearch = normalized.match(
    /^(?:google\s+search|search\s+(?:on\s+)?google)(?:\s+for)?\s+(.+?)\s*$/i
  );

  if (googleSearch) {
    const query = googleSearch[1].trim();

    window.open(
      'https://www.google.com/search?q=' + encodeURIComponent(query),
      '_blank',
      'noopener,noreferrer'
    );

    return `Searching Google for ${query}, Boss.`;
  }

  const playMatch = normalized.match(/^play\s+(.+?)\s*$/i);

  const youtubeMatch = normalized.match(
    /^youtube(?:\s+search)?(?:\s+for)?\s+(.+?)\s*$/i
  );

  const searchYoutubeMatch = normalized.match(
    /^search\s+(?:on\s+)?youtube(?:\s+for)?\s+(.+?)\s*$/i
  );

  const videoQuery = (
    playMatch ||
    youtubeMatch ||
    searchYoutubeMatch
  )?.[1]?.trim();

  if (videoQuery) {
    window.open(
      'https://www.youtube.com/results?search_query=' +
        encodeURIComponent(videoQuery),
      '_blank',
      'noopener,noreferrer'
    );

    return `Searching YouTube for ${videoQuery}, Boss.`;
  }

  if (/^(?:current\s+)?time|what(?:'s| is)\s+the\s+time/i.test(t)) {
    return toolTime();
  }

  if (/\bweather\b|\btemperature\b|\bforecast\b/i.test(t)) {
    try {
      return await toolWeather(normalized);
    } catch (e) {
      return 'Weather service is unavailable right now.';
    }
  }

  if (/\b(?:timer|countdown)\b/i.test(t)) {
    return toolTimer(normalized);
  }

  if (/\b(?:roll|throw)\b.*\bd\d+\b|\b\d+d\d+\b/i.test(t)) {
    return toolDice(normalized);
  }

  if (/\b(?:dice|roll a dice)\b/i.test(t)) {
    return toolDice(normalized);
  }

  if (/\b(?:coin toss|flip a coin|toss a coin)\b/i.test(t)) {
    return toolCoin();
  }

  if (/\b(?:tell me a joke|joke)\b/i.test(t)) {
    try {
      return await toolJoke();
    } catch (e) {
      return 'I could not fetch a joke right now, Boss.';
    }
  }

  if (/\b(?:give me a quote|quote)\b/i.test(t)) {
    try {
      return await toolQuote();
    } catch (e) {
      return 'I could not fetch a quote right now, Boss.';
    }
  }

  if (/\bnews\b/i.test(t)) {
    return toolNews(normalized);
  }

  if (/\btranslate\b/i.test(t)) {
    try {
      return await toolTranslate(normalized);
    } catch (e) {
      return 'Translation service is unavailable right now.';
    }
  }

  if (
    /\b(?:convert|currency)\b/i.test(t) &&
    /\b[A-Z]{3}\b/i.test(text)
  ) {
    try {
      return await toolCurrency(text);
    } catch (e) {
      return 'Currency service is unavailable right now.';
    }
  }

  if (/\b(?:dictionary|define|meaning of)\b/i.test(t)) {
    try {
      return await toolDictionary(normalized);
    } catch (e) {
      return 'Dictionary service is unavailable right now.';
    }
  }

  if (
    /\b(?:generate|make|create)\b.*\bpassword\b|\bpassword\s+\d+/i.test(t)
  ) {
    return toolPassword(normalized);
  }

  if (
    /^(?:search|look up|find|what is)\b/i.test(t) &&
    !/\b(?:youtube|google)\b/i.test(t)
  ) {
    return await toolSearch(normalized);
  }

  if (
    /\b(?:crypto|cryptocurrency|bitcoin|btc|ethereum|eth|solana|sol)\b/i.test(t)
  ) {
    try {
      return await toolCrypto(normalized);
    } catch (e) {
      return 'Crypto service is unavailable right now.';
    }
  }

  return null;
}

/* ===== 3.17 FALLBACK AGENT PLAN ===== */
function fallbackAgentToolPlan(goal) {
  const t = normalizeCommand(goal).toLowerCase();
  const tools = [];

  if (/\btime\b/.test(t)) tools.push('time');

  if (
    /\bweather\b|\btemperature\b|\bforecast\b/.test(t)
  ) {
    tools.push('weather');
  }

  if (/\bnews\b/.test(t)) {
    tools.push('news');
  }

  if (
    /\bcrypto\b|\bbitcoin\b|\bbtc\b|\beth\b|\bethereum\b/.test(t)
  ) {
    tools.push('crypto');
  }

  return [...new Set(tools)];
}

/* ===== 3.5 AGENT MODE ENGINE ===== */
const AGENT_TOOLS = Object.freeze({
  time: async () => toolTime(),
  weather: async () => toolWeather('weather'),
  news: async () => toolNews('news'),
  crypto: async () => toolCrypto('bitcoin')
});

const AGENT_TOOL_NAMES = Object.freeze({
  time: 'time',
  weather: 'weather',
  news: 'news',
  crypto: 'crypto'
});

function isAgentModeRequest(text = '') {
  const value = String(text || '');

  if (
    /\b(?:agent(?:\s+mode)?|run\s+the\s+agent|use\s+the\s+agent)\b/i.test(
      value
    )
  ) {
    return true;
  }

  if (
    /\b(?:briefing|research|analy[sz]e|analysis)\b/i.test(value)
  ) {
    return true;
  }

  return (
    /\bplan\b/i.test(value) &&
    /\b(?:time|weather|news|crypto|bitcoin|btc)\b/i.test(value)
  );
}

function parseAgentToolPlan(responseText) {
  const text = String(responseText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');

  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');

  if (start < 0 || end < start) {
    throw new Error('Agent plan format incorrect.');
  }

  const parsed = JSON.parse(text.slice(start, end + 1));
  const allowed = new Set(Object.keys(AGENT_TOOLS));

  if (!Array.isArray(parsed)) {
    throw new Error('Agent plan must be an array.');
  }

  return [
    ...new Set(
      parsed
        .filter(item => typeof item === 'string')
        .map(item => item.trim().toLowerCase())
        .filter(item => allowed.has(item))
    )
  ];
}

async function runAgent(goal) {
  add('J.A.R.V.I.S: Agent mode active.', 'ai');
  add('J.A.R.V.I.S: Goal analyze chesthunna...', 'ai');

  const planPrompt =
    'Select tools from ["time","weather","news","crypto"]. Goal: ' +
    JSON.stringify(String(goal)) +
    '. Return ONLY a JSON array of tool names.';

  let toolsToRun;

  try {
    toolsToRun = parseAgentToolPlan(
      await callGeminiRaw(planPrompt)
    );
  } catch (error) {
    toolsToRun = fallbackAgentToolPlan(goal);
  }

  const results = {};

  for (let i = 0; i < toolsToRun.length; i++) {
    const tool = toolsToRun[i];

    add(
      `J.A.R.V.I.S: [${i + 1}/${toolsToRun.length}] ${AGENT_TOOL_NAMES[tool]} tool run chesthunna...`,
      'ai'
    );

    try {
      results[tool] = await AGENT_TOOLS[tool]();
    } catch (e) {
      results[tool] = 'Tool error.';
    }
  }

  add(
    'J.A.R.V.I.S: Results combine chesthunna...',
    'ai'
  );

  const summaryPrompt =
    'Goal: ' +
    JSON.stringify(String(goal)) +
    '. Tool results: ' +
    JSON.stringify(results) +
    '. Give a concise Telugu/English summary.';

  return await callGemini(summaryPrompt);
}

/* ===== 4. GEMINI BRAIN ===== */
async function callGeminiRaw(prompt, extraParts = []) {
  if (!API_KEY) {
    throw new Error('Gemini API key is missing.');
  }

  const contents = MEMORY.slice(-12).map(m => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.text }]
  }));

  contents.push({
    role: 'user',
    parts: [
      { text: String(prompt) },
      ...extraParts
    ]
  });

  let lastError = null;

  for (const model of MODELS) {
    try {
      const url =
        'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(model) +
        ':generateContent?key=' +
        encodeURIComponent(API_KEY);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.65,
            topP: 0.9,
            maxOutputTokens: 900
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
          `Gemini HTTP ${response.status}`
        );
      }

      const answer =
        data?.candidates?.[0]?.content?.parts
          ?.map(part => part?.text || '')
          .join('')
          .trim();

      if (answer) return answer;

      throw new Error(
        'Gemini returned an empty response.'
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw (
    lastError ||
    new Error('Gemini request failed.')
  );
}

async function callGemini(prompt, extraParts = []) {
  return await callGeminiRaw(prompt, extraParts);
}

/* ===== 5. VOICE ===== */
let recognition = null;
let isListening = false;

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();

  recognition.lang = 'en-IN';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 3;

  recognition.onstart = () => {
    isListening = true;

    if (micBtn) {
      micBtn.setAttribute(
        'aria-label',
        'Stop voice input'
      );
    }

    if (micBtn) {
      micBtn.dataset.listening = 'true';
    }

    add(
      'J.A.R.V.I.S: Listening...',
      'ai'
    );
  };

  recognition.onresult = async event => {
    const result =
      event.results?.[0]?.[0]?.transcript || '';

    if (input) {
      input.value = result;
    }

    if (result.trim()) {
      await executeCommand(result);
    }
  };

  recognition.onerror = event => {
    add(
      `J.A.R.V.I.S: Voice input error${
        event?.error ? ': ' + event.error : '.'
      }`,
      'ai'
    );
  };

  recognition.onend = () => {
    isListening = false;

    if (micBtn) {
      micBtn.setAttribute(
        'aria-label',
        'Activate voice input'
      );
    }

    if (micBtn) {
      micBtn.dataset.listening = 'false';
    }
  };
}

function toggleVoice() {
  if (!recognition) {
    add(
      'J.A.R.V.I.S: Voice input is not supported in this browser.',
      'ai'
    );
    return;
  }

  try {
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  } catch (e) {
    console.warn(
      'Speech recognition:',
      e
    );
  }
}

/* ===== 6. FAST VOICE RESPONSE ===== */
function speak(text) {
  if (!('speechSynthesis' in window)) {
    return;
  }

  try {
    window.speechSynthesis.cancel();

    const clean = String(text || '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 650);

    if (!clean) return;

    const utterance =
      new SpeechSynthesisUtterance(clean);

    utterance.lang =
      /[\u0C00-\u0C7F]/.test(clean)
        ? 'te-IN'
        : 'en-IN';

    utterance.rate = 1.08;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(
      utterance
    );
  } catch (e) {
    console.warn(
      'Speech synthesis:',
      e
    );
  }
}
}
/* ===== 7. IMAGE / CAMERA ANALYSIS ===== */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () =>
      resolve(String(reader.result));

    reader.onerror = () =>
      reject(
        new Error('Could not read image.')
      );

    reader.readAsDataURL(file);
  });
}

async function analyzeImage(file) {
  if (
    !file ||
    !file.type.startsWith('image/')
  ) {
    add(
      'J.A.R.V.I.S: Please select an image file.',
      'ai'
    );
    return;
  }

  if (!API_KEY) {
    add(
      'J.A.R.V.I.S: Gemini API key is missing.',
      'ai'
    );
    return;
  }

  try {
    add(
      'J.A.R.V.I.S: Analyzing image...',
      'ai'
    );

    const dataUrl =
      await fileToDataUrl(file);

    addImagePreview(
      dataUrl,
      'YOU: Image'
    );

    const base64 =
      dataUrl.split(',')[1];

    const prompt =
      'Analyze this image carefully. Describe what is visible and answer the user if a question is provided. ' +
      'Be concise and useful.';

    const mimeType =
      file.type || 'image/jpeg';

    const answer =
      await callGemini(
        prompt,
        [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64
            }
          }
        ]
      );

    add(
      'J.A.R.V.I.S: ' + answer,
      'ai'
    );

    MEMORY.push({
      role: 'user',
      text: '[Image uploaded]'
    });

    MEMORY.push({
      role: 'model',
      text: answer
    });

    trimMemory();
    saveMemory();

    speak(answer);
  } catch (error) {
    add(
      'J.A.R.V.I.S: Image analysis failed. ' +
        (error?.message ||
          'Please try again.'),
      'ai'
    );
  }
}

/* ===== 8. MEMORY HELPERS ===== */
function trimMemory() {
  const maxItems = 40;

  if (MEMORY.length > maxItems) {
    MEMORY = MEMORY.slice(-maxItems);
  }
}

function clearMemory() {
  MEMORY = [];

  try {
    localStorage.removeItem(
      'jarvis_memory'
    );
  } catch (e) {
    console.warn(
      'Could not clear memory:',
      e
    );
  }

  if (chat) {
    chat.innerHTML = '';
  }

  add(
    'J.A.R.V.I.S: Memory cleared, Boss.',
    'ai'
  );
}

/* ===== 9. MAIN COMMAND ENGINE ===== */
let isBusy = false;

async function executeCommand(rawText) {
  const original =
    String(rawText || '').trim();

  if (!original || isBusy) {
    return;
  }

  isBusy = true;

  const command =
    normalizeCommand(original);

  add(
    'YOU: ' + original,
    'user'
  );

  MEMORY.push({
    role: 'user',
    text: original
  });

  trimMemory();
  saveMemory();

  if (input) {
    input.value = '';
  }

  try {
    if (
      /^(?:clear|clear memory|forget memory|delete memory)$/i.test(
        command
      )
    ) {
      clearMemory();
      return;
    }

    if (
      isAgentModeRequest(command)
    ) {
      const answer =
        await runAgent(command);

      add(
        'J.A.R.V.I.S: ' +
          answer,
        'ai'
      );

      MEMORY.push({
        role: 'model',
        text: answer
      });

      trimMemory();
      saveMemory();

      speak(answer);
      return;
    }

    const toolResult =
      await handleTools(command);

    if (toolResult) {
      add(
        'J.A.R.V.I.S: ' +
          toolResult,
        'ai'
      );

      MEMORY.push({
        role: 'model',
        text: toolResult
      });

      trimMemory();
      saveMemory();

      speak(toolResult);
      return;
    }

    const answer =
      await callGemini(command);

    add(
      'J.A.R.V.I.S: ' +
        answer,
      'ai'
    );

    MEMORY.push({
      role: 'model',
      text: answer
    });

    trimMemory();
    saveMemory();

    speak(answer);
  } catch (error) {
    console.error(error);

    const message =
      error?.message ||
      'Something went wrong.';

    add(
      'J.A.R.V.I.S: I could not complete that request. ' +
        message,
      'ai'
    );
  } finally {
    isBusy = false;
  }
}

/* ===== 10. EVENT WIRING - EXACT HTML IDs ===== */
if (sendBtn) {
  sendBtn.addEventListener(
    'click',
    () => {
      executeCommand(
        input?.value || ''
      );
    }
  );
}

if (input) {
  input.addEventListener(
    'keydown',
    event => {
      if (
        event.key === 'Enter' &&
        !event.shiftKey
      ) {
        event.preventDefault();
        executeCommand(
          input.value
        );
      }
    }
  );
}

if (micBtn) {
  micBtn.addEventListener(
    'click',
    toggleVoice
  );
}

if (clearBtn) {
  clearBtn.addEventListener(
    'click',
    clearMemory
  );
}

if (camBtn && imgInput) {
  camBtn.addEventListener(
    'click',
    () => {
      imgInput.click();
    }
  );
}

if (imgInput) {
  imgInput.addEventListener(
    'change',
    async event => {
      const file =
        event.target.files?.[0];

      if (file) {
        await analyzeImage(file);
      }

      event.target.value = '';
    }
  );
}

/* ===== 11. INITIAL STATUS ===== */
window.addEventListener(
  'load',
  () => {
    if (!chat) return;

    if (!MEMORY.length) {
      add(
        'J.A.R.V.I.S: System ready, Boss.',
        'ai'
      );
    }
  }
);
