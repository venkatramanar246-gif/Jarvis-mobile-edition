/* =========================================================
   J.A.R.V.I.S. — AI AGENT SCRIPT
   Works with the supplied index.html
   ========================================================= */

"use strict";

/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const msg = document.getElementById("msg");
const send = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");
const camBtn = document.getElementById("cam-btn");
const clearBtn = document.getElementById("clear-btn");
const imgInput = document.getElementById("img-input");
const chat = document.getElementById("chat");
const coreText = document.querySelector(".core-text");

let recognition = null;
let listening = false;
let timerHandle = null;
let timerEnd = null;

/* =========================================================
   CONFIG
   ========================================================= */

const MEMORY_KEY = "jarvis_memory_v1";
const SETTINGS_KEY = "jarvis_settings_v1";

const settings = loadJSON(SETTINGS_KEY, {
    speak: true,
    autoMemory: true
});

/* =========================================================
   STARTUP
   ========================================================= */

document.addEventListener("DOMContentLoaded", initJarvis);

function initJarvis() {
    updateLiveTime();
    setInterval(updateLiveTime, 1000);

    restoreChat();

    if (chat && chat.children.length === 0) {
        addMessage(
            "J.A.R.V.I.S.",
            "System online. AI Agent ready. Give me a command."
        );
    }

    setupVoiceRecognition();
    setupEvents();

    setTimeout(() => {
        updateStatus("ONLINE");
    }, 300);
}

/* =========================================================
   EVENTS
   ========================================================= */

function setupEvents() {

    if (send) {
        send.addEventListener("click", () => {
            executeInput();
        });
    }

    if (msg) {
        msg.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                executeInput();
            }
        });
    }

    if (micBtn) {
        micBtn.addEventListener("click", toggleVoiceInput);
    }

    if (camBtn) {
        camBtn.addEventListener("click", () => {
            if (imgInput) {
                imgInput.click();
            }
        });
    }

    if (imgInput) {
        imgInput.addEventListener("change", handleImage);
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", clearMemory);
    }
}

/* =========================================================
   LIVE TIME
   ========================================================= */

function updateLiveTime() {

    if (!coreText) return;

    const now = new Date();

    const time = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    const date = now.toLocaleDateString([], {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric"
    });

    coreText.textContent = `${date} • ${time}`;
}

/* =========================================================
   STATUS
   ========================================================= */

function updateStatus(text) {

    const statusRows = document.querySelectorAll(".status .row b");

    if (!statusRows.length) return;

    if (statusRows[0]) {
        statusRows[0].textContent = "● OPERATIONAL";
    }

    if (statusRows[1]) {
        statusRows[1].textContent = "● ONLINE";
    }

    if (statusRows[2]) {
        statusRows[2].textContent =
            listening ? "● LISTENING" : "● READY";
    }

    if (statusRows[3]) {
        statusRows[3].textContent = "● ACTIVE";
    }
}

/* =========================================================
   MAIN AI AGENT
   ========================================================= */

async function executeInput() {

    if (!msg) return;

    const input = msg.value.trim();

    if (!input) return;

    msg.value = "";

    addMessage("YOU", input);

    showThinking();

    try {

        const result = await agent(input);

        hideThinking();

        if (result) {
            addMessage("J.A.R.V.I.S.", result);

            if (settings.autoMemory) {
                saveMemory(input, result);
            }

            speak(result);
        }

    } catch (error) {

        console.error("JARVIS ERROR:", error);

        hideThinking();

        const errorMessage =
            "I encountered an error while executing that command.";

        addMessage("J.A.R.V.I.S.", errorMessage);
        speak(errorMessage);
    }
}

/* =========================================================
   AI AGENT CORE
   ========================================================= */

