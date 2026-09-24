/* =========================================================
   J.A.R.V.I.S COMPLETE SCRIPT
   PART 1
   ========================================================= */

"use strict";

/* ================= CONFIG ================= */

const CONFIG = {
    TIME_ZONE: "Asia/Kolkata",

    TIME_APIS: [
        "https://timeapi.io/api/Time/current/zone?timeZone=Asia/Kolkata",
        "https://utctime.app/api/now/Asia/Kolkata"
    ],

    WEATHER_API: "https://api.open-meteo.com/v1/forecast",

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

    MEMORY_KEY: "jarvis_memory_v3"
};


/* ================= DOM ================= */

const chat = document.getElementById("chat");
const msg = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");
const camBtn = document.getElementById("cam-btn");
const clearBtn = document.getElementById("clear-btn");
const imgInput = document.getElementById("img-input");


/* ================= STATE ================= */

let liveTimeOffset = 0;
let liveTimeSynced = false;
let timeSyncRunning = false;

let recognition = null;
let listening = false;

let timerID = null;
let busy = false;

let weatherCache = null;
let weatherCacheTime = 0;


/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function normalize(text) {
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


async function fetchJSON(url, options = {}, timeout = 10000) {

    const controller = new AbortController();

    const timeoutID = setTimeout(
        () => controller.abort(),
        timeout
    );

    try {

        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            cache: "no-store"
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

function addMessage(text, type) {

    if (!chat) return;

    const div = document.createElement("div");

    div.className =
        type === "user"
            ? "user-message"
            : "jarvis-message";

    div.innerHTML =
        escapeHTML(text)
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


function reply(text, speakNow = true) {

    if (!text) return;

    jarvisMessage(text);

    if (speakNow) {
        speak(text);
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

        const voice =
            new SpeechSynthesisUtterance(
                String(text)
            );

        voice.lang = "en-IN";
        voice.rate = 1;
        voice.pitch = 1;
        voice.volume = 1;

        speechSynthesis.speak(voice);

    } catch (error) {

        console.warn(
            "Speech error:",
            error
        );
    }
}


/* =========================================================
   LIVE TIME
   ========================================================= */

function parseServerTime(data) {

    if (!data) return null;

    const candidates = [
        data.dateTime,
        data.datetime,
        data.currentDateTime,
        data.utcDateTime,
        data.utc_datetime,
        data.timestamp
    ];

    for (const value of candidates) {

        if (!value) continue;

        const date = new Date(value);

        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }

    return null;
}


async function syncLiveTime() {

    if (timeSyncRunning) {
        return liveTimeSynced;
    }

    timeSyncRunning = true;

    const requestStart = Date.now();

    try {

        for (const api of CONFIG.TIME_APIS) {

            try {

                const data =
                    await fetchJSON(
                        api,
                        {},
                        5000
                    );

                const serverDate =
                    parseServerTime(data);

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
                    api
                );
            }
        }

        liveTimeSynced = false;

        return false;

    } finally {

        timeSyncRunning = false;
    }
}


function getLiveDate() {

    return new Date(
        Date.now() + liveTimeOffset
    );
}


function getLiveTimeString() {

    return new Intl.DateTimeFormat(
        "en-IN",
        {
            timeZone: CONFIG.TIME_ZONE,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        }
    ).format(getLiveDate());
}


function getLiveDateString() {

    return new Intl.DateTimeFormat(
        "en-IN",
        {
            timeZone: CONFIG.TIME_ZONE,
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric"
        }
    ).format(getLiveDate());
}


async function getTime() {

    if (!liveTimeSynced) {
        await syncLiveTime();
    }

    return (
        `The current time is ${getLiveTimeString()}. ` +
        `Today is ${getLiveDateString()}.`
    );
}


/* =========================================================
   LIVE CLOCK
   ========================================================= */

function updateClock() {

    const time =
        getLiveTimeString();

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

    updateClock();

    setInterval(
        updateClock,
        1000
    );

    setInterval(
        syncLiveTime,
        60000
    );
}


/* =========================================================
   TIME COMMAND
   ========================================================= */

function isTimeCommand(text) {

    const t = normalize(text);

    return (
        t === "time" ||
        t.includes("what time") ||
        t.includes("current time") ||
        t.includes("tell me the time") ||
        t.includes("time now") ||
        t.includes("clock") ||
        t.includes("టైమ్") ||
        t.includes("సమయం")
    );
}


/* =========================================================
   WEATHER
   ========================================================= */

function weatherDescription(code) {

    const weather = {
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
        99: "thunderstorm with heavy hail"
    };

    return weather[code] || "unknown conditions";
}


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
        }
    );
}


