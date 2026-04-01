import { getCollection } from "../data/store.js";
import { sendJson } from "../lib/sendJson.js";

export function handleTenants(_req, res) {
  sendJson(res, 200, {
    ok: true,
    data: getCollection("tenants")
  });
}
