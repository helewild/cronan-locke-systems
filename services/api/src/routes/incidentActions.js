import { getCollection, replaceIncident } from "../data/store.js";
import { readBody } from "../lib/readBody.js";
import { sendJson } from "../lib/sendJson.js";

export async function handleIncidentAction(req, res) {
  let body;
  const incidents = getCollection("vault_incidents");

  try {
    body = await readBody(req);
  } catch (_error) {
    sendJson(res, 400, {
      ok: false,
      message: "Invalid JSON body"
    });
    return;
  }

  const incidentId = body.incident_id;
  const action = body.action;
  const officerName = body.officer_name || "Unknown Officer";
  const current = incidents.find((incident) => incident.incident_id === incidentId);

  if (!incidentId || !action || !current) {
    sendJson(res, 400, {
      ok: false,
      message: "incident_id and valid action are required"
    });
    return;
  }

  let updates = {};

  if (action === "incident_acknowledged") {
    updates = {
      last_update: "Alert acknowledged by " + officerName
    };
  } else if (action === "incident_dispatched") {
    updates = {
      stage: "UNIT DISPATCHED",
      responding_unit: body.responding_unit || "Unit 12",
      last_update: (body.responding_unit || "Unit 12") + " dispatched by " + officerName
    };
  } else if (action === "incident_unit_arrived") {
    updates = {
      stage: "UNIT ON SCENE",
      last_update: (current.responding_unit || "Unit 12") + " arrived on scene"
    };
  } else if (action === "incident_resolved") {
    updates = {
      state: "RESOLVED",
      stage: "SCENE CLEARED",
      marked_cash_flag: true,
      last_update: "Incident resolved by " + officerName
    };
  } else {
    sendJson(res, 400, {
      ok: false,
      message: "Unsupported incident action"
    });
    return;
  }

  const updated = replaceIncident(incidentId, updates);

  sendJson(res, 200, {
    ok: true,
    action,
    data: updated
  });
}
