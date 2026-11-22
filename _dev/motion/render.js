#!/usr/bin/env node
/* render.js - shoots a video page made with kit.js frame by frame with headless Edge and writes an mp4
 * (not part of any tool).
 *
 *   node _dev/motion/render.js <page.html> [--out video.mp4] [--fps 30] [--from s] [--to s] [--stills 1,5.5,9] [--sheet]
 *
 *   --out     where the mp4 goes (default: next to the page, same name)
 *   --fps     30 while making, 60 for the finished video (smoother pointer)
 *   --stills  only PNGs of those moments, into <out>-stills/ (quick checks while making; no video)
 *   --sheet   after the video, one frame a second tiled into <out>-sheet.jpg (left to right, top to bottom)
 *
 * The page is opened with ?render=1 (no seek bar). Each frame is shot twice and compared: headless Edge now and
 * then returns a broken screenshot (the page drawn at half size, 2 x 2). Needs Node 22 or later (WebSocket), Edge,
 * and ffmpeg: the one in kokofolia-apng/.venv (imageio_ffmpeg), or FFMPEG=<path>. MOTION_DEBUG_PORT changes the
 * DevTools port (default 9344) when another recorder is running.
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith("--")) { console.error("usage: node render.js <page.html> [--out video.mp4] [--fps 30] [--from s] [--to s] [--stills t,t] [--sheet]"); process.exit(2); }
const opt = (name, def) => { const i = args.indexOf("--" + name); return i < 0 ? def : args[i + 1]; };
const PAGE = path.resolve(args[0]);
const OUT = path.resolve(opt("out", PAGE.replace(/\.html?$/i, "") + ".mp4"));
const FPS = Number(opt("fps", 30));
const STILLS = opt("stills", null);
const SHEET = args.includes("--sheet");
const EDGE = process.env.EDGE || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const FFMPEG = process.env.FFMPEG || path.resolve(__dirname, "..", "..", "..", "kokofolia-apng", ".venv", "Lib", "site-packages", "imageio_ffmpeg", "binaries", "ffmpeg-win-x86_64-v7.1.exe");
const PORT = Number(process.env.MOTION_DEBUG_PORT || 9344);
const sleep = ms => new Promise(r => setTimeout(r, ms));

let ws, nextId = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject, method });
  ws.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description || r.exceptionDetails.text) + "\n  in: " + expression.slice(0, 120));
  return r.result.value;
}
const shot = async (format = "jpeg") => Buffer.from((await send("Page.captureScreenshot", format === "png" ? { format } : { format, quality: 95 })).data, "base64");
const frameAt = t => evaluate(`window.render(${t}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);

(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "motion-"));
  const frames = path.join(work, "frames");
  fs.mkdirSync(frames);
  const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-color-profile=srgb", `--remote-debugging-port=${PORT}`,
    "--remote-allow-origins=*", `--user-data-dir=${path.join(work, "profile")}`, "--window-size=1920,1080", "about:blank"], { stdio: "ignore" });
  let duration = 0, count = 0;
  try {
    let page;
    for (let i = 0; i < 100 && !page; i++) {
      try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === "page"); } catch (e) { /* starting */ }
      if (!page) await sleep(200);
    }
    if (!page) throw new Error(`could not reach Edge on port ${PORT}`);
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data), p = m.id && pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.error) p.reject(new Error(p.method + ": " + m.error.message)); else p.resolve(m.result);
    };
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: "file:///" + PAGE.replace(/\\/g, "/") + "?render=1" });
    for (let i = 0; ; i++) {
      if (i > 150) throw new Error("the page did not become ready (window.__ready)");
      await sleep(100);
      try { if (await evaluate("!!window.__ready")) break; } catch (e) { /* loading */ }
    }
    duration = await evaluate("window.DURATION");
    if (STILLS) {
      const dir = OUT.replace(/\.mp4$/i, "") + "-stills";
      fs.mkdirSync(dir, { recursive: true });
      for (const t of STILLS.split(",").map(Number)) {
        await frameAt(t);
        fs.writeFileSync(path.join(dir, `t${t.toFixed(2).padStart(6, "0")}.png`), await shot("png"));
      }
      console.log("stills in " + dir);
      return;
    }
    const from = Number(opt("from", 0)), to = Math.min(duration, Number(opt("to", duration)));
    const n = Math.round((to - from) * FPS), started = Date.now();
    for (let i = 0; i < n; i++) {
      await frameAt(from + i / FPS);
      let a = await shot();
      const b = await shot();
      if (!a.equals(b)) { const c = await shot(); a = c.equals(a) ? a : c.equals(b) ? b : c; }
      fs.writeFileSync(path.join(frames, String(i).padStart(5, "0") + ".jpg"), a);
      count++;
      if (i % 150 === 149) process.stdout.write(`  ${i + 1}/${n}\r`);
    }
    console.log(`${path.basename(PAGE)}: ${count} frames, ${((to - from)).toFixed(2)} s at ${FPS} fps, shot in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  } finally {
    try { ws && ws.close(); } catch (e) { /* closing */ }
    try { execFileSync("taskkill", ["/PID", String(edge.pid), "/T", "/F"], { stdio: "ignore" }); } catch (e) { /* already gone */ }
    await sleep(600);
  }
  if (!STILLS) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    execFileSync(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(frames, "%05d.jpg"),
      "-vf", "scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p",
      "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
      "-movflags", "+faststart", OUT], { stdio: "inherit" });
    console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB)`);
    if (SHEET) {
      const sheet = OUT.replace(/\.mp4$/i, "") + "-sheet.jpg";
      const rows = Math.ceil(count / FPS / 6);
      execFileSync(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-i", OUT, "-vf", `fps=1,scale=480:-1,tile=6x${rows}:padding=4:color=white`, "-frames:v", "1", "-q:v", "3", sheet]);
      console.log("sheet " + sheet);
    }
  }
  try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) { /* Edge may still hold it */ }
})().catch(e => { console.error(e); process.exit(1); });
