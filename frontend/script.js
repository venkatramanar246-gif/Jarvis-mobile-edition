// ===== 1. API KEY (Safe: browser లో మాత్రమే) =====
let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
    API_KEY = prompt("Enter your Gemini API Key:");

    if (API_KEY) {
        localStorage.setItem("jarvis_key", API_KEY);
    }
}


// ===== 2. SMART MODELS (first one fails -> next one try) =====
const MODELS = [
    "gemini-3.6-flash",
    "gemini-flash-latest"
];


// ===== 3. DOM ELEMENTS =====
const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const micBtn = document.getElementById("mic-btn");


// ===== 4. GEMINI BRAIN (auto-fallback) =====
async function callGemini(prompt) {

    if (!API_KEY) {
        throw new Error("Gemini API Key is missing.");
    }

    let lastErr;

    for (const model of MODELS) {

        try {

            const res = await fetch(
                "https://generativelanguage.googleapis.com/v1beta/models/" +
                model +
                ":generateContent?key=" +
                encodeURIComponent(API_KEY),
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    {
                                        text: prompt
                                    }
                                ]
                            }
                        ]
                    })
                }
            );

            const data = await res.json();

            if (!res.ok || data.error) {

                lastErr = new Error(
                    data?.error?.message ||
                    `HTTP ${res.status}: ${res.statusText}`
                );

                // Try next model for temporary/model errors
                const status = data?.error?.status || "";

                if (
                    res.status === 429 ||
                    res.status === 500 ||
                    res.status === 503 ||
                    status === "RESOURCE_EXHAUSTED" ||
                    status === "UNAVAILABLE"
                ) {
                    continue;
                }

                throw lastErr;
            }

            const text =
                data?.candidates?.[0]?.content?.parts
                    ?.map(part => part.text || "")
                    .join("")
                    .trim();

            if (!text) {
                throw new Error("Gemini returned an empty response.");
            }

            return text;

        } catch (err) {

            lastErr = err;

            // Try the next model
            continue;
        }
    }

    throw lastErr || new Error("Gemini request failed.");
}


// ===== 5. ASK GEMINI =====
async function askGemini(prompt) {

    add("J.A.R.V.I.S: Thinking...", "ai");

    try {

        const reply = await callGemini(prompt);

        // Remove the temporary Thinking message
        const messages = chat.querySelectorAll(".msg.ai");

        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];

            if (lastMessage.innerText === "J.A.R.V.I.S: Thinking...") {
                lastMessage.remove();
            }
        }

        add("J.A.R.V.I.S: " + reply, "ai");

        speak(reply);

    } catch (err) {

        const messages = chat.querySelectorAll(".msg.ai");

        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];

            if (lastMessage.innerText === "J.A.R.V.I.S: Thinking...") {
                lastMessage.remove();
            }
        }

        add(
            "J.A.R.V.I.S ERROR: " + (err.message || err),
            "ai"
        );
    }
}


// ===== 6. SPEECH RECOGNITION =====
const SR =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let rec = null;

if (SR) {

    rec = new SR();

    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (e) => {

        const t = e.results[0][0].transcript;

        add("YOU: " + t, "user");

        askGemini(t);
    };

    rec.onerror = (e) => {
        add(
            "J.A.R.V.I.S: Microphone error - " + e.error,
            "ai"
        );
    };

    rec.onend = () => {

        if (micBtn) {
            micBtn.innerText = "🎤";
        }
    };

    if (micBtn) {

        micBtn.onclick = () => {

            try {

                rec.start();

                micBtn.innerText = "LISTENING...";

            } catch (err) {

                // Prevent "recognition has already started" error
                console.log(err);
            }
        };
    }

} else {

    if (micBtn) {

        micBtn.onclick = () => {
            add(
                "J.A.R.V.I.S: Speech Recognition is not supported in this browser.",
                "ai"
            );
        };
    }
}


// ===== 7. TEXT-TO-SPEECH =====
let voices = [];

function loadVoices() {
    voices = speechSynthesis.getVoices();
}

loadVoices();

speechSynthesis.onvoiceschanged = loadVoices;


function speak(t) {

    if (!("speechSynthesis" in window)) {
        return;
    }

    // Cancel previous speech
    speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(t);

    u.rate = 1.05;
    u.pitch = 0.85;

    const v = voices.find(
        voice => voice.lang &&
        voice.lang.startsWith("en")
    );

    if (v) {
        u.voice = v;
    }

    speechSynthesis.speak(u);
}


// ===== 8. TEXT SEND BUTTON =====
const sendBtn = document.getElementById("send");

if (sendBtn) {

    sendBtn.onclick = () => {

        const t = input.value.trim();

        if (!t) {
            return;
        }

        add("YOU: " + t, "user");

        input.value = "";

        askGemini(t);
    };
}


// ===== 9. ENTER KEY SEND =====
if (input) {

    input.addEventListener("keydown", (e) => {

        if (e.key === "Enter" && !e.shiftKey) {

            e.preventDefault();

            if (sendBtn) {
                sendBtn.click();
            }
        }
    });
}


// ===== 10. ADD MESSAGE TO CHAT =====
function add(t, w) {

    if (!chat) {
        console.error("Chat element not found.");
        return;
    }

    const d = document.createElement("div");

    d.className = "msg " + w;

    d.innerText = t;

    chat.appendChild(d);

    chat.scrollTop = chat.scrollHeight;
          }
