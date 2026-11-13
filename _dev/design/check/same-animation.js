#!/usr/bin/env node
/*
 * same-animation.js - scene transition maker: the downloaded WebP / APNG must be byte-identical in the
 * original and in the restyled copy, for every preset (at 640x360) and with the other settings changed.
 * Takes about two minutes.
 *
 *   ORIG=<url of the original docs/> NEW=<url of the restyled docs/> [SCHEME=dark|light] node _dev/design/check/same-animation.js
 *
 * Needs Node and Playwright (npm i playwright).
 */
"use strict";
const { chromium } = require("playwright");
const crypto = require("crypto");
const fs = require("fs");

const sha = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);

async function run(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: process.env.SCHEME || "dark",
    locale: "ja-JP", acceptDownloads: true });
  const pg = await ctx.newPage(); const errors = [];
  pg.on("pageerror", e => errors.push(String(e)));
  pg.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await pg.goto(url); await pg.waitForTimeout(800);
  const out = { files: {}, checks: {} };
  const grab = async name => {
    const [dl] = await Promise.all([pg.waitForEvent("download", { timeout: 180000 }), pg.click("#download")]);
    out.files[name] = dl.suggestedFilename() + " " + sha(await dl.path());
    await pg.waitForTimeout(100);
  };
  const choose = async (sel, value) => { await pg.selectOption(sel, value); await pg.waitForTimeout(60); };

  // Every template, at the smallest size, as WebP.
  const presets = await pg.$$eval("#preset option", os => os.map(o => o.value));
  out.checks.presets = presets.length;
  for (const p of presets) {
    await choose("#preset", p);
    await choose("#size", "640x360");
    await grab("preset:" + p);
  }

  // Then every other visible control changed: sliders to the middle, checkboxes flipped, selects to the
  // last option (size kept small).
  let controls = 0;
  for (const el of await pg.$$("#form input[type=range]:visible")) {
    if (!(await el.isVisible())) continue;
    await el.evaluate(e => { e.value = String((+e.min + +e.max) / 2); e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); });
    controls++;
  }
  for (const el of await pg.$$("#form input[type=checkbox]:visible")) {
    if (!(await el.isVisible())) continue;
    await el.click(); controls++;
  }
  for (const el of await pg.$$("#form select:visible")) {
    if (!(await el.isVisible())) continue;
    const id = await el.getAttribute("id");
    if (id === "preset" || id === "size" || id === "format") continue;
    const last = await el.evaluate(e => e.options[e.options.length - 1].value);
    await el.selectOption(last); controls++;
  }
  await choose("#size", "640x360");
  out.checks.controls = controls;
  await grab("controls:webp");
  await choose("#format", "apng");
  await grab("controls:apng");

  out.checks.previewDrawn = await pg.$eval("#preview", c => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; });
  out.checks.stageClass = await pg.$eval("#stage", s => s.className);
  out.checks.status = (await pg.$eval("#status", s => s.textContent)).replace(/[\d.]+/g, "#").slice(0, 30);
  out.errors = errors; await ctx.close(); return out;
}

(async () => {
  const browser = await chromium.launch();
  const a = await run(browser, process.env.ORIG), b = await run(browser, process.env.NEW);
  const keys = [...new Set([...Object.keys(a.files), ...Object.keys(b.files)])];
  const diff = keys.filter(k => a.files[k] !== b.files[k]);
  console.log(`downloaded files: ${diff.length ? "DIFFERENT " + diff.join(", ") : "identical"} (${keys.length} files)`);
  console.log("original:", JSON.stringify(a.checks), "errors", a.errors.length);
  console.log("new:     ", JSON.stringify(b.checks), "errors", b.errors.length, b.errors.slice(0, 3).join(" | "));
  await browser.close();
})();
