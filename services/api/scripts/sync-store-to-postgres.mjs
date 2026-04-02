import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../src/config.js";
import { closePostgresStore, writePostgresStore } from "../src/data/postgresStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storePath = path.resolve(__dirname, "../data/store.json");

if (!config.databaseUrl) {
  console.error("DATABASE_URL is required for db:sync");
  process.exit(1);
}

const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
await writePostgresStore(config.databaseUrl, store);
await closePostgresStore();
console.log("Synced JSON store to Postgres.");
