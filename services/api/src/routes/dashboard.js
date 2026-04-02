import { getCollection } from "../data/store.js";
import { sendJson } from "../lib/sendJson.js";

export async function handleDashboard(_req, res) {
  const [tenants, accounts, cards, incidents, fines, loans] = await Promise.all([
    getCollection("tenants"),
    getCollection("accounts"),
    getCollection("cards"),
    getCollection("vault_incidents"),
    getCollection("fines"),
    getCollection("loans")
  ]);

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
