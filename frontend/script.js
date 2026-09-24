const GEMINI_API_KEY = "PASTE_YOUR_GEMINI_API_KEY_HERE";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    GEMINI_MODEL +
    ":generateContent";

const TIME_ZONE = "Asia/Kolkata";
const TIME_API = "https://utctime.app/api/now/Asia/Kolkata";

const chatBox = document.getElementById("chat");
const messageInput = document.getElementById("msg");
const sendButton = document.getElementById("send");
const micButton = document.getElementById("mic-btn");
const camButton = document.getElementById("cam-btn");
const clearButton = document.getElementById("clear-btn");
const imageInput = document.getElementById("img-input");

let isProcessing = false;
let recognition = null;

let timeOffset = 0;
let timeOnline = false;
let timeSyncing = false;

let activeTimers = [];

let conversationHistory = [];

try {
    conversationHistory = JSON.parse(
        localStorage.getItem("jarvis_history") || "[]"
    );

    if (!Array.isArray(conversationHistory)) {
        conversationHistory = [];
    }
} catch (error) {
    conversationHistory = [];
}


/* =========================================================
   STORAGE
========================================================= */

function saveHistory() {
    try {
        localStorage.setItem(
            "jarvis_history",
            JSON.stringify(conversationHistory.slice(-40))
        );
    } catch (error) {
        console.warn("Memory save failed:", error);
    }
}


/* =========================================================
   TEXT HELPERS
========================================================= */

function cleanText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeText(text) {
    return cleanText(text)
        .toLowerCase()
        .replace(/[?!.,;:()[\]{}"'`]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function containsAny(text, words) {
    const t = normalizeText(text);

    return words.some(word => t.includes(normalizeText(word)));
}

function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}


/* =========================================================
   CHAT
========================================================= */

function addChatMessage(text, type) {
    if (!chatBox) return;

    const message = document.createElement("div");

    message.className =
        type === "user"
            ? "message user-message"
            : "message jarvis-message";

    const label = document.createElement("strong");

    label.textContent =
        type === "user"
            ? "YOU"
            : "J.A.R.V.I.S";

    const content = document.createElement("div");

    content.textContent = String(text || "");

    message.appendChild(label);
    message.appendChild(content);

    chatBox.appendChild(message);

    chatBox.scrollTop = chatBox.scrollHeight;
}

function userMessage(text) {
    addChatMessage(text, "user");
}

function jarvisMessage(text) {
    addChatMessage(text, "jarvis");
}

function speak(text) {
    if (!("speechSynthesis" in window)) {
        return;
    }

    try {
        window.speechSynthesis.cancel();

        const clean = String(text || "")
            .replace(/https?:\/\/\S+/g, "")
            .replace(/\n+/g, ". ")
            .slice(0, 1600);

        if (!clean.trim()) return;

        const voice = new SpeechSynthesisUtterance(clean);

        voice.lang = "en-IN";
        voice.rate = 1.02;
        voice.pitch = 1;
        voice.volume = 1;

        window.speechSynthesis.speak(voice);
    } catch (error) {
        console.warn("Speech error:", error);
    }
}

function reply(text, voice = true) {
    const answer =
        cleanText(text) ||
        "I could not find a reliable answer.";

    jarvisMessage(answer);

    conversationHistory.push({
        role: "model",
        text: answer,
        time: Date.now()
    });

    saveHistory();

    if (voice) {
        speak(answer);
    }

    return answer;
}


/* =========================================================
   FETCH
========================================================= */

async function fetchJSON(url, options = {}, timeout = 9000) {
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        return await response.json();
    } finally {
        clearTimeout(timeoutId);
    }
}


/* =========================================================
   1. LIVE TIME
========================================================= */

async function syncLiveTime() {
    if (timeSyncing) {
        return timeOnline;
    }

    timeSyncing = true;

    const started = Date.now();

    try {
        const response = await fetch(
            TIME_API + "?_=" + Date.now(),
            {
                method: "GET",
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error("Time server error");
        }

        const data = await response.json();

        const serverTime = Number(data.unix_ms);

        if (!Number.isFinite(serverTime)) {
            throw new Error("Invalid server time");
        }

        const ended = Date.now();

        const halfNetworkDelay =
            (ended - started) / 2;

        timeOffset =
            serverTime +
            halfNetworkDelay -
            ended;

        timeOnline = true;

        return true;

    } catch (error) {
        console.warn("Live time sync failed:", error);

        timeOnline = false;

        return false;

    } finally {
        timeSyncing = false;
    }
}

function getLiveDate() {
    return new Date(
        Date.now() + timeOffset
    );
}

function getCurrentTime() {
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    }).format(getLiveDate());
}

function getCurrentDate() {
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: TIME_ZONE,
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
    }).format(getLiveDate());
}

