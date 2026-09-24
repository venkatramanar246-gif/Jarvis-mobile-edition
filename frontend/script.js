 /* =========================================================
   J.A.R.V.I.S — COMPLETE SCRIPT.JS
   Compatible with the uploaded HTML
   ========================================================= */

"use strict";

/* =========================
   ELEMENTS
========================= */

const chat = document.getElementById("chat");
const msg = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");
const camBtn = document.getElementById("cam-btn");
const clearBtn = document.getElementById("clear-btn");
const imgInput = document.getElementById("img-input");

let recognition = null;
let selectedImage = null;
let memory = [];

/* =========================
   SAFE STORAGE
========================= */

function loadMemory() {
    try {
        const saved = localStorage.getItem("jarvis_memory");
        memory = saved ? JSON.parse(saved) : [];
    } catch (error) {
        memory = [];
    }
}

function saveMemory() {
    try {
        localStorage.setItem("jarvis_memory", JSON.stringify(memory));
    } catch (error) {
        console.warn("Memory storage unavailable.");
    }
}

/* =========================
   CHAT UI
========================= */

function addMessage(text, type = "jarvis") {
    if (!chat) return;

    const div = document.createElement("div");
    div.className = type === "user" ? "user-message" : "jarvis-message";

    div.textContent = text;
    chat.appendChild(div);

    chat.scrollTop = chat.scrollHeight;

    return div;
}

function rememberMessage(text, type) {
    memory.push({
        text: String(text),
        type: type,
        time: new Date().toISOString()
    });

    if (memory.length > 100) {
        memory = memory.slice(-100);
    }

    saveMemory();
}

/* =========================
   SPEECH
========================= */

function speak(text) {
    try {
        if (!("speechSynthesis" in window)) return;

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(String(text));

        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        window.speechSynthesis.speak(utterance);
    } catch (error) {
        console.warn("Speech error:", error);
    }
}

/* =========================
   RESPONSE
========================= */

function reply(text, speakIt = true) {
    addMessage(text, "jarvis");
    rememberMessage(text, "jarvis");

    if (speakIt) {
        speak(text);
    }

    return text;
}

/* =========================
   TIME
========================= */

function getTime() {
    return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

/* =========================
   DATE
========================= */

function getDate() {
    return new Date().toLocaleDateString([], {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

/* =========================
   WEATHER
========================= */

async function getWeather() {
    if (!navigator.geolocation) {
        return "Geolocation is not supported on this device.";
    }

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;

                    const url =
                        "https://api.open-meteo.com/v1/forecast" +
                        "?latitude=" + encodeURIComponent(lat) +
                        "&longitude=" + encodeURIComponent(lon) +
                        "&current=temperature_2m,weather_code,wind_speed_10m";

                    const response = await fetch(url);

                    if (!response.ok) {
                        throw new Error("Weather request failed");
                    }

                    const data = await response.json();

                    const temperature =
                        data?.current?.temperature_2m;

                    const wind =
                        data?.current?.wind_speed_10m;

                    return resolve(
                        `Current temperature is ${temperature}°C. Wind speed is ${wind} km/h.`
                    );

                } catch (error) {
                    resolve(
                        "Sorry Boss, I could not get the weather right now."
                    );
                }
            },
            () => {
                resolve(
                    "Location permission was denied. Please allow location access for weather."
                );
            },
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    });
}

/* =========================
   TIMER
========================= */

function startTimer(amount, unit) {
    amount = Number(amount);

    if (!Number.isFinite(amount) || amount <= 0) {
        return "Please provide a valid timer duration.";
    }

    unit = unit.toLowerCase();

    let multiplier = 1000;

    if (
        unit.startsWith("minute") ||
        unit.startsWith("min")
    ) {
        multiplier = 60 * 1000;
    }

    if (
        unit.startsWith("hour") ||
        unit.startsWith("hr")
    ) {
        multiplier = 60 * 60 * 1000;
    }

    const duration = amount * multiplier;

    setTimeout(() => {
        reply(`Boss, your ${amount} ${unit} timer is finished.`);
    }, duration);

    return `Timer set for ${amount} ${unit}.`;
}

/* =========================
   DICE
========================= */

