/* Finlytics — Reports */
(function () {
  const CURRENCY = (window.FINLYTICS_CONFIG && window.FINLYTICS_CONFIG.CURRENCY) || "Rs";
  const fmt = n => CURRENCY + " " + Math.round(n).toLocaleString("en-IN");

  function renderSaved() {
    const wrap = document.getElementById("savedReportsList");
    const rows = Store.list("reports");
    wrap.innerHTML = rows.map(r => `
      <div class="card" style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
        <div>
          <div style="font-weight:700;font-size:14.5px">${r.title}</div>
          <div style="font-size:12px;color:var(--ink-faint);margin-top:2px">Saved ${new Date(r.created_at).toLocaleDateString()}</div>
        </div>
        <div style="display:flex;gap:8px">
          <a class="btn btn-sm btn-accent" href="assistant.html?q=${encodeURIComponent(r.question)}">Ask again</a>
          <button class="btn btn-sm" data-del-report="${r.id}">Remove</button>
        </div>
      </div>`).join("") || `<p class="empty-msg">No saved reports yet. Ask the assistant a question, then tap "Save as report" under its answer.</p>`;
    wrap.querySelectorAll("[data-del-report]").forEach(b => b.addEventListener("click", () => { Store.remove("reports", b.getAttribute("data-del-report")); renderSaved(); }));
  }

  function buildStatementHtml() {
    const s = Store.summary(6);
    const series = Store.monthlySeries(6);
    const cats = Store.expensesByCategory(6);
    const settings = Store.getSettings();
    return `
      <h1 style="font-family:Sora,sans-serif">${settings.businessName || "Finlytics"} — Financial Statement</h1>
      <p style="color:#555">Period: last 6 months · Generated ${new Date().toLocaleDateString()}</p>
      <h3>Summary</h3>
      <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
        <tr><td>Total Income</td><td>${fmt(s.income)}</td></tr>
        <tr><td>Total Expenses</td><td>${fmt(s.expense)}</td></tr>
        <tr><td>Net Savings</td><td>${fmt(s.net)}</td></tr>
        <tr><td>Savings Rate</td><td>${s.savingsRate.toFixed(1)}%</td></tr>
      </table>
      <h3>Monthly Breakdown</h3>
      <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
        <tr><th>Month</th><th>Income</th><th>Expense</th><th>Net</th></tr>
        ${series.map(m => `<tr><td>${m.label}</td><td>${fmt(m.income)}</td><td>${fmt(m.expense)}</td><td>${fmt(m.net)}</td></tr>`).join("")}
      </table>
      <h3>Spending by Category</h3>
      <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
        <tr><th>Category</th><th>Total</th></tr>
        ${cats.map(c => `<tr><td>${c.category}</td><td>${fmt(c.total)}</td></tr>`).join("")}
      </table>`;
  }

  function printStatement() {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Finlytics Statement</title></head><body style="font-family:Inter,sans-serif;padding:30px">${buildStatementHtml()}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  function init() {
    Store.init();
    renderSaved();
    document.getElementById("printStatementBtn").addEventListener("click", printStatement);
  }

  window.ReportsRefresh = renderSaved;
  window.ReportsPrintStatement = printStatement;
  document.addEventListener("DOMContentLoaded", init);
})();