async function getTimeAnswer() {
    if (!timeOnline) {
        await syncLiveTime();
    }

    const time = getCurrentTime();
    const date = getCurrentDate();

    if (timeOnline) {
        return (
            "The current time is " +
            time +
            ". Today is " +
            date +
            ". Live India time is synchronized."
        );
    }

    return (
        "The current time is " +
        time +
        ". Today is " +
        date +
        "."
    );
}

function updateClockElements() {
    const time = getCurrentTime();

    const selectors = [
        "#clock",
        "#time",
        "#current-time",
        ".clock",
        ".time"
    ];

    selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
            element.textContent = time;
        });
    });
}

function startLiveClock() {
    updateClockElements();

    setInterval(
        updateClockElements,
        1000
    );

    setInterval(
        syncLiveTime,
        60000
    );
}

function isTimeCommand(text) {
    const t = normalizeText(text);

    return (
        t === "time" ||
        t === "tim" ||
        t === "tiem" ||
        t === "clock" ||
        t.includes("current time") ||
        t.includes("what time") ||
        t.includes("what is the time") ||
        t.includes("tell me time") ||
        t.includes("tell me the time") ||
        t.includes("time now") ||
        t.includes("show time") ||
        t.includes("time please") ||
        t.includes("time plz") ||
        t.includes("what tim") ||
        t.includes("టైమ్") ||
        t.includes("సమయం")
    );
}


/* =========================================================
   2. WEATHER
========================================================= */