async function agent(input) {

    const text = normalize(input);

    /*
       Goal → Plan → Execute
    */

    if (isGreeting(text)) {
        return random([
            "Hello. J.A.R.V.I.S. is online.",
            "Hello. All systems are operational.",
            "Welcome back. How can I assist you?"
        ]);
    }

    if (
        text.includes("what can you do") ||
        text.includes("features") ||
        text.includes("help")
    ) {
        return `
Available systems:

• Time
• Weather
• Timer
• Dice / Coin
• Jokes
• Quotes
• News search
• Translation
• Currency conversion
• Word meaning
• Password generation
• Web search
• App opening
• Song search
• Crypto prices
• Voice input
• Text-to-speech
• Image analysis
• Memory
• AI Agent command routing

Try: "weather in London", "set timer for 10 seconds",
"translate hello to Telugu", "generate password",
"bitcoin price", or "search latest JavaScript news".
        `.trim();
    }

    /* TIME */

    if (isTimeCommand(text)) {
        return getTimeResponse();
    }

    /* DATE */

    if (
        text.includes("date today") ||
        text === "date" ||
        text.includes("today's date") ||
        text.includes("todays date")
    ) {
        return getDateResponse();
    }

    /* WEATHER */

    if (
        text.includes("weather") ||
        text.includes("temperature") ||
        text.includes("forecast")
    ) {
        return await weatherAgent(input);
    }

    /* TIMER */

    if (
        text.includes("timer") ||
        text.includes("countdown")
    ) {
        return timerAgent(input);
    }

    /* DICE */

    if (
        text.includes("roll dice") ||
        text.includes("roll a dice") ||
        text === "dice"
    ) {
        const number = Math.floor(Math.random() * 6) + 1;

        return `🎲 Dice rolled: ${number}`;
    }

    /* COIN */

    if (
        text.includes("flip coin") ||
        text.includes("coin toss") ||
        text === "coin"
    ) {
        const result =
            Math.random() < 0.5 ? "HEADS" : "TAILS";

        return `🪙 Coin result: ${result}`;
    }

    /* JOKE */

    if (
        text.includes("joke") ||
        text.includes("make me laugh")
    ) {
        return await jokeAgent();
    }

    /* QUOTE */

    if (
        text.includes("quote") ||
        text.includes("motivation") ||
        text.includes("motivational")
    ) {
        return await quoteAgent();
    }

    /* NEWS */

    if (
        text.includes("news") ||
        text.includes("latest news")
    ) {
        return newsAgent(input);
    }

    /* TRANSLATION */

    if (
        text.includes("translate") ||
        text.includes("translation")
    ) {
        return await translationAgent(input);
    }

    /* CURRENCY */

    if (
        text.includes("currency") ||
        text.includes("convert") ||
        text.includes("exchange rate")
    ) {
        return await currencyAgent(input);
    }

    /* MEANING */

    if (
        text.includes("meaning of") ||
        text.startsWith("define ") ||
        text.startsWith("definition of ")
    ) {
        return await meaningAgent(input);
    }

    /* PASSWORD */

    if (
        text.includes("generate password") ||
        text.includes("create password") ||
        text.includes("strong password") ||
        text.includes("random password")
    ) {
        return generatePasswordResponse(input);
    }

    /* SEARCH */

    if (
        text.startsWith("search ") ||
        text.includes("search for ") ||
        text.includes("google ")
    ) {
        return searchAgent(input);
    }

    /* OPEN APPS */

    if (
        text.startsWith("open ") ||
        text.includes("launch ")
    ) {
        return openAppAgent(input);
    }

    /* SONG */

    if (
        text.includes("play song") ||
        text.includes("play music") ||
        text.includes("play ") ||
        text.includes("song")
    ) {
        return songAgent(input);
    }

    /* CRYPTO */

    if (
        text.includes("bitcoin") ||
        text.includes("crypto") ||
        text.includes("ethereum") ||
        text.includes("btc") ||
        text.includes("eth")
    ) {
        return await cryptoAgent(input);
    }

    /* VOICE */

    if (
        text.includes("voice input") ||
        text.includes("start listening")
    ) {
        startVoiceInput();
        return "🎤 Voice interface activated. I'm listening.";
    }

    /* SPEAK */

    if (
        text.includes("stop speaking") ||
        text.includes("mute voice")
    ) {
        window.speechSynthesis.cancel();
        return "Voice output stopped.";
    }

    if (
        text.includes("enable voice") ||
        text.includes("enable speech")
    ) {
        settings.speak = true;
        saveJSON(SETTINGS_KEY, settings);

        return "Voice output enabled.";
    }

    /* MEMORY */

    if (
        text.includes("remember ")
    ) {
        const memoryText = input
            .replace(/remember/i, "")
            .trim();

        if (memoryText) {
            saveUserMemory(memoryText);

            return `Memory saved: "${memoryText}"`;
        }
    }

    if (
        text.includes("what do you remember") ||
        text.includes("show memory") ||
        text.includes("my memory")
    ) {
        return getMemoryResponse();
    }

    if (
        text.includes("clear memory") ||
        text.includes("forget everything") ||
        text.includes("delete memory")
    ) {
        clearMemory();

        return "Memory cleared.";
    }

    /* STOP TIMER */

    if (
        text.includes("stop timer") ||
        text.includes("cancel timer")
    ) {
        return stopTimer();
    }

    /* CALCULATOR */

    if (
        text.startsWith("calculate ") ||
        text.startsWith("calc ")
    ) {
        return calculatorAgent(input);
    }

    /* FALLBACK */

    return fallbackAgent(input);
}

