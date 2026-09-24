 /* =========================================================
   J.A.R.V.I.S. - SCRIPT.JS
   PART 1 / 2
   Fast Voice + UI + Smart Command System
   ========================================================= */

"use strict";

/* =========================
   EXACT HTML ELEMENTS
   ========================= */

const chat = document.getElementById("chat");
const msg = document.getElementById("msg");
const send = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");
const camBtn = document.getElementById("cam-btn");
const clearBtn = document.getElementById("clear-btn");
const imgInput = document.getElementById("img-input");


/* =========================
   CONFIG
   ========================= */

const CONFIG = {
    voiceLang: "en-IN",
    voiceRate: 1.22,
    voicePitch: 1,
    voiceVolume: 1,
    apiTimeout: 7000,
    memoryKey: "jarvis_memory_v1"
};


/* =========================
   VOICE ENGINE
   ========================= */

let voices = [];
let selectedVoice = null;
let speaking = false;

function loadVoices() {

    if (!("speechSynthesis" in window)) return;

    voices = speechSynthesis.getVoices();

    selectedVoice =
        voices.find(v => v.lang === "en-IN") ||
        voices.find(v => v.lang === "en-GB") ||
        voices.find(v => v.lang === "en-US") ||
        voices.find(v => /^en/i.test(v.lang)) ||
        voices[0] ||
        null;
}

loadVoices();

if ("speechSynthesis" in window) {
    speechSynthesis.onvoiceschanged = loadVoices;
}


/* =========================
   FAST SPEAK
   ========================= */

function speak(text) {

    if (!("speechSynthesis" in window)) return;
    if (!text) return;

    const clean = String(text)
        .replace(/\s+/g, " ")
        .trim();

    if (!clean) return;

    /*
       Cancel previous queue immediately.
       This prevents old responses waiting in queue.
    */
    speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(clean);

    u.lang =
        selectedVoice?.lang ||
        CONFIG.voiceLang;

    u.rate = CONFIG.voiceRate;
    u.pitch = CONFIG.voicePitch;
    u.volume = CONFIG.voiceVolume;

    if (selectedVoice) {
        u.voice = selectedVoice;
    }

    u.onstart = () => {
        speaking = true;
    };

    u.onend = () => {
        speaking = false;
    };

    u.onerror = () => {
        speaking = false;
    };

    /*
       Start without unnecessary delay.
    */
    speechSynthesis.speak(u);
}


/* =========================
   STOP SPEAKING
   ========================= */

function stopSpeaking() {

    if ("speechSynthesis" in window) {
        speechSynthesis.cancel();
    }

    speaking = false;
}


/* =========================
   MEMORY
   ========================= */

let memory = [];

try {
    memory =
        JSON.parse(
            localStorage.getItem(CONFIG.memoryKey)
        ) || [];
} catch {
    memory = [];
}


function remember(role, text) {

    memory.push({
        role,
        text: String(text),
        time: Date.now()
    });

    /*
       Keep memory small for faster operation.
    */
    if (memory.length > 50) {
        memory = memory.slice(-50);
    }

    try {
        localStorage.setItem(
            CONFIG.memoryKey,
            JSON.stringify(memory)
        );
    } catch {}
}


function clearMemory() {

    memory = [];

    try {
        localStorage.removeItem(
            CONFIG.memoryKey
        );
    } catch {}

    if (chat) {
        chat.innerHTML = "";
    }

    addMessage(
        "Memory cleared, Boss.",
        "jarvis"
    );
}


/* =========================
   CHAT UI
   ========================= */

function addMessage(text, type = "jarvis") {

    if (!chat) return;

    const div =
        document.createElement("div");

    div.className =
        type === "user"
            ? "message user"
            : "message jarvis";

    div.textContent =
        String(text);

    chat.appendChild(div);

    /*
       Instant scroll.
    */
    chat.scrollTop =
        chat.scrollHeight;

    return div;
}


/* =========================
   SAFE API FETCH
   ========================= */

async function fetchJSON(
    url,
    options = {},
    timeout = CONFIG.apiTimeout
) {

    const controller =
        new AbortController();

    const timer =
        setTimeout(
            () => controller.abort(),
            timeout
        );

    try {

        const response =
            await fetch(url, {
                ...options,
                signal:
                    controller.signal
            });

        if (!response.ok) {
            throw new Error(
                "HTTP " + response.status
            );
        }

        return await response.json();

    } finally {

        clearTimeout(timer);
    }
}


