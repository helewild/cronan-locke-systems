import { Pool } from "pg";
import { CREATE_TABLE_STATEMENTS, STORE_TABLES } from "./schema.js";

let pool;

function getPool(databaseUrl) {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl
    });
  }

  return pool;
}

export async function initPostgres(databaseUrl) {
  const activePool = getPool(databaseUrl);
  for (const statement of CREATE_TABLE_STATEMENTS) {
    await activePool.query(statement);
  }
}

function normalizeRow(row, definition) {
  const next = {};

  for (const column of definition.columns) {
    let value = row[column];

    if (typeof value === "undefined" || value === null) {
      if (definition.defaults && Object.prototype.hasOwnProperty.call(definition.defaults, column)) {
        value = definition.defaults[column];
      } else {
        value = null;
      }
    }

    if ((definition.jsonColumns || []).includes(column)) {
      next[column] = value ?? definition.defaults?.[column] ?? [];
      continue;
    }

    if ((definition.numberColumns || []).includes(column)) {
      next[column] = value === null ? (definition.defaults?.[column] ?? 0) : Number(value);
      continue;
    }

    if ((definition.booleanColumns || []).includes(column)) {
      next[column] = Boolean(value);
      continue;
    }

    next[column] = value;
  }

  return next;
}

export async function readPostgresStore(databaseUrl) {
  await initPostgres(databaseUrl);
  const activePool = getPool(databaseUrl);
  const store = {};

  for (const definition of STORE_TABLES) {
    const { rows } = await activePool.query(`SELECT * FROM ${definition.table}`);
    store[definition.key] = rows.map((row) => normalizeRow(row, definition));
  }

  return store;
}

function prepareValue(column, value, definition) {
  if ((definition.jsonColumns || []).includes(column)) {
    return JSON.stringify(value ?? definition.defaults?.[column] ?? []);
  }

  if ((definition.booleanColumns || []).includes(column)) {
    return Boolean(value);
  }

  if ((definition.numberColumns || []).includes(column)) {
    return Number(value ?? definition.defaults?.[column] ?? 0);
  }

  if (
    column === "created_at"
    || column === "session_expires_at"
    || column === "issued_at"
    || column === "product_key_issued_at"
    || column === "renewed_at"
    || column === "expires_at"
    || column === "hired_at"
    || column === "last_paid_at"
    || column === "requested_at"
    || column === "reviewed_at"
  ) {
    return value || null;
  }

  return typeof value === "undefined" ? null : value;
}

export async function writePostgresStore(databaseUrl, store) {
  await initPostgres(databaseUrl);
  const activePool = getPool(databaseUrl);
  const client = await activePool.connect();

  try {
    await client.query("BEGIN");

    for (const definition of [...STORE_TABLES].reverse()) {
      await client.query(`DELETE FROM ${definition.table}`);
    }

    for (const definition of STORE_TABLES) {
      const rows = Array.isArray(store[definition.key]) ? store[definition.key] : [];
      if (!rows.length) {
        continue;
      }

      const columns = definition.columns;
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
      const query = `INSERT INTO ${definition.table} (${columns.join(", ")}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = columns.map((column) => prepareValue(column, row[column], definition));
        await client.query(query, values);
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePostgresStore() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