/* =========================================================
   TIME
   ========================================================= */

function isTimeCommand(text) {

    return (
        text === "time" ||
        text.includes("what time") ||
        text.includes("current time") ||
        text.includes("tell me the time") ||
        text.includes("live time")
    );
}

function getTimeResponse() {

    const now = new Date();

    const time = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    const zone =
        Intl.DateTimeFormat().resolvedOptions().timeZone;

    return `⏰ Current local time: ${time}\n🌍 Time zone: ${zone}`;
}

function getDateResponse() {

    const now = new Date();

    return `📅 Today is ${now.toLocaleDateString([], {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    })}`;
}

/* =========================================================
   TIMER
   ========================================================= */

function timerAgent(input) {

    const text = normalize(input);

    if (
        text.includes("stop timer") ||
        text.includes("cancel timer")
    ) {
        return stopTimer();
    }

    let seconds = null;

    const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs)/);
    const minuteMatch = text.match(/(\d+(?:\.\d+)?)\s*(minute|minutes|min|mins)/);
    const secondMatch = text.match(/(\d+(?:\.\d+)?)\s*(second|seconds|sec|secs)/);

    if (hourMatch) {
        seconds = Number(hourMatch[1]) * 3600;
    } else if (minuteMatch) {
        seconds = Number(minuteMatch[1]) * 60;
    } else if (secondMatch) {
        seconds = Number(secondMatch[1]);
    }

    if (seconds === null) {
        return "Please specify the timer duration. Example: set timer for 30 seconds.";
    }

    seconds = Math.max(1, Math.round(seconds));

    if (timerHandle) {
        clearTimeout(timerHandle);
    }

    timerEnd = Date.now() + seconds * 1000;

    timerHandle = setTimeout(() => {

        timerHandle = null;
        timerEnd = null;

        addMessage(
            "J.A.R.V.I.S.",
            "⏰ Timer finished."
        );

        speak("Timer finished.");

        if ("Notification" in window &&
            Notification.permission === "granted") {

            new Notification("J.A.R.V.I.S.", {
                body: "Timer finished."
            });
        }

    }, seconds * 1000);

    if (
        "Notification" in window &&
        Notification.permission === "default"
    ) {
        Notification.requestPermission().catch(() => {});
    }

    return `⏱️ Timer started for ${formatDuration(seconds)}.`;
}

function stopTimer() {

    if (!timerHandle) {
        return "No active timer.";
    }

    clearTimeout(timerHandle);

    timerHandle = null;
    timerEnd = null;

    return "⏹️ Timer stopped.";
}

function formatDuration(seconds) {

    if (seconds < 60) {
        return `${seconds} second${seconds === 1 ? "" : "s"}`;
    }

    if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remaining = seconds % 60;

        return `${minutes}m ${remaining}s`;
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${hours}h ${minutes}m`;
}

/* =========================================================
   WEATHER
   ========================================================= */

async function weatherAgent(input) {

    let city = extractWeatherCity(input);

    if (!city) {
        return "🌦️ Please specify a city. Example: weather in Tirupati.";
    }

    try {

        const geoURL =
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

        const geoResponse = await fetch(geoURL);

        if (!geoResponse.ok) {
            throw new Error("Geocoding failed");
        }

        const geoData = await geoResponse.json();

        if (!geoData.results || !geoData.results.length) {
            return `I couldn't find the location "${city}".`;
        }

        const place = geoData.results[0];

        const weatherURL =
            `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`;

        const weatherResponse = await fetch(weatherURL);

        if (!weatherResponse.ok) {
            throw new Error("Weather request failed");
        }

        const data = await weatherResponse.json();

        const current = data.current;

        return `
🌦️ WEATHER REPORT

📍 ${place.name}, ${place.country || ""}

🌡️ Temperature: ${current.temperature_2m}°C
🤒 Feels like: ${current.apparent_temperature}°C
💧 Humidity: ${current.relative_humidity_2m}%
💨 Wind: ${current.wind_speed_10m} km/h
☁️ Condition: ${weatherCode(current.weather_code)}
        `.trim();

    } catch (error) {

        console.error(error);

        return "Weather service is temporarily unavailable.";
    }
}

