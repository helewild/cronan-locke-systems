import { getCollection } from "../data/store.js";
import { sendJson } from "../lib/sendJson.js";

export function handleDashboard(_req, res) {
  const tenants = getCollection("tenants");
  const accounts = getCollection("accounts");
  const cards = getCollection("cards");
  const incidents = getCollection("vault_incidents");
  const fines = getCollection("fines");
  const loans = getCollection("loans");

  sendJson(res, 200, {
    ok: true,
    data: {
      tenants: tenants.length,
      accounts: accounts.length,
      cards: cards.length,
      active_incidents: incidents.filter((incident) => incident.state === "ACTIVE").length,
      due_fines: fines.filter((fine) => fine.status === "DUE").length,
      active_loans: loans.filter((loan) => loan.status === "ACTIVE").length
    }
  });
}
