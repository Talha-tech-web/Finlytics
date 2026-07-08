/* Finlytics — Settings: all features wired to Store */
(function () {

  // ---- helpers ----
  function el(id) { return document.getElementById(id); }
  function val(id) { return el(id) ? el(id).value : null; }

  // ---- load saved settings into form ----
  function loadForm() {
    const s = Store.getSettings();

    // Profile
    if (el("businessName")) el("businessName").value = s.businessName || "";

    // Appearance
    if (el("fontSizeSelect")) el("fontSizeSelect").value = s.fontSize  || "normal";
    if (window.Theme) Theme.syncPicker();

    // AI Assistant
    if (el("aiSelect"))      el("aiSelect").value      = s.aiEnabled    === false ? "false" : "true";
    if (el("voiceSelect"))   el("voiceSelect").value   = s.voiceEnabled === false ? "false" : "true";
    if (el("showSqlSelect")) el("showSqlSelect").value = s.showSql      === true  ? "true"  : "false";
    if (el("langSelect"))    el("langSelect").value    = s.language     || "en";
    if (el("aiKeyInput"))    el("aiKeyInput").value    = s.aiApiKey     || "";
    updateAiKeyStatus(s.aiApiKey ? "API key saved (not verified yet — click Save & Test)." : "No key set — using built-in local engine.");

    // Notifications
    const notifOn = s.notificationsEnabled !== false;
    if (el("notifSelect"))           el("notifSelect").value           = notifOn ? "true" : "false";
    if (el("paymentReminderSelect")) el("paymentReminderSelect").value = s.paymentReminder !== false ? "true" : "false";
    if (el("lowBalanceSelect"))      el("lowBalanceSelect").value      = s.lowBalanceAlert !== false ? "true" : "false";
    syncNotifSubs(notifOn);
  }

  // ---- apply font size immediately ----
  function applyFontSize(size) {
    const map = { small: "13px", normal: "15px", large: "17px" };
    document.documentElement.style.setProperty("--font-size-base", map[size] || "15px");
    document.body.style.fontSize = map[size] || "15px";
  }

  // ---- show/hide notification sub-options ----
  function syncNotifSubs(enabled) {
    const sub = el("notifSubOptions");
    if (sub) sub.style.opacity = enabled ? "1" : "0.4";
    if (sub) sub.style.pointerEvents = enabled ? "auto" : "none";
  }

  // ---- Profile ----
  function setupProfile() {
    const form = el("profileForm");
    if (!form) return;
    form.addEventListener("submit", e => {
      e.preventDefault();
      const name = el("businessName").value.trim() || "My Finances";
      Store.saveSettings({ businessName: name });
      Nav.setUserChip();
      const btn = el("saveProfileBtn");
      const original = btn.textContent;
      btn.textContent = "Saved ✓";
      setTimeout(() => (btn.textContent = original), 1500);
    });
  }

  // ---- Appearance ----
  function setupAppearance() {
    const picker = el("themePicker");
    if (picker) {
      picker.querySelectorAll(".theme-picker-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const value = btn.dataset.themeValue;
          Theme.setPreference(value);
        });
      });
    }
    if (el("fontSizeSelect")) {
      el("fontSizeSelect").addEventListener("change", e => {
        applyFontSize(e.target.value);
        Store.saveSettings({ fontSize: e.target.value });
      });
    }
  }

  function syncAiFields(enabled) {
    ["voiceSelect", "showSqlSelect", "langSelect"].forEach(id => {
      if (el(id)) {
        el(id).disabled = !enabled;
        const field = el(id).closest(".field");
        if (field) field.style.opacity = enabled ? "1" : "0.4";
      }
    });
  }

  // ---- AI Assistant ----
  function setupAI() {
    if (el("aiSelect")) {
      el("aiSelect").addEventListener("change", e => {
        Store.saveSettings({ aiEnabled: e.target.value === "true" });
        syncAiFields(e.target.value === "true");
      });
      syncAiFields(el("aiSelect").value === "true");
    }
    if (el("voiceSelect")) {
      el("voiceSelect").addEventListener("change", e => {
        Store.saveSettings({ voiceEnabled: e.target.value === "true" });
      });
    }
    if (el("showSqlSelect")) {
      el("showSqlSelect").addEventListener("change", e => {
        Store.saveSettings({ showSql: e.target.value === "true" });
      });
    }
    if (el("langSelect")) {
      el("langSelect").addEventListener("change", e => {
        Store.saveSettings({ language: e.target.value });
      });
    }
  }

  // ---- AI Assistant: API key (show/hide, save & test, clear) ----
  function updateAiKeyStatus(msg, isError) {
    const s = el("aiKeyStatus");
    if (!s) return;
    s.textContent = msg;
    s.style.color = isError ? "var(--negative)" : "var(--ink-dim)";
  }

  async function testAiKey(key) {
    const cfg = window.FINLYTICS_CONFIG || {};
    try {
      const res = await fetch(cfg.AI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
        body: JSON.stringify({
          model: cfg.AI_MODEL,
          max_tokens: 5,
          messages: [{ role: "user", content: "ping" }]
        })
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  function setupAiKey() {
    const toggleBtn = el("aiKeyToggle");
    const input = el("aiKeyInput");
    const testBtn = el("aiKeyTestBtn");
    const clearBtn = el("aiKeyClearBtn");
    if (!input) return;

    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const showing = input.type === "text";
        input.type = showing ? "password" : "text";
        toggleBtn.textContent = showing ? "Show" : "Hide";
      });
    }

    if (testBtn) {
      testBtn.addEventListener("click", async () => {
        const key = input.value.trim();
        if (!key) { Store.saveSettings({ aiApiKey: "" }); updateAiKeyStatus("No key set — using built-in local engine."); return; }
        testBtn.disabled = true;
        const original = testBtn.textContent;
        testBtn.textContent = "Testing…";
        updateAiKeyStatus("Verifying API key…");
        const ok = await testAiKey(key);
        Store.saveSettings({ aiApiKey: key });
        testBtn.disabled = false;
        testBtn.textContent = original;
        if (ok) updateAiKeyStatus("✓ Key saved and verified — AI replies are active.", false);
        else updateAiKeyStatus("Key saved, but verification failed — double-check the key. The assistant will still work using the built-in local engine.", true);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        input.value = "";
        Store.saveSettings({ aiApiKey: "" });
        updateAiKeyStatus("Key cleared — using built-in local engine.");
      });
    }
  }

  // ---- Notifications ----
  function setupNotifications() {
    if (el("notifSelect")) {
      el("notifSelect").addEventListener("change", e => {
        const on = e.target.value === "true";
        Store.saveSettings({ notificationsEnabled: on });
        syncNotifSubs(on);
      });
    }
    if (el("paymentReminderSelect")) {
      el("paymentReminderSelect").addEventListener("change", e => {
        Store.saveSettings({ paymentReminder: e.target.value === "true" });
      });
    }
    if (el("lowBalanceSelect")) {
      el("lowBalanceSelect").addEventListener("change", e => {
        Store.saveSettings({ lowBalanceAlert: e.target.value === "true" });
      });
    }
  }

  // ---- Data: CSV export ----
  function exportCSV() {
    const txns = Store.list("txns");
    if (!txns.length) { alert("No transactions to export."); return; }
    const headers = ["Date", "Description", "Category", "Amount", "Account", "Type"];
    const rows = txns.map(t => [
      t.date, `"${(t.description||"").replace(/"/g,'""')}"`,
      t.category, t.amount, t.account, t.type
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "finlytics_transactions.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Data: PDF export (print) ----
  function exportPDF() {
    const txns = Store.list("txns");
    if (!txns.length) { alert("No transactions to export."); return; }
    const s = Store.getSettings();
    const name = s.businessName || "My Finances";
    const rows = txns.slice(0, 200).map(t =>
      `<tr><td>${t.date}</td><td>${t.description||""}</td><td>${t.category||""}</td>
       <td style="text-align:right">${Number(t.amount).toLocaleString("en-PK", {style:"currency",currency:"PKR"})}</td></tr>`
    ).join("");
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>${name} — Transactions</title>
      <style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:8px;font-size:13px}th{background:#f5f5f5}
      h2{margin-bottom:4px}p{color:#666;font-size:12px;margin-bottom:16px}</style></head><body>
      <h2>${name}</h2><p>Exported on ${new Date().toLocaleDateString()}</p>
      <table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
    win.document.close();
    win.print();
  }

  // ---- Chat history management ----
  function updateChatHistoryCount() {
    const lbl = el("chatHistoryCount");
    if (!lbl) return;
    const n = window.ChatCleanup ? ChatCleanup.getMessageCount() : 0;
    lbl.textContent = n
      ? `${n} saved message${n === 1 ? "" : "s"} in chat history.`
      : "No chat history saved.";
  }

  function setupChatHistory() {
    updateChatHistoryCount();

    const modal = el("deleteChatModal");
    const openBtn = el("deleteChatHistoryBtn");
    const confirmBtn = el("confirmDeleteChatBtn");
    if (!modal || !openBtn || !confirmBtn) return;

    const closeModal = () => modal.classList.remove("open");

    openBtn.addEventListener("click", () => {
      updateChatHistoryCount();
      modal.classList.add("open");
    });

    modal.querySelectorAll("[data-close-delete-chat]").forEach(btn => {
      btn.addEventListener("click", closeModal);
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    confirmBtn.addEventListener("click", () => {
      if (!window.ChatCleanup) {
        alert("Chat cleanup is not available on this page.");
        return;
      }
      ChatCleanup.clearAllChatHistory();
      closeModal();
      updateChatHistoryCount();
      alert("All chat history has been deleted successfully.");
    });

    window.addEventListener("finlytics:chat-cleared", updateChatHistoryCount);
  }

  // ---- Data Management ----
  function setupData() {
    if (el("exportCsvBtn")) el("exportCsvBtn").addEventListener("click", exportCSV);
    if (el("exportPdfBtn")) el("exportPdfBtn").addEventListener("click", exportPDF);

    if (el("resetTxnsBtn")) {
      el("resetTxnsBtn").addEventListener("click", () => {
        if (!confirm("Remove all transactions? Budgets and goals stay.")) return;
        localStorage.removeItem("fin_transactions");
        alert("Transactions cleared. Reloading…");
        location.reload();
      });
    }
    if (el("resetAllBtn")) {
      el("resetAllBtn").addEventListener("click", () => {
        if (!confirm("This wipes ALL local Finlytics data and cannot be undone. Continue?")) return;
        [
          "fin_transactions", "fin_accounts", "fin_budgets", "fin_goals",
          "fin_recurring", "fin_saved_reports", "fin_settings",
          "fin_assistant_chat_v2", "fin_assistant_sidebar_v2",
          "fin_assistant_chat", "fin_assistant_sidebar", "fin_assistant_recent",
          "fin_chat_history"
        ].forEach(k => localStorage.removeItem(k));
        sessionStorage.removeItem("fin_assistant_chat_v2_backup");
        sessionStorage.removeItem("fin_assistant_sidebar_v2_backup");
        alert("All data cleared. Reloading…");
        location.reload();
      });
    }
  }

  function renderCounts() {
    const lbl = el("txnCountLabel");
    if (lbl) lbl.textContent = Store.list("txns").length + " transactions currently stored — budgets & goals stay";
  }

  // ---- apply persistent font size on load ----
  function applyPersistedFontSize() {
    const s = Store.getSettings();
    if (s.fontSize) applyFontSize(s.fontSize);
  }

  // ---- init ----
  function init() {
    Store.init();
    applyPersistedFontSize();
    loadForm();
    setupProfile();
    setupAppearance();
    setupAI();
    setupAiKey();
    setupNotifications();
    setupChatHistory();
    setupData();
    renderCounts();
  }

  window.SettingsRefresh = function () {
    loadForm();
    renderCounts();
    applyPersistedFontSize();
    updateChatHistoryCount();
  };
  document.addEventListener("DOMContentLoaded", init);
})();