function extractWeatherCity(input) {

    const match = input.match(
        /(?:weather|temperature|forecast)(?:\s+(?:in|at|for))?\s+(.+)$/i
    );

    if (!match) return null;

    return match[1]
        .replace(/[?.!]+$/, "")
        .trim();
}

function weatherCode(code) {

    const codes = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        80: "Rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        95: "Thunderstorm",
        96: "Thunderstorm with hail",
        99: "Thunderstorm with heavy hail"
    };

    return codes[code] || "Unknown";
}

/* =========================================================
   JOKE
   ========================================================= */

async function jokeAgent() {

    try {

        const response = await fetch(
            "https://official-joke-api.appspot.com/random_joke"
        );

        if (!response.ok) {
            throw new Error("Joke API failed");
        }

        const data = await response.json();

        return `😂 ${data.setup}\n\n${data.punchline}`;

    } catch {

        return random([
            "😂 Why did the programmer quit his job? Because he didn't get arrays.",
            "😂 There are 10 types of people: those who understand binary and those who don't.",
            "😂 A programmer's favorite place? The foo bar."
        ]);
    }
}

/* =========================================================
   QUOTE
   ========================================================= */

async function quoteAgent() {

    try {

        const response = await fetch(
            "https://dummyjson.com/quotes/random"
        );

        if (!response.ok) {
            throw new Error("Quote API failed");
        }

        const data = await response.json();

        return `💡 "${data.quote}"\n— ${data.author}`;

    } catch {

        return random([
            "💡 The secret of getting ahead is getting started.",
            "💡 Success is the sum of small efforts repeated consistently.",
            "💡 Great things are built one step at a time."
        ]);
    }
}

/* =========================================================
   NEWS / WEB SEARCH
   ========================================================= */

function newsAgent(input) {

    const query = input
        .replace(/latest/gi, "")
        .replace(/news/gi, "")
        .trim();

    const searchQuery =
        query || "latest news";

    const url =
        `https://www.google.com/search?tbm=nws&q=${encodeURIComponent(searchQuery)}`;

    window.open(url, "_blank", "noopener,noreferrer");

    return `📰 Opening latest news search for "${searchQuery}".`;
}

function searchAgent(input) {

    let query = input
        .replace(/^search\s+/i, "")
        .replace(/^search for\s+/i, "")
        .replace(/^google\s+/i, "")
        .trim();

    if (!query) {
        return "Please tell me what you want to search for.";
    }

    const url =
        `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    window.open(url, "_blank", "noopener,noreferrer");

    return `🔎 Searching the web for "${query}".`;
}

/* =========================================================
   TRANSLATION
   ========================================================= */

async function translationAgent(input) {

    /*
      Examples:
      translate hello to Telugu
      translate good morning to Hindi
    */

    const match = input.match(
        /translate\s+(.+?)\s+(?:to|into)\s+([a-zA-Z]+)$/i
    );

    if (!match) {
        return "Example: translate hello to Telugu";
    }

    const sourceText = match[1].trim();
    const targetLanguage = languageCode(match[2]);

    if (!targetLanguage) {
        return `I don't have a translation code for "${match[2]}".`;
    }

    try {

        const url =
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(sourceText)}&langpair=en|${targetLanguage}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Translation failed");
        }

        const data = await response.json();

        const result =
            data?.responseData?.translatedText;

        if (!result) {
            throw new Error("No translation");
        }

        return `🌐 Translation (${match[2]}):\n${result}`;

    } catch {

        return "Translation service is temporarily unavailable.";
    }
}

function languageCode(language) {

    const map = {
        telugu: "te",
        hindi: "hi",
        tamil: "ta",
        kannada: "kn",
        malayalam: "ml",
        bengali: "bn",
        marathi: "mr",
        gujarati: "gu",
        punjabi: "pa",
        english: "en",
        spanish: "es",
        french: "fr",
        german: "de",
        italian: "it",
        japanese: "ja",
        korean: "ko",
        chinese: "zh-CN",
        arabic: "ar",
        russian: "ru"
    };

    return map[normalize(language)];
}

