/* Finlytics — cross-page sync when Store data changes */
(function () {
  const page = () => document.body.getAttribute("data-page");

  function refreshCurrentPage(key) {
    const p = page();
    if (!p) return;
    const affects = (keys) => !key || keys.includes(key);

    if (p === "dashboard" && affects(["txns", "accounts", "budgets", "goals"])) {
      window.DashboardRefresh && DashboardRefresh();
    }
    if (p === "transactions" && affects(["txns", "accounts"])) {
      window.TransactionsRefresh && TransactionsRefresh();
    }
    if (p === "wallet" && affects(["accounts", "budgets", "goals", "recurring", "txns"])) {
      window.WalletRefresh && WalletRefresh();
    }
    if (p === "analytics" && affects(["txns", "accounts"])) {
      window.AnalyticsRefresh && AnalyticsRefresh();
    }
    if (p === "reports" && affects(["reports", "txns", "settings"])) {
      window.ReportsRefresh && ReportsRefresh();
    }
    if (p === "settings" && affects(["settings"])) {
      window.SettingsRefresh && SettingsRefresh();
    }
  }

  window.addEventListener("finlytics:data-changed", (e) => {
    refreshCurrentPage(e.detail?.key);
  });

  window.FinSync = { refreshCurrentPage };
})();
