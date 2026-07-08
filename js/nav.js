/* Finlytics — sidebar nav + topbar chrome, shared by every page */
(function () {
  function setActiveNav() {
    const page = document.body.getAttribute("data-page");
    document.querySelectorAll(".nav-item[data-page]").forEach(el => {
      el.classList.toggle("active", el.getAttribute("data-page") === page);
    });
  }

  function setUserChip() {
    const s = Store.getSettings();
    const name = s.businessName || "My Finances";
    document.querySelectorAll("[data-user-name]").forEach(el => (el.textContent = name));
    document.querySelectorAll("[data-user-initial]").forEach(el => (el.textContent = (name.trim()[0] || "F").toUpperCase()));
  }

  function tickClock() {
    const now = new Date();
    const str = now.toLocaleString("en-US", {
      weekday: "long", month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).replace(",", ",");
    document.querySelectorAll("[data-clock]").forEach(el => (el.textContent = str));
  }

  function mobileNav() {
    const sidebar = document.querySelector(".sidebar");
    const scrim = document.querySelector(".sidebar-scrim");
    const openBtn = document.querySelector("[data-hamburger]");
    if (!sidebar || !scrim || !openBtn) return;
    const open = () => { sidebar.classList.add("open"); scrim.classList.add("open"); };
    const close = () => { sidebar.classList.remove("open"); scrim.classList.remove("open"); };
    openBtn.addEventListener("click", open);
    scrim.addEventListener("click", close);
    sidebar.querySelectorAll(".nav-item").forEach(el => el.addEventListener("click", close));
  }

  function notifBadge() {
    // simple heuristic: flag if any budget is over 90%
    const over = (Store.budgetHealth() || []).filter(b => b.pct >= 90).length;
    document.querySelectorAll("[data-notif-badge]").forEach(el => {
      if (over > 0) { el.textContent = over; el.style.display = "flex"; }
      else { el.style.display = "none"; }
    });
  }

  function checkVoiceSetting() {
    const s = Store.getSettings();

    // Hide mic if voice disabled
    if (s.voiceEnabled === false) {
      document.querySelectorAll("[data-mic], [data-global-mic]").forEach(el => {
        el.style.display = "none";
      });
      const chatInput = document.getElementById("chatInput");
      if (chatInput) chatInput.placeholder = "Type your question...";
    }

    // Hide entire assistant link if AI disabled
    if (s.aiEnabled === false) {
      document.querySelectorAll(".btn-ai, a[href='assistant.html']").forEach(el => {
        el.style.display = "none";
      });
    }

    // Apply font size
    const fontMap = { small: "13px", normal: "15px", large: "17px" };
    if (s.fontSize && fontMap[s.fontSize]) {
      document.body.style.fontSize = fontMap[s.fontSize];
    }

    // Show/hide SQL toggles on assistant page
    if (s.showSql === false) {
      document.querySelectorAll(".sql-toggle").forEach(el => el.style.display = "none");
    }
  }

  function init() {
    Store.init();
    setActiveNav();
    setUserChip();
    tickClock();
    setInterval(tickClock, 30000);
    mobileNav();
    notifBadge();
    checkVoiceSetting();
  }

  document.addEventListener("DOMContentLoaded", init);
  window.Nav = { setUserChip, notifBadge };
})();