async function getWeather() {

    if (
        weatherCache &&
        Date.now() - weatherCacheTime < 120000
    ) {
        return weatherCache;
    }

    try {

        const location =
            await getLocation();

        const url =
            CONFIG.WEATHER_API +
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

        const answer =
            `Current temperature is ${current.temperature_2m}°C. ` +
            `It feels like ${current.apparent_temperature}°C. ` +
            `Humidity is ${current.relative_humidity_2m}%. ` +
            `Conditions are ${weatherDescription(current.weather_code)}. ` +
            `Wind speed is ${current.wind_speed_10m} km/h.`;

        weatherCache = answer;
        weatherCacheTime = Date.now();

        return answer;

    } catch (error) {

        return (
            "I couldn't access live weather. " +
            "Please allow location permission and try again."
        );
    }
}


/* =========================================================
   TIMER
   ========================================================= */

function getTimerSeconds(text) {

    let match =
        text.match(
            /(\d+(?:\.\d+)?)\s*(seconds?|secs?|sec|s)\b/i
        );

    if (match) {
        return Number(match[1]);
    }

    match =
        text.match(
            /(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|m)\b/i
        );

    if (match) {
        return Number(match[1]) * 60;
    }

    match =
        text.match(
            /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h)\b/i
        );

    if (match) {
        return Number(match[1]) * 3600;
    }

    return null;
}


function isTimerCommand(text) {

    const t = normalize(text);

    return (
        t.includes("timer") ||
        t.includes("countdown") ||
        t.includes("టైమర్")
    );
}


