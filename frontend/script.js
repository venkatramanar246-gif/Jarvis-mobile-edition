
// ============================================================
// J.A.R.V.I.S. AI - CORRECTED GEMINI JAVASCRIPT
// ============================================================

// ===== 1. GEMINI API KEY =====

let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
    API_KEY = prompt("Enter your Gemini API Key:");

    if (API_KEY) {
        API_KEY = API_KEY.trim();
        localStorage.setItem("jarvis_key", API_KEY);
    }
}


// ===== 2. WORKING GEMINI MODEL =====
// Use a stable model instead of old/invalid model names.

const MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite"
];


// ===== 3. MEMORY =====

let MEMORY = [];

try {
    const savedMemory = localStorage.getItem("jarvis_memory");

    if (savedMemory) {
        const parsed = JSON.parse(savedMemory);

        if (Array.isArray(parsed)) {
            MEMORY = parsed;
        }
    }
} catch (e) {
    MEMORY = [];
}


function saveMemory() {
    try {
        localStorage.setItem(
            "jarvis_memory",
            JSON.stringify(MEMORY)
        );
    } catch (e) {
        console.error("Memory save error:", e);
    }
}


// ===== 4. HTML ELEMENTS =====

const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const micBtn = document.getElementById("mic-btn");
const clearBtn = document.getElementById("clear-btn");
const camBtn = document.getElementById("cam-btn");
const imgInput = document.getElementById("img-input");


// ===== RESTORE MEMORY TO CHAT =====

if (chat) {
    MEMORY.forEach(function (m) {

        if (!m || !m.text) return;

        add(
            (m.role === "user" ? "YOU: " : "J.A.R.V.I.S: ") + m.text,
            m.role === "user" ? "user" : "ai"
        );

    });
}


// ============================================================
// 5. GEMINI BRAIN - TEXT + MEMORY
// ============================================================

async function callGemini(prompt) {

    if (!API_KEY) {
        throw new Error(
            "Gemini API key is missing. Reload the page and enter your API key."
        );
    }

    if (!prompt || !prompt.trim()) {
        throw new Error("Empty prompt.");
    }


    // Keep only the latest 12 memory messages.
    // Current prompt is added separately below.
    const history = MEMORY
        .slice(-12)
        .filter(function (m) {
            return m &&
                   (m.role === "user" || m.role === "model") &&
                   typeof m.text === "string" &&
                   m.text.trim();
        })
        .map(function (m) {

            return {
                role: m.role,
                parts: [
                    {
                        text: m.text
                    }
                ]
            };

        });


    // Add current user message.
    history.push({
        role: "user",
        parts: [
            {
                text: prompt.trim()
            }
        ]
    });


    let lastError = null;


    for (const model of MODELS) {

        try {

            const url =
                "https://generativelanguage.googleapis.com/v1beta/models/" +
                model +
                ":generateContent";


            const response = await fetch(url, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": API_KEY
                },

                body: JSON.stringify({
                    contents: history,

                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048
                    }
                })

            });


            let data = {};

            try {
                data = await response.json();
            } catch (jsonError) {
                throw new Error(
                    "Gemini returned an invalid response."
                );
            }


            // Handle API errors properly.
            if (!response.ok || data.error) {

                const message =
                    data &&
                    data.error &&
                    data.error.message
                        ? data.error.message
                        : "Gemini API request failed.";

                lastError = new Error(message);


                // Try next model for temporary/model errors.
                if (
                    response.status === 400 ||
                    response.status === 404 ||
                    response.status === 429 ||
                    response.status >= 500
                ) {
                    continue;
                }

                throw lastError;
            }


            // Safely extract generated text.
            const reply =
                data &&
                data.candidates &&
                data.candidates[0] &&
                data.candidates[0].content &&
                data.candidates[0].content.parts &&
                data.candidates[0].content.parts[0] &&
                data.candidates[0].content.parts[0].text;


            if (!reply) {
                throw new Error(
                    "Gemini returned no text response."
                );
            }


            return reply.trim();

        } catch (e) {

            lastError = e;

        }

    }


    throw lastError || new Error(
        "Gemini API request failed."
    );
}


// ============================================================
// ASK GEMINI
// ============================================================

