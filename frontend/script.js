/* =========================================================
   J.A.R.V.I.S
   COMPLETE SCRIPT.JS
   PART 1 / 2
   ========================================================= */

"use strict";

/* =========================
   CONFIG
   ========================= */

const JARVIS = {
    TIME_ZONE: "Asia/Kolkata",

    TIME_APIS: [
        "https://timeapi.io/api/Time/current/zone?timeZone=Asia/Kolkata",
        "https://utctime.app/api/now/Asia/Kolkata"
    ],

    WEATHER:
        "https://api.open-meteo.com/v1/forecast",

    DICTIONARY:
        "https://api.dictionaryapi.dev/api/v2/entries/en/",

    TRANSLATE:
        "https://api.mymemory.translated.net/get",

    CURRENCY:
        "https://open.er-api.com/v6/latest/",

    CRYPTO:
        "https://api.coingecko.com/api/v3/simple/price",

    JOKE:
        "https://official-joke-api.appspot.com/random_joke",

    QUOTE:
        "https://dummyjson.com/quotes/random",

    NEWS:
        "https://api.rss2json.com/v1/api.json?rss_url=" +
        encodeURIComponent(
            "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en"
        ),

    MEMORY: "JARVIS_MEMORY_V4"
};


/* =========================
   EXISTING HTML ELEMENTS
   ========================= */

const chat = document.getElementById("chat");
const msg = document.getElementById("msg");
const send = document.getElementById("send");
const mic = document.getElementById("mic-btn");
const cam = document.getElementById("cam-btn");
const clear = document.getElementById("clear-btn");
const imageInput = document.getElementById("img-input");


/* =========================
   STATE
   ========================= */

let timeOffset = 0;
let timeOnline = false;
let timeSyncing = false;

let weatherCache = null;
let weatherCacheAt = 0;

let timerID = null;

let recognition = null;
let listening = false;

let commandRunning = false;


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function cleanText(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ");
}


function lower(value) {
    return cleanText(value).toLowerCase();
}


function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}


async function requestJSON(url, timeout = 8000) {

    const controller = new AbortController();

    const timeoutID = setTimeout(
        () => controller.abort(),
        timeout
    );

    try {

        const response = await fetch(url, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(
                "HTTP " + response.status
            );
        }

        return await response.json();

    } finally {

        clearTimeout(timeoutID);
    }
}


/* =========================================================
   CHAT
   ========================================================= */

function addMessage(text, type = "jarvis") {

    if (!chat) return;

    const element = document.createElement("div");

    element.className =
        type === "user"
            ? "user-message"
            : "jarvis-message";

    element.innerHTML =
        escapeHTML(text)
            .replace(/\n/g, "<br>");

    chat.appendChild(element);

    chat.scrollTop = chat.scrollHeight;
}


function showUser(text) {
    addMessage(text, "user");
}


function showJarvis(text) {
    addMessage(text, "jarvis");
}


function answer(text, speakIt = true) {

    const value = cleanText(text);

    if (!value) return;

    showJarvis(value);

    if (speakIt) {
        speak(value);
    }
}


/* =========================================================
   VOICE OUTPUT
   ========================================================= */

function speak(text) {

    if (!("speechSynthesis" in window)) {
        return;
    }

    try {

        speechSynthesis.cancel();

        const utterance =
            new SpeechSynthesisUtterance(
                String(text)
            );

        utterance.lang = "en-IN";
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        speechSynthesis.speak(utterance);

    } catch (error) {

        console.warn("TTS:", error);
    }
}


/* =========================================================
   LIVE TIME
   ========================================================= */

function readServerDate(data) {

    if (!data) return null;

    const values = [
        data.dateTime,
        data.datetime,
        data.currentDateTime,
        data.utcDateTime,
        data.utc_datetime
    ];

    for (const value of values) {

        if (!value) continue;

        const date = new Date(value);

        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }

    if (typeof data.timestamp === "number") {

        const date =
            new Date(
                data.timestamp > 10000000000
                    ? data.timestamp
                    : data.timestamp * 1000
            );

        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }

    return null;
}


