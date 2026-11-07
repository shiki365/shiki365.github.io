/*
 * watch.test.js - watch.js against the fake page and bundle in fixtures/ (no network).
 *
 *   node --test _dev/ccf-watch/watch.test.js
 *
 * When you add an item to items.json, add a line shaped like the real bundle to fixtures/main.fake.js
 * too: the first test wants every item found there.
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const W = require("./watch.js");

const ITEMS = path.join(__dirname, "items.json");
const HTML = fs.readFileSync(path.join(__dirname, "fixtures", "index.html"), "utf8");
const JS = fs.readFileSync(path.join(__dirname, "fixtures", "main.fake.js"), "utf8");
const SITE = "https://ccfolia.com/";
const JS_URL = "https://ccfolia.com/static/js/main.0a1b2c3d.js";
const DAY = 24 * 3600e3;
const T0 = new Date("2026-10-28T22:17:00Z");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "ccf-watch-"));

// A site serving the given html / js; a missing page is an HTTP error like the real fetch.
function site(html, js, jsUrl) {
  return async url => {
    if (url === SITE && html != null) return html;
    if (url === (jsUrl || JS_URL) && js != null) return js;
    throw new Error(`HTTP 503: ${url}`);
  };
}

// The GitHub REST API, as much as watch.js uses.
function fakeGitHub(open) {
  const issues = (open || []).slice(), calls = [];
  const reply = data => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });
  const fetchImpl = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method: init.method, url, body });
    if (init.method === "GET") return reply(issues);
    const m = /\/issues\/(\d+)\/comments$/.exec(url);
    if (m) return reply({ html_url: `https://github.com/x/y/issues/${m[1]}#issuecomment-1` });
    const issue = { number: 100 + issues.length, html_url: `https://github.com/x/y/issues/${100 + issues.length}`, title: body.title, body: body.body };
    issues.push(issue);
    return reply(issue);
  };
  return { issues, calls, github: { token: "t", repo: "x/y", api: "https://api.example", fetchImpl } };
}

const posts = gh => gh.calls.filter(c => c.method === "POST");

// One run against the fake site; returns watch.js's result.
const once = (state, get, extra) => W.run(Object.assign({ items: ITEMS, state, get, now: T0, runUrl: "https://example/run/1" }, extra));

// items.json with one more item, written to a temp file.
function itemsWith(extra) {
  const cfg = JSON.parse(fs.readFileSync(ITEMS, "utf8"));
  cfg.items.push(extra);
  const file = path.join(tmp(), "items.json");
  fs.writeFileSync(file, JSON.stringify(cfg));
  return file;
}

test("every item of items.json is found in the fake bundle", async () => {
  const gh = fakeGitHub();
  const out = await once(null, site(HTML, JS), { github: gh.github });
  const missing = out.ctx.diff.missing.map(r => r.item.id);
  assert.deepStrictEqual(missing, []);
  assert.strictEqual(out.ctx.cur.bundle.file, "main.0a1b2c3d.js");
  assert.strictEqual(out.ctx.cur.bundle.version, "1.37.4");
  assert.deepStrictEqual(out.actions, []);
  assert.strictEqual(gh.calls.length, 0);
});

test("items.json mistakes are refused", () => {
  const bad = itemsWith({ id: "x.bad", what: "x", uses: { "no-such-tool": ["a.js"] }, regex: "(" });
  assert.throws(() => W.loadConfig(bad), /unknown tool no-such-tool.*x\.bad: Invalid regular expression/);
});

test("a string that does not exist: the missing issue is written", async () => {
  const items = itemsWith({
    id: "test.nowhere", what: "わざと存在しない文字列", selectors: [".MuiNowhere-root"],
    uses: { "chat-window-maker": ["css.v1.js"] }, text: "this-string-is-not-in-ccfolia",
  });
  const gh = fakeGitHub();
  const out = await once(null, site(HTML, JS), { items, github: gh.github });
  assert.deepStrictEqual(out.actions, [{ kind: "missing", type: "report" }]);
  const [post] = posts(gh);
  assert.match(post.url, /\/repos\/x\/y\/issues$/);
  assert.strictEqual(post.body.title, "[ccf-watch] ツールが頼っているココフォリアの部分が見つからない");
  const body = post.body.body;
  assert.ok(body.startsWith(W.MARK("missing")));
  assert.match(body, /\*\*`test\.nowhere`\*\* わざと存在しない文字列 — 記録なし/);
  assert.match(body, /\[css\.v1\.js\]\(https:\/\/github\.com\/shiki365\/chat-window-maker\/blob\/main\/css\.v1\.js\)/);
  assert.match(body, /セレクタ: `\.MuiNowhere-root`/);
  assert.match(body, /探したもの: 文字列 `this-string-is-not-in-ccfolia`/);
  assert.match(body, /- \[ \] \*\*チャットウィンドウメーカー\*\*/);
  assert.doesNotMatch(body, /ステータスバーメーカー/);
  assert.match(body, /見つかった項目: 35 \/ 36/);
  assert.match(body, /\[この実行のログ\]\(https:\/\/example\/run\/1\)/);
  assert.match(out.summary, /Issue を立てた: \[#100\]/);
  assert.match(out.summary, /\| ❌ \| `test\.nowhere` \|/);
});

