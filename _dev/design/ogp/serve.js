// A tiny static server for the folder that holds the repositories side by side (no dependencies).
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".json": "application/json" };

/** Serves `root` on a free port; resolves to { url, close }. */
function serve(root) {
  const server = http.createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () =>
    resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() })));
}

module.exports = { serve };
