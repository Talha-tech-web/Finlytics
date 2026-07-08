/* ==========================================================================
   Finlytics — Voice Engine
   Low-level speech-to-text / text-to-speech wrapper around the browser's
   Web Speech API. Free, no key needed. This is deliberately separate from
   voice-popup.js: this file only knows about audio in/out, never about
   Finlytics data or UI, so it can be reused anywhere a mic is needed.
   ========================================================================== */

(function () {
  const VoiceEngine = {
    recognizer: null,
    listening: false,
    supported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),

    _manualStop: false,
    _paused: false,
    _lang: "en-US",

    // Always-on listening session: keeps re-launching recognition after
    // every pause/timeout until stopContinuous() is explicitly called, so
    // a hands-free assistant doesn't die after a single utterance.
    startContinuous(lang, onResult, onStateChange) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return false;
      this._manualStop = false;
      this._paused = false;
      this.listening = true;
      this._lang = lang || "en-US";

      const launch = () => {
        if (this._manualStop || this._paused) return;
        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = this._lang;
        rec.onresult = (e) => {
          const last = e.results[e.results.length - 1];
          if (last.isFinal) onResult(last[0].transcript.trim());
        };
        rec.onerror = () => { /* swallow no-speech/aborted; onend decides whether to restart */ };
        rec.onend = () => {
          if (this._manualStop || this._paused) { this.listening = false; onStateChange && onStateChange(false); return; }
          setTimeout(launch, 250); // browser auto-stopped after silence — relaunch to stay "always on"
        };
        this.recognizer = rec;
        try { rec.start(); onStateChange && onStateChange(true); } catch (e) { setTimeout(launch, 400); }
      };
      launch();
      return true;
    },

    // Briefly pause the mic (e.g. while the assistant is speaking) without
    // ending the overall session.
    pauseContinuous() {
      this._paused = true;
      this.listening = false;
      if (this.recognizer) { try { this.recognizer.stop(); } catch (e) {} }
    },

    resumeContinuous(lang, onResult, onStateChange) {
      if (!this._manualStop) this.startContinuous(lang || this._lang, onResult, onStateChange);
    },

    stopContinuous() {
      this._manualStop = true;
      this._paused = false;
      this.listening = false;
      if (this.recognizer) { try { this.recognizer.stop(); } catch (e) {} }
    },

    speak(text, lang, onEnd) {
      if (!window.speechSynthesis) { onEnd && onEnd(); return; }
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang || "en-US";
        u.rate = 1;
        if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
        window.speechSynthesis.speak(u);
      } catch (e) { onEnd && onEnd(); }
    }
  };

  window.VoiceEngine = VoiceEngine;
})();
