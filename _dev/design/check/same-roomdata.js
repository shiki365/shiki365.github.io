#!/usr/bin/env node
/*
 * same-roomdata.js - scenario text maker: the files inside the exported room data (ZIP) must be byte-identical
 * in the original and in the restyled copy. The clock and the random numbers are pinned in both pages, since
 * the export uses them for ids and dates.
 *
 *   ORIG=<url> NEW=<url> JSZIP=<path to jszip.min.js 3.10.1> [SCHEME=dark|light] node _dev/design/check/same-roomdata.js
 *
 * JSZIP is only needed where cdnjs cannot be reached: "npm pack jszip@3.10.1" and unpack package/dist/jszip.min.js
 * (its SHA-512 is the one in the page's integrity attribute, so the page accepts it).
 * Needs Node, Playwright (npm i playwright) and python3 (to read the ZIP).
 */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const { execFileSync } = require("child_process");

const PIN = () => {
  let s = 12345;
  Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const fixed = 1767225600000;
  Date.now = () => fixed;
  let r = 7;
  crypto.getRandomValues = arr => { for (let i = 0; i < arr.length; i++) arr[i] = (r = (r * 131 + 17) % 251); return arr; };
};
const entries = file => JSON.parse(execFileSync("python3", ["-I", "-c",
  "import sys,zipfile,hashlib,json;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({n:hashlib.sha256(z.read(n)).hexdigest()[:16] for n in z.namelist()}))", file]).toString());

async function run(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: process.env.SCHEME || "dark",
    locale: "ja-JP", acceptDownloads: true });
  await ctx.addInitScript(PIN);
  // cdnjs is not reachable from this test machine: serve the same JSZip 3.10.1 (its SHA-512 matches the page's
  // integrity attribute), so the page loads exactly what it would load from the CDN.
  if (process.env.JSZIP) await ctx.route("https://cdnjs.cloudflare.com/**/jszip.min.js", route => route.fulfill({
    status: 200, contentType: "application/javascript", headers: { "access-control-allow-origin": "*" }, body: fs.readFileSync(process.env.JSZIP) }));
  const pg = await ctx.newPage(); const errors = [];
  pg.on("pageerror", e => errors.push(String(e)));
  pg.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await pg.goto(url); await pg.waitForTimeout(800);
  const out = { files: {}, checks: {} };
  const grab = async (name, button) => {
    if (await pg.$eval(button, b => b.disabled)) { out.files[name] = "nothing to export"; return; }
    const [dl] = await Promise.all([pg.waitForEvent("download", { timeout: 60000 }), pg.click(button)]);
    for (const [n, h] of Object.entries(entries(await dl.path()))) out.files[name + "/" + n] = h;
    await pg.waitForTimeout(200);
  };
  out.checks.jszip = await pg.evaluate(() => !!window.JSZip);

  // Script mode: sample text, a speaker, then export.
  await pg.check("input[name=mode][value=script]");
  await pg.click("#fillSample"); await pg.waitForTimeout(300);
  await pg.click("#addSpeaker"); await pg.waitForTimeout(200);
  const nameInput = await pg.$("#speakers .speaker input[type=text]");
  if (nameInput) { await nameInput.fill("アリス"); await nameInput.press("Tab"); }
  out.checks.rowsScript = await pg.$$eval("#entries tr", trs => trs.length);
  await grab("script", "#exportZip");

  // Select a row: the message-box sample, the log sample and the editor appear. Edit it, then confirm the batch.
  await pg.click("#entries tr:nth-child(2)"); await pg.waitForTimeout(300);
  out.checks.sampleShown = await pg.isVisible("#mbox") && await pg.isVisible("#logRow") && await pg.isVisible("#editor");
  await pg.fill("#edText", "手直しした本文"); await pg.press("#edText", "Tab"); await pg.waitForTimeout(200);
  out.checks.editedNote = await pg.isVisible("#editedNote");
  await grab("edited", "#exportZip");
  await pg.click("#confirmBatch"); await pg.waitForTimeout(300);
  out.checks.confirmedCard = await pg.isVisible("#confirmedCard");

  // The sample again, with the reading options changed.
  await pg.click("#fillSample"); await pg.waitForTimeout(300);
  for (const [sel, value] of [["#optUnit", "block"], ["#optNarration", "skip"]]) {
    const el = await pg.$(sel);
    if (el && await el.isVisible()) await el.selectOption(value);
  }
  for (const sel of ["#optKeepQuotes", "input[data-opt=faceInTitle]"]) { const el = await pg.$(sel); if (el && await el.isVisible()) await el.click(); }
  await pg.waitForTimeout(300);
  out.checks.rowsOptions = await pg.$$eval("#entries tr", trs => trs.length);
  await grab("options", "#exportZip");

  // Heading mode with its own sample.
  await pg.check("input[name=mode][value=heading]"); await pg.waitForTimeout(200);
  await pg.click("#fillSample"); await pg.waitForTimeout(300);
  out.checks.rowsHeading = await pg.$$eval("#entries tr", trs => trs.length);
  await grab("heading", "#exportZip");

  out.checks.exportStatus = (await pg.$eval("#exportStatus", s => s.textContent)).replace(/[\d.]+/g, "#").slice(0, 24);
  // Contrast of the parts that only show after these steps is checked by the caller; keep the page open state.
  out.errors = errors; await ctx.close(); return out;
}

(async () => {
  const browser = await chromium.launch();
  const a = await run(browser, process.env.ORIG), b = await run(browser, process.env.NEW);
  const keys = [...new Set([...Object.keys(a.files), ...Object.keys(b.files)])];
  const diff = keys.filter(k => a.files[k] !== b.files[k]);
  console.log(`room data files: ${diff.length ? "DIFFERENT " + diff.join(", ") : "identical"} (${keys.length} files in 4 ZIPs)`);
  if (process.env.DEBUG) console.log(JSON.stringify(b.files, null, 1));
  console.log("original:", JSON.stringify(a.checks), "errors", a.errors.length, a.errors.slice(0, 2).join(" | "));
  console.log("new:     ", JSON.stringify(b.checks), "errors", b.errors.length, b.errors.slice(0, 2).join(" | "));
  await browser.close();
})();