async function syncLiveTime() {

    if (timeSyncing) {
        return timeOnline;
    }

    timeSyncing = true;

    for (const api of JARVIS.TIME_APIS) {

        const started = Date.now();

        try {

            const data =
                await requestJSON(api, 5000);

            const serverDate =
                readServerDate(data);

            if (!serverDate) {
                continue;
            }

            const halfDelay =
                (Date.now() - started) / 2;

            timeOffset =
                serverDate.getTime()
                + halfDelay
                - Date.now();

            timeOnline = true;

            timeSyncing = false;

            return true;

        } catch (error) {

            console.warn(
                "Live time API failed:",
                api
            );
        }
    }

    timeOnline = false;
    timeSyncing = false;

    return false;
}


function liveDate() {

    return new Date(
        Date.now() + timeOffset
    );
}


function liveTimeText() {

    return new Intl.DateTimeFormat(
        "en-IN",
        {
            timeZone: JARVIS.TIME_ZONE,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        }
    ).format(liveDate());
}


function liveDateText() {

    return new Intl.DateTimeFormat(
        "en-IN",
        {
            timeZone: JARVIS.TIME_ZONE,
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric"
        }
    ).format(liveDate());
}


async function currentTime() {

    if (!timeOnline) {
        await syncLiveTime();
    }

    return (
        `Current time is ${liveTimeText()}. ` +
        `Today is ${liveDateText()}.`
    );
}


function updateVisibleClock() {

    const value = liveTimeText();

    [
        "#clock",
        "#time",
        "#current-time",
        ".clock",
        ".time"
    ].forEach(selector => {

        document
            .querySelectorAll(selector)
            .forEach(element => {
                element.textContent = value;
            });

    });
}


async function startClock() {

    await syncLiveTime();

    updateVisibleClock();

    setInterval(
        updateVisibleClock,
        1000
    );

    setInterval(
        syncLiveTime,
        60000
    );
}


/* =========================================================
   TIME DETECTION
   ========================================================= */

function isTime(text) {

    const t = lower(text);

    return (
        t === "time" ||
        t.includes("what time") ||
        t.includes("current time") ||
        t.includes("tell me time") ||
        t.includes("tell me the time") ||
        t.includes("time now") ||
        t.includes("what is the time") ||
        t.includes("clock") ||
        t.includes("టైమ్") ||
        t.includes("సమయం")
    );
}


/* =========================================================
   WEATHER
   ========================================================= */

function weatherText(code) {

    const map = {
        0: "clear sky",
        1: "mainly clear",
        2: "partly cloudy",
        3: "overcast",
        45: "foggy",
        48: "foggy",
        51: "light drizzle",
        53: "moderate drizzle",
        55: "heavy drizzle",
        61: "light rain",
        63: "moderate rain",
        65: "heavy rain",
        71: "light snow",
        73: "moderate snow",
        75: "heavy snow",
        80: "light rain showers",
        81: "moderate rain showers",
        82: "heavy rain showers",
        95: "thunderstorm",
        96: "thunderstorm with hail",
        99: "heavy thunderstorm"
    };

    return map[code] || "unknown weather";
}


function browserLocation() {

    return new Promise(
        (resolve, reject) => {

            if (!navigator.geolocation) {
                reject(
                    new Error("Geolocation unavailable")
                );
                return;
            }

            navigator.geolocation.getCurrentPosition(
                position => {

                    resolve({
                        lat:
                            position.coords.latitude,

                        lon:
                            position.coords.longitude
                    });

                },

                reject,

                {
                    enableHighAccuracy: false,
                    timeout: 6000,
                    maximumAge: 180000
                }
            );
        }
    );
}