/* =========================================================
   CURRENCY
   ========================================================= */

async function currencyAgent(input) {

    /*
      Examples:
      convert 100 USD to INR
      50 EUR to USD
    */

    const match = input.match(
        /(\d+(?:\.\d+)?)\s*([A-Za-z]{3})\s+(?:to|in)\s+([A-Za-z]{3})/i
    );

    if (!match) {
        return "Example: convert 100 USD to INR";
    }

    const amount = Number(match[1]);
    const from = match[2].toUpperCase();
    const to = match[3].toUpperCase();

    try {

        const url =
            `https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Currency API failed");
        }

        const data = await response.json();

        const result = data?.rates?.[to];

        if (typeof result !== "number") {
            throw new Error("Currency not supported");
        }

        return `💱 ${amount} ${from} = ${result.toFixed(2)} ${to}`;

    } catch {

        return "Currency conversion is unavailable for that currency pair right now.";
    }
}

/* =========================================================
   WORD MEANING
   ========================================================= */

async function meaningAgent(input) {

    let word = input
        .replace(/meaning of/gi, "")
        .replace(/definition of/gi, "")
        .replace(/^define\s+/i, "")
        .trim();

    word = word.replace(/[?.!]+$/, "");

    if (!word) {
        return "Please give me a word. Example: meaning of algorithm.";
    }

    try {

        const url =
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Dictionary failed");
        }

        const data = await response.json();

        const entry = data[0];

        const meaning =
            entry?.meanings?.[0]?.definitions?.[0]?.definition;

        if (!meaning) {
            throw new Error("No definition");
        }

        return `📖 ${word}\n\n${meaning}`;

    } catch {

        return `I couldn't find an English dictionary definition for "${word}".`;
    }
}

/* =========================================================
   PASSWORD
   ========================================================= */

function generatePasswordResponse(input) {

    const numberMatch =
        input.match(/(\d+)\s*(?:characters|char|length)/i);

    let length = numberMatch
        ? Number(numberMatch[1])
        : 16;

    length = Math.max(8, Math.min(length, 128));

    const password = generatePassword(length);

    return `
🔐 STRONG PASSWORD

${password}

Length: ${length}
Includes uppercase, lowercase, numbers and symbols.
    `.trim();
}

function generatePassword(length = 16) {

    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()-_=+[]{}";

    const all =
        upper + lower + numbers + symbols;

    const randomChar = (chars) =>
        chars[Math.floor(Math.random() * chars.length)];

    let password =
        randomChar(upper) +
        randomChar(lower) +
        randomChar(numbers) +
        randomChar(symbols);

    while (password.length < length) {
        password += randomChar(all);
    }

    return shuffle(password);
}

function shuffle(value) {

    return value
        .split("")
        .sort(() => Math.random() - 0.5)
        .join("");
}

/* =========================================================
   CRYPTO
   ========================================================= */

async function cryptoAgent(input) {

    let coin = "bitcoin";

    const text = normalize(input);

    if (
        text.includes("ethereum") ||
        text.includes(" eth ")
    ) {
        coin = "ethereum";
    }

    if (
        text.includes("solana") ||
        text.includes(" sol ")
    ) {
        coin = "solana";
    }

    if (
        text.includes("dogecoin") ||
        text.includes(" doge")
    ) {
        coin = "dogecoin";
    }

    try {

        const url =
            `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd,inr&include_24hr_change=true`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Crypto API failed");
        }

        const data = await response.json();

        const coinData = data[coin];

        if (!coinData) {
            throw new Error("Coin not found");
        }

        const usd = coinData.usd;
        const inr = coinData.inr;
        const change = coinData.usd_24h_change;

        return `
₿ CRYPTO

${capitalize(coin)}

USD: $${formatNumber(usd)}
INR: ₹${formatNumber(inr)}
24h: ${change >= 0 ? "+" : ""}${change.toFixed(2)}%
        `.trim();

    } catch {

        return "Crypto price service is temporarily unavailable.";
    }
}

/* =========================================================
   SONG / MUSIC
   ========================================================= */