async function askGemini(prompt) {

    prompt = (prompt || "").trim();

    if (!prompt) return;


    add(
        "J.A.R.V.I.S: Thinking...",
        "ai"
    );


    try {

        const reply = await callGemini(prompt);


        // Save user message ONCE.
        MEMORY.push({
            role: "user",
            text: prompt
        });


        // Save model reply.
        MEMORY.push({
            role: "model",
            text: reply
        });


        // Limit memory size.
        if (MEMORY.length > 50) {
            MEMORY = MEMORY.slice(-50);
        }


        saveMemory();


        // Replace Thinking message.
        if (chat && chat.lastChild) {

            chat.lastChild.innerText =
                "J.A.R.V.I.S: " + reply;

        } else {

            add(
                "J.A.R.V.I.S: " + reply,
                "ai"
            );

        }


        speak(reply);


    } catch (e) {

        const errorMessage =
            e && e.message
                ? e.message
                : "Unknown Gemini error.";


        if (chat && chat.lastChild) {

            chat.lastChild.innerText =
                "J.A.R.V.I.S: ERROR - " +
                errorMessage;

        } else {

            add(
                "J.A.R.V.I.S: ERROR - " +
                errorMessage,
                "ai"
            );

        }

        console.error("Gemini Error:", e);
    }
}


// ============================================================
// 6. VISION / IMAGE ANALYSIS
// ============================================================

if (camBtn && imgInput) {

    camBtn.onclick = function () {
        imgInput.click();
    };


    imgInput.onchange = function () {

        const file = imgInput.files &&
                     imgInput.files[0];

        if (!file) return;


        if (!file.type.startsWith("image/")) {

            add(
                "J.A.R.V.I.S: Please select an image file.",
                "ai"
            );

            return;
        }


        const reader = new FileReader();


        reader.onload = function () {

            const result = reader.result;

            if (!result) return;


            const parts = result.split(",");

            if (parts.length < 2) {

                add(
                    "J.A.R.V.I.S: Could not read the image.",
                    "ai"
                );

                return;
            }


            const base64 = parts[1];


            const q =
                input && input.value.trim()
                    ? input.value.trim()
                    : "What do you see in this image? Describe it briefly.";


            add(
                "YOU: [IMAGE] " + q,
                "user"
            );


            if (input) {
                input.value = "";
            }


            askVision(
                base64,
                file.type,
                q
            );

        };


        reader.onerror = function () {

            add(
                "J.A.R.V.I.S: Failed to read image.",
                "ai"
            );

        };


        reader.readAsDataURL(file);
    };
}


// ============================================================
// ASK VISION
// ============================================================

async function askVision(base64, mime, question) {

    add(
        "J.A.R.V.I.S: Analyzing image...",
        "ai"
    );


    if (!API_KEY) {

        if (chat && chat.lastChild) {

            chat.lastChild.innerText =
                "J.A.R.V.I.S: ERROR - Gemini API key is missing.";

        }

        return;
    }


    let lastError = null;


    for (const model of MODELS) {

        try {

            const url =
                "https://generativelanguage.googleapis.com/v1beta/models/" +
                model +
                ":generateContent";


            const response = await fetch(url, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": API_KEY
                },

                body: JSON.stringify({

                    contents: [

                        {
                            role: "user",

                            parts: [

                                {
                                    text: question
                                },

                                {
                                    inline_data: {
                                        mime_type: mime,
                                        data: base64
                                    }
                                }

                            ]
                        }

                    ],

                    generationConfig: {
                        temperature: 0.5,
                        maxOutputTokens: 2048
                    }

                })

            });


            let data = {};

            try {
                data = await response.json();
            } catch (e) {
                throw new Error(
                    "Invalid response from Gemini."
                );
            }


            if (!response.ok || data.error) {

                const message =
                    data &&
                    data.error &&
                    data.error.message
                        ? data.error.message
                        : "Image analysis failed.";

                lastError = new Error(message);

                continue;
            }


            const reply =
                data &&
                data.candidates &&
                data.candidates[0] &&
                data.candidates[0].content &&
                data.candidates[0].content.parts &&
                data.candidates[0].content.parts[0] &&
                data.candidates[0].content.parts[0].text;


            if (!reply) {

                throw new Error(
                    "Gemini returned no image description."
                );

            }


            if (chat && chat.lastChild) {

                chat.lastChild.innerText =
                    "J.A.R.V.I.S: " +
                    reply.trim();

            }


            speak(reply.trim());

            return;

        } catch (e) {

            lastError = e;

        }

    }


    const errorText =
        lastError && lastError.message
            ? lastError.message
            : "Image analysis failed.";


    if (chat && chat.lastChild) {

        chat.lastChild.innerText =
            "J.A.R.V.I.S: ERROR - " +
            errorText;

    }

    console.error("Vision Error:", lastError);
}


