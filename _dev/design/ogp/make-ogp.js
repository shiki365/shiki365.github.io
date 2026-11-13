#!/usr/bin/env node
/*
 * make-ogp.js - the card images (ogp.png, 1200x630) of the hub page and of every tool, and the hub's thumbnails.
 *
 *   node _dev/design/ogp/make-ogp.js [name ...]        (no name: all of them)
 *
 * The repositories must sit side by side (shiki365.github.io next to chat-window-maker and so on).
 * For each tool the script opens the real page, makes real previews with the tool's own presets, and puts
 * them on one shared card (the same look as the pages: ink ground, paper-white text, verdigris). It writes
 *   <tool>/ogp.png   (scene transition maker: docs/ogp.png)
 *   shiki365.github.io/thumbs/<tool>.webp   (640x336, for the cards of the hub page)
 *   shiki365.github.io/ogp.png              (made last, from four of the thumbnails)
 * The printer finder's card is a drawn sample without printer names or prices (on purpose: prices change).
 * Needs Node, Playwright (npm i playwright), python3 with Pillow, and Japanese fonts with a bold weight
 * (Yu Gothic UI on Windows; on Linux: fonts-noto-cjk). Previews use Google Fonts, so it needs the network.
 */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { serve } = require("./serve.js");

const HUB = path.resolve(__dirname, "../../.."), WORK = path.dirname(HUB);
const wanted = process.argv.slice(2);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ogp-"));
const dataUrl = buf => "data:image/png;base64," + buf.toString("base64");

// ---------------------------------------------------------------- the card

const CARD_CSS = `
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  body { box-sizing: border-box; padding: 44px 56px 40px; display: flex; flex-direction: column; background: #10141a; color: #e9e6df;
         font-family: "Yu Gothic UI", "Meiryo", "Noto Sans CJK JP", sans-serif; }
  * { box-sizing: border-box; }
  .kicker { color: #5ccfc0; font-size: 22px; font-weight: 700; letter-spacing: .08em; }
  h1 { margin: 4px 0 0; font-size: 58px; line-height: 1.25; font-weight: 700; letter-spacing: .01em; display: flex; align-items: center; gap: 22px; }
  h1::before { content: ""; flex: none; width: 22px; height: 22px; margin-left: 5px; background: #5ccfc0; transform: rotate(45deg); }
  .tagline { margin: 8px 0 0; color: #cfcdc6; font-size: 27px; line-height: 1.5; }
  .rule { height: 1px; background: #2c3440; margin: 22px 0 0; }
  .shots { flex: 1; min-height: 0; display: flex; gap: 20px; margin-top: 22px; }
  .shot { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .shot .pic { flex: 1; min-height: 0; border: 1px solid #6b7686; border-radius: 8px; overflow: hidden; background: #171c24 center / cover no-repeat; }
  .shot.contain .pic { background-size: contain; }
  /* A preview photographed without its backdrop, put on the tools' "scene" backdrop. */
  .shot.onscene .pic { padding: 14px; background-color: #2d3348; background-repeat: no-repeat; background-position: center;
    background-size: contain, cover, cover; background-origin: content-box, border-box, border-box; }
  .shot.wide { justify-content: center; }
  .shot.wide .pic { flex: none; aspect-ratio: 16 / 9; }
  .shot .cap { color: #9ba4ae; font-size: 19px; text-align: center; white-space: nowrap; }
  .foot { margin-top: 18px; display: flex; justify-content: space-between; align-items: baseline; color: #9ba4ae; font-size: 20px; }
  .foot b { color: #e9e6df; font-weight: 700; }
  .foot .url { font-family: Consolas, "DejaVu Sans Mono", monospace; font-size: 18px; }
  /* side layout: text on the left, one picture or sample on the right */
  body.side { flex-direction: row; gap: 44px; padding: 52px 56px; }
  body.side .text { flex: 0 0 500px; display: flex; flex-direction: column; }
  body.side h1 { font-size: 52px; gap: 18px; white-space: nowrap; }
  body.side h1.long { font-size: 43px; gap: 14px; }
  body.side h1.long::before { width: 18px; height: 18px; }
  body.side .tagline { margin-top: 18px; font-size: 26px; line-height: 1.65; }
  body.side .foot { margin-top: auto; flex-direction: column; gap: 6px; }
  body.side .right { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 14px; }
  body.side .right .pic { border: 1px solid #6b7686; border-radius: 8px; overflow: hidden; background: #171c24 center / contain no-repeat; }
  .note { color: #9ba4ae; font-size: 19px; }
  .sample { border: 1px solid #6b7686; border-radius: 8px; background: #171c24; padding: 14px 20px 16px; }
  .sample.top { box-shadow: inset 4px 0 0 #5ccfc0; }
  .sample .head { display: flex; align-items: center; gap: 12px; font-size: 25px; font-weight: 700; }
  .sample .rank { padding: 1px 10px; background: #5ccfc0; color: #06211d; font-size: 16px; border-radius: 3px; }
  .sample .price { margin-top: 4px; font-size: 30px; font-weight: 700; letter-spacing: .04em; }
  .sample .price small { font-size: 17px; font-weight: 400; color: #cfcdc6; letter-spacing: 0; }
  .sample .chips { display: flex; gap: 8px; margin-top: 8px; }
  .sample .chips span { border: 1px solid #2c3440; border-radius: 3px; padding: 0 9px; color: #cfcdc6; font-size: 15px; }
  /* hub */
  body.hub { justify-content: center; }
  body.hub h1 { font-size: 68px; }
  body.hub .tagline { font-size: 28px; }
  body.hub .shots { flex: none; height: 196px; margin-top: 40px; }
  body.hub .shot .cap { font-size: 17px; }
`;
const SCENE = "radial-gradient(ellipse at 30% 20%, #6d7fa8, transparent 60%), radial-gradient(ellipse at 80% 90%, #a8735a, transparent 55%)";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const shotsHtml = shots => `<div class="shots">${shots.map(s =>
  `<div class="shot${s.wide ? " wide" : ""}${s.contain ? " contain" : ""}${s.onscene ? " onscene" : ""}"><div class="pic" style="background-image: url(${s.src})${s.onscene ? ", " + SCENE : ""}${s.bg ? `; background-color: ${s.bg}` : ""}"></div>${s.cap ? `<div class="cap">${esc(s.cap)}</div>` : ""}</div>`).join("")}</div>`;

