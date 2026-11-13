#!/usr/bin/env node
/*
 * page.js - console errors, sideways overflow and text contrast of a page, in every theme and language.
 *
 *   node _dev/design/check/page.js <url> [<url> ...]
 *
 * Each URL is opened 24 times: OS dark / OS light / "light" chosen on a dark OS / "dark" chosen on a light OS,
 * at 1280px and 375px wide, in Japanese, English and Korean. On a page with tabs ([data-tab]) every tab is
 * opened; every <details> is opened. Reports
 *   - console errors and page errors
 *   - anything wider than the window (the tab bar and the preview may scroll and are left out)
 *   - text under 4.5:1 against its background (buttons, inputs and outputs included). Text on a picture or
 *     gradient cannot be measured and is counted as "skipped".
 * Needs Node and Playwright (npm i playwright). Set JSZIP=<path to jszip.min.js 3.10.1> when the page loads
 * JSZip from cdnjs and cdnjs cannot be reached from the test machine.
 * Other checks reuse the measuring function: require("./page.js").audit
 */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");

// Runs in the page: overflow + contrast of every visible text-bearing element.
function audit() {
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  function bgOf(el) {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== "none" && !e.matches("img, select")) return { skip: true };
      const c = parse(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  }
  const bad = []; let checked = 0, skipped = 0;
  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest("svg, script, style, iframe")) continue;
    const isField = el.matches("input:not([type=range]):not([type=checkbox]):not([type=color]):not([type=file]), select, textarea, button, output");
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!hasText && !isField) continue;
    if (isField && !hasText && !(el.value || "").trim()) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden") continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
    if (op < 0.99) continue; // disabled controls
    const bg = bgOf(el); if (bg.skip) { skipped++; continue; }
    const fg = over(parse(cs.color), bg);
    const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    checked++;
    if (ratio < 4.5) bad.push(`${ratio.toFixed(2)} ${el.tagName.toLowerCase()}.${el.className} "${(el.textContent || el.value).trim().slice(0, 30)}"`);
  }
  const wide = [...document.body.querySelectorAll("*")].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > document.documentElement.clientWidth + 1 && !e.closest(".tabbar, iframe, .stage"); })
    .slice(0, 5).map(e => e.tagName.toLowerCase() + "." + e.className + " " + Math.round(e.getBoundingClientRect().right));
  return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, wide, bad, checked, skipped };
}

async function open(browser, url, { scheme, stored, width, lang }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
  if (stored) await ctx.addInitScript(v => { try { localStorage.setItem("shiki365.theme", v); } catch (e) {} }, stored);
  if (process.env.JSZIP) await ctx.route("https://cdnjs.cloudflare.com/**/jszip.min.js", route => route.fulfill({
    status: 200, contentType: "application/javascript", headers: { "access-control-allow-origin": "*" }, body: fs.readFileSync(process.env.JSZIP) }));
  const pg = await ctx.newPage();
  const errors = [];
  pg.on("pageerror", e => errors.push(String(e)));
  pg.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await pg.goto(url + (url.includes("?") ? "&" : "?") + "lang=" + lang, { waitUntil: "load" });
  await pg.waitForTimeout(300);
  return { ctx, pg, errors };
}

const SITUATIONS = [["dark", ""], ["light", ""], ["dark", "light"], ["light", "dark"]];

async function main(urls) {
  const browser = await chromium.launch();
  let problems = 0, runs = 0;
  for (const url of urls) for (const [scheme, stored] of SITUATIONS) for (const width of [1280, 375]) for (const lang of ["ja", "en", "ko"]) {
    const { ctx, pg, errors } = await open(browser, url, { scheme, stored, width, lang });
    const where = `${url} ${scheme}/${stored || "auto"} ${width} ${lang}`;
    const tabs = await pg.$$eval("[data-tab]", bs => bs.map(b => b.dataset.tab));
    const results = [];
    for (const tab of tabs.length ? tabs : [null]) {
      if (tab) await pg.click(`[data-tab=${tab}]`);
      await pg.evaluate(() => { for (const d of document.querySelectorAll("details")) d.open = true; });
      results.push([tab || "page", await pg.evaluate(audit)]);
    }
    runs++;
    for (const [tab, r] of results) {
      const issues = [];
      if (r.overflow > 0) issues.push(`overflow ${r.overflow}px ${r.wide.join(" | ")}`);
      if (r.bad.length) issues.push(`contrast ${r.bad.length}: ${[...new Set(r.bad)].slice(0, 6).join(" ; ")}`);
      if (issues.length) { problems++; console.log(`✗ ${where} ${tab}: ${issues.join(" || ")}`); }
    }
    if (errors.length) { problems++; console.log(`✗ ${where} console: ${errors.slice(0, 3).join(" | ")}`); }
    if (runs % 24 === 1) console.log(`  ${url}: first run measured ${results[0][1].checked} texts (${results[0][1].skipped} on a picture, skipped)`);
    await ctx.close();
  }
  console.log(problems ? `${problems} problem(s) in ${runs} runs` : `all clean (${runs} runs)`);
  await browser.close();
  process.exitCode = problems ? 1 : 0;
}

module.exports = { audit, open, SITUATIONS };
if (require.main === module) {
  const urls = process.argv.slice(2);
  if (!urls.length) { console.error("usage: node page.js <url> [<url> ...]"); process.exit(2); }
  main(urls);
}
