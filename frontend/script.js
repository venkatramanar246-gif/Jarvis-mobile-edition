/* ===== J.A.R.V.I.S. - CORRECTED SCRIPT.JS ===== */

(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {

    /* ===== DOM ELEMENTS ===== */
    const msg = document.getElementById('msg');
    const send = document.getElementById('send');
    const micBtn = document.getElementById('mic-btn');
    const camBtn = document.getElementById('cam-btn');
    const clearBtn = document.getElementById('clear-btn');
    const imgInput = document.getElementById('img-input');
    const chat = document.getElementById('chat');

    if (!msg || !send || !micBtn || !camBtn || !clearBtn || !imgInput || !chat) {
      console.error('J.A.R.V.I.S.: Required HTML elements are missing.');
      return;
    }

    /* ===== MEMORY ===== */
    const MEMORY_KEY = 'jarvis_memory';

    function getMemory() {
      try {
        return JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]');
      } catch (e) {
        return [];
      }
    }

    function saveMemory(role, text) {
      try {
        const memory = getMemory();
        memory.push({
          role,
          text,
          time: new Date().toISOString()
        });

        /* Keep memory reasonably small */
        if (memory.length > 100) {
          memory.splice(0, memory.length - 100);
        }

        localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
      } catch (e) {
        console.warn('Memory could not be saved.', e);
      }
    }

    /* ===== CHAT OUTPUT ===== */
    function addMessage(text, type = 'ai') {
      const message = document.createElement('div');

      message.className = `message ${type}`;
      message.textContent = text;

      chat.appendChild(message);
      chat.scrollTop = chat.scrollHeight;

      return message;
    }

    function addUserMessage(text) {
      addMessage(text, 'user');
      saveMemory('user', text);
    }

    function addAIMessage(text) {
      addMessage(text, 'ai');
      saveMemory('assistant', text);
    }

    /* ===== SPEECH ===== */
    function speak(text) {
      if (!('speechSynthesis' in window)) return;

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(String(text));

        /* Use Telugu voice for Telugu text, otherwise Indian English */
        if (/[\u0C00-\u0C7F]/.test(text)) {
          utterance.lang = 'te-IN';
        } else {
          utterance.lang = 'en-IN';
        }

        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.volume = 1;

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis error:', e);
      }
    }

    /* ===== 1. TIME ===== */
    function getTimeResponse() {
      return 'The time is ' +
        new Date().toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit'
        }) +
        ', Boss.';
    }

    /* ===== 2. WEATHER ===== */
    async function getWeather() {
      return new Promise((resolve) => {

        if (!navigator.geolocation) {
          resolve('Geolocation is not supported by this browser, Boss.');
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const latitude = position.coords.latitude;
              const longitude = position.coords.longitude;

              const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
              );

              if (!response.ok) {
                throw new Error('Weather request failed');
              }

              const data = await response.json();

              if (
                data.current_weather &&
                typeof data.current_weather.temperature !== 'undefined'
              ) {
                resolve(
                  `It is ${data.current_weather.temperature} degrees Celsius now, Boss.`
                );
              } else {
                resolve('Weather data is unavailable right now, Boss.');
              }

            } catch (error) {
              console.error(error);
              resolve('Weather service error, Boss.');
            }
          },

          () => {
            resolve('I need location permission for weather, Boss.');
          },

          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000
          }
        );
      });
    }

    /* ===== 3. TIMER ===== */
    function handleTimer(text) {
      const match = text.match(
        /(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/i
      );

      if (!match) {
        return 'Please specify the timer duration, Boss.';
      }

      const amount = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      let factor;

      if (/^(hours?|hrs?|h)$/.test(unit)) {
        factor = 3600000;
      } else if (/^(minutes?|mins?|m)$/.test(unit)) {
        factor = 60000;
      } else {
        factor = 1000;
      }

      const duration = amount * factor;

      setTimeout(() => {
        const timerMessage = `Timer finished. ${amount} ${unit} are over, Boss.`;
        addAIMessage(timerMessage);
        speak(timerMessage);
      }, duration);

      return `Timer set for ${amount} ${unit}.`;
    }

    /* ===== 4. TRANSLATE ===== */
    async function handleTranslate(text) {
      const match = text.match(/translate\s+(.+?)(?:\s+to\s+(english|telugu))?$/i);

      const query = match && match[1]
        ? match[1].trim()
        : text.replace(/^translate\s*/i, '').trim();

      const target = match && match[2]
        ? match[2].toLowerCase()
        : 'telugu';

      if (!query) {
        return 'Please tell me what you want me to translate, Boss.';
      }

      try {
        const langPair = target === 'english' ? 'te|en' : 'en|te';

        const response = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(query)}&langpair=${langPair}`
        );

        if (!response.ok) {
          throw new Error('Translation request failed');
        }

        const data = await response.json();

        if (
          data &&
          data.responseData &&
          data.responseData.translatedText
        ) {
          return target === 'english'
            ? 'In English: ' + data.responseData.translatedText
            : 'In Telugu: ' + data.responseData.translatedText;
        }

        return 'Translation was not available, Boss.';

      } catch (error) {
        console.error(error);
        return 'Translate error, Boss.';
      }
    }

    /* ===== 5. YOUTUBE PLAY / SEARCH ===== */
    function handleYouTube(text) {
      let query = text
        .replace(/^play\s*/i, '')
        .replace(/^youtube\s*/i, '')
        .replace(/^search\s+youtube\s*/i, '')
        .replace(/^play\s+youtube\s*/i, '')
        .trim();

      if (!query) {
        window.open('https://www.youtube.com/', '_blank');
        return 'Opening YouTube, Boss.';
      }

      window.open(
        'https://www.youtube.com/results?search_query=' +
        encodeURIComponent(query),
        '_blank'
      );

      return `Searching YouTube for ${query}, Boss.`;
    }

    /* ===== OTHER BASIC COMMANDS ===== */
    function handleBasicCommands(text) {
      const t = text.toLowerCase().trim();

      if (
        /^(hello|hi|hey|hello jarvis|hi jarvis|hey jarvis)$/.test(t)
      ) {
        return 'Hello Boss. J.A.R.V.I.S. is online and ready.';
      }

      if (
        t.includes('who are you') ||
        t.includes('what are you')
      ) {
        return 'I am J.A.R.V.I.S., your personal AI assistant, Boss.';
      }

      if (
        t.includes('how are you')
      ) {
        return 'All systems are operational, Boss.';
      }

      if (
        t.includes('system status') ||
        t.includes('status')
      ) {
        return 'AI engine operational. Connection online. Voice interface ready. Long-term memory active, Boss.';
      }

      if (
        t.includes('date') ||
        t.includes('today')
      ) {
        return 'Today is ' +
          new Date().toLocaleDateString([], {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }) +
          ', Boss.';
      }

      if (
        t.includes('open google')
      ) {
        window.open('https://www.google.com/', '_blank');
        return 'Opening Google, Boss.';
      }

      if (
        t.includes('open youtube')
      ) {
        window.open('https://www.youtube.com/', '_blank');
        return 'Opening YouTube, Boss.';
      }

      if (
        t.includes('open gmail')
      ) {
        window.open('https://mail.google.com/', '_blank');
        return 'Opening Gmail, Boss.';
      }

      return null;
    }

    /* ===== TOOLS (THE HANDS) ===== */
    async function handleTools(text) {
      const t = text.toLowerCase().trim();

      /* 1. Time */
      if (
        /\btime\b/.test(t) ||
        t.includes('టైమ్') ||
        t.includes('సమయం')
      ) {
        return getTimeResponse();
      }

      /* 2. Weather */
      if (
        t.includes('weather') ||
        t.includes('వాతావరణం')
      ) {
        return await getWeather();
      }

      /* 3. Timer */
      if (
        t.includes('timer') ||
        t.includes('టైమర్')
      ) {
        return handleTimer(text);
      }

      /* 4. Translate */
      if (t.includes('translate')) {
        return await handleTranslate(text);
      }

      /* 5. YouTube */
      if (
        t.includes('play') ||
        t.includes('youtube')
      ) {
        return handleYouTube(text);
      }

      return null;
    }

    /* ===== COMMAND ENGINE ===== */
    async function processCommand(text) {
      const command = String(text || '').trim();

      if (!command) {
        return 'Please enter a command, Boss.';
      }

      /* Tools first */
      const toolResponse = await handleTools(command);

      if (toolResponse !== null) {
        return toolResponse;
      }

      /* Basic commands */
      const basicResponse = handleBasicCommands(command);

      if (basicResponse !== null) {
        return basicResponse;
      }

      /* Fallback */
      return `Command received: "${command}". I am ready for another command, Boss.`;
    }

    /* ===== MAIN EXECUTE FLOW ===== */
    let executing = false;

    async function executeCommand(command, fromVoice = false) {
      const text = String(command || '').trim();

      if (!text || executing) {
        return;
      }

      executing = true;

      try {
        /* Voice commands use exactly the same command flow as EXECUTE */
        msg.value = text;

        addUserMessage(text);

        const response = await processCommand(text);

        addAIMessage(response);

        /* Automatically speak the reply */
        speak(response);

      } catch (error) {
        console.error('Command execution error:', error);

        const errorMessage =
          'Sorry Boss, I could not complete that command.';

        addAIMessage(errorMessage);
        speak(errorMessage);

      } finally {
        executing = false;

        if (!fromVoice) {
          msg.focus();
        }
      }
    }

    /* ===== EXECUTE BUTTON ===== */
    send.addEventListener('click', () => {
      executeCommand(msg.value, false);
    });

    /* ===== ENTER KEY ===== */
    msg.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        executeCommand(msg.value, false);
      }
    });

    /* ===== MICROPHONE / VOICE INPUT ===== */
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    let recognition = null;
    let listening = false;

    if (SpeechRecognition) {

      recognition = new SpeechRecognition();

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        listening = true;

        micBtn.setAttribute(
          'aria-label',
          'Stop voice input'
        );

        micBtn.classList.add('listening');

        addMessage('Listening, Boss...', 'system');
      };

      recognition.onresult = (event) => {
        const result =
          event.results &&
          event.results[0] &&
          event.results[0][0];

        if (!result) {
          return;
        }

        const spokenText = result.transcript.trim();

        if (!spokenText) {
          return;
        }

        /*
         * IMPORTANT:
         * Voice input automatically calls executeCommand().
         * The user does NOT have to press EXECUTE again.
         */
        msg.value = spokenText;

        executeCommand(spokenText, true);
      };

      recognition.onerror = (event) => {
        console.error(
          'Speech recognition error:',
          event.error
        );

        if (event.error === 'not-allowed') {
          addMessage(
            'Microphone permission was denied, Boss.',
            'system'
          );
        } else if (event.error !== 'aborted') {
          addMessage(
            'Voice input error. Please try again, Boss.',
            'system'
          );
        }
      };

      recognition.onend = () => {
        listening = false;

        micBtn.setAttribute(
          'aria-label',
          'Activate voice input'
        );

        micBtn.classList.remove('listening');
      };

      micBtn.addEventListener('click', () => {

        if (listening) {
          try {
            recognition.stop();
          } catch (e) {
            console.warn(e);
          }
          return;
        }

        try {
          /*
           * Automatically use Indian English.
           * Browser recognition can still recognize Telugu
           * depending on browser/device settings.
           */
          recognition.lang = 'en-IN';
          recognition.start();
        } catch (error) {
          console.error(
            'Could not start microphone:',
            error
          );
        }
      });

    } else {

      micBtn.addEventListener('click', () => {
        const message =
          'Voice recognition is not supported in this browser, Boss.';

        addAIMessage(message);
        speak(message);
      });

    }

    /* ===== CAMERA BUTTON ===== */
    camBtn.addEventListener('click', () => {
      imgInput.click();
    });

    /* ===== IMAGE INPUT ===== */
    imgInput.addEventListener('change', (event) => {
      const file =
        event.target.files &&
        event.target.files[0];

      if (!file) {
        return;
      }

      if (!file.type.startsWith('image/')) {
        const errorMessage =
          'Please select a valid image file, Boss.';

        addAIMessage(errorMessage);
        speak(errorMessage);

        imgInput.value = '';
        return;
      }

      const imageUrl = URL.createObjectURL(file);

      const wrapper = document.createElement('div');
      wrapper.className = 'message user image-message';

      const image = document.createElement('img');

      image.src = imageUrl;
      image.alt = 'Selected image';
      image.style.maxWidth = '100%';
      image.style.maxHeight = '300px';
      image.style.objectFit = 'contain';
      image.style.display = 'block';

      wrapper.appendChild(image);
      chat.appendChild(wrapper);

      chat.scrollTop = chat.scrollHeight;

      saveMemory(
        'user',
        `[Image selected: ${file.name}]`
      );

      const response =
        `Image "${file.name}" is ready for analysis, Boss.`;

      addAIMessage(response);
      speak(response);

      /* Release object URL after image is loaded */
      image.onload = () => {
        URL.revokeObjectURL(imageUrl);
      };

      /* Allow selecting the same image again */
      imgInput.value = '';
    });

    /* ===== CLEAR MEMORY ===== */
    clearBtn.addEventListener('click', () => {

      try {
        localStorage.removeItem(MEMORY_KEY);
      } catch (e) {
        console.warn('Could not clear memory:', e);
      }

      chat.innerHTML = '';

      const message =
        'Memory cleared successfully, Boss.';

      addAIMessage(message);
      speak(message);

      msg.value = '';
      msg.focus();
    });

    /* ===== INITIAL SYSTEM MESSAGE ===== */
    if (chat.children.length === 0) {
      addAIMessage(
        'J.A.R.V.I.S. online. All systems are ready, Boss.'
      );
    }

  });

})();
