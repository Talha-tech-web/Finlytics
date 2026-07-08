/* Finlytics — Dashboard */
(function () {
  const CURRENCY = (window.FINLYTICS_CONFIG && window.FINLYTICS_CONFIG.CURRENCY) || "Rs";
  const fmt = n => CURRENCY + " " + Math.round(n).toLocaleString("en-IN");

  function renderStats() {
    const s = Store.summary(6);
    document.getElementById("statIncome").textContent = fmt(s.income);
    document.getElementById("statExpense").textContent = fmt(s.expense);
    document.getElementById("statNet").textContent = fmt(s.net);
    document.getElementById("statSavingsRate").textContent = s.savingsRate.toFixed(1) + "%";
  }

  function renderTrendChart() {
    const series = Store.monthlySeries(6);
    const p = ChartTheme.palette();
    new Chart(document.getElementById("trendChart"), {
      type: "line",
      data: {
        labels: series.map(s => s.label),
        datasets: [
          { label: "Income", data: series.map(s => s.income), borderColor: p.positive, backgroundColor: p.positive + "33", fill: true, tension: .35, pointRadius: 3 },
          { label: "Expense", data: series.map(s => s.expense), borderColor: p.negative, backgroundColor: p.negative + "22", fill: true, tension: .35, pointRadius: 3 }
        ]
      },
      options: ChartTheme.baseOptions()
    });
  }

  function renderDonut() {
    const cats = Store.expensesByCategory(6);
    const p = ChartTheme.palette();
    new Chart(document.getElementById("categoryDonut"), {
      type: "doughnut",
      data: { labels: cats.map(c => c.category), datasets: [{ data: cats.map(c => c.total), backgroundColor: p.categorySet, borderWidth: 0 }] },
      options: ChartTheme.baseOptions({ type: "doughnut", cutout: "65%", scales: {} })
    });
  }

  function renderNetWorth() {
    const series = Store.netWorthSeries(6);
    const p = ChartTheme.palette();
    new Chart(document.getElementById("netWorthChart"), {
      type: "line",
      data: { labels: series.map(s => s.label), datasets: [{ label: "Net Worth", data: series.map(s => s.netWorth), borderColor: p.accent, backgroundColor: p.accent + "33", fill: true, tension: .35, pointRadius: 3 }] },
      options: ChartTheme.baseOptions()
    });
  }

  function renderBudgetHealth() {
    const wrap = document.getElementById("budgetHealthList");
    const rows = Store.budgetHealth();
    wrap.innerHTML = rows.map(b => `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;margin-bottom:6px">
          <span>${b.category}</span>
          <span class="mono" style="font-weight:600">${fmt(b.spent)} / ${fmt(b.monthly_limit)}</span>
        </div>
        <div class="progress ${b.pct >= 100 ? "over" : b.pct >= 75 ? "warn" : ""}"><span style="width:${Math.min(100, b.pct)}%"></span></div>
      </div>`).join("") || `<p class="empty-msg">No budgets set yet — add some on the Wallet page.</p>`;
  }

  function renderRecentTxns() {
    const wrap = document.getElementById("recentTxnsList");
    const rows = Store.list("txns").slice(0, 5);
    wrap.innerHTML = rows.map(r => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-weight:600;font-size:13.5px">${r.description}</div>
          <div style="font-size:11.5px;color:var(--ink-faint)">${r.date} · ${r.category}</div>
        </div>
        <div class="mono ${r.amount > 0 ? "text-pos" : "text-neg"}" style="font-weight:700;font-size:13.5px">${r.amount > 0 ? "+" : ""}${fmt(r.amount)}</div>
      </div>`).join("");
  }

  function renderTopCategories() {
    const cats = Store.expensesByCategory(1).slice(0, 5);
    const p = ChartTheme.palette();
    new Chart(document.getElementById("topCategoryBar"), {
      type: "bar",
      data: { labels: cats.map(c => c.category), datasets: [{ data: cats.map(c => c.total), backgroundColor: p.accent, borderRadius: 8 }] },
      options: ChartTheme.baseOptions({ plugins: { legend: { display: false } } })
    });
  }

  function renderDues() {
    const wrap = document.getElementById("duesList");
    const goals = Store.list("goals");
    wrap.innerHTML = goals.map(g => `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:13.5px;font-weight:700;margin-bottom:6px">
          <span>${g.name}</span><span class="mono">${Math.round((g.saved_amount / g.target_amount) * 100)}%</span>
        </div>
        <div class="progress"><span style="width:${Math.min(100, (g.saved_amount / g.target_amount) * 100)}%"></span></div>
      </div>`).join("") || `<p class="empty-msg">No goals yet.</p>`;
  }

  function destroyChart(id) {
    const el = document.getElementById(id);
    if (el && typeof Chart !== "undefined") {
      const inst = Chart.getChart(el);
      if (inst) inst.destroy();
    }
  }

  function refreshAll() {
    destroyChart("trendChart");
    destroyChart("categoryDonut");
    destroyChart("netWorthChart");
    destroyChart("topCategoryBar");
    renderStats();
    renderTrendChart();
    renderDonut();
    renderNetWorth();
    renderBudgetHealth();
    renderRecentTxns();
    renderTopCategories();
    renderDues();
  }

  function init() {
    Store.init();
    refreshAll();
  }

  window.DashboardRefresh = refreshAll;
  document.addEventListener("DOMContentLoaded", init);
})();