async function currentWeather() {

    if (
        weatherCache &&
        Date.now() - weatherCacheAt < 120000
    ) {
        return weatherCache;
    }

    try {

        const location =
            await browserLocation();

        const url =
            JARVIS.WEATHER +
            `?latitude=${location.lat}` +
            `&longitude=${location.lon}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
            `&timezone=auto`;

        const data =
            await requestJSON(url, 8000);

        const c = data.current;

        if (!c) {
            throw new Error("Weather unavailable");
        }

        const result =
            `Temperature is ${c.temperature_2m}°C. ` +
            `Feels like ${c.apparent_temperature}°C. ` +
            `Humidity is ${c.relative_humidity_2m}%. ` +
            `Conditions are ${weatherText(c.weather_code)}. ` +
            `Wind speed is ${c.wind_speed_10m} km/h.`;

        weatherCache = result;
        weatherCacheAt = Date.now();

        return result;

    } catch (error) {

        return (
            "I couldn't get live weather. " +
            "Please allow location permission and try again."
        );
    }
}


function isWeather(text) {

    const t = lower(text);

    return (
        t === "weather" ||
        t.includes("weather") ||
        t.includes("temperature") ||
        t.includes("వెదర్") ||
        t.includes("వాతావరణం")
    );
}


/* =========================================================
   TIMER
   ========================================================= */

function timerSeconds(text) {

    let match =
        text.match(
            /(\d+(?:\.\d+)?)\s*(seconds?|secs?|sec)\b/i
        );

    if (match) {
        return Number(match[1]);
    }

    match =
        text.match(
            /(\d+(?:\.\d+)?)\s*(minutes?|mins?|min)\b/i
        );

    if (match) {
        return Number(match[1]) * 60;
    }

    match =
        text.match(
            /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr)\b/i
        );

    if (match) {
        return Number(match[1]) * 3600;
    }

    return null;
}


function isTimer(text) {

    const t = lower(text);

    return (
        t.includes("timer") ||
        t.includes("countdown") ||
        t.includes("టైమర్")
    );
}


function createTimer(text) {

    const seconds =
        timerSeconds(text);

    if (!seconds || seconds <= 0) {

        return (
            "Tell me the duration. " +
            "Example: set timer for 30 seconds."
        );
    }

    if (timerID) {
        clearTimeout(timerID);
    }

    timerID =
        setTimeout(
            () => {

                answer(
                    "Timer finished."
                );

                timerID = null;

            },
            seconds * 1000
        );

    return (
        `Timer set for ${seconds} seconds.`
    );
}


/* =========================================================
   DICE / COIN
   ========================================================= */

function isDice(text) {

    const t = lower(text);

    return (
        t.includes("dice") ||
        t.includes("roll dice") ||
        t.includes("roll a die") ||
        t.includes("coin toss") ||
        t.includes("flip coin") ||
        t.includes("toss coin") ||
        t === "coin"
    );
}


function diceOrCoin(text) {

    const t = lower(text);

    if (
        t.includes("coin") ||
        t.includes("toss") ||
        t.includes("flip")
    ) {

        const result =
            Math.random() < 0.5
                ? "Heads"
                : "Tails";

        return `Coin toss result: ${result}.`;
    }

    const match =
        t.match(
            /(?:dice|d)\s*(\d+)/i
        );

    const sides =
        match
            ? Math.max(2, Number(match[1]))
            : 6;

    const result =
        Math.floor(
            Math.random() * sides
        ) + 1;

    return (
        `Dice result: ${result} out of ${sides}.`
    );
}


/* =========================================================
   JOKE
   ========================================================= */

function isJoke(text) {

    const t = lower(text);

    return (
        t.includes("joke") ||
        t.includes("make me laugh") ||
        t.includes("జోక్")
    );
}


async function joke() {

    try {

        const data =
            await requestJSON(
                JARVIS.JOKE,
                6000
            );

        if (
            data?.setup &&
            data?.punchline
        ) {

            return (
                data.setup +
                "\n" +
                data.punchline
            );
        }

    } catch (error) {}

    return (
        "Why did the computer go to the doctor? " +
        "Because it had a virus."
    );
}


/* =========================================================
   QUOTE
   ========================================================= */

function isQuote(text) {

    const t = lower(text);

    return (
        t.includes("quote") ||
        t.includes("motivation") ||
        t.includes("motivational") ||
        t.includes("inspire me") ||
        t.includes("మోటివేషన్")
    );
}


async function quote() {

    try {

        const data =
            await requestJSON(
                JARVIS.QUOTE,
                6000
            );

        if (data?.quote) {

            return (
                `"${data.quote}" — ` +
                `${data.author || "Unknown"}`
            );
        }

    } catch (error) {}

    return (
        `"The secret of getting ahead is getting started."`
    );
}


/* =========================================================
   TRANSLATE
   ========================================================= */

const LANGUAGES = {

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


function isTranslate(text) {

    return lower(text).includes("translate");
}


function parseTranslation(text) {

    const match =
        text.match(
            /^translate\s+(.+?)\s+(?:to|into)\s+([a-zA-Z]+)$/i
        );

    if (!match) {
        return null;
    }

    return {
        value: match[1].trim(),
        language: match[2].trim()
    };
}


async function translate(text) {

    const info =
        parseTranslation(text);

    if (!info) {

        return (
            "Use: translate hello to Telugu."
        );
    }

    const target =
        LANGUAGES[
            lower(info.language)
        ] ||
        info.language;

    try {

        const url =
            JARVIS.TRANSLATE +
            `?q=${encodeURIComponent(info.value)}` +
            `&langpair=en|${encodeURIComponent(target)}`;

        const data =
            await requestJSON(url, 8000);

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


/* =========================================================
   PART 1 END
  
   ========================================================= */
/* =========================================================
   J.A.R.V.I.S
   COMPLETE SCRIPT.JS
   PART 2 / 2
   ========================================================= */


/* =========================================================
   CURRENCY
   ========================================================= */

const CURRENCY_CODES = {

    usd: "USD",
    dollar: "USD",
    dollars: "USD",

    inr: "INR",
    rupee: "INR",
    rupees: "INR",

    eur: "EUR",
    euro: "EUR",
    euros: "EUR",

    gbp: "GBP",
    pound: "GBP",
    pounds: "GBP",

    jpy: "JPY",
    yen: "JPY",

    aud: "AUD",
    cad: "CAD",
    aed: "AED",
    sar: "SAR",
    cny: "CNY"
};


function currencyCode(value) {

    const v =
        lower(value);

    return (
        CURRENCY_CODES[v] ||
        v.toUpperCase()
    );
}


function isCurrency(text) {

    const t = lower(text);

    return (
        t.includes("currency") ||
        t.includes("convert") ||
        /\d+\s*(usd|inr|eur|gbp|jpy|aed|sar)\s+(to|in)\s+/i.test(t)
    );
}


function parseCurrency(text) {

    const match =
        text.match(
            /(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s+(?:to|in)\s+([a-zA-Z]+)/i
        );

    if (!match) {
        return null;
    }

    return {
        amount: Number(match[1]),
        from: currencyCode(match[2]),
        to: currencyCode(match[3])
    };
}


async function currency(text) {

    const info =
        parseCurrency(text);

    if (!info) {

        return (
            "Use currency like: 100 USD to INR."
        );
    }

    if (info.from === info.to) {

        return (
            `${info.amount} ${info.from} = ` +
            `${info.amount} ${info.to}.`
        );
    }

    try {

        const data =
            await requestJSON(
                JARVIS.CURRENCY +
                encodeURIComponent(info.from),
                7000
            );

        const rate =
            data?.rates?.[info.to];

        if (!rate) {
            throw new Error("No rate");
        }

        const result =
            info.amount * rate;

        return (
            `${info.amount} ${info.from} = ` +
            `${result.toFixed(2)} ${info.to}.`
        );

    } catch (error) {

        return (
            "Live currency rate is unavailable right now."
        );
    }
}


/* =========================================================
   MEANING
   ========================================================= */

function isMeaning(text) {

    const t = lower(text);

    return (
        t.startsWith("meaning of ") ||
        t.startsWith("define ") ||
        t.startsWith("definition of ")
    );
}


function getWord(text) {

    const match =
        text.match(
            /(?:meaning of|define|definition of)\s+(.+)$/i
        );

    return match
        ? match[1].trim()
        : null;
}


async function meaning(text) {

    const word =
        getWord(text);

    if (!word) {

        return (
            "Example: meaning of intelligent."
        );
    }

    try {

        const data =
            await requestJSON(
                JARVIS.DICTIONARY +
                encodeURIComponent(word),
                7000
            );

        const definition =
            data?.[0]
                ?.meanings?.[0]
                ?.definitions?.[0]
                ?.definition;

        if (definition) {

            return (
                `${word}: ${definition}`
            );
        }

    } catch (error) {}

    return (
        `I couldn't find the meaning of "${word}".`
    );
}


