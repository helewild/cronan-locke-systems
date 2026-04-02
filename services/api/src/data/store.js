import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { readPostgresStore, writePostgresStore } from "./postgresStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storePath = path.resolve(__dirname, "../../data/store.json");

function readJsonStore() {
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
}

function writeJsonStore(data) {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2) + "\n");
}

async function readStore() {
  if (config.storageBackend === "postgres" && config.databaseUrl) {
    return readPostgresStore(config.databaseUrl);
  }

  return readJsonStore();
}

async function writeStore(data) {
  if (config.storageBackend === "postgres" && config.databaseUrl) {
    await writePostgresStore(config.databaseUrl, data);
    return;
  }

  writeJsonStore(data);
}

export async function getStore() {
  return readStore();
}

export async function getCollection(name) {
  const store = await readStore();
  return store[name] || [];
}

export async function updateCollection(name, items) {
  const store = await readStore();
  store[name] = items;
  await writeStore(store);
  return store[name];
}

export { writeStore };

export async function replaceIncident(incidentId, updates) {
  const store = await readStore();
  const next = store.vault_incidents.map((incident) => {
    if (incident.incident_id !== incidentId) {
      return incident;
    }
    return { ...incident, ...updates };
  });
  store.vault_incidents = next;
  await writeStore(store);
  return next.find((incident) => incident.incident_id === incidentId) || null;
}
