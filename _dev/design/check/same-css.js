#!/usr/bin/env node
/*
 * same-css.js - for the tools that make OBS custom CSS (chat window, message box, status bar makers):
 * the exported CSS must be exactly the same in the original and in the restyled copy.
 *
 *   ORIG=<url of the original> NEW=<url of the restyled copy> [SCHEME=dark|light] node _dev/design/check/same-css.js
 *
 * Both pages go through the same steps and the text of #cssOut is compared after each: the room URL or a new
 * character, every preset, every visible slider at its maximum, every visible checkbox flipped and every
 * visible pull-down at its last option, on every tab. Also: the preview gets the same CSS, a test button
 * changes the preview (SEND=<selector>, default [data-send=success]; SEND_WAIT=<ms>), the tabs follow the
 * arrow keys, and "copy" puts the same CSS on the clipboard.
 *   status bar maker:  SEND="[data-test=half]" SEND_WAIT=1500
 *   message box maker: SEND_WAIT=8000 (a line appears 1.2 s after the previous one has been typed out)
 * Needs Node and Playwright (npm i playwright).
 */
"use strict";
const { chromium } = require("playwright");

async function run(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: process.env.SCHEME || "dark",
    locale: "ja-JP", permissions: ["clipboard-read", "clipboard-write"] });
  const pg = await ctx.newPage(); const errors = [];
  pg.on("pageerror", e => errors.push(String(e)));
  pg.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await pg.goto(url); await pg.waitForTimeout(500);
  const out = { css: {}, checks: {} };
  const css = () => pg.$eval("#cssOut", t => t.value);
  out.css.default = await css();
  const tabs = await pg.$$eval("[data-tab]", bs => bs.map(b => b.dataset.tab));
  const openTabWith = async sel => { for (const tab of tabs) { await pg.click(`[data-tab=${tab}]`); if (await pg.$(sel + ":visible")) return true; } return false; };

  // Room URL (chat window / message box makers).
  if (await pg.$("[data-bind='source.room']")) {
    await openTabWith("[data-bind='source.room']");
    await pg.fill("[data-bind='source.room']", "https://ccfolia.com/rooms/abcDEF123"); await pg.press("[data-bind='source.room']", "Tab");
    await pg.waitForTimeout(200);   // the CSS box is rewritten on the next frame
    out.css.room = await css();
  }
  // Character list (status bar maker): add one and fill it in.
  if (await pg.$("#addChar")) {
    await openTabWith("#addChar");
    await pg.click("#addChar"); await pg.waitForTimeout(100);
    const last = (await pg.$$(".char")).pop();
    const inputs = await last.$$("input[type=text]");
    await inputs[0].fill("テスト キャラ"); await inputs[0].press("Tab");
    if (inputs[1]) { await inputs[1].fill("abcDEF123"); await inputs[1].press("Tab"); }
    await pg.waitForTimeout(200);
    out.css.char = await css();
  }

  // Every preset.
  await pg.click(`[data-tab=${tabs[0]}]`);
  const designs = await pg.$$eval("#design option", os => os.map(o => o.value));
  for (const d of designs) { await pg.selectOption("#design", d); await pg.click("#applyDesign"); await pg.waitForTimeout(80); out.css["design:" + d] = await css(); }

  // Every visible slider on every tab, moved to its max.
  let sliders = 0;
  for (const tab of tabs) {
    await pg.click(`[data-tab=${tab}]`);
    for (const el of await pg.$$("input[type=range][data-bind]:visible")) {
      const path = await el.getAttribute("data-bind");
      await el.evaluate(e => { e.value = e.max; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); });
      await pg.waitForTimeout(30); out.css["max:" + path] = await css(); sliders++;
    }
  }
  out.checks.sliders = sliders;

  // Every visible checkbox (flipped) and every visible select (last option) on every tab.
  let flips = 0;
  for (const tab of tabs) {
    await pg.click(`[data-tab=${tab}]`);
    for (const el of await pg.$$("[data-tab-panel] input[type=checkbox][data-bind]:visible")) {
      if (!(await el.isVisible())) continue;   // hidden by an earlier change on this tab
      const path = await el.getAttribute("data-bind");
      await el.click(); await pg.waitForTimeout(30); out.css["flip:" + path] = await css(); flips++;
    }
    for (const el of await pg.$$("[data-tab-panel] select[data-bind]:visible")) {
      if (!(await el.isVisible())) continue;
      const path = await el.getAttribute("data-bind");
      const last = await el.evaluate(e => e.options[e.options.length - 1].value);
      await el.selectOption(last); await pg.waitForTimeout(30); out.css["select:" + path] = await css(); flips++;
    }
  }
  out.checks.flips = flips;

  // The preview gets the same CSS as the text box, and reacts to the test buttons.
  await pg.waitForTimeout(100);
  out.checks.previewMatches = await pg.frameLocator("#preview").locator("#obs-custom").evaluate(s => s.textContent) === await css();
  const body = () => pg.frameLocator("#preview").locator("body").evaluate(b => b.innerText + "|" + b.innerHTML.length);
  const before = await body();
  await pg.click(process.env.SEND || "[data-send=success]"); await pg.waitForTimeout(+(process.env.SEND_WAIT || 300));
  out.checks.testChangesPreview = (await body()) !== before;

  // Tabs with the keyboard.
  await pg.focus(`[data-tab=${tabs[0]}]`); await pg.keyboard.press("ArrowRight");
  out.checks.arrowRight = await pg.evaluate(t => document.activeElement.dataset.tab === t && !document.querySelector(`[data-tab-panel=${t}]`).hidden, tabs[1]);
  await pg.keyboard.press("End"); out.checks.end = await pg.evaluate(t => document.activeElement.dataset.tab === t, tabs[tabs.length - 1]);
  out.checks.focusVisible = await pg.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== "none");

  // Copy.
  await pg.click("#copyCss"); await pg.waitForTimeout(150);
  out.checks.clipboardMatches = (await pg.evaluate(() => navigator.clipboard.readText())) === await css();
  out.checks.status = (await pg.$eval("#status", s => s.textContent)).slice(0, 20);
  out.errors = errors; await ctx.close(); return out;
}

(async () => {
  const browser = await chromium.launch();
  const a = await run(browser, process.env.ORIG), b = await run(browser, process.env.NEW);
  const keys = Object.keys(a.css), diff = keys.filter(k => a.css[k] !== b.css[k]);
  const missing = Object.keys(b.css).filter(k => !(k in a.css));
  console.log(`exported CSS: ${diff.length || missing.length ? "DIFFERENT " + diff.concat(missing).join(",") : "identical"} (${keys.length} states, ${Object.values(b.css).reduce((s, c) => s + c.length, 0)} chars)`);
  console.log("original:", JSON.stringify(a.checks), "errors", a.errors.length);
  console.log("new:     ", JSON.stringify(b.checks), "errors", b.errors.length, b.errors.slice(0, 3).join(" | "));
  await browser.close();
})();
