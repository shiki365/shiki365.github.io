#!/usr/bin/env node
/*
 * ccf-terms.js - look up CCFOLIA's own translations of Japanese UI terms.
 *
 *   node _dev/ccf-terms.js <main.*.js> シナリオテキスト 前景 ルームデータのインポート ...
 *
 * CCFOLIA's bundle carries its English / Korean / Traditional Chinese UI as dictionaries keyed by
 * the Japanese text (beta in 1.37.4), so the same key appears once per language. Download the
 * current bundle first (the file name changes with every release):
 *
 *   curl -s https://ccfolia.com/ | grep -o 'static/js/main\.[a-z0-9]*\.js'
 *   curl -s https://ccfolia.com/static/js/main.<hash>.js -o ccf-main.js
 *
 * Prints "term => en | | ko | zh-TW" in the order found; an empty result means CCFOLIA has no
 * translation for that exact text (try a longer or shorter phrase).
 */
"use strict";
const fs = require("fs");

const [bundle, ...terms] = process.argv.slice(2);
if (!bundle || !terms.length) { console.error("usage: node ccf-terms.js <main.*.js> <term> ..."); process.exit(2); }
const src = fs.readFileSync(bundle, "utf8");
// Keys appear either as plain UTF-8 or as \uXXXX escapes.
const escaped = s => [...s].map(c => (c.charCodeAt(0) > 127 ? "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0") : c)).join("");

for (const term of terms) {
  const values = [];
  for (const key of [JSON.stringify(term), '"' + escaped(term) + '"']) {
    for (let i = src.indexOf(key + ":"); i >= 0; i = src.indexOf(key + ":", i + key.length)) {
      const m = /^"((?:[^"\\]|\\.)*)"/.exec(src.slice(i + key.length + 1, i + key.length + 400));
      if (m) values.push(JSON.parse('"' + m[1] + '"'));
    }
  }
  console.log(term, "=>", [...new Set(values)].join(" | "));
}
