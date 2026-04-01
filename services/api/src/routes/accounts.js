import { accounts } from "../data/mockData.js";
import { sendJson } from "../lib/sendJson.js";

export function handleAccounts(_req, res) {
  sendJson(res, 200, {
    ok: true,
    data: accounts
  });
}
