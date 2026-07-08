/* Finlytics — Wallet */
(function () {
  const CURRENCY = (window.FINLYTICS_CONFIG && window.FINLYTICS_CONFIG.CURRENCY) || "Rs";
  const fmt = n => CURRENCY + " " + Math.round(n).toLocaleString("en-IN");
  let activeTab = "accounts";

  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b.getAttribute("data-tab") === tab));
    document.querySelectorAll("[data-tab-panel]").forEach(p => p.style.display = p.getAttribute("data-tab-panel") === tab ? "" : "none");
    renderActive();
  }

  function renderActive() {
    if (activeTab === "accounts") renderAccounts();
    if (activeTab === "budgets") renderBudgets();
    if (activeTab === "goals") renderGoals();
    if (activeTab === "recurring") renderRecurring();
  }

  function renderAccounts() {
    const wrap = document.getElementById("accountsGrid");
    const accs = Store.list("accounts");
    wrap.innerHTML = accs.map(a => `
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-sub">${labelType(a.type)}</div>
            <div class="card-title" style="font-size:16px;margin-top:2px">${a.name}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="icon-btn btn-sm" style="width:34px;height:34px" data-edit-acc="${a.id}">✎</button>
            <button class="icon-btn btn-sm" style="width:34px;height:34px" data-del-acc="${a.id}">🗑</button>
          </div>
        </div>
        <div class="mono ${a.balance < 0 ? "text-neg" : ""}" style="font-size:24px;font-weight:700">${fmt(a.balance)}</div>
        <div style="font-size:12px;color:var(--ink-faint);margin-top:6px">${Store.list("txns").filter(t => t.account_id === a.id).length} linked transactions</div>
      </div>`).join("");
    wrap.querySelectorAll("[data-del-acc]").forEach(b => b.addEventListener("click", () => { Store.remove("accounts", b.getAttribute("data-del-acc")); renderAccounts(); }));
    wrap.querySelectorAll("[data-edit-acc]").forEach(b => b.addEventListener("click", () => openAccountModal(b.getAttribute("data-edit-acc"))));
  }
  function labelType(t) { return { cash: "Cash", bank: "Bank", credit_card: "Credit Card", savings: "Savings" }[t] || t; }

  function openAccountModal(id) {
    const overlay = document.getElementById("accountModal");
    const f = document.getElementById("accountForm");
    const acc = id ? Store.list("accounts").find(a => a.id === id) : null;
    f.accId.value = id || "";
    f.accName.value = acc ? acc.name : "";
    f.accType.value = acc ? acc.type : "cash";
    f.accBalance.value = acc ? acc.balance : "";
    overlay.classList.add("open");
  }

  function renderBudgets() {
    const wrap = document.getElementById("budgetsList");
    const rows = Store.budgetHealth();
    wrap.innerHTML = rows.map(b => `
      <div class="card" style="margin-bottom:14px">
        <div class="card-head">
          <div class="card-title">${b.category}</div>
          <button class="btn btn-sm" data-del-budget="${b.id}">Remove</button>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px">
          <span class="mono">${fmt(b.spent)} spent</span><span class="mono">${fmt(b.monthly_limit)} limit</span>
        </div>
        <div class="progress ${b.pct >= 100 ? "over" : b.pct >= 75 ? "warn" : ""}"><span style="width:${Math.min(100, b.pct)}%"></span></div>
      </div>`).join("") || emptyMsg("No budgets yet.");
    wrap.querySelectorAll("[data-del-budget]").forEach(b => b.addEventListener("click", () => { Store.remove("budgets", b.getAttribute("data-del-budget")); renderBudgets(); }));
  }

  function renderGoals() {
    const wrap = document.getElementById("goalsList");
    const rows = Store.list("goals");
    wrap.innerHTML = rows.map(g => `
      <div class="card" style="margin-bottom:14px">
        <div class="card-head">
          <div>
            <div class="card-title">${g.name}</div>
            <div class="card-sub">Target date: ${g.target_date || "—"}</div>
          </div>
          <button class="btn btn-sm" data-del-goal="${g.id}">Remove</button>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px">
          <span class="mono">${fmt(g.saved_amount)} saved</span><span class="mono">${fmt(g.target_amount)} target</span>
        </div>
        <div class="progress"><span style="width:${Math.min(100, (g.saved_amount / g.target_amount) * 100)}%"></span></div>
      </div>`).join("") || emptyMsg("No goals yet.");
    wrap.querySelectorAll("[data-del-goal]").forEach(b => b.addEventListener("click", () => { Store.remove("goals", b.getAttribute("data-del-goal")); renderGoals(); }));
  }

  function renderRecurring() {
    const wrap = document.getElementById("recurringTbody");
    const rows = Store.list("recurring");
    wrap.innerHTML = rows.map(r => `
      <tr>
        <td>${r.description}</td>
        <td><span class="tag info">${r.category}</span></td>
        <td>${r.frequency}</td>
        <td>${r.next_date || "—"}</td>
        <td class="amount-cell ${r.amount > 0 ? "text-pos" : "text-neg"}">${fmt(r.amount)}</td>
        <td><button class="btn btn-sm" data-del-rec="${r.id}">Delete</button></td>
      </tr>`).join("") || `<tr><td colspan="6" style="text-align:center;color:var(--ink-faint);padding:24px">No recurring items yet.</td></tr>`;
    wrap.querySelectorAll("[data-del-rec]").forEach(b => b.addEventListener("click", () => { Store.remove("recurring", b.getAttribute("data-del-rec")); renderRecurring(); }));
  }

  function emptyMsg(t) { return `<p class="empty-msg">${t}</p>`; }

  function setupModals() {
    document.getElementById("openAddAccount").addEventListener("click", () => openAccountModal(null));
    document.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", () => el.closest(".modal-overlay").classList.remove("open")));

    document.getElementById("accountForm").addEventListener("submit", e => {
      e.preventDefault();
      const f = e.target;
      const data = { name: f.accName.value, type: f.accType.value, balance: Number(f.accBalance.value) || 0 };
      if (f.accId.value) Store.update("accounts", f.accId.value, data);
      else Store.add("accounts", data);
      f.reset();
      document.getElementById("accountModal").classList.remove("open");
      renderAccounts();
    });

    document.getElementById("openAddBudget").addEventListener("click", () => document.getElementById("budgetModal").classList.add("open"));
    document.getElementById("budgetForm").addEventListener("submit", e => {
      e.preventDefault();
      const f = e.target;
      Store.add("budgets", { category: f.budgetCategory.value, monthly_limit: Number(f.budgetLimit.value) || 0 });
      f.reset();
      document.getElementById("budgetModal").classList.remove("open");
      renderBudgets();
    });

    document.getElementById("openAddGoal").addEventListener("click", () => document.getElementById("goalModal").classList.add("open"));
    document.getElementById("goalForm").addEventListener("submit", e => {
      e.preventDefault();
      const f = e.target;
      Store.add("goals", { name: f.goalName.value, target_amount: Number(f.goalTarget.value) || 0, saved_amount: Number(f.goalSaved.value) || 0, target_date: f.goalDate.value });
      f.reset();
      document.getElementById("goalModal").classList.remove("open");
      renderGoals();
    });

    document.getElementById("openAddRecurring").addEventListener("click", () => document.getElementById("recurringModal").classList.add("open"));
    document.getElementById("recurringForm").addEventListener("submit", e => {
      e.preventDefault();
      const f = e.target;
      const raw = Math.abs(Number(f.recAmount.value) || 0);
      Store.add("recurring", { description: f.recDesc.value, category: f.recCategory.value || "Other", amount: f.recType.value === "income" ? raw : -raw, frequency: f.recFreq.value, next_date: f.recDate.value });
      f.reset();
      document.getElementById("recurringModal").classList.remove("open");
      renderRecurring();
    });
  }

  function init() {
    Store.init();
    document.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => setTab(b.getAttribute("data-tab"))));
    setupModals();
    setTab("accounts");
  }

  window.WalletRefresh = renderActive;
  document.addEventListener("DOMContentLoaded", init);
})();
