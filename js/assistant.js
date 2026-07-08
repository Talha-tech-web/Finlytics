/* Finlytics — Voice Assistant */
(function () {
  const CURRENCY =
    (window.FINLYTICS_CONFIG && window.FINLYTICS_CONFIG.CURRENCY) || "Rs";

  function fmt(n) {
    const v = Math.round(Number(n) || 0);
    return CURRENCY + " " + v.toLocaleString("en-IN");
  }

  // questions
  const QUICK_QUESTIONS = [
    { en: "Why losing money?", ur: "پیسے کیوں کھو رہا ہوں؟" },
    { en: "Spending by category", ur: "زمرہ کے حساب سے اخراجات" },
    { en: "Budget this month?", ur: "اس مہینے کا بجٹ؟" },
    { en: "Compare months", ur: "مہینوں کا موازنہ" },
    { en: "Net worth?", ur: "کل مالیت؟" },
    { en: "Recent transactions", ur: "حالیہ ٹرانزیکشنز" },
    { en: "Spent this month?", ur: "اس مہینے کا خرچ؟" },
    { en: "Income this month?", ur: "اس مہینے کی آمدنی؟" },
    { en: "Income vs expenses", ur: "آمدنی بمقابلہ اخراجات" },
    { en: "Biggest expense?", ur: "سب سے بڑا خرچ؟" },
  ];
  const CHIPS_PER_ROW = 5;

  // Persistent chat: localStorage via ChatPersist (survives refresh & browser restart).
  const PERSIST_KEY = "fin_assistant_chat_v2";
  const PERSIST_KEY_SIDEBAR = "fin_assistant_chat_v2"; // unified history across page + sidebar
  const PERSIST_DEBOUNCE_MS = 400;

  const NORMALIZED_QUICK_QUESTIONS_MAP = {
    "why losing money": "Why am I losing money?",
    "why am i losing money": "Why am I losing money?",
    "spending by category": "Break down my spending by category",
    "break down my spending by category": "Break down my spending by category",
    "budget this month": "How is my budget looking this month?",
    "how is my budget looking this month":
      "How is my budget looking this month?",
    "how is my budget doing": "How is my budget looking this month?",
    "compare months": "Compare this month vs last month",
    "compare this month vs last month": "Compare this month vs last month",
    "net worth": "What's my net worth?",
    "what's my net worth": "What's my net worth?",
    "recent transactions": "Show my recent transactions",
    "show my recent transactions": "Show my recent transactions",
    "spent this month": "How much did I spend this month?",
    "how much did i spend this month": "How much did I spend this month?",
    "income this month": "How much income this month?",
    "how much income this month": "How much income this month?",
    "income vs expenses": "Show income vs expenses",
    "show income vs expenses": "Show income vs expenses",
    "biggest expense": "What's my biggest expense?",
    "what's my biggest expense": "What's my biggest expense?",
    "show expenses by category": "Break down my spending by category",
    "analyze my spending": "Break down my spending by category",
    "پیسے کیوں کھو رہا ہوں": "Why am I losing money?",
    "زمرہ کے حساب سے اخراجات": "Break down my spending by category",
    "اس مہینے کا بجٹ": "How is my budget looking this month?",
    "مہینوں کا موازنہ": "Compare this month vs last month",
    "کل مالیت": "What's my net worth?",
    "حالیہ ٹرانزیکشنز": "Show my recent transactions",
    "اس مہینے کا خرچ": "How much did I spend this month?",
    "اس مہینے کی آمدنی": "How much income this month?",
    "آمدنی بمقابلہ اخراجات": "Show income vs expenses",
    "سب سے بڑا خرچ": "What's my biggest expense?",
  };

  //DOM refs (assigned on init)
  let els = {};
  let persistKey = PERSIST_KEY;
  let chartCounter = 0;
  let persistTimer = null;
  let chatSession = null;
  let state = {
    lang: "en",
    listening: false,
    lastIntent: null,
    flow: null,
    hasConversation: false,
  };

  function msgUid() {
    return (
      "msg_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 7)
    );
  }

  function ensureChatSession() {
    if (!chatSession) {
      const loaded = window.ChatPersist ? ChatPersist.load(persistKey) : null;
      if (loaded?.messages?.length) {
        chatSession = loaded;
      } else if (window.ChatPersist) {
        chatSession = ChatPersist.emptySession();
      } else {
        chatSession = {
          version: 2,
          messages: [],
          chartCounter: 0,
          hasConversation: false,
          lang: "en",
          flow: null,
          imports: [],
        };
      }
    }
    return chatSession;
  }

  function chatMessageCount() {
    if (chatSession?.messages?.length) return chatSession.messages.length;
    if (window.ChatPersist) {
      const loaded = ChatPersist.load(persistKey);
      if (loaded?.messages?.length) return loaded.messages.length;
    }
    if (!els.scroll) return 0;
    return els.scroll.querySelectorAll(".msg:not(#typing-indicator)").length;
  }

  function isEmptyChat() {
    return chatMessageCount() === 0;
  }

  function syncChatChrome() {
    const hasMessages = !isEmptyChat();
    state.hasConversation = hasMessages;

    document
      .getElementById("assistantShell")
      ?.classList.toggle("conversating", hasMessages);
    document
      .getElementById("sidebarShell")
      ?.classList.toggle("conversating", hasMessages);

    if (hasMessages) {
      document.getElementById("chatWelcome")?.remove();
      document.getElementById("sidebarWelcome")?.remove();
    } else {
      const isSidebar = !!document.getElementById("sidebarShell");
      if (
        els.scroll &&
        !document.getElementById("chatWelcome") &&
        !document.getElementById("sidebarWelcome")
      ) {
        els.scroll.insertAdjacentHTML("afterbegin", welcomeHtml(isSidebar));
      }
    }
    renderChips();
  }

  function commitMessage(record) {
    if (!window.ChatPersist) {
      ensureChatSession().messages.push(record);
      syncChatChrome();
      return;
    }
    chatSession = ChatPersist.appendMessage(persistKey, record, {
      chartCounter,
      lang: state.lang,
      flow: state.flow,
    });
    syncChatChrome();
  }

  function applyConversationUI() {
    syncChatChrome();
  }

  function welcomeHtml(forSidebar) {
    const text = greetingText(state.lang);
    return `
      <div class="chat-welcome" id="${forSidebar ? "sidebarWelcome" : "chatWelcome"}">
        <div class="chat-welcome-icon">F</div>
        <h2 class="chat-welcome-title">Finlytics Assistant</h2>
        <p class="chat-welcome-text" data-greeting-text>${text}</p>
      </div>`;
  }

  function resetConversationUI() {
    chatSession = null;
    state.flow = null;
    chartCounter = 0;

    if (els.scroll) {
      els.scroll.querySelectorAll(".msg").forEach((n) => n.remove());
    }

    syncChatChrome();
  }

  function schedulePersist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(flushPersist, 300);
  }

  function persistNow() {
    clearTimeout(persistTimer);
    flushPersist();
  }

  function loadPersistedSession() {
    if (!window.ChatPersist) return null;
    return ChatPersist.load(persistKey);
  }

  function flushPersist() {
    if (!window.ChatPersist) return;
    if (!chatSession?.messages?.length) return;

    const session = {
      ...chatSession,
      hasConversation: true,
      chartCounter,
      lang: state.lang,
      flow: state.flow,
      updatedAt: Date.now(),
      messages: chatSession.messages.slice(-ChatPersist.MAX_MESSAGES),
    };
    chatSession = session;

    let ok = ChatPersist.save(persistKey, session);
    if (!ok) {
      ChatPersist.save(persistKey, {
        ...session,
        messages: session.messages.map((m) => ({ ...m, chartMeta: null })),
      });
    }
  }

  function userInitial() {
    return document.querySelector("[data-user-initial]")?.textContent || "U";
  }

  function bindSaveReportButton(wrap, record) {
    if (!record.question || record.role !== "ai") return;
    const btn = wrap.querySelector("[data-save-report]");
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      Store.add("reports", {
        title: record.question.slice(0, 60),
        question: record.question,
        sql_text: record.sql || "",
      });
      e.target.textContent = "Saved";
      e.target.disabled = true;
    });
  }

  function appendMessageDom(record, opts = {}) {
    if (!els.scroll || !record) return null;
    const wrap = document.createElement("div");
    wrap.className = "msg " + record.role;
    wrap.dataset.msgId = record.id;
    const metaInner =
      record.metaHtml ||
      (record.role === "ai"
        ? `${new Date(record.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · AI Assistant`
        : `${new Date(record.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    wrap.innerHTML = `
      <div class="msg-avatar">${record.role === "ai" ? "F" : userInitial()}</div>
      <div class="msg-body">
        <div class="msg-bubble">${record.textHtml || ""}</div>
        <div class="msg-meta">${metaInner}</div>
      </div>`;
    bindSaveReportButton(wrap, record);
    els.scroll.appendChild(wrap);
    if (record.chartMeta?.config) {
      chartCounter += 1;
      mountChartInBubble(
        wrap.querySelector(".msg-bubble"),
        record.chartMeta.config,
        "chat-chart-" + chartCounter,
        record.chartMeta.title,
      );
    }
    if (!opts.skipScroll) scrollToBottom();
    return wrap;
  }

  function hydrateChat() {
    if (!els.scroll) return false;
    if (!window.ChatPersist) {
      console.warn(
        "[Assistant] ChatPersist not loaded — chat history will not restore.",
      );
      return false;
    }

    const loaded = loadPersistedSession();
    if (!loaded?.messages?.length) {
      chatSession = null;
      return false;
    }

    chatSession = loaded;
    chartCounter = loaded.chartCounter || 0;
    state.flow = loaded.flow || null;
    if (loaded.lang) state.lang = loaded.lang;

    els.scroll.querySelectorAll(".msg").forEach((n) => n.remove());
    loaded.messages.forEach((rec) =>
      appendMessageDom(rec, { skipScroll: true }),
    );
    syncChatChrome();
    setLang(loaded.lang || state.lang);
    scrollToBottom();
    return true;
  }

  function greetingText(lang) {
    return lang === "ur"
      ? "سلام، میں آپ کا Finlytics Assistant ہوں۔ اپنے finances، spending، goals، budgets، یا transactions کے بارے میں کچھ بھی پوچھیں۔"
      : "Hi, I'm your Finlytics Assistant. Ask me anything about your finances, spending, goals, budgets, or transactions.";
  }

  function scrollToBottom() {
    if (!els.scroll) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        els.scroll.scrollTop = els.scroll.scrollHeight;
      });
    });
  }

  function startConversation() {
    document.getElementById("assistantShell")?.classList.add("conversating");
    document.getElementById("sidebarShell")?.classList.add("conversating");
    document.getElementById("chatWelcome")?.remove();
    document.getElementById("sidebarWelcome")?.remove();
  }

  function renderInlineChart(canvas, config) {
    if (!canvas || !config || typeof Chart === "undefined") return null;
    try {
      return new Chart(
        canvas.getContext("2d"),
        JSON.parse(JSON.stringify(config)),
      );
    } catch (e) {
      return null;
    }
  }

  function mountChartInBubble(bubble, config, chartId, title) {
    if (!config || !bubble) return;
    bubble.dataset.chartTitle = title || "Chart";
    try {
      bubble.dataset.chartConfig = JSON.stringify(config);
    } catch (e) {
      /* skip */
    }
    const block = document.createElement("div");
    block.className = "result-chart-inline";
    block.innerHTML = `<div class="chart-inline-title">${escapeHtml(title || "Chart")}</div><div class="result-chart-wrap"><canvas id="${chartId}"></canvas></div>`;
    bubble.appendChild(block);
    renderInlineChart(block.querySelector("canvas"), config);
  }

  function inferChartTitle(question, result) {
    if (!result?.chart) return "";
    const q = (question || "").toLowerCase();
    if (/category|breakdown|spending by/.test(q)) return "Spending by Category";
    if (/trend|income vs expense|vs expense/.test(q))
      return "Income vs Expense Trend";
    if (/compare|vs last month/.test(q)) return "Month-over-Month Comparison";
    if (/net worth/.test(q)) return "Net Worth Trend";
    if (/budget/.test(q)) return "Budget Overview";
    if (/goal|savings/.test(q)) return "Savings Goals";
    if (/losing money|analyze/.test(q)) return "Spending Analysis";
    return "Financial Chart";
  }

  async function streamHtml(el, html) {
    const plain = stripHtml(html);
    const parts = plain.split(/(\s+)/);
    el.textContent = "";
    for (let i = 0; i < parts.length; i++) {
      el.textContent += parts[i];
      if (i % 2 === 0) await new Promise((r) => setTimeout(r, 14));
    }
    el.innerHTML = html;
  }

  function addMessage(role, html, meta) {
    startConversation();
    const record = {
      id: msgUid(),
      role,
      at: Date.now(),
      textHtml: html,
      metaHtml: meta || null,
      chartMeta: null,
      question: null,
      sql: null,
      importMeta: null,
    };
    appendMessageDom(record);
    commitMessage(record);
    return record;
  }

  function addTyping() {
    startConversation();
    const wrap = document.createElement("div");
    wrap.className = "msg ai";
    wrap.id = "typing-indicator";
    wrap.innerHTML = `
      <div class="msg-avatar">F</div>
      <div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
    els.scroll.appendChild(wrap);
  }
  function removeTyping() {
    const t = document.getElementById("typing-indicator");
    if (t) t.remove();
  }

  async function renderAiResult(result, question) {
    startConversation();
    chartCounter += 1;
    const chartId = "chat-chart-" + chartCounter;
    const chartTitle = inferChartTitle(question || result.question, result);
    const tableHtml = result.table ? buildTableHtml(result.table) : "";
    const chartMeta =
      result.chart && window.ChatPersist
        ? {
            title: chartTitle,
            config: ChatPersist.sanitizeChartConfig(result.chart),
          }
        : result.chart
          ? {
              title: chartTitle,
              config: JSON.parse(JSON.stringify(result.chart)),
            }
          : null;

    const wrap = document.createElement("div");
    wrap.className = "msg ai";
    wrap.innerHTML = `
      <div class="msg-avatar">F</div>
      <div class="msg-body">
        <div class="msg-bubble">
          ${result.actionCard ? buildActionCardHtml(result.actionCard) : ""}
          <div class="msg-text" data-msg-text></div>
          ${tableHtml}
        </div>
        <div class="msg-meta">
          ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · AI Assistant
          ${result.question ? `<button class="btn btn-sm" data-save-report style="margin-left:8px;padding:2px 10px">Save report</button>` : ""}
        </div>
      </div>`;
    if (result.question) {
      const meta = wrap.querySelector(".msg-meta");
      if (meta && !wrap.querySelector("[data-save-report]")) {
        meta.innerHTML += ` <button class="btn btn-sm" data-save-report style="margin-left:8px;padding:2px 10px">Save report</button>`;
      }
      bindSaveReportButton(wrap, {
        role: "ai",
        question: result.question,
        sql: result.sql || null,
      });
    }
    els.scroll.appendChild(wrap);

    const textEl = wrap.querySelector("[data-msg-text]");
    if (textEl) await streamHtml(textEl, result.reply);

    const bubble = wrap.querySelector(".msg-bubble");
    const textHtml = bubble.innerHTML;

    if (chartMeta?.config) {
      mountChartInBubble(bubble, chartMeta.config, chartId, chartMeta.title);
    }

    const metaEl = wrap.querySelector(".msg-meta");
    const record = {
      id: msgUid(),
      role: "ai",
      at: Date.now(),
      textHtml,
      metaHtml: metaEl ? metaEl.innerHTML : null,
      chartMeta: chartMeta?.config ? chartMeta : null,
      question: result.question || null,
      sql: result.sql || null,
      importMeta: result.importMeta || null,
      actionCard: result.actionCard || null,
    };
    wrap.dataset.msgId = record.id;
    commitMessage(record);
    scrollToBottom();
  }

  function buildTableHtml(t) {
    const head = t.columns.map((c) => `<th>${c}</th>`).join("");
    const rows = t.rows
      .map(
        (r) =>
          `<tr>${r.map((c, i) => `<td${t.numericCols && t.numericCols.includes(i) ? ' class="amount-cell"' : ""}>${c}</td>`).join("")}</tr>`,
      )
      .join("");
    return `<div class="result-table"><div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  function buildActionCardHtml(card) {
    if (!card) return "";
    const rows = (card.fields || [])
      .map(
        (f) =>
          `<div class="action-card-row"><span class="action-card-label">${escapeHtml(f.label)}</span><span class="action-card-value">${escapeHtml(String(f.value))}</span></div>`,
      )
      .join("");
    return `<div class="action-card ${card.variant || "success"}"><div class="action-card-title">${escapeHtml(card.title)}</div>${rows}</div>`;
  }

  function actionCardForEntity(action, entity, data) {
    const today = new Date().toLocaleDateString();
    if (entity === "transaction") {
      const amt = Math.abs(Number(data.amount || 0));
      return {
        title:
          action === "delete"
            ? "Transaction Deleted"
            : action === "edit"
              ? "Transaction Updated"
              : "Transaction Added",
        variant: action === "delete" ? "danger" : "success",
        fields: [
          { label: "Amount", value: fmt(amt) },
          { label: "Category", value: data.category || "—" },
          { label: "Account", value: data.account_name || "—" },
          { label: "Date", value: data.date || today },
        ],
      };
    }
    if (entity === "budget") {
      return {
        title:
          action === "delete"
            ? "Budget Deleted"
            : action === "edit"
              ? "Budget Updated"
              : "Budget Created",
        variant: action === "delete" ? "danger" : "success",
        fields: [
          { label: "Category", value: data.category || "—" },
          { label: "Monthly limit", value: fmt(data.monthly_limit || 0) },
        ],
      };
    }
    if (entity === "goal") {
      return {
        title:
          action === "delete"
            ? "Goal Deleted"
            : action === "edit"
              ? "Goal Updated"
              : "Goal Created",
        variant: action === "delete" ? "danger" : "success",
        fields: [
          { label: "Goal", value: data.name || "—" },
          { label: "Target", value: fmt(data.target_amount || 0) },
          { label: "Saved", value: fmt(data.saved_amount || 0) },
        ],
      };
    }
    if (entity === "account") {
      return {
        title:
          action === "delete"
            ? "Account Deleted"
            : action === "edit"
              ? "Account Updated"
              : "Account Created",
        variant: action === "delete" ? "danger" : "success",
        fields: [
          { label: "Account", value: data.name || "—" },
          { label: "Type", value: data.type || "—" },
          { label: "Balance", value: fmt(data.balance || 0) },
        ],
      };
    }
    if (entity === "transfer") {
      return {
        title: "Transfer Complete",
        variant: "success",
        fields: [
          { label: "Amount", value: fmt(data.amount || 0) },
          { label: "From", value: data.from || "—" },
          { label: "To", value: data.to || "—" },
        ],
      };
    }
    return null;
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[m],
    );
  }

  // ---------------- Local rule-based finance engine ----------------
  function monthLabelFull(ym, lang = "en") {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString(
      lang === "ur" ? "ur-PK" : "en",
      { month: "long", year: "numeric" },
    );
  }

  function txnsInMonth(ym) {
    return Store.list("txns").filter((t) => Store.monthKey(t.date) === ym);
  }

  function categoryChartConfig(rows) {
    const p = ChartTheme.palette();
    return {
      type: "doughnut",
      data: {
        labels: rows.map((r) => r.category),
        datasets: [
          {
            data: rows.map((r) => r.total),
            backgroundColor: p.categorySet,
            borderWidth: 0,
          },
        ],
      },
      options: ChartTheme.baseOptions({
        type: "doughnut",
        cutout: "62%",
        scales: {},
      }),
    };
  }

  function trendChartConfig(series) {
    const p = ChartTheme.palette();
    return {
      type: "line",
      data: {
        labels: series.map((s) => s.label),
        datasets: [
          {
            label: "Income",
            data: series.map((s) => s.income),
            borderColor: p.positive,
            backgroundColor: p.positive + "33",
            fill: true,
            tension: 0.35,
          },
          {
            label: "Expense",
            data: series.map((s) => s.expense),
            borderColor: p.negative,
            backgroundColor: p.negative + "22",
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: ChartTheme.baseOptions(),
    };
  }

  function barCompareConfig(labels, aVals, bVals, aLabel, bLabel) {
    const p = ChartTheme.palette();
    return {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: aLabel,
            data: aVals,
            backgroundColor: p.inkDim,
            borderRadius: 6,
          },
          {
            label: bLabel,
            data: bVals,
            backgroundColor: p.accent,
            borderRadius: 6,
          },
        ],
      },
      options: ChartTheme.baseOptions(),
    };
  }

  /**
   * Find a stored entity (goal/budget/transaction/account) whose name or category
   * appears in the user's text. Returns {id, name} or null if not found.
   * Used by edit/delete CRUD rules to pre-load the target item.
   */
  function findEntityForText(entityType, text) {
    const storeKey = entityType === "transaction" ? "txns" : entityType + "s";
    const list = Store.list(storeKey) || [];
    const lower = text.toLowerCase();
    // Try name match
    const byName = list.find(
      (item) =>
        (item.name && lower.includes(item.name.toLowerCase())) ||
        (item.category && lower.includes(item.category.toLowerCase())) ||
        (item.description && lower.includes(item.description.toLowerCase())),
    );
    if (byName) return byName;
    // Try numeric ID embedded in text
    const idMatch = lower.match(/\b(\d+)\b/);
    if (idMatch) {
      const id = parseInt(idMatch[1], 10);
      return list.find((item) => item.id === id) || null;
    }
    // If only one item exists, use it by default
    if (list.length === 1) return list[0];
    return null;
  }

  // Each rule: {test(text) -> bool, run(text) -> result}
  function buildRules(useLang = "en") {
    const months = Store.lastNMonths(6);
    const thisYm = months[months.length - 1];
    const lastYm = months[months.length - 2];

    const rules = [
      // 0. Conversational CRUD Triggers
      {
        test: (t) =>
          /(add|create|new|set up|set)\b.{0,20}\b(budget|goal|transaction|expense|income|account)/i.test(
            t,
          ) ||
          /(budget|goal|transaction|expense|income|account)\b.{0,20}\b(add|create|new|set up)/i.test(
            t,
          ),
        run: (text) => {
          const m =
            text.match(
              /(add|create|new|set up|set)\b.{0,20}\b(budget|goal|transaction|expense|income|account)/i,
            ) ||
            text.match(
              /(budget|goal|transaction|expense|income|account)\b.{0,20}\b(add|create|new|set up)/i,
            );
          let e = m ? (m[2] || m[1]).toLowerCase() : "goal";
          if (e === "expense" || e === "income") e = "transaction";
          if (["set", "set up", "new", "add", "create"].includes(e)) e = "goal";
          return startFlow(
            "create",
            e,
            e === "transaction" ? { type: "expense" } : {},
          );
        },
      },
      {
        test: (t) =>
          /(edit|change|update|modify)\b.{0,30}\b(budget|goal|transaction|account)/i.test(
            t,
          ),
        run: (text) => {
          const m = text.match(
            /(edit|change|update|modify)\b.{0,30}\b(budget|goal|transaction|account)/i,
          );
          const e = m ? m[2].toLowerCase() : "goal";
          const item = findEntityForText(e, text);
          if (!item)
            return {
              reply: `I don't see any ${e} named that. Please specify the name.`,
              local: true,
            };
          return startFlow("edit", e, { id: item.id, ...item });
        },
      },
      {
        test: (t) =>
          /(delete|remove|clear)\b.{0,30}\b(budget|goal|account|transaction)/i.test(
            t,
          ),
        run: (text) => {
          const m = text.match(
            /(delete|remove|clear)\b.{0,30}\b(budget|goal|account|transaction)/i,
          );
          const e = m ? m[2].toLowerCase() : "goal";
          const item = findEntityForText(e, text);
          if (!item)
            return {
              reply: `I don't see any ${e} matching that. Please specify the name.`,
              local: true,
            };
          return startFlow("delete", e, { id: item.id, ...item });
        },
      },
      {
        test: (t) => /\btransfer\b|\bfrom\b.{0,30}\bto\b.{0,30}\d/i.test(t),
        run: (text) => {
          const xfer = AssistantNLU.parseTransfer(text);
          if (!xfer)
            return {
              reply:
                useLang === "ur"
                  ? "براہ کرم رقم، ماخذ اور منزل اکاؤنٹ بتائیں۔"
                  : 'Please specify amount and both accounts, e.g. "Transfer 5000 from Main Bank to Savings Vault".',
              local: true,
            };
          try {
            Store.transferBetweenAccounts(xfer.from, xfer.to, xfer.amount);
            return {
              reply:
                useLang === "ur"
                  ? `${fmt(xfer.amount)} ${xfer.from} سے ${xfer.to} منتقل ہو گئے۔`
                  : `Transferred ${fmt(xfer.amount)} from ${xfer.from} to ${xfer.to}.`,
              actionCard: actionCardForEntity("create", "transfer", xfer),
              local: true,
              dataChanged: true,
              storeKey: "accounts",
            };
          } catch (e) {
            return { reply: e.message, local: true };
          }
        },
      },
      {
        test: (t) =>
          /(create|add|new|make).{0,25}budget.{0,40}\d|(budget).{0,20}(of|for).{0,20}\d/i.test(
            t,
          ),
        run: (text) => {
          const parsed = AssistantNLU.parseBudgetCreate(text);
          if (!parsed) return startFlow("create", "budget", {});
          const item = Store.add("budgets", parsed);
          return {
            reply:
              useLang === "ur"
                ? `${parsed.category} کے لیے ${fmt(parsed.monthly_limit)} کا بجٹ بن گیا۔`
                : `Created ${parsed.category} budget with ${fmt(parsed.monthly_limit)} monthly limit.`,
            actionCard: actionCardForEntity("create", "budget", item),
            local: true,
            dataChanged: true,
            storeKey: "budgets",
          };
        },
      },
      {
        test: (t) =>
          /(create|add|new|make).{0,25}(goal|saving).{0,40}\d/i.test(t),
        run: (text) => {
          const parsed = AssistantNLU.parseGoalCreate(text);
          if (!parsed) return startFlow("create", "goal", {});
          const item = Store.add("goals", { ...parsed, saved_amount: 0 });
          return {
            reply:
              useLang === "ur"
                ? `${parsed.name} کا ہدف ${fmt(parsed.target_amount)} کے ساتھ بن گیا۔`
                : `Created "${parsed.name}" goal targeting ${fmt(parsed.target_amount)}.`,
            actionCard: actionCardForEntity("create", "goal", item),
            local: true,
            dataChanged: true,
            storeKey: "goals",
          };
        },
      },
      {
        test: (t) =>
          /(change|update|edit).{0,40}\d.{0,15}(to|into)\s*\d/i.test(t),
        run: (text) => {
          const item = findEntityForText("transaction", text);
          const amounts = text.match(/[\d,]+(?:\.\d+)?/g);
          if (!item || !amounts || amounts.length < 1) return null;
          const newAmt = parseFloat(
            amounts[amounts.length - 1].replace(/,/g, ""),
          );
          const signed =
            item.amount >= 0 ? Math.abs(newAmt) : -Math.abs(newAmt);
          const updated = Store.updateTransaction(item.id, {
            amount: signed,
            category: item.category,
          });
          return {
            reply:
              useLang === "ur"
                ? `${item.description || item.category} کی رقم ${fmt(Math.abs(signed))} کر دی گئی۔`
                : `Updated ${item.description || item.category} to ${fmt(Math.abs(signed))}.`,
            actionCard: actionCardForEntity("edit", "transaction", updated),
            local: true,
            dataChanged: true,
            storeKey: "txns",
          };
        },
      },
      {
        test: (t) =>
          /\bwallet details\b|\bshow my wallet\b|\bmeri saving\b|\bbachat kitni\b|\bhow much money left\b|\bremaining balance\b/i.test(
            t,
          ),
        run: () => {
          const accs = Store.list("accounts");
          const total = Store.accountsTotal();
          const s = Store.summary(1);
          const reply =
            useLang === "ur"
              ? `آپ کے ${accs.length} اکاؤنٹس میں کل ${fmt(total)} ہیں۔ اس مہینے بچت ${fmt(s.income - s.expense)} ہے۔`
              : `Wallet total across ${accs.length} accounts: ${fmt(total)}. Remaining this month after expenses: ${fmt(s.income - s.expense)}.`;
          return {
            reply,
            table: {
              columns:
                useLang === "ur"
                  ? ["اکاؤنٹ", "قسم", "بیلنس"]
                  : ["Account", "Type", "Balance"],
              numericCols: [2],
              rows: accs.map((a) => [a.name, a.type, fmt(a.balance)]),
            },
            local: true,
          };
        },
      },
      {
        test: (t) =>
          /\bremaining budget\b|\bbudget.*remaining\b|\bhow much.*budget.*left\b|\bexceeding\b|\bover budget\b/i.test(
            t,
          ),
        run: () => {
          const b = Store.budgetRemaining();
          const rows = (Array.isArray(b) ? b : [b]).filter(Boolean).map((x) => {
            const left = x.monthly_limit - x.spent;
            return [
              x.category,
              fmt(x.spent),
              fmt(x.monthly_limit),
              fmt(Math.max(0, left)),
              Math.round(x.pct) + "%",
            ];
          });
          const over = rows.filter(
            (r) =>
              parseFloat(String(r[3]).replace(/[^\d.-]/g, "")) === 0 &&
              parseFloat(String(r[1]).replace(/[^\d.-]/g, "")) >
                parseFloat(String(r[2]).replace(/[^\d.-]/g, "")),
          );
          const reply =
            useLang === "ur"
              ? `${rows.length} بجٹ زمرے۔ ${over.length ? over.length + " حد سے زیادہ ہیں۔" : "آپ حد کے اندر ہیں۔"}`
              : `${rows.length} budget categories tracked. ${over.length ? over.length + " over limit." : "You're within limits."}`;
          return {
            reply,
            table: {
              columns:
                useLang === "ur"
                  ? ["زمرہ", "خرچ", "حد", "باقی", "استعمال"]
                  : ["Category", "Spent", "Limit", "Remaining", "Used"],
              numericCols: [1, 2, 3],
              rows,
            },
            local: true,
          };
        },
      },
      {
        test: (t) =>
          /\blast\s+\d+\s+transaction|\brecent\s+\d+\s+transaction/i.test(t),
        run: (text) => {
          const limit = AssistantNLU.extractLimitCount(text) || 10;
          const rows = Store.list("txns").slice(0, limit);
          return {
            reply:
              useLang === "ur"
                ? `آپ کی ${rows.length} حالیہ ٹرانزیکشنز:`
                : `Here are your last ${rows.length} transactions.`,
            table: {
              columns:
                useLang === "ur"
                  ? ["تاریخ", "تفصیل", "زمرہ", "رقم"]
                  : ["Date", "Description", "Category", "Amount"],
              numericCols: [3],
              rows: rows.map((r) => [
                r.date,
                r.description,
                r.category,
                fmt(r.amount),
              ]),
            },
            local: true,
          };
        },
      },
      {
        test: (t) =>
          /\b(search|find|filter).*(transaction|txn|expense)/i.test(t),
        run: (text) => {
          const q = text
            .replace(
              /(search|find|filter)\s+(for\s+)?(my\s+)?(transactions?|txns?|expenses?)\s*(for|about|on)?\s*/i,
              "",
            )
            .trim();
          const rows = Store.searchTransactions(q, { limit: 15 });
          return {
            reply: rows.length
              ? `Found ${rows.length} matching transaction(s).`
              : "No transactions matched that search.",
            table: {
              columns: ["Date", "Description", "Category", "Amount"],
              numericCols: [3],
              rows: rows.map((r) => [
                r.date,
                r.description,
                r.category,
                fmt(r.amount),
              ]),
            },
            local: true,
          };
        },
      },
      {
        test: (t) =>
          /\b(generate|export|show|print).*(report|summary|statement|yearly|monthly)/i.test(
            t,
          ),
        run: (text) => {
          const months = /\byearly\b|\b12 month\b/i.test(text) ? 12 : 6;
          const s = Store.summary(months);
          const series = Store.monthlySeries(Math.min(months, 6));
          if (/\bexport\b|\bprint\b/i.test(text)) {
            printFinancialStatement(months);
          }
          Store.add("reports", {
            title: `Summary (${months}mo)`,
            question: text,
            sql_text: sqlFor("monthly_series", { months }),
          });
          return {
            reply:
              useLang === "ur"
                ? `${months} ماہ کا خلاصہ: آمدنی ${fmt(s.income)}, اخراجات ${fmt(s.expense)}, خالص ${fmt(s.net)}.${/\bexport\b|\bprint\b/i.test(text) ? " رپورٹ پرنٹ کھل گئی۔" : ""}`
                : `${months}-month summary: ${fmt(s.income)} income, ${fmt(s.expense)} expenses, net ${fmt(s.net)}.${/\bexport\b|\bprint\b/i.test(text) ? " Statement opened for print/export." : " Saved to Reports."}`,
            chart: trendChartConfig(series),
            local: true,
            dataChanged: true,
            storeKey: "reports",
          };
        },
      },
      {
        test: (t) =>
          /\bgoal progress\b|\bhow much more.*save\b|\bneed to save\b/i.test(t),
        run: (text) => {
          const goals = Store.list("goals");
          const named =
            AssistantNLU.extractEntityType(text) === "goal"
              ? Store.goalProgress(text)
              : null;
          const list = named ? [named] : goals;
          const rows = list.filter(Boolean).map((g) => {
            const left = Math.max(0, g.target_amount - g.saved_amount);
            return [
              g.name,
              fmt(g.saved_amount),
              fmt(g.target_amount),
              fmt(left),
              Math.round((g.saved_amount / g.target_amount) * 100) + "%",
            ];
          });
          return {
            reply: rows.length
              ? `Tracking ${rows.length} goal(s).`
              : "No goals found yet.",
            table: {
              columns: ["Goal", "Saved", "Target", "Remaining", "Progress"],
              numericCols: [1, 2, 3],
              rows,
            },
            local: true,
          };
        },
      },
      // 0. Greetings & Identity
      {
        test: (t) =>
          /hello|hi |^hi$|hey|hlo|how are you|who are you|your name|what is your name|who is this|salaam|assalam|kaise ho|kya haal|naam kya hai|kaun ho/.test(
            t,
          ),
        run: () => {
          const isUrdu = useLang === "ur";
          return {
            reply: isUrdu
              ? "سلام! میں Finlytics کا مالیاتی معاون ہوں۔ میں آپ کے اخراجات، بجٹ اور اہداف کا حساب رکھنے میں مدد کر سکتا ہوں۔ آپ کا کیا سوال ہے؟"
              : "Hello! I'm your Finlytics assistant. I can help you track your spending, check budgets, and analyze your finances. What would you like to know?",
            local: true,
          };
        },
      },
      // 1. Why am I losing money
      {
        test: (t) =>
          /losing money|why.*(losing|negative)|why.*money|پیسے کیوں کھو|نقصان/.test(
            t,
          ),
        run: () => {
          const s = Store.summary(1);
          const cats = Store.expensesByCategory(1).slice(0, 3);
          const losing = s.expense > s.income;

          let reply;
          if (useLang === "ur") {
            reply = losing
              ? `آپ نے اس مہینے ${fmt(s.income)} آمدنی کے مقابلے میں ${fmt(s.expense)} خرچ کیا — یعنی ${fmt(s.expense - s.income)} کا خسارہ۔ آپ کے اخراجات کی اہم وجوہات یہ ہیں: ${cats.map((c) => `${c.category} (${fmt(c.total)})`).join(", ")}۔`
              : `آپ اس مہینے فائدے میں ہیں: ${fmt(s.income)} آمدنی اور ${fmt(s.expense)} اخراجات، یعنی ${fmt(s.income - s.expense)} کی بچت۔ آپ کے بڑے اخراجات یہ ہیں: ${cats.map((c) => `${c.category} (${fmt(c.total)})`).join(", ")}۔`;
          } else {
            reply = losing
              ? `You spent ${fmt(s.expense)} against ${fmt(s.income)} income this month — a shortfall of ${fmt(s.expense - s.income)}. Your top drivers are ${cats.map((c) => `${c.category} (${fmt(c.total)})`).join(", ")}.`
              : `You're actually net positive this month: ${fmt(s.income)} in vs ${fmt(s.expense)} out, leaving ${fmt(s.income - s.expense)}. Your biggest expense categories are still ${cats.map((c) => `${c.category} (${fmt(c.total)})`).join(", ")}.`;
          }
          return {
            reply,
            table: {
              columns:
                useLang === "ur" ? ["زمرہ", "خرچ"] : ["Category", "Spent"],
              numericCols: [1],
              rows: cats.map((c) => [c.category, fmt(c.total)]),
            },
            chart: categoryChartConfig(cats),
            sql: sqlFor("expense_by_category", { months: 1 }),
            local: true,
          };
        },
      },
      // 2. income this month / total income
      {
        test: (t) =>
          /(income|earn|salary|make|made).*(this month|current month)|total income|how much did i make/.test(
            t,
          ),
        run: () => {
          const rows = txnsInMonth(thisYm).filter((t) => t.amount > 0);
          const total = rows.reduce((s, r) => s + r.amount, 0);
          const reply =
            useLang === "ur"
              ? `آپ کی کل آمدنی برائے ${monthLabelFull(thisYm, "ur")} ${fmt(total)} ہے جو کہ ${rows.length} ٹرانزیکشنز پر مشتمل ہے۔`
              : `Your total income in ${monthLabelFull(thisYm)} is ${fmt(total)} across ${rows.length} transaction(s).`;
          return {
            reply,
            table: {
              columns:
                useLang === "ur"
                  ? ["تاریخ", "تفصیل", "رقم"]
                  : ["Date", "Description", "Amount"],
              numericCols: [2],
              rows: rows.map((r) => [r.date, r.description, fmt(r.amount)]),
            },
            sql: sqlFor("income_month", { month: thisYm }),
            local: true,
          };
        },
      },
      // 3. expenses this month / last month
      {
        test: (t) => /(spend|spent|expense|expens).*(last month)/.test(t),
        run: () => {
          const rows = txnsInMonth(lastYm).filter((t) => t.amount < 0);
          const total = rows.reduce((s, r) => s + Math.abs(r.amount), 0);
          const reply =
            useLang === "ur"
              ? `پچھلے مہینے (${monthLabelFull(lastYm, "ur")}) آپ نے ${fmt(total)} خرچ کیے۔`
              : `You spent ${fmt(total)} last month (${monthLabelFull(lastYm)}).`;
          return {
            reply,
            table: {
              columns: ["Date", "Description", "Category", "Amount"],
              numericCols: [3],
              rows: rows
                .slice(0, 10)
                .map((r) => [r.date, r.description, r.category, fmt(r.amount)]),
            },
            local: true,
          };
        },
      },
      {
        test: (t) =>
          /(spend|spent|expense).*(this month|current month)|how much.*(spend|spent)/.test(
            t,
          ),
        run: () => {
          const rows = txnsInMonth(thisYm).filter((t) => t.amount < 0);
          const total = rows.reduce((s, r) => s + Math.abs(r.amount), 0);
          const reply =
            useLang === "ur"
              ? `آپ نے ${monthLabelFull(thisYm, "ur")} میں ${fmt(total)} خرچ کیے جو کہ ${rows.length} ٹرانزیکشنز پر مشتمل ہے۔`
              : `You spent ${fmt(total)} in ${monthLabelFull(thisYm)} across ${rows.length} transaction(s).`;
          return {
            reply,
            table: {
              columns:
                useLang === "ur"
                  ? ["تاریخ", "تفصیل", "زمرہ", "رقم"]
                  : ["Date", "Description", "Category", "Amount"],
              numericCols: [3],
              rows: rows
                .slice(0, 10)
                .map((r) => [r.date, r.description, r.category, fmt(r.amount)]),
            },
            sql: sqlFor("expense_month", { month: thisYm }),
            local: true,
          };
        },
      },
      // 4. breakdown by category (or generic chart request)
      {
        test: (t) =>
          /(category|categories).*(break|breakdown)|break.*category|spending by category|chart|کیٹیگری|درجہ بندی/.test(
            t,
          ),
        run: () => {
          const cats = Store.expensesByCategory(1);
          const reply =
            useLang === "ur"
              ? `یہاں ${monthLabelFull(thisYm, "ur")} کے لیے زمرہ جات (categories) کے لحاظ سے آپ کے اخراجات کی تفصیل ہے۔`
              : `Here's your spending by category for ${monthLabelFull(thisYm)}.`;
          return {
            reply,
            table: {
              columns:
                useLang === "ur" ? ["زمرہ", "کل"] : ["Category", "Total"],
              numericCols: [1],
              rows: cats.map((c) => [c.category, fmt(c.total)]),
            },
            chart: categoryChartConfig(cats),
            sql: sqlFor("expense_by_category", { months: 1 }),
            local: true,
          };
        },
      },
      // 5. biggest expense
      {
        test: (t) => /biggest expense|largest expense|top expense/.test(t),
        run: () => {
          const cats = Store.expensesByCategory(6);
          const top = cats[0];
          const reply =
            useLang === "ur"
              ? top
                ? `پچھلے 6 مہینوں میں آپ کا سب سے بڑا خرچ زمرہ ${top.category} رہا ہے جس پر کل ${fmt(top.total)} خرچ ہوا۔`
                : "کوئی اخراجات ریکارڈ نہیں ملے۔"
              : top
                ? `Your biggest expense category over the last 6 months is ${top.category} at ${fmt(top.total)}.`
                : "No expenses recorded yet.";
          return {
            reply,
            table: {
              columns:
                useLang === "ur"
                  ? ["زمرہ", "کل (6 ماہ)"]
                  : ["Category", "Total (6mo)"],
              numericCols: [1],
              rows: cats.slice(0, 5).map((c) => [c.category, fmt(c.total)]),
            },
            chart: categoryChartConfig(cats.slice(0, 6)),
            sql: sqlFor("expense_by_category", { months: 6 }),
            local: true,
          };
        },
      },
      {
        test: (t) => /trend|income vs expense|expense vs income/.test(t),
        run: () => {
          const series = Store.monthlySeries(6);
          const reply =
            useLang === "ur"
              ? "گذشتہ 6 ماہ کی آمدنی اور اخراجات کا رجحان (trend)۔"
              : "Income vs expense trend for the last 6 months.";
          return {
            reply,
            chart: trendChartConfig(series),
            sql: sqlFor("monthly_series", { months: 6 }),
            local: true,
          };
        },
      },
      {
        test: (t) =>
          /compare|vs last month|this month.*last month|موازنہ|پچھلے مہینے/.test(
            t,
          ),
        run: () => {
          const thisRows = txnsInMonth(thisYm),
            lastRows = txnsInMonth(lastYm);
          const sum = (rows) => ({
            income: rows
              .filter((r) => r.amount > 0)
              .reduce((s, r) => s + r.amount, 0),
            expense: rows
              .filter((r) => r.amount < 0)
              .reduce((s, r) => s + Math.abs(r.amount), 0),
          });
          const a = sum(lastRows),
            b = sum(thisRows);
          const incomeDelta = a.income
            ? (((b.income - a.income) / a.income) * 100).toFixed(0)
            : 0;
          const expenseDelta = a.expense
            ? (((b.expense - a.expense) / a.expense) * 100).toFixed(0)
            : 0;

          let reply;
          if (useLang === "ur") {
            reply = `${monthLabelFull(thisYm, "ur")} بمقابلہ ${monthLabelFull(lastYm, "ur")}: آمدنی ${incomeDelta >= 0 ? "زیادہ" : "کم"} ہوئی ہے ${Math.abs(incomeDelta)}%، اور اخراجات ${expenseDelta >= 0 ? "زیادہ" : "کم"} ہوئے ہیں ${Math.abs(expenseDelta)}%۔`;
          } else {
            reply = `${monthLabelFull(thisYm)} vs ${monthLabelFull(lastYm)}: income is ${incomeDelta >= 0 ? "up" : "down"} ${Math.abs(incomeDelta)}%, expenses are ${expenseDelta >= 0 ? "up" : "down"} ${Math.abs(expenseDelta)}%.`;
          }
          return {
            reply,
            chart: barCompareConfig(
              ["Income", "Expense"],
              [a.income, a.expense],
              [b.income, b.expense],
              monthLabelFull(lastYm),
              monthLabelFull(thisYm),
            ),
            sql: sqlFor("compare_months", { a: lastYm, b: thisYm }),
            local: true,
          };
        },
      },
      // 8. account balances / cash situation / who owes me (mock for now as accounts)
      {
        test: (t) =>
          /account balance|my accounts|balances|cash situation|cash flow|owe|invoices/.test(
            t,
          ),
        run: () => {
          const accs = Store.list("accounts");
          const reply =
            useLang === "ur"
              ? `آپ کے پاس کل ${accs.length} اکاؤنٹس ہیں جن میں کل ${fmt(Store.accountsTotal())} موجود ہیں۔`
              : `You have ${accs.length} accounts totaling ${fmt(Store.accountsTotal())}. (Note: Invoices and detailed cash flow tracking can be added to your data source).`;
          return {
            reply,
            table: {
              columns:
                useLang === "ur"
                  ? ["اکاؤنٹ", "قسم", "بیلنس"]
                  : ["Account", "Type", "Balance"],
              numericCols: [2],
              rows: accs.map((a) => [a.name, a.type, fmt(a.balance)]),
            },
            sql: sqlFor("accounts", {}),
            local: true,
          };
        },
      },
      // 9. net worth
      {
        test: (t) => /net worth|کل مالیت/.test(t),
        run: () => {
          const series = Store.netWorthSeries(6);
          const latest = series[series.length - 1];

          let reply;
          if (useLang === "ur") {
            reply = `پچھلے 6 مہینوں میں آپ کی کل مالیت (net worth) میں تبدیلی ${fmt(latest.netWorth)} ہے۔ تمام اکاؤنٹس کا کل بیلنس ${fmt(Store.accountsTotal())} ہے۔`;
          } else {
            reply = `Your tracked net worth change over 6 months is ${fmt(latest.netWorth)} (cumulative net of income minus expenses). Combined account balance is ${fmt(Store.accountsTotal())}.`;
          }
          return {
            reply,
            chart: {
              type: "line",
              data: {
                labels: series.map((s) => s.label),
                datasets: [
                  {
                    label: useLang === "ur" ? "کل مالیت" : "Net Worth",
                    data: series.map((s) => s.netWorth),
                    borderColor: ChartTheme.palette().accent,
                    backgroundColor: ChartTheme.palette().accent + "33",
                    fill: true,
                    tension: 0.35,
                  },
                ],
              },
              options: ChartTheme.baseOptions(),
            },
            sql: sqlFor("net_worth", { months: 6 }),
            local: true,
          };
        },
      },
      // 10. budget status
      {
        test: (t) => /budget|بجٹ/.test(t),
        run: () => {
          const b = Store.budgetHealth();

          let reply;
          if (useLang === "ur") {
            reply = `بجٹ کی صورتحال برائے ${monthLabelFull(thisYm, "ur")}: ${b.filter((x) => x.pct >= 90).length} زمرہ بجٹ کی حد کے قریب یا اس سے زیادہ ہے۔`;
          } else {
            reply = `Budget status for ${monthLabelFull(thisYm)}: ${b.filter((x) => x.pct >= 90).length} categor${b.filter((x) => x.pct >= 90).length === 1 ? "y is" : "ies are"} close to or over the limit.`;
          }
          return {
            reply,
            table: {
              columns:
                useLang === "ur"
                  ? ["زمرہ", "خرچ ہوا", "حد", "فیصد"]
                  : ["Category", "Spent", "Limit", "Used"],
              numericCols: [1, 2],
              rows: b.map((x) => [
                x.category,
                fmt(x.spent),
                fmt(x.monthly_limit),
                Math.round(x.pct) + "%",
              ]),
            },
            sql: sqlFor("budgets", {}),
            local: true,
          };
        },
      },
      // 11. recent transactions
      {
        test: (t) =>
          /recent transaction|latest transaction|show.*transaction|حالیہ ٹرانزیکشنز|حالیہ لین دین/.test(
            t,
          ),
        run: () => {
          const rows = Store.list("txns").slice(0, 8);
          const reply =
            useLang === "ur"
              ? `یہاں آپ کی ${rows.length} حالیہ ٹرانزیکشنز کی فہرست ہے۔`
              : `Here are your ${rows.length} most recent transactions.`;
          return {
            reply,
            table: {
              columns:
                useLang === "ur"
                  ? ["تاریخ", "تفصیل", "زمرہ", "رقم"]
                  : ["Date", "Description", "Category", "Amount"],
              numericCols: [3],
              rows: rows.map((r) => [
                r.date,
                r.description,
                r.category,
                fmt(r.amount),
              ]),
            },
            sql: sqlFor("recent_txns", { limit: 8 }),
            local: true,
          };
        },
      },
      // 12. savings rate
      {
        test: (t) => /savings rate|save.*percent|how much.*sav/.test(t),
        run: () => {
          const s = Store.summary(1);
          const reply =
            useLang === "ur"
              ? `اس مہینے آپ کی بچت کی شرح ${s.savingsRate.toFixed(1)}% ہے — آپ نے کمائے گئے ${fmt(s.income)} میں سے ${fmt(s.income - s.expense)} بچائے۔`
              : `Your savings rate this month is ${s.savingsRate.toFixed(1)}% — you kept ${fmt(s.income - s.expense)} out of ${fmt(s.income)} earned.`;
          return {
            reply,
            sql: sqlFor("savings_rate", { month: thisYm }),
            local: true,
          };
        },
      },
      // 13. subscriptions
      {
        test: (t) => /subscription/.test(t),
        run: () => {
          const rows = Store.list("txns").filter(
            (t) => t.category === "Subscriptions",
          );
          const total = rows.reduce((s, r) => s + Math.abs(r.amount), 0);
          return {
            reply: `You've spent ${fmt(total)} on subscriptions across ${rows.length} charges.`,
            table: {
              columns: ["Date", "Description", "Amount"],
              numericCols: [2],
              rows: rows.map((r) => [r.date, r.description, fmt(r.amount)]),
            },
            sql: sqlFor("category_txns", { category: "Subscriptions" }),
            local: true,
          };
        },
      },
      // 14. goals
      {
        test: (t) => /goal/.test(t),
        run: () => {
          const goals = Store.list("goals");
          return {
            reply: `You're tracking ${goals.length} goal(s).`,
            table: {
              columns: ["Goal", "Saved", "Target", "Progress"],
              numericCols: [1, 2],
              rows: goals.map((g) => [
                g.name,
                fmt(g.saved_amount),
                fmt(g.target_amount),
                Math.round((g.saved_amount / g.target_amount) * 100) + "%",
              ]),
            },
            sql: sqlFor("goals", {}),
            local: true,
          };
        },
      },
      // 15. recurring / upcoming bills
      {
        test: (t) => /recurring|upcoming bill|subscriptions due/.test(t),
        run: () => {
          const rows = Store.list("recurring");
          return {
            reply: `You have ${rows.length} recurring item(s) scheduled.`,
            table: {
              columns: ["Description", "Category", "Amount", "Next date"],
              numericCols: [2],
              rows: rows.map((r) => [
                r.description,
                r.category,
                fmt(r.amount),
                r.next_date,
              ]),
            },
            sql: sqlFor("recurring", {}),
            local: true,
          };
        },
      },
      // 16. groceries / any specific category spend "how much did I spend on X"
      {
        test: (t) => /how much.*(spend|spent).*on\s+\w+|spend on/.test(t),
        run: (raw) => {
          const cats = [
            "groceries",
            "rent",
            "transport",
            "utilities",
            "dining",
            "shopping",
            "subscriptions",
            "healthcare",
          ];
          const found = cats.find((c) => raw.toLowerCase().includes(c)) || null;
          if (!found) return null;
          const catName =
            found === "dining"
              ? "Dining out"
              : found[0].toUpperCase() + found.slice(1);
          const rows = Store.list("txns").filter(
            (t) => t.category.toLowerCase() === catName.toLowerCase(),
          );
          const total = rows.reduce((s, r) => s + Math.abs(r.amount), 0);
          return {
            reply: `You've spent ${fmt(total)} on ${catName} across ${rows.length} transaction(s).`,
            table: {
              columns: ["Date", "Description", "Amount"],
              numericCols: [2],
              rows: rows.map((r) => [r.date, r.description, fmt(r.amount)]),
            },
            sql: sqlFor("category_txns", { category: catName }),
            local: true,
          };
        },
      },
      // 17. summary / profit or loss / tax summary
      {
        test: (t) =>
          /summary|overview|how am i doing|profit or loss|profit|loss|tax summary/.test(
            t,
          ),
        run: () => {
          const s = Store.summary(6);
          return {
            reply: `Profit & Loss overview (Last 6 months): ${fmt(s.income)} income, ${fmt(s.expense)} expenses, net ${fmt(s.net)}, savings rate ${s.savingsRate.toFixed(1)}%. Combined account balance is ${fmt(Store.accountsTotal())}.`,
            chart: trendChartConfig(Store.monthlySeries(6)),
            sql: sqlFor("monthly_series", { months: 6 }),
            local: true,
          };
        },
      },
      // 18. "what sold the most" style / top category by spend
      {
        test: (t) =>
          /sold the most|top categor|what.*most.*(spend|expense)/.test(t),
        run: () => {
          const cats = Store.expensesByCategory(1);
          const top = cats[0];
          return {
            reply: top
              ? `${top.category} is your top spend category this month at ${fmt(top.total)}.`
              : "No expenses recorded yet this month.",
            table: {
              columns: ["Category", "Total"],
              numericCols: [1],
              rows: cats.slice(0, 5).map((c) => [c.category, fmt(c.total)]),
            },
            chart: categoryChartConfig(cats.slice(0, 6)),
            sql: sqlFor("expense_by_category", { months: 1 }),
            local: true,
          };
        },
      },
    ];
    return rules;
  }

  function sqlFor(kind, p) {
    switch (kind) {
      case "expense_by_category":
        return `SELECT category, SUM(ABS(amount)) AS total\nFROM transactions\nWHERE amount < 0 AND date >= NOW() - INTERVAL '${p.months} months'\nGROUP BY category\nORDER BY total DESC;`;
      case "income_month":
        return `SELECT date, description, amount\nFROM transactions\nWHERE amount > 0 AND to_char(date,'YYYY-MM') = '${p.month}'\nORDER BY date;`;
      case "expense_month":
        return `SELECT date, description, category, amount\nFROM transactions\nWHERE amount < 0 AND to_char(date,'YYYY-MM') = '${p.month}'\nORDER BY date;`;
      case "monthly_series":
        return `SELECT to_char(date,'YYYY-MM') AS month,\n  SUM(CASE WHEN amount>0 THEN amount ELSE 0 END) AS income,\n  SUM(CASE WHEN amount<0 THEN -amount ELSE 0 END) AS expense\nFROM transactions\nWHERE date >= NOW() - INTERVAL '${p.months} months'\nGROUP BY month ORDER BY month;`;
      case "compare_months":
        return `SELECT to_char(date,'YYYY-MM') AS month,\n  SUM(CASE WHEN amount>0 THEN amount ELSE 0 END) AS income,\n  SUM(CASE WHEN amount<0 THEN -amount ELSE 0 END) AS expense\nFROM transactions\nWHERE to_char(date,'YYYY-MM') IN ('${p.a}','${p.b}')\nGROUP BY month;`;
      case "accounts":
        return `SELECT name, type, balance FROM accounts ORDER BY balance DESC;`;
      case "net_worth":
        return `SELECT to_char(date,'YYYY-MM') AS month,\n  SUM(amount) OVER (ORDER BY to_char(date,'YYYY-MM')) AS net_worth\nFROM transactions\nWHERE date >= NOW() - INTERVAL '${p.months} months';`;
      case "budgets":
        return `SELECT b.category, SUM(ABS(t.amount)) AS spent, b.monthly_limit\nFROM budgets b LEFT JOIN transactions t\n  ON t.category = b.category AND t.amount < 0\n  AND to_char(t.date,'YYYY-MM') = to_char(NOW(),'YYYY-MM')\nGROUP BY b.category, b.monthly_limit;`;
      case "recent_txns":
        return `SELECT date, description, category, amount\nFROM transactions\nORDER BY date DESC LIMIT ${p.limit};`;
      case "savings_rate":
        return `SELECT (SUM(CASE WHEN amount>0 THEN amount ELSE 0 END) - SUM(CASE WHEN amount<0 THEN -amount ELSE 0 END))\n  / NULLIF(SUM(CASE WHEN amount>0 THEN amount ELSE 0 END),0) * 100 AS savings_rate\nFROM transactions WHERE to_char(date,'YYYY-MM') = '${p.month}';`;
      case "category_txns":
        return `SELECT date, description, amount FROM transactions\nWHERE category = '${p.category}' ORDER BY date DESC;`;
      case "goals":
        return `SELECT name, saved_amount, target_amount FROM goals;`;
      case "recurring":
        return `SELECT description, category, amount, next_date FROM recurring_items ORDER BY next_date;`;
      default:
        return `SELECT * FROM transactions LIMIT 20;`;
    }
  }

  function localAnalyze(rawText, useLang = "en") {
    const NLU = window.AssistantNLU;
    const n = NLU ? NLU.normalize(rawText) : rawText.toLowerCase();
    const intent = NLU ? NLU.detectIntent(rawText) : null;

    if (intent) {
      const settingsResult = runSettingsIntent(intent.id, rawText, useLang);
      if (settingsResult) return settingsResult;
      const quickTxn =
        intent.id === "quick_transaction" && NLU.parseQuickTransaction(rawText);
      if (quickTxn) return saveQuickTransaction(quickTxn, useLang);
    }

    const rules = buildRules(useLang);
    for (const rule of rules) {
      const testText = NLU ? NLU.normalize(rawText) : rawText.toLowerCase();
      if (rule.test(testText) || rule.test(rawText.toLowerCase())) {
        const res = rule.run(rawText);
        if (res) {
          state.lastIntent = testText;
          return res;
        }
      }
    }
    return null;
  }

  function saveQuickTransaction(txn, useLang) {
    const amount =
      txn.type === "income" ? Math.abs(txn.amount) : -Math.abs(txn.amount);
    const item = Store.addTransaction({
      date: new Date().toISOString().split("T")[0],
      description: txn.category + " (via Assistant)",
      category: txn.category,
      account_id: txn.account_id,
      account_name: txn.account_name,
      type: txn.type,
      amount,
      source: "assistant",
    });
    const reply =
      useLang === "ur"
        ? `ٹرانزیکشن شامل ہو گئی: ${fmt(Math.abs(txn.amount))} (${txn.category})`
        : `Added ${txn.type} of ${fmt(Math.abs(txn.amount))} for ${txn.category} to ${txn.account_name}.`;
    return {
      reply,
      actionCard: actionCardForEntity("create", "transaction", item),
      local: true,
      dataChanged: true,
      storeKey: "txns",
    };
  }

  function runSettingsIntent(intentId, text, useLang) {
    const n = window.AssistantNLU
      ? AssistantNLU.normalize(text)
      : text.toLowerCase();
    if (intentId === "settings_theme" || /dark mode|light mode/.test(n)) {
      if (/dark/.test(n)) {
        window.Theme && Theme.apply("dark");
        Store.saveSettings({ theme: "dark" });
        return {
          reply:
            useLang === "ur"
              ? "ڈارک موڈ فعال ہو گیا۔"
              : "Switched to dark mode.",
          local: true,
          dataChanged: true,
        };
      }
      if (/light/.test(n)) {
        window.Theme && Theme.apply("light");
        Store.saveSettings({ theme: "light" });
        return {
          reply:
            useLang === "ur"
              ? "لائٹ موڈ فعال ہو گیا۔"
              : "Switched to light mode.",
          local: true,
          dataChanged: true,
        };
      }
    }
    if (intentId === "settings_language" || /\b(urdu|english)\b/.test(n)) {
      if (/urdu|اردو/.test(n)) {
        Store.saveSettings({ language: "ur" });
        state.lang = "ur";
        setLang("ur");
        return { reply: "Switched to Urdu.", local: true, dataChanged: true };
      }
      if (/english/.test(n)) {
        Store.saveSettings({ language: "en" });
        state.lang = "en";
        setLang("en");
        return {
          reply: "Switched to English.",
          local: true,
          dataChanged: true,
        };
      }
    }
    if (intentId === "settings_voice" || /notification/.test(n)) {
      if (/notification|email summary|daily email/.test(n)) {
        const off = /(off|disable|stop)/.test(n);
        Store.saveSettings({ dailyEmailSummary: !off });
        return {
          reply: off
            ? "Notification summary turned off."
            : "Notification summary turned on.",
          local: true,
          dataChanged: true,
          storeKey: "settings",
        };
      }
      if (/(off|disable|stop)/.test(n)) {
        Store.saveSettings({ voiceEnabled: false });
        return {
          reply: "Voice replies turned off.",
          local: true,
          dataChanged: true,
          storeKey: "settings",
        };
      }
      Store.saveSettings({ voiceEnabled: true });
      return {
        reply: "Voice replies turned on.",
        local: true,
        dataChanged: true,
        storeKey: "settings",
      };
    }
    if (intentId === "settings_name") {
      const m =
        text.match(/(?:name|call(?:ed)?)\s+(?:to\s+)?["']?([^"']+)["']?$/i) ||
        text.match(/business name\s+(?:to\s+)?(.+)/i);
      if (m) {
        const name = m[1].trim();
        Store.saveSettings({ businessName: name });
        Nav && Nav.setUserChip && Nav.setUserChip();
        return {
          reply: `Business name updated to "${name}".`,
          local: true,
          dataChanged: true,
          storeKey: "settings",
        };
      }
    }
    if (intentId === "import_file") {
      els.fileInput?.click();
      return {
        reply:
          useLang === "ur"
            ? "براہ کرم CSV، JSON یا Excel فائل منتخب کریں۔"
            : "Please choose a CSV, JSON, or Excel file using the upload button.",
        local: true,
      };
    }
    return null;
  }

  // ---------------- AI fallback (open-ended phrasing / Urdu) ----------------
  async function callAi(userText, lang) {
    const cfg = window.FINLYTICS_CONFIG || {};
    const settings = Store.getSettings();
    const apiKey = settings.aiApiKey || cfg.AI_API_KEY;
    if (!apiKey) return null;

    const s = Store.summary(6);
    const cats = Store.expensesByCategory(6).slice(0, 6);
    const accs = Store.list("accounts");
    const snapshot = {
      last6MonthsIncome: s.income,
      last6MonthsExpense: s.expense,
      savingsRatePct: s.savingsRate.toFixed(1),
      topCategories: cats,
      accounts: accs.map((a) => ({ name: a.name, balance: a.balance })),
      currency: CURRENCY,
    };

    const BASE_PROMPT = `You are Finlytics AI, a personal accountant. Respond in ${lang === "ur" ? "Urdu" : "English"}.
SCOPE: Only business finance. Redirect off-topic: "I'm focused on your business finances — happy to help with that!"
RULES: Never fabricate data. Keep replies to 2-3 sentences. Configured currency: ${CURRENCY}. No API keys.
GREETING (1st message only): "Hi! I'm Finlytics AI. I can help you manage your wallet, accounts, goals, budgets, transactions, or show reports and graphs."`;

    const CRUD_MODULE = `
CRUD MODE ACTIVE. Manage: Wallet, Accounts, Goals, Budgets, Transactions.
1. Ask for required fields conversationally, one-by-one.
2. Summarize changes before saving.
3. ALWAYS ask for confirmation before save/update/delete.`;

    const CHART_MODULE = `
CHART MODE ACTIVE.
Pick correct type: Spending → pie/bar, Income vs Expense → line/bar, Budget/Balances → bar, Goals → progress bar. Label values with ${CURRENCY}.`;

    const REPORT_MODULE = `
REPORT MODE ACTIVE. Use: Profit & Loss, Cash Flow, Tax, Customer/Vendor balances, Budget vs Actual.
If Show SQL is on, write query above response.`;

    let sys = BASE_PROMPT;
    const lowerText = userText.toLowerCase();

    if (/(add|create|new|edit|change|update|delete|remove)/.test(lowerText)) {
      sys += "\n" + CRUD_MODULE;
    }
    if (/(show|draw|plot|visualize|graph|chart|trend)/.test(lowerText)) {
      sys += "\n" + CHART_MODULE;
    }
    if (/(profit|loss|cash flow|tax|owe|owed|summary|report)/.test(lowerText)) {
      sys += "\n" + REPORT_MODULE;
    }

    // Hard 3s timeout — a revoked/invalid/rate-limited key must never hang
    // the chat. If AI doesn't answer in time we abort and fall back to
    // the local engine's fallbackReply() instead of leaving the user staring
    // at a "thinking…" indicator.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const resp = await fetch(cfg.AI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: cfg.AI_MODEL,
          max_tokens: 120,
          messages: [
            { role: "system", content: sys },
            {
              role: "user",
              content: `Financial snapshot JSON:\n${JSON.stringify(snapshot)}\n\nQuestion: ${userText}`,
            },
          ],
        }),
      });
      clearTimeout(timeoutId);
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403)
          console.warn(
            "AI call failed: invalid/revoked API key. Check Settings → AI Assistant.",
          );
        return null;
      }
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content;
      return text ? { reply: escapeHtml(text), local: false } : null;
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === "AbortError")
        console.warn(
          "AI call timed out after 3s — falling back to local engine.",
        );
      else console.warn("AI call failed: " + e.message);
      return null;
    }
  }

  function fallbackReply(lang) {
    return lang === "ur"
      ? {
          reply:
            "میں آمدنی، اخراجات، کیٹیگریز، بجٹ، اکاؤنٹس اور رجحانات کے بارے میں سوالات میں مدد کر سکتا ہوں۔ نیچے دیے گئے تجویز کردہ سوالات آزمائیں۔",
          local: true,
        }
      : {
          reply:
            "I can help with questions about income, expenses, categories, budgets, accounts, and trends. Try one of the quick questions below, or ask in your own words.",
          local: true,
        };
  }

  // ---------------- Topic guard: finance-only + inappropriate filter ----------------
  const INAPPROPRIATE_WORDS = [
    "sex",
    "porn",
    "nude",
    "naked",
    "kill",
    "murder",
    "rape",
    "hate",
    "racist",
    "abuse",
    "drug",
    "cocaine",
    "heroin",
    "terrorist",
    "bomb",
    "suicide",
    "shoot",
    "violence",
    "cheat",
    "hack",
    "illegal",
    "fraud",
    "scam",
    "phishing",
    "malware",
    "virus",
    "exploit",
  ];

  function printFinancialStatement(months = 6) {
    if (window.ReportsPrintStatement) {
      window.ReportsPrintStatement();
      return;
    }
    const s = Store.summary(months);
    const series = Store.monthlySeries(Math.min(months, 6));
    const cats = Store.expensesByCategory(months);
    const settings = Store.getSettings();
    const html = `
      <h1 style="font-family:Sora,sans-serif">${settings.businessName || "Finlytics"} — Financial Statement</h1>
      <p style="color:#555">Period: last ${months} months · Generated ${new Date().toLocaleDateString()}</p>
      <h3>Summary</h3>
      <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
        <tr><td>Total Income</td><td>${fmt(s.income)}</td></tr>
        <tr><td>Total Expenses</td><td>${fmt(s.expense)}</td></tr>
        <tr><td>Net Savings</td><td>${fmt(s.net)}</td></tr>
      </table>
      <h3>Monthly Breakdown</h3>
      <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
        <tr><th>Month</th><th>Income</th><th>Expense</th><th>Net</th></tr>
        ${series.map((m) => `<tr><td>${m.label}</td><td>${fmt(m.income)}</td><td>${fmt(m.expense)}</td><td>${fmt(m.net)}</td></tr>`).join("")}
      </table>
      <h3>Spending by Category</h3>
      <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
        <tr><th>Category</th><th>Total</th></tr>
        ${cats.map((c) => `<tr><td>${c.category}</td><td>${fmt(c.total)}</td></tr>`).join("")}
      </table>`;
    const w = window.open("", "_blank");
    w.document.write(
      `<html><head><title>Finlytics Statement</title></head><body style="font-family:Inter,sans-serif;padding:30px">${html}</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  }

  const FINANCE_KEYWORDS = [
    // Greetings & Identity (so it can answer hello, what is your name, etc.)
    "hello",
    "hi",
    "hey",
    "hlo",
    "how are you",
    "who are you",
    "your name",
    "what is your name",
    "what do you do",
    "assistant",
    "who is this",
    "help",
    "assalam",
    "salaam",
    "kya haal",
    "kaise ho",
    "naam kya hai",
    "kaun ho",
    "kya karte",
    // English
    "income",
    "expense",
    "spending",
    "spend",
    "spent",
    "money",
    "budget",
    "account",
    "balance",
    "transaction",
    "transfer",
    "saving",
    "savings",
    "invest",
    "goal",
    "bill",
    "salary",
    "earn",
    "profit",
    "loss",
    "revenue",
    "cost",
    "net worth",
    "cash",
    "bank",
    "wallet",
    "finance",
    "financial",
    "report",
    "analytics",
    "trend",
    "category",
    "tax",
    "debt",
    "loan",
    "credit",
    "debit",
    "payment",
    "receipt",
    "export",
    "summary",
    "analysis",
    "afford",
    "fund",
    "asset",
    "liability",
    "interest",
    "subscription",
    "recurring",
    "chart",
    "graph",
    "compare",
    "total",
    "monthly",
    "weekly",
    "annual",
    "yearly",
    "rupees",
    "pkr",
    "rs",
    "amount",
    "deposit",
    "withdraw",
    "goal",
    "goals",
    "budget",
    "budgets",
    "add",
    "create",
    "delete",
    "remove",
    "edit",
    "update",
    "transaction",
    "transactions",
    "account",
    "accounts",
    "transfer",
    "wallet",
    "remaining",
    "import",
    "upload",
    "theme",
    "dark",
    "light",
    "notification",
    "profile",
    "export",
    "print",
    "kitni",
    "grocry",
    "grocery",
    "meri",
    "bachat",
    // Urdu transliterations
    "kharcha",
    "amdani",
    "bachat",
    "kharch",
    "paisay",
    "paisa",
    "mahine",
    "bujat",
    "hisaab",
    "raseed",
    "udhaar",
    "qarz",
    "khata",
    "tankhwah",
    "kamana",
    "amdani",
    "wallet",
    "bank",
    // Urdu unicode common words
    "آمدنی",
    "اخراجات",
    "بجٹ",
    "بچت",
    "اکاؤنٹ",
    "بیلنس",
    "ٹرانزیکشن",
    "خرچ",
    "پیسے",
    "مالی",
    "کیٹیگری",
    "تنخواہ",
    "قرض",
    "بینک",
    "خلاصہ",
    "رجحان",
    "کون ہو",
    "نام کیا ہے",
    "سلام",
    "مدد",
    "ہدف",
    "اہداف",
    "شامل",
    "حذف",
    "تبدیل",
  ];

  function isInappropriate(text) {
    const lower = text.toLowerCase();
    return INAPPROPRIATE_WORDS.some((w) => lower.includes(w));
  }

  function isOffTopic(text) {
    const lower = text.toLowerCase();
    // If any finance keyword is found, it's on-topic
    return !FINANCE_KEYWORDS.some((w) => lower.includes(w));
  }

  function guardReply(type) {
    const isUrdu = state.lang === "ur";
    if (type === "inappropriate") {
      return {
        reply: isUrdu
          ? "معافی چاہتا ہوں، میں صرف مالیاتی سوالات میں مدد کر سکتا ہوں۔ براہ کرم مناسب سوال پوچھیں۔"
          : "Sorry, I'm not able to help with that. I'm a finance assistant — I only answer questions related to your income, expenses, budgets, accounts, and goals.",
        local: true,
      };
    }
    return {
      reply: isUrdu
        ? "معافی چاہتا ہوں! میں صرف مالیاتی سوالات کا جواب دے سکتا ہوں جیسے آمدنی، اخراجات، بجٹ، اکاؤنٹس وغیرہ۔ کوئی مالیاتی سوال پوچھیں۔"
        : 'Sorry, I can only help with finance-related questions — like your income, spending, budgets, accounts, savings, and goals. Try asking something like <em>"Why am I losing money?"</em> or <em>"Show my budget status."</em>',
      local: true,
    };
  }

  // ---------------- Conversational CRUD Flow Engine ----------------
  const FLOW_DEFINITIONS = {
    budget: {
      create: {
        fields: [
          { key: "category", q: "What category is this budget for?" },
          { key: "monthly_limit", q: "What is the monthly limit amount?" },
        ],
        save: (data) =>
          Store.add("budgets", {
            category: data.category,
            monthly_limit: Number(data.monthly_limit),
          }),
      },
      edit: {
        fields: [{ key: "monthly_limit", q: "What is the new monthly limit?" }],
        save: (data) =>
          Store.update("budgets", data.id, {
            monthly_limit: Number(data.monthly_limit),
          }),
      },
      delete: {
        fields: [],
        save: (data) => {
          Store.remove("budgets", data.id);
          return data;
        },
      },
    },
    goal: {
      create: {
        fields: [
          { key: "name", q: "What is the name of the goal?" },
          { key: "target_amount", q: "What is the target amount?" },
          {
            key: "target_date",
            q: "What is the target date (e.g. 2026-12-31)?",
          },
        ],
        save: (data) =>
          Store.add("goals", {
            name: data.name,
            target_amount: Number(data.target_amount),
            saved_amount: 0,
            target_date: data.target_date,
          }),
      },
      edit: {
        fields: [
          { key: "target_amount", q: "What is the new target amount?" },
          {
            key: "saved_amount",
            q: "What is the current saved amount? (optional — press Enter to skip)",
          },
        ],
        save: (data) => {
          const patch = { target_amount: Number(data.target_amount) };
          if (data.saved_amount) patch.saved_amount = Number(data.saved_amount);
          Store.update("goals", data.id, patch);
        },
      },
      delete: {
        fields: [],
        save: (data) => {
          Store.remove("goals", data.id);
          return data;
        },
      },
    },
    transaction: {
      create: {
        fields: [
          { key: "type", q: "Is this an income or expense?" },
          { key: "amount", q: "What is the amount?" },
          { key: "category", q: "What is the category?" },
          { key: "account_name", q: "Which account is this for?" },
        ],
        save: (data) => {
          const type = (data.type || "").toLowerCase().includes("in")
            ? "income"
            : "expense";
          const acc = Store.list("accounts").find(
            (a) =>
              a.name.toLowerCase() === (data.account_name || "").toLowerCase(),
          );
          return Store.addTransaction({
            date: new Date().toISOString().split("T")[0],
            description: data.category || "Assistant Entry",
            category: data.category,
            account_id: acc?.id || null,
            account_name: data.account_name,
            type,
            amount:
              type === "income" ? Number(data.amount) : -Number(data.amount),
            source: "assistant",
          });
        },
      },
      edit: {
        fields: [
          { key: "amount", q: "What is the new amount?" },
          { key: "category", q: "New category? (optional — Enter to skip)" },
        ],
        save: (data) => {
          const existing = Store.list("txns").find((t) => t.id === data.id);
          const patch = {};
          if (data.amount) {
            const type = existing?.amount >= 0 ? "income" : "expense";
            patch.amount =
              type === "income"
                ? Math.abs(Number(data.amount))
                : -Math.abs(Number(data.amount));
          }
          if (data.category) patch.category = data.category;
          return Store.updateTransaction(data.id, patch);
        },
      },
      delete: {
        fields: [],
        save: (data) => {
          Store.removeTransaction(data.id);
          return data;
        },
      },
    },
    account: {
      create: {
        fields: [
          { key: "name", q: "What is the account name?" },
          {
            key: "type",
            q: "What type of account is this (bank, cash, credit_card, savings)?",
          },
          { key: "balance", q: "What is the opening balance?" },
        ],
        save: (data) =>
          Store.add("accounts", {
            name: data.name,
            type: data.type,
            balance: Number(data.balance),
          }),
      },
      edit: {
        fields: [
          { key: "name", q: "New account name? (optional — Enter to skip)" },
          { key: "balance", q: "New balance? (optional — Enter to skip)" },
        ],
        save: (data) => {
          const patch = {};
          if (data.name) patch.name = data.name;
          if (data.balance) patch.balance = Number(data.balance);
          return Store.update("accounts", data.id, patch);
        },
      },
      delete: {
        fields: [],
        save: (data) => {
          Store.remove("accounts", data.id);
          return data;
        },
      },
    },
  };

  function flowStoreKey(entity) {
    if (entity === "transaction") return "txns";
    if (entity === "account") return "accounts";
    return entity + "s";
  }

  function startFlow(action, entity, initialData = {}) {
    state.flow = {
      action,
      entity,
      data: initialData,
      step: 0,
      awaitingConfirmation: false,
    };
    persistNow();
    return stepFlow();
  }

  function stepFlow(userInput = null) {
    const f = state.flow;
    const def = FLOW_DEFINITIONS[f.entity][f.action];

    if (f.awaitingConfirmation) {
      if (
        userInput &&
        /^(yes|yeah|sure|confirm|ok|yep|do it|y|haan|جی|ہاں)/i.test(userInput)
      ) {
        const saved = def.save(f.data) || f.data;
        const card = actionCardForEntity(f.action, f.entity, saved);
        state.flow = null;
        persistNow();
        return {
          reply:
            f.action === "delete"
              ? "Deleted successfully."
              : "Done! Changes saved.",
          actionCard: card,
          local: true,
          dataChanged: true,
          storeKey: flowStoreKey(f.entity),
        };
      } else {
        state.flow = null;
        persistNow();
        return { reply: "Cancelled. Nothing was changed.", local: true };
      }
    }

    if (userInput && def.fields[f.step]) {
      const field = def.fields[f.step];
      if (
        !(field.key === "saved_amount" && !userInput.trim()) &&
        !(
          ["name", "balance", "category"].includes(field.key) &&
          !userInput.trim()
        )
      ) {
        f.data[field.key] = userInput;
      }
      f.step++;
    }

    if (f.step < def.fields.length) {
      persistNow();
      return { reply: def.fields[f.step].q, local: true };
    }

    f.awaitingConfirmation = true;
    persistNow();
    const summary = Object.entries(f.data)
      .filter(([k, v]) => k !== "id")
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    let msg = "";
    if (f.action === "create")
      msg = `Here's what I'll add for ${f.entity}: ${summary}. Shall I save this?`;
    else if (f.action === "edit")
      msg = `I will update the ${f.entity} to: ${summary}. Is this correct?`;
    else if (f.action === "delete")
      msg = `This will permanently delete the ${f.entity}. Are you sure you want to delete it?`;

    return { reply: msg, local: true };
  }

  // ---------------- Core answer engine (no DOM) ----------------
  // Pure text-in / result-out. Shared by this page's chat UI AND the
  // global voice popup so both use the exact same rules, guards,
  // and AI fallback without duplicate logic.
  async function answerQuery(text, lang) {
    const useLang = lang || state.lang;
    const settings = Store.getSettings();

    if (state.flow) {
      const result = stepFlow(text);
      result.question = text;
      return result;
    }
    if (isInappropriate(text)) return guardReply("inappropriate");

    // Detect user complaints/corrections about a previous answer
    const isComplaint =
      /(wrong|incorrect|not right|bad answer|that.s wrong|this is wrong|you.re wrong|mistake|error|inaccurate|fix that|try again|that.s not|غلط|صحیح نہیں)/i.test(
        text,
      );
    if (isComplaint) {
      const useLangComp = lang || state.lang;
      return {
        reply:
          useLangComp === "ur"
            ? "معذرت کے ساتھ! میں آپ کی تصحیح کو سمجھتا ہوں۔ براہ کرم دوبارہ اپنا سوال پوچھیں اور میں درست جواب دینے کی پوری کوشش کروں گا۔"
            : "I apologize for the confusion! I understand my previous response may not have been accurate. Please rephrase or repeat your question and I'll do my best to give you the correct answer.",
        local: true,
      };
    }

    // Normalize query (remove Urdu/English punctuation and whitespace) and map quick questions
    const cleanText = text.replace(/[؟?.]/g, "").trim().toLowerCase();
    const mappedText = NORMALIZED_QUICK_QUESTIONS_MAP[cleanText] || text;

    // Run local rules FIRST (instant — no AI needed for CRUD and common queries)
    let result = localAnalyze(mappedText, useLang);

    // Only check off-topic AFTER local rules fail (so CRUD intents are never wrongly blocked)
    if (!result && isOffTopic(text)) return guardReply("offtopic");

    if (!result && settings.aiEnabled !== false) {
      result = await callAi(text, useLang);
      if (result && isChartRequest(text) && !result.chart) {
        result.chart = pickChartForText(text);
      }
    }
    if (!result) result = fallbackReply(useLang);
    result.question = text;
    return result;
  }

  // ---------------- Send flow (assistant.html chat UI) ----------------
  async function handleUserText(text) {
    if (!text || !text.trim()) return;
    startConversation();
    addMessage("user", escapeHtml(text));
    els.input.value = "";
    addTyping();

    const result = await answerQuery(text, state.lang);

    removeTyping();
    await renderAiResult(result, text);
    if (result.dataChanged && result.storeKey)
      Store.notifyChange(result.storeKey);
    else if (result.dataChanged)
      Store.notifyChange && Store.notifyChange("txns");
    speak(stripHtml(result.reply));
  }

  async function handleFileUpload(file) {
    if (!file || !window.AssistantImport) {
      addMessage("ai", "File import is not available on this page.");
      return;
    }
    startConversation();
    addMessage("user", `Uploaded: ${escapeHtml(file.name)}`);
    addTyping();
    try {
      const result = await AssistantImport.importFile(file);
      const mappingLines = Object.entries(result.mapping)
        .map(([k, v]) => `${k} → ${v}`)
        .join(", ");
      removeTyping();
      await renderAiResult(
        {
          reply: `Imported ${result.added} transaction(s) from ${result.totalRows} rows.${result.skipped ? ` Skipped ${result.skipped} duplicate(s).` : ""}${mappingLines ? " Mapped: " + mappingLines + "." : ""}`,
          chart: categoryChartConfig(Store.expensesByCategory(6).slice(0, 6)),
          local: true,
          dataChanged: true,
          storeKey: "txns",
          importMeta: {
            fileName: file.name,
            mapping: result.mapping,
            added: result.added,
            totalRows: result.totalRows,
            at: Date.now(),
          },
        },
        "import summary",
      );
      const session = ensureChatSession();
      session.imports = session.imports || [];
      session.imports.push({
        fileName: file.name,
        mapping: result.mapping,
        added: result.added,
        totalRows: result.totalRows,
        at: Date.now(),
      });
      persistNow();
    } catch (err) {
      removeTyping();
      addMessage("ai", escapeHtml(err.message || "Import failed."));
    }
  }

  // ---------------- Chart auto-pick for open-ended AI replies ----------------
  // Used only as a fallback when a request slips past every local rule (rare —
  // buildRules() already covers the common chart phrasings) but still looks
  // like it wants a visual, e.g. unusual English phrasing or Urdu.
  function isChartRequest(text) {
    return /(show|draw|plot|visualize|graph|chart|trend)/i.test(text);
  }

  function pickChartForText(text) {
    const lower = text.toLowerCase();
    if (
      lower.includes("category") ||
      lower.includes("spending") ||
      lower.includes("expense")
    ) {
      return categoryChartConfig(Store.expensesByCategory(6).slice(0, 6));
    }
    if (
      lower.includes("trend") ||
      lower.includes("vs") ||
      lower.includes("over time") ||
      lower.includes("compare")
    ) {
      return trendChartConfig(Store.monthlySeries(6));
    }
    if (lower.includes("budget")) {
      const b = Store.budgetHealth();
      return barCompareConfig(
        b.map((x) => x.category),
        b.map((x) => x.spent),
        b.map((x) => x.monthly_limit),
        "Spent",
        "Limit",
      );
    }
    if (lower.includes("goal")) {
      const goals = Store.list("goals");
      if (!goals.length) return null;
      return barCompareConfig(
        goals.map((g) => g.name),
        goals.map((g) => g.saved_amount),
        goals.map((g) => g.target_amount),
        "Saved",
        "Target",
      );
    }
    if (lower.includes("balance") || lower.includes("account")) {
      const accs = Store.list("accounts");
      return {
        type: "bar",
        data: {
          labels: accs.map((a) => a.name),
          datasets: [
            {
              label: "Balance",
              data: accs.map((a) => a.balance),
              backgroundColor: ChartTheme.palette().accent,
            },
          ],
        },
        options: ChartTheme.baseOptions(),
      };
    }
    return trendChartConfig(Store.monthlySeries(6));
  }

  function stripHtml(html) {
    const d = document.createElement("div");
    d.innerHTML = html;
    return d.textContent || "";
  }

  function persistChat() {
    persistNow();
  }

  function restoreChat() {
    /* replaced by hydrateChat() */
  }

  // Convert numbers to spoken words for natural voice output
  function numberToWords(num) {
    const ones = [
      "",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
      "eleven",
      "twelve",
      "thirteen",
      "fourteen",
      "fifteen",
      "sixteen",
      "seventeen",
      "eighteen",
      "nineteen",
    ];
    const tens = [
      "",
      "",
      "twenty",
      "thirty",
      "forty",
      "fifty",
      "sixty",
      "seventy",
      "eighty",
      "ninety",
    ];
    if (num === 0) return "zero";
    if (num < 0) return "minus " + numberToWords(-num);
    let words = "";
    if (num >= 1000000) {
      words += numberToWords(Math.floor(num / 1000000)) + " million ";
      num %= 1000000;
    }
    if (num >= 100000) {
      words += numberToWords(Math.floor(num / 1000)) + " thousand ";
      num = 0;
    } else if (num >= 1000) {
      words += numberToWords(Math.floor(num / 1000)) + " thousand ";
      num %= 1000;
    }
    if (num >= 100) {
      words += ones[Math.floor(num / 100)] + " hundred ";
      num %= 100;
    }
    if (num >= 20) {
      words += tens[Math.floor(num / 10)] + " ";
      num %= 10;
    }
    if (num > 0) {
      words += ones[num] + " ";
    }
    return words.trim();
  }

  function prepareForSpeech(text) {
    // Replace Rs 12,345 or Rs12345 style numbers with spoken words
    return text
      .replace(/Rs\.?\s?([\d,]+)/gi, (match, numStr) => {
        const n = parseInt(numStr.replace(/,/g, ""), 10);
        return "rupees " + numberToWords(n);
      })
      .replace(/(\d{1,3}(?:,\d{3})+|\d+)/g, (match) => {
        const n = parseInt(match.replace(/,/g, ""), 10);
        return isNaN(n) ? match : numberToWords(n);
      });
  }

  // ---------------- Speech synthesis (voice out) ----------------
  function speak(text) {
    const settings = Store.getSettings();
    // Speak only if voice is enabled in settings
    if (settings.voiceEnabled === false) return;
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(prepareForSpeech(text));
      utter.lang = state.lang === "ur" ? "ur-PK" : "en-US";
      utter.rate = 1;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      /* speech synthesis unsupported */
    }
  }

  // ---------------- Speech recognition (voice in) ----------------
  let recognition = null;
  function setupRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      els.input.value = transcript;
      handleUserText(transcript);
    };
    rec.onerror = () => stopListening();
    rec.onend = () => stopListening();
    return rec;
  }

  function startListening() {
    if (!recognition) recognition = setupRecognition();
    if (!recognition) {
      addMessage(
        "ai",
        "Voice input isn't supported in this browser. Try Chrome or Edge, or type your question below.",
      );
      return;
    }
    recognition.lang = state.lang === "ur" ? "ur-PK" : "en-US";
    state.listening = true;
    document
      .querySelectorAll("[data-mic]")
      .forEach((el) => el.classList.add("listening"));
    try {
      recognition.start();
    } catch (e) {
      /* already started */
    }
  }
  function stopListening() {
    state.listening = false;
    document
      .querySelectorAll("[data-mic]")
      .forEach((el) => el.classList.remove("listening"));
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {}
    }
  }
  function toggleListening() {
    state.listening ? stopListening() : startListening();
  }

  // ---------------- Chips / language toggle / wiring ----------------
  function chipButtonHtml(q) {
    const text = state.lang === "ur" ? q.ur : q.en;
    return `<button type="button" class="chip" data-chip="${escapeHtml(text)}">${escapeHtml(text)}</button>`;
  }

  function renderChips() {
    const rows = els.chipRowLines?.length
      ? els.chipRowLines
      : els.chipRow
        ? [els.chipRow]
        : [];
    if (!rows.length) return;

    const row1 = QUICK_QUESTIONS.slice(0, CHIPS_PER_ROW);
    const row2 = QUICK_QUESTIONS.slice(CHIPS_PER_ROW);

    if (rows.length >= 2) {
      rows[0].innerHTML = row1.map(chipButtonHtml).join("");
      rows[1].innerHTML = row2.map(chipButtonHtml).join("");
    } else {
      rows[0].innerHTML = QUICK_QUESTIONS.map(chipButtonHtml).join("");
    }

    rows.forEach((row) => {
      row.querySelectorAll("[data-chip]").forEach((btn) => {
        btn.addEventListener("click", () =>
          handleUserText(btn.getAttribute("data-chip")),
        );
      });
    });
  }

  function setLang(lang) {
    state.lang = lang;
    document
      .querySelectorAll("[data-lang-btn]")
      .forEach((b) =>
        b.classList.toggle("active", b.getAttribute("data-lang-btn") === lang),
      );
    document.querySelectorAll("[data-greeting-text]").forEach((el) => {
      el.textContent = greetingText(lang);
    });
    if (els.input)
      els.input.placeholder =
        lang === "ur"
          ? "اپنے finances کے بارے میں پوچھیں..."
          : "Ask about your finances...";
    renderChips();
  }

  function init() {
    Store.init();

    if (window.Store?.storageAvailable && !Store.storageAvailable()) {
      console.warn(
        "[Assistant] Browser storage is blocked. Chat history will not survive refresh. Open the app through a local web server (e.g. Live Server), not as a file:// URL.",
      );
    }

    persistKey = PERSIST_KEY;

    let isSidebar = false;
    // Check if we are on the dedicated assistant page
    els.scroll = document.getElementById("chatScroll");

    if (!els.scroll) {
      isSidebar = true;
      const sidebarHtml = `
        <div class="chat-sidebar-scrim" id="chatSidebarScrim"></div>
        <div class="chat-sidebar" id="chatSidebar">
          <div class="chat-sidebar-header">
            <div style="font-weight:700;font-size:16px;display:flex;align-items:center;gap:8px;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--accent)"><path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8L12 2z"/></svg>
              Finlytics AI
            </div>
            <button class="chat-sidebar-close" id="chatSidebarClose">&times;</button>
          </div>
          <div class="assistant-shell chat-sidebar-shell" id="sidebarShell">
            <div class="chat-scroll" id="sidebarChatScroll">
              <div class="chat-welcome" id="sidebarWelcome">
                <div class="chat-welcome-icon">F</div>
                <h2 class="chat-welcome-title">Finlytics Assistant</h2>
                <p class="chat-welcome-text" data-greeting-text>Hi, I'm your Finlytics Assistant. Ask me anything about your finances, spending, goals, budgets, or transactions.</p>
              </div>
            </div>
            <div class="chat-bottom-area">
              <div class="chat-suggestions" id="sidebarSuggestions">
                <div class="chip-row chip-row-line" id="sidebarChipRow1"></div>
                <div class="chip-row chip-row-line" id="sidebarChipRow2"></div>
              </div>
              <div class="chat-inputbar">
                <div class="chat-inputbar-inner">
                  <button class="mic-inline" data-upload title="Upload CSV/Excel">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </button>
                  <input type="file" id="sidebarChatFileInput" accept=".csv,.xlsx,.xls,.json,text/csv,application/json" hidden>
                  <button class="mic-inline" data-mic title="Voice input">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                  </button>
                  <input type="text" id="sidebarChatInput" placeholder="Ask about your finances..." autocomplete="off">
                  <button class="send-btn" id="sidebarChatSend">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML("beforeend", sidebarHtml);

      els.scroll = document.getElementById("sidebarChatScroll");
      els.input = document.getElementById("sidebarChatInput");
      els.sendBtn = document.getElementById("sidebarChatSend");
      els.suggestions = document.getElementById("sidebarSuggestions");
      els.chipRowLines = [
        document.getElementById("sidebarChipRow1"),
        document.getElementById("sidebarChipRow2"),
      ].filter(Boolean);
      els.chipRow = els.chipRowLines[0] || null;
      els.fileInput = document.getElementById("sidebarChatFileInput");

      const scrim = document.getElementById("chatSidebarScrim");
      const sidebar = document.getElementById("chatSidebar");

      const toggleSidebar = (e) => {
        if (e) e.preventDefault();
        const isOpen = sidebar.classList.contains("open");
        if (isOpen) {
          sidebar.classList.remove("open");
          scrim.classList.remove("open");
        } else {
          sidebar.classList.add("open");
          scrim.classList.add("open");
          hydrateChat();
        }
      };

      document
        .getElementById("chatSidebarClose")
        .addEventListener("click", toggleSidebar);
      scrim.addEventListener("click", toggleSidebar);

      // Intercept "Ask AI" button clicks globally
      document.querySelectorAll(".btn-ai").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          if (window.location.pathname.includes("assistant.html")) return; // let it navigate if on another page but somehow assistant.html is linked
          e.preventDefault();
          toggleSidebar();
        });
      });
    } else {
      els.input = document.getElementById("chatInput");
      els.sendBtn = document.getElementById("chatSend");
      els.suggestions = document.getElementById("chatSuggestions");
      els.chipRowLines = [
        document.getElementById("chipRow1"),
        document.getElementById("chipRow2"),
      ].filter(Boolean);
      els.chipRow = els.chipRowLines[0] || document.getElementById("chipRow");
      els.fileInput = document.getElementById("chatFileInput");
    }

    const restored = els.scroll ? hydrateChat() : false;

    els.sendBtn.addEventListener("click", () =>
      handleUserText(els.input.value),
    );
    els.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleUserText(els.input.value);
      }
    });

    document
      .querySelectorAll("[data-mic]")
      .forEach((el) => el.addEventListener("click", toggleListening));
    document.querySelectorAll("[data-upload]").forEach((el) => {
      el.addEventListener("click", () => els.fileInput?.click());
    });
    if (els.fileInput) {
      els.fileInput.addEventListener("change", () => {
        const file = els.fileInput.files?.[0];
        if (file) handleFileUpload(file);
        els.fileInput.value = "";
      });
    }
    document
      .querySelectorAll("[data-lang-btn]")
      .forEach((el) =>
        el.addEventListener("click", () =>
          setLang(el.getAttribute("data-lang-btn")),
        ),
      );

    syncChatChrome();

    if (!restored) {
      const s = Store.getSettings();
      setLang(s.language || "en");
    }

    window.addEventListener("beforeunload", persistNow);
    window.addEventListener("pagehide", persistNow);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") persistNow();
    });
    window.addEventListener("storage", (e) => {
      if (e.key !== persistKey) return;
      if (!e.newValue) {
        resetConversationUI();
        return;
      }
      if (els.scroll) {
        try {
          const parsed = JSON.parse(e.newValue);
          const session = ChatPersist.normalizeSession(parsed);
          if (
            session?.messages?.length &&
            session.messages.length > (chatSession?.messages?.length || 0)
          ) {
            chatSession = session;
            hydrateChat();
          }
        } catch (err) {
          /* ignore */
        }
      }
    });

    window.addEventListener("finlytics:chat-cleared", resetConversationUI);

    const qParam = new URLSearchParams(location.search).get("q");
    if (qParam) handleUserText(qParam);
  }

  document.addEventListener("DOMContentLoaded", init);
  window.Assistant = {
    handleUserText,
    QUICK_QUESTIONS,
    answerQuery,
    stripHtml,
    getLang: () => state.lang,
    setLangState: (lang) => {
      state.lang = lang;
    },
    resetFlow: () => {
      state.flow = null;
    },
    hasActiveFlow: () => !!state.flow,
    hydrateChat,
    persistNow,
    getSession: () => ensureChatSession(),
    resetConversationUI,
    clearAllChatHistory: () =>
      window.ChatCleanup && ChatCleanup.clearAllChatHistory(),
  };
})();