/* =========================================================
   PASSWORD
   ========================================================= */

function isPassword(text) {

    const t = lower(text);

    return (
        t.includes("password") ||
        t.includes("strong password") ||
        t.includes("generate password") ||
        t.includes("పాస్వర్డ్")
    );
}


function makePassword(length = 16) {

    length =
        Math.max(
            8,
            Math.min(
                64,
                Number(length) || 16
            )
        );

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ" +
        "abcdefghijkmnopqrstuvwxyz" +
        "23456789!@#$%^&*_-+=";

    const random =
        new Uint32Array(length);

    crypto.getRandomValues(random);

    let password = "";

    for (let i = 0; i < length; i++) {

        password +=
            chars[
                random[i] % chars.length
            ];
    }

    return password;
}


function password(text) {

    const match =
        text.match(/\b(\d{1,2})\b/);

    const length =
        match
            ? Number(match[1])
            : 16;

    return (
        `Strong password:\n${makePassword(length)}`
    );
}


/* =========================================================
   SEARCH
   ========================================================= */

function isSearch(text) {

    const t = lower(text);

    return (
        t.startsWith("search ") ||
        t.startsWith("google ") ||
        t.startsWith("look up ") ||
        t.startsWith("find ")
    );
}


function search(text) {

    const query =
        text.replace(
            /^(search|google|look up|find)\s*/i,
            ""
        ).trim();

    if (!query) {

        return (
            "Tell me what you want to search."
        );
    }

    window.open(
        "https://www.google.com/search?q=" +
        encodeURIComponent(query),
        "_blank",
        "noopener,noreferrer"
    );

    return (
        `Searching Google for "${query}".`
    );
}


