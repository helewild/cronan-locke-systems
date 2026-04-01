export const tenantSummary = {
  tenant_id: "demo-tenant",
  region_id: "demo-region",
  branch_id: "main-branch",
  bank_name: "Whispering Pines Bank"
};

export const accounts = [
  {
    account_id: "WPB-ACCT-10001",
    customer_name: "Xander Evergarden",
    balance: 2845,
    card_state: "ACTIVE",
    outstanding_fine: 75,
    loan_balance: 225
  }
];

export const incidents = [
  {
    incident_id: "WPB-VLT-40001",
    tenant_id: "demo-tenant",
    region_id: "demo-region",
    branch_id: "main-branch",
    vault_id: "vault-001",
    state: "ACTIVE",
    stage: "BREACH STARTED",
    actor_name: "Unknown Suspect",
    responding_unit: "NONE",
    marked_cash_flag: false,
    last_update: "Silent alert received"
  }
];
