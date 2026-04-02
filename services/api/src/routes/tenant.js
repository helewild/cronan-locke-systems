import { getCollection } from "../data/store.js";
import { sendJson } from "../lib/sendJson.js";

export async function handleTenantSummary(_req, res) {
  const [tenants, regions, branches] = await Promise.all([
    getCollection("tenants"),
    getCollection("regions"),
    getCollection("branches")
  ]);

  sendJson(res, 200, {
    ok: true,
    data: {
      tenant: tenants[0] || null,
      regions,
      branches
    }
  });
}