function rollDice() {
    const result = Math.floor(Math.random() * 6) + 1;
    return `🎲 Dice result: ${result}`;
}

/* =========================
   COIN
========================= */

function tossCoin() {
    const result = Math.random() < 0.5 ? "Heads" : "Tails";
    return `🪙 Coin result: ${result}`;
}

/* =========================
   JOKE
========================= */

function getJoke() {
    const jokes = [
        "Why did the computer go to the doctor? Because it had a virus.",
        "Why was the JavaScript developer calm? Because they knew how to handle exceptions.",
        "Why did the computer get cold? Because it left its Windows open.",
        "What do computers eat? Microchips."
    ];

    return jokes[Math.floor(Math.random() * jokes.length)];
}

/* =========================
   QUOTE
========================= */

function getQuote() {
    const quotes = [
        "Keep learning and keep moving forward.",
        "Small progress is still progress.",
        "Great things are built one step at a time.",
        "Believe in your ability to learn."
    ];

    return quotes[Math.floor(Math.random() * quotes.length)];
}

/* =========================
   TRANSLATE
========================= */

async function translateText(text) {
    const cleaned = text
        .replace(/^translate\s*(this)?/i, "")
        .trim();

    if (!cleaned) {
        return "Please provide text to translate.";
    }

    try {
        const url =
            "https://api.mymemory.translated.net/get?q=" +
            encodeURIComponent(cleaned) +
            "&langpair=en|te";

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Translation failed");
        }

        const data = await response.json();

        return (
            "In Telugu: " +
            (data?.responseData?.translatedText || "Translation unavailable.")
        );

    } catch (error) {
        return "Translation service is unavailable right now.";
    }
}

/* =========================
   YOUTUBE SEARCH
========================= */

function youtubeSearch(query) {
    query = query
        .replace(/^play\s*/i, "")
        .replace(/^youtube\s*/i, "")
        .trim();

    if (!query) {
        return "Please tell me what you want to search on YouTube.";
    }

    const url =
        "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(query);

    try {
        window.open(url, "_blank");
    } catch (error) {
        location.href = url;
    }

    return `Searching YouTube for ${query}.`;
}

/* =========================
   WEB SEARCH
========================= */

function webSearch(query) {
    query = query
        .replace(/^search\s*/i, "")
        .trim();

    if (!query) {
        return "Please provide something to search for.";
    }

    const url =
        "https://www.google.com/search?q=" +
        encodeURIComponent(query);

    try {
        window.open(url, "_blank");
    } catch (error) {
        location.href = url;
    }

    return `Searching the web for ${query}.`;
}

/* =========================
   NEWS
========================= */

function openNews() {
    const url =
        "https://news.google.com/";

    try {
        window.open(url, "_blank");
    } catch (error) {
        location.href = url;
    }

    return "Opening the latest news.";
}

/* =========================
   DICTIONARY
========================= */

async function dictionaryMeaning(word) {
    word = word
        .replace(/^meaning\s*(of)?/i, "")
        .replace(/^define\s*/i, "")
        .trim();

    if (!word) {
        return "Please provide a word.";
    }

    try {
        const response = await fetch(
            "https://api.dictionaryapi.dev/api/v2/entries/en/" +
            encodeURIComponent(word)
        );

        if (!response.ok) {
            throw new Error("Word not found");
        }

        const data = await response.json();

        const definition =
            data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;

        if (!definition) {
            return `I could not find a definition for ${word}.`;
        }

        return `${word}: ${definition}`;

    } catch (error) {
        return `I could not find a dictionary meaning for ${word}.`;
    }
}

/* =========================
   PASSWORD GENERATOR
========================= */

function generatePassword(length = 12) {
    length = Number(length);

    if (!Number.isFinite(length) || length < 6) {
        length = 12;
    }

    if (length > 64) {
        length = 64;
    }

    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "abcdefghijklmnopqrstuvwxyz" +
        "0123456789" +
        "!@#$%^&*()_+-=";

    let password = "";

    if (window.crypto && crypto.getRandomValues) {
        const values = new Uint32Array(length);
        crypto.getRandomValues(values);

        for (let i = 0; i < length; i++) {
            password += chars[values[i] % chars.length];
        }
    } else {
        for (let i = 0; i < length; i++) {
            password += chars[
                Math.floor(Math.random() * chars.length)
            ];
        }
    }

    return `Generated password: ${password}`;
}

