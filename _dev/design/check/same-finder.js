#!/usr/bin/env node
/*
 * same-finder.js - printer finder (同人誌の印刷所さがし): the results must be the same in the original and in the
 * restyled copy. This tool makes no file, so what is compared is the text of what it shows.
 *
 *   ORIG=<url of the original> NEW=<url of the restyled copy> [SCHEME=dark|light] node _dev/design/check/same-finder.js
 *
 * Both pages go through the same steps; after each, the summary line and the list of printers (names, rank,
 * prices, chips, links) are compared, with the counts next to the choices. The text is read with textContent
 * and white space folded: innerText would change with the style (where a line breaks). Steps: every book size, the
 * numbers (pages, copies, budget), every choice of "kind", every condition on its own, all conditions at once,
 * "reset". Then the directory of all printers, and every printer's own page (its facts, table, calculator and
 * links), in Japanese, and the list and the directory also in English and Korean.
 * Needs Node and Playwright (npm i playwright).
 */
"use strict";
const { chromium } = require("playwright");

if (!process.env.ORIG || !process.env.NEW) { console.error("set ORIG and NEW (see the top of this file)"); process.exit(2); }

async function run(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, colorScheme: process.env.SCHEME || "dark", locale: "ja-JP" });
  const pg = await ctx.newPage(); const errors = [];
  pg.on("pageerror", e => errors.push(String(e)));
  pg.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  const out = { steps: {}, checks: {} };
  await pg.addInitScript(() => {
    window.text = e => e.textContent.replace(/\s+/g, " ").trim();
    // The links are made from the address of the page: leave the folder out, so two copies in two folders compare.
    window.hrefs = e => [...e.querySelectorAll("a")].map(a => (a.getAttribute("href") || "").replace(location.pathname, "<page>")).join(",");
  });
  const open = async (query = "") => { await pg.goto(url + query, { waitUntil: "load" }); await pg.waitForTimeout(500); };
  const results = () => pg.evaluate(() => JSON.stringify({
    summary: text(document.getElementById("summary")),
    list: [...document.querySelectorAll("#list > li")].map(li => text(li) + "|" + hrefs(li)),
    counts: [...document.querySelectorAll("#wantGroups [data-count], #conditions [data-count]")].map(e => e.dataset.count + "=" + e.textContent),
  }));
  const snap = async name => { await pg.waitForTimeout(80); out.steps[name] = await results(); };

  await open("?lang=ja");
  await snap("start");
  for (const value of await pg.$$eval("#format option", os => os.map(o => o.value))) { await pg.selectOption("#format", value); await snap("format=" + value); }
  await pg.selectOption("#format", await pg.$eval("#format", s => s.options[0].value));
  for (const [id, values] of [["#pages", ["4", "40", "200", "1000"]], ["#copies", ["1", "50", "500"]], ["#budget", ["5000", "20000", ""]]]) {
    for (const v of values) { await pg.fill(id, v); await pg.press(id, "Tab"); await snap(id + "=" + v); }
  }
  for (const value of await pg.$$eval("input[name=kind]", rs => rs.map(r => r.value))) { await pg.check(`input[name=kind][value="${value}"]`); await snap("kind=" + (value || "any")); }
  await pg.check('input[name=kind][value=""]');

  // Every condition on its own, then all together.
  const boxes = await pg.$$("#conditions input[type=checkbox]");
  out.checks.conditions = boxes.length;
  for (let i = 0; i < boxes.length; i++) {
    const boxNow = (await pg.$$("#conditions input[type=checkbox]"))[i];
    await boxNow.check(); await snap("only#" + i); await boxNow.uncheck();
  }
  for (let i = 0; i < boxes.length; i++) await (await pg.$$("#conditions input[type=checkbox]"))[i].check();
  await snap("all-conditions");
  await pg.click("#reset"); await snap("reset");

  // The directory, and every printer's own page.
  await pg.click("[data-tab=all]"); await pg.waitForTimeout(200);
  out.steps.directory = await pg.$eval("#directory", d => text(d) + "|" + hrefs(d));
  const pages = await pg.$$eval("#directory a.name", as => as.map(a => a.getAttribute("href")));
  out.checks.printers = pages.length;
  for (const href of pages) {
    await open(href.includes("?") ? href.slice(href.indexOf("?")) : "");
    out.steps["page " + href.slice(href.indexOf("?"))] = await pg.$eval("#detail", d => text(d) + "|" + hrefs(d));
  }
  // The calculator on a printer's page, when it has one.
  if (pages.length) {
    await open(pages[0].slice(pages[0].indexOf("?")));
    const inputs = await pg.$$("#detail .calc input[type=number]");
    for (const input of inputs) { await input.fill("77"); await input.press("Tab"); }
    out.steps.calc = await pg.$eval("#detail", d => text(d));
  }
  for (const lang of ["en", "ko"]) {
    await open("?lang=" + lang); await snap("list " + lang);
    await pg.click("[data-tab=all]"); await pg.waitForTimeout(200);
    out.steps["directory " + lang] = await pg.$eval("#directory", d => text(d));
  }
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
  const keys = [...new Set([...Object.keys(a.steps), ...Object.keys(b.steps)])];
  const diff = keys.filter(k => a.steps[k] !== b.steps[k]);
  console.log(`results: ${diff.length ? "DIFFERENT " + diff.slice(0, 8).join(", ") : "identical"} (${keys.length} steps, ${Object.values(b.steps).reduce((s, x) => s + x.length, 0)} chars)`);
  if (diff.length) console.log("first difference, in " + diff[0] + ": " + firstDifference(a.steps[diff[0]], b.steps[diff[0]]));
  console.log("original:", JSON.stringify(a.checks), "errors", a.errors.length, a.errors.slice(0, 2).join(" | "));
  console.log("new:     ", JSON.stringify(b.checks), "errors", b.errors.length, b.errors.slice(0, 2).join(" | "));
  await browser.close();
})();
