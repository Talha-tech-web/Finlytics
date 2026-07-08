/* Finlytics — Assistant NLU: normalization, fuzzy matching, intent detection */
(function () {
  const TYPO_MAP = {
    buget: "budget", budgt: "budget", bugett: "budget", expence: "expense", expenes: "expense",
    expns: "expense", expens: "expense", tranaction: "transaction", transction: "transaction",
    transacion: "transaction", acount: "account", accnt: "account", balnce: "balance",
    savngs: "savings", catagory: "category", categry: "category", incme: "income", salry: "salary",
    analyize: "analyze", anlyze: "analyze", spnding: "spending", spening: "spending",
    grocries: "groceries", grocieries: "groceries", grocry: "grocery", trasfer: "transfer",
    cheking: "checking", savng: "saving", remaning: "remaining", remining: "remaining"
  };

  const INTENTS = [
    { id: "greeting", patterns: [/^(hi|hello|hey|hlo|salaam|assalam|how are you|who are you)/], weight: 1 },
    { id: "transfer", patterns: [/\btransfer\b.{0,40}\d/, /\bmove\b.{0,25}\d.{0,25}(from|to)/, /\bfrom\b.{0,30}\bto\b.{0,30}\d/], weight: 3.5 },
    { id: "create_entity", patterns: [/\b(add|create|new|set up|make|record)\b.{0,25}\b(budget|goal|transaction|expense|income|account|transfer)\b/, /\b(budget|goal|transaction|expense|income|account)\b.{0,20}\b(add|create|new)\b/], weight: 2 },
    { id: "edit_entity", patterns: [/\b(edit|change|update|modify|rename|adjust|increase|decrease)\b.{0,30}\b(budget|goal|transaction|account|setting|settings|limit|name)\b/, /\bfrom\s+\d+\s+to\s+\d+/], weight: 2.5 },
    { id: "delete_entity", patterns: [/\b(delete|remove|clear|drop|erase)\b.{0,30}\b(budget|goal|transaction|account|wallet)\b/], weight: 2 },
    { id: "quick_transaction", patterns: [/\b(add|record|log)\b.{0,12}\b(expense|income|spent|paid|received)\b.{0,40}\d/, /\b(expense|income)\b.{0,10}\b\d{2,}/, /\badd\s+\d{2,}/], weight: 3 },
    { id: "spending_category", patterns: [/\b(category|categories|breakdown|break down|spending by|expenses by)\b/, /\banalyz/, /\bwhere.*(money|spending)/], weight: 2 },
    { id: "income_month", patterns: [/\b(income|salary|earn|made|received).*(month|this month|last month)/, /\bhow much.*(make|earn|income)/], weight: 2 },
    { id: "expense_month", patterns: [/\b(spent|spend|expense|expens).*(month|this month|last month)/, /\bhow much.*(spend|spent)/], weight: 2 },
    { id: "trend", patterns: [/\b(trend|income vs expense|vs expense|over time|monthly spending trend)\b/], weight: 2 },
    { id: "compare_months", patterns: [/\b(compare|vs last month|this month.*last month|month over month)\b/], weight: 2 },
    { id: "accounts", patterns: [/\b(account|accounts|balance|balances|wallet|cash situation|wallet details|show my wallet)\b/], weight: 2 },
    { id: "remaining_balance", patterns: [/\bhow much money left\b/, /\bremaining balance\b/, /\bmoney left\b/, /\bbachat kitni\b/, /\bmeri saving\b/, /\bsaving kitni\b/], weight: 3 },
    { id: "net_worth", patterns: [/\bnet worth\b/], weight: 2 },
    { id: "budget_status", patterns: [/\bbudget/, /\bover budget/, /\blimit/, /\bremaining budget\b/, /\bexceeding\b/], weight: 1.5 },
    { id: "goals", patterns: [/\b(goal|goals|savings goal|save for|goal progress|how much more.*save)\b/], weight: 2 },
    { id: "recent_txns", patterns: [/\b(recent|latest|last)\s*\d*\s*(transaction|txn|payment)/, /\bshow.*transaction/, /\blast\s+\d+\s+transaction/], weight: 2.5 },
    { id: "search_txns", patterns: [/\b(search|find|filter).*(transaction|txn|expense|payment)/], weight: 2.5 },
    { id: "summary", patterns: [/\b(summary|overview|how am i doing|profit|loss|p and l|financial summary)\b/], weight: 2 },
    { id: "losing_money", patterns: [/\b(losing money|why.*losing|negative|shortfall|why.*expenses.*increas)/], weight: 2 },
    { id: "report_export", patterns: [/\b(generate|export|show|print).*(report|summary|statement|yearly|monthly)/], weight: 3 },
    { id: "settings_theme", patterns: [/\b(dark mode|light mode|switch theme|enable dark|disable dark|change theme)\b/], weight: 3 },
    { id: "settings_language", patterns: [/\b(urdu|english|switch language|change language)\b/], weight: 3 },
    { id: "settings_voice", patterns: [/\b(voice|speak|speech|notification).*(on|off|enable|disable)/], weight: 3 },
    { id: "settings_name", patterns: [/\b(change|rename|set|update).*(business name|app name|my name|profile name)\b/], weight: 3 },
    { id: "import_file", patterns: [/\b(import|upload|load).*(csv|excel|json|file|spreadsheet|data)\b/], weight: 3 }
  ];

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = i - 1;
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const val = a[i - 1] === b[j - 1] ? prev : Math.min(prev, row[j], row[j - 1]) + 1;
        prev = row[j];
        row[j] = val;
      }
    }
    return row[b.length];
  }

  function normalize(text) {
    let t = String(text || "").toLowerCase()
      .replace(/[؟?.!,;:'"]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    Object.entries(TYPO_MAP).forEach(([bad, good]) => {
      t = t.replace(new RegExp("\\b" + bad + "\\b", "g"), good);
    });
    return t;
  }

  function fuzzyIncludes(text, keyword, maxDist) {
    const words = text.split(/\s+/);
    const kw = keyword.toLowerCase();
    if (text.includes(kw)) return true;
    return words.some(w => w.length >= 3 && levenshtein(w, kw) <= (maxDist || 2));
  }

  function fuzzyAny(text, keywords, maxDist) {
    return keywords.some(k => fuzzyIncludes(text, k, maxDist));
  }

  function detectIntent(text) {
    const n = normalize(text);
    let best = null;
    for (const intent of INTENTS) {
      for (const re of intent.patterns) {
        if (re.test(n)) {
          const score = intent.weight || 1;
          if (!best || score > best.score) best = { id: intent.id, score, normalized: n };
        }
      }
    }
    return best;
  }

  function extractAmount(text) {
    const amounts = String(text || "").match(/(?:rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)/gi);
    if (!amounts || !amounts.length) return null;
    const last = amounts[amounts.length - 1].replace(/rs\.?\s*/i, "").replace(/,/g, "");
    const n = parseFloat(last);
    return isNaN(n) ? null : n;
  }

  function extractLimitCount(text) {
    const m = normalize(text).match(/\b(?:last|recent|latest)\s+(\d{1,3})\b/);
    return m ? parseInt(m[1], 10) : null;
  }

  function extractEntityType(text) {
    const n = normalize(text);
    if (/\btransaction|\bexpense|\bincome|\btxn\b/.test(n)) return "transaction";
    if (/\bbudget/.test(n)) return "budget";
    if (/\bgoal/.test(n)) return "goal";
    if (/\baccount|\bwallet/.test(n)) return "account";
    if (/\bsetting/.test(n)) return "settings";
    return null;
  }

  function extractAccountNames(text) {
    const accs = window.Store ? Store.list("accounts") : [];
    const n = normalize(text);
    const fromTo = n.match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s+\d|$)/);
    if (fromTo) {
      const from = accs.find(a => fromTo[1].includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(fromTo[1].trim()));
      const to = accs.find(a => fromTo[2].includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(fromTo[2].trim()));
      return { from, to, all: [from, to].filter(Boolean) };
    }
    const all = accs.filter(a => n.includes(a.name.toLowerCase()));
    return { from: all[0] || null, to: all[1] || null, all };
  }

  function parseTransfer(text) {
    const amount = extractAmount(text);
    if (!amount) return null;
    const { from, to } = extractAccountNames(text);
    if (!from || !to) return null;
    return { from: from.name, to: to.name, amount };
  }

  function parseBudgetCreate(text) {
    const n = normalize(text);
    if (!/\bbudget\b/.test(n)) return null;
    const amount = extractAmount(text);
    if (!amount) return null;
    const cats = ["groceries", "food", "transport", "dining", "shopping", "utilities", "rent", "entertainment", "healthcare"];
    let category = null;
    for (const c of cats) {
      if (n.includes(c)) {
        category = c === "food" ? "Groceries" : c[0].toUpperCase() + c.slice(1);
        break;
      }
    }
    const forMatch = n.match(/\b(?:for|on)\s+([a-z][a-z\s]{1,24}?)(?:\s+budget|\s+of|\s+\d|$)/);
    if (forMatch) category = forMatch[1].trim().split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    if (!category) return null;
    return { category, monthly_limit: amount };
  }

  function parseGoalCreate(text) {
    const n = normalize(text);
    if (!/\bgoal\b/.test(n)) return null;
    const amount = extractAmount(text);
    if (!amount) return null;
    const forMatch = n.match(/\b(?:for|goal)\s+([a-z][a-z0-9\s]{1,30}?)(?:\s+(?:for|goal|of|\d)|$)/i);
    let name = forMatch ? forMatch[1].trim() : "New Goal";
    name = name.replace(/\b(saving|save|goal)\b/gi, "").trim() || "New Goal";
    name = name.split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    return { name, target_amount: amount, target_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10) };
  }

  function parseQuickTransaction(text) {
    const n = normalize(text);
    const amount = extractAmount(n);
    if (!amount) return null;
    const isIncome = /\b(income|salary|received|earned|deposit|credit)\b/.test(n);
    const type = isIncome ? "income" : "expense";
    const cats = ["groceries", "grocery", "rent", "transport", "utilities", "dining", "shopping", "subscriptions", "healthcare", "salary", "freelance", "food"];
    let category = "General";
    for (const c of cats) {
      if (n.includes(c)) {
        category = c === "dining" ? "Dining out" : (c === "grocery" || c === "food" ? "Groceries" : c[0].toUpperCase() + c.slice(1));
        break;
      }
    }
    const forMatch = n.match(/\b(?:for|on|in|at)\s+([a-z][a-z\s]{1,20})/);
    if (forMatch) {
      const raw = forMatch[1].trim();
      if (!/\d/.test(raw)) category = raw.split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    }
    const names = extractAccountNames(text);
    const account = names.all[0] || (window.Store ? Store.list("accounts").find(a => a.type === "cash") : null) || (window.Store ? Store.list("accounts")[0] : null);
    return { type, amount, category, account_name: account?.name || "Cash", account_id: account?.id || null };
  }

  window.AssistantNLU = {
    normalize,
    levenshtein,
    fuzzyIncludes,
    fuzzyAny,
    detectIntent,
    extractAmount,
    extractLimitCount,
    extractEntityType,
    extractAccountNames,
    parseTransfer,
    parseBudgetCreate,
    parseGoalCreate,
    parseQuickTransaction
  };
})();
