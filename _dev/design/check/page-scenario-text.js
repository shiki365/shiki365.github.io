#!/usr/bin/env node
/*
 * page-scenario-text.js - scenario text maker: the checks of page.js after the steps that reveal hidden parts
 * (sample text, a speaker, the "unknown speaker" notice, a selected row with the message-box and log samples,
 * the editor and its notice, a confirmed batch), in every theme situation, width and language.
 *
 *   URL=<url of the tool> JSZIP=<path to jszip.min.js 3.10.1> node _dev/design/check/page-scenario-text.js
 *
 * Needs Node and Playwright (npm i playwright).
 */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const { audit } = require("./page.js");

(async () => {
  const browser = await chromium.launch();
  let problems = 0, runs = 0;
  for (const [scheme, stored] of [["dark", ""], ["light", ""], ["dark", "light"], ["light", "dark"]])
  for (const width of [1280, 375]) for (const lang of ["ja", "en", "ko"]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
    if (stored) await ctx.addInitScript(v => { try { localStorage.setItem("shiki365.theme", v); } catch (e) {} }, stored);
    if (process.env.JSZIP) await ctx.route("https://cdnjs.cloudflare.com/**/jszip.min.js", route => route.fulfill({
      status: 200, contentType: "application/javascript", headers: { "access-control-allow-origin": "*" }, body: fs.readFileSync(process.env.JSZIP) }));
    const pg = await ctx.newPage(); const errors = [];
    pg.on("pageerror", e => errors.push(String(e)));
    pg.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    await pg.goto(process.env.URL + "?lang=" + lang); await pg.waitForTimeout(400);
    await pg.click("#fillSample"); await pg.waitForTimeout(200);
    await pg.click("#addSpeaker"); await pg.waitForTimeout(150);
    // A line by a speaker nobody registered shows the "unknown" notice and its badge.
    await pg.evaluate(() => { const ta = document.getElementById("script"); ta.value += "\nボブ「はじめまして」"; ta.dispatchEvent(new Event("input", { bubbles: true })); });
    await pg.waitForTimeout(300);
    await pg.click("#entries tr:nth-child(2)"); await pg.waitForTimeout(250);
    await pg.fill("#edText", "手直しした本文"); await pg.press("#edText", "Tab"); await pg.waitForTimeout(200);
    await pg.click("#confirmBatch"); await pg.waitForTimeout(200);
    await pg.click("#fillSample"); await pg.waitForTimeout(200);
    await pg.click("#entries tr:nth-child(2)"); await pg.waitForTimeout(250);
    await pg.evaluate(() => { for (const d of document.querySelectorAll("details")) d.open = true; });
    const shown = await pg.evaluate(() => ["mbox", "logRow", "editor", "confirmedCard", "unknown"].filter(id => { const e = document.getElementById(id); return e && !e.hidden && e.offsetParent; }));
    const r = await pg.evaluate(audit);
    runs++;
    const issues = [];
    if (r.overflow > 0) issues.push(`overflow ${r.overflow}px ${r.wide.join(" | ")}`);
    if (r.bad.length) issues.push(`contrast ${r.bad.length}: ${[...new Set(r.bad)].slice(0, 6).join(" ; ")}`);
    if (errors.length) issues.push("console: " + errors.slice(0, 3).join(" | "));
    if (issues.length) { problems++; console.log(`✗ ${scheme}/${stored || "auto"} ${width} ${lang}: ${issues.join(" || ")}`); }
    else if (runs === 1) console.log(`✓ first run: checked ${r.checked} texts; shown after the steps: ${shown.join(", ")}`);
    await ctx.close();
  }
  console.log(problems ? `${problems} problem(s) in ${runs} runs` : `all clean (${runs} runs)`);
  await browser.close();
})();