/* =========================
   CURRENCY
========================= */

async function currencyConvert(text) {
    const match = text.match(
        /(\d+(?:\.\d+)?)\s*([A-Za-z]{3})\s*(?:to|in)\s*([A-Za-z]{3})/i
    );

    if (!match) {
        return "Example: 100 USD to INR";
    }

    const amount = Number(match[1]);
    const from = match[2].toUpperCase();
    const to = match[3].toUpperCase();

    try {
        const url =
            `https://api.frankfurter.app/latest?amount=${amount}` +
            `&from=${from}&to=${to}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Currency request failed");
        }

        const data = await response.json();

        const result = data?.rates?.[to];

        if (result === undefined) {
            throw new Error("Currency unavailable");
        }

        return `${amount} ${from} = ${result} ${to}`;

    } catch (error) {
        return "Currency conversion is unavailable right now.";
    }
}

/* =========================
   CRYPTO
========================= */

async function cryptoInfo(text) {
    const lower = text.toLowerCase();

    let coin = "bitcoin";

    if (lower.includes("ethereum") || lower.includes("eth")) {
        coin = "ethereum";
    } else if (
        lower.includes("dogecoin") ||
        lower.includes("doge")
    ) {
        coin = "dogecoin";
    } else if (
        lower.includes("solana") ||
        lower.includes("sol")
    ) {
        coin = "solana";
    }

    try {
        const url =
            "https://api.coingecko.com/api/v3/simple/price" +
            `?ids=${coin}&vs_currencies=usd`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Crypto request failed");
        }

        const data = await response.json();

        const price = data?.[coin]?.usd;

        if (price === undefined) {
            throw new Error("Price unavailable");
        }

        return `${coin} current price: $${price} USD.`;

    } catch (error) {
        return "Crypto information is unavailable right now.";
    }
}

/* =========================
   OPEN APPS
========================= */

function openApp(text) {
    const lower = text.toLowerCase();

    const appLinks = {
        youtube: "https://www.youtube.com/",
        google: "https://www.google.com/",
        gmail: "https://mail.google.com/",
        maps: "https://maps.google.com/",
        whatsapp: "https://web.whatsapp.com/",
        instagram: "https://www.instagram.com/",
        facebook: "https://www.facebook.com/"
    };

    let app = null;

    for (const name of Object.keys(appLinks)) {
        if (lower.includes(name)) {
            app = name;
            break;
        }
    }

    if (!app) {
        return "Tell me which supported app you want to open.";
    }

    try {
        window.open(appLinks[app], "_blank");
    } catch (error) {
        location.href = appLinks[app];
    }

    return `Opening ${app}.`;
}

/* =========================
   CAMERA
========================= */

async function activateCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
        return "Camera access is not supported by this browser.";
    }

    try {
        const stream =
            await navigator.mediaDevices.getUserMedia({
                video: true
            });

        stream.getTracks().forEach(track => track.stop());

        return "Camera permission is available. Image analysis can be performed after an image is selected.";
    } catch (error) {
        return "Camera permission was denied or the camera is unavailable.";
    }
}

/* =========================
   IMAGE PREVIEW
========================= */

function handleImage(file) {
    if (!file || !file.type.startsWith("image/")) {
        return;
    }

    selectedImage = file;

    const reader = new FileReader();

    reader.onload = function () {
        const oldPreview =
            document.getElementById("jarvis-image-preview");

        if (oldPreview) {
            oldPreview.remove();
        }

        const preview = document.createElement("img");

        preview.id = "jarvis-image-preview";
        preview.src = reader.result;
        preview.alt = "Selected image";

        preview.style.maxWidth = "100%";
        preview.style.maxHeight = "240px";
        preview.style.display = "block";
        preview.style.margin = "10px auto";
        preview.style.borderRadius = "12px";

        if (chat) {
            chat.appendChild(preview);
            chat.scrollTop = chat.scrollHeight;
        }

        addMessage(
            "Image selected successfully. The image preview is ready.",
            "jarvis"
        );
    };

    reader.readAsDataURL(file);
}

/* =========================
   TOOL HANDLER
========================= */

async function handleTools(text) {
    const t = text.toLowerCase().trim();

    /* TIME */

    if (
        /\btime\b/.test(t) ||
        t.includes("what time") ||
        t.includes("సమయం") ||
        t.includes("టైమ్")
    ) {
        return `The time is ${getTime()}, Boss.`;
    }

    /* DATE */

    if (
        t.includes("date") ||
        t.includes("today") ||
        t.includes("తేదీ")
    ) {
        return `Today is ${getDate()}.`;
    }

    /* WEATHER */

    if (
        t.includes("weather") ||
        t.includes("temperature") ||
        t.includes("వాతావరణం") ||
        t.includes("టెంపరేచర్")
    ) {
        return await getWeather();
    }

    /* TIMER */

    const timerMatch = t.match(
        /(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/
    );

    if (
        (t.includes("timer") || t.includes("టైమర్")) &&
        timerMatch
    ) {
        return startTimer(
            timerMatch[1],
            timerMatch[2]
        );
    }

    /* DICE */

    if (
        t.includes("dice") ||
        t.includes("roll dice")
    ) {
        return rollDice();
    }

    /* COIN */

    if (
        t.includes("coin") ||
        t.includes("toss coin")
    ) {
        return tossCoin();
    }

    /* JOKE */

    if (
        t.includes("joke") ||
        t.includes("జోక్")
    ) {
        return getJoke();
    }

    /* QUOTE */

    if (
        t.includes("quote") ||
        t.includes("motivation") ||
        t.includes("మోటివేషన్")
    ) {
        return getQuote();
    }

    /* TRANSLATE */

    if (
        t.startsWith("translate") ||
        t.includes("translate this") ||
        t.includes("అనువదించు")
    ) {
        return await translateText(text);
    }

    /* CURRENCY */

    if (
        t.includes("currency") ||
        /\b[a-z]{3}\s+to\s+[a-z]{3}\b/i.test(t)
    ) {
        return await currencyConvert(text);
    }

    /* DICTIONARY */

    if (
        t.startsWith("meaning") ||
        t.startsWith("define") ||
        t.includes("dictionary") ||
        t.includes("meaning of")
    ) {
        return await dictionaryMeaning(text);
    }

    /* PASSWORD */

    if (
        t.includes("password") ||
        t.includes("generate password")
    ) {
        const lengthMatch = t.match(/\d+/);

        return generatePassword(
            lengthMatch ? lengthMatch[0] : 12
        );
    }

    /* NEWS */

    if (
        t.includes("news") ||
        t.includes("headlines") ||
        t.includes("latest news")
    ) {
        return openNews();
    }

    /* YOUTUBE */

    if (
        t.includes("youtube") ||
        t.startsWith("play ")
    ) {
        return youtubeSearch(text);
    }

    /* SEARCH */

    if (
        t.startsWith("search ") ||
        t.includes("search for ")
    ) {
        return webSearch(text);
    }

    /* OPEN APP */

    if (
        t.includes("open app") ||
        t.includes("open youtube") ||
        t.includes("open google") ||
        t.includes("open gmail") ||
        t.includes("open maps") ||
        t.includes("open whatsapp") ||
        t.includes("open instagram") ||
        t.includes("open facebook")
    ) {
        return openApp(text);
    }

    /* CRYPTO */

    if (
        t.includes("crypto") ||
        t.includes("bitcoin") ||
        t.includes("ethereum") ||
        t.includes("dogecoin") ||
        t.includes("solana")
    ) {
        return await cryptoInfo(text);
    }

    return null;
}

/* =========================
   BASIC JARVIS BRAIN
========================= */

async function processCommand(text) {
    const cleanText = text.trim();

    if (!cleanText) {
        return "Please enter a command, Boss.";
    }

    const toolResult = await handleTools(cleanText);

    if (toolResult !== null) {
        return toolResult;
    }

    const lower = cleanText.toLowerCase();

    if (
        lower.includes("hello") ||
        lower.includes("hi") ||
        lower.includes("hey")
    ) {
        return "Hello Boss. JARVIS is online and ready.";
    }

    if (
        lower.includes("who are you") ||
        lower.includes("what are you")
    ) {
        return "I am JARVIS, your personal AI assistant.";
    }

    if (
        lower.includes("thank")
    ) {
        return "You're welcome, Boss.";
    }

    if (
        lower.includes("help")
    ) {
        return (
            "Available tools include time, weather, timer, dice, coin, " +
            "joke, quote, news, translate, currency, dictionary, " +
            "password generator, search, apps, YouTube and crypto."
        );
    }

    return (
        "I received your command: " +
        cleanText +
        ". Connect an AI API to enable full AI conversation."
    );
}

/* =========================
   SEND COMMAND
========================= */

async function executeCommand() {
    if (!msg) return;

    const text = msg.value.trim();

    if (!text) {
        reply("Please enter a command, Boss.");
        return;
    }

    addMessage(text, "user");
    rememberMessage(text, "user");

    msg.value = "";

    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = "PROCESSING...";
    }

    try {
        const result = await processCommand(text);

        reply(result);
    } catch (error) {
        console.error("Command error:", error);

        reply(
            "Sorry Boss, something went wrong while processing that command."
        );
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = "EXECUTE";
        }

        if (msg) {
            msg.focus();
        }
    }
}

/* =========================
   MICROPHONE
========================= */

function setupSpeechRecognition() {
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        return null;
    }

    const rec = new SpeechRecognition();

    rec.lang = "en-IN";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = function () {
        if (micBtn) {
            micBtn.textContent = "🎙️";
            micBtn.disabled = true;
        }
    };

    rec.onresult = function (event) {
        const transcript =
            event.results?.[0]?.[0]?.transcript || "";

        if (msg) {
            msg.value = transcript;
        }

        if (transcript) {
            executeCommand();
        }
    };

    rec.onerror = function (event) {
        console.warn("Speech recognition:", event.error);

        if (event.error === "not-allowed") {
            reply(
                "Microphone permission was denied. Please allow microphone access."
            );
        } else if (event.error === "no-speech") {
            reply("I did not hear anything, Boss.");
        } else {
            reply("Voice input is currently unavailable.");
        }
    };

    rec.onend = function () {
        if (micBtn) {
            micBtn.textContent = "🎤";
            micBtn.disabled = false;
        }
    };

    return rec;
}

/* =========================
   CLEAR MEMORY
========================= */

function clearMemory() {
    memory = [];

    try {
        localStorage.removeItem("jarvis_memory");
    } catch (error) {
        console.warn("Could not clear storage.");
    }

    if (chat) {
        chat.innerHTML = "";
    }

    if (selectedImage) {
        selectedImage = null;
    }

    const preview =
        document.getElementById("jarvis-image-preview");

    if (preview) {
        preview.remove();
    }

    reply("Memory cleared, Boss.", false);
}

/* =========================
   EVENT LISTENERS
========================= */

if (sendBtn) {
    sendBtn.addEventListener("click", executeCommand);
}

if (msg) {
    msg.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            executeCommand();
        }
    });
}

if (micBtn) {
    micBtn.addEventListener("click", function () {
        if (!recognition) {
            recognition = setupSpeechRecognition();
        }

        if (!recognition) {
            reply(
                "Voice recognition is not supported by this browser."
            );
            return;
        }

        try {
            recognition.start();
        } catch (error) {
            console.warn("Recognition start error:", error);
        }
    });
}

if (camBtn) {
    camBtn.addEventListener("click", async function () {
        const result = await activateCamera();
        reply(result);
    });
}

if (clearBtn) {
    clearBtn.addEventListener("click", clearMemory);
}

if (imgInput) {
    imgInput.addEventListener("change", function () {
        const file = this.files?.[0];

        if (file) {
            handleImage(file);
        }
    });
}

/* =========================
   INITIALIZATION
========================= */

loadMemory();

if (chat && memory.length > 0) {
    /*
       Restore only recent messages.
       Existing HTML layout is untouched.
    */

    memory.slice(-20).forEach(item => {
        addMessage(item.text, item.type);
    });
}

console.log("J.A.R.V.I.S initialized successfully.");
