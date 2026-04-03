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
      "payroll_default_amount",
      "primary_region_name",
      "feature_flags"
    ],
    jsonColumns: ["feature_flags"],
    numberColumns: ["payroll_default_amount"],
    defaults: {
      payroll_default_amount: 250,
      primary_region_name: "",
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
    key: "licenses",
    table: "licenses",
    columns: [
      "license_id",
      "tenant_id",
      "status",
      "buyer_avatar_name",
      "buyer_avatar_key",
      "setup_box_key",
      "marketplace_order_id",
      "issued_at",
      "renewed_at",
      "expires_at",
      "source"
    ],
    defaults: {
      buyer_avatar_name: "",
      buyer_avatar_key: "",
      setup_box_key: "",
      marketplace_order_id: "",
      issued_at: "",
      renewed_at: "",
      expires_at: "",
      source: "manual"
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
    key: "organizations",
    table: "organizations",
    columns: [
      "organization_id",
      "tenant_id",
      "name",
      "organization_type",
      "department_name",
      "treasury_account_id",
      "status",
      "created_at",
      "notes"
    ],
    defaults: {
      organization_type: "BUSINESS",
      department_name: "",
      treasury_account_id: "",
      status: "ACTIVE",
      created_at: "",
      notes: ""
    }
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
    key: "employments",
    table: "employments",
    columns: [
      "employment_id",
      "tenant_id",
      "account_id",
      "organization_id",
      "employer_name",
      "department_name",
      "title",
      "pay_rate",
      "pay_cycle",
      "status",
      "hired_at",
      "last_paid_at"
    ],
    numberColumns: ["pay_rate"],
    defaults: {
      organization_id: "",
      pay_rate: 0,
      pay_cycle: "WEEKLY",
      status: "ACTIVE",
      hired_at: "",
      last_paid_at: ""
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
    payroll_default_amount NUMERIC(18,2) NOT NULL DEFAULT 250,
    primary_region_name TEXT,
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
  `CREATE TABLE IF NOT EXISTS licenses (
    license_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    status TEXT NOT NULL,
    buyer_avatar_name TEXT,
    buyer_avatar_key TEXT,
    setup_box_key TEXT,
    marketplace_order_id TEXT,
    issued_at TIMESTAMPTZ,
    renewed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    source TEXT
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
  `CREATE TABLE IF NOT EXISTS organizations (
    organization_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    organization_type TEXT NOT NULL DEFAULT 'BUSINESS',
    department_name TEXT,
    treasury_account_id TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ,
    notes TEXT
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
  `CREATE TABLE IF NOT EXISTS employments (
    employment_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    organization_id TEXT,
    employer_name TEXT NOT NULL,
    department_name TEXT,
    title TEXT NOT NULL,
    pay_rate NUMERIC(18,2) NOT NULL DEFAULT 0,
    pay_cycle TEXT NOT NULL DEFAULT 'WEEKLY',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    hired_at TIMESTAMPTZ,
    last_paid_at TIMESTAMPTZ
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
  )`,
  `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payroll_default_amount NUMERIC(18,2) NOT NULL DEFAULT 250`,
  `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS primary_region_name TEXT`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS organization_type TEXT NOT NULL DEFAULT 'BUSINESS'`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS department_name TEXT`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS treasury_account_id TEXT`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notes TEXT`,
  `ALTER TABLE employments ADD COLUMN IF NOT EXISTS organization_id TEXT`,
  `ALTER TABLE licenses ADD COLUMN IF NOT EXISTS setup_box_key TEXT`,
  `ALTER TABLE licenses ADD COLUMN IF NOT EXISTS renewed_at TIMESTAMPTZ`,
  `ALTER TABLE licenses ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`
];
