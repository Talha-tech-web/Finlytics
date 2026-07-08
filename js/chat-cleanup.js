/* Finlytics — reusable Assistant chat history cleanup */
(function () {
  const LOCAL_KEYS = [
    "fin_assistant_chat_v2",
    "fin_assistant_sidebar_v2",
    "fin_assistant_chat",
    "fin_assistant_sidebar",
    "fin_assistant_recent",
    "fin_chat_history"
  ];

  function getMessageCount() {
    if (window.ChatPersist) {
      const session = ChatPersist.load(ChatPersist.PRIMARY_KEY);
      return session?.messages?.length || 0;
    }
    try {
      const raw = localStorage.getItem("fin_assistant_chat_v2");
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.messages) ? parsed.messages.length : 0;
    } catch (e) {
      return 0;
    }
  }

  function clearAllChatHistory() {
    let keysRemoved = 0;

    LOCAL_KEYS.forEach((key) => {
      try {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          keysRemoved += 1;
        }
      } catch (e) { /* ignore */ }
      try {
        if (sessionStorage.getItem(key) !== null) {
          sessionStorage.removeItem(key);
          keysRemoved += 1;
        }
        sessionStorage.removeItem(key + "_backup");
      } catch (e) { /* ignore */ }
    });

    if (window.ChatPersist) {
      ChatPersist.save(ChatPersist.PRIMARY_KEY, ChatPersist.emptySession(), { allowEmpty: true });
    }

    try {
      window.dispatchEvent(new CustomEvent("finlytics:chat-cleared"));
    } catch (e) { /* ignore */ }

    if (window.Assistant && typeof Assistant.resetConversationUI === "function") {
      Assistant.resetConversationUI();
    }

    return { success: true, keysRemoved, messageCount: 0 };
  }

  window.ChatCleanup = {
    LOCAL_KEYS,
    getMessageCount,
    clearAllChatHistory
  };

  window.clearAllChatHistory = clearAllChatHistory;
})();
