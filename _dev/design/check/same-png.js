#!/usr/bin/env node
/*
 * same-png.js - foreground frame maker: the downloaded PNG, and every file in the ZIP of variants, must be
 * byte-identical in the original and in the restyled copy after the same steps (every preset, then every
 * visible slider, checkbox and pull-down changed tab by tab).
 *
 *   ORIG=<url of the original> NEW=<url of the restyled copy> [SCHEME=dark|light] node _dev/design/check/same-png.js
 *
 * Needs Node, Playwright (npm i playwright) and python3 (to read the ZIP).
 */
"use strict";
const { chromium } = require("playwright");
const crypto = require("crypto");
const fs = require("fs");
const { execFileSync } = require("child_process");

const sha = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);

async function run(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: process.env.SCHEME || "dark",
    locale: "ja-JP", acceptDownloads: true });
  const pg = await ctx.newPage(); const errors = [];
  pg.on("pageerror", e => errors.push(String(e)));
  pg.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await pg.goto(url); await pg.waitForTimeout(800);
  const out = { files: {}, checks: {} };
  const grab = async (name, button = "#downloadPng") => {
    const [dl] = await Promise.all([pg.waitForEvent("download"), pg.click(button)]);
    const file = await dl.path();
    if (button === "#downloadZip") {
      // Compare the entries, not the archive (it may carry dates).
      const list = JSON.parse(execFileSync("python3", ["-I", "-c",
        "import sys,zipfile,hashlib,json;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({n:hashlib.sha256(z.read(n)).hexdigest()[:16] for n in z.namelist()}))", file]).toString());
      for (const [n, h] of Object.entries(list)) out.files[name + "/" + n] = h;
    } else out.files[name] = sha(file);
  };
  const tabs = await pg.$$eval("[data-tab]", bs => bs.map(b => b.dataset.tab));

  await grab("default");
  await pg.click(`[data-tab=${tabs[0]}]`);
  const designs = await pg.$$eval("#design option", os => os.map(o => o.value));
  for (const d of designs) { await pg.selectOption("#design", d); await pg.click("#applyDesign"); await pg.waitForTimeout(150); await grab("design:" + d); }

  // Per tab, cumulatively: every visible slider to its max, every checkbox flipped, every select to its last option.
  let controls = 0;
  for (const tab of tabs) {
    await pg.click(`[data-tab=${tab}]`); await pg.waitForTimeout(100);
    for (const el of await pg.$$("[data-tab-panel] input[type=range][data-bind]:visible")) {
      if (!(await el.isVisible())) continue;
      await el.evaluate(e => { e.value = e.max; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); });
      controls++;
    }
    for (const el of await pg.$$("[data-tab-panel] input[type=checkbox][data-bind]:visible")) {
      if (!(await el.isVisible())) continue;
      await el.click(); controls++;
    }
    for (const el of await pg.$$("[data-tab-panel] select[data-bind]:visible")) {
      if (!(await el.isVisible())) continue;
      const last = await el.evaluate(e => e.options[e.options.length - 1].value);
      await el.selectOption(last); controls++;
    }
    await pg.waitForTimeout(200);
    if (await pg.$("#downloadPng:visible")) await grab("after-tab:" + tab);
  }
  out.checks.controls = controls;

  // Variants: when they are on, the ZIP button and the thumbnails appear.
  out.checks.zipShown = await pg.isVisible("#downloadZip");
  out.checks.thumbsShown = await pg.isVisible("#thumbs");
  if (out.checks.zipShown) await grab("zip", "#downloadZip");

  // The preview canvas has something drawn on it.
  out.checks.previewDrawn = await pg.$eval("#preview", c => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; });
  // Tabs with the keyboard.
  await pg.focus(`[data-tab=${tabs[0]}]`); await pg.keyboard.press("ArrowRight");
  out.checks.arrowRight = await pg.evaluate(t => document.activeElement.dataset.tab === t && !document.querySelector(`[data-tab-panel=${t}]`).hidden, tabs[1]);
  out.checks.focusVisible = await pg.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== "none");
  out.checks.status = (await pg.$eval("#status", s => s.textContent)).slice(0, 24);
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
