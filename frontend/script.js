/* =========================================================
   J.A.R.V.I.S - COMPLETE WORKING SCRIPT
   PART 1
   ========================================================= */

"use strict";

/* =========================================================
   CONFIG
   ========================================================= */

const JARVIS_CONFIG = {
    TIME_ZONE: "Asia/Kolkata",

    // Live time APIs - first one is tried first
    TIME_APIS: [
        "https://timeapi.io/api/Time/current/zone?timeZone=Asia/Kolkata",
        "https://utctime.app/api/now/Asia/Kolkata"
    ],

    WEATHER_API:
        "https://api.open-meteo.com/v1/forecast",

    DICTIONARY_API:
        "https://api.dictionaryapi.dev/api/v2/entries/en/",

    TRANSLATE_API:
        "https://api.mymemory.translated.net/get",

    CURRENCY_API:
        "https://open.er-api.com/v6/latest/",

    CRYPTO_API:
        "https://api.coingecko.com/api/v3/simple/price",

    JOKE_API:
        "https://official-joke-api.appspot.com/random_joke",

    QUOTE_API:
        "https://dummyjson.com/quotes/random",

    NEWS_API:
        "https://api.rss2json.com/v1/api.json?rss_url=" +
        encodeURIComponent(
            "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en"
        ),

    STORAGE_KEY: "jarvis_memory_v2"
};


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const chat =
    document.getElementById("chat");

const msg =
    document.getElementById("msg");

const sendBtn =
    document.getElementById("send");

const micBtn =
    document.getElementById("mic-btn");

const camBtn =
    document.getElementById("cam-btn");

const clearBtn =
    document.getElementById("clear-btn");

const imgInput =
    document.getElementById("img-input");


/* =========================================================
   STATE
   ========================================================= */

let liveTimeOffset = 0;
let liveTimeSynced = false;
let timeSyncPromise = null;

let recognition = null;
let isListening = false;

let currentTimer = null;

let weatherCache = null;
let weatherCacheTime = 0;


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function normalizeText(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}


function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = String(text ?? "");
    return div.innerHTML;
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function fetchJSON(url, options = {}, timeout = 10000) {

    const controller = new AbortController();

    const timer = setTimeout(() => {
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

        clearTimeout(timer);
    }
}


/* =========================================================
   CHAT OUTPUT
   ========================================================= */

function addMessage(text, type = "jarvis") {

    if (!chat) return;

    const div = document.createElement("div");

    div.className =
        type === "user"
            ? "user-message"
            : "jarvis-message";

    div.innerHTML = escapeHTML(text)
        .replace(/\n/g, "<br>");

    chat.appendChild(div);

    chat.scrollTop = chat.scrollHeight;
}


function userMessage(text) {
    addMessage(text, "user");
}


function jarvisMessage(text) {
    addMessage(text, "jarvis");
}


function reply(text, speakIt = true) {

    const clean = String(text || "")
        .trim();

    if (!clean) return "";

    // IMPORTANT:
    // Always display response in chat box
    jarvisMessage(clean);

    if (speakIt) {
        speak(clean);
    }

    return clean;
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

        const utterance =
            new SpeechSynthesisUtterance(
                String(text)
            );

        utterance.lang = "en-IN";
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        window.speechSynthesis.speak(
            utterance
        );

    } catch (error) {
        console.warn("Speech error:", error);
    }
}


/* =========================================================
   LIVE INTERNET TIME
   ========================================================= */

function parseTimeAPI(data) {

    if (!data) return null;

    let dateValue = null;

    // timeapi.io
    if (data.dateTime) {
        dateValue = new Date(data.dateTime);
    }

    // utcTime / datetime / dateTime variants
    if (
        !dateValue ||
        Number.isNaN(dateValue.getTime())
    ) {

        const candidates = [
            data.utc_datetime,
            data.utcDateTime,
            data.datetime,
            data.dateTime,
            data.currentDateTime,
            data.timestamp
        ];

        for (const value of candidates) {

            if (!value) continue;

            const d = new Date(value);

            if (!Number.isNaN(d.getTime())) {
                dateValue = d;
                break;
            }
        }
    }

    if (
        !dateValue ||
        Number.isNaN(dateValue.getTime())
    ) {
        return null;
    }

    return dateValue;
}


async function syncLiveTime() {

    if (timeSyncPromise) {
        return timeSyncPromise;
    }

    timeSyncPromise = (async () => {

        const requestStart =
            Date.now();

        for (const api of JARVIS_CONFIG.TIME_APIS) {

            try {

                const data =
                    await fetchJSON(
                        api,
                        {},
                        5000
                    );

                const serverDate =
                    parseTimeAPI(data);

                if (!serverDate) {
                    continue;
                }

                const requestEnd =
                    Date.now();

                const networkDelay =
                    (requestEnd - requestStart) / 2;

                liveTimeOffset =
                    serverDate.getTime()
                    + networkDelay
                    - Date.now();

                liveTimeSynced = true;

                return true;

            } catch (error) {

                console.warn(
                    "Time API failed:",
                    api,
                    error
                );
            }
        }

        liveTimeSynced = false;
        return false;

    })();

    try {
        return await timeSyncPromise;
    } finally {
        timeSyncPromise = null;
    }
}


