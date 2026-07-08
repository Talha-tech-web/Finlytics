/* Finlytics — theme: light / dark / system, persisted */
(function () {
  const ICONS = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>'
  };

  function systemPrefersDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function resolve(preference) {
    if (preference === "system" || !preference) {
      return systemPrefersDark() ? "dark" : "light";
    }
    return preference === "dark" ? "dark" : "light";
  }

  function getPreference() {
    const settings = Store.getSettings();
    const pref = settings.theme || "light";
    if (pref === "system") return "system";
    return pref === "dark" ? "dark" : "light";
  }

  function apply(preference) {
    const pref = preference || getPreference();
    const resolved = resolve(pref);
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-theme-pref", pref);
    document.querySelectorAll("[data-theme-icon]").forEach(el => {
      el.innerHTML = resolved === "dark" ? ICONS.sun : ICONS.moon;
    });
    document.dispatchEvent(new CustomEvent("theme-changed", { detail: { preference: pref, resolved } }));
  }

  function setPreference(preference) {
    Store.saveSettings({ theme: preference });
    apply(preference);
  }

  function toggle() {
    const resolved = document.documentElement.getAttribute("data-theme") || "light";
    const next = resolved === "dark" ? "light" : "dark";
    setPreference(next);
  }

  function syncPicker() {
    const pref = getPreference();
    document.querySelectorAll(".theme-picker-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.themeValue === pref);
    });
  }

  function init() {
    apply(getPreference());
    syncPicker();

    document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
      btn.addEventListener("click", toggle);
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (getPreference() === "system") apply("system");
    });

    document.addEventListener("theme-changed", syncPicker);
  }

  window.Theme = { init, toggle, apply, setPreference, resolve, getPreference, syncPicker };
})();