function cardHtml(c) {
  const head = `<div class="kicker">${esc(c.kicker)}</div><h1${c.title.length > 8 ? ' class="long"' : ""}>${esc(c.title)}</h1><p class="tagline">${c.tagline}</p>`;
  const foot = `<div class="foot"><span>${c.foot}</span><span class="url">${esc(c.url)}</span></div>`;
  let body;
  if (c.layout === "side") body = `<body class="side"><div class="text">${head}${foot}</div><div class="right">${c.right}</div></body>`;
  else if (c.layout === "hub") body = `<body class="hub">${head}${shotsHtml(c.shots)}</body>`;
  else body = `<body>${head}<div class="rule"></div>${shotsHtml(c.shots)}${foot}</body>`;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${CARD_CSS}</style></head>${body}</html>`;
}

// ---------------------------------------------------------------- helpers for the tools

async function openTool(browser, url, width = 1500) {
  const ctx = await browser.newContext({ viewport: { width, height: 1100 }, deviceScaleFactor: 2, colorScheme: "dark", locale: "ja-JP" });
  const pg = await ctx.newPage();
  await pg.goto(url, { waitUntil: "load" });
  await pg.waitForTimeout(900);
  return pg;
}
const settle = async pg => { await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(1200); };
const shoot = async (pg, sel) => dataUrl(await (await pg.$(sel)).screenshot());

/** Applies each preset of a CSS tool and photographs the preview box. */
async function presetShots(pg, list, { tab, size, after } = {}) {
  const out = [];
  // Only the preview itself: no page behind it, no dashed outline.
  await pg.addStyleTag({ content: "html, body, main, .stage-wrap, .stage { background: transparent !important; } .frame-box { outline: 0 !important; }" });
  if (size) for (const [key, value] of Object.entries(size)) {
    await pg.fill(`[data-bind='source.${key}']`, String(value)); await pg.press(`[data-bind='source.${key}']`, "Tab");
  }
  for (const [key, cap, previewTab] of list) {
    if (tab) await pg.click(`[data-tab=${tab}]`);
    await pg.selectOption("#design", key);
    await pg.click("#applyDesign");
    if (previewTab && await pg.$("#previewTab")) await pg.selectOption("#previewTab", previewTab);
    if (after) await after(pg);
    await settle(pg);
    out.push({ src: dataUrl(await (await pg.$("#frameBox")).screenshot({ omitBackground: true })), cap, onscene: true });
  }
  return out;
}

// Message box maker: a shorter portrait, so the whole figure fits above the box in a small source.
const SHORT_PORTRAIT = async pg => {
  await pg.click("[data-tab=portrait]");
  await pg.$eval("[data-bind='portrait.maxH']", e => { e.value = 270; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); });
};

// Pictures drawn for the tools that need one: two portraits and a book cover (front and back).
function drawPictures() {
  execFileSync("python3", ["-I", "-c", `
import sys
from PIL import Image, ImageDraw, ImageFilter
out = sys.argv[1]
def portrait(name, hair, coat):
    im = Image.new("RGBA", (480, 900), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([110, 330, 370, 900], 70, fill=coat)            # body
    d.polygon([(200, 330), (280, 330), (240, 420)], fill=(240, 232, 220))  # collar
    d.ellipse([140, 90, 340, 310], fill=(244, 222, 200))                # face
    d.pieslice([120, 60, 360, 300], 180, 360, fill=hair)                # hair
    d.rectangle([120, 180, 150, 330], fill=hair); d.rectangle([330, 180, 360, 330], fill=hair)
    d.ellipse([195, 205, 213, 225], fill=(40, 40, 50)); d.ellipse([267, 205, 285, 225], fill=(40, 40, 50))
    im.save(out + "/" + name + ".png")
portrait("アリス", (122, 78, 52), (178, 62, 60))
portrait("ボブ", (52, 60, 84), (58, 92, 140))
def cover(name, flip):
    w, h = 2100, 2900
    im = Image.new("RGB", (w, h)); px = im.load()
    for y in range(h):
        t = y / h
        c = (int(22 + 70 * t), int(26 + 40 * t), int(64 + 60 * t))
        for x in range(w): px[x, y] = c
    d = ImageDraw.Draw(im)
    mx = w * (0.3 if flip else 0.68)
    d.ellipse([mx - 190, 420, mx + 190, 800], fill=(252, 244, 214))
    for i, (yy, col) in enumerate([(2050, (58, 44, 92)), (2300, (40, 32, 70)), (2550, (24, 22, 48))]):
        pts = [(0, h)] + [(x, yy + (160 if (x // 350 + i + flip) % 2 else 0)) for x in range(0, w + 350, 350)] + [(w, h)]
        d.polygon(pts, fill=col)
    for k in range(60):
        x = (k * 733 + 91 * flip) % w; y = (k * 397) % 1500
        d.ellipse([x, y, x + 7, y + 7], fill=(235, 235, 245))
    im.save(out + "/" + name + ".png")
cover("front", 0); cover("back", 1)
`, tmp]);
}

// ---------------------------------------------------------------- the cards

const CARDS = {
  "chat-window-maker": async (b, base) => {
    const pg = await openTool(b, base + "chat-window-maker/");
    const shots = await presetShots(pg, [["dicebox", "ダイスウィンドウ", "main"], ["secretLetter", "秘匿チャット（手紙）", "secret"], ["secretHud", "秘匿通信（SF）", "secret"]], { tab: "window" });
    return { kicker: "ココフォリア × OBS", title: "チャットウィンドウメーカー", tagline: "ココフォリアのダイスや秘匿チャットを、OBS に好きなデザインで",
      foot: "プレビューで確かめながら作れる・<b>無料</b>・登録不要", url: "shiki365.github.io/chat-window-maker", shots };
  },
  "message-box-maker": async (b, base) => {
    const pg = await openTool(b, base + "message-box-maker/");
    const shots = await presetShots(pg, [["novel", "ノベルゲーム"], ["letter", "古い紙（手紙）"]], { tab: "box", size: { w: 800, h: 420 },
after: SHORT_PORTRAIT });
    return { kicker: "ココフォリア × OBS", title: "メッセージボックスメーカー", tagline: "ココフォリアの立ち絵つきメッセージボックスを、OBS に好きなデザインで",
      foot: "プレビューで確かめながら作れる・<b>無料</b>・登録不要", url: "shiki365.github.io/message-box-maker", shots };
  },
  "status-bar-maker": async (b, base) => {
    const pg = await openTool(b, base + "status-bar-maker/");
    const shots = await presetShots(pg, [["standard", "標準"], ["archive", "古文書（クトゥルフ）"], ["hud", "SF・HUD"]], { tab: "layout" });
    return { kicker: "ココフォリア × OBS", title: "ステータスバーメーカー", tagline: "ココフォリアの HP・MP・SAN を、OBS に好きなデザインで",
      foot: "数値はココフォリアと連動・<b>無料</b>・登録不要", url: "shiki365.github.io/status-bar-maker", shots };
  },
  "foreground-frame-maker": async (b, base) => {
    const pg = await openTool(b, base + "foreground-frame-maker/");
    const shots = [];
    for (const [key, cap] of [["mansion", "洋館・クラシック"], ["forest", "森・遺跡"], ["sakura", "桜"]]) {
      await pg.click("[data-tab=frame]"); await pg.selectOption("#design", key); await pg.click("#applyDesign"); await settle(pg);
      shots.push({ src: await shoot(pg, "#stage"), cap, wide: true });
    }
    return { kicker: "ココフォリアの前景", title: "前景フレームメーカー", tagline: "盤面のまわりに付ける枠を、飾りや天気・時間帯の差分つきで",
      foot: "窓の部分が透明な PNG・<b>無料</b>・登録不要", url: "shiki365.github.io/foreground-frame-maker", shots };
  },
  "scene-transition-maker": async (b, base) => {
    const pg = await openTool(b, base + "scene-transition-maker/docs/");
    const shots = [];
    for (const [key, cap] of [["wipe-right", "横ワイプ"], ["iris-out", "アイリスアウト"], ["blood-drip", "血のしたたり"]]) {
      await pg.selectOption("#preset", key); await pg.selectOption("#size", "640x360"); await pg.waitForTimeout(300);
      // The preview loops: wait until the effect covers about half of the picture.
      await pg.waitForFunction(() => {
        const c = document.getElementById("preview"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        let on = 0; for (let i = 3; i < d.length; i += 64) if (d[i] > 128) on++;
        const part = on / (d.length / 64); return part > 0.35 && part < 0.6;
      }, null, { polling: 30, timeout: 20000 });
      shots.push({ src: await shoot(pg, "#stage"), cap, wide: true });
    }
    return { kicker: "動く WebP ・ APNG", title: "場面転換素材メーカー", tagline: "暗転・ワイプ・アイリスなど 53 種類の場面転換を、ブラウザだけで",
      foot: "背景が透明なまま動く・<b>無料</b>・登録不要", url: "shiki365.github.io/scene-transition-maker", shots };
  },
  "scenario-text-maker": async (b, base) => {
    const pg = await openTool(b, base + "scenario-text-maker/", 1020);   // a narrow window: the sample is drawn larger
    await pg.click("#fillSample"); await pg.waitForTimeout(500);
    // Pictures named like the speakers are attached by the tool itself. They are passed as bytes: a file
    // given by its path does not get stored by the headless browser.
    const file = n => ({ name: n + ".png", mimeType: "image/png", buffer: fs.readFileSync(path.join(tmp, n + ".png")) });
    const [chooser] = await Promise.all([pg.waitForEvent("filechooser"), pg.click("#drop")]);
    await chooser.setFiles([file("アリス"), file("ボブ")]); await pg.waitForTimeout(1500);
    const script = await shoot(pg, "#script");
    await pg.selectOption("#viewSize", "mid");
    await pg.click("#entries tr:nth-child(1)"); await settle(pg);
    await pg.addStyleTag({ content: "html, body, main, .stack, .card, .stage { background: transparent !important; } .stage { border: 0 !important; }" });
    // Only the portrait and the box: the sample stage around them is mostly empty.
    const clip = await pg.evaluate(() => {
      const r = [document.querySelector("#mboxPortrait"), document.querySelector("#mbox")].map(e => e.getBoundingClientRect());
      const x0 = Math.min(...r.map(v => v.left)) - 24, y0 = Math.min(...r.map(v => v.top)) - 16;
      const x1 = Math.max(...r.map(v => v.right)) + 24, y1 = Math.max(...r.map(v => v.bottom)) + 16;
      return { x: x0 + scrollX, y: y0 + scrollY, width: x1 - x0, height: y1 - y0 };
    });
    const sample = dataUrl(await pg.screenshot({ clip, omitBackground: true, fullPage: true }));
    return { kicker: "ココフォリアのシナリオテキスト", title: "シナリオテキストメーカー", tagline: "台本を貼るだけで、立ち絵つきのシナリオテキストをまとめて作成",
      foot: "ルームデータ（ZIP）を読み込むだけ・<b>無料</b>・登録不要", url: "shiki365.github.io/scenario-text-maker",
      shots: [{ src: script, cap: "台本を貼る", contain: true, bg: "#0c0f14" }, { src: sample, cap: "送ると立ち絵が出る", onscene: true }] };
  },
  "cover-print-maker": async (b, base) => {
    const pg = await openTool(b, base + "cover-print-maker/");
    await pg.click("[data-tab=pics]");
    await pg.check("input[name=mode][value=pair]");
    for (const slot of ["front", "back"]) {
      const [chooser] = await Promise.all([pg.waitForEvent("filechooser"), pg.click(`.slot[data-slot=${slot}]`)]);
      await chooser.setFiles(path.join(tmp, slot + ".png")); await pg.waitForTimeout(700);
    }
    await settle(pg);
    const cover = await shoot(pg, "#preview");
    return { layout: "side", kicker: "同人誌の表紙・無料", title: "表紙入稿メーカー",
      tagline: "表紙の絵から、表4・背・表1 を<br>つないだ入稿用のデータに。<br>塗り足しつき・CMYK の PDF。<br>背幅の計算とガイド画像も。",
      foot: "<span>印刷所 22 社の塗り足しと背幅に対応</span>", url: "shiki365.github.io/cover-print-maker",
      right: `<div class="note">表4（裏表紙）・背・表1（表紙）と、塗り足し・安全域のガイド</div><div class="pic" style="aspect-ratio: 372.5 / 263; background-image: url(${cover})"></div>` };
  },
  "doujin-printer-finder": async () => {
    const sample = (n, name, kind, chips, top) => `<div class="sample${top ? " top" : ""}"><div class="head"><span class="rank">安い順 ${n}</span>${name}</div>`
      + `<div class="price">〇〇,〇〇〇円 <small>${kind}・税込</small></div><div class="chips">${chips.map(c => `<span>${c}</span>`).join("")}</div></div>`;
    return { layout: "side", kicker: "同人誌の印刷所・無料", title: "同人誌の印刷所さがし",
      tagline: "部数・予算・入稿や納品の条件で<br>絞り込み、値段の目安の安い順に。<br>各社の公式ページで確かめた<br>情報だけ、根拠のリンクつき。",
      foot: "<span>印刷所 22 社の公式ページから</span>", url: "shiki365.github.io/doujin-printer-finder",
      right: `<div class="note">画面の例（判型・ページ数・部数を入れると）</div>`
        + sample(1, "印刷所 A", "オンデマンド", ["1冊から", "直接搬入"], true)
        + sample(2, "印刷所 B", "オンデマンド", ["10冊から", "直接搬入", "カード払い"], true)
        + sample(3, "印刷所 C", "オフセット", ["30冊から", "直接搬入"], true) };
  },
};
const OUT = name => name === "scene-transition-maker" ? path.join(WORK, name, "docs", "ogp.png") : path.join(WORK, name, "ogp.png");

async function render(browser, card, file) {
  const pg = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await pg.setContent(cardHtml(card), { waitUntil: "load" });
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: file, type: "png" });
  await pg.close();
}

// 640x336 WebP for the hub's cards, as _dev/make-thumbs.py makes them.
function thumb(src, name) {
  execFileSync("python3", ["-I", "-c", `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
w, h = im.size; r = 640 / 336
if w / h > r:
    nw = round(h * r); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
else:
    nh = round(w / r); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
im.resize((640, 336), Image.Resampling.LANCZOS).save(sys.argv[2], "WEBP", quality=82, method=6)
`, src, path.join(HUB, "thumbs", name + ".webp")]);
}

(async () => {
  drawPictures();
  const server = await serve(WORK);
  const browser = await chromium.launch();
  const names = Object.keys(CARDS).filter(n => !wanted.length || wanted.includes(n));
  for (const name of names) {
    const card = await CARDS[name](browser, server.url);
    await render(browser, card, OUT(name));
    thumb(OUT(name), name);
    console.log(name, "->", path.relative(WORK, OUT(name)), Math.round(fs.statSync(OUT(name)).size / 1024) + " KB");
  }
  if (!wanted.length || wanted.includes("hub")) {
    // One real preview from each of four tools.
    const one = async (dir, list, opt) => { const pg = await openTool(browser, server.url + dir); const r = await presetShots(pg, list, opt); await pg.context().close(); return r[0]; };
    const frame = await openTool(browser, server.url + "foreground-frame-maker/");
    await frame.selectOption("#design", "forest"); await frame.click("#applyDesign"); await settle(frame);
    const shots = [
      await one("status-bar-maker/", [["standard", "ステータスバー"]], { tab: "layout" }),
      await one("chat-window-maker/", [["dicebox", "チャットウィンドウ", "main"]], { tab: "window" }),
      await one("message-box-maker/", [["novel", "メッセージボックス"]], { tab: "box", size: { w: 800, h: 420 }, after: SHORT_PORTRAIT }),
      { src: await shoot(frame, "#stage"), cap: "前景フレーム" },
    ];
    await render(browser, { layout: "hub", kicker: "TRPG・マダミスのオンセ・配信向け", title: "shiki365 のツール置き場",
      tagline: "ブラウザで作る素材から、Discord 連動の OBS 用ソフトまで。どれも無料", shots }, path.join(HUB, "ogp.png"));
    console.log("hub -> shiki365.github.io/ogp.png", Math.round(fs.statSync(path.join(HUB, "ogp.png")).size / 1024) + " KB");
  }
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})();