/* =========================
   TEXT NORMALIZATION
   ========================= */

function normalize(text) {

    return String(text || "")
        .toLowerCase()
        .replace(/[.,!?;:()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


/* =========================
   SMART WORD CORRECTION
   ========================= */

const COMMAND_WORDS = [

    "time",
    "weather",
    "timer",
    "dice",
    "roll",
    "coin",
    "toss",
    "joke",
    "quote",
    "news",
    "translate",
    "currency",
    "convert",
    "dictionary",
    "define",
    "password",
    "generate",
    "search",
    "google",
    "youtube",
    "play",
    "crypto",
    "bitcoin",
    "ethereum",
    "open",
    "camera",
    "clear",
    "memory",
    "hello",
    "hi",
    "hey"
];


/* =========================
   LEVENSHTEIN
   ========================= */

function distance(a, b) {

    if (a === b) return 0;

    const dp =
        Array.from(
            { length: a.length + 1 },
            () =>
                new Array(
                    b.length + 1
                ).fill(0)
        );

    for (let i = 0; i <= a.length; i++) {
        dp[i][0] = i;
    }

    for (let j = 0; j <= b.length; j++) {
        dp[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {

        for (let j = 1; j <= b.length; j++) {

            dp[i][j] =
                a[i - 1] === b[j - 1]
                    ? dp[i - 1][j - 1]
                    : 1 +
                      Math.min(
                          dp[i - 1][j],
                          dp[i][j - 1],
                          dp[i - 1][j - 1]
                      );
        }
    }

    return dp[a.length][b.length];
}


/* =========================
   SMART CORRECTION
   ========================= */

function smartCorrect(text) {

    let words =
        normalize(text)
            .split(" ")
            .filter(Boolean);

    const aliases = {

        "wether": "weather",
        "wheather": "weather",
        "weater": "weather",

        "timmer": "timer",
        "timar": "timer",
        "tymer": "timer",

        "dic": "dice",
        "dyce": "dice",

        "coine": "coin",
        "con": "coin",

        "jock": "joke",
        "jok": "joke",

        "qoute": "quote",
        "quate": "quote",

        "newz": "news",
        "nwes": "news",

        "translet": "translate",
        "tranlate": "translate",

        "currancy": "currency",
        "curency": "currency",

        "dictinary": "dictionary",
        "dictionery": "dictionary",

        "pasword": "password",
        "passwrd": "password",

        "serch": "search",
        "seach": "search",

        "youtub": "youtube",
        "utube": "youtube",

        "plaay": "play",
        "pley": "play",

        "bitcon": "bitcoin",
        "bitcion": "bitcoin",

        "etherium": "ethereum",
        "ethrium": "ethereum",

        "memry": "memory",
        "cleer": "clear"
    };

    words =
        words.map(word => {

            if (aliases[word]) {
                return aliases[word];
            }

            if (word.length < 4) {
                return word;
            }

            let best = word;
            let bestDistance = 2;

            for (const candidate of COMMAND_WORDS) {

                const d =
                    distance(
                        word,
                        candidate
                    );

                if (
                    d < bestDistance
                ) {
                    bestDistance = d;
                    best = candidate;
                }
            }

            return best;
        });

    return words.join(" ");
}


/* =========================
   RESPONSE HELPER
   ========================= */

function respond(text, voice = false) {

    addMessage(
        text,
        "jarvis"
    );

    remember(
        "assistant",
        text
    );

    if (voice) {

        /*
           UI gets rendered first,
           then voice starts immediately.
        */
        setTimeout(
            () => speak(text),
            0
        );
    }

    return text;
}


/* =========================
   TIME
   ========================= */

function getTime() {

    return (
        "The time is " +
        new Date()
            .toLocaleTimeString(
                "en-IN",
                {
                    hour: "numeric",
                    minute: "2-digit"
                }
            ) +
        ", Boss."
    );
}


/* =========================
   WEATHER
   ========================= */

async function getWeather() {

    if (
        !navigator.geolocation
    ) {
        return "Location is not available, Boss.";
    }

    return new Promise(resolve => {

        const timer =
            setTimeout(
                () => {
                    resolve(
                        "Weather location request timed out, Boss."
                    );
                },
                5000
            );

        navigator.geolocation
            .getCurrentPosition(

                async position => {

                    clearTimeout(timer);

                    try {

                        const lat =
                            position.coords.latitude;

                        const lon =
                            position.coords.longitude;

                        const url =
                            "https://api.open-meteo.com/v1/forecast" +
                            "?latitude=" + lat +
                            "&longitude=" + lon +
                            "&current=temperature_2m,weather_code" +
                            "&timezone=auto";

                        const data =
                            await fetchJSON(url);

                        const temp =
                            data?.current?.temperature_2m;

                        if (
                            temp === undefined
                        ) {
                            resolve(
                                "Weather data is unavailable, Boss."
                            );
                            return;
                        }

                        resolve(
                            `Current temperature is ${temp} degrees Celsius, Boss.`
                        );

                    } catch {

                        resolve(
                            "I could not get the weather right now, Boss."
                        );
                    }
                },

                () => {

                    clearTimeout(timer);

                    resolve(
                        "Please allow location permission for weather, Boss."
                    );
                },

                {
                    enableHighAccuracy: false,
                    timeout: 4500,
                    maximumAge: 300000
                }
            );
    });
}


/* =========================
   TIMER
   ========================= */

function createTimer(text) {

    const match =
        normalize(text).match(
            /(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)/
        );

    if (!match) {
        return "Tell me the timer duration, Boss.";
    }

    const amount =
        Number(match[1]);

    const unit =
        match[2];

    let milliseconds;

    if (
        /hour|hr|^h$/.test(unit)
    ) {
        milliseconds =
            amount * 60 * 60 * 1000;
    } else if (
        /minute|min|^m$/.test(unit)
    ) {
        milliseconds =
            amount * 60 * 1000;
    } else {
        milliseconds =
            amount * 1000;
    }

    if (milliseconds > 86400000) {
        return "The maximum timer is 24 hours, Boss.";
    }

    setTimeout(() => {

        speak(
            `Timer finished. ${amount} ${unit}, Boss.`
        );

        addMessage(
            `Timer finished: ${amount} ${unit}.`,
            "jarvis"
        );

    }, milliseconds);

    return `Timer set for ${amount} ${unit}, Boss.`;
}


/* =========================
   DICE
   ========================= */

function rollDice() {

    const result =
        Math.floor(
            Math.random() * 6
        ) + 1;

    return `Dice rolled ${result}, Boss.`;
}


/* =========================
   COIN
   ========================= */

function tossCoin() {

    const result =
        Math.random() < 0.5
            ? "Heads"
            : "Tails";

    return `Coin toss result: ${result}, Boss.`;
}


/* =========================
   JOKE
   ========================= */

async function getJoke() {

    try {

        const data =
            await fetchJSON(
                "https://official-joke-api.appspot.com/random_joke",
                {},
                5000
            );

        return (
            `${data.setup} ${data.punchline}`
        );

    } catch {

        return "Why did the computer go to the doctor? Because it had a virus, Boss.";
    }
}


/* =========================
   QUOTE
   ========================= */

async function getQuote() {

    try {

        const data =
            await fetchJSON(
                "https://dummyjson.com/quotes/random",
                {},
                5000
            );

        return (
            `"${data.quote}" — ${data.author}`
        );

    } catch {

        return (
            `"The secret of getting ahead is getting started."`
        );
    }
}


/* =========================
   DICTIONARY
   ========================= */

async function dictionary(word) {

    word =
        String(word)
            .trim()
            .split(/\s+/)[0];

    if (!word) {
        return "Tell me the word you want defined, Boss.";
    }

    try {

        const data =
            await fetchJSON(
                `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
                {},
                5000
            );

        const meaning =
            data?.[0]
                ?.meanings?.[0]
                ?.definitions?.[0]
                ?.definition;

        return meaning
            ? `${word}: ${meaning}`
            : `I could not find a definition for ${word}, Boss.`;

    } catch {

        return `I could not find a definition for ${word}, Boss.`;
    }
}


/* =========================
   PASSWORD
   ========================= */

function generatePassword(length = 16) {

    length =
        Math.max(
            8,
            Math.min(
                64,
                Number(length) || 16
            )
        );

    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "abcdefghijklmnopqrstuvwxyz" +
        "0123456789!@#$%^&*_-+=";

    let password = "";

    const array =
        new Uint32Array(length);

    crypto.getRandomValues(array);

    for (let i = 0; i < length; i++) {

        password +=
            chars[
                array[i] %
                chars.length
            ];
    }

    return `Generated password: ${password}`;
}


/* =========================
   OPEN SEARCH
   ========================= */

function webSearch(query) {

    query =
        query.trim();

    if (!query) {
        return "Tell me what you want me to search, Boss.";
    }

    window.open(
        "https://www.google.com/search?q=" +
        encodeURIComponent(query),
        "_blank"
    );

    return `Searching for ${query}, Boss.`;
}


/* =========================
   YOUTUBE
   ========================= */

function youtubeSearch(query) {

    query =
        query
            .replace(
                /^(play|youtube)\s*/i,
                ""
            )
            .trim();

    if (!query) {
        return "Tell me the song name, Boss.";
    }

    window.open(
        "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(query),
        "_blank"
    );

    return `Searching YouTube for ${query}, Boss.`;
}


/* =========================
   LOCAL CHAT
   ========================= */

function localChat(text) {

    const t =
        normalize(text);

    if (
        /^(hi|hello|hey|hii|helo)\b/.test(t)
    ) {
        return "Hello Boss. J.A.R.V.I.S. is online.";
    }

    if (
        t.includes("who are you")
    ) {
        return "I am J.A.R.V.I.S., your personal AI assistant.";
    }

    if (
        t.includes("how are you")
    ) {
        return "All systems are operational, Boss.";
    }

    if (
        t.includes("thank")
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

    return null;
}
/* =========================================================
   J.A.R.V.I.S. - SCRIPT.JS
   PART 2 / 2
   Tools + Mic + Camera + Image + Execute
   ========================================================= */


/* =========================
   TRANSLATE
   ========================= */

async function translateText(text) {

    let query =
        text.replace(
            /^translate\s*/i,
            ""
        ).trim();

    if (!query) {
        return "Tell me what you want translated, Boss.";
    }

    try {

        const url =
            "https://api.mymemory.translated.net/get" +
            "?q=" +
            encodeURIComponent(query) +
            "&langpair=en|te";

        const data =
            await fetchJSON(
                url,
                {},
                6000
            );

        const result =
            data?.responseData
                ?.translatedText;

        if (!result) {
            throw new Error();
        }

        return `In Telugu: ${result}`;

    } catch {

        return "Translation service is unavailable right now, Boss.";
    }
}


/* =========================
   CURRENCY
   ========================= */

async function currencyConvert(text) {

    const match =
        text.match(
            /(\d+(?:\.\d+)?)\s*([A-Za-z]{3})\s*(?:to|in)\s*([A-Za-z]{3})/i
        );

    if (!match) {

        return (
            "Use a command like: " +
            "100 USD to INR, Boss."
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
            `https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`;

        const data =
            await fetchJSON(
                url,
                {},
                5000
            );

        const result =
            data?.rates?.[to];

        if (result === undefined) {
            throw new Error();
        }

        return (
            `${amount} ${from} is approximately ` +
            `${result} ${to}, Boss.`
        );

    } catch {

        return "Currency conversion is unavailable right now, Boss.";
    }
}


/* =========================
   CRYPTO
   ========================= */

async function cryptoInfo(text) {

    const normalized =
        normalize(text);

    let coin = "bitcoin";

    if (
        normalized.includes("ethereum") ||
        normalized.includes("eth")
    ) {
        coin = "ethereum";
    }

    if (
        normalized.includes("dogecoin") ||
        normalized.includes("doge")
    ) {
        coin = "dogecoin";
    }

    if (
        normalized.includes("solana") ||
        normalized.includes("sol")
    ) {
        coin = "solana";
    }

    try {

        const url =
            "https://api.coingecko.com/api/v3/simple/price" +
            `?ids=${coin}&vs_currencies=usd,inr`;

        const data =
            await fetchJSON(
                url,
                {},
                6000
            );

        const price =
            data?.[coin];

        if (!price) {
            throw new Error();
        }

        return (
            `${coin} price is approximately ` +
            `$${price.usd} or ₹${price.inr}, Boss.`
        );

    } catch {

        return "Crypto data is unavailable right now, Boss.";
    }
}


/* =========================
   NEWS
   ========================= */

async function getNews() {

    /*
       No API key is required here.
       Google News search is opened directly.
    */

    window.open(
        "https://news.google.com/",
        "_blank"
    );

    return "Opening the latest news, Boss.";
}


/* =========================
   OPEN APPS
   ========================= */

function openApp(text) {

    const t =
        normalize(text);

    let url = null;
    let name = "";

    if (t.includes("youtube")) {

        url =
            "https://www.youtube.com/";
        name = "YouTube";

    } else if (
        t.includes("whatsapp")
    ) {

        url =
            "https://wa.me/";
        name = "WhatsApp";

    } else if (
        t.includes("google")
    ) {

        url =
            "https://www.google.com/";
        name = "Google";

    } else if (
        t.includes("gmail") ||
        t.includes("mail")
    ) {

        url =
            "https://mail.google.com/";
        name = "Gmail";

    } else if (
        t.includes("maps")
    ) {

        url =
            "https://maps.google.com/";
        name = "Google Maps";

    } else if (
        t.includes("instagram")
    ) {

        url =
            "https://www.instagram.com/";
        name = "Instagram";

    } else {

        return "I don't know which app you want to open, Boss.";
    }

    window.open(
        url,
        "_blank"
    );

    return `Opening ${name}, Boss.`;
}


/* =========================
   IMAGE PREVIEW
   ========================= */

function previewImage(file) {

    if (!file) return;

    if (
        !file.type.startsWith("image/")
    ) {
        respond(
            "Please select an image file, Boss.",
            false
        );
        return;
    }

    const oldPreview =
        document.getElementById(
            "jarvis-image-preview"
        );

    if (oldPreview) {
        oldPreview.remove();
    }

    const wrapper =
        document.createElement("div");

    wrapper.id =
        "jarvis-image-preview";

    wrapper.style.margin =
        "10px 0";

    const image =
        document.createElement("img");

    image.style.maxWidth =
        "100%";

    image.style.maxHeight =
        "300px";

    image.style.borderRadius =
        "10px";

    image.style.objectFit =
        "contain";

    image.alt =
        "Uploaded image preview";

    image.src =
        URL.createObjectURL(file);

    wrapper.appendChild(image);

    if (chat) {
        chat.appendChild(wrapper);
        chat.scrollTop =
            chat.scrollHeight;
    }

    return (
        "Image uploaded successfully, Boss."
    );
}


/* =========================
   CAMERA
   ========================= */

function openCamera() {

    /*
       Your HTML already has img-input.
       The existing input doesn't have capture,
       so create a temporary camera input.
    */

    const cameraInput =
        document.createElement("input");

    cameraInput.type =
        "file";

    cameraInput.accept =
        "image/*";

    cameraInput.capture =
        "environment";

    cameraInput.style.display =
        "none";

    document.body.appendChild(
        cameraInput
    );

    cameraInput.addEventListener(
        "change",
        () => {

            const file =
                cameraInput.files?.[0];

            if (file) {

                previewImage(file);

                addMessage(
                    "Camera image received, Boss.",
                    "jarvis"
                );
            }

            cameraInput.remove();
        },
        { once: true }
    );

    cameraInput.click();
}


/* =========================
   IMAGE BUTTON
   ========================= */

if (camBtn) {

    camBtn.addEventListener(
        "click",
        () => {

            openCamera();
        }
    );
}


/* =========================
   IMAGE INPUT
   ========================= */

if (imgInput) {

    imgInput.addEventListener(
        "change",
        () => {

            const file =
                imgInput.files?.[0];

            if (!file) return;

            previewImage(file);
        }
    );
}


/* =========================
   MAIN TOOL HANDLER
   ========================= */

async function handleTools(text) {

    const original =
        String(text || "")
            .trim();

    if (!original) {
        return "Please give me a command, Boss.";
    }

    /*
       Smart correction happens before matching.
    */

    const t =
        smartCorrect(original);


    /* =====================
       TIME
       ===================== */

    if (
        /\btime\b/.test(t) ||
        t.includes("what time")
    ) {
        return getTime();
    }


    /* =====================
       WEATHER
       ===================== */

    if (
        t.includes("weather") ||
        t.includes("temperature")
    ) {
        return await getWeather();
    }


    /* =====================
       TIMER
       ===================== */

    if (
        t.includes("timer") &&
        /\d/.test(t)
    ) {
        return createTimer(t);
    }


    /* =====================
       DICE
       ===================== */

    if (
        t.includes("dice") ||
        t.includes("roll dice")
    ) {
        return rollDice();
    }


    /* =====================
       COIN
       ===================== */

    if (
        t.includes("coin") &&
        (
            t.includes("toss") ||
            t.includes("flip") ||
            t.includes("throw")
        )
    ) {
        return tossCoin();
    }


    /* =====================
       JOKE
       ===================== */

    if (
        t.includes("joke")
    ) {
        return await getJoke();
    }


    /* =====================
       QUOTE
       ===================== */

    if (
        t.includes("quote")
    ) {
        return await getQuote();
    }


    /* =====================
       NEWS
       ===================== */

    if (
        t.includes("news") ||
        t.includes("latest news")
    ) {
        return await getNews();
    }


    /* =====================
       TRANSLATE
       ===================== */

    if (
        t.startsWith("translate ")
    ) {
        return await translateText(
            t
        );
    }


    /* =====================
       CURRENCY
       ===================== */

    if (
        t.includes("currency") ||
        /\b[a-z]{3}\s+to\s+[a-z]{3}\b/i.test(t)
    ) {
        return await currencyConvert(
            t
        );
    }


    /* =====================
       DICTIONARY
       ===================== */

    if (
        t.startsWith("define ") ||
        t.startsWith("dictionary ")
    ) {

        const word =
            t
                .replace(
                    /^define\s*/i,
                    ""
                )
                .replace(
                    /^dictionary\s*/i,
                    ""
                )
                .trim();

        return await dictionary(
            word
        );
    }


    /* =====================
       PASSWORD
       ===================== */

    if (
        t.includes("password") &&
        (
            t.includes("generate") ||
            t.includes("create") ||
            t.includes("make")
        )
    ) {

        const match =
            t.match(/\b(\d{1,2})\b/);

        const length =
            match
                ? Number(match[1])
                : 16;

        return generatePassword(
            length
        );
    }


    /* =====================
       CRYPTO
       ===================== */

    if (
        t.includes("crypto") ||
        t.includes("bitcoin") ||
        t.includes("ethereum") ||
        t.includes("dogecoin") ||
        t.includes("solana")
    ) {
        return await cryptoInfo(
            t
        );
    }


    /* =====================
       YOUTUBE PLAY
       ===================== */

    if (
        t.includes("youtube") ||
        t.startsWith("play ")
    ) {

        return youtubeSearch(
            original
        );
    }


    /* =====================
       OPEN APP
       ===================== */

    if (
        t.startsWith("open ")
    ) {

        return openApp(
            t
        );
    }


    /* =====================
       SEARCH
       ===================== */

    if (
        t.startsWith("search ") ||
        t.startsWith("google ")
    ) {

        const query =
            t
                .replace(
                    /^(search|google)\s*/i,
                    ""
                )
                .trim();

        return webSearch(
            query
        );
    }


    /* =====================
       CLEAR MEMORY
       ===================== */

    if (
        (
            t.includes("clear") ||
            t.includes("delete")
        ) &&
        t.includes("memory")
    ) {

        clearMemory();

        return null;
    }


    /* =====================
       LOCAL CHAT
       ===================== */

    const chatReply =
        localChat(
            original
        );

    if (chatReply) {
        return chatReply;
    }


    return null;
}


/* =========================
   EXECUTE COMMAND
   ========================= */

async function executeCommand(
    command,
    voiceMode = false
) {

    const clean =
        String(command || "")
            .trim();

    if (!clean) return;

    /*
       User message first.
    */

    addMessage(
        clean,
        "user"
    );

    remember(
        "user",
        clean
    );


    /*
       Stop previous voice so the
       new answer can start quickly.
    */

    if (voiceMode) {
        stopSpeaking();
    }


    try {

        const result =
            await handleTools(
                clean
            );

        /*
           Some tools directly update UI.
        */
        if (result === null) {
            return;
        }

        /*
           Fast response.
        */
        respond(
            result,
            voiceMode
        );

    } catch (error) {

        console.error(
            "JARVIS error:",
            error
        );

        respond(
            "Something went wrong while processing that command, Boss.",
            voiceMode
        );
    }
}


/* =========================
   SEND BUTTON
   ========================= */

if (send) {

    send.addEventListener(
        "click",
        () => {

            const command =
                msg?.value?.trim();

            if (!command) return;

            msg.value = "";

            /*
               Typed commands don't speak.
               This makes normal text interaction faster.
            */

            executeCommand(
                command,
                false
            );
        }
    );
}


/* =========================
   ENTER KEY
   ========================= */

if (msg) {

    msg.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                const command =
                    msg.value.trim();

                if (!command) return;

                msg.value = "";

                executeCommand(
                    command,
                    false
                );
            }
        }
    );
}


/* =========================
   SPEECH RECOGNITION
   ========================= */

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let recognition = null;
let listening = false;

if (SpeechRecognition) {

    recognition =
        new SpeechRecognition();

    /*
       Faster recognition.
    */
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.lang =
        CONFIG.voiceLang;


    recognition.onstart = () => {

        listening = true;

        if (micBtn) {

            micBtn.dataset.listening =
                "true";

            micBtn.setAttribute(
                "aria-label",
                "Stop voice input"
            );
        }

        if (msg) {
            msg.placeholder =
                "Listening...";
        }
    };


    recognition.onresult =
        event => {

            const result =
                event.results?.[0]?.[0];

            if (!result) return;

            const spoken =
                result.transcript
                    .trim();

            if (!spoken) return;

            /*
               Put recognized speech into
               input briefly.
            */

            if (msg) {
                msg.value =
                    spoken;
            }

            /*
               Execute immediately.
            */

            executeCommand(
                spoken,
                true
            );

            if (msg) {
                msg.value = "";
            }
        };


    recognition.onerror =
        event => {

            console.warn(
                "Speech error:",
                event.error
            );

            listening = false;

            if (
                event.error ===
                "not-allowed"
            ) {

                respond(
                    "Microphone permission is required, Boss.",
                    true
                );
            }
        };


    recognition.onend = () => {

        listening = false;

        if (micBtn) {

            micBtn.dataset.listening =
                "false";

            micBtn.setAttribute(
                "aria-label",
                "Activate voice input"
            );
        }

        if (msg) {
            msg.placeholder =
                "Enter a command for J.A.R.V.I.S...";
        }
    };
}


/* =========================
   MIC BUTTON
   ========================= */

if (micBtn) {

    micBtn.addEventListener(
        "click",
        () => {

            /*
               If JARVIS is speaking,
               stop immediately.
            */

            if (speaking) {
                stopSpeaking();
            }

            if (!recognition) {

                respond(
                    "Voice recognition is not supported in this browser, Boss.",
                    true
                );

                return;
            }


            if (listening) {

                try {
                    recognition.stop();
                } catch {}

                return;
            }


            try {

                recognition.start();

            } catch {

                /*
                   Browser may still be closing
                   previous recognition session.
                */

                try {
                    recognition.stop();
                } catch {}

                setTimeout(() => {

                    try {
                        recognition.start();
                    } catch {
                        respond(
                            "I could not start the microphone, Boss.",
                            true
                        );
                    }

                }, 80);
            }
        }
    );
}


/* =========================
   CLEAR BUTTON
   ========================= */

if (clearBtn) {

    clearBtn.addEventListener(
        "click",
        () => {

            stopSpeaking();

            clearMemory();
        }
    );
}


/* =========================
   GLOBAL HELPERS
   ========================= */

window.JARVIS = {

    speak,
    stopSpeaking,
    executeCommand,
    clearMemory,
    getWeather,
    generatePassword
};


/* =========================
   READY MESSAGE
   ========================= */

console.log(
    "J.A.R.V.I.S. ONLINE — FAST VOICE MODE READY"
);
