#!/usr/bin/env node
/*
 * same-cover.js - cover print maker (表紙入稿メーカー): what the tool works out and makes must be the same in the
 * original and in the restyled copy.
 *
 *   ORIG=<url of the original> NEW=<url of the restyled copy> ICC=<a CMYK .icc file> [SCHEME=dark|light] \
 *     node _dev/design/check/same-cover.js
 *
 * Both pages go through the same steps. Compared after each step: the size line, the checklist, the notes on the
 * printer and on the spine; colour codes such as the spine colour are left out, because the page reads them
 * from the preview canvas, so they move by a shade when the box around it changes size. (The preview canvas is not compared: it is drawn at the width of its box, so its
 * pixels change with the layout; the files at the end are made at print resolution and do not.) Steps: every printer, every book size, both ways
 * of binding, the spine by hand, two pictures put into the front and back slots (and one spread), the guide
 * and proof switches. Then the files themselves, byte for byte: the three guide PNGs, the print PDF (CMYK, with
 * the ICC profile) and the "how it looks when printed" PNG.
 *
 * The tool loads papers.v1.js and printers.v1.js from ../doujin-printer-finder/, so that folder must sit next
 * to both the original and the restyled copy (ORIG and NEW are served from folders that each have one).
 * ICC: a CMYK profile, for example Ghostscript's default_cmyk.icc (Ubuntu: package libgs-common,
 * /usr/share/color/icc/ghostscript/default_cmyk.icc). The test pictures are drawn by python3 (Pillow).
 * Needs Node, Playwright (npm i playwright) and python3 with Pillow.
 */
"use strict";
const { chromium } = require("playwright");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ICC = process.env.ICC;
if (!process.env.ORIG || !process.env.NEW || !ICC) { console.error("set ORIG, NEW and ICC (see the top of this file)"); process.exit(2); }
const sha = buf => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);

// Test pictures: smooth gradients with a few hard edges and an off-grey area, so scaling, cropping and the
// colour conversion all show up in the bytes.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cover-test-"));
const pictures = { front: [2100, 2800], back: [2100, 2800], spread: [4600, 2900] };
execFileSync("python3", ["-I", "-c", `
import sys, json
from PIL import Image, ImageDraw
out, spec = sys.argv[1], json.loads(sys.argv[2])
for i, (name, (w, h)) in enumerate(spec.items()):
    im = Image.new("RGB", (w, h))
    px = im.load()
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            c = ((x * 255 // w + i * 70) % 256, (y * 255 // h + i * 40) % 256, ((x + y) * 255 // (w + h) + i * 100) % 256)
            for dy in range(4):
                for dx in range(4):
                    if x + dx < w and y + dy < h: px[x + dx, y + dy] = c
    d = ImageDraw.Draw(im)
    d.rectangle([w // 10, h // 10, w * 9 // 10, h * 9 // 10], outline=(255, 255, 255), width=12)
    d.ellipse([w // 3, h // 3, w * 2 // 3, h * 2 // 3], fill=(200 - i * 30, 60 + i * 20, 90))
    d.rectangle([0, 0, w // 8, h], fill=(0, 0, 0))
    d.rectangle([w * 7 // 8, 0, w, h], fill=(250, 250, 250))
    im.save(out + "/" + name + ".png")
`, dir, JSON.stringify(pictures)]);

