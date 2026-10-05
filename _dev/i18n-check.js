#!/usr/bin/env node
/*
 * i18n-check.js - list the Japanese texts of a page and compare them with its dictionaries.
 *
 *   node _dev/i18n-check.js <folder> [--keys]
 *
 * Reads <folder>/index.html, every *.js in <folder> except i18n.v1.js and lang.*.js, and the
 * dictionaries <folder>/lang.<code>.v1.js. Prints, for each language, the keys the page has
 * but the dictionary lacks (MISSING) and the dictionary keys nothing uses (UNUSED).
 * --keys prints every key instead, one JSON string per line (a start for a new dictionary).
 *
 * The rules mirror i18n.v1.js: text nodes and the attributes placeholder / title / aria-label /
 * alt / label that contain Japanese; elements with data-i18n as a whole (innerHTML);
 * script, style, textarea, code and pre are skipped. In scripts, every string literal with
 * Japanese is a key (outside comments; a template only when it has no ${...}), and so is the
 * part before "：" (preset labels).
 * Texts that are only built at run time are not seen here: check those in the browser
 * with I18n.missing.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const dir = process.argv[2];
if (!dir) { console.error("usage: node i18n-check.js <folder> [--keys]"); process.exit(2); }
const showKeys = process.argv.includes("--keys");

const norm = text => String(text).replace(/\s+/g, " ").trim();
const JP = /[、-ヿ㐀-鿿！-；＝？-｠]/;   // as in i18n.v1.js
const ATTRS = ["placeholder", "title", "aria-label", "alt", "label"];
const SKIP = new Set(["script", "style", "textarea", "code", "pre"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const decode = s => s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

const keys = new Map();   // key -> where it was found
const found = (text, where) => { const k = norm(text); if (k && JP.test(k) && !keys.has(k)) keys.set(k, where); };

// ---- HTML: a small tokenizer, enough for hand-written pages.
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const title = /<title>([\s\S]*?)<\/title>/.exec(html);
if (title) found(decode(title[1]), "title");
const body = html.slice(html.search(/<body[\s>]/));
const tagRe = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w-]*)((?:\s+[^\s=>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;
const stack = [];          // open tags: { name, i18n, start }
let last = 0, m;
const inside = name => stack.some(s => s.name === name);
const skipping = () => stack.some(s => SKIP.has(s.name) || s.i18n);
while ((m = tagRe.exec(body))) {
  const text = body.slice(last, m.index);
  if (!skipping() && JP.test(text)) found(decode(text), "html");
  last = tagRe.lastIndex;
  if (m[0].startsWith("<!--")) continue;
  const name = (m[1] || "").toLowerCase(), attrs = m[2] || "";
  if (m[0].startsWith("</")) {
    // Close back to the matching tag.
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].name !== name) continue;
      const open = stack[i];
      if (open.i18n && !stack.slice(0, i).some(s => s.i18n)) found(body.slice(open.start, m.index), "data-i18n");
      stack.length = i;
      break;
    }
    continue;
  }
  if (!inside("script") && !inside("style")) {
    for (const a of ATTRS) {
      const v = new RegExp("\\s" + a + '\\s*=\\s*"([^"]*)"').exec(attrs);
      if (v && JP.test(v[1])) found(decode(v[1]), a);
    }
  }
  if (!VOID.has(name) && !m[0].endsWith("/>")) {
    stack.push({ name, i18n: /\sdata-i18n(\s|=|$)/.test(attrs), start: tagRe.lastIndex });
  }
}

// ---- scripts

/**
 * The string literals of a script, in order: { value, template } where template is true for a
 * `...` literal without ${...}. A small lexer keeps strings, templates (with nested ${...} code),
 * regex literals and comments apart, so a "/* ====" string or a /"/ regex does not confuse it.
 * A "/" starts a regex when the last code token cannot end an expression.
 */