/* =========================================================
   OPEN APPS
   ========================================================= */

const APPS = {

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

    github:
        "https://github.com/",

    maps:
        "https://maps.google.com/",

    spotify:
        "https://open.spotify.com/",

    x:
        "https://x.com/"
};


function isOpenApp(text) {

    const t = lower(text);

    return (
        t.includes("open youtube") ||
        t.includes("open google") ||
        t.includes("open gmail") ||
        t.includes("open whatsapp") ||
        t.includes("open instagram") ||
        t.includes("open facebook") ||
        t.includes("open github") ||
        t.includes("open maps") ||
        t.includes("open spotify") ||
        t.includes("open app")
    );
}


function openApp(text) {

    const t = lower(text);

    for (const name in APPS) {

        if (t.includes(name)) {

            window.open(
                APPS[name],
                "_blank",
                "noopener,noreferrer"
            );

            return (
                `Opening ${name}.`
            );
        }
    }

    return (
        "Available apps are YouTube, Google, Gmail, " +
        "WhatsApp, Instagram, Facebook, GitHub, Maps and Spotify."
    );
}


/* =========================================================
   PLAY SONGS
   ========================================================= */

function isPlay(text) {

    const t = lower(text);

    return (
        t.startsWith("play ") ||
        t.includes("play song") ||
        t.includes("play music") ||
        t.includes("పాట ప్లే") ||
        t.includes("సాంగ్ ప్లే")
    );
}


function playSong(text) {

    let query =
        text.replace(
            /^(play|play song|play music)\s*/i,
            ""
        ).trim();

    if (!query) {
        query = "trending music";
    }

    window.open(
        "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(query),
        "_blank",
        "noopener,noreferrer"
    );

    return (
        `Opening YouTube results for "${query}".`
    );
}


/* =========================================================
   CRYPTO
   ========================================================= */

const CRYPTO = {

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


function isCrypto(text) {

    const t = lower(text);

    return (
        t.includes("crypto") ||
        t.includes("bitcoin") ||
        t.includes("btc") ||
        t.includes("ethereum") ||
        t.includes("eth") ||
        t.includes("solana") ||
        t.includes("dogecoin") ||
        t.includes("doge") ||
        t.includes("xrp")
    );
}


async function crypto(text) {

    const t = lower(text);

    let coin = "bitcoin";

    for (const key in CRYPTO) {

        if (t.includes(key)) {

            coin = CRYPTO[key];
            break;
        }
    }

    try {

        const url =
            JARVIS.CRYPTO +
            `?ids=${encodeURIComponent(coin)}` +
            `&vs_currencies=usd,inr`;

        const data =
            await requestJSON(url, 7000);

        const value =
            data?.[coin];

        if (!value) {
            throw new Error("Crypto unavailable");
        }

        return (
            `${coin} price is ` +
            `$${Number(value.usd).toLocaleString()} ` +
            `or ₹${Number(value.inr).toLocaleString()}.`
        );

    } catch (error) {

        return (
            "Live crypto price is unavailable right now."
        );
    }
}


/* =========================================================
   NEWS
   ========================================================= */

function isNews(text) {

    const t = lower(text);

    return (
        t === "news" ||
        t.includes("latest news") ||
        t.includes("today news") ||
        t.includes("headlines") ||
        t.includes("న్యూస్")
    );
}


async function news() {

    try {

        const data =
            await requestJSON(
                JARVIS.NEWS,
                9000
            );

        const articles =
            Array.isArray(data?.items)
                ? data.items.slice(0, 5)
                : [];

        if (!articles.length) {
            throw new Error("No headlines");
        }

        return (
            "Latest headlines:\n" +
            articles.map(
                (item, index) =>
                    `${index + 1}. ${item.title}`
            ).join("\n")
        );

    } catch (error) {

        return (
            "I couldn't load the latest headlines right now."
        );
    }
}


/* =========================================================
   YOUTUBE
   ========================================================= */

function isYouTube(text) {

    const t = lower(text);

    return (
        t === "youtube" ||
        t.startsWith("youtube ")
    );
}


function youtube(text) {

    const query =
        text.replace(
            /^youtube\s*/i,
            ""
        ).trim();

    if (!query) {

        window.open(
            "https://www.youtube.com/",
            "_blank"
        );

        return "Opening YouTube.";
    }

    window.open(
        "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(query),
        "_blank",
        "noopener,noreferrer"
    );

    return (
        `Searching YouTube for "${query}".`
    );
}


/* =========================================================
   BASIC COMMANDS
   ========================================================= */

function basic(text) {

    const t = lower(text);

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
        t === "thanks" ||
        t === "thank you"
    ) {

        return "You're welcome.";
    }

    return null;
}


