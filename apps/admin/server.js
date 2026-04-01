import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const apiBase = process.env.API_BASE || "http://127.0.0.1:3001";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:3002");

  if (url.pathname.startsWith("/api/")) {
    const upstream = await fetch(apiBase + url.pathname, {
      method: req.method,
      headers: { "Content-Type": "application/json" }
    });
    const body = await upstream.text();
    res.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(body);
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(3002, () => {
  console.log("Cronan & Locke Systems Admin listening on port 3002");
});
