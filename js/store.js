/* ==========================================================================
   Finlytics — Data store
   Local-storage first, Supabase optional. Every page and the assistant
   read/write through this single module so the assistant can "see" the
   same data the UI shows.
   ========================================================================== */

(function () {
  const LS_KEYS = {
    txns: "fin_transactions",
    accounts: "fin_accounts",
    budgets: "fin_budgets",
    goals: "fin_goals",
    recurring: "fin_recurring",
    settings: "fin_settings",
    chat: "fin_chat_history",
    assistantChat: "fin_assistant_chat_v2",
    reports: "fin_saved_reports"
  };

  function uid() {
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // ---------------- Seed data (mirrors the reference screenshots) ----------------
  function seedAccounts() {
    return [
      { id: uid(), name: "Cash", type: "cash", balance: 41200 },
      { id: uid(), name: "Main Bank", type: "bank", balance: 318500 },
      { id: uid(), name: "Credit Card", type: "credit_card", balance: -23400 },
      { id: uid(), name: "Savings Vault", type: "savings", balance: 156000 }
    ];
  }

  function seedTransactions(accounts) {
    const byName = Object.fromEntries(accounts.map(a => [a.name, a.id]));
    const rows = [
      ["2026-07-01", "Monthly Salary", "Salary", "Main Bank", "income", 185000],
      ["2026-07-03", "House Rent", "Rent", "Main Bank", "expense", -45000],
      ["2026-07-06", "Grocery Run", "Groceries", "Credit Card", "expense", -12500],
      ["2026-07-08", "Freelance Project", "Freelance", "Cash", "income", 32000],
      ["2026-07-11", "Dining Out", "Dining out", "Cash", "expense", -6200],
      ["2026-07-14", "Fuel & Ride", "Transport", "Credit Card", "expense", -9800],
      ["2026-07-17", "Electricity Bill", "Utilities", "Main Bank", "expense", -8400],
      ["2026-07-20", "Clothing", "Shopping", "Credit Card", "expense", -5400],
      ["2026-07-22", "Clinic Visit", "Healthcare", "Cash", "expense", -3200],
      ["2026-07-25", "Streaming Subscriptions", "Subscriptions", "Credit Card", "expense", -1800],
      ["2026-06-01", "Monthly Salary", "Salary", "Main Bank", "income", 172000],
      ["2026-06-03", "House Rent", "Rent", "Main Bank", "expense", -45000],
      ["2026-06-06", "Grocery Run", "Groceries", "Credit Card", "expense", -11800],
      ["2026-06-14", "Fuel & Ride", "Transport", "Credit Card", "expense", -9800],
      ["2026-06-17", "Electricity Bill", "Utilities", "Main Bank", "expense", -8600],
      ["2026-06-20", "Clothing", "Shopping", "Credit Card", "expense", -5400],
      ["2026-06-25", "Streaming Subscriptions", "Subscriptions", "Credit Card", "expense", -1800],
      ["2026-05-01", "Monthly Salary", "Salary", "Main Bank", "income", 172000],
      ["2026-05-03", "House Rent", "Rent", "Main Bank", "expense", -45000],
      ["2026-05-09", "Grocery Run", "Groceries", "Credit Card", "expense", -13100],
      ["2026-04-01", "Monthly Salary", "Salary", "Main Bank", "income", 172000],
      ["2026-04-03", "House Rent", "Rent", "Main Bank", "expense", -45000],
      ["2026-04-12", "Dining Out", "Dining out", "Cash", "expense", -5900],
      ["2026-03-01", "Monthly Salary", "Salary", "Main Bank", "income", 172000],
      ["2026-03-03", "House Rent", "Rent", "Main Bank", "expense", -45000],
      ["2026-03-15", "Grocery Run", "Groceries", "Credit Card", "expense", -12000],
      ["2026-02-01", "Monthly Salary", "Salary", "Main Bank", "income", 172000],
      ["2026-02-03", "House Rent", "Rent", "Main Bank", "expense", -45000]
    ];
    return rows.map(r => ({
      id: uid(), date: r[0], description: r[1], category: r[2],
      account_id: byName[r[3]] || null, account_name: r[3],
      type: r[4], amount: r[5], source: "manual"
    }));
  }

  function seedBudgets() {
    return [
      { id: uid(), category: "Groceries", monthly_limit: 55000 },
      { id: uid(), category: "Dining out", monthly_limit: 15000 },
      { id: uid(), category: "Transport", monthly_limit: 12000 },
      { id: uid(), category: "Shopping", monthly_limit: 8000 }
    ];
  }

  function seedGoals() {
    return [
      { id: uid(), name: "Emergency Fund", target_amount: 300000, saved_amount: 156000, target_date: "2026-12-31" },
      { id: uid(), name: "Vacation", target_amount: 100000, saved_amount: 28000, target_date: "2026-11-01" }
    ];
  }

  function seedRecurring() {
    return [
      { id: uid(), description: "House Rent", category: "Rent", amount: -45000, frequency: "monthly", next_date: "2026-08-03" },
      { id: uid(), description: "Streaming Subscriptions", category: "Subscriptions", amount: -1800, frequency: "monthly", next_date: "2026-08-25" },
      { id: uid(), description: "Monthly Salary", category: "Salary", amount: 185000, frequency: "monthly", next_date: "2026-08-01" }
    ];
  }

  function init() {
    if (!localStorage.getItem(LS_KEYS.accounts)) {
      const accounts = seedAccounts();
      write(LS_KEYS.accounts, accounts);
      write(LS_KEYS.txns, seedTransactions(accounts));
      write(LS_KEYS.budgets, seedBudgets());
      write(LS_KEYS.goals, seedGoals());
      write(LS_KEYS.recurring, seedRecurring());
    }
    if (!localStorage.getItem(LS_KEYS.settings)) {
      write(LS_KEYS.settings, {
        businessName: "Talha",
        theme: "light",
        language: "en",
        speakReplies: true,
        speechEngine: "browser",
        showSqlByDefault: false,
        autoCharts: true,
        dailyEmailSummary: false,
        supabaseUrl: "",
        supabaseAnonKey: "",
        aiApiKey: ""
      });
    }
  }

  // ---------------- Generic CRUD ----------------
  function list(key) { return read(LS_KEYS[key], []); }
  function saveList(key, arr) { write(LS_KEYS[key], arr); notifyChange(key); }

  function notifyChange(key) {
    try {
      window.dispatchEvent(new CustomEvent("finlytics:data-changed", { detail: { key } }));
    } catch (e) { /* ignore */ }
    if (window.Nav) {
      Nav.notifBadge && Nav.notifBadge();
      Nav.setUserChip && Nav.setUserChip();
    }
  }

  function add(key, item) {
    const arr = list(key);
    item.id = item.id || uid();
    item.created_at = item.created_at || new Date().toISOString();
    arr.unshift(item);
    saveList(key, arr);
    Store.pushToSupabase(key, item);
    return item;
  }
  function update(key, id, patch) {
    const arr = list(key);
    const i = arr.findIndex(x => x.id === id);
    if (i > -1) { arr[i] = { ...arr[i], ...patch }; saveList(key, arr); }
    return arr[i];
  }
  function remove(key, id) {
    saveList(key, list(key).filter(x => x.id !== id));
  }

  function getSettings() {
    const s = read(LS_KEYS.settings, {});
    if (s.speakReplies !== undefined && s.voiceEnabled === undefined) s.voiceEnabled = s.speakReplies;
    return s;
  }
  function saveSettings(patch) {
    const s = { ...getSettings(), ...patch };
    write(LS_KEYS.settings, s);
    notifyChange("settings");
    return s;
  }

  // ---------------- Domain services (shared by UI + assistant) ----------------
  function findAccountByName(name) {
    if (!name) return null;
    const n = String(name).toLowerCase().trim();
    const accs = list("accounts");
    return accs.find(a => a.name.toLowerCase() === n)
      || accs.find(a => a.name.toLowerCase().includes(n) || n.includes(a.name.toLowerCase()))
      || null;
  }

  function applyBalanceDelta(accountId, delta) {
    if (!accountId || !delta) return;
    const acc = list("accounts").find(a => a.id === accountId);
    if (acc) update("accounts", accountId, { balance: Number(acc.balance || 0) + Number(delta) });
  }

  function addTransaction(txn) {
    const item = {
      date: txn.date || new Date().toISOString().slice(0, 10),
      description: txn.description || "Transaction",
      category: txn.category || "Other",
      account_id: txn.account_id || null,
      account_name: txn.account_name || "",
      type: txn.type || (Number(txn.amount) >= 0 ? "income" : "expense"),
      amount: Number(txn.amount) || 0,
      source: txn.source || "manual",
      id: txn.id || uid(),
      created_at: txn.created_at || new Date().toISOString()
    };
    if (item.account_id) applyBalanceDelta(item.account_id, item.amount);
    const arr = list("txns");
    arr.unshift(item);
    saveList("txns", arr);
    pushToSupabase("txns", item);
    return item;
  }

  function updateTransaction(id, patch) {
    const arr = list("txns");
    const i = arr.findIndex(x => x.id === id);
    if (i < 0) return null;
    const prev = arr[i];
    const next = { ...prev, ...patch };
    if (patch.amount !== undefined) {
      next.amount = Number(patch.amount);
      if (!patch.type) next.type = next.amount >= 0 ? "income" : "expense";
    }
    if (prev.account_id && (patch.amount !== undefined || patch.account_id !== undefined)) {
      applyBalanceDelta(prev.account_id, -Number(prev.amount || 0));
    }
    if (next.account_id && (patch.amount !== undefined || patch.account_id !== undefined)) {
      applyBalanceDelta(next.account_id, Number(next.amount || 0));
    }
    arr[i] = next;
    saveList("txns", arr);
    return next;
  }

  function removeTransaction(id) {
    const arr = list("txns");
    const txn = arr.find(x => x.id === id);
    if (txn?.account_id) applyBalanceDelta(txn.account_id, -Number(txn.amount || 0));
    saveList("txns", arr.filter(x => x.id !== id));
  }

  function transferBetweenAccounts(fromRef, toRef, amount) {
    const from = typeof fromRef === "string" ? findAccountByName(fromRef) : fromRef;
    const to = typeof toRef === "string" ? findAccountByName(toRef) : toRef;
    const amt = Math.abs(Number(amount) || 0);
    if (!from || !to) throw new Error("Could not find both accounts.");
    if (from.id === to.id) throw new Error("Cannot transfer to the same account.");
    if (amt <= 0) throw new Error("Transfer amount must be greater than zero.");
    update("accounts", from.id, { balance: Number(from.balance || 0) - amt });
    update("accounts", to.id, { balance: Number(to.balance || 0) + amt });
    notifyChange("accounts");
    return { from: from.name, to: to.name, amount: amt };
  }

  function searchTransactions(query, opts = {}) {
    const limit = opts.limit || 20;
    let rows = list("txns");
    const q = String(query || "").toLowerCase().trim();
    if (opts.category) rows = rows.filter(t => (t.category || "").toLowerCase().includes(String(opts.category).toLowerCase()));
    if (opts.month) rows = rows.filter(t => monthKey(t.date) === opts.month);
    if (opts.type === "income") rows = rows.filter(t => t.amount > 0);
    if (opts.type === "expense") rows = rows.filter(t => t.amount < 0);
    if (opts.lastMonth) {
      const months = lastNMonths(2);
      rows = rows.filter(t => monthKey(t.date) === months[months.length - 2]);
    }
    if (q) {
      rows = rows.filter(t =>
        (t.description || "").toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q) ||
        (t.account_name || "").toLowerCase().includes(q)
      );
    }
    return rows.slice(0, limit);
  }

  function txnFingerprint(t) {
    return [t.date, t.description, t.category, t.amount, t.account_id].join("|").toLowerCase();
  }

  function isDuplicateTransaction(txn) {
    const fp = txnFingerprint(txn);
    return list("txns").some(t => txnFingerprint(t) === fp);
  }

  function budgetRemaining(category) {
    const health = budgetHealth();
    if (category) {
      const c = String(category).toLowerCase();
      return health.find(b => b.category.toLowerCase().includes(c) || c.includes(b.category.toLowerCase()));
    }
    return health;
  }

  function goalProgress(name) {
    const goals = list("goals");
    if (!name) return goals;
    const n = String(name).toLowerCase();
    return goals.find(g => g.name.toLowerCase().includes(n) || n.includes(g.name.toLowerCase()));
  }

  // ---------------- Analytics helpers (used by dashboard/analytics/assistant) ----------------
  function monthKey(dateStr) { return dateStr.slice(0, 7); } // YYYY-MM

  function lastNMonths(n) {
    const out = [];
    const d = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(dt.toISOString().slice(0, 7));
    }
    return out;
  }

  function monthLabel(ym) {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("en", { month: "short" });
  }

  function summary(months = 6) {
    const txns = list("txns");
    const monthSet = new Set(lastNMonths(months));
    const inRange = txns.filter(t => monthSet.has(monthKey(t.date)));
    const income = inRange.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expense = inRange.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    return {
      income, expense, net: income - expense,
      savingsRate: income > 0 ? (((income - expense) / income) * 100) : 0
    };
  }

  function monthlySeries(months = 6) {
    const txns = list("txns");
    const keys = lastNMonths(months);
    return keys.map(k => {
      const rows = txns.filter(t => monthKey(t.date) === k);
      const income = rows.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const expense = rows.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      return { month: k, label: monthLabel(k), income, expense, net: income - expense };
    });
  }

  function expensesByCategory(months = 6) {
    const txns = list("txns");
    const monthSet = new Set(lastNMonths(months));
    const map = {};
    txns.filter(t => t.amount < 0 && monthSet.has(monthKey(t.date))).forEach(t => {
      map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([category, total]) => ({ category, total }));
  }

  function netWorthSeries(months = 6) {
    const series = monthlySeries(months);
    let running = 0;
    return series.map(m => { running += m.net; return { ...m, netWorth: running }; });
  }

  function accountsTotal() {
    return list("accounts").reduce((s, a) => s + Number(a.balance || 0), 0);
  }

  function budgetHealth() {
    const ym = new Date().toISOString().slice(0, 7);
    const txns = list("txns").filter(t => monthKey(t.date) === ym && t.amount < 0);
    return list("budgets").map(b => {
      const spent = txns.filter(t => t.category === b.category).reduce((s, t) => s + Math.abs(t.amount), 0);
      return { ...b, spent, pct: Math.min(100, (spent / b.monthly_limit) * 100) };
    });
  }

  // ---------------- Optional Supabase sync ----------------
  let supaClient = null;
  function supabaseEnabled() {
    const s = getSettings();
    const cfg = window.FINLYTICS_CONFIG || {};
    return !!((s.supabaseUrl || cfg.SUPABASE_URL) && (s.supabaseAnonKey || cfg.SUPABASE_ANON_KEY) && window.supabase);
  }
  function getSupabaseClient() {
    if (!supabaseEnabled()) return null;
    if (supaClient) return supaClient;
    const s = getSettings();
    const cfg = window.FINLYTICS_CONFIG || {};
    const url = s.supabaseUrl || cfg.SUPABASE_URL;
    const key = s.supabaseAnonKey || cfg.SUPABASE_ANON_KEY;
    try { supaClient = window.supabase.createClient(url, key); } catch (e) { supaClient = null; }
    return supaClient;
  }
  const TABLE_MAP = { txns: "transactions", accounts: "accounts", budgets: "budgets", goals: "goals", recurring: "recurring_items", reports: "saved_reports" };
  async function pushToSupabase(key, item) {
    const client = getSupabaseClient();
    const table = TABLE_MAP[key];
    if (!client || !table) return;
    try { await client.from(table).upsert(item); } catch (e) { console.warn("Supabase sync skipped:", e.message); }
  }
  async function pullFromSupabase() {
    const client = getSupabaseClient();
    if (!client) return false;
    try {
      for (const [key, table] of Object.entries(TABLE_MAP)) {
        const { data, error } = await client.from(table).select("*");
        if (!error && data) saveList(key, data);
      }
      return true;
    } catch (e) { console.warn("Supabase pull failed:", e.message); return false; }
  }

  // ---------------- Assistant chat session (same key as ChatPersist) ----------------
  function getChatSession() {
    return read(LS_KEYS.assistantChat, null);
  }

  function saveChatSession(session, opts = {}) {
    if (!session || typeof session !== "object") return false;
    if (!session.messages?.length && !opts.allowEmpty) {
      const existing = getChatSession();
      if (existing?.messages?.length) return false;
    }
    try {
      write(LS_KEYS.assistantChat, session);
      return true;
    } catch (e) {
      console.warn("[Store] Chat session save failed:", e.message);
      return false;
    }
  }

  function storageAvailable() {
    try {
      const k = "__finlytics_storage_test";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearAllChatHistory() {
    if (window.ChatCleanup) return ChatCleanup.clearAllChatHistory();
    return { success: false };
  }

  window.Store = {
    init,
    uid,
    list, add, update, remove,
    getSettings, saveSettings,
    summary, monthlySeries, expensesByCategory, netWorthSeries,
    accountsTotal, budgetHealth, lastNMonths, monthLabel, monthKey,
    findAccountByName, applyBalanceDelta, addTransaction, updateTransaction, removeTransaction,
    transferBetweenAccounts, searchTransactions, isDuplicateTransaction, budgetRemaining, goalProgress,
    supabaseEnabled, pushToSupabase, pullFromSupabase, notifyChange,
    getChatSession, saveChatSession, storageAvailable, clearAllChatHistory
  };
})();
