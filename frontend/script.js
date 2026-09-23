// ==========================================
// J.A.R.V.I.S. CLIENT ENGINE (script.js)
// ==========================================

const GEMINI_API_KEY = ""; // Enter your Gemini API Key here if using direct AI Brain fallback

// 1. DOM Elements Mapping
const chatContainer = document.getElementById("chat");
const msgInput = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");
const camBtn = document.getElementById("cam-btn");
const clearBtn = document.getElementById("clear-btn");
const imgInput = document.getElementById("img-input");

// 2. Chat History & Memory Initialization
let chatHistory = JSON.parse(localStorage.getItem("jarvis_chat_history")) || [];

// Render existing chat history on load
window.addEventListener("DOMContentLoaded", () => {
  if (chatHistory.length === 0) {
    appendMessage("bot", "Online and ready, Boss. How can I assist you today?");
  } else {
    chatHistory.forEach(item => renderMessageBubble(item.sender, item.text));
  }
});

function saveMemory() {
  localStorage.setItem("jarvis_chat_history", JSON.stringify(chatHistory));
}

function renderMessageBubble(sender, text) {
  const bubble = document.createElement("div");
  bubble.className = `msg-bubble ${sender}`;
  bubble.style.margin = "8px 0";
  bubble.style.padding = "10px 14px";
  bubble.style.borderRadius = "8px";
  bubble.style.maxWidth = "80%";
  bubble.style.wordBreak = "break-word";
  bubble.style.fontSize = "14px";
  bubble.style.lineHeight = "1.4";

  if (sender === "user") {
    bubble.style.alignSelf = "flex-end";
    bubble.style.background = "#00e5ff22";
    bubble.style.border = "1px solid #00e5ff";
    bubble.style.color = "#00e5ff";
    bubble.style.marginLeft = "auto";
  } else {
    bubble.style.alignSelf = "flex-start";
    bubble.style.background = "#ffffff11";
    bubble.style.border = "1px solid #ffffff33";
    bubble.style.color = "#ffffff";
    bubble.style.marginRight = "auto";
  }

  bubble.textContent = text;
  chatContainer.appendChild(bubble);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendMessage(sender, text) {
  chatHistory.push({ sender, text });
  saveMemory();
  renderMessageBubble(sender, text);
}

// 3. Speech Synthesis (Text to Speech)
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel(); // Stop active speech

  const cleanText = text.replace(/[*#_`]/g, "");
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // Language auto-detection for Telugu / English
  if (/[\u0C00-\u0C7F]/.test(cleanText)) {
    utterance.lang = "te-IN";
  } else {
    utterance.lang = "en-US";
  }

  window.speechSynthesis.speak(utterance);
}

// 4. Speech Recognition (Voice Input)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-IN";

  recognition.onstart = () => {
    isRecording = true;
    micBtn.style.filter = "drop-shadow(0 0 8px #00e5ff)";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    msgInput.value = transcript;
    handleUserSubmission(transcript);
  };

  recognition.onerror = () => {
    isRecording = false;
    micBtn.style.filter = "none";
  };

  recognition.onend = () => {
    isRecording = false;
    micBtn.style.filter = "none";
  };
}

micBtn.addEventListener("click", () => {
  if (!recognition) {
    alert("Speech recognition is not supported in this browser.");
    return;
  }
  if (isRecording) {
    recognition.stop();
  } else {
    recognition.start();
  }
});

// 5. All 15 Tools Implementation
async function handleTools(text) {
  const t = text.toLowerCase().trim();

  // 1. Time
  if (/\btime\b/.test(t) || t.includes("టైమ్") || t.includes("సమయం")) {
    const timeStr = new Date().toLocaleTimeString();
    return `The time is ${timeStr}, Boss.`;
  }

  // 2. Weather
  if (t.includes("weather") || t.includes("వాతావరణం")) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve("Geolocation is not supported by your browser, Boss.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
            const data = await res.json();
            resolve(`The current temperature is ${data.current_weather.temperature}°C, Boss.`);
          } catch (err) {
            resolve("Unable to retrieve weather data right now, Boss.");
          }
        },
        () => resolve("I need location permission to check the weather, Boss.")
      );
    });
  }

  // 3. Timer
  const timerMatch = t.match(/(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i);
  if ((t.includes("timer") || t.includes("టైమర్")) && timerMatch) {
    const amount = parseInt(timerMatch[1]);
    const unit = timerMatch[2].toLowerCase();
    let duration = amount * 1000;
    if (/^(minutes?|mins?)$/.test(unit)) duration = amount * 60 * 1000;
    if (/^(hours?|hrs?)$/.test(unit)) duration = amount * 3600 * 1000;

    setTimeout(() => {
      const alertMsg = `Boss, your timer for ${amount} ${unit} has completed! టైమర్ పూర్తయింది!`;
      appendMessage("bot", alertMsg);
      speak(alertMsg);
    }, duration);

    return `Timer set for ${amount} ${unit}, Boss.`;
  }

  // 4. Dice / Coin
  if (t.includes("roll a dice") || t.includes("roll dice") || t.includes("dice") || t.includes("పాచిక")) {
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    return `You rolled a ${diceRoll}, Boss.`;
  }
  if (t.includes("flip a coin") || t.includes("toss a coin") || t.includes("coin toss") || t.includes("నాణెం")) {
    const outcome = Math.random() < 0.5 ? "Heads" : "Tails";
    return `It is ${outcome}, Boss.`;
  }

  // 5. Joke
  if (t.includes("joke") || t.includes("జోక్")) {
    try {
      const res = await fetch("https://v2.jokeapi.dev/joke/Any?safe-mode&type=single");
      const data = await res.json();
      return data.joke || "Why do programmers prefer dark mode? Because light attracts bugs!";
    } catch {
      return "Why do Java developers wear glasses? Because they don't C#!";
    }
  }

  // 6. Quote
  if (t.includes("quote") || t.includes("motivat") || t.includes("కోట్")) {
    try {
      const res = await fetch("https://dummyjson.com/quotes/random");
      const data = await res.json();
      return `"${data.quote}" — ${data.author}`;
    } catch {
      return '"Success is not final, failure is not fatal: it is the courage to continue that counts." — Winston Churchill';
    }
  }

  // 7. News
  if (t.includes("news") || t.includes("వార్తలు")) {
    try {
      const res = await fetch("https://api.spaceflightnewsapi.net/v4/articles/?limit=3");
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const headlines = data.results.map((a, i) => `${i + 1}. ${a.title}`).join("\n");
        return `Here are the latest headlines, Boss:\n${headlines}`;
      }
      return "No current news feeds available at the moment, Boss.";
    } catch {
      return "Unable to fetch live news right now, Boss.";
    }
  }

  // 8. Translate
  if (t.startsWith("translate") || t.includes("అనువాదం")) {
    const cleanQuery = text.replace(/translate/i, "").replace(/అనువాదం/i, "").trim() || "Hello, how are you?";
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanQuery)}&langpair=en|te`);
      const data = await res.json();
      return `Translation: ${data.responseData.translatedText}`;
    } catch {
      return "Translate service encountered an error, Boss.";
    }
  }

  // 9. Currency
  if (t.includes("convert") || t.includes("currency") || t.includes("exchange rate") || t.includes("రూపాయి")) {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await res.json();
      const inrRate = data.rates.INR;
      return `The current exchange rate is 1 USD = ${inrRate.toFixed(2)} INR, Boss.`;
    } catch {
      return "Could not retrieve the current exchange rate, Boss.";
    }
  }

  // 10. Meaning / Dictionary
  if (t.startsWith("meaning of") || t.startsWith("define ") || t.includes("అర్థం")) {
    const word = t.replace("meaning of", "").replace("define", "").replace("అర్థం", "").trim().split(" ")[0];
    if (word) {
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        const data = await res.json();
        const def = data[0]?.meanings[0]?.definitions[0]?.definition;
        if (def) return `The meaning of ${word} is: ${def}`;
        return `I couldn't find the definition for "${word}", Boss.`;
      } catch {
        return `Sorry Boss, I couldn't fetch the definition for ${word}.`;
      }
    }
  }

  // 11. Password Generator
  if (t.includes("password") || t.includes("పాస్వర్డ్")) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~";
    let generated = "";
    for (let i = 0; i < 12; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `Here is a secure password: ${generated}`;
  }

  // 12. Search
  if (t.startsWith("search ") || t.startsWith("google ") || t.includes("వెతుకు")) {
    const query = text.replace(/^(search|google|వెతుకు)/i, "").trim();
    if (query) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
      return `Searching Google for "${query}", Boss.`;
    }
  }

  // 13. Open Apps / Websites
  if (t.startsWith("open ") || t.startsWith("launch ")) {
    const app = t.replace(/^(open|launch)\s+/i, "").trim();
    const appTargets = {
      youtube: "https://www.youtube.com",
      google: "https://www.google.com",
      gmail: "https://mail.google.com",
      github: "https://www.github.com",
      whatsapp: "https://web.whatsapp.com",
      instagram: "https://www.instagram.com",
      twitter: "https://twitter.com",
      x: "https://x.com",
      facebook: "https://www.facebook.com"
    };

    for (const key of Object.keys(appTargets)) {
      if (app.includes(key)) {
        window.open(appTargets[key], "_blank");
        return `Opening ${key}, Boss.`;
      }
    }
    window.open(`https://${app.replace(/\s+/g, "")}.com`, "_blank");
    return `Opening ${app}, Boss.`;
  }

  // 14. Play Songs / YouTube
  if (t.startsWith("play ") || t.includes("పాట") || t.includes("youtube")) {
    const song = text.replace(/^(play|youtube|పాట)/i, "").trim();
    if (song) {
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(song)}`, "_blank");
      return `Playing "${song}" on YouTube, Boss.`;
    }
  }

  // 15. Crypto
  if (t.includes("crypto") || t.includes("bitcoin") || t.includes("btc") || t.includes("eth") || t.includes("క్రిప్టో")) {
    try {
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,inr");
      const data = await res.json();
      return `Bitcoin is at $${data.bitcoin.usd.toLocaleString()} (₹${data.bitcoin.inr.toLocaleString()}) and Ethereum is at $${data.ethereum.usd.toLocaleString()} (₹${data.ethereum.inr.toLocaleString()}), Boss.`;
    } catch {
      return "Unable to fetch live crypto rates right now, Boss.";
    }
  }

  return null; // Tool match not found, forward to AI Engine
}

// 6. Gemini AI Core Brain
async function queryGemini(promptText, imageBase64 = null) {
  if (!GEMINI_API_KEY) {
    return "AI Engine offline: Please configure your Gemini API Key in script.js to activate autonomous conversational intelligence.";
  }

  const model = "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const parts = [];
  if (imageBase64) {
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: imageBase64
      }
    });
  }
  parts.push({
    text: `You are J.A.R.V.I.S., an advanced AI assistant. Keep responses clear, polite, and address the user as Boss.\n\nUser: ${promptText}`
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received from core intelligence.";
  } catch (error) {
    return "Error communicating with the AI Engine. Please verify your connection and API configuration.";
  }
}

// 7. Request Handler
async function handleUserSubmission(rawText) {
  const query = (rawText || msgInput.value).trim();
  if (!query) return;

  appendMessage("user", query);
  msgInput.value = "";

  // Check 15 Local Tools first
  const toolResult = await handleTools(query);

  if (toolResult) {
    appendMessage("bot", toolResult);
    speak(toolResult);
  } else {
    // Forward to Gemini Brain
    const aiResponse = await queryGemini(query);
    appendMessage("bot", aiResponse);
    speak(aiResponse);
  }
}

// 8. Event Listeners (Chat & UI)
sendBtn.addEventListener("click", () => handleUserSubmission());

msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    handleUserSubmission();
  }
});

clearBtn.addEventListener("click", () => {
  localStorage.removeItem("jarvis_chat_history");
  chatHistory = [];
  chatContainer.innerHTML = "";
  appendMessage("bot", "Memory wiped. Ready for fresh instructions, Boss.");
  speak("Memory cleared, Boss.");
});

// 9. Camera & Image Analysis
camBtn.addEventListener("click", () => {
  imgInput.click();
});

imgInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    const base64Data = reader.result.split(",")[1];
    appendMessage("user", "[Uploaded an image for analysis]");
    appendMessage("bot", "Scanning and analyzing the visual input, Boss...");
    speak("Analyzing image, Boss.");

    const analysis = await queryGemini("Describe and analyze this image in detail.", base64Data);
    appendMessage("bot", analysis);
    speak(analysis);
  };
  reader.readAsDataURL(file);
});
