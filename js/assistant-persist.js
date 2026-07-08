/*Finlytics — Assistant chat persistence (localStorage via Store) */
(function () {
  const STORAGE_VERSION = 2;
  const MAX_MESSAGES = 100;
  const PRIMARY_KEY = "fin_assistant_chat_v2";

  function storageGet(key) {
    if (window.Store && Store.getChatSession && key === PRIMARY_KEY) {
      return Store.getChatSession();
    }
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, payload) {
    if (window.Store && Store.saveChatSession && key === PRIMARY_KEY) {
      return Store.saveChatSession(payload);
    }
    try {
      localStorage.setItem(key, JSON.stringify(payload));
      return true;
    } catch (e) {
      return false;
    }
  }

  function sanitizeChartConfig(config) {
    if (!config || typeof config !== "object") return null;
    try {
      return JSON.parse(JSON.stringify(config, (_, v) => (typeof v === "function" ? undefined : v)));
    } catch (e) {
      return null;
    }
  }

  function inferRole(raw, index) {
    if (raw.role === "user") return "user";
    if (raw.role === "ai" || raw.role === "assistant") return "ai";
    if (typeof raw.role === "string" && raw.role.toLowerCase().includes("user")) return "user";
    return index % 2 === 0 ? "user" : "ai";
  }

  function normalizeMessage(raw, index = 0) {
    if (!raw || typeof raw !== "object") return null;
    const role = inferRole(raw, index);
    const textHtml = String(raw.textHtml ?? raw.html ?? raw.text ?? raw.content ?? "");
    if (!textHtml && !raw.chartMeta) return null;
    const msg = {
      id: raw.id || raw.msgId || ("msg_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6)),
      role,
      at: typeof raw.at === "number" ? raw.at : Date.now(),
      textHtml,
      metaHtml: raw.metaHtml ?? null,
      chartMeta: null,
      question: raw.question ?? null,
      sql: raw.sql ?? null,
      importMeta: raw.importMeta ?? null,
      actionCard: raw.actionCard ?? null
    };
    if (raw.chartMeta?.config) {
      const config = sanitizeChartConfig(raw.chartMeta.config);
      if (config) msg.chartMeta = { title: raw.chartMeta.title || "Chart", config };
    }
    return msg;
  }

  function normalizeSession(raw) {
    if (!raw || typeof raw !== "object") return null;
    const messages = (raw.messages || [])
      .map((m, i) => normalizeMessage(m, i))
      .filter(Boolean)
      .slice(-MAX_MESSAGES);
    return {
      version: STORAGE_VERSION,
      updatedAt: raw.updatedAt || Date.now(),
      hasConversation: !!raw.hasConversation || messages.length > 0,
      chartCounter: typeof raw.chartCounter === "number" ? raw.chartCounter : (raw.msgCounter || 0),
      lang: raw.lang === "ur" ? "ur" : "en",
      flow: raw.flow && typeof raw.flow === "object" ? raw.flow : null,
      imports: Array.isArray(raw.imports) ? raw.imports.slice(-20) : [],
      messages
    };
  }

  function migrateLegacySession(raw) {
    if (!raw?.messages?.length) return null;
    const messages = raw.messages.map((m, i) => normalizeMessage({
      id: m.id || m.msgId,
      role: m.role,
      at: m.at || raw.at || raw.updatedAt || Date.now(),
      textHtml: m.textHtml || m.html || m.text || "",
      chartMeta: m.chartMeta,
      metaHtml: m.metaHtml || null,
      question: m.question || null,
      sql: m.sql || null,
      importMeta: m.importMeta || null,
      actionCard: m.actionCard || null
    }, i)).filter(Boolean);
    if (!messages.length) return null;
    return normalizeSession({
      version: STORAGE_VERSION,
      updatedAt: raw.updatedAt || raw.at || Date.now(),
      hasConversation: raw.hasConversation ?? true,
      chartCounter: raw.chartCounter || raw.msgCounter || 0,
      messages,
      lang: raw.lang || "en",
      flow: raw.flow || null,
      imports: raw.imports || []
    });
  }

  const LEGACY_KEYS = [
    "fin_assistant_sidebar_v2",
    "fin_assistant_chat",
    "fin_assistant_sidebar",
    "fin_assistant_recent"
  ];

  function readRawKey(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("[ChatPersist] Corrupt entry for", key, e.message);
      return null;
    }
  }

  function tryMigrateLegacy(preferredKey) {
    for (const key of LEGACY_KEYS) {
      const parsed = readRawKey(key);
      if (!parsed) {
        try {
          const ss = sessionStorage.getItem(key);
          if (ss) {
            const fromSession = JSON.parse(ss);
            const migrated = migrateLegacySession(fromSession);
            if (migrated?.messages?.length) {
              save(preferredKey, migrated, { allowEmpty: true });
              sessionStorage.removeItem(key);
              return migrated;
            }
          }
        } catch (e) { /* ignore */ }
        continue;
      }
      const migrated = parsed.version === STORAGE_VERSION
        ? normalizeSession(parsed)
        : migrateLegacySession(parsed);
      if (migrated?.messages?.length) {
        save(preferredKey, migrated, { allowEmpty: true });
        try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
        return migrated;
      }
    }
    return null;
  }

  function load(storageKey) {
    storageKey = storageKey || PRIMARY_KEY;

    const parsed = storageGet(storageKey) || readRawKey(storageKey);
    if (parsed) {
      let session = parsed.version === STORAGE_VERSION
        ? normalizeSession(parsed)
        : migrateLegacySession(parsed);
      if (!session?.messages?.length && parsed.messages?.length) {
        session = migrateLegacySession(parsed);
      }
      if (session?.messages?.length) {
        if (parsed.version !== STORAGE_VERSION) save(storageKey, session, { allowEmpty: true });
        return session;
      }
    }

    const migrated = tryMigrateLegacy(storageKey);
    if (migrated?.messages?.length) return migrated;

    try {
      const backup = sessionStorage.getItem(storageKey + "_backup")
        || sessionStorage.getItem(PRIMARY_KEY + "_backup");
      if (backup) {
        const backupParsed = JSON.parse(backup);
        const session = backupParsed.version === STORAGE_VERSION
          ? normalizeSession(backupParsed)
          : migrateLegacySession(backupParsed);
        if (session?.messages?.length) {
          save(storageKey, session, { allowEmpty: true });
          return session;
        }
      }
    } catch (e) { /* ignore */ }

    return null;
  }

  function save(storageKey, session, opts = {}) {
    if (!storageKey || !session) return false;
    const allowEmpty = !!opts.allowEmpty;

    const payload = normalizeSession({
      ...session,
      version: STORAGE_VERSION,
      updatedAt: Date.now()
    });
    if (!payload) return false;

    if (!payload.messages.length && !allowEmpty) {
      const existing = storageGet(storageKey) || readRawKey(storageKey);
      if (existing?.messages?.length) return false;
    }

    let ok = storageSet(storageKey, payload);
    if (ok) {
      try { sessionStorage.removeItem(storageKey + "_backup"); } catch (e) { /* ignore */ }
      return true;
    }

    if (payload.messages.length) {
      payload.messages = payload.messages.slice(-Math.floor(MAX_MESSAGES / 2));
      payload.messages = payload.messages.map(m => ({
        ...m,
        chartMeta: m.chartMeta ? { title: m.chartMeta.title, config: sanitizeChartConfig(m.chartMeta.config) } : null
      }));
      ok = storageSet(storageKey, payload);
      if (ok) return true;
      const lean = { ...payload, messages: payload.messages.map(m => ({ ...m, chartMeta: null })) };
      ok = storageSet(storageKey, lean);
      if (ok) return true;
      try {
        sessionStorage.setItem(storageKey + "_backup", JSON.stringify(lean));
      } catch (e) { /* ignore */ }
    }
    return false;
  }

  function appendMessage(storageKey, record, sessionMeta = {}) {
    const session = load(storageKey) || emptySession();
    if (!session.messages.some(m => m.id === record.id)) {
      session.messages.push(record);
    }
    session.hasConversation = true;
    session.chartCounter = sessionMeta.chartCounter ?? session.chartCounter;
    session.lang = sessionMeta.lang ?? session.lang;
    session.flow = sessionMeta.flow ?? session.flow;
    session.messages = session.messages.slice(-MAX_MESSAGES);
    if (!save(storageKey, session)) {
      save(storageKey, {
        ...session,
        messages: session.messages.map(m => ({ ...m, chartMeta: null }))
      });
    }
    return session;
  }

  function emptySession() {
    return normalizeSession({
      version: STORAGE_VERSION,
      updatedAt: Date.now(),
      hasConversation: false,
      chartCounter: 0,
      lang: "en",
      flow: null,
      imports: [],
      messages: []
    });
  }

  window.ChatPersist = {
    VERSION: STORAGE_VERSION,
    MAX_MESSAGES,
    PRIMARY_KEY,
    load,
    save,
    appendMessage,
    emptySession,
    sanitizeChartConfig,
    normalizeMessage,
    normalizeSession
  };
})();