async function run(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, colorScheme: process.env.SCHEME || "dark", locale: "ja-JP", acceptDownloads: true });
  const pg = await ctx.newPage(); const errors = [];
  pg.on("pageerror", e => errors.push(String(e)));
  pg.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await pg.goto(url); await pg.waitForTimeout(800);
  const out = { steps: {}, files: {}, checks: {} };
  const snap = async name => {
    await pg.waitForTimeout(120);
    out.steps[name] = await pg.evaluate(() => JSON.stringify({
      size: document.getElementById("sizeText").textContent,
      checks: [...document.querySelectorAll("#checks li")].map(li => li.className + ":" + li.textContent.trim().replace(/#[0-9a-fA-F]{6}\b/g, "#rrggbb")),
      printerNote: document.getElementById("printerNote").textContent,
      spineNote: document.getElementById("spineNote").textContent,
    }));
  };
  const tab = async name => { await pg.click(`[data-tab=${name}]`); };
  const download = async (name, trigger) => {
    const [dl] = await Promise.all([pg.waitForEvent("download", { timeout: 180000 }), trigger()]);
    out.files[name] = dl.suggestedFilename() + " " + sha(fs.readFileSync(await dl.path()));
    await pg.waitForTimeout(150);
  };

  await snap("start");
  // Every printer and every book size.
  await tab("book");
  for (const sel of ["#printer", "#format"]) {
    for (const value of await pg.$$eval(sel + " option", os => os.map(o => o.value))) {
      await pg.selectOption(sel, value); await snap(sel + "=" + value);
    }
  }
  await pg.selectOption("#printer", await pg.$eval("#printer", s => s.options[1].value));
  for (const value of ["right", "left"]) { await pg.check(`input[name=binding][value=${value}]`); await snap("binding=" + value); }
  await pg.check("input[name=spineMode][value=auto]");   // the pages and papers only show when the spine is worked out
  await pg.fill("#pages", "120"); await pg.press("#pages", "Tab"); await snap("pages=120");
  for (const sel of ["#body", "#coverPaper"]) {
    const values = await pg.$$eval(sel + " option", os => os.map(o => o.value));
    if (!values.length || !(await pg.isVisible(sel))) { out.steps[sel + "=last"] = "not shown: " + values.length; continue; }
    await pg.selectOption(sel, values[values.length - 1]); await snap(sel + "=last");
  }
  await pg.check("input[name=spineMode][value=manual]");
  await pg.fill("#spineManual", "7.5"); await pg.press("#spineManual", "Tab"); await snap("spine=manual");
  await pg.check("input[name=spineMode][value=auto]"); await snap("spine=auto");

  // Pictures: front and back, then a spread.
  await tab("pics");
  await pg.check("input[name=mode][value=pair]");
  for (const [slot, file] of [["front", "front.png"], ["back", "back.png"]]) {
    const [chooser] = await Promise.all([pg.waitForEvent("filechooser"), pg.click(`.slot[data-slot=${slot}]`)]);
    await chooser.setFiles(path.join(dir, file)); await pg.waitForTimeout(500); await snap("picture=" + slot);
  }
  for (const [prop, value] of [["zoom", "1.6"], ["x", "0.4"], ["y", "-0.3"]]) {
    const input = await pg.$(`input[data-bind="pos.front.${prop}"]`);
    if (input) { await input.evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }, value); await snap("pos.front." + prop); }
  }
  await pg.check("input[name=spineAuto][value=pick]");
  await pg.$eval("#spineColor", e => { e.value = "#336699"; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); });
  await snap("spineColor=pick");
  await pg.check("input[name=spineAuto][value=auto]");
  for (const id of ["#showGuides", "#showProof"]) { await pg.click(id); await snap("toggle" + id); await pg.click(id); }

  // Files: guides (no profile needed), then the profile, the PDF and the proof.
  await tab("export");
  for (const which of ["spread", "front", "back"]) await download("guide-" + which, () => pg.click(`[data-guide=${which}]`));
  await pg.setInputFiles("#iccFile", ICC); await pg.waitForTimeout(800);
  out.checks.iccShown = !!(await pg.$("#iccState .icc-name"));   // the page names the profile it read
  await snap("icc");
  await pg.fill("#fileName", "testcover"); await pg.press("#fileName", "Tab");
  await download("pdf-pair", () => pg.click("#exportPdf"));
  await download("proof-pair", () => pg.click("#exportProof"));
  await tab("pics");
  await pg.check("input[name=mode][value=spread]");
  const [chooser] = await Promise.all([pg.waitForEvent("filechooser"), pg.click(".slot[data-slot=spread]")]);
  await chooser.setFiles(path.join(dir, "spread.png")); await pg.waitForTimeout(500); await snap("picture=spread");
  await tab("export");
  await download("pdf-spread", () => pg.click("#exportPdf"));

  out.checks.status = (await pg.$eval("#status", s => s.textContent)).replace(/[\d.]+/g, "#").slice(0, 30);
  out.checks.printers = await pg.$$eval("#printer option", os => os.length);
  out.errors = errors;
  await ctx.close();
  return out;
}

// Where two texts first differ, with a little around it.
function firstDifference(x, y) {
  x = String(x); y = String(y);
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  const cut = text => JSON.stringify(text.slice(Math.max(0, i - 40), i + 80));
  return `at ${i}: original ${cut(x)} / new ${cut(y)}`;
}

(async () => {
  const browser = await chromium.launch();
  const a = await run(browser, process.env.ORIG), b = await run(browser, process.env.NEW);
  const same = (x, y) => { const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])]; return [keys, keys.filter(k => x[k] !== y[k])]; };
  const [stepKeys, stepDiff] = same(a.steps, b.steps), [fileKeys, fileDiff] = same(a.files, b.files);
  console.log(`steps: ${stepDiff.length ? "DIFFERENT " + stepDiff.join(", ") : "identical"} (${stepKeys.length} steps) | files: ${fileDiff.length ? "DIFFERENT " + fileDiff.join(", ") : "identical"} (${fileKeys.length} files)`);
  if (stepDiff.length) console.log("first difference, in " + stepDiff[0] + ": " + firstDifference(a.steps[stepDiff[0]], b.steps[stepDiff[0]]));
  console.log("original:", JSON.stringify(a.checks), "errors", a.errors.length, a.errors.slice(0, 2).join(" | "));
  console.log("new:     ", JSON.stringify(b.checks), "errors", b.errors.length, b.errors.slice(0, 2).join(" | "));
  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
})();
