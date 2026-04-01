import { config } from "../config.js";
import { sendJson } from "../lib/sendJson.js";

export function handleHealth(_req, res) {
  sendJson(res, 200, {
    ok: true,
    service: config.apiName,
    environment: config.nodeEnv
  });
}
