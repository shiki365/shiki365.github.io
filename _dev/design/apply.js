#!/usr/bin/env node
/*
 * apply.js - put the shared look (tool.css) into a tool's page.
 *
 *   node _dev/design/apply.js <tool folder> [--extra <file.css>] [--version v1.2] [--date 2026-11-13]
 *
 * <tool folder> is the folder with the tool's index.html (for the scene transition maker: its docs/).
 *
 * What it does, every time:
 *   - replaces the first <style> block of index.html with tool.css, followed by the tool's own rules.
 *     Those come from --extra, or from tool-only/<repository name>.css when that file exists.
 * Only when the page has no theme switch yet (first time):
 *   - copies theme.v1.js from the root of this repository and loads it after the dictionaries
 *   - wraps the language links in <div class="prefs"> and adds <p class="theme-switch" data-theme-switch>
 *   - adds the five words of the switch to lang.en.v1.js / lang.ko.v1.js and raises their ?v= number
 * With --version (and --date, default today): rewrites "<span>vX.Y</span> ・ <span>最終更新</span> DATE" in the footer.
 *
 * It never touches other markup or any script of the tool. Check the result with the scripts in check/.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const dir = args[0];
if (!dir || dir.startsWith("--")) { console.error("usage: node apply.js <tool folder> [--extra file.css] [--version v1.2] [--date YYYY-MM-DD]"); process.exit(2); }
const opt = name => { const i = args.indexOf("--" + name); return i < 0 ? null : args[i + 1]; };

const HERE = __dirname, HUB = path.resolve(HERE, "../..");
const abs = path.resolve(dir);
const repoName = path.basename(abs) === "docs" ? path.basename(path.dirname(abs)) : path.basename(abs);
const extraFile = opt("extra") || [path.join(HERE, "tool-only", repoName + ".css")].find(f => fs.existsSync(f));

const THEME_WORDS = {
  en: { "画面の明るさ": "Appearance", "自動": "Auto", "ダーク": "Dark", "ライト": "Light", "パソコンやスマホの設定に合わせる": "Follow your device's setting" },
  ko: { "画面の明るさ": "화면 모드", "自動": "자동", "ダーク": "다크", "ライト": "라이트", "パソコンやスマホの設定に合わせる": "기기 설정에 맞춤" },
};

function must(text, needle, what) { if (!text.includes(needle)) throw new Error(`${what} not found in ${dir}`); }

// ---- the <style> block
const file = path.join(abs, "index.html");
let html = fs.readFileSync(file, "utf8");
const a = html.indexOf("<style>"), b = html.indexOf("</style>");
if (a < 0 || b < 0) throw new Error("no <style> block in " + file);
let css = fs.readFileSync(path.join(HERE, "tool.css"), "utf8").replace(/\s+$/, "");
if (extraFile) css += "\n\n" + fs.readFileSync(extraFile, "utf8").replace(/^\n+|\s+$/g, "");
html = html.slice(0, a) + "<style>\n" + css + "\n</style>" + html.slice(b + 8);

// ---- the theme switch, when the page does not have it yet
const firstTime = !html.includes("data-theme-switch");
if (firstTime) {
  must(html, '<script src="lang.ko.v1.js', "the Korean dictionary's <script>");
  html = html.replace(/<script src="lang\.(en|ko)\.v1\.js(?:\?v=(\d+))?"><\/script>/g,
    (all, code, v) => `<script src="lang.${code}.v1.js?v=${(+v || 1) + 1}"></script>`);
  html = html.replace(/(<script src="lang\.ko\.v1\.js[^"]*"><\/script>)/, `$1\n<script src="theme.v1.js"></script>`);
  const langSwitch = /^([ \t]*)<p class="lang-switch" data-lang-switch><\/p>/m;
  if (!langSwitch.test(html)) throw new Error("the language links (<p class=\"lang-switch\" data-lang-switch>) were not found");
  html = html.replace(langSwitch, (all, indent) =>
    `${indent}<div class="prefs">\n${indent}  <p class="lang-switch" data-lang-switch></p>\n${indent}  <p class="theme-switch" data-theme-switch></p>\n${indent}</div>`);
  fs.copyFileSync(path.join(HUB, "theme.v1.js"), path.join(abs, "theme.v1.js"));
  for (const code of ["en", "ko"]) {
    const f = path.join(abs, `lang.${code}.v1.js`);
    let s = fs.readFileSync(f, "utf8");
    if (s.includes("// ---- theme.v1.js")) continue;
    const end = s.trimEnd().lastIndexOf("});");
    if (end < 0) throw new Error("unexpected end of " + f);
    const lines = Object.entries(THEME_WORDS[code]).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},\n`).join("");
    fs.writeFileSync(f, s.slice(0, end).trimEnd() + "\n\n  // ---- theme.v1.js\n" + lines + "});\n");
  }
}

// ---- version and date in the footer
const version = opt("version");
if (version) {
  const date = opt("date") || new Date().toISOString().slice(0, 10);
  const re = /(<span[^>]*>)v[\d.]+(<\/span> ・ <span>最終更新<\/span> )\d{4}-\d{2}-\d{2}/;
  if (!re.test(html)) throw new Error("the version line of the footer was not found");
  html = html.replace(re, (all, open, mid) => `${open}${version}${mid}${date}`);
}

fs.writeFileSync(file, html);

// ---- report
const same = name => fs.existsSync(path.join(abs, name)) && fs.readFileSync(path.join(abs, name)).equals(fs.readFileSync(path.join(HUB, name)));
console.log(`${repoName}: style replaced (${extraFile ? "with tool-only rules from " + path.basename(extraFile) : "no tool-only rules"})`
  + (firstTime ? ", theme switch added" : "") + (version ? `, version ${version}` : ""));
for (const name of ["theme.v1.js", "i18n.v1.js"]) if (!same(name)) console.log(`  note: ${name} differs from the one in the hub repository (or is missing)`);