function getLiveDate() {

    return new Date(
        Date.now() + liveTimeOffset
    );
}


function formatLiveTime() {

    const date =
        getLiveDate();

    return new Intl.DateTimeFormat(
        "en-IN",
        {
            timeZone:
                JARVIS_CONFIG.TIME_ZONE,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        }
    ).format(date);
}


function formatLiveDate() {

    const date =
        getLiveDate();

    return new Intl.DateTimeFormat(
        "en-IN",
        {
            timeZone:
                JARVIS_CONFIG.TIME_ZONE,
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric"
        }
    ).format(date);
}


async function getTime() {

    if (!liveTimeSynced) {
        await syncLiveTime();
    }

    const time =
        formatLiveTime();

    const date =
        formatLiveDate();

    return (
        `The current time is ${time}. ` +
        `Today is ${date}.`
    );
}


/* =========================================================
   LIVE CLOCK SUPPORT
   ========================================================= */

function updateClockElements() {

    const time =
        formatLiveTime();

    const selectors = [
        "#clock",
        "#time",
        "#current-time",
        ".clock",
        ".time"
    ];

    selectors.forEach(selector => {

        document
            .querySelectorAll(selector)
            .forEach(element => {

                element.textContent = time;

            });
    });
}


async function startLiveClock() {

    await syncLiveTime();

    updateClockElements();

    setInterval(async () => {

        await syncLiveTime();

        updateClockElements();

    }, 60000);

    setInterval(() => {
        updateClockElements();
    }, 1000);
}


/* =========================================================
   TIME COMMAND DETECTION
   ========================================================= */

function isTimeCommand(text) {

    const t =
        normalizeText(text);

    return (
        t === "time" ||
        t.includes("what time") ||
        t.includes("current time") ||
        t.includes("tell me the time") ||
        t.includes("time now") ||
        t.includes("present time") ||
        t.includes("clock") ||
        t.includes("సమయం") ||
        t.includes("టైమ్") ||
        t.includes("ఇప్పుడు టైమ్")
    );
}


/* =========================================================
   WEATHER
   ========================================================= */

