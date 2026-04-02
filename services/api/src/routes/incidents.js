import { getCollection } from "../data/store.js";
import { sendJson } from "../lib/sendJson.js";

export async function handleIncidents(_req, res) {
  sendJson(res, 200, {
    ok: true,
    data: await getCollection("vault_incidents")
  });
}