function stringLiterals(src) {
  const out = [];
  let i = 0, last = "";                   // last: the last significant character of code
  const stack = [];                       // brace depth of each open ${ ... }
  const readQuoted = q => {
    let value = "";
    for (i++; i < src.length && src[i] !== q; i++) {
      if (src[i] === "\\") { value += src[i] + src[i + 1]; i++; } else value += src[i];
    }
    i++;
    return value;
  };
  // Reads template text up to "`" (end) or "${" (code inside); returns true when the template ended.
  let templateText = "", templateHasCode = false;
  const readTemplate = () => {
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "\\") { templateText += c + src[i + 1]; i++; continue; }
      if (c === "`") { i++; return true; }
      if (c === "$" && src[i + 1] === "{") { i += 2; templateHasCode = true; return false; }
      templateText += c;
    }
    return true;
  };
  const templates = [];                   // open templates around the current ${ } code
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === "/" && d === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === '"' || c === "'") {
      const raw = readQuoted(c);
      let value;
      try { value = JSON.parse('"' + raw.replace(/\'/g, "'") + '"'); } catch (err) { value = raw; }
      out.push({ value, template: false });
      last = c;
      continue;
    }
    if (c === "`") {
      i++;
      templateText = ""; templateHasCode = false;
      if (readTemplate()) { out.push({ value: templateText, template: !templateHasCode }); last = "`"; }
      else { templates.push({ text: templateText }); stack.push(0); last = "{"; }
      continue;
    }
    if (c === "/" && !/[\w$)\]"'`]/.test(last)) {
      // Regex literal: up to the closing "/" outside a [...] class, then its flags.
      let inClass = false;
      for (i++; i < src.length; i++) {
        const r = src[i];
        if (r === "\\") { i++; continue; }
        if (r === "[") inClass = true;
        else if (r === "]") inClass = false;
        else if (r === "/" && !inClass) break;
      }
      i++;
      while (/[a-z]/i.test(src[i] || "")) i++;
      last = ")";
      continue;
    }
    if (stack.length) {
      if (c === "{") stack[stack.length - 1]++;
      else if (c === "}") {
        if (stack[stack.length - 1] === 0) {
          // Back into the template text.
          stack.pop();
          const t = templates.pop();
          i++;
          templateText = t.text; templateHasCode = true;
          if (readTemplate()) { out.push({ value: templateText, template: false }); last = "`"; }
          else { templates.push({ text: templateText }); stack.push(0); last = "{"; }
          continue;
        }
        stack[stack.length - 1]--;
      }
    }
    last = c;
    i++;
  }
  return out;
}

const scripts = fs.readdirSync(dir).filter(f => f.endsWith(".js") && f !== "i18n.v1.js" && !/^lang\./.test(f));
for (const file of scripts) {
  for (const { value, template } of stringLiterals(fs.readFileSync(path.join(dir, file), "utf8"))) {
    // A template with ${...} only builds markup around texts, which are literals of their own.
    if (!JP.test(value) || (value.includes("${") && !template)) continue;
    found(value, file);
    // "label：description" (scene presets): the label alone is a key too. One colon, no quote before it.
    if (/^[^：「」]+：[^：]+$/.test(value)) found(value.split("：")[0], file);
  }
}

if (showKeys) {
  for (const k of keys.keys()) console.log(JSON.stringify(k));
  process.exit(0);
}

// ---- dictionaries: run them with a stand-in I18n.add
let problems = 0;
for (const file of fs.readdirSync(dir).filter(f => /^lang\.[a-z]+\.v\d+\.js$/.test(f))) {
  const code = file.split(".")[1];
  const dict = new Map();
  new Function("I18n", fs.readFileSync(path.join(dir, file), "utf8"))({
    add: (c, entries) => { for (const [k, v] of Object.entries(entries)) dict.set(norm(k), v); },
  });
  const missing = [...keys.keys()].filter(k => !dict.has(k));
  const unused = [...dict.keys()].filter(k => !keys.has(k));
  // Kana and kanji only: full-width signs such as the dice bot's "＞" belong in every language.
  const leftover = [...dict].filter(([, v]) => /[぀-ヿ㐀-鿿]/.test(v.replace(/<[^>]*>/g, ""))).map(([k]) => k);
  console.log(`== ${code}: ${keys.size} keys, ${dict.size} entries, ${missing.length} missing, ${unused.length} unused`);
  for (const k of missing) console.log("  MISSING " + JSON.stringify(k) + "  (" + keys.get(k) + ")");
  for (const k of unused) console.log("  UNUSED  " + JSON.stringify(k));
  for (const k of leftover) console.log("  JAPANESE LEFT IN " + JSON.stringify(k));
  problems += missing.length;
}
process.exit(problems ? 1 : 0);