// ============================================================
// 7. SPEECH RECOGNITION
// ============================================================

const SR =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


if (SR && micBtn) {

    const rec = new SR();

    // Telugu speech recognition.
    // Change to "en-US" if you mainly speak English.
    rec.lang = "te-IN";

    rec.continuous = false;

    rec.interimResults = false;


    rec.onresult = function (e) {

        try {

            const t =
                e.results[0][0].transcript.trim();


            if (!t) return;


            add(
                "YOU: " + t,
                "user"
            );


            askGemini(t);

        } catch (error) {

            console.error(
                "Speech result error:",
                error
            );

        }

    };


    rec.onerror = function (e) {

        console.error(
            "Speech recognition error:",
            e.error
        );

        micBtn.innerText = "🎙️";

    };


    micBtn.onclick = function () {

        try {

            rec.start();

            micBtn.innerText =
                "LISTENING...";

        } catch (e) {

            console.error(
                "Speech start error:",
                e
            );

        }

    };


    rec.onend = function () {

        micBtn.innerText = "🎙️";

    };

}


// ============================================================
// 8. TEXT TO SPEECH
// ============================================================

let voices = [];


function loadVoices() {

    voices =
        window.speechSynthesis
            ? window.speechSynthesis.getVoices()
            : [];

}


loadVoices();


if ("speechSynthesis" in window) {

    speechSynthesis.onvoiceschanged =
        loadVoices;

}


function speak(text) {

    if (!text) return;

    if (!("speechSynthesis" in window)) {
        return;
    }


    try {

        speechSynthesis.cancel();


        const u =
            new SpeechSynthesisUtterance(text);


        u.rate = 1.05;

        u.pitch = 0.85;

        u.volume = 1;


        const v =
            voices.find(function (voice) {

                return voice.lang &&
                       voice.lang
                           .toLowerCase()
                           .startsWith("en");

            });


        if (v) {
            u.voice = v;
        }


        speechSynthesis.speak(u);

    } catch (e) {

        console.error(
            "Speech synthesis error:",
            e
        );

    }

}


// ============================================================
// 9. SEND BUTTON
// ============================================================

const sendBtn =
    document.getElementById("send");


if (sendBtn && input) {

    sendBtn.onclick = function () {

        const t =
            input.value.trim();


        if (!t) return;


        add(
            "YOU: " + t,
            "user"
        );


        input.value = "";


        askGemini(t);

    };

}


// Allow Enter key to send.
if (input) {

    input.addEventListener(
        "keydown",
        function (e) {

            if (
                e.key === "Enter" &&
                !e.shiftKey
            ) {

                e.preventDefault();

                if (sendBtn) {
                    sendBtn.click();
                }

            }

        }
    );

}


// ============================================================
// 10. CLEAR MEMORY
// ============================================================

if (clearBtn) {

    clearBtn.onclick = function () {

        MEMORY = [];

        saveMemory();


        if (chat) {
            chat.innerHTML = "";
        }


        add(
            "SYSTEM: Memory cleared.",
            "ai"
        );

    };

}


// ============================================================
// ADD MESSAGE TO CHAT
// ============================================================

function add(text, who) {

    if (!chat) {
        console.warn(
            "Chat element #chat not found."
        );

        return null;
    }


    const d =
        document.createElement("div");


    d.className =
        "msg " + (who || "ai");


    d.innerText =
        text;


    chat.appendChild(d);


    chat.scrollTop =
        chat.scrollHeight;


    return d;
}


// ============================================================
// OPTIONAL: CHECK API KEY
// ============================================================

console.log(
    "J.A.R.V.I.S loaded."
);

console.log(
    "Gemini API Key:",
    API_KEY ? "FOUND" : "NOT FOUND"
);

console.log(
    "Gemini Models:",
    MODELS
);
