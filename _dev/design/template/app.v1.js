/*!
 * app.v1.js - {{NAME}} (UI)
 *
 * A starting point: only what every tool's page needs (tabs, the numbers next to the sliders, the preview
 * background, the status line). Texts are written in Japanese and go through t() (i18n.v1.js); the Japanese
 * text is the key, and lang.en.v1.js / lang.ko.v1.js hold the translations.
 */
(function () {
  "use strict";

  const t = (text, vars) => (window.I18n ? window.I18n.t(text, vars)
    : vars ? text.replace(/\{(\w+)\}/g, (all, name) => (name in vars ? String(vars[name]) : all)) : text);
  const $ = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];

  const TAB_KEY = "{{SLUG}}.tab";

  function status(message, isError) {
    const el = $("#status");
    el.textContent = message;
    el.classList.toggle("error", !!isError);
  }

  // ---------------------------------------------------------------- tabs

  function switchTab(name) {
    for (const btn of $$("[data-tab]")) btn.setAttribute("aria-selected", String(btn.dataset.tab === name));
    for (const panel of $$("[data-tab-panel]")) panel.hidden = panel.dataset.tabPanel !== name;
    try { localStorage.setItem(TAB_KEY, name); } catch (err) { /* storage may be blocked */ }
  }

  function wireTabs() {
    for (const btn of $$("[data-tab]")) btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    // Arrow keys / Home / End move between the tabs, as in the WAI-ARIA tabs pattern.
    $(".tabbar").addEventListener("keydown", ev => {
      const tabs = $$("[data-tab]"), i = tabs.indexOf(document.activeElement);
      const next = i < 0 ? undefined : { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[ev.key];
      if (next === undefined) return;
      ev.preventDefault();
      const tab = tabs[(next + tabs.length) % tabs.length];
      tab.focus();
      switchTab(tab.dataset.tab);
    });
    let saved = null;
    try { saved = localStorage.getItem(TAB_KEY); } catch (err) { /* storage may be blocked */ }
    if (saved && $(`[data-tab="${saved}"]`)) switchTab(saved);
  }

  // ---------------------------------------------------------------- controls

  // The value next to a slider: <input type="range" id="x"> ... <output id="xOut">.
  function wireOutputs() {
    for (const input of $$("input[type=range][id]")) {
      const out = document.getElementById(input.id + "Out");
      if (!out) continue;
      const show = () => { out.textContent = Number(input.max) <= 1 ? Math.round(input.value * 100) + "%" : input.value + "px"; };
      // Update on "input" only: do not show or hide rows while a slider is being dragged (Chromium drops the drag).
      input.addEventListener("input", show);
      show();
    }
  }

  function wireBackground() {
    for (const btn of $$("#bgSeg button")) {
      btn.addEventListener("click", () => {
        for (const other of $$("#bgSeg button")) other.setAttribute("aria-pressed", String(other === btn));
        $("#stage").className = "stage bg-" + btn.dataset.bg;
      });
    }
  }

  wireTabs();
  wireOutputs();
  wireBackground();
  status(t("準備ができました。"));
})();
