// ===== 3. TOOLS (THE HANDS) — 15 TOOLS =====
async function handleTools(text) {
  const t = String(text || '').toLowerCase();

  // 1. Time
  if (/\btime\b/.test(t) || t.includes('టైమ్') || t.includes('సమయం')) {
    return 'The time is ' + new Date().toLocaleTimeString() + ', Boss.';
  }

  // 2. Weather
  if (t.includes('weather') || t.includes('వాతావరణం')) {
    return await new Promise((res) => {
      if (!navigator.geolocation) {
        res('Geolocation is not supported, Boss.');
        return;
      }

      navigator.geolocation.getCurrentPosition(async (p) => {
        try {
          const r = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}&current=temperature_2m`
          );

          if (!r.ok) {
            throw new Error('Weather request failed');
          }

          const d = await r.json();

          res(
            `It is ${d.current.temperature_2m} degrees Celsius now, Boss.`
          );
        } catch (e) {
          console.error(e);
          res('Weather service error, Boss.');
        }
      }, () => {
        res('I need location permission for weather, Boss.');
      });
    });
  }

  // 3. Timer
  const m = t.match(
    /(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i
  );

  if ((t.includes('timer') || t.includes('టైమర్')) && m) {
    const amount = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();

    const factor =
      /^(hours?|hrs?)/.test(unit)
        ? 3600000
        : /^(seconds?|secs?)/.test(unit)
        ? 1000
        : 60000;

    const duration = amount * factor;

    setTimeout(() => {
      const message = `టైమర్ పూర్తయింది! ${amount} ${unit} అయ్యాయి.`;

      if (typeof speak === 'function') {
        speak(message);
      } else if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = 'te-IN';
        window.speechSynthesis.speak(utterance);
      }
    }, duration);

    return `Timer set for ${amount} ${unit}.`;
  }

  // 4. Translate
  if (t.includes('translate')) {
    const q =
      text.replace(/translate\s*(this)?/i, '').trim() || 'hello';

    try {
      const r = await fetch(
        'https://api.mymemory.translated.net/get?q=' +
        encodeURIComponent(q) +
        '&langpair=en|te'
      );

      if (!r.ok) {
        throw new Error('Translation request failed');
      }

      const d = await r.json();

      return 'In Telugu: ' + d.responseData.translatedText;
    } catch (e) {
      console.error(e);
      return 'Translate error, Boss.';
    }
  }

  // 5. YouTube Play
  if (t.includes('play') || t.includes('youtube')) {
    const q = text
      .replace(/youtube\s*(search)?/i, '')
      .replace(/^play\s*/i, '')
      .trim();

    if (q) {
      window.open(
        'https://www.youtube.com/results?search_query=' +
        encodeURIComponent(q),
        '_blank'
      );

      return 'Searching YouTube for ' + q + ', Boss.';
    }
  }

  return null; // Tool match కాకపోతే Gemini Brain కి వెళ్తుంది
}