function getWeatherCodeDescription(code) {

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


function getLocation() {

    return new Promise((resolve, reject) => {

        if (!navigator.geolocation) {
            reject(
                new Error(
                    "Geolocation is not supported."
                )
            );
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position => {

                resolve({
                    latitude:
                        position.coords.latitude,

                    longitude:
                        position.coords.longitude
                });

            },

            error => {
                reject(error);
            },

            {
                enableHighAccuracy: false,
                timeout: 7000,
                maximumAge: 300000
            }
        );
    });
}


async function getWeather() {

    const now =
        Date.now();

    // 2 minute cache
    if (
        weatherCache &&
        now - weatherCacheTime < 120000
    ) {
        return weatherCache;
    }

    try {

        const location =
            await getLocation();

        const url =
            `${JARVIS_CONFIG.WEATHER_API}` +
            `?latitude=${location.latitude}` +
            `&longitude=${location.longitude}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
            `&timezone=auto`;

        const data =
            await fetchJSON(
                url,
                {},
                8000
            );

        const current =
            data.current;

        if (!current) {
            throw new Error(
                "Weather data unavailable"
            );
        }

        const description =
            getWeatherCodeDescription(
                current.weather_code
            );

        const result =
            `Current temperature is ${current.temperature_2m}°C, ` +
            `feels like ${current.apparent_temperature}°C. ` +
            `Humidity is ${current.relative_humidity_2m}%. ` +
            `Conditions are ${description}. ` +
            `Wind speed is ${current.wind_speed_10m} km/h.`;

        weatherCache = result;
        weatherCacheTime = now;

        return result;

    } catch (error) {

        return (
            "I couldn't access your live weather right now. " +
            "Please allow location permission and try again."
        );
    }
}


/* =========================================================
   TIMER
   ========================================================= */

function extractTimerSeconds(text) {

    const t =
        normalizeText(text);

    let match =
        t.match(
            /(\d+(?:\.\d+)?)\s*(seconds?|secs?|sec|s)\b/i
        );

    if (match) {
        return Number(match[1]);
    }

    match =
        t.match(
            /(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|m)\b/i
        );

    if (match) {
        return Number(match[1]) * 60;
    }

    match =
        t.match(
            /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h)\b/i
        );

    if (match) {
        return Number(match[1]) * 3600;
    }

    return null;
}


function isTimerCommand(text) {

    const t =
        normalizeText(text);

    return (
        t.includes("timer") ||
        t.includes("set a timer") ||
        t.includes("set timer") ||
        t.includes("countdown") ||
        t.includes("టైమర్")
    );
}


function setJarvisTimer(text) {

    const seconds =
        extractTimerSeconds(text);

    if (!seconds || seconds <= 0) {

        return (
            "Please specify the timer duration, " +
            "for example: set timer for 30 seconds."
        );
    }

    if (currentTimer) {
        clearTimeout(currentTimer);
    }

    currentTimer =
        setTimeout(() => {

            reply(
                "Timer finished.",
                true
            );

            currentTimer = null;

        }, seconds * 1000);

    return (
        `Timer set for ${seconds} second` +
        (seconds === 1 ? "" : "s") +
        "."
    );
}


/* =========================================================
   DICE / COIN
   ========================================================= */

function diceCommand(text) {

    const t =
        normalizeText(text);

    if (
        t.includes("coin") ||
        t.includes("toss")
    ) {

        const result =
            Math.random() < 0.5
                ? "Heads"
                : "Tails";

        return `Coin toss result: ${result}.`;
    }

    const sidesMatch =
        t.match(
            /(?:d|dice)\s*(\d+)/i
        );

    const sides =
        sidesMatch
            ? Math.max(
                2,
                Number(sidesMatch[1])
              )
            : 6;

    const result =
        Math.floor(
            Math.random() * sides
        ) + 1;

    return (
        `You rolled a ${sides}-sided die. ` +
        `Result: ${result}.`
    );
}


function isDiceCommand(text) {

    const t =
        normalizeText(text);

    return (
        t.includes("dice") ||
        t.includes("roll dice") ||
        t.includes("roll a die") ||
        t.includes("coin toss") ||
        t.includes("toss coin") ||
        t.includes("flip coin") ||
        t.includes("coin")
    );
}


/* =========================================================
   JOKE
   ========================================================= */

async function getJoke() {

    try {

        const data =
            await fetchJSON(
                JARVIS_CONFIG.JOKE_API,
                {},
                7000
            );

        if (
            data &&
            data.setup &&
            data.punchline
        ) {

            return (
                `${data.setup}\n${data.punchline}`
            );
        }

    } catch (error) {}

    return (
        "Why did the computer go to the doctor? " +
        "Because it had a virus."
    );
}


function isJokeCommand(text) {

    const t =
        normalizeText(text);

    return (
        t.includes("joke") ||
        t.includes("tell me a joke") ||
        t.includes("make me laugh") ||
        t.includes("జోక్")
    );
}


/* =========================================================
   QUOTE
   ========================================================= */

async function getQuote() {

    try {

        const data =
            await fetchJSON(
                JARVIS_CONFIG.QUOTE_API,
                {},
                7000
            );

        if (data?.quote) {

            return (
                `"${data.quote}" — ${data.author || "Unknown"}`
            );
        }

    } catch (error) {}

    return (
        `"The secret of getting ahead is getting started."`
    );
}


function isQuoteCommand(text) {

    const t =
        normalizeText(text);

    return (
        t.includes("quote") ||
        t.includes("motivation") ||
        t.includes("motivational") ||
        t.includes("inspire me") ||
        t.includes("మోటివేషన్") ||
        t.includes("కోట")
    );
}


/* =========================================================
   TRANSLATION
   ========================================================= */

function extractTranslation(text) {

    let match =
        text.match(
            /translate\s+(.+?)\s+(?:to|into)\s+([a-zA-Z-]+)$/i
        );

    if (match) {

        return {
            phrase: match[1].trim(),
            language: match[2].trim()
        };
    }

    match =
        text.match(
            /(.+?)\s+(?:to|into)\s+([a-zA-Z-]+)$/i
        );

    if (
        match &&
        (
            normalizeText(text).includes("translate")
        )
    ) {

        return {
            phrase: match[1].trim(),
            language: match[2].trim()
        };
    }

    return null;
}


const languageCodes = {

    english: "en",
    hindi: "hi",
    telugu: "te",
    tamil: "ta",
    kannada: "kn",
    malayalam: "ml",
    marathi: "mr",
    bengali: "bn",
    gujarati: "gu",
    punjabi: "pa",
    french: "fr",
    german: "de",
    spanish: "es",
    italian: "it",
    portuguese: "pt",
    russian: "ru",
    japanese: "ja",
    korean: "ko",
    chinese: "zh"
};


async function translateText(text) {

    const info =
        extractTranslation(text);

    if (!info) {

        return (
            "Use translation like: " +
            "translate hello to Telugu."
        );
    }

    const target =
        languageCodes[
            normalizeText(info.language)
        ] || info.language;

    try {

        const url =
            `${JARVIS_CONFIG.TRANSLATE_API}` +
            `?q=${encodeURIComponent(info.phrase)}` +
            `&langpair=en|${encodeURIComponent(target)}`;

        const data =
            await fetchJSON(
                url,
                {},
                8000
            );

        const result =
            data?.responseData?.translatedText;

        if (result) {

            return (
                `Translation: ${result}`
            );
        }

    } catch (error) {}

    return (
        "Translation service is temporarily unavailable."
    );
}


function isTranslateCommand(text) {

    return normalizeText(text)
        .includes("translate");
}
/* =========================================================
   J.A.R.V.I.S
   PART 2
   ========================================================= */


/* =========================================================
   CURRENCY
   ========================================================= */

const currencyNames = {

    usd: "USD",
    dollar: "USD",
    dollars: "USD",

    inr: "INR",
    rupee: "INR",
    rupees: "INR",

    eur: "EUR",
    euro: "EUR",

    gbp: "GBP",
    pound: "GBP",

    jpy: "JPY",
    yen: "JPY",

    aud: "AUD",
    cad: "CAD",
    aed: "AED",
    sar: "SAR",
    cny: "CNY"
};


function findCurrencyCode(value) {

    const clean =
        normalizeText(value);

    return (
        currencyNames[clean] ||
        clean.toUpperCase()
    );
}


function extractCurrency(text) {

    const t =
        normalizeText(text);

    let match =
        t.match(
            /(\d+(?:\.\d+)?)\s*([a-z]{3}|dollars?|rupees?|euros?|pounds?)\s+(?:to|in)\s+([a-z]{3}|dollars?|rupees?|euros?|pounds?)/i
        );

    if (match) {

        return {
            amount: Number(match[1]),
            from: findCurrencyCode(match[2]),
            to: findCurrencyCode(match[3])
        };
    }

    match =
        t.match(
            /([a-z]{3}|dollars?|rupees?|euros?|pounds?)\s*(\d+(?:\.\d+)?)\s+(?:to|in)\s+([a-z]{3}|dollars?|rupees?|euros?|pounds?)/i
        );

    if (match) {

        return {
            amount: Number(match[2]),
            from: findCurrencyCode(match[1]),
            to: findCurrencyCode(match[3])
        };
    }

    return null;
}


async function convertCurrency(text) {

    const info =
        extractCurrency(text);

    if (!info) {

        return (
            "Use currency like: " +
            "100 USD to INR."
        );
    }

    if (info.from === info.to) {

        return (
            `${info.amount} ${info.from} = ` +
            `${info.amount} ${info.to}.`
        );
    }

    try {

        const url =
            `${JARVIS_CONFIG.CURRENCY_API}` +
            encodeURIComponent(info.from);

        const data =
            await fetchJSON(
                url,
                {},
                8000
            );

        const rate =
            data?.rates?.[info.to];

        if (!rate) {
            throw new Error("Rate unavailable");
        }

        const result =
            info.amount * rate;

        return (
            `${info.amount} ${info.from} = ` +
            `${result.toFixed(2)} ${info.to}.`
        );

    } catch (error) {

        return (
            "I couldn't get the live exchange rate right now."
        );
    }
}


function isCurrencyCommand(text) {

    const t =
        normalizeText(text);

    return (
        t.includes("currency") ||
        t.includes("convert") &&
        (
            t.includes("usd") ||
            t.includes("inr") ||
            t.includes("eur") ||
            t.includes("gbp") ||
            t.includes("rupee") ||
            t.includes("dollar")
        )
    );
}


/* =========================================================
   MEANING / DICTIONARY
   ========================================================= */

function extractWord(text) {

    const t =
        String(text || "").trim();

    let match =
        t.match(
            /(?:meaning of|define|definition of|meaning)\s+(.+)$/i
        );

    if (match) {
        return match[1].trim();
    }

    return null;
}


async function getMeaning(text) {

    const word =
        extractWord(text);

    if (!word) {

        return (
            "Please ask like: meaning of intelligent."
        );
    }

    try {

        const url =
            JARVIS_CONFIG.DICTIONARY_API +
            encodeURIComponent(word);

        const data =
            await fetchJSON(
                url,
                {},
                7000
            );

        const entry =
            data?.[0];

        const definition =
            entry?.meanings?.[0]
                ?.definitions?.[0]
                ?.definition;

        if (definition) {

            return (
                `${word}: ${definition}`
            );
        }

    } catch (error) {}

    return (
        `I couldn't find a dictionary definition for "${word}".`
    );
}


function isMeaningCommand(text) {

    const t =
        normalizeText(text);

    return (
        t.startsWith("meaning of ") ||
        t.startsWith("define ") ||
        t.startsWith("definition of ") ||
        t.startsWith("meaning ")
    );
}


/* =========================================================
   PASSWORD
   ========================================================= */

function generatePassword(length = 16) {

    length =
        Math.min(
            Math.max(
                Number(length) || 16,
                8
            ),
            64
        );

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ" +
        "abcdefghijkmnopqrstuvwxyz" +
        "23456789!@#$%^&*_-+=";

    const values =
        new Uint32Array(length);

    crypto.getRandomValues(values);

    let password = "";

    for (let i = 0; i < length; i++) {

        password +=
            chars[
                values[i] % chars.length
            ];
    }

    return password;
}


function passwordCommand(text) {

    const match =
        String(text || "")
            .match(/\b(\d{1,2})\b/);

    const length =
        match
            ? Number(match[1])
            : 16;

    const password =
        generatePassword(length);

    return (
        `Generated password:\n${password}`
    );
}


function isPasswordCommand(text) {

    const t =
        normalizeText(text);

    return (
        t.includes("password") ||
        t.includes("generate password") ||
        t.includes("strong password") ||
        t.includes("పాస్వర్డ్")
    );
}


/* =========================================================
   SEARCH
   ========================================================= */

function searchCommand(text) {

    let query =
        String(text || "")
            .replace(
                /^(search|google|look up|find)\s*/i,
                ""
            )
            .trim();

    if (!query) {

        return (
            "Tell me what you want me to search for."
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
        `Searching Google for "${query}".`
    );
}


function isSearchCommand(text) {

    const t =
        normalizeText(text);

    return (
        t.startsWith("search ") ||
        t.startsWith("google ") ||
        t.startsWith("look up ") ||
        t.startsWith("find ")
    );
}


/* =========================================================
   OPEN APPS
   ========================================================= */

function openApp(text) {

    const t =
        normalizeText(text);

    const apps = {

        youtube:
            "https://www.youtube.com/",

        google:
            "https://www.google.com/",

        gmail:
            "https://mail.google.com/",

        whatsapp:
            "https://web.whatsapp.com/",

        facebook:
            "https://www.facebook.com/",

        instagram:
            "https://www.instagram.com/",

        github:
            "https://github.com/",

        maps:
            "https://maps.google.com/",

        googlemaps:
            "https://maps.google.com/",

        spotify:
            "https://open.spotify.com/",

        twitter:
            "https://x.com/",

        x:
            "https://x.com/"
    };

    let selected = null;

    for (const name in apps) {

        if (t.includes(name)) {
            selected = name;
            break;
        }
    }

    if (!selected) {

        return (
            "Available apps: YouTube, Google, Gmail, " +
            "WhatsApp, Facebook, Instagram, GitHub, " +
            "Maps and Spotify."
        );
    }

    window.open(
        apps[selected],
        "_blank",
        "noopener,noreferrer"
    );

    return (
        `Opening ${selected}.`
    );
}


function isOpenAppCommand(text) {

    const t =
        normalizeText(text);

    return (
        t.includes("open youtube") ||
        t.includes("open google") ||
        t.includes("open gmail") ||
        t.includes("open whatsapp") ||
        t.includes("open facebook") ||
        t.includes("open instagram") ||
        t.includes("open github") ||
        t.includes("open maps") ||
        t.includes("open spotify") ||
        t.includes("open app")
    );
}


/* =========================================================
   PLAY SONGS
   ========================================================= */

function playSong(text) {

    let query =
        String(text || "")
            .replace(
                /^(play|play song|play music)\s*/i,
                ""
            )
            .trim();

    if (!query) {
        query = "trending music";
    }

    const url =
        "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(query);

    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );

    return (
        `Opening YouTube results for ${query}.`
    );
}


function isPlaySongCommand(text) {

    const t =
        normalizeText(text);

    return (
        t.startsWith("play ") ||
        t.includes("play song") ||
        t.includes("play music") ||
        t.includes("పాట ప్లే") ||
        t.includes("సాంగ్ ప్లే")
    );
}


/* =========================================================
   CRYPTO
   ========================================================= */

const cryptoIds = {

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


function findCrypto(text) {

    const t =
        normalizeText(text);

    for (const name in cryptoIds) {

        if (t.includes(name)) {
            return cryptoIds[name];
        }
    }

    return "bitcoin";
}


async function getCrypto(text) {

    const id =
        findCrypto(text);

    try {

        const url =
            `${JARVIS_CONFIG.CRYPTO_API}` +
            `?ids=${encodeURIComponent(id)}` +
            `&vs_currencies=usd,inr`;

        const data =
            await fetchJSON(
                url,
                {},
                8000
            );

        const coin =
            data?.[id];

        if (!coin) {
            throw new Error("Crypto unavailable");
        }

        return (
            `${id} price: ` +
            `$${Number(coin.usd).toLocaleString()} ` +
            `or ₹${Number(coin.inr).toLocaleString()}.`
        );

    } catch (error) {

        return (
            "I couldn't fetch the live crypto price right now."
        );
    }
}


function isCryptoCommand(text) {

    const t =
        normalizeText(text);

    return (
        t.includes("crypto") ||
        t.includes("bitcoin") ||
        t.includes("btc") ||
        t.includes("ethereum") ||
        t.includes("eth") ||
        t.includes("solana") ||
        t.includes("dogecoin") ||
        t.includes("doge")
    );
}


/* =========================================================
   NEWS
   ========================================================= */

async function getNews() {

    try {

        const data =
            await fetchJSON(
                JARVIS_CONFIG.NEWS_API,
                {},
                9000
            );

        const articles =
            Array.isArray(data?.items)
                ? data.items.slice(0, 5)
                : [];

        if (!articles.length) {
            throw new Error("No news");
        }

        const lines =
            articles.map(
                (item, index) =>
                    `${index + 1}. ${item.title}`
            );

        return (
            "Latest headlines:\n" +
            lines.join("\n")
        );

    } catch (error) {

        return (
            "I couldn't load the latest news right now."
        );
    }
}


function isNewsCommand(text) {

    const t =
        normalizeText(text);

    return (
        t === "news" ||
        t.includes("latest news") ||
        t.includes("headlines") ||
        t.includes("today news") ||
        t.includes("న్యూస్")
    );
}


/* =========================================================
   YOUTUBE DIRECT SEARCH
   ========================================================= */

function youtubeCommand(text) {

    const query =
        String(text || "")
            .replace(
                /^(youtube|play on youtube)\s*/i,
                ""
            )
            .trim();

    if (!query) {

        window.open(
            "https://www.youtube.com/",
            "_blank"
        );

        return "Opening YouTube.";
    }

    const url =
        "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(query);

    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );

    return (
        `Searching YouTube for ${query}.`
    );
}


/* =========================================================
   COMMAND ROUTER
   ========================================================= */

async function handleTools(text) {

    const t =
        normalizeText(text);

    /* TIME */
    if (isTimeCommand(t)) {

        if (!liveTimeSynced) {
            await syncLiveTime();
        }

        return await getTime();
    }


    /* WEATHER */
    if (
        t === "weather" ||
        t.includes("weather") ||
        t.includes("temperature") ||
        t.includes("వెదర్") ||
        t.includes("వాతావరణం")
    ) {

        return await getWeather();
    }


    /* TIMER */
    if (isTimerCommand(t)) {

        return setJarvisTimer(t);
    }


    /* DICE / COIN */
    if (isDiceCommand(t)) {

        return diceCommand(t);
    }


    /* JOKE */
    if (isJokeCommand(t)) {

        return await getJoke();
    }


    /* QUOTE */
    if (isQuoteCommand(t)) {

        return await getQuote();
    }


    /* NEWS */
    if (isNewsCommand(t)) {

        return await getNews();
    }


    /* TRANSLATE */
    if (isTranslateCommand(t)) {

        return await translateText(text);
    }


    /* CURRENCY */
    if (isCurrencyCommand(t)) {

        return await convertCurrency(text);
    }


    /* MEANING */
    if (isMeaningCommand(t)) {

        return await getMeaning(text);
    }


    /* PASSWORD */
    if (isPasswordCommand(t)) {

        return passwordCommand(text);
    }


    /* OPEN APPS */
    if (isOpenAppCommand(t)) {

        return openApp(text);
    }


    /* PLAY SONG */
    if (isPlaySongCommand(t)) {

        return playSong(text);
    }


    /* CRYPTO */
    if (isCryptoCommand(t)) {

        return await getCrypto(text);
    }


    /* SEARCH */
    if (isSearchCommand(t)) {

        return searchCommand(text);
    }


    /* YOUTUBE */
    if (
        t.startsWith("youtube ") ||
        t === "youtube"
    ) {

        return youtubeCommand(text);
    }


    return null;
}


/* =========================================================
   GENERAL COMMANDS
   ========================================================= */

function handleBasicCommand(text) {

    const t =
        normalizeText(text);

    if (
        t === "hello" ||
        t === "hi" ||
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
        t === "thank you" ||
        t === "thanks" ||
        t.includes("thank you jarvis")
    ) {

        return (
            "You're welcome."
        );
    }


    if (
        t === "clear" ||
        t === "clear chat"
    ) {

        clearMemory();

        return (
            "Chat memory cleared."
        );
    }


    return null;
}


/* =========================================================
   LOCAL MEMORY
   ========================================================= */

function loadMemory() {

    try {

        const data =
            localStorage.getItem(
                JARVIS_CONFIG.STORAGE_KEY
            );

        return data
            ? JSON.parse(data)
            : [];

    } catch (error) {

        return [];
    }
}


function saveMemory(memory) {

    try {

        localStorage.setItem(
            JARVIS_CONFIG.STORAGE_KEY,
            JSON.stringify(memory.slice(-50))
        );

    } catch (error) {}
}


function rememberConversation(
    user,
    assistant
) {

    const memory =
        loadMemory();

    memory.push({
        user,
        assistant,
        time: new Date().toISOString()
    });

    saveMemory(memory);
}


function clearMemory() {

    try {

        localStorage.removeItem(
            JARVIS_CONFIG.STORAGE_KEY
        );

    } catch (error) {}

    if (chat) {
        chat.innerHTML = "";
    }

    reply(
        "Memory and chat cleared.",
        false
    );
}


/* =========================================================
   OPTIONAL AI FALLBACK
   ========================================================= */

async function aiFallback(text) {

    /*
       This is only used when the command is not one
       of the 15 built-in tools.

       Built-in tools are handled first, so they remain fast.
    */

    try {

        const prompt =
            `You are J.A.R.V.I.S, a concise personal AI assistant.
Answer accurately and naturally.
User: ${text}`;

        const url =
            "https://text.pollinations.ai/" +
            encodeURIComponent(prompt);

        const response =
            await fetch(
                url,
                {
                    method: "GET",
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error("AI unavailable");
        }

        const answer =
            await response.text();

        if (answer?.trim()) {
            return answer.trim();
        }

    } catch (error) {

        console.warn(
            "AI fallback unavailable:",
            error
        );
    }

    return (
        "I didn't understand that command. " +
        "Try Time, Weather, Timer, Dice, Joke, Quote, " +
        "News, Translate, Currency, Meaning, Password, " +
        "Search, Open Apps, Play Songs, or Crypto."
    );
}


/* =========================================================
   MAIN EXECUTION
   ========================================================= */

let commandBusy = false;


async function executeCommand(text) {

    const command =
        String(text || "").trim();

    if (!command) {
        return;
    }

    if (commandBusy) {
        return;
    }

    commandBusy = true;

    userMessage(command);

    try {

        /*
           First check local/basic commands.
        */

        const basic =
            handleBasicCommand(command);

        if (basic) {

            reply(basic);

            rememberConversation(
                command,
                basic
            );

            return;
        }


        /*
           Then check all screenshot tools.
        */

        const toolResult =
            await handleTools(command);

        if (toolResult) {

            reply(toolResult);

            rememberConversation(
                command,
                toolResult
            );

            return;
        }


        /*
           Finally AI fallback.
        */

        const aiAnswer =
            await aiFallback(command);

        reply(aiAnswer);

        rememberConversation(
            command,
            aiAnswer
        );

    } catch (error) {

        console.error(
            "JARVIS command error:",
            error
        );

        reply(
            "Sorry, something went wrong while processing that command."
        );

    } finally {

        commandBusy = false;
    }
}


/* =========================================================
   SEND BUTTON
   ========================================================= */

if (sendBtn) {

    sendBtn.addEventListener(
        "click",
        async () => {

            const text =
                msg?.value?.trim();

            if (!text) {
                return;
            }

            msg.value = "";

            await executeCommand(text);
        }
    );
}


/* =========================================================
   ENTER KEY
   ========================================================= */

if (msg) {

    msg.addEventListener(
        "keydown",
        async event => {

            if (event.key === "Enter") {

                event.preventDefault();

                const text =
                    msg.value.trim();

                if (!text) {
                    return;
                }

                msg.value = "";

                await executeCommand(text);
            }
        }
    );
}


/* =========================================================
   CLEAR BUTTON
   ========================================================= */

if (clearBtn) {

    clearBtn.addEventListener(
        "click",
        () => {

            try {

                localStorage.removeItem(
                    JARVIS_CONFIG.STORAGE_KEY
                );

            } catch (error) {}

            if (chat) {
                chat.innerHTML = "";
            }

            reply(
                "Memory cleared successfully.",
                false
            );
        }
    );
}


/* =========================================================
   VOICE RECOGNITION
   ========================================================= */

function setupVoiceRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        if (micBtn) {
            micBtn.title =
                "Voice recognition is not supported in this browser.";
        }

        return;
    }

    recognition =
        new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";


    recognition.onstart = () => {

        isListening = true;

        if (micBtn) {
            micBtn.classList.add(
                "listening"
            );
            micBtn.textContent = "🔴";
        }
    };


    recognition.onresult = event => {

        const transcript =
            event.results?.[0]?.[0]?.transcript
            ?.trim();

        if (!transcript) {
            return;
        }

        if (msg) {
            msg.value = transcript;
        }

        executeCommand(transcript);
    };


    recognition.onerror = event => {

        console.warn(
            "Speech recognition error:",
            event.error
        );
    };


    recognition.onend = () => {

        isListening = false;

        if (micBtn) {

            micBtn.classList.remove(
                "listening"
            );

            micBtn.textContent = "🎙️";
        }
    };


    if (micBtn) {

        micBtn.addEventListener(
            "click",
            () => {

                if (isListening) {

                    recognition.stop();

                } else {

                    try {

                        recognition.start();

                    } catch (error) {

                        console.warn(
                            "Could not start microphone:",
                            error
                        );
                    }
                }
            }
        );
    }
}


