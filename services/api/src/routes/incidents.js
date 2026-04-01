import { incidents } from "../data/mockData.js";
import { sendJson } from "../lib/sendJson.js";

export function handleIncidents(_req, res) {
  sendJson(res, 200, {
    ok: true,
    data: incidents
  });
}