test("an item that disappears from a new bundle is reported as 前回はあった", async () => {
  const dir = tmp(), state = path.join(dir, "state.json");
  await once(state, site(HTML, JS), { dryRun: false, github: fakeGitHub().github });
  const html2 = HTML.replace("main.0a1b2c3d.js", "main.9f8e7d6c.js");
  const js2 = JS.replace('role:"log"', 'role:"feed"');
  const gh = fakeGitHub();
  const out = await once(state, site(html2, js2, "https://ccfolia.com/static/js/main.9f8e7d6c.js"), { now: new Date(T0.getTime() + DAY), github: gh.github });
  assert.deepStrictEqual(out.actions, [{ kind: "missing", type: "report" }]);
  const body = posts(gh)[0].body.body;
  assert.match(body, /\*\*`chat\.roleLog`\*\* .* — 前回はあった/);
  assert.match(body, /本体 JS: `main\.9f8e7d6c\.js`（版 1\.37\.4）。前回は `main\.0a1b2c3d\.js`（版 1\.37\.4）/);
  assert.match(body, /調べた日時: 2026-10-30 07:17（日本時間）/);
  // The same result the next day is not reported again.
  const gh2 = fakeGitHub();
  const again = await once(state, site(html2, js2, "https://ccfolia.com/static/js/main.9f8e7d6c.js"), { now: new Date(T0.getTime() + 2 * DAY), github: gh2.github });
  assert.deepStrictEqual(again.actions, []);
  assert.strictEqual(gh2.calls.length, 0);
});

test("a new bundle with every item found: the changed issue, then nothing while it stays", async () => {
  const dir = tmp(), state = path.join(dir, "state.json");
  await once(state, site(HTML, JS), { github: fakeGitHub().github });
  const html2 = HTML.replace("main.0a1b2c3d.js", "main.1b2c3d4e.js");
  const js2 = JS.replace('REACT_APP_VERSION:"1.37.4"', 'REACT_APP_VERSION:"1.38.0"');
  const get2 = site(html2, js2, "https://ccfolia.com/static/js/main.1b2c3d4e.js");
  const gh = fakeGitHub();
  const out = await once(state, get2, { now: new Date(T0.getTime() + DAY), github: gh.github });
  assert.deepStrictEqual(out.actions, [{ kind: "changed", type: "report" }]);
  const { title, body } = posts(gh)[0].body;
  assert.strictEqual(title, "[ccf-watch] ココフォリアの本体 JS が変わった");
  assert.match(body, /`main\.1b2c3d4e\.js`（版 1\.38\.0）。前回は `main\.0a1b2c3d\.js`（版 1\.37\.4）/);
  assert.match(body, /35 項目は、全部見つかった/);
  // Every tool gets a line to check, with the assumptions no string can show.
  for (const name of ["ステータスバーメーカー", "チャットウィンドウメーカー", "メッセージボックスメーカー", "シナリオテキストメーカー"]) {
    assert.match(body, new RegExp(`- \\[ \\] \\*\\*${name}\\*\\*`));
  }
  assert.match(body, /文字列では見張れない前提: ダイスの成否のクラス/);
  const gh2 = fakeGitHub();
  const again = await once(state, get2, { now: new Date(T0.getTime() + 2 * DAY), github: gh2.github });
  assert.deepStrictEqual(again.actions, []);
});

