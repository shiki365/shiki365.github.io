#!/usr/bin/env node
/*
 * watch.js - check that CCFOLIA's bundle still has what the tools rely on; report changes as issues.
 *
 *   node _dev/ccf-watch/watch.js [--state <file>] [--items <file>] [--html <file>] [--js <file>] [--dry-run]
 *
 * Fetches https://ccfolia.com/ and the main.*.js it loads, the same way as _dev/ccf-terms.js
 * (two plain GETs, no login, no API), and looks for every item of items.json in it. The result is
 * compared with the record of the last run (--state, a JSON file the workflow keeps in the Actions
 * cache), and an issue is opened, or commented on when one of the same kind is open, when
 *   missing  an item is not found (newly, or again in a new bundle)
 *   changed  the bundle changed and every item is still found
 *   error    the bundle could not be fetched on ERROR_AFTER runs in a row (then every ERROR_REMIND runs)
 * A missing / error issue that is still open also gets a comment once things are back.
 *
 * --html / --js read local files instead of fetching (--js alone skips the page, so the "html"
 * items are not checked). --dry-run (or DRY_RUN=true) prints the issues instead of posting them and
 * leaves the state file alone. Posting needs GITHUB_TOKEN and GITHUB_REPOSITORY (set in Actions).
 * The job summary goes to $GITHUB_STEP_SUMMARY when set, and always to stdout.
 *
 * Exit code: 0 also when CCFOLIA could not be fetched (that is reported through the state and the
 * error issue); 1 when items.json is broken or GitHub refused a post (the state is then not written,
 * so the next run tries again).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { parseArgs } = require("util");

const UA = "shiki365-ccf-watch (+https://github.com/shiki365/shiki365.github.io/tree/main/_dev/ccf-watch)";
const HOME = process.env.GITHUB_REPOSITORY || "shiki365/shiki365.github.io";
const README = `https://github.com/${HOME}/blob/main/_dev/ccf-watch/README.md`;
const ERROR_AFTER = 2;     // failed runs in a row before the error issue
const ERROR_REMIND = 7;    // then a comment every N failed runs
const MARK = kind => `<!-- ccf-watch:${kind} -->`;
const TITLES = {
  missing: "[ccf-watch] ツールが頼っているココフォリアの部分が見つからない",
  changed: "[ccf-watch] ココフォリアの本体 JS が変わった",
  error: "[ccf-watch] ココフォリアの本体 JS を取ってこられない",
};

// ---------------------------------------------------------------- items

function loadConfig(file) {
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  cfg.manual = cfg.manual || [];
  const problems = [], ids = new Set();
  const regexOk = (where, source, flags) => {
    try { new RegExp(source, flags); } catch (err) { problems.push(`${where}: ${err.message}`); }
  };
  regexOk("bundle", cfg.bundle);
  (cfg.version || []).forEach((v, i) => regexOk(`version[${i}]`, v));
  for (const item of [...cfg.items, ...cfg.manual]) {
    if (!item.id || ids.has(item.id)) problems.push(`empty or duplicate id: ${item.id}`);
    ids.add(item.id);
    if (!item.uses || !Object.keys(item.uses).length) problems.push(`${item.id}: no uses`);
    for (const tool of Object.keys(item.uses || {})) if (!cfg.tools[tool]) problems.push(`${item.id}: unknown tool ${tool}`);
  }
  for (const item of cfg.items) {
    const kinds = ["text", "regex", "near"].filter(k => item[k] != null);
    if (kinds.length !== 1) problems.push(`${item.id}: needs exactly one of text / regex / near`);
    if (item.regex != null) regexOk(item.id, item.regex, item.flags || "");
    if (item.near != null && !(Array.isArray(item.near) && item.near.length >= 2 && item.within > 0)) {
      problems.push(`${item.id}: near needs two or more strings and within > 0`);
    }
    if (item.in != null && item.in !== "js" && item.in !== "html") problems.push(`${item.id}: in must be "js" or "html"`);
  }
  if (problems.length) throw new Error(`${file}: ${problems.join("; ")}`);
  return cfg;
}

// Non-ASCII text may be stored as \uXXXX escapes in the bundle (as in ccf-terms.js).
const escaped = s => s.replace(/[^\x00-\x7f]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

function positions(src, s) {
  const out = [];
  for (const f of new Set([s, escaped(s)])) {
    for (let i = src.indexOf(f); i >= 0; i = src.indexOf(f, i + f.length)) out.push(i);
  }
  return out;
}

// How many times the item is found in src (0: missing).
function count(item, src) {
  if (item.text != null) return positions(src, item.text).length;
  if (item.regex != null) return [...src.matchAll(new RegExp(item.regex, (item.flags || "").replace("g", "") + "g"))].length;
  // near: places where the first string has every other one within `within` characters.
  const [first, ...rest] = item.near.map(s => positions(src, s));
  return first.filter(p => rest.every(list => list.some(q => Math.abs(q - p) <= item.within))).length;
}

// ---------------------------------------------------------------- fetching

async function fetchText(url) {
  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(60000) });
  } catch (err) {
    // Node's fetch only says "fetch failed"; the reason is in cause.
    throw new Error(`${(err.cause && (err.cause.code || err.cause.message)) || err.message}: ${url}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

const findBundle = (html, cfg) => {
  const m = new RegExp(cfg.bundle).exec(html);
  return m ? new URL(m[0], cfg.site).href : null;
};

function readVersion(js, cfg) {
  for (const source of cfg.version || []) {
    const m = new RegExp(source).exec(js);
    if (m) return m[1];
  }
  return null;
}

// -> { html (null with --js alone), js, file }
async function snapshot(cfg, opts) {
  const read = f => fs.readFileSync(f, "utf8");
  const get = opts.get || fetchText;
  if (opts.js && !opts.html) return { html: null, js: read(opts.js), file: path.basename(opts.js) };
  const html = opts.html ? read(opts.html) : await get(cfg.site);
  const url = findBundle(html, cfg);
  if (!url) throw new Error(`${cfg.site} の HTML に main.*.js が見つからない`);
  const js = opts.js ? read(opts.js) : await get(url);
  return { html, js, file: path.posix.basename(new URL(url).pathname) };
}

function inspect(cfg, snap, prev) {
  const items = {}, checked = new Set();
  for (const item of cfg.items) {
    const src = item.in === "html" ? snap.html : snap.js;
    if (src == null) {
      // Not checked this time (--js alone): keep the last record.
      items[item.id] = (prev && prev.items && prev.items[item.id]) || null;
      continue;
    }
    const n = count(item, src);
    items[item.id] = { found: n > 0, count: n };
    checked.add(item.id);
  }
  const bundle = {
    file: snap.file, size: Buffer.byteLength(snap.js),
    sha256: crypto.createHash("sha256").update(snap.js).digest("hex"), version: readVersion(snap.js, cfg),
  };
  return { bundle, items, checked };
}

// ---------------------------------------------------------------- deciding

function compare(cfg, prev, cur) {
  const before = (prev && prev.items) || {};
  const rows = cfg.items.filter(item => cur.checked.has(item.id))
    .map(item => ({ item, now: cur.items[item.id], before: before[item.id] || null }));
  const missing = rows.filter(r => !r.now.found);
  const prevMissing = rows.filter(r => r.before && !r.before.found);
  const pb = prev && prev.bundle;
  const key = list => list.map(r => r.item.id).sort().join(" ");
  return {
    rows, missing, prevMissing,
    recovered: rows.filter(r => r.now.found && r.before && !r.before.found),
    counts: rows.filter(r => r.now.found && r.before && r.before.found && r.now.count !== r.before.count),
    jsChanged: !!pb && (pb.file !== cur.bundle.file || pb.sha256 !== cur.bundle.sha256),
    missingChanged: key(missing) !== key(prevMissing),
  };
}

// -> [{ kind, type }]; type "report" opens or comments, the others only comment on an open issue.
function plan(d, prev) {
  const actions = [];
  if (prev && prev.failures >= ERROR_AFTER) actions.push({ kind: "error", type: "back" });
  if (d.missing.length && (d.missingChanged || d.jsChanged)) actions.push({ kind: "missing", type: "report" });
  if (!d.missing.length && d.jsChanged) actions.push({ kind: "changed", type: "report" });
  if (!d.missing.length && d.prevMissing.length) actions.push({ kind: "missing", type: "resolved" });
  return actions;
}

const remind = failures => failures >= ERROR_AFTER && (failures - ERROR_AFTER) % ERROR_REMIND === 0;

// ---------------------------------------------------------------- messages

function jst(date) {
  const t = new Date(date.getTime() + 9 * 3600e3).toISOString();
  return `${t.slice(0, 10)} ${t.slice(11, 16)}`;
}

const code = s => "`" + s + "`";
const bundleName = b => `${code(b.file)}（${b.version ? "版 " + b.version : "版は読み取れず"}）`;

function bundleLine(ctx) {
  const b = ctx.cur.bundle, pb = ctx.prev && ctx.prev.bundle;
  if (!pb) return `- 本体 JS: ${bundleName(b)}。前回の記録なし`;
  if (!ctx.diff.jsChanged) return `- 本体 JS: ${bundleName(b)}。前回と同じ`;
  return `- 本体 JS: ${bundleName(b)}。前回は ${bundleName(pb)}${pb.file === b.file ? "（名前は同じで中身が変わった）" : ""}`;
}

function headLines(ctx) {
  const d = ctx.diff;
  return [
    `- 調べた日時: ${jst(ctx.now)}（日本時間）`,
    bundleLine(ctx),
    `- 見つかった項目: ${d.rows.length - d.missing.length} / ${d.rows.length}`,
  ].join("\n");
}

function usesText(cfg, item) {
  return Object.entries(item.uses).map(([id, files]) => {
    const tool = cfg.tools[id];
    const links = files.map(f => `[${f}](https://github.com/${tool.repo}/blob/main/${f})`).join("、");
    return `${tool.name}（${links}）`;
  }).join("、");
}

function howText(item) {
  const where = item.in === "html" ? "（トップの HTML）" : "";
  if (item.text != null) return `文字列 ${code(item.text)}${where}`;
  if (item.regex != null) return `正規表現 ${code(item.regex)}${item.flags ? `（${item.flags}）` : ""}${where}`;
  return `${item.within} 文字以内に並ぶ文字列 ${item.near.map(code).join(" ")}${where}`;
}

function itemBlock(cfg, row) {
  const { item, before } = row;
  const was = !before ? "記録なし（初回か、足したばかりの項目）" : before.found ? "前回はあった" : "前回から見つからない";
  return [
    `- **${code(item.id)}** ${item.what} — ${was}`,
    `  - ツール: ${usesText(cfg, item)}`,
    item.selectors && item.selectors.length ? `  - セレクタ: ${item.selectors.map(code).join(" ")}` : null,
    `  - 探したもの: ${howText(item)}`,
  ].filter(Boolean).join("\n");
}

function toolChecks(cfg, toolIds, withManual) {
  return toolIds.map(id => {
    const tool = cfg.tools[id];
    const lines = [`- [ ] **${tool.name}** — ${tool.check}`];
    if (withManual) {
      for (const m of cfg.manual.filter(m => m.uses[id])) lines.push(`  - 文字列では見張れない前提: ${m.what}`);
    }
    return lines.join("\n");
  }).join("\n");
}

const footer = ctx => `詳しくは [_dev/ccf-watch/README.md](${README})` + (ctx.runUrl ? `\n\n---\n[この実行のログ](${ctx.runUrl})` : "");

function missingBody(ctx) {
  const { cfg, diff } = ctx;
  const tools = Object.keys(cfg.tools).filter(id => diff.missing.some(r => r.item.uses[id]));
  return [
    MARK("missing"),
    "ココフォリアの本体 JS（main.*.js）に、ツールが頼っている部分が見つからなかった。ココフォリアの更新で画面の作りが変わり、書き出す CSS やルームデータが効かなくなっているかもしれない。",
    headLines(ctx),
    "### 見つからない項目",
    diff.missing.map(r => itemBlock(cfg, r)).join("\n"),
    diff.recovered.length ? "### また見つかった項目\n\n" + diff.recovered.map(r => `- ${code(r.item.id)} ${r.item.what}`).join("\n") : null,
    "### まず見ること",
    [
      "1. 「前回はあった」項目は、ココフォリアの更新で変わった見込みが高い。下のツールを OBS で開いて、崩れていないか見る",
      "2. 崩れていなければ、探す文字列のほうが古い。本体 JS を落として `_dev/ccf-watch/items.json` を直す（README の「項目を直す・足す」）",
      "3. 「記録なし」「前回から見つからない」だけなら、探す文字列が最初から合っていないことが多い。2 と同じく items.json を直す",
    ].join("\n"),
    "OBS で見るツール:\n\n" + toolChecks(cfg, tools, false),
    "全部見つかるようになると、この Issue にそう書き込む。閉じるのは手で。",
    footer(ctx),
  ].filter(Boolean).join("\n\n");
}

function changedBody(ctx) {
  const { cfg, diff } = ctx;
  return [
    MARK("changed"),
    `ココフォリアの本体 JS が変わった。文字列で見張っている ${diff.rows.length} 項目は、全部見つかった。`
      + "ただ、画面の並び（nth-child など）やダイスの色のクラスのように、文字列では見張れない前提もある。時間のあるときに、下のツールを OBS で確かめる。",
    headLines(ctx),
    "### 確かめること",
    toolChecks(cfg, Object.keys(cfg.tools), true),
    diff.counts.length
      ? "<details><summary>見つかった数が変わった項目（参考）</summary>\n\n"
        + diff.counts.map(r => `- ${code(r.item.id)}: ${r.before.count} → ${r.now.count}`).join("\n") + "\n\n</details>"
      : null,
    "問題がなければ、この Issue は閉じてよい。開いているあいだに本体 JS がまた変わると、ここに書き足す。",
    footer(ctx),
  ].filter(Boolean).join("\n\n");
}

function errorBody(ctx) {
  const pb = ctx.prev && ctx.prev.bundle;
  return [
    MARK("error"),
    `ココフォリアの本体 JS を、${ctx.failures} 回続けて取ってこられなかった。見張りが止まっている。`,
    [
      `- 調べた日時: ${jst(ctx.now)}（日本時間）`,
      `- エラー: ${code(ctx.error.message)}`,
      `- 最後に取れた本体 JS: ${pb ? `${bundleName(pb)}、${jst(new Date(ctx.prev.okAt))}` : "なし"}`,
    ].join("\n"),
    "### まず見ること",
    [
      "1. ブラウザで https://ccfolia.com/ が開けるか。メンテナンス中なら、明ければ次の実行で直る",
      "2. 開けるのに失敗が続くときは、エラーを見る",
      "   - 「main.*.js が見つからない」… トップの HTML の作りが変わった。ブラウザで https://ccfolia.com/ のソースを見て、`items.json` の `bundle` を直す",
      "   - `HTTP 403` など … GitHub Actions からのアクセスが断られている。この見張りは使えない状態なので、止めることも考える",
    ].join("\n"),
    `また取れるようになると、ここに書き込む。失敗が続くあいだは ${ERROR_REMIND} 回ごとに書き込む。`,
    footer(ctx),
  ].join("\n\n");
}

// -> { title, body, comment }
function render(action, ctx) {
  const when = `### ${jst(ctx.now)} の結果`;
  if (action.type === "back") {
    return { comment: `### ${jst(ctx.now)}: また取ってこられた\n\n本体 JS ${bundleName(ctx.cur.bundle)} を取ってこられた。見張りは動いている。この Issue は閉じてよい。\n\n${footer(ctx)}` };
  }
  if (action.type === "resolved") {
    return { comment: `### ${jst(ctx.now)}: 全部見つかった\n\n見張っている ${ctx.diff.rows.length} 項目が、全部また見つかった（本体 JS ${bundleName(ctx.cur.bundle)}）。ツールの表示を確かめたら、この Issue は閉じてよい。\n\n${footer(ctx)}` };
  }
  const body = { missing: missingBody, changed: changedBody, error: errorBody }[action.kind](ctx);
  return { title: TITLES[action.kind], body, comment: `${when}\n\n${body.replace(MARK(action.kind) + "\n\n", "")}` };
}

// ---------------------------------------------------------------- GitHub

function github({ token, repo, api, fetchImpl }) {
  const call = async (method, p, body) => {
    const res = await (fetchImpl || fetch)(`${api || "https://api.github.com"}/repos/${repo}${p}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28", "User-Agent": UA, "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`GitHub ${method} ${p}: HTTP ${res.status} ${await res.text()}`);
    return res.json();
  };
  return {
    async findOpen(kind) {
      for (let page = 1; page <= 10; page++) {
        const list = await call("GET", `/issues?state=open&per_page=100&page=${page}`);
        const hit = list.find(i => !i.pull_request && (i.body || "").includes(MARK(kind)));
        if (hit || list.length < 100) return hit || null;
      }
      return null;
    },
    create: (title, body) => call("POST", "/issues", { title, body }),
    comment: (number, body) => call("POST", `/issues/${number}/comments`, { body }),
  };
}

// -> { how: "created" | "commented" | "skipped", number, url }
async function deliver(gh, message) {
  const open = await gh.findOpen(message.kind);
  if (open) {
    const c = await gh.comment(open.number, message.comment);
    return { how: "commented", number: open.number, url: c.html_url || open.html_url };
  }
  if (message.type !== "report") return { how: "skipped" };
  const issue = await gh.create(message.title, message.body);
  return { how: "created", number: issue.number, url: issue.html_url };
}

// ---------------------------------------------------------------- summary

function summary(ctx, messages, results) {
  const out = ["## ccf-watch", ""];
  if (ctx.error) {
    out.push(`- 調べた日時: ${jst(ctx.now)}（日本時間）`, `- 取ってこられなかった（続けて ${ctx.failures} 回目）: ${code(ctx.error.message)}`);
  } else {
    out.push(headLines(ctx));
  }
  const done = messages.map((m, i) => {
    const r = results[i];
    if (!r) return `- dry run: ${m.kind} の${m.type === "report" ? " Issue（開いていればコメント）" : "コメント（開いている Issue があれば）"}を出すところ`;
    if (r.how === "created") return `- Issue を立てた: [#${r.number}](${r.url})`;
    if (r.how === "commented") return `- [#${r.number}](${r.url}) にコメントした`;
    return `- ${m.kind} の Issue が開いていないので、コメントしなかった`;
  });
  out.push(...(done.length ? done : ["- Issue: 知らせることなし"]), "");
  if (ctx.diff) {
    const cell = s => String(s).replace(/\|/g, "\\|");
    out.push("| | 項目 | 見ているもの | ツール | 数 |", "| --- | --- | --- | --- | ---: |");
    for (const item of ctx.cfg.items) {
      const now = ctx.cur.items[item.id];
      const mark = !ctx.cur.checked.has(item.id) ? "–" : now.found ? "✅" : "❌";
      const tools = Object.keys(item.uses).map(id => ctx.cfg.tools[id].name).join("、");
      out.push(`| ${mark} | ${code(item.id)} | ${cell(item.what)} | ${tools} | ${ctx.cur.checked.has(item.id) ? now.count : "–"} |`);
    }
    out.push("", `<details><summary>文字列では見張れない前提（${ctx.cfg.manual.length} 件）</summary>`, "",
      ...ctx.cfg.manual.map(m => `- ${code(m.id)} ${m.what}`), "", "</details>");
  }
  if (!results.length && messages.length) {
    out.push("", "### dry run: 出すはずだったもの");
    for (const m of messages) {
      out.push("", `<details><summary>${m.kind} / ${m.type}${m.title ? `: ${m.title}` : ""}</summary>`, "",
        "````markdown", m.body || m.comment, "````", "", "</details>");
    }
  }
  return out.join("\n") + "\n";
}

// ---------------------------------------------------------------- run

function readState(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (err) { return null; }
}

/**
 * opts: { items, state, html, js, dryRun, get (url -> text), now, runUrl,
 *         github: { token, repo, api, fetchImpl } }
 * -> { actions, messages, results, state, summary, ctx }. Throws when items.json is broken or a post fails.
 */