function songAgent(input) {

    let query = input
        .replace(/play song/gi, "")
        .replace(/play music/gi, "")
        .replace(/play/gi, "")
        .trim();

    if (!query || query === "song" || query === "music") {
        query = "popular music";
    }

    const url =
        `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

    window.open(url, "_blank", "noopener,noreferrer");

    return `🎵 Opening YouTube music search for "${query}".`;
}

/* =========================================================
   OPEN APPS / WEBSITES
   ========================================================= */

function openAppAgent(input) {

    const target = input
        .replace(/^open\s+/i, "")
        .replace(/^launch\s+/i, "")
        .trim();

    if (!target) {
        return "Tell me what you want to open.";
    }

    const sites = {
        youtube: "https://www.youtube.com",
        google: "https://www.google.com",
        gmail: "https://mail.google.com",
        whatsapp: "https://web.whatsapp.com",
        instagram: "https://www.instagram.com",
        facebook: "https://www.facebook.com",
        github: "https://github.com",
        chatgpt: "https://chatgpt.com",
        maps: "https://maps.google.com",
        googlemaps: "https://maps.google.com"
    };

    const key = normalize(target);

    if (sites[key]) {

        window.open(
            sites[key],
            "_blank",
            "noopener,noreferrer"
        );

        return `📱 Opening ${target}.`;
    }

    /*
      Browser security does not allow a normal webpage
      to freely launch arbitrary installed Android apps.
      Try a URL/deep link when available.
    */

    const url =
        /^https?:\/\//i.test(target)
            ? target
            : `https://www.google.com/search?q=${encodeURIComponent(target)}`;

    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );

    return `🚀 Opening/searching for "${target}".`;
}

/* =========================================================
   CALCULATOR
   ========================================================= */

function calculatorAgent(input) {

    let expression = input
        .replace(/^calculate/i, "")
        .replace(/^calc/i, "")
        .trim();

    expression = expression
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/\^/g, "**");

    /*
      Only allow calculator characters.
    */

    if (!/^[0-9+\-*/().%\s*]+$/.test(expression)) {
        return "For safety, I can only calculate numbers and basic operators.";
    }

    try {

        const result = Function(
            `"use strict"; return (${expression})`
        )();

        if (!Number.isFinite(result)) {
            return "That calculation produced an invalid result.";
        }

        return `🧮 ${expression} = ${result}`;

    } catch {

        return "I couldn't calculate that expression.";
    }
}

/* =========================================================
   VOICE INPUT
   ========================================================= */

function setupVoiceRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        if (micBtn) {
            micBtn.title =
                "Speech recognition is not supported by this browser.";
        }

        return;
    }

    recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";

    recognition.onstart = () => {

        listening = true;
        updateStatus("LISTENING");

        if (micBtn) {
            micBtn.textContent = "⏹";
        }
    };

    recognition.onresult = (event) => {

        const transcript =
            event.results[0][0].transcript;

        if (msg) {
            msg.value = transcript;
        }

        listening = false;
        updateStatus("READY");

        if (micBtn) {
            micBtn.textContent = "🎤";
        }

        executeInput();
    };

    recognition.onerror = (event) => {

        console.warn(
            "Speech recognition:",
            event.error
        );

        listening = false;
        updateStatus("READY");

        if (micBtn) {
            micBtn.textContent = "🎤";
        }
    };

    recognition.onend = () => {

        listening = false;
        updateStatus("READY");

        if (micBtn) {
            micBtn.textContent = "🎤";
        }
    };
}

function toggleVoiceInput() {

    if (!recognition) {

        addMessage(
            "J.A.R.V.I.S.",
            "Voice recognition is not supported in this browser. Try Chrome on Android."
        );

        return;
    }

    if (listening) {
        recognition.stop();
    } else {
        startVoiceInput();
    }
}

function startVoiceInput() {

    if (!recognition) {
        return;
    }

    try {
        recognition.start();
    } catch (error) {
        console.warn(error);
    }
}

/* =========================================================
   TEXT TO SPEECH
   ========================================================= */