/* =========================================================
   TOOL ROUTER
   ========================================================= */

async function runTool(text) {

    const t = lower(text);

    /* TIME */

    if (isTime(t)) {
        return await currentTime();
    }

    /* WEATHER */

    if (isWeather(t)) {
        return await currentWeather();
    }

    /* TIMER */

    if (isTimer(t)) {
        return createTimer(t);
    }

    /* DICE / COIN */

    if (isDice(t)) {
        return diceOrCoin(t);
    }

    /* JOKE */

    if (isJoke(t)) {
        return await joke();
    }

    /* QUOTE */

    if (isQuote(t)) {
        return await quote();
    }

    /* NEWS */

    if (isNews(t)) {
        return await news();
    }

    /* TRANSLATE */

    if (isTranslate(t)) {
        return await translate(text);
    }

    /* CURRENCY */

    if (isCurrency(t)) {
        return await currency(text);
    }

    /* MEANING */

    if (isMeaning(t)) {
        return await meaning(text);
    }

    /* PASSWORD */

    if (isPassword(t)) {
        return password(text);
    }

    /* OPEN APPS */

    if (isOpenApp(t)) {
        return openApp(text);
    }

    /* PLAY SONGS */

    if (isPlay(t)) {
        return playSong(text);
    }

    /* CRYPTO */

    if (isCrypto(t)) {
        return await crypto(text);
    }

    /* SEARCH */

    if (isSearch(t)) {
        return search(text);
    }

    /* YOUTUBE */

    if (isYouTube(t)) {
        return youtube(text);
    }

    return null;
}


/* =========================================================
   MEMORY
   ========================================================= */

function getMemory() {

    try {

        return JSON.parse(
            localStorage.getItem(
                JARVIS.MEMORY
            ) || "[]"
        );

    } catch (error) {

        return [];
    }
}


function saveMemory(user, bot) {

    try {

        const memory =
            getMemory();

        memory.push({
            user,
            bot,
            time:
                new Date().toISOString()
        });

        localStorage.setItem(
            JARVIS.MEMORY,
            JSON.stringify(
                memory.slice(-50)
            )
        );

    } catch (error) {}
}


/* =========================================================
   CLEAR MEMORY
   ========================================================= */

function clearAllMemory() {

    try {

        localStorage.removeItem(
            JARVIS.MEMORY
        );

    } catch (error) {}

    if (chat) {
        chat.innerHTML = "";
    }

    showJarvis(
        "Memory cleared successfully."
    );
}


if (clear) {

    clear.addEventListener(
        "click",
        clearAllMemory
    );
}


/* =========================================================
   FAST LOCAL AI FALLBACK
   ========================================================= */