async function run(opts) {
  const cfg = loadConfig(opts.items || path.join(__dirname, "items.json"));
  const prev = opts.state ? readState(opts.state) : null;
  const now = opts.now || new Date();
  const ctx = { cfg, prev, now, runUrl: opts.runUrl };
  let snap, actions, state;
  try { snap = await snapshot(cfg, opts); } catch (err) { ctx.error = err; }
  if (snap) {
    ctx.cur = inspect(cfg, snap, prev);
    ctx.diff = compare(cfg, prev, ctx.cur);
    actions = plan(ctx.diff, prev);
    state = { schema: 1, checkedAt: now.toISOString(), okAt: now.toISOString(), bundle: ctx.cur.bundle, items: ctx.cur.items, failures: 0 };
  } else {
    // Keep the last good bundle and items, so the next good run compares with them.
    ctx.failures = ((prev && prev.failures) || 0) + 1;
    actions = remind(ctx.failures) ? [{ kind: "error", type: "report" }] : [];
    state = Object.assign({ schema: 1 }, prev, { checkedAt: now.toISOString(), failures: ctx.failures, lastError: ctx.error.message });
  }
  const messages = actions.map(a => Object.assign({}, a, render(a, ctx)));
  const results = [];
  if (!opts.dryRun && messages.length) {
    const gh = github(opts.github || {});
    for (const m of messages) results.push(await deliver(gh, m));
  }
  if (opts.state && !opts.dryRun) {
    fs.mkdirSync(path.dirname(path.resolve(opts.state)), { recursive: true });
    fs.writeFileSync(opts.state, JSON.stringify(state, null, 2) + "\n");
  }
  return { actions, messages, results, state, ctx, summary: summary(ctx, messages, results) };
}

async function main() {
  const { values: a } = parseArgs({
    options: { state: { type: "string" }, items: { type: "string" }, html: { type: "string" }, js: { type: "string" }, "dry-run": { type: "boolean" } },
  });
  const env = process.env;
  const dryRun = !!a["dry-run"] || env.DRY_RUN === "true";
  if (!dryRun && (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY)) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are needed (or use --dry-run)");
  const out = await run({
    items: a.items, state: a.state, html: a.html, js: a.js, dryRun,
    runUrl: env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : null,
    github: { token: env.GITHUB_TOKEN, repo: env.GITHUB_REPOSITORY, api: env.GITHUB_API_URL },
  });
  process.stdout.write(out.summary);
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, out.summary);
  if (out.ctx.error && env.GITHUB_ACTIONS) console.log(`::warning title=ccf-watch::${out.ctx.error.message}`);
}

if (require.main === module) {
  main().catch(err => { console.error(err.stack || String(err)); process.exit(1); });
}

module.exports = { loadConfig, count, findBundle, readVersion, snapshot, inspect, compare, plan, render, github, deliver, run, MARK, ERROR_AFTER, ERROR_REMIND };
