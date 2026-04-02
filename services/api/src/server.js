import http from "node:http";
import { config } from "./config.js";
import { handleAccounts } from "./routes/accounts.js";
import { handleActionRequest } from "./routes/actions.js";
import { handleAuditLogs } from "./routes/auditLogs.js";
import { handleCards } from "./routes/cards.js";
import { handleDashboard } from "./routes/dashboard.js";
import { handleHealth } from "./routes/health.js";
import { handleIncidentAction } from "./routes/incidentActions.js";
import { handleIncidents } from "./routes/incidents.js";
import { handlePortal } from "./routes/portal.js";
import { handleTransactions } from "./routes/statements.js";
import { handleTenantSummary } from "./routes/tenant.js";
import { handleTenants } from "./routes/tenants.js";
import { sendJson } from "./lib/sendJson.js";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return await handleHealth(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/v1/tenant") {
    return await handleTenantSummary(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/v1/tenants") {
    return await handleTenants(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/v1/dashboard") {
    return await handleDashboard(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/v1/accounts") {
    return await handleAccounts(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/v1/cards") {
    return await handleCards(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/v1/transactions") {
    return await handleTransactions(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/v1/incidents") {
    return await handleIncidents(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/v1/audit-logs") {
    return await handleAuditLogs(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/v1/incidents/action") {
    return await handleIncidentAction(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/v1/actions") {
    return await handleActionRequest(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/v1/portal") {
    return await handlePortal(req, res);
  }

  return sendJson(res, 404, {
    ok: false,
    message: "Not found"
  });
});

server.listen(config.port, () => {
  console.log(`${config.apiName} listening on port ${config.port}`);
});