async function aiFallback(text) {

    /*
       Built-in tools are always checked first.
       Therefore Time, Weather, Timer, Dice, etc.
       do not wait for AI.
    */

    const t = lower(text);

    if (
        t.includes("good morning")
    ) {

        return (
            "Good morning. J.A.R.V.I.S is ready."
        );
    }

    if (
        t.includes("good night")
    ) {

        return (
            "Good night. Have a great rest."
        );
    }

    if (
        t.includes("how are you")
    ) {

        return (
            "All systems are operational."
        );
    }

    /*
       Optional general AI fallback.
       If unavailable, the assistant still works
       with all built-in features.
    */

    try {

        const prompt =
            `You are J.A.R.V.I.S.
Answer briefly and accurately.
User: ${text}`;

        const response =
            await fetch(
                "https://text.pollinations.ai/" +
                encodeURIComponent(prompt),
                {
                    method: "GET",
                    cache: "no-store"
                }
            );

        if (response.ok) {

            const result =
                await response.text();

            if (result.trim()) {
                return result.trim();
            }
        }

    } catch (error) {

        console.warn(
            "AI fallback unavailable"
        );
    }

    return (
        "I didn't understand that. " +
        "Try Time, Weather, Timer, Dice, Joke, Quote, " +
        "News, Translate, Currency, Meaning, Password, " +
        "Search, Open Apps, Play Songs, or Crypto."
    );
}


/* =========================================================
   MAIN COMMAND
   ========================================================= */

async function execute(text) {

    const command =
        cleanText(text);

    if (!command) {
        return;
    }

    /*
       Prevent double-click / duplicate commands.
    */

    if (commandRunning) {
        return;
    }

    commandRunning = true;

    showUser(command);

    try {

        /*
           FIRST:
           instant local commands
        */

        const basicAnswer =
            basic(command);

        if (basicAnswer) {

            answer(basicAnswer);

            saveMemory(
                command,
                basicAnswer
            );

            return;
        }


        /*
           SECOND:
           screenshot features
        */

        const toolAnswer =
            await runTool(command);

        if (toolAnswer) {

            answer(toolAnswer);

            saveMemory(
                command,
                toolAnswer
            );

            return;
        }


        /*
           THIRD:
           general AI fallback
        */

        const aiAnswer =
            await aiFallback(command);

        answer(aiAnswer);

        saveMemory(
            command,
            aiAnswer
        );

    } catch (error) {

        console.error(
            "JARVIS command error:",
            error
        );

        answer(
            "Sorry, I couldn't process that command."
        );

    } finally {

        commandRunning = false;
    }
}


/* =========================================================
   SEND BUTTON
   ========================================================= */

if (send) {

    send.addEventListener(
        "click",
        () => {

            const value =
                msg
                    ? msg.value.trim()
                    : "";

            if (!value) {
                return;
            }

            msg.value = "";

            execute(value);
        }
    );
}


/* =========================================================
   ENTER KEY
   ========================================================= */

if (msg) {

    msg.addEventListener(
        "keydown",
        event => {

            if (event.key !== "Enter") {
                return;
            }

            event.preventDefault();

            const value =
                msg.value.trim();

            if (!value) {
                return;
            }

            msg.value = "";

            execute(value);
        }
    );
}


/* =========================================================
   VOICE INPUT
   ========================================================= */

function setupVoice() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        if (mic) {
            mic.title =
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

        listening = true;

        if (mic) {

            mic.classList.add(
                "listening"
            );

            mic.textContent = "🔴";
        }
    };


    recognition.onresult = event => {

        let text =
            event.results?.[0]?.[0]?.transcript
                ?.trim();

        if (!text) {
            return;
        }

        /*
           Voice recognition sometimes adds punctuation.
           Clean it before command processing.
        */

        text =
            text
                .replace(/[।]/g, ".")
                .replace(/\s+/g, " ")
                .trim();

        if (msg) {
            msg.value = text;
        }

        execute(text);
    };


    recognition.onerror = event => {

        console.warn(
            "Speech recognition:",
            event.error
        );
    };


    recognition.onend = () => {

        listening = false;

        if (mic) {

            mic.classList.remove(
                "listening"
            );

            mic.textContent = "🎙️";
        }
    };


    if (mic) {

        mic.addEventListener(
            "click",
            () => {

                try {

                    if (listening) {

                        recognition.stop();

                    } else {

                        recognition.start();
                    }

                } catch (error) {

                    console.warn(
                        "Microphone start error:",
                        error
                    );
                }
            }
        );
    }
}


/* =========================================================
   CAMERA / IMAGE BUTTON
   ========================================================= */