test("same bundle name with other contents counts as a change", async () => {
  const dir = tmp(), state = path.join(dir, "state.json");
  await once(state, site(HTML, JS), { github: fakeGitHub().github });
  const gh = fakeGitHub();
  const out = await once(state, site(HTML, JS + "\n// rebuilt"), { github: gh.github });
  assert.deepStrictEqual(out.actions, [{ kind: "changed", type: "report" }]);
  assert.match(posts(gh)[0].body.body, /名前は同じで中身が変わった/);
});

test("an open issue of the same kind gets a comment instead of a new issue", async () => {
  const dir = tmp(), state = path.join(dir, "state.json");
  await once(state, site(HTML, JS), { github: fakeGitHub().github });
  const html2 = HTML.replace("main.0a1b2c3d.js", "main.1b2c3d4e.js");
  const open = [
    { number: 7, html_url: "https://github.com/x/y/pull/7", body: W.MARK("changed"), pull_request: {} },
    { number: 8, html_url: "https://github.com/x/y/issues/8", body: "something else" },
    { number: 9, html_url: "https://github.com/x/y/issues/9", body: W.MARK("changed") + "\n\nold report" },
  ];
  const gh = fakeGitHub(open);
  const out = await once(state, site(html2, JS, "https://ccfolia.com/static/js/main.1b2c3d4e.js"), { github: gh.github });
  const [post] = posts(gh);
  assert.strictEqual(posts(gh).length, 1);
  assert.match(post.url, /\/issues\/9\/comments$/);
  assert.match(post.body.body, /^### 2026-10-29 07:17 の結果/);
  assert.doesNotMatch(post.body.body, /ccf-watch:changed/);
  assert.deepStrictEqual(out.results, [{ how: "commented", number: 9, url: "https://github.com/x/y/issues/9#issuecomment-1" }]);
});

test("when every item is back, an open missing issue gets a comment", async () => {
  const dir = tmp(), state = path.join(dir, "state.json");
  const items = itemsWith({ id: "test.later", what: "あとで足される文字列", uses: { "message-box-maker": ["css.v1.js"] }, text: "added-later" });
  await once(state, site(HTML, JS), { items, github: fakeGitHub().github });
  const gh = fakeGitHub([{ number: 3, html_url: "https://github.com/x/y/issues/3", body: W.MARK("missing") }]);
  const out = await once(state, site(HTML, JS + 'var Z="added-later";'), { items, github: gh.github });
  assert.deepStrictEqual(out.actions, [{ kind: "changed", type: "report" }, { kind: "missing", type: "resolved" }]);
  const comment = posts(gh).find(p => /\/issues\/3\/comments$/.test(p.url));
  assert.match(comment.body.body, /全部見つかった/);
  // With no missing issue open, "resolved" posts nothing.
  const gh2 = fakeGitHub();
  const out2 = await W.run({ items, state: null, get: site(HTML, JS + 'var Z="added-later";'), now: T0, github: gh2.github });
  assert.deepStrictEqual(out2.actions, []);
});

test("fetch failures: the error issue on the 2nd run in a row, a reminder later, a comment when back", async () => {
  const dir = tmp(), state = path.join(dir, "state.json");
  await once(state, site(HTML, JS), { github: fakeGitHub().github });
  const down = site(null, null);
  const day = n => new Date(T0.getTime() + n * DAY);
  const gh1 = fakeGitHub();
  const r1 = await once(state, down, { now: day(1), github: gh1.github });
  assert.deepStrictEqual(r1.actions, []);
  assert.strictEqual(r1.state.failures, 1);
  assert.strictEqual(r1.state.bundle.file, "main.0a1b2c3d.js", "the last good bundle is kept");
  const gh2 = fakeGitHub();
  const r2 = await once(state, down, { now: day(2), github: gh2.github });
  assert.deepStrictEqual(r2.actions, [{ kind: "error", type: "report" }]);
  const body = posts(gh2)[0].body.body;
  assert.match(body, /2 回続けて取ってこられなかった/);
  assert.match(body, /エラー: `HTTP 503: https:\/\/ccfolia\.com\/`/);
  assert.match(body, /最後に取れた本体 JS: `main\.0a1b2c3d\.js`（版 1\.37\.4）、2026-10-29 07:17/);
  for (let n = 3; n < 2 + W.ERROR_REMIND; n++) {
    const r = await once(state, down, { now: day(n), github: fakeGitHub().github });
    assert.deepStrictEqual(r.actions, [], `run ${n}`);
  }
  const r9 = await once(state, down, { now: day(2 + W.ERROR_REMIND), github: fakeGitHub().github });
  assert.deepStrictEqual(r9.actions, [{ kind: "error", type: "report" }]);
  const gh3 = fakeGitHub([{ number: 5, html_url: "https://github.com/x/y/issues/5", body: W.MARK("error") }]);
  const back = await once(state, site(HTML, JS), { now: day(10), github: gh3.github });
  assert.deepStrictEqual(back.actions, [{ kind: "error", type: "back" }]);
  assert.match(posts(gh3)[0].url, /\/issues\/5\/comments$/);
  assert.strictEqual(back.state.failures, 0);
});

test("a page without main.*.js is a failure too", async () => {
  const out = await once(null, site("<html><body><div id=\"root\"></div><script src=\"/assets/index-abc.js\"></script></body></html>", JS), { github: fakeGitHub().github });
  assert.match(out.ctx.error.message, /main\.\*\.js が見つからない/);
  assert.strictEqual(out.state.failures, 1);
});

test("dry run: no posts, no state written, the messages are in the summary", async () => {
  const dir = tmp(), state = path.join(dir, "state.json");
  const items = itemsWith({ id: "test.nowhere", what: "わざと存在しない文字列", uses: { "status-bar-maker": ["css.v1.js"] }, regex: "nowhere\\d+" });
  const gh = fakeGitHub();
  const out = await once(state, site(HTML, JS), { items, dryRun: true, github: gh.github });
  assert.strictEqual(gh.calls.length, 0);
  assert.ok(!fs.existsSync(state));
  assert.match(out.summary, /### dry run: 出すはずだったもの/);
  assert.match(out.summary, /探したもの: 正規表現 `nowhere\\d\+`/);
});

test("when GitHub refuses a post, the state is not written (the next run tries again)", async () => {
  const dir = tmp(), state = path.join(dir, "state.json");
  const items = itemsWith({ id: "test.nowhere", what: "x", uses: { "status-bar-maker": ["css.v1.js"] }, text: "nowhere-at-all" });
  const github = { token: "t", repo: "x/y", fetchImpl: async () => ({ ok: false, status: 403, text: async () => "Resource not accessible by integration" }) };
  await assert.rejects(once(state, site(HTML, JS), { items, github }), /HTTP 403 Resource not accessible/);
  assert.ok(!fs.existsSync(state));
});

test("matching details: \\u escapes, near, absolute bundle URLs, versions", () => {
  assert.strictEqual(W.count({ text: "前景" }, 'a="\\u524d\\u666f"'), 1);
  assert.strictEqual(W.count({ text: "前景" }, 'a="前景",b="前景"'), 2);
  const near = { near: ['"a"', '"b"'], within: 10 };
  assert.strictEqual(W.count(near, '["a","b"]'), 1);
  assert.strictEqual(W.count(near, '["a",' + " ".repeat(20) + '"b"]'), 0);
  assert.strictEqual(W.count({ regex: "#2196f3", flags: "i" }, 'main:"#2196F3"'), 1);
  const cfg = W.loadConfig(ITEMS);
  assert.strictEqual(W.findBundle('<script src="https://cdn.example/static/js/main.ab12.js">', cfg), "https://cdn.example/static/js/main.ab12.js");
  assert.strictEqual(W.findBundle('<script src="static/js/main.ab12.js">', cfg), "https://ccfolia.com/static/js/main.ab12.js");
  assert.strictEqual(W.readVersion('a={version:"1.1.0"},b={REACT_APP_VERSION:"1.40.2"}', cfg), "1.40.2");
  assert.strictEqual(W.readVersion('t.version="18.3.1"', cfg), null);
});
