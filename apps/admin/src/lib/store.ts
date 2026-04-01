import { readFile } from "node:fs/promises";
import path from "node:path";

export type Tenant = {
  tenant_id: string;
  name: string;
  bank_name: string;
  status: string;
  feature_flags: string[];
};

export type Account = {
  account_id: string;
  tenant_id: string;
  branch_id: string;
  player_id: string;
  customer_name: string;
  balance: number;
  cash_on_hand: number;
  outstanding_fine: number;
  loan_balance: number;
  status: string;
};

export type Card = {
  card_id: string;
  account_id: string;
  card_number: string;
  state: string;
};

export type Fine = {
  fine_id: string;
  account_id: string;
  amount: number;
  reference: string;
  status: string;
};

export type Loan = {
  loan_id: string;
  account_id: string;
  balance: number;
  terms: string;
  status: string;
};

export type AuditLog = {
  audit_id: string;
  tenant_id: string;
  region_id: string;
  branch_id: string;
  object_id: string;
  object_type: string;
  actor_name: string;
  target_account_id: string;
  action: string;
  status: string;
  amount?: number;
  memo?: string;
};

export type VaultIncident = {
  incident_id: string;
  tenant_id: string;
  region_id: string;
  branch_id: string;
  vault_id: string;
  state: string;
  stage: string;
  actor_name: string;
  responding_unit: string;
  marked_cash_flag: boolean;
  last_update: string;
};

export type Transaction = {
  transaction_id: string;
  account_id: string;
  type: string;
  amount: number;
  direction: string;
  memo: string;
};

export type PlatformStore = {
  tenants: Tenant[];
  accounts: Account[];
  cards: Card[];
  fines: Fine[];
  loans: Loan[];
  audit_logs: AuditLog[];
  vault_incidents: VaultIncident[];
  transactions: Transaction[];
};

const storePath = path.join(
  process.cwd(),
  "..",
  "..",
  "services",
  "api",
  "data",
  "store.json"
);

export async function loadStore(): Promise<PlatformStore> {
  const raw = await readFile(storePath, "utf8");
  return JSON.parse(raw) as PlatformStore;
}

export function formatLinden(amount: number): string {
  return `L$${amount.toLocaleString("en-US")}`;
}
