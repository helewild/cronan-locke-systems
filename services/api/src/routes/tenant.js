import { getCollection } from "../data/store.js";
import { sendJson } from "../lib/sendJson.js";

export function handleTenantSummary(_req, res) {
  const tenants = getCollection("tenants");
  const regions = getCollection("regions");
  const branches = getCollection("branches");

  sendJson(res, 200, {
    ok: true,
    data: {
      tenant: tenants[0] || null,
      regions,
      branches
    }
  });
}
