import http from "node:http";
import { config } from "./config.js";
import { handleAccounts } from "./routes/accounts.js";
import { handleHealth } from "./routes/health.js";
import { handleIncidents } from "./routes/incidents.js";
import { handleTenantSummary } from "./routes/tenant.js";
import { sendJson } from "./lib/sendJson.js";

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return handleHealth(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/v1/tenant") {
    return handleTenantSummary(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/v1/accounts") {
    return handleAccounts(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/v1/incidents") {
    return handleIncidents(req, res);
  }

  return sendJson(res, 404, {
    ok: false,
    message: "Not found"
  });
});

server.listen(config.port, () => {
  console.log(`${config.apiName} listening on port ${config.port}`);
});