async function getWeather() {
    if (!navigator.geolocation) {
        return "Location is not available in this browser.";
    }

    try {
        const position = await new Promise(
            (resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    resolve,
                    reject,
                    {
                        enableHighAccuracy: false,
                        timeout: 6000,
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
            "?latitude=" + latitude +
            "&longitude=" + longitude +
            "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m" +
            "&timezone=auto";

        const data = await fetchJSON(
            url,
            {},
            8000
        );

        const current = data.current;

        const weatherNames = {
            0: "clear sky",
            1: "mainly clear",
            2: "partly cloudy",
            3: "overcast",
            45: "fog",
            48: "fog",
            51: "light drizzle",
            53: "drizzle",
            55: "heavy drizzle",
            61: "light rain",
            63: "rain",
            65: "heavy rain",
            71: "light snow",
            73: "snow",
            75: "heavy snow",
            80: "rain showers",
            81: "rain showers",
            82: "heavy rain showers",
            95: "thunderstorm",
            96: "thunderstorm with hail",
            99: "thunderstorm with hail"
        };

        const condition =
            weatherNames[
                current.weather_code
            ] || "unknown conditions";

        return (
            "Current temperature is " +
            current.temperature_2m +
            "°C with " +
            condition +
            ". Feels like " +
            current.apparent_temperature +
            "°C. Humidity is " +
            current.relative_humidity_2m +
            "%. Wind speed is " +
            current.wind_speed_10m +
            " km/h."
        );

    } catch (error) {
        return (
            "I could not get live weather. " +
            "Please allow location permission and try again."
        );
    }
}

function isWeatherCommand(text) {
    return containsAny(text, [
        "weather",
        "temperature",
        "temp",
        "climate",
        "వాతావరణం",
        "టెంపరేచర్"
    ]);
}


/* =========================================================
   3. TIMER
========================================================= */

function parseTimer(text) {
    const t = normalizeText(text);

    let totalSeconds = 0;

    const hourMatch =
        t.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i);

    const minuteMatch =
        t.match(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|m)\b/i);

    const secondMatch =
        t.match(/(\d+(?:\.\d+)?)\s*(seconds?|secs?|sec|s)\b/i);

    if (hourMatch) {
        totalSeconds +=
            Number(hourMatch[1]) * 3600;
    }

    if (minuteMatch) {
        totalSeconds +=
            Number(minuteMatch[1]) * 60;
    }

    if (secondMatch) {
        totalSeconds +=
            Number(secondMatch[1]);
    }

    if (!totalSeconds) {
        const number =
            t.match(/\b(\d+)\b/);

        if (number) {
            totalSeconds =
                Number(number[1]) * 60;
        }
    }

    return Math.max(
        0,
        Math.round(totalSeconds)
    );
}

function isTimerCommand(text) {
    const t = normalizeText(text);

    return (
        t.includes("timer") ||
        t.includes("countdown") ||
        t.includes("టైమర్")
    );
}

function formatDuration(seconds) {
    const h =
        Math.floor(seconds / 3600);

    const m =
        Math.floor((seconds % 3600) / 60);

    const s =
        seconds % 60;

    const parts = [];

    if (h) {
        parts.push(
            h + " hour" +
            (h > 1 ? "s" : "")
        );
    }

    if (m) {
        parts.push(
            m + " minute" +
            (m > 1 ? "s" : "")
        );
    }

    if (s) {
        parts.push(
            s + " second" +
            (s > 1 ? "s" : "")
        );
    }

    return parts.join(" and ");
}

function startTimer(seconds) {
    if (!seconds || seconds < 1) {
        return (
            "Please tell me the timer duration. " +
            "For example: set timer for 2 minutes."
        );
    }

    const timer = {
        end: Date.now() + seconds * 1000,
        interval: null
    };

    timer.interval = setInterval(() => {
        if (Date.now() >= timer.end) {
            clearInterval(timer.interval);

            activeTimers =
                activeTimers.filter(
                    item => item !== timer
                );

            const message =
                "Timer finished.";

            jarvisMessage(message);
            speak(message);
        }
    }, 500);

    activeTimers.push(timer);

    return (
        "Timer set for " +
        formatDuration(seconds) +
        "."
    );
}


/* =========================================================
   4. DICE / COIN
========================================================= */

function isDiceCommand(text) {
    return containsAny(text, [
        "dice",
        "roll dice",
        "roll a dice",
        "roll the dice",
        "throw dice",
        "డైస్"
    ]);
}

function isCoinCommand(text) {
    return containsAny(text, [
        "coin",
        "flip coin",
        "flip a coin",
        "toss coin",
        "toss a coin",
        "heads or tails",
        "కాయిన్"
    ]);
}

function rollDice() {
    const number =
        Math.floor(Math.random() * 6) + 1;

    return "You rolled a " + number + ".";
}

function flipCoin() {
    return Math.random() < 0.5
        ? "The coin landed on Heads."
        : "The coin landed on Tails.";
}


/* =========================================================
   5. JOKE
========================================================= */

function isJokeCommand(text) {
    return containsAny(text, [
        "joke",
        "tell me a joke",
        "tell a joke",
        "make me laugh",
        "funny joke",
        "జోక్"
    ]);
}

async function getJoke() {
    try {
        const data = await fetchJSON(
            "https://official-joke-api.appspot.com/random_joke",
            {},
            7000
        );

        return (
            data.setup +
            " " +
            data.punchline
        );

    } catch (error) {
        return (
            "Why did the computer go to the doctor? " +
            "Because it had a byte problem."
        );
    }
}


/* =========================================================
   6. QUOTE
========================================================= */

function isQuoteCommand(text) {
    return containsAny(text, [
        "quote",
        "give me a quote",
        "motivational quote",
        "motivation quote",
        "inspirational quote",
        "మోటివేషన్"
    ]);
}

async function getQuote() {
    try {
        const data = await fetchJSON(
            "https://dummyjson.com/quotes/random",
            {},
            7000
        );

        return (
            '"' +
            data.quote +
            '" — ' +
            data.author
        );

    } catch (error) {
        return (
            '"The secret of getting ahead " +
            "is getting started." — Mark Twain'
        );
    }
}


/* =========================================================
   7. NEWS
========================================================= */

function isNewsCommand(text) {
    return containsAny(text, [
        "news",
        "latest news",
        "today news",
        "top news",
        "headlines",
        "latest headlines",
        "న్యూస్"
    ]);
}

async function getNews() {
    try {
        const rss =
            "https://news.google.com/rss" +
            "?hl=en-IN&gl=IN&ceid=IN:en";

        const url =
            "https://api.rss2json.com/v1/api.json" +
            "?rss_url=" +
            encodeURIComponent(rss);

        const data = await fetchJSON(
            url,
            {},
            9000
        );

        if (
            !data.items ||
            !data.items.length
        ) {
            throw new Error("No news");
        }

        const headlines =
            data.items
                .slice(0, 5)
                .map(
                    (item, index) =>
                        (index + 1) +
                        ". " +
                        item.title
                );

        return (
            "Latest headlines:\n" +
            headlines.join("\n")
        );

    } catch (error) {
        return (
            "Live news is temporarily unavailable. " +
            "Say search latest news to open Google."
        );
    }
}


/* =========================================================
   8. TRANSLATE
========================================================= */

const languageCodes = {
    english: "en",
    telugu: "te",
    hindi: "hi",
    tamil: "ta",
    kannada: "kn",
    malayalam: "ml",
    bengali: "bn",
    marathi: "mr",
    gujarati: "gu",
    punjabi: "pa",
    urdu: "ur",
    french: "fr",
    german: "de",
    spanish: "es",
    italian: "it",
    portuguese: "pt",
    russian: "ru",
    arabic: "ar",
    chinese: "zh",
    japanese: "ja",
    korean: "ko"
};

function extractTranslation(text) {
    const raw = cleanText(text);

    const patterns = [
        /^translate\s+(.+?)\s+(?:to|into)\s+([a-z]+)$/i,
        /^translate\s+"(.+?)"\s+(?:to|into)\s+([a-z]+)$/i,
        /^translate\s+(.+?)\s+in\s+([a-z]+)$/i
    ];

    for (const pattern of patterns) {
        const match =
            raw.match(pattern);

        if (match) {
            return {
                phrase: match[1],
                language: match[2]
            };
        }
    }

    return null;
}

function isTranslateCommand(text) {
    return normalizeText(text)
        .startsWith("translate");
}

async function translateText(phrase, language) {
    const target =
        languageCodes[
            language.toLowerCase()
        ] ||
        language.toLowerCase().slice(0, 2);

    try {
        const url =
            "https://api.mymemory.translated.net/get" +
            "?q=" +
            encodeURIComponent(phrase) +
            "&langpair=auto|" +
            encodeURIComponent(target);

        const data = await fetchJSON(
            url,
            {},
            8000
        );

        const result =
            data?.responseData?.translatedText;

        if (!result) {
            throw new Error("Translation failed");
        }

        return (
            "Translation: " +
            result
        );

    } catch (error) {
        return (
            "I could not translate that right now."
        );
    }
}


/* =========================================================
   9. CURRENCY
========================================================= */

function isCurrencyCommand(text) {
    return containsAny(text, [
        "currency",
        "convert money",
        "convert usd",
        "convert inr",
        "exchange rate",
        "exchange",
        "convert"
    ]);
}

function extractCurrency(text) {
    const raw = cleanText(text);

    const match =
        raw.match(
            /(?:convert|exchange)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]{3})\s+(?:to|into)\s+([A-Za-z]{3})/i
        );

    if (!match) {
        return null;
    }

    return {
        amount: Number(match[1]),
        from: match[2].toUpperCase(),
        to: match[3].toUpperCase()
    };
}

