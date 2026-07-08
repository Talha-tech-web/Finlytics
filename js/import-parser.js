/*  Finlytics — Smart file importer */

(function () {
  const FIELD_SYNONYMS = {
    date: ["date", "txndate", "transactiondate", "postingdate", "valuedate", "createdat", "time", "datetime", "day"],
    description: ["description", "desc", "narration", "details", "memo", "particulars", "note", "notes", "title", "merchant", "payee", "name", "item", "reference"],
    amount: ["amount", "amt", "total", "totalamount", "value", "netamount", "grandtotal", "sum", "price"],
    type: ["type", "txntype", "transactiontype", "incomeexpense", "entrytype", "direction", "categoryofflow"],
    category: ["category", "cat", "expensecategory", "productcategory", "group", "tag"],
    account: ["account", "acc", "accountname", "wallet", "bank", "sourceaccount", "card"]
  };

  const CATEGORY_KEYWORDS = [
    ["Salary", /salary|payroll|wages/i],
    ["Freelance", /freelance|contract|gig/i],
    ["Groceries", /grocery|groceries|supermarket|mart\b/i],
    ["Rent", /\brent\b|lease/i],
    ["Dining out", /restaurant|dining|cafe|coffee|food\s?panda|takeaway|takeout/i],
    ["Transport", /fuel|petrol|uber|careem|taxi|ride|transport/i],
    ["Utilities", /electric|gas bill|water bill|utility|utilities|internet|wifi/i],
    ["Shopping", /shopping|mall|clothing|apparel|amazon|daraz/i],
    ["Healthcare", /clinic|hospital|pharmacy|doctor|medicine|health/i],
    ["Subscriptions", /netflix|spotify|subscription|prime|youtube premium/i]
  ];

  function normalizeHeader(hd) {
    return String(hd || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  /* Robustly parse an amount value that may include currency symbols/labels
     ("Rs. 1,200.50", "PKR 500", "$45.00"), thousands separators, or
     accounting-style negatives like "(200)". Returns 0 (not NaN) for
     anything unparseable so a single bad cell can't wreck a whole import. */
  function parseAmount(raw) {
    if (raw === undefined || raw === null || raw === "") return 0;
    if (typeof raw === "number") return isNaN(raw) ? 0 : raw;
    const s = String(raw).trim();
    if (!s) return 0;
    const isNegative = /^\(.*\)$/.test(s) || /-/.test(s.replace(/[\d.,\s]/g, ""));
    const match = s.match(/\d[\d,]*\.?\d*/);
    if (!match) return 0;
    const num = parseFloat(match[0].replace(/,/g, ""));
    if (isNaN(num)) return 0;
    return isNegative ? -num : num;
  }

  function parseDateValue(raw) {
    if (raw instanceof Date && !isNaN(raw)) return raw.toISOString().slice(0, 10);
    if (raw === undefined || raw === null || raw === "") return new Date().toISOString().slice(0, 10);
    const s = String(raw).trim();
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      let [, dd, mm, yy] = m;
      if (yy.length === 2) yy = "20" + yy;
      const d2 = new Date(`${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`);
      if (!isNaN(d2)) return d2.toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  }

  function mapFieldsToSchema(headers) {
    const normHeaders = headers.map(hd => ({ raw: hd, norm: normalizeHeader(hd) }));
    const map = {};
    const used = new Set();
    const fields = Object.keys(FIELD_SYNONYMS);

    fields.forEach(field => {
      const hit = normHeaders.find(hh => !used.has(hh.raw) && FIELD_SYNONYMS[field].includes(hh.norm));
      if (hit) { map[field] = hit.raw; used.add(hit.raw); }
    });

    fields.forEach(field => {
      if (map[field]) return;
      let best = null, bestScore = 0;
      normHeaders.forEach(hh => {
        if (used.has(hh.raw)) return;
        FIELD_SYNONYMS[field].forEach(syn => {
          if (hh.norm.includes(syn) || syn.includes(hh.norm)) {
            const score = Math.min(hh.norm.length, syn.length) / Math.max(hh.norm.length, syn.length);
            if (score > bestScore) { bestScore = score; best = hh; }
          }
        });
      });
      if (best && bestScore > 0.4) { map[field] = best.raw; used.add(best.raw); }
    });

    return map;
  }

  function pruneJunkColumns(rawRows, headers) {
    const useful = headers.filter(hd => {
      const clean = String(hd || "").trim();
      if (!clean) return false;
      return rawRows.some(r => { const v = r[hd]; return v !== undefined && v !== null && String(v).trim() !== ""; });
    });
    return useful.length ? useful : headers;
  }

  // Keyword guess first against categories the user already uses, then
  // against a general dictionary, so imports stay consistent with existing
  // budgets/reports instead of spawning near-duplicate category names.
  function suggestCategory(description, existingCategories) {
    const text = (description || "").toLowerCase();
    const known = existingCategories.find(c => text.includes(c.toLowerCase()));
    if (known) return known;
    const hit = CATEGORY_KEYWORDS.find(([, re]) => re.test(text));
    return hit ? hit[0] : "Other";
  }

  function normalizeRows(rawRows, colMap, existingCategories, accounts) {
    const out = [];
    rawRows.forEach(row => {
      const get = field => { const col = colMap[field]; return col ? row[col] : undefined; };

      // Some bank/card exports split money movement into two separate
      // columns (Debit/Credit) instead of one signed "amount" column.
      const debitCol = Object.keys(row).find(k => ["debit", "withdrawal", "moneyout", "paidout"].includes(normalizeHeader(k)));
      const creditCol = Object.keys(row).find(k => ["credit", "deposit", "moneyin", "paidin"].includes(normalizeHeader(k)));
      let amount, typeFromSplit = null;
      if (debitCol || creditCol) {
        const debit = debitCol ? parseAmount(row[debitCol]) : 0;
        const credit = creditCol ? parseAmount(row[creditCol]) : 0;
        if (Math.abs(debit) > 0) { amount = -Math.abs(debit); typeFromSplit = "expense"; }
        else if (Math.abs(credit) > 0) { amount = Math.abs(credit); typeFromSplit = "income"; }
        else amount = 0;
      } else {
        amount = parseAmount(get("amount"));
      }

      let type;
      const typeRaw = get("type");
      if (typeFromSplit) {
        type = typeFromSplit;
      } else if (typeRaw) {
        const t = String(typeRaw).toLowerCase();
        type = (t.includes("exp") || t.includes("debit") || t.includes("purchase") || t.includes("withdraw") || t.includes("out")) ? "expense" : "income";
        amount = type === "expense" ? -Math.abs(amount) : Math.abs(amount);
      } else {
        type = amount < 0 ? "expense" : "income";
      }

      const description = String(get("description") || "").trim() || "Imported transaction";
      if (amount === 0 && description === "Imported transaction") return; // fully-empty row, skip

      const catName = String(get("category") || "").trim();
      const category = catName || suggestCategory(description, existingCategories);

      const accName = String(get("account") || "").trim();
      const acc = (accName && accounts.find(a => a.name.toLowerCase() === accName.toLowerCase())) || accounts[0];

      out.push({
        date: parseDateValue(get("date")),
        description,
        category,
        account_id: acc ? acc.id : null,
        account_name: acc ? acc.name : "Imported",
        type,
        amount,
        source: "import"
      });
    });
    return out;
  }

  function buildParsedResult(json, existingCategories, accounts) {
    if (!json.length) throw new Error("This file appears to be empty.");
    const rawHeaders = Object.keys(json[0]);
    const headers = pruneJunkColumns(json, rawHeaders);
    const colMap = mapFieldsToSchema(headers);
    const unmapped = headers.filter(hd => !Object.values(colMap).includes(hd));
    const rows = normalizeRows(json, colMap, existingCategories, accounts);
    return { headers, colMap, unmapped, rows, rawCount: json.length };
  }

  function extractJsonRows(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const keys = ["data", "rows", "transactions", "records", "items", "results"];
      for (const k of keys) if (Array.isArray(parsed[k])) return parsed[k];
      const firstArray = Object.values(parsed).find(v => Array.isArray(v));
      if (firstArray) return firstArray;
      return [parsed];
    }
    return [];
  }

  function bestSheetJson(workbook) {
    let best = null, bestScore = -1;
    workbook.SheetNames.forEach(name => {
      const sheet = workbook.Sheets[name];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (!json.length) return;
      const score = Object.keys(mapFieldsToSchema(Object.keys(json[0]))).length;
      if (score > bestScore) { bestScore = score; best = json; }
    });
    return best;
  }

  /* Parse a File object into { headers, colMap, unmapped, rows, rawCount }.
     Supports CSV, TSV, plain delimited TXT, JSON, and Excel (XLSX/XLS). */
  function parseFile(file, existingCategories, accounts) {
    return new Promise((resolve, reject) => {
      const ext = file.name.split(".").pop().toLowerCase();

      if (ext === "csv" || ext === "tsv" || ext === "txt") {
        if (typeof Papa === "undefined") return reject(new Error("CSV support library didn't load — check your internet connection and reload the page."));
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          delimiter: "",
          complete: (results) => {
            try {
              const cleaned = (results.data || []).filter(row =>
                Object.values(row).some(v => v !== undefined && v !== null && String(v).trim() !== "")
              );
              if (!cleaned.length) return reject(new Error("Could not read any usable rows from this file."));
              resolve(buildParsedResult(cleaned, existingCategories, accounts));
            } catch (err) { reject(err); }
          },
          error: (err) => reject(err)
        });
      } else if (ext === "xlsx" || ext === "xls") {
        if (typeof XLSX === "undefined") return reject(new Error("Excel support library didn't load — check your internet connection and reload the page."));
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const wb = XLSX.read(e.target.result, { type: "array", cellDates: true });
            const json = bestSheetJson(wb);
            if (!json) return reject(new Error("No sheet with usable data was found in this workbook."));
            resolve(buildParsedResult(json, existingCategories, accounts));
          } catch (err) { reject(err); }
        };
        reader.onerror = () => reject(new Error("Could not read this file."));
        reader.readAsArrayBuffer(file);
      } else if (ext === "json") {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(e.target.result);
            const json = extractJsonRows(parsed).filter(r => r && typeof r === "object");
            if (!json.length) return reject(new Error("Could not find a list of records in this JSON file."));
            resolve(buildParsedResult(json, existingCategories, accounts));
          } catch (err) { reject(new Error("This JSON file could not be parsed: " + err.message)); }
        };
        reader.onerror = () => reject(new Error("Could not read this file."));
        reader.readAsText(file);
      } else {
        reject(new Error("Unsupported file type — please upload a .csv, .tsv, .txt, .json, or .xlsx/.xls file."));
      }
    });
  }

  window.ImportParser = { parseFile, parseAmount, parseDateValue, mapFieldsToSchema, suggestCategory };
})();
