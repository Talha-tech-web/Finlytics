/* Finlytics-Analytics */
(function () {
  const CURRENCY = (window.FINLYTICS_CONFIG && window.FINLYTICS_CONFIG.CURRENCY) || "Rs";
  const fmt = n => CURRENCY + " " + Math.round(n).toLocaleString("en-IN");

  function renderInsights() {
    const series = Store.monthlySeries(6);
    const cur = series[series.length - 1], prev = series[series.length - 2];
    const cats = Store.expensesByCategory(6);
    const top = cats[0];
    const expenseDelta = prev.expense ? (((cur.expense - prev.expense) / prev.expense) * 100).toFixed(0) : 0;
    const netDelta = cur.net - prev.net;
    const biggestTxn = [...Store.list("txns")].filter(t => t.amount < 0).sort((a, b) => a.amount - b.amount)[0];

    const items = [
      `You spent ${Math.abs(expenseDelta)}% ${expenseDelta >= 0 ? "more" : "less"} in ${cur.label} than ${prev.label}.`,
      `Net savings ${netDelta >= 0 ? "improved" : "declined"} by ${fmt(Math.abs(netDelta))} month-over-month.`,
      top ? `Your biggest expense category is ${top.category} at ${fmt(top.total)} over the last 6 months.` : "No expense data yet.",
      biggestTxn ? `Largest single expense: ${fmt(Math.abs(biggestTxn.amount))} on "${biggestTxn.description}".` : ""
    ].filter(Boolean);

    document.getElementById("insightList").innerHTML = items.map(i => `
      <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>${i}</li>`).join("");
  }

  let compareMode = "month";
  function renderCompare() {
    const series = Store.monthlySeries(compareMode === "month" ? 2 : 12);
    const p = ChartTheme.palette();
    const a = series[series.length - 2], b = series[series.length - 1];
    const ctx = document.getElementById("compareChart");
    if (window._compareChart) window._compareChart.destroy();
    window._compareChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Income", "Expense"],
        datasets: [
          { label: a.label, data: [a.income, a.expense], backgroundColor: p.inkDim, borderRadius: 8 },
          { label: b.label, data: [b.income, b.expense], backgroundColor: p.accent, borderRadius: 8 }
        ]
      },
      options: ChartTheme.baseOptions()
    });
    const incomeDelta = a.income ? (((b.income - a.income) / a.income) * 100).toFixed(0) : 0;
    const expenseDelta = a.expense ? (((b.expense - a.expense) / a.expense) * 100).toFixed(0) : 0;
    document.getElementById("compareDeltas").innerHTML =
      `Income ${incomeDelta >= 0 ? "up" : "down"} <b class="${incomeDelta >= 0 ? "text-pos" : "text-neg"}">${Math.abs(incomeDelta)}%</b>
       &nbsp;&nbsp; Expense ${expenseDelta >= 0 ? "up" : "down"} <b class="${expenseDelta >= 0 ? "text-neg" : "text-pos"}">${Math.abs(expenseDelta)}%</b>`;
  }

  function renderNetWorth() {
    const series = Store.netWorthSeries(6);
    const p = ChartTheme.palette();
    new Chart(document.getElementById("netWorthChart"), {
      type: "line",
      data: { labels: series.map(s => s.label), datasets: [{ label: "Net Worth", data: series.map(s => s.netWorth), borderColor: p.accent, backgroundColor: p.accent + "33", fill: true, tension: .35 }] },
      options: ChartTheme.baseOptions()
    });
  }

  function renderNetBalanceLine() {
    const series = Store.monthlySeries(6);
    const p = ChartTheme.palette();
    new Chart(document.getElementById("netBalanceLine"), {
      type: "line",
      data: { labels: series.map(s => s.label), datasets: [{ label: "Net", data: series.map(s => s.net), borderColor: p.accent, backgroundColor: "transparent", tension: .35, pointRadius: 4, pointBackgroundColor: p.accent }] },
      options: ChartTheme.baseOptions({ plugins: { legend: { display: false } } })
    });
  }

  function renderIncomeExpenseBar() {
    const series = Store.monthlySeries(6);
    const p = ChartTheme.palette();
    new Chart(document.getElementById("incomeExpenseBar"), {
      type: "bar",
      data: { labels: series.map(s => s.label), datasets: [
        { label: "Income", data: series.map(s => s.income), backgroundColor: p.positive, borderRadius: 6 },
        { label: "Expense", data: series.map(s => s.expense), backgroundColor: p.negative, borderRadius: 6 }
      ] },
      options: ChartTheme.baseOptions()
    });
  }

  function renderCategoryDonut() {
    const cats = Store.expensesByCategory(6);
    const p = ChartTheme.palette();
    new Chart(document.getElementById("categoryDonut2"), {
      type: "doughnut",
      data: { labels: cats.map(c => c.category), datasets: [{ data: cats.map(c => c.total), backgroundColor: p.categorySet, borderWidth: 0 }] },
      options: ChartTheme.baseOptions({ type: "doughnut", cutout: "62%", scales: {} })
    });
  }

  function renderWaterfall() {
    const s = Store.summary(1);
    const p = ChartTheme.palette();
    const opening = Store.accountsTotal() - s.net;
    new Chart(document.getElementById("waterfallChart"), {
      type: "bar",
      data: {
        labels: ["Opening", "Income", "Expenses", "Closing"],
        datasets: [{
          data: [opening, s.income, -s.expense, opening + s.net],
          backgroundColor: [p.accent, p.positive, p.negative, p.accent],
          borderRadius: 8
        }]
      },
      options: ChartTheme.baseOptions({ plugins: { legend: { display: false } } })
    });
  }

  function renderStacked() {
    const months = Store.lastNMonths(6);
    const txns = Store.list("txns");
    const cats = [...new Set(txns.filter(t => t.amount < 0).map(t => t.category))].slice(0, 6);
    const p = ChartTheme.palette();
    const datasets = cats.map((cat, i) => ({
      label: cat,
      data: months.map(m => txns.filter(t => t.amount < 0 && t.category === cat && Store.monthKey(t.date) === m).reduce((s, t) => s + Math.abs(t.amount), 0)),
      backgroundColor: p.categorySet[i % p.categorySet.length],
      borderRadius: 4
    }));
    new Chart(document.getElementById("stackedChart"), {
      type: "bar",
      data: { labels: months.map(m => Store.monthLabel(m)), datasets },
      options: ChartTheme.baseOptions({ scales: { x: { stacked: true, grid: { color: "transparent" } }, y: { stacked: true, grid: { color: ChartTheme.palette().border } } } })
    });
  }

  function destroyChart(id) {
    const el = document.getElementById(id);
    if (el && typeof Chart !== "undefined") {
      const inst = Chart.getChart(el);
      if (inst) inst.destroy();
    }
  }

  function refreshAll() {
    renderInsights();
    renderCompare();
    destroyChart("netWorthChart");
    destroyChart("netBalanceLine");
    destroyChart("incomeExpenseBar");
    destroyChart("categoryDonut2");
    destroyChart("waterfallChart");
    destroyChart("stackedChart");
    renderNetWorth();
    renderNetBalanceLine();
    renderIncomeExpenseBar();
    renderCategoryDonut();
    renderWaterfall();
    renderStacked();
  }

  function init() {
    Store.init();
    refreshAll();

    document.querySelectorAll("[data-compare]").forEach(btn => btn.addEventListener("click", () => {
      compareMode = btn.getAttribute("data-compare");
      document.querySelectorAll("[data-compare]").forEach(b => b.classList.toggle("active", b === btn));
      renderCompare();
    }));
  }

  window.AnalyticsRefresh = refreshAll;
  document.addEventListener("DOMContentLoaded", init);
})();
