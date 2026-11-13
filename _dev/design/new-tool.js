#!/usr/bin/env node
/*
 * new-tool.js - start a new tool with the shared look from the first line.
 *
 *   node _dev/design/new-tool.js <new folder> "<ツールの名前>" "<English name>" ["<한국어 이름>"]
 *
 * Writes into <new folder> (which must not exist yet):
 *   index.html      the page skeleton from template/, with tool.css in its <style>
 *   app.v1.js       tabs, slider values, preview background, status line
 *   lang.en.v1.js / lang.ko.v1.js   the template's texts, already translated
 *   i18n.v1.js, theme.v1.js         the shared files, copied from the root of this repository
 *   favicon.svg     copied from this repository as a placeholder: draw the tool's own
 * The key for the remembered tab is the folder's name. Add LICENSE and README.md yourself.
 * Afterwards: write the tool, keep the class names of the skeleton, put rules for this tool only after the
 * shared block of the <style>, and run the checks in check/ (see README.md in this folder).
 */
"use strict";
const fs = require("fs");
const path = require("path");

const [dir, name, nameEn, nameKo] = process.argv.slice(2);
if (!dir || !name || !nameEn) { console.error('usage: node new-tool.js <new folder> "<ツールの名前>" "<English name>" ["<한국어 이름>"]'); process.exit(2); }
const HERE = __dirname, HUB = path.resolve(HERE, "../.."), out = path.resolve(dir);
if (fs.existsSync(out)) { console.error(out + " already exists"); process.exit(1); }
fs.mkdirSync(out, { recursive: true });

const values = { NAME: name, NAME_EN: nameEn, NAME_KO: nameKo || nameEn, SLUG: path.basename(out), DATE: new Date().toISOString().slice(0, 10) };
// JSON.stringify-ed places (the dictionaries) need the quotes escaped; the names are plain text elsewhere.
const fill = (text, json) => text.replace(/\{\{(\w+)\}\}/g, (all, key) => (key in values ? (json ? JSON.stringify(values[key]).slice(1, -1) : values[key]) : all));

for (const f of fs.readdirSync(path.join(HERE, "template"))) {
  let text = fs.readFileSync(path.join(HERE, "template", f), "utf8");
  if (f === "index.html") {
    const a = text.indexOf("<style>"), b = text.indexOf("</style>");
    text = text.slice(0, a) + "<style>\n" + fs.readFileSync(path.join(HERE, "tool.css"), "utf8").replace(/\s+$/, "") + "\n</style>" + text.slice(b + 8);
    text = fill(text, false).replace(/&(?!amp;|lt;|gt;|quot;|#)/g, "&amp;");
  } else text = fill(text, f.startsWith("lang."));
  fs.writeFileSync(path.join(out, f), text);
}
for (const f of ["i18n.v1.js", "theme.v1.js", "favicon.svg"]) fs.copyFileSync(path.join(HUB, f), path.join(out, f));
console.log(`${values.SLUG}: created in ${out}\n  next: open index.html through a local server, then see _dev/design/README.md`);