async function convertCurrency(
    amount,
    from,
    to
) {
    try {
        const url =
            "https://api.frankfurter.app/latest" +
            "?amount=" +
            encodeURIComponent(amount) +
            "&from=" +
            encodeURIComponent(from) +
            "&to=" +
            encodeURIComponent(to);

        const data = await fetchJSON(
            url,
            {},
            7000
        );

        if (
            !data.rates ||
            data.rates[to] === undefined
        ) {
            throw new Error("Rate unavailable");
        }

        const result =
            Number(data.rates[to]);

        return (
            amount +
            " " +
            from +
            " is approximately " +
            result.toFixed(2) +
            " " +
            to +
            "."
        );

    } catch (error) {
        return (
            "I could not get the current exchange rate."
        );
    }
}


/* =========================================================
   10. MEANING
========================================================= */

function extractMeaning(text) {
    const raw = cleanText(text);

    const patterns = [
        /^meaning of\s+(.+)$/i,
        /^define\s+(.+)$/i,
        /^definition of\s+(.+)$/i,
        /^what does\s+(.+?)\s+mean$/i,
        /^what is the meaning of\s+(.+)$/i
    ];

    for (const pattern of patterns) {
        const match =
            raw.match(pattern);

        if (match) {
            return match[1].trim();
        }
    }

    return null;
}

async function getMeaning(word) {
    try {
        const data = await fetchJSON(
            "https://api.dictionaryapi.dev/api/v2/entries/en/" +
            encodeURIComponent(word),
            {},
            7000
        );

        const meanings =
            data?.[0]?.meanings || [];

        for (const meaning of meanings) {
            const definition =
                meaning?.definitions?.[0]?.definition;

            if (definition) {
                return (
                    word +
                    ": " +
                    definition
                );
            }
        }

        return (
            "I could not find the meaning of " +
            word +
            "."
        );

    } catch (error) {
        return (
            "I could not find the meaning of " +
            word +
            "."
        );
    }
}
/* =========================================================
   11. PASSWORD
========================================================= */

function isPasswordCommand(text) {
    return containsAny(text, [
        "password",
        "generate password",
        "create password",
        "make password",
        "strong password",
        "పాస్వర్డ్"
    ]);
}

function generatePassword(length = 16) {
    length = Math.max(
        8,
        Math.min(64, Number(length) || 16)
    );

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ" +
        "abcdefghijkmnopqrstuvwxyz" +
        "23456789" +
        "!@#$%^&*";

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
                chars[
                    values[i] % chars.length
                ];
        }
    } else {
        for (let i = 0; i < length; i++) {
            password +=
                chars[
                    Math.floor(
                        Math.random() *
                        chars.length
                    )
                ];
        }
    }

    return password;
}


/* =========================================================
   12. SEARCH
========================================================= */

function isSearchCommand(text) {
    const t = normalizeText(text);

    return (
        t.startsWith("search ") ||
        t.startsWith("search for ") ||
        t.startsWith("google ") ||
        t.startsWith("look up ") ||
        t.startsWith("find ")
    );
}

function extractSearch(text) {
    const raw = cleanText(text);

    const patterns = [
        /^search for\s+(.+)$/i,
        /^search\s+(.+)$/i,
        /^google\s+(.+)$/i,
        /^look up\s+(.+)$/i,
        /^find\s+(.+)$/i
    ];

    for (const pattern of patterns) {
        const match =
            raw.match(pattern);

        if (match) {
            return match[1].trim();
        }
    }

    return null;
}

function searchGoogle(query) {
    const url =
        "https://www.google.com/search?q=" +
        encodeURIComponent(query);

    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );

    return (
        "Searching Google for " +
        query +
        "."
    );
}


/* =========================================================
   13. OPEN APPS
========================================================= */