function setupCamera() {

    if (!cam || !imageInput) {
        return;
    }

    cam.addEventListener(
        "click",
        () => {
            imageInput.click();
        }
    );


    imageInput.addEventListener(
        "change",
        event => {

            const file =
                event.target.files?.[0];

            if (!file) {
                return;
            }

            showUser(
                "Analyze this image."
            );

            showJarvis(
                "Image received. Analyzing..."
            );

            const image =
                new Image();

            const objectURL =
                URL.createObjectURL(file);

            image.onload = () => {

                answer(
                    `Image loaded successfully. ` +
                    `Resolution: ${image.width} × ${image.height}px. ` +
                    `File type: ${file.type}.`,
                    false
                );

                URL.revokeObjectURL(
                    objectURL
                );
            };

            image.onerror = () => {

                answer(
                    "I couldn't read this image.",
                    false
                );

                URL.revokeObjectURL(
                    objectURL
                );
            };

            image.src = objectURL;

            imageInput.value = "";
        }
    );
}


/* =========================================================
   FEATURE CARD CLICK SUPPORT
   ========================================================= */

/*
   This does NOT depend on the description text.
   It searches for the feature title itself, so the
   screenshot cards can contain Telugu descriptions
   without breaking the click handler.
*/

function bindFeatureCard(title, command) {

    const nodes =
        document.querySelectorAll(
            "div, article, section, li, button"
        );

    nodes.forEach(node => {

        if (
            node.dataset.jarvisFeature === "1"
        ) {
            return;
        }

        const directText =
            Array.from(node.childNodes)
                .filter(
                    child =>
                        child.nodeType === 3
                )
                .map(
                    child =>
                        child.textContent
                )
                .join(" ")
                .trim();

        const fullText =
            lower(node.textContent);

        const titleLower =
            lower(title);

        /*
           Match the feature title while avoiding
           the entire large page container.
        */

        const matches =
            lower(directText) === titleLower ||
            fullText === titleLower;

        if (!matches) {
            return;
        }

        /*
           Ignore very large containers.
        */

        if (
            node.children.length > 8 ||
            node.textContent.length > 250
        ) {
            return;
        }

        node.dataset.jarvisFeature = "1";

        node.style.cursor = "pointer";

        node.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                execute(command);
            }
        );
    });
}


function setupFeatureCards() {

    bindFeatureCard(
        "Time",
        "time"
    );

    bindFeatureCard(
        "Weather",
        "weather"
    );

    bindFeatureCard(
        "Timer",
        "set timer for 10 seconds"
    );

    bindFeatureCard(
        "Dice / Coin",
        "roll dice"
    );

    bindFeatureCard(
        "Joke",
        "tell me a joke"
    );

    bindFeatureCard(
        "Quote",
        "give me a motivational quote"
    );

    bindFeatureCard(
        "News",
        "latest news"
    );

    bindFeatureCard(
        "Translate",
        "translate hello to Telugu"
    );

    bindFeatureCard(
        "Currency",
        "100 USD to INR"
    );

    bindFeatureCard(
        "Meaning",
        "meaning of intelligent"
    );

    bindFeatureCard(
        "Password",
        "generate strong password"
    );

    bindFeatureCard(
        "Search",
        "search artificial intelligence"
    );

    bindFeatureCard(
        "Open Apps",
        "open YouTube"
    );

    bindFeatureCard(
        "Play Songs",
        "play trending music"
    );

    bindFeatureCard(
        "Crypto",
        "Bitcoin price"
    );
}


/* =========================================================
   STARTUP
   ========================================================= */

function startJarvis() {

    setupVoice();

    setupCamera();

    setupFeatureCards();

    startClock()
        .catch(
            error =>
                console.warn(
                    "Clock startup:",
                    error
                )
        );

    if (
        chat &&
        chat.children.length === 0
    ) {

        showJarvis(
            "J.A.R.V.I.S online. All systems ready."
        );
    }
}


/* =========================================================
   INITIALIZE ONLY ONCE
   ========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        startJarvis,
        {
            once: true
        }
    );

} else {

    startJarvis();
}


/* =========================================================
   GLOBAL JARVIS OBJECT
   ========================================================= */

window.JARVIS = {
    execute,
    currentTime,
    currentWeather,
    syncLiveTime,
    speak,
    makePassword
};
