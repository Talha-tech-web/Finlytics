/* Finlytics — Transactions */
(function () {
  const CURRENCY = (window.FINLYTICS_CONFIG && window.FINLYTICS_CONFIG.CURRENCY) || "Rs";
  const fmt = n => (n > 0 ? "+" : "") + CURRENCY + " " + Math.round(n).toLocaleString("en-IN");
  let filter = "all";
  let search = "";

  function matchesFilter(t) {
    if (filter === "all") return true;
    if (filter === "income") return t.amount > 0;
    if (filter === "expense") return t.amount < 0 && t.type !== "transfer";
    if (filter === "transfer") return t.type === "transfer";
    return true;
  }

  function render() {
    const rows = Store.list("txns")
      .filter(matchesFilter)
      .filter(t => !search || (t.description + t.category).toLowerCase().includes(search.toLowerCase()));
    const tbody = document.getElementById("txnTbody");
    tbody.innerHTML = rows.map(t => `
      <tr>
        <td>${t.date}</td>
        <td>${t.description}</td>
        <td><span class="tag ${t.amount > 0 ? "pos" : "info"}">${t.category}</span></td>
        <td>${t.account_name || "—"}</td>
        <td><span class="tag ${t.amount > 0 ? "pos" : "neg"}">${t.amount > 0 ? "Income" : "Expense"}</span></td>
        <td class="amount-cell ${t.amount > 0 ? "text-pos" : "text-neg"}">${fmt(t.amount)}</td>
        <td><button class="btn btn-sm" data-del="${t.id}">Delete</button></td>
      </tr>`).join("") || `<tr><td colspan="7" style="text-align:center;color:var(--ink-faint);padding:30px">No transactions match.</td></tr>`;

    tbody.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", () => {
      Store.removeTransaction(btn.getAttribute("data-del"));
      render();
    }));

    document.getElementById("txnCount").textContent = rows.length + " transaction" + (rows.length === 1 ? "" : "s");
  }

  function setupFilters() {
    document.querySelectorAll("[data-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        filter = btn.getAttribute("data-filter");
        document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === btn));
        render();
      });
    });
    document.getElementById("txnSearch").addEventListener("input", e => { search = e.target.value; render(); });
  }

  function setupModal() {
    const overlay = document.getElementById("addTxnModal");
    document.getElementById("openAddTxn").addEventListener("click", () => {
      populateAccountSelect();
      overlay.classList.add("open");
    });
    overlay.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", () => overlay.classList.remove("open")));

    document.getElementById("addTxnForm").addEventListener("submit", e => {
      e.preventDefault();
      const f = e.target;
      const type = f.txType.value;
      const rawAmount = Math.abs(Number(f.txAmount.value) || 0);
      const amount = type === "income" ? rawAmount : -rawAmount;
      const accId = f.txAccount.value;
      const accName = Store.list("accounts").find(a => a.id === accId)?.name || "—";
      Store.addTransaction({
        date: f.txDate.value || new Date().toISOString().slice(0, 10),
        description: f.txDesc.value || "Transaction",
        category: f.txCategory.value || "Other",
        account_id: accId, account_name: accName,
        type, amount, source: "manual"
      });
      f.reset();
      overlay.classList.remove("open");
      render();
      Nav.notifBadge();
    });
  }

  function populateAccountSelect() {
    const sel = document.getElementById("txAccountSelect");
    sel.innerHTML = Store.list("accounts").map(a => `<option value="${a.id}">${a.name}</option>`).join("");
  }

  function setupCsvUpload() {
    let pendingRows = null;

    const previewOverlay = document.getElementById("importPreviewModal");
    const summaryEl = document.getElementById("importSummary");
    const unmappedEl = document.getElementById("importUnmapped");
    const tbody = document.getElementById("importPreviewTbody");

    function closePreview() {
      previewOverlay.classList.remove("open");
      pendingRows = null;
    }

    document.getElementById("csvUpload").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      e.target.value = ""; // allow re-selecting the same file later
      if (!file) return;

      const existingCategories = [...new Set(Store.list("txns").map(t => t.category).filter(Boolean))];
      const accounts = Store.list("accounts");

      let parsed;
      try {
        parsed = await ImportParser.parseFile(file, existingCategories, accounts);
      } catch (err) {
        alert("Couldn't import this file: " + err.message);
        return;
      }

      if (!parsed.rows.length) {
        alert("No usable transaction rows were found in this file — check that it has a date/description/amount style column.");
        return;
      }

      pendingRows = parsed.rows;

      const mappedFields = Object.keys(parsed.colMap).length;
      summaryEl.innerHTML = `<strong>${parsed.rows.length}</strong> transaction${parsed.rows.length === 1 ? "" : "s"} ready to import out of ${parsed.rawCount} row${parsed.rawCount === 1 ? "" : "s"} read, using <strong>${mappedFields}</strong> auto-detected column${mappedFields === 1 ? "" : "s"}. Rows without a usable amount were skipped.`;

      if (parsed.unmapped.length) {
        unmappedEl.style.display = "block";
        unmappedEl.textContent = "Ignored columns (no match found): " + parsed.unmapped.join(", ");
      } else {
        unmappedEl.style.display = "none";
      }

      tbody.innerHTML = pendingRows.slice(0, 50).map(r => `
        <tr>
          <td>${r.date}</td>
          <td>${escapeHtmlLocal(r.description)}</td>
          <td><span class="tag ${r.type === "income" ? "pos" : "info"}">${escapeHtmlLocal(r.category)}</span></td>
          <td><span class="tag ${r.type === "income" ? "pos" : "neg"}">${r.type === "income" ? "Income" : "Expense"}</span></td>
          <td class="amount-cell ${r.amount > 0 ? "text-pos" : "text-neg"}">${fmt(r.amount)}</td>
        </tr>`).join("");
      if (pendingRows.length > 50) {
        tbody.innerHTML += `<tr><td colspan="5" style="text-align:center;color:var(--ink-faint)">…and ${pendingRows.length - 50} more row(s)</td></tr>`;
      }

      previewOverlay.classList.add("open");
    });

    document.getElementById("importCancelBtn").addEventListener("click", closePreview);
    previewOverlay.querySelectorAll("[data-close-import]").forEach(el => el.addEventListener("click", closePreview));
    document.getElementById("importConfirmBtn").addEventListener("click", () => {
      if (!pendingRows) return;
      pendingRows.forEach(r => Store.add("txns", r));
      const count = pendingRows.length;
      closePreview();
      render();
      Nav.notifBadge();
      alert(count + " transaction" + (count === 1 ? "" : "s") + " imported.");
    });
  }

  function escapeHtmlLocal(s) {
    return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  function setupExport() {
    document.getElementById("exportCsv").addEventListener("click", () => {
      const rows = Store.list("txns");
      const csv = ["date,description,category,account,amount"]
        .concat(rows.map(r => [r.date, r.description, r.category, r.account_name || "", r.amount].join(",")))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "finlytics_transactions.csv";
      a.click();
    });
  }

  function init() {
    Store.init();
    setupFilters();
    setupModal();
    setupCsvUpload();
    setupExport();
    render();
  }

  window.TransactionsRefresh = render;
  document.addEventListener("DOMContentLoaded", init);
})();
