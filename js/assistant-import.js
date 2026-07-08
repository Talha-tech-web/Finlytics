/* Finlytics — Assistant file import: CSV/Excel/JSON schema inference & normalization */
(function () {
  const COLUMN_ALIASES = {
    date: ["date", "date_paid", "paid_on", "transaction_date", "txn_date", "when", "posted", "time", "day"],
    amount: ["amount", "money", "value", "sum", "total", "amt", "price", "cost", "debit", "credit", "payment", "spent"],
    category: ["category", "type", "cat", "group", "expense_type", "class", "tag", "category_name"],
    description: ["description", "desc", "memo", "note", "details", "narration", "title", "name", "merchant", "payee", "client", "customer"],
    account: ["account", "account_name", "wallet", "bank", "source", "from_account"],
    type: ["type", "txn_type", "transaction_type", "in_out", "direction"]
  };

  function normHeader(h) {
    return String(h || "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  }

  function inferMapping(headers) {
    const mapping = {};
    const normalized = headers.map(normHeader);
    Object.entries(COLUMN_ALIASES).forEach(([field, aliases]) => {
      for (let i = 0; i < normalized.length; i++) {
        const h = normalized[i];
        if (aliases.some(a => h === a || h.includes(a) || levenshtein(h, a) <= 1)) {
          mapping[field] = headers[i];
          break;
        }
      }
    });
    return mapping;
  }

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

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return { headers: [], rows: [] };
    const headers = splitCSVLine(lines[0]);
    const rows = lines.slice(1).map(line => {
      const cells = splitCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = cells[i] ?? ""; });
      return obj;
    });
    return { headers, rows };
  }

  function splitCSVLine(line) {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { out.push(cur.trim()); cur = ""; continue; }
      cur += c;
    }
    out.push(cur.trim());
    return out;
  }

  function parseExcel(buffer) {
    if (!window.XLSX) throw new Error("Excel support not loaded");
    const wb = XLSX.read(buffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (!json.length) return { headers: [], rows: [] };
    const headers = Object.keys(json[0]);
    return { headers, rows: json };
  }

  function parseJSON(text) {
    const data = JSON.parse(text);
    const rows = Array.isArray(data) ? data : (data.transactions || data.rows || data.data || []);
    if (!rows.length) return { headers: [], rows: [] };
    const headers = Object.keys(rows[0]);
    return { headers, rows };
  }

  function parseDate(val) {
    if (!val) return new Date().toISOString().slice(0, 10);
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
  }

  function parseAmount(val) {
    if (val == null || val === "") return 0;
    const n = parseFloat(String(val).replace(/[Rs,\s]/gi, ""));
    return isNaN(n) ? 0 : n;
  }

  function normalizeRows(rows, mapping) {
    const accs = Store.list("accounts");
    const defaultAcc = accs.find(a => a.type === "bank") || accs[0];
    return rows.map(row => {
      const get = (field) => {
        const col = mapping[field];
        return col ? row[col] : "";
      };
      let amount = parseAmount(get("amount"));
      let type = String(get("type") || "").toLowerCase();
      if (!type) type = amount >= 0 ? "income" : "expense";
      if (type.includes("exp") || type.includes("debit") || type === "out") amount = -Math.abs(amount);
      else if (type.includes("inc") || type.includes("credit") || type === "in") amount = Math.abs(amount);
      else if (amount < 0) type = "expense";
      else type = "income";

      const accountName = get("account") || defaultAcc?.name || "Cash";
      const acc = accs.find(a => a.name.toLowerCase() === String(accountName).toLowerCase()) || defaultAcc;
      const category = get("category") || "Imported";
      const description = get("description") || category || "Imported transaction";

      return {
        date: parseDate(get("date")),
        description: String(description).slice(0, 120),
        category: String(category).slice(0, 60),
        account_id: acc?.id || null,
        account_name: acc?.name || accountName,
        type: type.includes("inc") ? "income" : (amount >= 0 && type === "income" ? "income" : "expense"),
        amount: type === "income" || amount > 0 && !type.includes("exp") ? Math.abs(amount) : -Math.abs(amount),
        source: "import"
      };
    }).filter(r => r.amount !== 0);
  }

  function importToStore(rows, mapping) {
    const normalized = normalizeRows(rows, mapping);
    let added = 0;
    let skipped = 0;
    normalized.forEach(r => {
      if (Store.isDuplicateTransaction && Store.isDuplicateTransaction(r)) {
        skipped++;
        return;
      }
      if (Store.addTransaction) Store.addTransaction(r);
      else Store.add("txns", r);
      added++;
    });
    Store.notifyChange && Store.notifyChange("txns");
    return { added, skipped, mapping, sample: normalized.slice(0, 3) };
  }

  async function importFile(file) {
    const name = (file.name || "").toLowerCase();
    let parsed;
    if (name.endsWith(".csv") || file.type === "text/csv") {
      parsed = parseCSV(await file.text());
    } else if (name.endsWith(".json") || file.type === "application/json") {
      parsed = parseJSON(await file.text());
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls") || file.type.includes("sheet")) {
      parsed = parseExcel(await file.arrayBuffer());
    } else {
      throw new Error("Unsupported file type. Use CSV, JSON, or Excel (.xlsx).");
    }
    if (!parsed.rows.length) throw new Error("No data rows found in file.");
    const mapping = inferMapping(parsed.headers);
    if (!mapping.amount && !mapping.date) {
      throw new Error("Could not detect amount or date columns. Headers: " + parsed.headers.join(", "));
    }
    const result = importToStore(parsed.rows, mapping);
    return { ...result, headers: parsed.headers, totalRows: parsed.rows.length };
  }

  window.AssistantImport = {
    COLUMN_ALIASES,
    inferMapping,
    parseCSV,
    parseExcel,
    parseJSON,
    normalizeRows,
    importToStore,
    importFile
  };
})();