const APP_URLS = {
    youtube: "https://www.youtube.com/",
    google: "https://www.google.com/",
    gmail: "https://mail.google.com/",
    maps: "https://maps.google.com/",
    whatsapp: "https://web.whatsapp.com/",
    instagram: "https://www.instagram.com/",
    facebook: "https://www.facebook.com/",
    github: "https://github.com/",
    chatgpt: "https://chatgpt.com/",
    spotify: "https://open.spotify.com/"
};

function extractApp(text) {
    const t = normalizeText(text);

    const apps =
        Object.keys(APP_URLS);

    for (const app of apps) {
        if (
            t === app ||
            t.includes("open " + app) ||
            t.includes("launch " + app) ||
            t.includes("start " + app)
        ) {
            return app;
        }
    }

    return null;
}

function openApp(app) {
    if (!APP_URLS[app]) {
        return "I could not find that application.";
    }

    window.open(
        APP_URLS[app],
        "_blank",
        "noopener,noreferrer"
    );

    return (
        "Opening " +
        app +
        "."
    );
}


/* =========================================================
   14. PLAY SONGS / YOUTUBE
========================================================= */

function isSongCommand(text) {
    const t = normalizeText(text);

    return (
        t.startsWith("play ") ||
        t.startsWith("play song ") ||
        t.startsWith("play music ") ||
        t.startsWith("youtube ")
    );
}

function extractSong(text) {
    const raw = cleanText(text);

    const patterns = [
        /^play song\s+(.+)$/i,
        /^play music\s+(.+)$/i,
        /^play\s+(.+)$/i,
        /^youtube\s+(.+)$/i
    ];

    for (const pattern of patterns) {
        const match =
            raw.match(pattern);

        if (match) {
            const query =
                match[1].trim();

            if (
                query &&
                query !== "music" &&
                query !== "song" &&
                query !== "a song"
            ) {
                return query;
            }
        }
    }

    return null;
}

function playSong(query) {
    const url =
        "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(query);

    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );

    return (
        "Searching YouTube for " +
        query +
        "."
    );
}


/* =========================================================
   15. CRYPTO
========================================================= */

const CRYPTO_IDS = {
    bitcoin: "bitcoin",
    btc: "bitcoin",
    ethereum: "ethereum",
    eth: "ethereum",
    solana: "solana",
    sol: "solana",
    dogecoin: "dogecoin",
    doge: "dogecoin",
    ripple: "ripple",
    xrp: "ripple",
    cardano: "cardano",
    ada: "cardano"
};

function isCryptoCommand(text) {
    return containsAny(text, [
        "crypto",
        "cryptocurrency",
        "bitcoin",
        "btc",
        "ethereum",
        "eth",
        "solana",
        "dogecoin",
        "doge",
        "ripple",
        "xrp",
        "cardano",
        "ada"
    ]);
}

function extractCrypto(text) {
    const t = normalizeText(text);

    for (const key in CRYPTO_IDS) {
        if (
            t.includes(key)
        ) {
            return CRYPTO_IDS[key];
        }
    }

    return null;
}

async function getCrypto(coin) {
    try {
        const url =
            "https://api.coingecko.com/api/v3/simple/price" +
            "?ids=" +
            encodeURIComponent(coin) +
            "&vs_currencies=usd,inr" +
            "&include_24hr_change=true";

        const data = await fetchJSON(
            url,
            {},
            8000
        );

        if (!data[coin]) {
            return (
                "I could not find that cryptocurrency."
            );
        }

        const usd =
            Number(data[coin].usd);

        const inr =
            Number(data[coin].inr);

        const change =
            Number(
                data[coin].usd_24h_change
            );

        return (
            coin +
            " is approximately $" +
            usd.toLocaleString() +
            " and ₹" +
            inr.toLocaleString("en-IN") +
            ". 24-hour change is " +
            change.toFixed(2) +
            "%."
        );

    } catch (error) {
        return (
            "Live cryptocurrency data is temporarily unavailable."
        );
    }
}


/* =========================================================
   BASIC COMMANDS
========================================================= */

function basicCommand(text) {
    const t = normalizeText(text);

    if (
        t === "hi" ||
        t === "hello" ||
        t === "hey" ||
        t.includes("hello jarvis") ||
        t.includes("hi jarvis")
    ) {
        return (
            "Hello. J.A.R.V.I.S is online and ready."
        );
    }

    if (
        t.includes("who are you") ||
        t.includes("what are you")
    ) {
        return (
            "I am J.A.R.V.I.S, your personal AI assistant."
        );
    }

    if (
        t.includes("how are you") ||
        t.includes("how r u")
    ) {
        return (
            "All systems are operational and ready."
        );
    }

    if (
        t === "thanks" ||
        t === "thank you" ||
        t === "thank u"
    ) {
        return "You're welcome, Boss.";
    }

    if (
        t === "status" ||
        t === "system status"
    ) {
        return (
            "AI engine operational. Connection online. Voice interface ready. Memory active."
        );
    }

    return null;
}