function speak(text) {

    if (!settings.speak) return;

    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const cleanText =
        String(text)
            .replace(/[*_#`]/g, "")
            .replace(/https?:\/\/\S+/g, "")
            .slice(0, 1000);

    const utterance =
        new SpeechSynthesisUtterance(cleanText);

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    /*
      Prefer Indian English if available.
    */

    const voices =
        window.speechSynthesis.getVoices();

    const preferred =
        voices.find(v =>
            /en-IN/i.test(v.lang)
        ) ||
        voices.find(v =>
            /en/i.test(v.lang)
        );

    if (preferred) {
        utterance.voice = preferred;
    }

    window.speechSynthesis.speak(utterance);
}

/* =========================================================
   IMAGE ANALYSIS
   ========================================================= */

function handleImage(event) {

    const file =
        event.target.files &&
        event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        addMessage(
            "J.A.R.V.I.S.",
            "Please select a valid image."
        );
        return;
    }

    const reader = new FileReader();

    reader.onload = () => {

        const imageURL = reader.result;

        addImageMessage(
            "YOU",
            imageURL,
            file.name
        );

        analyzeImage(file, imageURL);
    };

    reader.readAsDataURL(file);
}

async function analyzeImage(file, imageURL) {

    showThinking();

    try {

        const dimensions =
            await getImageDimensions(imageURL);

        const sizeKB =
            (file.size / 1024).toFixed(1);

        const result = `
🖼️ IMAGE ANALYSIS

File: ${file.name}
Type: ${file.type}
Size: ${sizeKB} KB
Resolution: ${dimensions.width} × ${dimensions.height}

The image has been successfully loaded and is ready for AI image analysis.

Note: A browser-only JavaScript app cannot perform general AI vision reasoning by itself. Connect an AI vision API/backend to identify objects, text and scenes.
        `.trim();

        hideThinking();
        addMessage("J.A.R.V.I.S.", result);

        speak(
            "Image loaded successfully. It is ready for AI vision analysis."
        );

    } catch {

        hideThinking();

        addMessage(
            "J.A.R.V.I.S.",
            "I could not read the image."
        );
    }
}

function getImageDimensions(src) {

    return new Promise((resolve, reject) => {

        const image = new Image();

        image.onload = () => {
            resolve({
                width: image.naturalWidth,
                height: image.naturalHeight
            });
        };

        image.onerror = reject;

        image.src = src;
    });
}

function addImageMessage(sender, imageURL, filename) {

    if (!chat) return;

    const wrapper =
        document.createElement("div");

    wrapper.className = "message user-message";

    wrapper.innerHTML = `
        <strong>${escapeHTML(sender)}</strong>
        <div>${escapeHTML(filename)}</div>
        <img
            src="${imageURL}"
            alt="Uploaded image"
            style="
                max-width:100%;
                margin-top:8px;
                border-radius:10px;
                display:block;
            "
        >
    `;

    chat.appendChild(wrapper);

    scrollChat();
}

/* =========================================================
   MEMORY
   ========================================================= */

function saveUserMemory(text) {

    const memories =
        loadJSON(MEMORY_KEY, []);

    memories.push({
        text,
        time: new Date().toISOString()
    });

    /*
      Keep last 100 memories.
    */

    const trimmed =
        memories.slice(-100);

    saveJSON(MEMORY_KEY, trimmed);
}

function saveMemory(userText, response) {

    const memories =
        loadJSON(MEMORY_KEY, []);

    memories.push({
        user: userText,
        assistant: response,
        time: new Date().toISOString()
    });

    saveJSON(
        MEMORY_KEY,
        memories.slice(-100)
    );
}

function getMemoryResponse() {

    const memories =
        loadJSON(MEMORY_KEY, []);

    if (!memories.length) {
        return "🧠 No stored memories.";
    }

    const recent =
        memories.slice(-10);

    return `
🧠 RECENT MEMORY

${recent.map((item, index) => {

    if (item.text) {
        return `${index + 1}. ${item.text}`;
    }

    return `${index + 1}. You: ${item.user}`;

}).join("\n")}
    `.trim();
}

function clearMemory() {

    localStorage.removeItem(MEMORY_KEY);

    if (chat) {
        chat.innerHTML = "";
    }

    if (msg) {
        msg.value = "";
    }

    addMessage(
        "J.A.R.V.I.S.",
        "🧹 Memory and chat history cleared."
    );

    return "Memory cleared.";
}

/* =========================================================
   FALLBACK AI AGENT
   ========================================================= */

function fallbackAgent(input) {

    const text = normalize(input);

    /*
      Basic intelligent responses for common commands.
    */

    if (text.includes("who are you")) {
        return "I am J.A.R.V.I.S., your browser-based personal AI Agent.";
    }

    if (text.includes("hello") || text.includes("hi")) {
        return "Hello. J.A.R.V.I.S. is ready.";
    }

    if (text.includes("thank")) {
        return "You're welcome. I'm ready for your next command.";
    }

    if (text.includes("how are you")) {
        return "All systems are operational.";
    }

    /*
      For unknown questions, perform a web search instead
      of pretending to know a current answer.
    */

    const url =
        `https://www.google.com/search?q=${encodeURIComponent(input)}`;

    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );

    return `
I don't have a dedicated local tool for that request yet.

I opened a web search for:
"${input}"
    `.trim();
}

