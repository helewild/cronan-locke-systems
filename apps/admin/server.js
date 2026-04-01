import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(3002, () => {
  console.log("Cronan & Locke Systems Admin listening on port 3002");
});
