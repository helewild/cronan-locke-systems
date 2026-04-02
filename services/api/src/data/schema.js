export const STORE_TABLES = [
  {
    key: "tenants",
    table: "tenants",
    columns: [
      "tenant_id",
      "name",
      "bank_name",
      "status",
      "owner_avatar_name",
      "owner_username",
      "activation_code",
      "created_at",
      "feature_flags"
    ],
    jsonColumns: ["feature_flags"],
    defaults: {
      feature_flags: []
    }
  },
  {
    key: "users",
    table: "users",
    columns: [
      "user_id",
      "tenant_id",
      "username",
      "password_hash",
      "role",
      "avatar_name",
      "status",
      "session_token",
      "session_expires_at",
      "must_reset_password"
    ],
    booleanColumns: ["must_reset_password"],
    defaults: {
      must_reset_password: false
    }
  },
  {
    key: "regions",
    table: "regions",
    columns: ["region_id", "tenant_id", "name", "status"]
  },
  {
    key: "branches",
    table: "branches",
    columns: ["branch_id", "tenant_id", "region_id", "name", "status"]
  },
  {
    key: "players",
    table: "players",
    columns: ["player_id", "tenant_id", "avatar_name", "status"]
  },
  {
    key: "accounts",
    table: "accounts",
    columns: [
      "account_id",
      "tenant_id",
      "branch_id",
      "player_id",
      "customer_name",
      "balance",
      "cash_on_hand",
      "outstanding_fine",
      "loan_balance",
      "status"
    ],
    numberColumns: ["balance", "cash_on_hand", "outstanding_fine", "loan_balance"],
    defaults: {
      balance: 0,
      cash_on_hand: 0,
      outstanding_fine: 0,
      loan_balance: 0
    }
  },
  {
    key: "cards",
    table: "cards",
    columns: ["card_id", "account_id", "card_number", "state"]
  },
  {
    key: "transactions",
    table: "transactions",
    columns: ["transaction_id", "account_id", "type", "amount", "direction", "memo"],
    numberColumns: ["amount"],
    defaults: {
      amount: 0
    }
  },
  {
    key: "fines",
    table: "fines",
    columns: ["fine_id", "account_id", "amount", "reference", "status"],
    numberColumns: ["amount"],
    defaults: {
      amount: 0
    }
  },
  {
    key: "loans",
    table: "loans",
    columns: ["loan_id", "account_id", "balance", "terms", "status"],
    numberColumns: ["balance"],
    defaults: {
      balance: 0
    }
  },
  {
    key: "audit_logs",
    table: "audit_logs",
    columns: [
      "audit_id",
      "tenant_id",
      "region_id",
      "branch_id",
      "object_id",
      "object_type",
      "actor_name",
      "target_account_id",
      "action",
      "status",
      "amount",
      "memo"
    ],
    numberColumns: ["amount"],
    defaults: {
      amount: 0
    }
  },
  {
    key: "vault_incidents",
    table: "vault_incidents",
    columns: [
      "incident_id",
      "tenant_id",
      "region_id",
      "branch_id",
      "vault_id",
      "state",
      "stage",
      "actor_name",
      "responding_unit",
      "marked_cash_flag",
      "last_update"
    ],
    booleanColumns: ["marked_cash_flag"],
    defaults: {
      marked_cash_flag: false
    }
  },
  {
    key: "atms",
    table: "atms",
    columns: ["atm_id", "tenant_id", "branch_name", "status", "scope"]
  }
];

export const CREATE_TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS tenants (
    tenant_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    status TEXT NOT NULL,
    owner_avatar_name TEXT,
    owner_username TEXT,
    activation_code TEXT,
    created_at TIMESTAMPTZ,
    feature_flags JSONB NOT NULL DEFAULT '[]'::jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    avatar_name TEXT,
    status TEXT NOT NULL,
    session_token TEXT,
    session_expires_at TIMESTAMPTZ,
    must_reset_password BOOLEAN NOT NULL DEFAULT FALSE
  )`,
  `CREATE TABLE IF NOT EXISTS regions (
    region_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS branches (
    branch_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    region_id TEXT,
    name TEXT NOT NULL,
    status TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS players (
    player_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    avatar_name TEXT NOT NULL,
    status TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS accounts (
    account_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    branch_id TEXT,
    player_id TEXT,
    customer_name TEXT NOT NULL,
    balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    cash_on_hand NUMERIC(18,2) NOT NULL DEFAULT 0,
    outstanding_fine NUMERIC(18,2) NOT NULL DEFAULT 0,
    loan_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cards (
    card_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    card_number TEXT NOT NULL,
    state TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS transactions (
    transaction_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    direction TEXT NOT NULL,
    memo TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS fines (
    fine_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    reference TEXT NOT NULL,
    status TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS loans (
    loan_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    terms TEXT,
    status TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    region_id TEXT,
    branch_id TEXT,
    object_id TEXT,
    object_type TEXT,
    actor_name TEXT,
    target_account_id TEXT,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    memo TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS vault_incidents (
    incident_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    region_id TEXT,
    branch_id TEXT,
    vault_id TEXT,
    state TEXT NOT NULL,
    stage TEXT NOT NULL,
    actor_name TEXT,
    responding_unit TEXT,
    marked_cash_flag BOOLEAN NOT NULL DEFAULT FALSE,
    last_update TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS atms (
    atm_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    branch_name TEXT,
    status TEXT NOT NULL,
    scope TEXT
  )`
];