/* =========================================================
   GEMINI AI
   Handles unknown questions + spelling mistakes
========================================================= */

async function askGemini(userText, imageData = null) {
    if (
        !GEMINI_API_KEY ||
        GEMINI_API_KEY ===
        "PASTE_YOUR_GEMINI_API_KEY_HERE"
    ) {
        return null;
    }

    const history =
        conversationHistory
            .slice(-12)
            .map(item => ({
                role:
                    item.role === "model"
                        ? "model"
                        : "user",
                parts: [
                    {
                        text: item.text
                    }
                ]
            }));

    const instruction = `
You are J.A.R.V.I.S, a fast personal AI assistant.

Understand the user's intended meaning even when:
- spelling is wrong
- grammar is wrong
- words are missing
- speech recognition makes mistakes
- English and Telugu are mixed
- the command is informal or short

Correct the user's intended meaning silently.
Do not criticize spelling or grammar.

Answer the user's actual request directly.
Be concise unless the question needs explanation.

For current/live information:
never invent data.
If the application already supplies live data, use it.
If live data is unavailable, say that clearly.

If the user asks the current time, use the application's India time.
Current India time: ${getCurrentTime()}
Current India date: ${getCurrentDate()}
`;

    const parts = [
        {
            text:
                instruction +
                "\n\nUser request:\n" +
                userText
        }
    ];

    if (imageData) {
        parts.push({
            inline_data: {
                mime_type:
                    imageData.mimeType,
                data:
                    imageData.data
            }
        });
    }

    try {
        const response =
            await fetch(
                GEMINI_URL,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                        "x-goog-api-key":
                            GEMINI_API_KEY
                    },
                    body: JSON.stringify({
                        contents: [
                            ...history,
                            {
                                role: "user",
                                parts
                            }
                        ],
                        generationConfig: {
                            temperature: 0.2,
                            maxOutputTokens: 700
                        }
                    })
                }
            );

        if (!response.ok) {
            const errorText =
                await response.text();

            console.error(
                "Gemini API error:",
                errorText
            );

            return null;
        }

        const data =
            await response.json();

        const answer =
            data?.candidates?.[0]
                ?.content?.parts
                ?.map(
                    part =>
                        part.text || ""
                )
                .join("")
                .trim();

        return answer || null;

    } catch (error) {
        console.error(
            "Gemini connection error:",
            error
        );

        return null;
    }
}


/* =========================================================
   IMAGE ANALYSIS
========================================================= */

function fileToBase64(file) {
    return new Promise(
        (resolve, reject) => {
            const reader =
                new FileReader();

            reader.onload = () => {
                const result =
                    String(
                        reader.result || ""
                    );

                const comma =
                    result.indexOf(",");

                if (comma === -1) {
                    reject(
                        new Error(
                            "Invalid image"
                        )
                    );

                    return;
                }

                resolve({
                    mimeType:
                        file.type ||
                        "image/jpeg",
                    data:
                        result.slice(
                            comma + 1
                        )
                });
            };

            reader.onerror = reject;

            reader.readAsDataURL(file);
        }
    );
}

async function analyzeImage(file) {
    if (!file) {
        return "No image selected.";
    }

    if (!file.type.startsWith("image/")) {
        return "Please select an image file.";
    }

    if (file.size > 10 * 1024 * 1024) {
        return (
            "The image is too large. " +
            "Please select an image below 10 MB."
        );
    }

    try {
        const imageData =
            await fileToBase64(file);

        const answer =
            await askGemini(
                "Analyze this image carefully. Describe what is visible. If there is readable text, extract the important text. If there are objects, people, places or other details, describe only what can actually be seen. Do not invent details.",
                imageData
            );

        return (
            answer ||
            "Image loaded, but AI image analysis is unavailable. Please check the Gemini API key."
        );

    } catch (error) {
        return (
            "I could not analyze this image."
        );
    }
}


/* =========================================================
   MAIN TOOL ROUTER
========================================================= */

