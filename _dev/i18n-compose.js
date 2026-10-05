#!/usr/bin/env node
/*
 * i18n-compose.js - write a tool's dictionaries from new translations plus the ones other tools already have.
 *
 *   node _dev/i18n-compose.js <folder> "<English name>" <new.js> <donor folder> [<donor folder> ...]
 *
 * <new.js> exports { "日本語の文": ["English", "한국어"], ... } for the texts only this tool has.
 * Texts that a donor tool's lang.en.v1.js / lang.ko.v1.js already translate are taken from there,
 * so the same sentence reads the same in every tool. Writes <folder>/lang.en.v1.js and lang.ko.v1.js
 * in the order i18n-check.js finds the keys, then the entries of <new.js> that only exist at run time.
 * Run i18n-check.js afterwards: it lists what is still missing.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const [dir, name, newFile, ...donors] = process.argv.slice(2);
if (!dir || !name || !newFile) { console.error("usage: node i18n-compose.js <folder> <English name> <new.js> [donor folders]"); process.exit(2); }
const norm = text => String(text).replace(/\s+/g, " ").trim();
const LANGS = ["en", "ko"];

const keys = execFileSync(process.execPath, [path.join(__dirname, "i18n-check.js"), dir, "--keys"], { encoding: "utf8", maxBuffer: 1 << 26 })
  .trim().split("\n").filter(Boolean).map(line => JSON.parse(line));

const fresh = require(path.resolve(newFile));
const freshByNorm = new Map(Object.entries(fresh).map(([k, v]) => [norm(k), { key: k, values: v }]));

const donated = { en: new Map(), ko: new Map() };
for (const donor of donors) {
  for (const lang of LANGS) {
    const file = path.join(donor, `lang.${lang}.v1.js`);
    if (!fs.existsSync(file)) continue;
    new Function("I18n", fs.readFileSync(file, "utf8"))({
      // Keep the donor's own spelling of the key (leading spaces of CSS comments, line breaks).
      add: (code, entries) => { for (const [k, v] of Object.entries(entries)) if (!donated[lang].has(norm(k))) donated[lang].set(norm(k), { key: k, value: v }); },
    });
  }
}

const missing = [];
for (const [i, lang] of LANGS.entries()) {
  const lines = [];
  const seen = new Set();
  const put = (key, value) => { lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)},`); seen.add(norm(key)); };
  for (const k of keys) {
    if (freshByNorm.has(k)) put(freshByNorm.get(k).key, freshByNorm.get(k).values[i]);
    else if (donated[lang].has(k)) put(donated[lang].get(k).key, donated[lang].get(k).value);
    else if (lang === "en") missing.push(k);
  }
  const extra = [...freshByNorm].filter(([k]) => !seen.has(k));
  if (extra.length) {
    lines.push("", "  // ---- texts that only exist at run time");
    for (const [, e] of extra) put(e.key, e.values[i]);
  }
  const feedback = "訳の誤りを知らせる";
  if (!seen.has(feedback) && donated[lang].has(feedback)) {
    lines.push("", "  // ---- i18n.v1.js");
    put(feedback, donated[lang].get(feedback).value);
  }
  const head = `/*!\n * lang.${lang}.v1.js - ${lang === "en" ? "English" : "Korean"} for ${name}.\n`
    + " * Keys are the Japanese texts of the page and scripts (see i18n.v1.js).\n"
    + " * CCFOLIA terms follow CCFOLIA's own " + (lang === "en" ? "English" : "Korean") + " UI; OBS terms follow OBS's.\n */\n";
  fs.writeFileSync(path.join(dir, `lang.${lang}.v1.js`), `${head}I18n.add("${lang}", {\n${lines.join("\n")}\n});\n`);
  console.log(`${lang}: ${seen.size} entries`);
}
if (missing.length) { console.log("no translation yet:"); for (const k of missing) console.log("  " + JSON.stringify(k)); }
