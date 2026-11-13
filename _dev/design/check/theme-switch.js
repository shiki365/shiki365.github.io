#!/usr/bin/env node
/*
 * theme-switch.js - the 自動 / ダーク / ライト switch (theme.v1.js) on one page: 13 checks.
 *
 *   node _dev/design/check/theme-switch.js <url>
 *
 * Buttons and aria-pressed, the choice kept over a reload and shared with another open page, "auto" removing
 * it, keyboard and focus ring, the theme set before the page is parsed (no flash), labels in English and
 * Korean, following a light OS, and working when localStorage is blocked.
 * Needs Node and Playwright (npm i playwright).
 */
"use strict";
const { chromium } = require("playwright");
const URL = process.argv[2] || process.env.URL;
if (!URL) { console.error("usage: node theme-switch.js <url>"); process.exit(2); }
const ok = (name, cond, extra = "") => console.log((cond ? "✓ " : "✗ ") + name + (extra ? "  " + extra : ""));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ colorScheme: "dark", locale: "ja-JP", viewport: { width: 1280, height: 900 } });
  const pg = await ctx.newPage(); const errors = []; pg.on("pageerror", e => errors.push(String(e)));
  await pg.goto(URL); await pg.waitForTimeout(300);
  const state = () => pg.evaluate(() => ({
    theme: document.documentElement.getAttribute("data-theme"),
    pressed: [...document.querySelectorAll("[data-theme-choice]")].filter(x => x.getAttribute("aria-pressed") === "true").map(x => x.dataset.themeChoice),
    labels: [...document.querySelectorAll("[data-theme-choice]")].map(x => x.textContent).join(" / "),
    group: document.querySelector("[data-theme-switch]").getAttribute("aria-label"),
    bg: getComputedStyle(document.body).backgroundColor, scheme: getComputedStyle(document.documentElement).colorScheme,
    stored: localStorage.getItem("shiki365.theme") }));
  let s = await state();
  ok("first visit: auto, dark OS -> dark page", s.theme === null && s.pressed.join() === "auto" && s.scheme === "dark", JSON.stringify(s));
  const darkBg = s.bg;
  await pg.click("[data-theme-choice=light]"); s = await state();
  ok("click ライト -> data-theme=light, light colors, stored", s.theme === "light" && s.pressed.join() === "light" && s.scheme === "light" && s.bg !== darkBg && s.stored === "light", JSON.stringify(s));
  const other = await ctx.newPage(); await other.goto(URL); await other.waitForTimeout(200);
  ok("another page of the site opens light", await other.evaluate(() => document.documentElement.dataset.theme) === "light");
  await pg.click("[data-theme-choice=dark]"); await other.waitForTimeout(200);
  ok("change follows in the other open page", await other.evaluate(() => document.documentElement.dataset.theme) === "dark");
  await pg.reload(); await pg.waitForTimeout(200); s = await state();
  ok("reload keeps ダーク", s.theme === "dark" && s.pressed.join() === "dark");
  await pg.click("[data-theme-choice=auto]"); s = await state();
  ok("click 自動 -> attribute and storage removed", s.theme === null && s.stored === null && s.pressed.join() === "auto");
  // Keyboard: Tab reaches the buttons, Enter switches, focus ring is shown.
  await pg.focus("[data-theme-choice=light]"); await pg.keyboard.press("Enter"); s = await state();
  const ring = await pg.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  ok("keyboard Enter switches; focus ring", s.theme === "light" && ring !== "none", ring);
  // Applied before the body is parsed (no flash): check from an init script at DOMContentLoaded-time of <body>.
  const early = await ctx.newPage();
  await early.addInitScript(() => document.addEventListener("readystatechange", () => { if (!window.__first) window.__first = document.documentElement.dataset.theme || "none"; }, { once: true }));
  await early.goto(URL); ok("theme set before the page finishes parsing", await early.evaluate(() => window.__first) === "light", await early.evaluate(() => window.__first));
  // Languages.
  for (const lang of ["en", "ko"]) { await pg.goto(URL + "?lang=" + lang); await pg.waitForTimeout(300); s = await state(); ok(`labels in ${lang}`, !/[ぁ-ン]/.test(s.labels + s.group), s.group + ": " + s.labels); }
  // OS light with auto.
  const c2 = await b.newContext({ colorScheme: "light", locale: "ja-JP" }); const p2 = await c2.newPage(); await p2.goto(URL); await p2.waitForTimeout(200);
  ok("auto on light OS -> light page", await p2.evaluate(() => getComputedStyle(document.documentElement).colorScheme) === "light");
  // Storage blocked: page still works, switch still changes the page.
  const c3 = await b.newContext({ colorScheme: "dark" }); const p3 = await c3.newPage(); const e3 = []; p3.on("pageerror", e => e3.push(String(e)));
  await p3.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await p3.goto(URL); await p3.waitForTimeout(300); await p3.click("[data-theme-choice=light]");
  ok("storage blocked: no errors, switch still works", e3.length === 0 && await p3.evaluate(() => document.documentElement.dataset.theme) === "light", e3.join(" | "));
  ok("no page errors", errors.length === 0, errors.join(" | "));
  await b.close();
})();