async function handleTools(text) {
    const original =
        cleanText(text);

    const t =
        normalizeText(original);

    if (!t) {
        return "Please enter a command.";
    }


    /* 1 TIME */
    if (isTimeCommand(t)) {
        return await getTimeAnswer();
    }


    /* 2 WEATHER */
    if (isWeatherCommand(t)) {
        return await getWeather();
    }


    /* 3 TIMER */
    if (isTimerCommand(t)) {
        const seconds =
            parseTimer(t);

        return startTimer(seconds);
    }


    /* 4 DICE */
    if (isDiceCommand(t)) {
        return rollDice();
    }


    /* 4 COIN */
    if (isCoinCommand(t)) {
        return flipCoin();
    }


    /* 5 JOKE */
    if (isJokeCommand(t)) {
        return await getJoke();
    }


    /* 6 QUOTE */
    if (isQuoteCommand(t)) {
        return await getQuote();
    }


    /* 7 NEWS */
    if (isNewsCommand(t)) {
        return await getNews();
    }


    /* 8 TRANSLATE */
    if (isTranslateCommand(t)) {
        const translation =
            extractTranslation(original);

        if (!translation) {
            return (
                "Try: translate hello to Telugu."
            );
        }

        return await translateText(
            translation.phrase,
            translation.language
        );
    }


    /* 9 CURRENCY */
    if (isCurrencyCommand(t)) {
        const currency =
            extractCurrency(original);

        if (!currency) {
            return (
                "Try: convert 100 USD to INR."
            );
        }

        return await convertCurrency(
            currency.amount,
            currency.from,
            currency.to
        );
    }


    /* 10 MEANING */
    const word =
        extractMeaning(original);

    if (word) {
        return await getMeaning(word);
    }


    /* 11 PASSWORD */
    if (isPasswordCommand(t)) {
        const match =
            t.match(/\b(\d{1,2})\b/);

        const length =
            match
                ? Number(match[1])
                : 16;

        return (
            "Generated password: " +
            generatePassword(length)
        );
    }


    /* 12 SEARCH */
    if (isSearchCommand(t)) {
        const query =
            extractSearch(original);

        if (!query) {
            return (
                "Tell me what you want me to search for."
            );
        }

        return searchGoogle(query);
    }


    /* 13 OPEN APPS */
    const app =
        extractApp(original);

    if (app) {
        return openApp(app);
    }


    /* 14 SONGS */
    if (isSongCommand(original)) {
        const song =
            extractSong(original);

        if (song) {
            return playSong(song);
        }

        return (
            "Tell me the song or artist you want to play."
        );
    }


    /* 15 CRYPTO */
    if (isCryptoCommand(t)) {
        const coin =
            extractCrypto(t);

        if (coin) {
            return await getCrypto(coin);
        }

        return (
            "Tell me the cryptocurrency name, for example Bitcoin."
        );
    }


    /* BASIC */
    const basic =
        basicCommand(original);

    if (basic) {
        return basic;
    }


    return null;
}


/* =========================================================
   MAIN COMMAND PROCESSOR
========================================================= */

async function processCommand(text) {
    const command =
        cleanText(text);

    if (!command) {
        return;
    }

    if (isProcessing) {
        return;
    }

    isProcessing = true;

    userMessage(command);

    conversationHistory.push({
        role: "user",
        text: command,
        time: Date.now()
    });

    saveHistory();

    if (messageInput) {
        messageInput.value = "";
    }

    try {
        let answer =
            await handleTools(command);


        /* Known tools reply immediately.
           Unknown/mistyped questions go to Gemini. */

        if (!answer) {
            answer =
                await askGemini(command);
        }


        if (!answer) {
            answer =
                "I understood your request, but I could not get a reliable answer right now.";
        }

        reply(
            answer,
            true
        );

    } catch (error) {
        console.error(
            "JARVIS command error:",
            error
        );

        reply(
            "Something went wrong while processing that request. Please try again.",
            true
        );

    } finally {
        isProcessing = false;
    }
}


/* =========================================================
   VOICE INPUT
========================================================= */

function setupVoice() {
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (
        !SpeechRecognition ||
        !micButton
    ) {
        return;
    }

    recognition =
        new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
        micButton.classList.add(
            "listening"
        );

        if (messageInput) {
            messageInput.placeholder =
                "Listening...";
        }
    };

    recognition.onresult = event => {
        const result =
            event.results?.[0]?.[0]
                ?.transcript || "";

        if (messageInput) {
            messageInput.value =
                result;
        }

        if (result.trim()) {
            processCommand(result);
        }
    };

    recognition.onerror = event => {
        console.warn(
            "Voice recognition:",
            event.error
        );
    };

    recognition.onend = () => {
        micButton.classList.remove(
            "listening"
        );

        if (messageInput) {
            messageInput.placeholder =
                "Enter a command for J.A.R.V.I.S...";
        }
    };

    micButton.addEventListener(
        "click",
        () => {
            try {
                recognition.start();
            } catch (error) {
                try {
                    recognition.stop();
                } catch (e) {}
            }
        }
    );
}


/* =========================================================
   CAMERA
========================================================= */

function setupCamera() {
    if (
        !camButton ||
        !imageInput
    ) {
        return;
    }

    camButton.addEventListener(
        "click",
        () => {
            imageInput.click();
        }
    );

    imageInput.addEventListener(
        "change",
        async () => {
            const file =
                imageInput.files?.[0];

            if (!file) {
                return;
            }

            if (isProcessing) {
                return;
            }

            isProcessing = true;

            userMessage(
                "Analyze this image"
            );

            try {
                const answer =
                    await analyzeImage(file);

                reply(
                    answer,
                    true
                );
            } finally {
                imageInput.value = "";
                isProcessing = false;
            }
        }
    );
}


/* =========================================================
   INPUT
========================================================= */

