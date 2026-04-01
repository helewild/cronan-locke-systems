import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storePath = path.resolve(__dirname, "../../data/store.json");

function readStore() {
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
}

function writeStore(data) {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2) + "\n");
}

export function getStore() {
  return readStore();
}

export function getCollection(name) {
  const store = readStore();
  return store[name] || [];
}

export function updateCollection(name, items) {
  const store = readStore();
  store[name] = items;
  writeStore(store);
  return store[name];
}

export function replaceIncident(incidentId, updates) {
  const store = readStore();
  const next = store.vault_incidents.map((incident) => {
    if (incident.incident_id !== incidentId) {
      return incident;
    }
    return { ...incident, ...updates };
  });
  store.vault_incidents = next;
  writeStore(store);
  return next.find((incident) => incident.incident_id === incidentId) || null;
}
