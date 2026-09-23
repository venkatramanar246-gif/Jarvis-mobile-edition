// J.A.R.V.I.S. - script.js
// Compatible with the supplied HTML structure.
// No HTML IDs, classes, buttons, inputs, or layout are changed.

'use strict';

document.addEventListener('DOMContentLoaded', () => {

    // =========================
    // ELEMENT REFERENCES
    // =========================

    const msg = document.getElementById('msg');
    const send = document.getElementById('send');
    const micBtn = document.getElementById('mic-btn');
    const camBtn = document.getElementById('cam-btn');
    const clearBtn = document.getElementById('clear-btn');
    const imgInput = document.getElementById('img-input');
    const chat = document.getElementById('chat');

    if (!msg || !send || !micBtn || !camBtn || !clearBtn || !imgInput || !chat) {
        console.error('J.A.R.V.I.S. required HTML elements were not found.');
        return;
    }

    // =========================
    // STATE
    // =========================

    let recognition = null;
    let listening = false;
    let selectedImage = null;
    let timerIds = [];

    const MEMORY_KEY = 'jarvis_memory';

    // =========================
    // BASIC HELPERS
    // =========================

    function addMessage(text, type = 'bot') {
        if (!chat) return;

        const message = document.createElement('div');

        message.className = type === 'user'
            ? 'message user-message'
            : 'message bot-message';

        message.textContent = String(text);

        chat.appendChild(message);
        chat.scrollTop = chat.scrollHeight;

        return message;
    }

    function speak(text) {
        if (!('speechSynthesis' in window)) {
            return;
        }

        try {
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(String(text));

            utterance.lang = 'en-US';
            utterance.rate = 1;
            utterance.pitch = 1;
            utterance.volume = 1;

            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('Speech synthesis error:', error);
        }
    }

    function saveMemory(text) {
        try {
            const memory = JSON.parse(
                localStorage.getItem(MEMORY_KEY) || '[]'
            );

            memory.push({
                text: String(text),
                time: new Date().toISOString()
            });

            localStorage.setItem(
                MEMORY_KEY,
                JSON.stringify(memory.slice(-100))
            );
        } catch (error) {
            console.error('Memory save error:', error);
        }
    }

    function getMemory() {
        try {
            return JSON.parse(
                localStorage.getItem(MEMORY_KEY) || '[]'
            );
        } catch (error) {
            console.error('Memory read error:', error);
            return [];
        }
    }

    // =========================
    // 3. TOOLS (THE HANDS)
    // =========================

    async function handleTools(text) {

        const originalText = String(text);
        const t = originalText.toLowerCase();

        // -------------------------
        // 1. Time
        // -------------------------

        if (
            /\btime\b/.test(t) ||
            t.includes('టైమ్') ||
            t.includes('సమయం')
        ) {
            return 'The time is ' +
                new Date().toLocaleTimeString() +
                ', Boss.';
        }

        // -------------------------
        // 2. Weather
        // -------------------------

        if (
            t.includes('weather') ||
            t.includes('వాతావరణం')
        ) {

            if (!navigator.geolocation) {
                return 'Geolocation is not supported by this browser, Boss.';
            }

            return await new Promise((resolve) => {

                navigator.geolocation.getCurrentPosition(
                    async (position) => {

                        try {

                            const latitude = position.coords.latitude;
                            const longitude = position.coords.longitude;

                            const response = await fetch(
                                'https://api.open-meteo.com/v1/forecast' +
                                '?latitude=' + encodeURIComponent(latitude) +
                                '&longitude=' + encodeURIComponent(longitude) +
                                '&current_weather=true'
                            );

                            if (!response.ok) {
                                throw new Error(
                                    'Weather request failed: ' +
                                    response.status
                                );
                            }

                            const data = await response.json();

                            if (
                                !data.current_weather ||
                                typeof data.current_weather.temperature === 'undefined'
                            ) {
                                throw new Error('Invalid weather response');
                            }

                            resolve(
                                'It is ' +
                                data.current_weather.temperature +
                                ' degrees Celsius now, Boss.'
                            );

                        } catch (error) {

                            console.error('Weather error:', error);

                            resolve(
                                'Weather service error, Boss.'
                            );
                        }

                    },
                    (error) => {

                        console.error(
                            'Geolocation error:',
                            error
                        );

                        resolve(
                            'I need location permission for weather, Boss.'
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

        // -------------------------
        // 3. Timer
        // -------------------------

        const timerMatch = t.match(
            /(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i
        );

        if (
            (
                t.includes('timer') ||
                t.includes('టైమర్')
            ) &&
            timerMatch
        ) {

            const amount = parseInt(timerMatch[1], 10);
            const unit = timerMatch[2].toLowerCase();

            let factor;

            if (/hours?|hrs?/i.test(unit)) {
                factor = 3600000;
            } else if (/minutes?|mins?/i.test(unit)) {
                factor = 60000;
            } else {
                factor = 1000;
            }

            const duration = amount * factor;

            const timerId = setTimeout(() => {

                const notificationText =
                    'టైమర్ పూర్తయింది! ' +
                    amount +
                    ' ' +
                    unit +
                    ' అయ్యాయి.';

                speak(notificationText);

                addMessage(notificationText, 'bot');

                if (
                    'Notification' in window &&
                    Notification.permission === 'granted'
                ) {
                    try {
                        new Notification('J.A.R.V.I.S.', {
                            body: notificationText
                        });
                    } catch (error) {
                        console.error(
                            'Notification error:',
                            error
                        );
                    }
                }

            }, duration);

            timerIds.push(timerId);

            if (
                'Notification' in window &&
                Notification.permission === 'default'
            ) {
                try {
                    Notification.requestPermission().catch(() => {});
                } catch (error) {
                    console.error(
                        'Notification permission error:',
                        error
                    );
                }
            }

            return (
                'Timer set for ' +
                amount +
                ' ' +
                unit +
                '.'
            );
        }

        // -------------------------
        // 4. Translate
        // -------------------------

        if (t.includes('translate')) {

            const query = originalText
                .replace(/translate\s*(this)?/i, '')
                .trim() || 'hello';

            try {

                const response = await fetch(
                    'https://api.mymemory.translated.net/get?q=' +
                    encodeURIComponent(query) +
                    '&langpair=en|te'
                );

                if (!response.ok) {
                    throw new Error(
                        'Translation request failed'
                    );
                }

                const data = await response.json();

                if (
                    !data.responseData ||
                    typeof data.responseData.translatedText !== 'string'
                ) {
                    throw new Error(
                        'Invalid translation response'
                    );
                }

                return (
                    'In Telugu: ' +
                    data.responseData.translatedText
                );

            } catch (error) {

                console.error(
                    'Translation error:',
                    error
                );

                return 'Translate error, Boss.';
            }
        }

        // -------------------------
        // 5. YouTube Play
        // -------------------------

        if (
            t.includes('play') ||
            t.includes('youtube')
        ) {

            const query = originalText
                .replace(/play\s+youtube\s*(search)?/i, '')
                .trim();

            if (query) {

                try {
                    window.open(
                        'https://www.youtube.com/results?search_query=' +
                        encodeURIComponent(query),
                        '_blank',
                        'noopener,noreferrer'
                    );
                } catch (error) {
                    console.error(
                        'YouTube open error:',
                        error
                    );
                }

                return (
                    'Searching YouTube for ' +
                    query +
                    ', Boss.'
                );
            }
        }

        // Tool match not found.
        return null;
    }

    // =========================
    // LOCAL COMMAND HANDLER
    // =========================

    async function processCommand(text) {

        const command = String(text).trim();

        if (!command) {
            return;
        }

        const toolResult = await handleTools(command);

        if (toolResult !== null) {
            addMessage(toolResult, 'bot');
            speak(toolResult);
            return;
        }

        const lower = command.toLowerCase();

        // -------------------------
        // Greeting
        // -------------------------

        if (
            /^(hi|hello|hey|hey jarvis|hi jarvis|hello jarvis)[!. ]*$/i.test(command)
        ) {

            const response =
                'Hello Boss. J.A.R.V.I.S. is online and ready.';

            addMessage(response, 'bot');
            speak(response);
            return;
        }

        // -------------------------
        // Status
        // -------------------------

        if (
            lower.includes('status') ||
            lower.includes('system status')
        ) {

            const response =
                'All available systems are operational, Boss.';

            addMessage(response, 'bot');
            speak(response);
            return;
        }

        // -------------------------
        // Memory
        // -------------------------

        if (
            lower.includes('what do you remember') ||
            lower.includes('show memory') ||
            lower.includes('memory')
        ) {

            const memory = getMemory();

            if (!memory.length) {

                const response =
                    'No stored memory found, Boss.';

                addMessage(response, 'bot');
                speak(response);
                return;
            }

            const response =
                'I have ' +
                memory.length +
                ' stored memory item' +
                (memory.length === 1 ? '' : 's') +
                ', Boss.';

            addMessage(response, 'bot');
            speak(response);
            return;
        }

        // -------------------------
        // Simple calculator
        // -------------------------

        if (
            lower.startsWith('calculate ') ||
            lower.startsWith('calc ')
        ) {

            const expression = command
                .replace(/^calculate\s+/i, '')
                .replace(/^calc\s+/i, '')
                .trim();

            if (/^[0-9+\-*/().%\s]+$/.test(expression)) {

                try {

                    const result = Function(
                        '"use strict"; return (' +
                        expression +
                        ')'
                    )();

                    if (
                        typeof result === 'number' &&
                        Number.isFinite(result)
                    ) {

                        const response =
                            'The answer is ' +
                            result +
                            ', Boss.';

                        addMessage(response, 'bot');
                        speak(response);
                        return;
                    }

                } catch (error) {
                    console.error(
                        'Calculator error:',
                        error
                    );
                }
            }
        }

        // -------------------------
        // Generic assistant response
        // -------------------------

        saveMemory(command);

        const response =
            'Command received, Boss: ' +
            command;

        addMessage(response, 'bot');
        speak(response);
    }

    // =========================
    // SEND / EXECUTE
    // =========================

    async function executeCommand() {

        const text = msg.value.trim();

        if (!text) {
            return;
        }

        addMessage(text, 'user');

        msg.value = '';
        msg.focus();

        send.disabled = true;

        try {
            await processCommand(text);
        } catch (error) {

            console.error(
                'Command execution error:',
                error
            );

            const errorMessage =
                'Command execution error, Boss.';

            addMessage(errorMessage, 'bot');
            speak(errorMessage);

        } finally {
            send.disabled = false;
            msg.focus();
        }
    }

    send.addEventListener('click', executeCommand);

    // =========================
    // ENTER KEY
    // =========================

    msg.addEventListener('keydown', (event) => {

        if (
            event.key === 'Enter' &&
            !event.shiftKey
        ) {
            event.preventDefault();
            executeCommand();
        }
    });

    // =========================
    // VOICE RECOGNITION
    // =========================

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    function setMicState(active) {

        listening = active;

        if (active) {
            micBtn.classList.add('active');
            micBtn.setAttribute(
                'aria-label',
                'Stop voice input'
            );
        } else {
            micBtn.classList.remove('active');
            micBtn.setAttribute(
                'aria-label',
                'Activate voice input'
            );
        }
    }

    if (SpeechRecognition) {

        recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setMicState(true);
        };

        recognition.onresult = (event) => {

            try {

                const result =
                    event.results[
                        event.results.length - 1
                    ];

                if (
                    result &&
                    result[0] &&
                    result[0].transcript
                ) {

                    const transcript =
                        result[0].transcript.trim();

                    if (transcript) {
                        msg.value = transcript;
                    }
                }

            } catch (error) {
                console.error(
                    'Voice result error:',
                    error
                );
            }
        };

        recognition.onerror = (event) => {

            console.error(
                'Voice recognition error:',
                event.error
            );

            setMicState(false);

            let message =
                'Voice input error, Boss.';

            if (event.error === 'not-allowed') {
                message =
                    'Microphone permission was denied, Boss.';
            } else if (event.error === 'no-speech') {
                message =
                    'I did not hear anything, Boss.';
            } else if (event.error === 'audio-capture') {
                message =
                    'No microphone was detected, Boss.';
            } else if (event.error === 'network') {
                message =
                    'Voice recognition network error, Boss.';
            }

            addMessage(message, 'bot');
        };

        recognition.onend = () => {
            setMicState(false);
        };

    } else {

        recognition = null;

        micBtn.title =
            'Voice recognition is not supported in this browser';
    }

    micBtn.addEventListener('click', () => {

        if (!recognition) {

            const message =
                'Voice recognition is not supported in this browser, Boss.';

            addMessage(message, 'bot');
            return;
        }

        try {

            if (listening) {
                recognition.stop();
                return;
            }

            recognition.start();

        } catch (error) {

            console.error(
                'Voice start/stop error:',
                error
            );

            setMicState(false);

            if (
                error.name === 'InvalidStateError'
            ) {
                try {
                    recognition.stop();
                } catch (stopError) {
                    console.error(
                        'Voice stop error:',
                        stopError
                    );
                }
            } else {
                addMessage(
                    'Unable to start voice input, Boss.',
                    'bot'
                );
            }
        }
    });

    // =========================
    // CAMERA / IMAGE INPUT
    // =========================

    camBtn.addEventListener('click', () => {

        try {
            imgInput.value = '';
            imgInput.click();
        } catch (error) {

            console.error(
                'Image input open error:',
                error
            );

            addMessage(
                'Unable to open image input, Boss.',
                'bot'
            );
        }
    });

    imgInput.addEventListener('change', (event) => {

        const file =
            event.target.files &&
            event.target.files[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {

            const message =
                'Please select a valid image file, Boss.';

            addMessage(message, 'bot');
            speak(message);

            imgInput.value = '';
            return;
        }

        selectedImage = file;

        analyzeImage(file);
    });

    async function analyzeImage(file) {

        try {

            const imageURL =
                URL.createObjectURL(file);

            const image =
                new Image();

            image.onload = () => {

                const message =
                    'Image loaded successfully, Boss. ' +
                    'File: ' +
                    file.name +
                    '. Dimensions: ' +
                    image.naturalWidth +
                    ' by ' +
                    image.naturalHeight +
                    ' pixels.';

                addMessage(message, 'bot');
                speak(
                    'Image loaded successfully, Boss.'
                );

                URL.revokeObjectURL(imageURL);
            };

            image.onerror = () => {

                URL.revokeObjectURL(imageURL);

                const message =
                    'I could not read that image, Boss.';

                addMessage(message, 'bot');
                speak(message);
            };

            image.src = imageURL;

        } catch (error) {

            console.error(
                'Image analysis error:',
                error
            );

            const message =
                'Image analysis error, Boss.';

            addMessage(message, 'bot');
            speak(message);
        }
    }

    // =========================
    // CLEAR MEMORY
    // =========================

    clearBtn.addEventListener('click', () => {

        try {

            localStorage.removeItem(MEMORY_KEY);

            selectedImage = null;

            if (imgInput) {
                imgInput.value = '';
            }

            timerIds.forEach((id) => {
                try {
                    clearTimeout(id);
                } catch (error) {
                    console.error(
                        'Timer clear error:',
                        error
                    );
                }
            });

            timerIds = [];

            chat.innerHTML = '';

            const message =
                'Memory cleared successfully, Boss.';

            addMessage(message, 'bot');
            speak(message);

        } catch (error) {

            console.error(
                'Clear memory error:',
                error
            );

            addMessage(
                'Unable to clear memory, Boss.',
                'bot'
            );
        }
    });

    // =========================
    // INITIALIZATION
    // =========================

    try {

        const existingMemory = getMemory();

        if (existingMemory.length > 0) {
            console.log(
                'J.A.R.V.I.S. memory loaded:',
                existingMemory.length
            );
        }

        msg.focus();

    } catch (error) {
        console.error(
            'J.A.R.V.I.S. initialization error:',
            error
        );
    }

});