function setupInput() {
    if (sendButton) {
        sendButton.addEventListener(
            "click",
            () => {
                processCommand(
                    messageInput
                        ? messageInput.value
                        : ""
                );
            }
        );
    }

    if (messageInput) {
        messageInput.addEventListener(
            "keydown",
            event => {
                if (
                    event.key === "Enter"
                ) {
                    event.preventDefault();

                    processCommand(
                        messageInput.value
                    );
                }
            }
        );
    }
}


/* =========================================================
   CLEAR MEMORY
========================================================= */

function setupClearMemory() {
    if (!clearButton) {
        return;
    }

    clearButton.addEventListener(
        "click",
        () => {
            conversationHistory.length = 0;

            try {
                localStorage.removeItem(
                    "jarvis_history"
                );
            } catch (error) {}

            if (chatBox) {
                chatBox.innerHTML = "";
            }

            const message =
                "Memory cleared. J.A.R.V.I.S is ready.";

            jarvisMessage(message);
            speak(message);
        }
    );
}


/* =========================================================
   FEATURE CARDS
   Supports the 15 cards shown in your screenshot.
========================================================= */

function executeFeature(feature) {
    const f =
        normalizeText(feature);

    if (
        f.includes("time") ||
        f.includes("clock")
    ) {
        processCommand(
            "current time"
        );

    } else if (
        f.includes("weather")
    ) {
        processCommand(
            "weather"
        );

    } else if (
        f.includes("timer")
    ) {
        processCommand(
            "set timer for 1 minute"
        );

    } else if (
        f.includes("dice") ||
        f.includes("coin")
    ) {
        processCommand(
            f.includes("coin")
                ? "flip coin"
                : "roll dice"
        );

    } else if (
        f.includes("joke")
    ) {
        processCommand(
            "tell me a joke"
        );

    } else if (
        f.includes("quote")
    ) {
        processCommand(
            "give me a quote"
        );

    } else if (
        f.includes("news")
    ) {
        processCommand(
            "latest news"
        );

    } else if (
        f.includes("translate")
    ) {
        processCommand(
            "translate hello to Telugu"
        );

    } else if (
        f.includes("currency")
    ) {
        processCommand(
            "convert 100 USD to INR"
        );

    } else if (
        f.includes("meaning")
    ) {
        processCommand(
            "meaning of artificial intelligence"
        );

    } else if (
        f.includes("password")
    ) {
        processCommand(
            "generate strong password"
        );

    } else if (
        f.includes("search")
    ) {
        processCommand(
            "search for latest technology news"
        );

    } else if (
        f.includes("open apps") ||
        f === "open app"
    ) {
        processCommand(
            "open Google"
        );

    } else if (
        f.includes("play songs") ||
        f.includes("play song")
    ) {
        processCommand(
            "play music"
        );

    } else if (
        f.includes("crypto")
    ) {
        processCommand(
            "Bitcoin price"
        );
    }
}

function setupFeatureCards() {
    const selectors = [
        ".feature",
        ".feature-card",
        ".tool",
        ".tool-card",
        ".feature-item",
        ".tool-item",
        "[data-feature]",
        "[data-command]"
    ];

    const cards =
        document.querySelectorAll(
            selectors.join(",")
        );

    cards.forEach(card => {
        if (
            card.dataset.jarvisFeatureBound ===
            "1"
        ) {
            return;
        }

        card.dataset.jarvisFeatureBound =
            "1";

        card.addEventListener(
            "click",
            event => {
                const dataCommand =
                    card.getAttribute(
                        "data-command"
                    );

                const dataFeature =
                    card.getAttribute(
                        "data-feature"
                    );

                if (
                    dataCommand
                ) {
                    processCommand(
                        dataCommand
                    );

                    return;
                }

                if (
                    dataFeature
                ) {
                    executeFeature(
                        dataFeature
                    );

                    return;
                }

                executeFeature(
                    card.textContent
                );
            }
        );
    });
}


/* =========================================================
   RESTORE MEMORY
========================================================= */

function restoreHistory() {
    if (!chatBox) {
        return;
    }

    const recent =
        conversationHistory.slice(-12);

    recent.forEach(item => {
        addChatMessage(
            item.text,
            item.role === "user"
                ? "user"
                : "jarvis"
        );
    });
}

function showStartupMessage() {
    if (
        !chatBox ||
        conversationHistory.length
    ) {
        return;
    }

    jarvisMessage(
        "J.A.R.V.I.S online. All systems ready. Ask me anything."
    );
}


/* =========================================================
   START
========================================================= */

function initJarvis() {
    setupInput();
    setupVoice();
    setupCamera();
    setupClearMemory();
    setupFeatureCards();

    restoreHistory();
    showStartupMessage();

    syncLiveTime();
    startLiveClock();

    if (messageInput) {
        setTimeout(() => {
            messageInput.focus();
        }, 150);
    }
}

if (
    document.readyState === "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        initJarvis,
        { once: true }
    );
} else {
    initJarvis();
}
