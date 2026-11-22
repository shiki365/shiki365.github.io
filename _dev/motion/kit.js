/* kit.js - a small kit for the explainer videos of shiki365's tools (not part of any tool).
 *
 * A video is one HTML page that can draw any moment t (seconds) from scratch with render(t). Frames can then be
 * shot in any order (render.js in this folder does it with headless Edge and writes an mp4), and the page can be
 * previewed in a browser with a seek bar (space: play / pause, arrow keys: one frame, ?t=7.5 opens at 7.5 s).
 * The rules learned so far, and how to make a video, are in README.md.
 *
 * Everything sits on a 1920 x 1080 stage:
 *   window.Motion = { W, H, stage, clamp, k, lerp, ease, track, span, el, put, show, layer, camera, cursor,
 *                     captions, chip, shade, typed, caret, endCard, setup }
 * Build every element once, then let render(t) only move them, fade them and change their text.
 */
(function () {
  "use strict";
  const W = 1920, H = 1080;
  const params = new URLSearchParams(location.search);
  const RENDER = params.has("render");

  // ---------------------------------------------------------------- numbers
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  // Where t is between a and b, from 0 to 1.
  const k = (t, a, b) => (b <= a ? (t >= a ? 1 : 0) : clamp((t - a) / (b - a)));
  const lerp = (a, b, x) => a + (b - a) * x;
  const ease = {
    linear: x => x,
    in: x => x * x * x,
    out: x => 1 - Math.pow(1 - x, 3),
    inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    soft: x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
    back: x => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2)),
  };
  const mix = (a, b, x) => (typeof a === "number" ? lerp(a, b, x) : a.map((v, i) => lerp(v, b[i], x)));
  // A value over time from keys [[t, value, easing]...]: held before the first key and after the last; between two
  // keys it moves with the second key's easing (inOut when left out). Values are numbers or arrays of numbers.
  function track(keys) {
    return t => {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < keys.length; i++) {
        if (t < keys[i][0]) return mix(keys[i - 1][1], keys[i][1], ease[keys[i][2] || "inOut"](k(t, keys[i - 1][0], keys[i][0])));
      }
      return keys[keys.length - 1][1];
    };
  }
  // Something that comes in over [a, b] and goes out over [c, d]: 0 -> 1 -> 0.
  const span = (t, a, b, c = Infinity, d = Infinity, e = "out") => ease[e](k(t, a, b)) * (1 - k(t, c, d));

  // ---------------------------------------------------------------- page
  const css = document.createElement("style");
  css.textContent = `
    :root { --m-bg: #10141a; --m-panel: #171c24; --m-raised: #1e252f; --m-line: #2c3540; --m-fg: #e9e6df; --m-muted: #9ba4ae;
      --m-accent: #5ccfc0; --m-accent2: #7fdccf; --m-deep: #0e6a5c; --m-gold: #c9a227; --m-pick: #1d3a37; }
    html, body { margin: 0; background: #0b0e12; }
    #m-stage { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; overflow: hidden; transform-origin: 0 0;
      color: var(--m-fg); font-family: "Yu Gothic UI", "Yu Gothic", sans-serif; font-weight: 700;
      background: radial-gradient(ellipse 80% 70% at 50% 46%, #18222d 0%, var(--m-bg) 76%); }
    .m-abs { position: absolute; left: 0; top: 0; transform-origin: 50% 50%; box-sizing: border-box; }
    .m-layer { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; }
    .m-shade { position: absolute; left: 0; top: 0; width: ${W}px; height: 262px; pointer-events: none;
      background: linear-gradient(var(--m-bg) 0%, var(--m-bg) 56%, rgba(16,20,26,0) 100%); }
    .m-cap { position: absolute; left: 0; top: 40px; width: ${W}px; text-align: center; }
    .m-cap-main { font-size: 76px; line-height: 1.16; letter-spacing: .02em; white-space: nowrap; text-shadow: 0 4px 22px rgba(0,0,0,.55); }
    .m-cap-main b { color: var(--m-accent2); font-weight: 700; }
    .m-cap-sub { margin-top: 12px; font-size: 44px; color: var(--m-muted); white-space: nowrap; text-shadow: 0 3px 16px rgba(0,0,0,.55); }
    .m-chip { position: absolute; left: 40px; top: 40px; padding: 8px 20px; border-radius: 999px; background: rgba(14,106,92,.92);
      color: #f4f1e8; font-size: 28px; letter-spacing: .04em; white-space: nowrap; }
    .m-cursor { position: absolute; left: 0; top: 0; width: 56px; height: 56px; transform-origin: 7px 4.7px;
      filter: drop-shadow(0 6px 10px rgba(0,0,0,.5)); }
    .m-ripple { position: absolute; left: 0; top: 0; width: 88px; height: 88px; margin: -44px 0 0 -44px; border-radius: 50%;
      border: 4px solid var(--m-accent); background: rgba(92,207,192,.22); }
    .m-end { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 34px;
      background: radial-gradient(ellipse 80% 70% at 50% 46%, #18222d 0%, var(--m-bg) 76%); text-align: center; }
    .m-end-title { font-size: 128px; letter-spacing: .04em; }
    .m-end-title::before { content: "◆"; color: var(--m-accent); margin-right: 30px; font-size: 100px; }
    .m-end-tag { font-size: 48px; color: var(--m-muted); }
    .m-end-chips { display: flex; gap: 18px; margin-top: 6px; }
    .m-end-chips span { padding: 10px 26px; border-radius: 999px; background: var(--m-deep); color: #f4f1e8; font-size: 32px; }
    .m-end-url { margin-top: 24px; font-size: 56px; color: var(--m-accent2); font-family: Consolas, "Yu Gothic UI", monospace; }
    .m-end-note { font-size: 30px; color: var(--m-muted); }
    body.m-preview { overflow: hidden; }
    .m-bar { position: fixed; left: 0; right: 0; bottom: 0; height: 48px; display: flex; align-items: center; gap: 12px; padding: 0 14px;
      background: #1b2028; color: #ddd; font: 14px "Yu Gothic UI", sans-serif; }
    .m-bar input[type=range] { flex: 1; }
    .m-bar button { width: 44px; height: 32px; }
  `;
  document.head.append(css);
  const stage = document.createElement("div");
  stage.id = "m-stage";
  document.body.append(stage);

  // An absolutely placed element (optionally sized) inside parent (the stage when left out).
  function el(parent, cls, html, w, h) {
    const d = document.createElement("div");
    d.className = "m-abs" + (cls ? " " + cls : "");
    if (w != null) d.style.width = w + "px";
    if (h != null) d.style.height = h + "px";
    if (html) d.innerHTML = html;
    (parent || stage).append(d);
    return d;
  }
  // A full-stage container (a "world" a camera can move, or an overlay).
  function layer(parent) { const d = document.createElement("div"); d.className = "m-layer"; (parent || stage).append(d); return d; }
  function show(d, o) { d.style.opacity = o; d.style.visibility = o <= 0.001 ? "hidden" : "visible"; }
  // Top-left at (x, y), scaled by s around its centre, opacity o, turned r degrees.
  function put(d, x, y, s = 1, o = 1, r = 0) {
    d.style.transform = `translate(${x}px, ${y}px)` + (s !== 1 ? ` scale(${s})` : "") + (r ? ` rotate(${r}deg)` : "");
    show(d, o);
  }

  // ---------------------------------------------------------------- camera
  // keys: [[t, cx, cy, s, easing]...]: the world point (cx, cy) is shown at view (default: the middle under the
  // captions) at scale s. toScreen(t, x, y) gives where a world point is on the stage at t.
  function camera(world, keys, view = [W / 2, 628]) {
    const f = track(keys.map(([t, cx, cy, s, e]) => [t, [cx, cy, s], e]));
    const at = t => { const [cx, cy, s] = f(t); return { s, tx: view[0] - cx * s, ty: view[1] - cy * s }; };
    return {
      at,
      toScreen(t, x, y) { const c = at(t); return [c.tx + x * c.s, c.ty + y * c.s]; },
      apply(t, o = 1) { const c = at(t); world.style.transform = `translate(${c.tx}px, ${c.ty}px) scale(${c.s})`; show(world, o); },
    };
  }

  // ---------------------------------------------------------------- pointer
  // moves: [{ a, b, to }]: during [a, b] the pointer goes to `to`, an [x, y] on the stage or a function t -> [x, y]
  // (so it stays on something a camera is moving). start: where it is first. clicks: [t...]. holds: [[a, b]...]
  // (the button is held, as when dragging; letting go shows a ripple too).
  const ARROW = '<svg viewBox="0 0 24 24" width="56" height="56"><path d="M3 2 L3 19 L7.5 14.8 L10.6 21.6 L13.6 20.3 L10.6 13.6 L16.8 13.6 Z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  function cursor(parent, { start, moves, clicks = [], holds = [] }) {
    const ripple = el(parent, "m-ripple");
    const c = el(parent, "m-cursor", ARROW);
    const pos = (p, t) => (typeof p === "function" ? p(t) : p);
    function at(t) {
      let i = -1;
      while (i + 1 < moves.length && moves[i + 1].a <= t) i++;
      if (i < 0) return pos(start, t);
      const to = pos(moves[i].to, t), u = k(t, moves[i].a, moves[i].b);
      if (u >= 1) return to;
      const from = pos(i === 0 ? start : moves[i - 1].to, t);
      const e = ease.inOut(u), dx = to[0] - from[0], dy = to[1] - from[1], bend = Math.sin(Math.PI * u) * 0.07;
      return [from[0] + dx * e - dy * bend, from[1] + dy * e + dx * bend];
    }
    const held = t => holds.some(([a, b]) => t >= a && t <= b);
    function render(t, o = 1) {
      const [x, y] = at(t);
      const pressed = held(t) || clicks.some(ct => t >= ct - 0.05 && t <= ct + 0.1);
      c.style.transform = `translate(${x - 7}px, ${y - 4.7}px) scale(${pressed ? 0.86 : 1})`;
      show(c, o);
      let last = -1;
      for (const e of clicks.concat(holds.map(h => h[1]))) if (e <= t && t - e < 0.5 && e > last) last = e;
      if (last >= 0) {
        const [rx, ry] = at(last), p = (t - last) / 0.5;
        ripple.style.transform = `translate(${rx}px, ${ry}px) scale(${0.3 + ease.out(p) * 1.1})`;
        show(ripple, (1 - p) * o);
      } else show(ripple, 0);
    }
    // How fast it moves (px per second), e.g. to tilt what it carries.
    const velocity = t => { const a = at(t - 1 / 60), b = at(t); return [(b[0] - a[0]) * 60, (b[1] - a[1]) * 60]; };
    return { at, render, velocity, held };
  }

  // ---------------------------------------------------------------- words
  // items: [{ a, b, main, sub }]; main and sub are HTML (<b> for the accent colour). One that starts at 0 is
  // already in place on the first frame (the first frame is the thumbnail on X).
  function captions(parent, items) {
    const box = el(parent, "m-cap");
    let shown = null;
    return t => {
      const it = items.find(c => t >= c.a && t < c.b);
      if (!it) { show(box, 0); return; }
      if (shown !== it) { box.innerHTML = `<div class="m-cap-main">${it.main}</div>` + (it.sub ? `<div class="m-cap-sub">${it.sub}</div>` : ""); shown = it; }
      const i = it.a <= 0 ? 1 : ease.out(k(t, it.a, it.a + 0.3)), o = 1 - k(t, it.b - 0.18, it.b);
      box.style.transform = `translateY(${(1 - i) * 18}px)`;
      show(box, Math.min(i, o));
    };
  }
  const shade = parent => el(parent, "m-shade");
  const chip = (parent, html) => el(parent, "m-chip", html);
  // Text being typed: the first characters of text, at cps characters a second from a.
  const typed = (text, t, a, cps = 12) => Array.from(text).slice(0, Math.max(0, Math.floor((t - a) * cps))).join("");
  const caret = t => (Math.floor(t * 2.4) % 2 === 0 ? 1 : 0);

  // The last card: the tool's name, what it does, a few points, the URL and a note. Returns (t, a) => draw
  // (it comes in from a).
  function endCard(parent, { title, tagline, points = [], url, note }) {
    const d = el(parent, "m-end", `<div class="m-end-title" data-m>${title}</div><div class="m-end-tag" data-m>${tagline}</div>`
      + (points.length ? `<div class="m-end-chips" data-m>${points.map(p => `<span>${p}</span>`).join("")}</div>` : "")
      + `<div class="m-end-url" data-m>${url}</div><div class="m-end-note" data-m>${note}</div>`);
    d.style.width = W + "px"; d.style.height = H + "px";
    const parts = [...d.querySelectorAll("[data-m]")];
    return (t, a) => {
      show(d, ease.out(k(t, a, a + 0.45)));
      parts.forEach((p, i) => { const x = ease.out(k(t, a + 0.08 + i * 0.1, a + 0.55 + i * 0.1)); p.style.transform = `translateY(${(1 - x) * 26}px)`; p.style.opacity = x; });
    };
  }

  // ---------------------------------------------------------------- playing
  function preview(duration, draw, start) {
    document.body.classList.add("m-preview");
    const bar = document.createElement("div");
    bar.className = "m-bar";
    bar.innerHTML = `<button type="button"></button><input type="range" min="0" max="${duration}" step="${1 / 60}"><span></span>`
      + `<select><option>1</option><option>0.5</option><option>0.25</option></select>`;
    document.body.append(bar);
    const [btn, range, label, speed] = bar.children;
    let t = start, playing = !params.has("t"), last = performance.now();
    const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / W, (innerHeight - 48) / H)})`; };
    const set = v => { t = clamp(v, 0, duration); range.value = t; label.textContent = `${t.toFixed(2)} / ${duration.toFixed(1)} s`; draw(t); };
    const play = on => { playing = on; btn.textContent = on ? "❚❚" : "▶"; last = performance.now(); };
    btn.onclick = () => { if (!playing && t >= duration) set(0); play(!playing); };
    range.oninput = () => { play(false); set(+range.value); };
    addEventListener("keydown", e => {
      if (e.key === " ") { e.preventDefault(); btn.onclick(); }
      if (e.key === "ArrowRight") { play(false); set(t + 1 / 30); }
      if (e.key === "ArrowLeft") { play(false); set(t - 1 / 30); }
    });
    addEventListener("resize", fit);
    const loop = now => {
      if (playing) { set(t + ((now - last) / 1000) * +speed.value); if (t >= duration) play(false); }
      last = now;
      requestAnimationFrame(loop);
    };
    fit(); play(playing); set(t); requestAnimationFrame(loop);
  }
  // Call once everything is built: render.js waits for window.__ready, then calls window.render(t) per frame.
  function setup({ duration, render }) {
    window.DURATION = duration;
    window.render = t => render(clamp(t, 0, duration));
    const start = +params.get("t") || 0;
    const waits = [document.fonts.ready].concat([...document.images].map(i => (i.decode ? i.decode().catch(() => {}) : null)));
    Promise.all(waits).then(() => {
      if (RENDER) { window.render(start); window.__ready = true; } else preview(duration, window.render, start);
    });
  }

  window.Motion = { W, H, stage, RENDER, clamp, k, lerp, ease, track, span, el, put, show, layer, camera, cursor, captions, chip, shade, typed, caret, endCard, setup };
})();