function setTimer(text) {

    const seconds =
        getTimerSeconds(text);

    if (!seconds || seconds <= 0) {

        return (
            "Please specify a duration. " +
            "Example: set timer for 30 seconds."
        );
    }

    if (timerID) {
        clearTimeout(timerID);
    }

    timerID =
        setTimeout(
            () => {

                reply(
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

function isDiceCommand(text) {

    const t = normalize(text);

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


function diceCommand(text) {

    const t = normalize(text);

    if (
        t.includes("coin") ||
        t.includes("toss")
    ) {

        const result =
            Math.random() < 0.5
                ? "Heads"
                : "Tails";

        return (
            `Coin toss result: ${result}.`
        );
    }

    const match =
        t.match(
            /(?:d|dice)\s*(\d+)/i
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
        `You rolled a ${sides}-sided die. ` +
        `Result: ${result}.`
    );
}


/* =========================================================
   JOKE
   ========================================================= */

function isJokeCommand(text) {

    const t = normalize(text);

    return (
        t.includes("joke") ||
        t.includes("make me laugh") ||
        t.includes("జోక్")
    );
}


async function getJoke() {

    try {

        const data =
            await fetchJSON(
                CONFIG.JOKE_API,
                {},
                7000
            );

        if (
            data.setup &&
            data.punchline
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

function isQuoteCommand(text) {

    const t = normalize(text);

    return (
        t.includes("quote") ||
        t.includes("motivation") ||
        t.includes("motivational") ||
        t.includes("inspire me") ||
        t.includes("మోటివేషన్")
    );
}


async function getQuote() {

    try {

        const data =
            await fetchJSON(
                CONFIG.QUOTE_API,
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


/* =========================================================
   TRANSLATE
   ========================================================= */

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


function isTranslateCommand(text) {

    return normalize(text)
        .includes("translate");
}


function getTranslationInfo(text) {

    const match =
        text.match(
            /translate\s+(.+?)\s+(?:to|into)\s+([a-zA-Z-]+)$/i
        );

    if (!match) {
        return null;
    }

    return {
        phrase: match[1].trim(),
        language: match[2].trim()
    };
}


async function translateText(text) {

    const info =
        getTranslationInfo(text);

    if (!info) {

        return (
            "Example: translate hello to Telugu."
        );
    }

    const target =
        languageCodes[
            normalize(info.language)
        ] ||
        info.language;

    try {

        const url =
            CONFIG.TRANSLATE_API +
            `?q=${encodeURIComponent(info.phrase)}` +
            `&langpair=en|${encodeURIComponent(target)}`;

        const data =
            await fetchJSON(
                url,
                {},
                8000
            );

        const translated =
            data?.responseData?.translatedText;

        if (translated) {

            return (
                `Translation: ${translated}`
            );
        }

    } catch (error) {}

    return (
        "Translation service is unavailable right now."
    );
}
/* =========================================================
   J.A.R.V.I.S COMPLETE SCRIPT
   PART 2
   ========================================================= */


/* =========================================================
   CURRENCY
   ========================================================= */

const currencyMap = {

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

    const clean =
        normalize(value);

    return (
        currencyMap[clean] ||
        clean.toUpperCase()
    );
}


function isCurrencyCommand(text) {

    const t = normalize(text);

    return (
        t.includes("currency") ||
        (
            t.includes("convert") &&
            (
                t.includes("usd") ||
                t.includes("inr") ||
                t.includes("eur") ||
                t.includes("gbp") ||
                t.includes("rupee") ||
                t.includes("dollar")
            )
        ) ||
        /\d+\s*(usd|inr|eur|gbp)\s+(to|in)\s+/i.test(t)
    );
}


function parseCurrency(text) {

    let match =
        text.match(
            /(\d+(?:\.\d+)?)\s*([a-z]{3}|dollars?|rupees?|euros?|pounds?)\s+(?:to|in)\s+([a-z]{3}|dollars?|rupees?|euros?|pounds?)/i
        );

    if (match) {

        return {
            amount: Number(match[1]),
            from: currencyCode(match[2]),
            to: currencyCode(match[3])
        };
    }

    return null;
}


async function convertCurrency(text) {

    const info =
        parseCurrency(text);

    if (!info) {

        return (
            "Use it like: 100 USD to INR."
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
            await fetchJSON(
                CONFIG.CURRENCY_API +
                info.from,
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


/* =========================================================
   MEANING
   ========================================================= */

function isMeaningCommand(text) {

    const t = normalize(text);

    return (
        t.startsWith("meaning of ") ||
        t.startsWith("define ") ||
        t.startsWith("definition of ")
    );
}


function extractWord(text) {

    const match =
        text.match(
            /(?:meaning of|define|definition of)\s+(.+)$/i
        );

    return match
        ? match[1].trim()
        : null;
}


async function getMeaning(text) {

    const word =
        extractWord(text);

    if (!word) {

        return (
            "Example: meaning of intelligent."
        );
    }

    try {

        const data =
            await fetchJSON(
                CONFIG.DICTIONARY_API +
                encodeURIComponent(word),
                {},
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

function isPasswordCommand(text) {

    const t = normalize(text);

    return (
        t.includes("password") ||
        t.includes("generate password") ||
        t.includes("strong password") ||
        t.includes("పాస్వర్డ్")
    );
}


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


function passwordCommand(text) {

    const match =
        text.match(/\b(\d{1,2})\b/);

    const length =
        match
            ? Number(match[1])
            : 16;

    return (
        `Generated strong password:\n` +
        generatePassword(length)
    );
}


/* =========================================================
   SEARCH
   ========================================================= */

function isSearchCommand(text) {

    const t = normalize(text);

    return (
        t.startsWith("search ") ||
        t.startsWith("google ") ||
        t.startsWith("look up ") ||
        t.startsWith("find ")
    );
}


function searchCommand(text) {

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


/* =========================================================
   OPEN APPS
   ========================================================= */

function isOpenAppCommand(text) {

    const t = normalize(text);

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


function openApp(text) {

    const t = normalize(text);

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

        spotify:
            "https://open.spotify.com/"
    };

    for (const app in apps) {

        if (t.includes(app)) {

            window.open(
                apps[app],
                "_blank",
                "noopener,noreferrer"
            );

            return (
                `Opening ${app}.`
            );
        }
    }

    return (
        "Available apps include YouTube, Google, Gmail, " +
        "WhatsApp, Instagram, Facebook, GitHub, Maps and Spotify."
    );
}


/* =========================================================
   PLAY SONGS
   ========================================================= */

function isPlaySongCommand(text) {

    const t = normalize(text);

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


/* =========================================================
   CRYPTO
   ========================================================= */

const cryptoIDs = {

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

    const t = normalize(text);

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


async function getCrypto(text) {

    const t = normalize(text);

    let coin = "bitcoin";

    for (const key in cryptoIDs) {

        if (t.includes(key)) {
            coin = cryptoIDs[key];
            break;
        }
    }

    try {

        const url =
            CONFIG.CRYPTO_API +
            `?ids=${encodeURIComponent(coin)}` +
            `&vs_currencies=usd,inr`;

        const data =
            await fetchJSON(
                url,
                {},
                8000
            );

        const result =
            data?.[coin];

        if (!result) {
            throw new Error("No crypto data");
        }

        return (
            `${coin} current price is ` +
            `$${Number(result.usd).toLocaleString()} ` +
            `or ₹${Number(result.inr).toLocaleString()}.`
        );

    } catch (error) {

        return (
            "I couldn't fetch the live crypto price right now."
        );
    }
}


/* =========================================================
   NEWS
   ========================================================= */

function isNewsCommand(text) {

    const t = normalize(text);

    return (
        t === "news" ||
        t.includes("latest news") ||
        t.includes("today news") ||
        t.includes("headlines") ||
        t.includes("న్యూస్")
    );
}


async function getNews() {

    try {

        const data =
            await fetchJSON(
                CONFIG.NEWS_API,
                {},
                9000
            );

        const items =
            data?.items?.slice(0, 5);

        if (!items?.length) {
            throw new Error("No news");
        }

        return (
            "Latest headlines:\n" +
            items
                .map(
                    (item, index) =>
                        `${index + 1}. ${item.title}`
                )
                .join("\n")
        );

    } catch (error) {

        return (
            "I couldn't load the latest news right now."
        );
    }
}


/* =========================================================
   YOUTUBE
   ========================================================= */

function isYouTubeCommand(text) {

    const t = normalize(text);

    return (
        t === "youtube" ||
        t.startsWith("youtube ")
    );
}


function youtubeCommand(text) {

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

function basicCommand(text) {

    const t = normalize(text);

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

async function handleTools(text) {

    const t = normalize(text);


    /* 1 TIME */

    if (isTimeCommand(t)) {

        if (!liveTimeSynced) {
            await syncLiveTime();
        }

        return await getTime();
    }


    /* 2 WEATHER */

    if (
        t === "weather" ||
        t.includes("weather") ||
        t.includes("temperature") ||
        t.includes("వాతావరణం") ||
        t.includes("వెదర్")
    ) {

        return await getWeather();
    }


    /* 3 TIMER */

    if (isTimerCommand(t)) {

        return setTimer(t);
    }


    /* 4 DICE / COIN */

    if (isDiceCommand(t)) {

        return diceCommand(t);
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

        return await translateText(text);
    }


    /* 9 CURRENCY */

    if (isCurrencyCommand(t)) {

        return await convertCurrency(text);
    }


    /* 10 MEANING */

    if (isMeaningCommand(t)) {

        return await getMeaning(text);
    }


    /* 11 PASSWORD */

    if (isPasswordCommand(t)) {

        return passwordCommand(text);
    }


    /* 12 SEARCH */

    if (isSearchCommand(t)) {

        return searchCommand(text);
    }


    /* 13 OPEN APPS */

    if (isOpenAppCommand(t)) {

        return openApp(text);
    }


    /* 14 PLAY SONGS */

    if (isPlaySongCommand(t)) {

        return playSong(text);
    }


    /* 15 CRYPTO */

    if (isCryptoCommand(t)) {

        return await getCrypto(text);
    }


    /* YOUTUBE */

    if (isYouTubeCommand(t)) {

        return youtubeCommand(text);
    }


    return null;
}


/* =========================================================
   MEMORY
   ========================================================= */

function loadMemory() {

    try {

        const data =
            localStorage.getItem(
                CONFIG.MEMORY_KEY
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
            CONFIG.MEMORY_KEY,
            JSON.stringify(
                memory.slice(-50)
            )
        );

    } catch (error) {}
}


function remember(user, assistant) {

    const memory =
        loadMemory();

    memory.push({
        user,
        assistant,
        timestamp:
            new Date().toISOString()
    });

    saveMemory(memory);
}


/* =========================================================
   AI FALLBACK
   ========================================================= */

async function aiFallback(text) {

    try {

        const prompt =
            `You are J.A.R.V.I.S, a helpful personal AI assistant.
Give a short, accurate answer.
User: ${text}`;

        const response =
            await fetch(
                "https://text.pollinations.ai/" +
                encodeURIComponent(prompt),
                {
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
            "AI fallback error:",
            error
        );
    }

    return (
        "I couldn't understand that command. " +
        "Try one of the available J.A.R.V.I.S features."
    );
}


/* =========================================================
   MAIN EXECUTOR
   ========================================================= */

async function executeCommand(text) {

    const command =
        String(text || "").trim();

    if (!command || busy) {
        return;
    }

    busy = true;

    userMessage(command);

    try {

        /* BASIC */

        const basic =
            basicCommand(command);

        if (basic) {

            reply(basic);

            remember(
                command,
                basic
            );

            return;
        }


        /* 15 TOOLS */

        const tool =
            await handleTools(command);

        if (tool) {

            reply(tool);

            remember(
                command,
                tool
            );

            return;
        }


        /* AI */

        const answer =
            await aiFallback(command);

        reply(answer);

        remember(
            command,
            answer
        );

    } catch (error) {

        console.error(
            "JARVIS error:",
            error
        );

        reply(
            "Sorry, something went wrong."
        );

    } finally {

        busy = false;
    }
}


/* =========================================================
   SEND BUTTON
   ========================================================= */

if (sendBtn) {

    sendBtn.addEventListener(
        "click",
        () => {

            const text =
                msg?.value?.trim();

            if (!text) return;

            msg.value = "";

            executeCommand(text);
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

            if (event.key === "Enter") {

                event.preventDefault();

                const text =
                    msg.value.trim();

                if (!text) return;

                msg.value = "";

                executeCommand(text);
            }
        }
    );
}


/* =========================================================
   CLEAR MEMORY
   ========================================================= */

if (clearBtn) {

    clearBtn.addEventListener(
        "click",
        () => {

            try {

                localStorage.removeItem(
                    CONFIG.MEMORY_KEY
                );

            } catch (error) {}

            if (chat) {
                chat.innerHTML = "";
            }

            jarvisMessage(
                "Memory cleared successfully."
            );
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

        if (micBtn) {
            micBtn.title =
                "Speech recognition is not supported.";
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

        if (micBtn) {

            micBtn.classList.add(
                "listening"
            );

            micBtn.textContent = "🔴";
        }
    };


    recognition.onresult = event => {

        const text =
            event.results?.[0]?.[0]?.transcript
                ?.trim();

        if (!text) return;

        if (msg) {
            msg.value = text;
        }

        executeCommand(text);
    };


    recognition.onerror = error => {

        console.warn(
            "Voice error:",
            error.error
        );
    };


    recognition.onend = () => {

        listening = false;

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

                try {

                    if (listening) {
                        recognition.stop();
                    } else {
                        recognition.start();
                    }

                } catch (error) {

                    console.warn(
                        "Microphone error:",
                        error
                    );
                }
            }
        );
    }
}


/* =========================================================
   CAMERA / IMAGE
   ========================================================= */

function setupCamera() {

    if (!camBtn || !imgInput) {
        return;
    }

    camBtn.addEventListener(
        "click",
        () => {
            imgInput.click();
        }
    );


    imgInput.addEventListener(
        "change",
        event => {

            const file =
                event.target.files?.[0];

            if (!file) return;

            userMessage(
                "Analyze this image."
            );

            jarvisMessage(
                "Image received. Analyzing..."
            );

            const image =
                new Image();

            const url =
                URL.createObjectURL(file);

            image.onload = () => {

                reply(
                    `Image loaded successfully. ` +
                    `Resolution: ${image.width} × ${image.height}px. ` +
                    `Type: ${file.type}.`,
                    false
                );

                URL.revokeObjectURL(url);
            };

            image.onerror = () => {

                reply(
                    "I couldn't read this image.",
                    false
                );

                URL.revokeObjectURL(url);
            };

            image.src = url;

            imgInput.value = "";
        }
    );
}


/* =========================================================
   FEATURE CARDS
   ========================================================= */

function setupFeatureCards() {

    const all =
        document.querySelectorAll(
            "div, article, section, button"
        );

    all.forEach(element => {

        if (
            element === sendBtn ||
            element === micBtn ||
            element === camBtn ||
            element === clearBtn
        ) {
            return;
        }

        if (
            element.dataset.jarvisBound === "1"
        ) {
            return;
        }

        const text =
            normalize(
                element.textContent
            );

        if (!text || text.length > 100) {
            return;
        }

        let command = null;


        if (text === "time") {

            command = "time";

        } else if (text === "weather") {

            command = "weather";

        } else if (text === "timer") {

            command =
                "set timer for 10 seconds";

        } else if (
            text.includes("dice") ||
            text.includes("coin")
        ) {

            command = "roll dice";

        } else if (text === "joke") {

            command =
                "tell me a joke";

        } else if (text === "quote") {

            command =
                "give me a motivational quote";

        } else if (text === "news") {

            command =
                "latest news";

        } else if (text === "translate") {

            command =
                "translate hello to Telugu";

        } else if (text === "currency") {

            command =
                "100 USD to INR";

        } else if (text === "meaning") {

            command =
                "meaning of intelligent";

        } else if (text === "password") {

            command =
                "generate strong password";

        } else if (text === "search") {

            command =
                "search artificial intelligence";

        } else if (
            text === "open apps" ||
            text.includes("open apps")
        ) {

            command =
                "open Google";

        } else if (
            text === "play songs" ||
            text.includes("play songs")
        ) {

            command =
                "play trending music";

        } else if (text === "crypto") {

            command =
                "Bitcoin price";
        }


        if (!command) {
            return;
        }


        element.dataset.jarvisBound = "1";

        element.style.cursor = "pointer";

        element.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                executeCommand(command);
            }
        );
    });
}


/* =========================================================
   START J.A.R.V.I.S
   ========================================================= */

function startJarvis() {

    setupVoice();

    setupCamera();

    setupFeatureCards();

    startLiveClock()
        .catch(
            error =>
                console.warn(
                    "Clock startup error:",
                    error
                )
        );

    if (
        chat &&
        chat.children.length === 0
    ) {

        jarvisMessage(
            "J.A.R.V.I.S online. All systems ready.",
            false
        );
    }
}


/* =========================================================
   INITIALIZE
   ========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        startJarvis
    );

} else {

    startJarvis();
}


/* =========================================================
   GLOBAL ACCESS
   ========================================================= */

window.JARVIS = {
    executeCommand,
    getTime,
    getWeather,
    syncLiveTime,
    generatePassword,
    speak
};
