/* ==========================================================================
   Finlytics — Global Voice Assistant popup
   Opens from the mic icon in the header on ANY page. Once open it listens
   continuously and acts on what you say — add a transaction, jump to
   Wallet, flip a dark-mode setting, ask a finance question — and speaks
   every answer back. It only stops when you tap Stop / close the popup
   (or say "stop"). Reuses the exact same rule engine as the Assistant
   page via window.Assistant.answerQuery(), so answers never drift between
   the two.
   ========================================================================== */

(function () {
  const PAGE_FILES = {
    dashboard: "index.html",
    transactions: "transactions.html",
    wallet: "wallet.html",
    analytics: "analytics.html",
    assistant: "assistant.html",
    reports: "reports.html",
    settings: "settings.html"
  };
  const PAGE_WORDS = {
    dashboard: /dashboard|home/i,
    transactions: /transactions?/i,
    wallet: /wallet|accounts?|budgets?|goals?|recurring/i,
    analytics: /analytics|charts?|insights?/i,
    assistant: /assistant|chat/i,
    reports: /reports?/i,
    settings: /settings?/i
  };

  function detectNavigation(q) {
    if (!/^(open|go to|goto|show|navigate to|take me to)\b/i.test(q.trim())) return null;
    for (const [page, re] of Object.entries(PAGE_WORDS)) {
      if (re.test(q)) return page;
    }
    return null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  // Extra voice-only commands beyond finance Q&A: navigation, quick
  // settings toggles, adding a wallet account. Everything else falls
  // through to the shared Assistant.answerQuery() engine.
  async function handleVoiceCommand(rawText, lang) {
    const q = rawText.toLowerCase().trim();

    const navTarget = detectNavigation(q);
    if (navTarget) {
      const dest = PAGE_FILES[navTarget];
      const label = navTarget.charAt(0).toUpperCase() + navTarget.slice(1);
      setTimeout(() => { location.href = dest; }, 1400); // let the spoken reply finish first
      return { reply: `Opening ${label}.` };
    }

    if (/dark mode|switch to dark/.test(q)) { window.Theme && Theme.apply("dark"); Store.saveSettings({ theme: "dark" }); return { reply: "Switched to dark mode." }; }
    if (/light mode|switch to light/.test(q)) { window.Theme && Theme.apply("light"); Store.saveSettings({ theme: "light" }); return { reply: "Switched to light mode." }; }

    if (/(turn off|disable|stop).*(voice|speak|audio)/.test(q)) { Store.saveSettings({ voiceEnabled: false }); return { reply: "Voice replies turned off." }; }
    if (/(turn on|enable|start).*(voice|speak|audio)/.test(q)) { Store.saveSettings({ voiceEnabled: true }); return { reply: "Voice replies turned on." }; }

    if (/urdu|اردو/.test(q)) { Store.saveSettings({ language: "ur" }); window.Assistant && Assistant.setLangState("ur"); return { reply: "Switched to Urdu.", lang: "ur" }; }
    if (/english/.test(q) && /switch|voice|language/.test(q)) { Store.saveSettings({ language: "en" }); window.Assistant && Assistant.setLangState("en"); return { reply: "Switched to English." }; }

    const accMatch = q.match(/add\s+(?:an?\s+)?account\s+([a-z0-9\s]+?)\s+([\d,]+)$/i);
    if (accMatch) {
      const name = accMatch[1].trim().replace(/\b\w/g, c => c.toUpperCase());
      const balance = parseFloat(accMatch[2].replace(/,/g, ""));
      Store.add("accounts", { name, type: "bank", balance });
      Nav && Nav.notifBadge && Nav.notifBadge();
      return { reply: `Added account "${name}" with an opening balance of ${balance.toLocaleString()}.` };
    }

    if (!window.Assistant) return { reply: "The assistant engine isn't loaded on this page yet." };
    return await Assistant.answerQuery(rawText, lang);
  }

  // ---------------- Popup UI ----------------
  let box = null, backdrop = null, msgsEl = null, statusEl = null, pulse = null;
  let ending = false, active = false;

  function addBubble(role, html) {
    const wrap = document.createElement("div");
    wrap.className = "msg " + role;
    wrap.innerHTML = `<div class="msg-avatar">${role === "ai" ? "F" : "U"}</div><div class="msg-bubble">${html}</div>`;
    msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return wrap;
  }

  function addChart(wrap, chartConfig) {
    const box = document.createElement("div");
    box.className = "result-chart-wrap";
    box.style.height = "180px";
    const canvas = document.createElement("canvas");
    box.appendChild(canvas);
    wrap.appendChild(box);
    setTimeout(() => { try { new Chart(canvas.getContext("2d"), chartConfig); } catch (e) {} }, 0);
  }

  function setListeningUI(isListening) {
    if (!statusEl) return;
    statusEl.textContent = isListening ? "Listening…" : "Paused";
    pulse.style.boxShadow = isListening ? "0 0 0 8px rgba(93,202,165,0.18)" : "none";
  }

  function build() {
    backdrop = document.createElement("div");
    backdrop.className = "modal-overlay open";
    box = document.createElement("div");
    box.className = "modal";
    box.style.cssText = "width:440px;max-width:92vw;padding:0;display:flex;flex-direction:column;height:min(600px,80vh);";
    backdrop.appendChild(box);

    const header = document.createElement("div");
    header.style.cssText = "position:relative;text-align:center;padding:22px 22px 14px;border-bottom:1px solid var(--border);flex:none;";
    const closeBtn = document.createElement("button");
    closeBtn.className = "modal-close";
    closeBtn.style.cssText = "position:absolute;top:14px;right:14px;";
    closeBtn.innerHTML = "&times;";
    pulse = document.createElement("div");
    pulse.style.cssText = "width:60px;height:60px;border-radius:50%;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;background:var(--accent);color:#fff;transition:box-shadow .3s;";
    pulse.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';
    statusEl = document.createElement("div");
    statusEl.style.cssText = "font-weight:700;font-size:14.5px;";
    statusEl.textContent = "Listening…";
    header.append(closeBtn, pulse, statusEl);
    box.appendChild(header);

    msgsEl = document.createElement("div");
    msgsEl.style.cssText = "flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:12px;";
    box.appendChild(msgsEl);

    const footer = document.createElement("div");
    footer.style.cssText = "padding:14px 18px;border-top:1px solid var(--border);flex:none;";
    const hint = document.createElement("div");
    hint.style.cssText = "font-size:11px;color:var(--ink-faint);margin-bottom:10px;text-align:center;";
    hint.textContent = 'Works from any page — transactions, budgets, charts, "open wallet", "dark mode", or ask a finance question. Say "stop" to end.';
    const stopBtn = document.createElement("button");
    stopBtn.className = "btn btn-primary btn-block";
    stopBtn.textContent = "Stop Voice Assistant";
    footer.append(hint, stopBtn);
    box.appendChild(footer);

    closeBtn.onclick = close;
    stopBtn.onclick = close;
    backdrop.onclick = (e) => { if (e.target === backdrop) close(); };

    document.body.appendChild(backdrop);
  }

  async function onHeard(transcript) {
    if (ending || !transcript) return;
    addBubble("user", escapeHtml(transcript));

    if (/^\s*(stop|exit|cancel|quit|goodbye)\s*[.!]?\s*$/i.test(transcript)) {
      addBubble("ai", "Stopping the voice assistant.");
      VoiceEngine.speak("Stopping the voice assistant.", langTag(), close);
      return;
    }

    VoiceEngine.pauseContinuous();
    setListeningUI(false);
    statusEl.textContent = "Thinking…";

    let result;
    try {
      result = await handleVoiceCommand(transcript, window.Assistant ? Assistant.getLang() : "en");
    } catch (e) {
      result = { reply: "Sorry, something went wrong with that request." };
    }
    if (ending) return;

    const wrap = addBubble("ai", escapeHtml(result.reply));
    if (result.chart) addChart(wrap, result.chart);

    statusEl.textContent = "Speaking…";
    VoiceEngine.speak(window.Assistant ? Assistant.stripHtml(result.reply) : result.reply, langTag(), () => {
      if (ending) return;
      statusEl.textContent = "Listening…";
      VoiceEngine.resumeContinuous(langTag(), onHeard, setListeningUI);
    });
  }

  function langTag() {
    const lang = window.Assistant ? Assistant.getLang() : "en";
    return lang === "ur" ? "ur-PK" : "en-US";
  }

  function close() {
    if (ending) return;
    ending = true;
    active = false;
    VoiceEngine.stopContinuous();
    window.speechSynthesis && window.speechSynthesis.cancel();
    window.Assistant && Assistant.resetFlow();
    if (backdrop) backdrop.remove();
    backdrop = box = msgsEl = statusEl = pulse = null;
    document.querySelectorAll("[data-global-mic]").forEach(el => el.classList.remove("listening"));
  }

  function open() {
    if (active) return; // already running — don't stack popups
    if (!VoiceEngine.supported) {
      alert("Voice input needs a secure page (https:// or localhost) and a browser that supports speech recognition (Chrome or Edge work best).");
      return;
    }
    active = true;
    ending = false;
    build();
    document.querySelectorAll("[data-global-mic]").forEach(el => el.classList.add("listening"));
    addBubble("ai", 'Hi! I\'m listening — say things like "add expense 500 for groceries from cash", "open wallet", "switch to dark mode", or "how\'s my budget doing?".');
    VoiceEngine.startContinuous(langTag(), onHeard, setListeningUI);
  }

  window.VoicePopup = { open, close, isOpen: () => active };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-global-mic]").forEach(btn => btn.addEventListener("click", open));
  });
})();
