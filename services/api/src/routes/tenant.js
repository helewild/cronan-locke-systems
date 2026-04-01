import { tenantSummary } from "../data/mockData.js";
import { sendJson } from "../lib/sendJson.js";

export function handleTenantSummary(_req, res) {
  sendJson(res, 200, {
    ok: true,
    data: tenantSummary
  });
}