/* =========================================================
   CAMERA / IMAGE INPUT
   ========================================================= */

if (camBtn && imgInput) {

    camBtn.addEventListener(
        "click",
        () => {

            imgInput.click();
        }
    );


    imgInput.addEventListener(
        "change",
        async event => {

            const file =
                event.target.files?.[0];

            if (!file) {
                return;
            }

            userMessage(
                "Analyze this image."
            );

            jarvisMessage(
                "Image received. Analyzing..."
            );

            /*
               Basic browser-side image information.
               This works without an external AI key.
            */

            const image =
                new Image();

            const objectURL =
                URL.createObjectURL(file);

            image.onload = () => {

                const result =
                    `Image loaded successfully. ` +
                    `Size: ${image.width} × ${image.height}px. ` +
                    `File type: ${file.type}.`;

                reply(
                    result,
                    false
                );

                URL.revokeObjectURL(
                    objectURL
                );
            };

            image.onerror = () => {

                URL.revokeObjectURL(
                    objectURL
                );

                reply(
                    "I couldn't read that image.",
                    false
                );
            };

            image.src = objectURL;

            imgInput.value = "";
        }
    );
}


/* =========================================================
   FEATURE CARD AUTO CLICK
   ========================================================= */

function setupFeatureCards() {

    const elements =
        document.querySelectorAll(
            "div, article, section, button"
        );

    elements.forEach(element => {

        /*
           Only consider relatively small elements
           containing one of the feature names.
        */

        const text =
            normalizeText(
                element.textContent
            );

        if (
            !text ||
            text.length > 180
        ) {
            return;
        }


        let command = null;


        if (
            text === "time" ||
            text.startsWith("time ")
        ) {
            command = "time";
        }

        else if (
            text === "weather" ||
            text.startsWith("weather ")
        ) {
            command = "weather";
        }

        else if (
            text === "timer" ||
            text.startsWith("timer ")
        ) {
            command = "set timer for 10 seconds";
        }

        else if (
            text.includes("dice") ||
            text.includes("coin")
        ) {
            command = "roll dice";
        }

        else if (
            text === "joke" ||
            text.startsWith("joke ")
        ) {
            command = "tell me a joke";
        }

        else if (
            text === "quote" ||
            text.startsWith("quote ")
        ) {
            command = "give me a quote";
        }

        else if (
            text === "news" ||
            text.startsWith("news ")
        ) {
            command = "latest news";
        }

        else if (
            text === "translate" ||
            text.startsWith("translate ")
        ) {
            command =
                "translate hello to Telugu";
        }

        else if (
            text === "currency" ||
            text.startsWith("currency ")
        ) {
            command =
                "100 USD to INR";
        }

        else if (
            text === "meaning" ||
            text.startsWith("meaning ")
        ) {
            command =
                "meaning of intelligent";
        }

        else if (
            text === "password" ||
            text.startsWith("password ")
        ) {
            command =
                "generate strong password";
        }

        else if (
            text === "search" ||
            text.startsWith("search ")
        ) {
            command =
                "search Google";
        }

        else if (
            text.includes("open apps")
        ) {
            command =
                "open Google";
        }

        else if (
            text.includes("play songs") ||
            text.includes("play song")
        ) {
            command =
                "play trending music";
        }

        else if (
            text === "crypto" ||
            text.startsWith("crypto ")
        ) {
            command =
                "Bitcoin price";
        }


        if (!command) {
            return;
        }


        /*
           Avoid adding duplicate listeners.
        */

        if (
            element.dataset.jarvisFeatureBound === "1"
        ) {
            return;
        }

        element.dataset.jarvisFeatureBound = "1";

        element.addEventListener(
            "click",
            event => {

                /*
                   Don't interfere with actual buttons
                   that already have their own handlers.
                */

                if (
                    element === sendBtn ||
                    element === micBtn ||
                    element === camBtn ||
                    element === clearBtn
                ) {
                    return;
                }

                executeCommand(command);
            }
        );
    });
}


/* =========================================================
   STARTUP
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupVoiceRecognition();

        setupFeatureCards();

        /*
           Start live internet clock.
           This does not block commands.
        */

        startLiveClock()
            .catch(error => {
                console.warn(
                    "Live clock startup failed:",
                    error
                );
            });

        /*
           Welcome message only if chat is empty.
        */

        if (
            chat &&
            chat.children.length === 0
        ) {

            jarvisMessage(
                "J.A.R.V.I.S online. All systems ready."
            );
        }
    }
);


/* =========================================================
   GLOBAL FALLBACK
   ========================================================= */

window.JARVIS = {
    executeCommand,
    getTime,
    getWeather,
    syncLiveTime,
    generatePassword,
    speak
};