/* =========================================================
   CHAT UI
   ========================================================= */

function addMessage(sender, text) {

    if (!chat) return;

    const wrapper =
        document.createElement("div");

    wrapper.className =
        sender === "YOU"
            ? "message user-message"
            : "message jarvis-message";

    const senderElement =
        document.createElement("strong");

    senderElement.textContent = sender;

    const textElement =
        document.createElement("div");

    textElement.textContent = text;

    wrapper.appendChild(senderElement);
    wrapper.appendChild(textElement);

    chat.appendChild(wrapper);

    scrollChat();

    saveChat();
}

function showThinking() {

    if (!chat) return;

    const existing =
        document.getElementById("jarvis-thinking");

    if (existing) return;

    const div =
        document.createElement("div");

    div.id = "jarvis-thinking";
    div.className = "message jarvis-message";

    div.innerHTML =
        "<strong>J.A.R.V.I.S.</strong><div>Processing…</div>";

    chat.appendChild(div);

    scrollChat();
}

function hideThinking() {

    const thinking =
        document.getElementById("jarvis-thinking");

    if (thinking) {
        thinking.remove();
    }
}

function scrollChat() {

    if (!chat) return;

    chat.scrollTop = chat.scrollHeight;
}

/* =========================================================
   CHAT PERSISTENCE
   ========================================================= */

const CHAT_KEY = "jarvis_chat_v1";

function saveChat() {

    if (!chat) return;

    localStorage.setItem(
        CHAT_KEY,
        chat.innerHTML
    );
}

function restoreChat() {

    if (!chat) return;

    const saved =
        localStorage.getItem(CHAT_KEY);

    if (saved) {
        chat.innerHTML = saved;
        scrollChat();
    }
}

/* =========================================================
   HELPERS
   ========================================================= */

function normalize(value) {

    return String(value)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function capitalize(value) {

    if (!value) return "";

    return value.charAt(0).toUpperCase() +
        value.slice(1);
}

function formatNumber(value) {

    if (typeof value !== "number") {
        return String(value);
    }

    if (value >= 1) {
        return value.toLocaleString(
            "en-US",
            {
                maximumFractionDigits: 2
            }
        );
    }

    return value.toPrecision(4);
}

function random(array) {

    return array[
        Math.floor(
            Math.random() * array.length
        )
    ];
}

function loadJSON(key, fallback) {

    try {

        const value =
            localStorage.getItem(key);

        if (!value) return fallback;

        return JSON.parse(value);

    } catch {

        return fallback;
    }
}

function saveJSON(key, value) {

    try {

        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

    } catch (error) {

        console.warn(
            "Local storage unavailable:",
            error
        );
    }
}

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function isGreeting(text) {

    return [
        "hi",
        "hello",
        "hey",
        "hey jarvis",
        "hello jarvis",
        "hi jarvis"
    ].includes(text);
}

/* =========================================================
   GLOBAL ERROR HANDLING
   ========================================================= */

window.addEventListener("error", (event) => {

    console.error(
        "Global error:",
        event.error || event.message
    );
});

window.addEventListener(
    "unhandledrejection",
    (event) => {

        console.error(
            "Unhandled promise rejection:",
            event.reason
        );
    }
);

/* =========================================================
   VOICE LIST INITIALIZATION
   ========================================================= */

if ("speechSynthesis" in window) {

    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

/* =========================================================
   J.A.R.V.I.S. READY
   ========================================================= */

console.log(
    "%c J.A.R.V.I.S. AI AGENT ONLINE ",
    "background:#050505;color:#00eaff;font-size:16px;font-weight:bold;padding:8px;"
);
