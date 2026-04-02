import crypto from "node:crypto";
import { config } from "../config.js";
import { getStore, writeStore } from "../data/store.js";
import { createAuditEntry } from "../lib/audit.js";
import { readBody } from "../lib/readBody.js";
import { sendJson } from "../lib/sendJson.js";
import { createTransaction } from "../lib/transactions.js";

function hashPassword(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function createToken() {
  return crypto.randomUUID().replaceAll("-", "");
}

function isActive(value) {
  return String(value || "").trim().toUpperCase() === "ACTIVE";
}

function ensureUsers(store) {
  if (!Array.isArray(store.users)) {
    store.users = [];
  }
}

function ensureLicenses(store) {
  if (!Array.isArray(store.licenses)) {
    store.licenses = [];
  }
}

const ROLE_PERMISSIONS = {
  platform_admin: [
    "view_platform",
    "view_bank_core",
    "view_accounts",
    "view_staff",
    "view_cards",
    "view_transactions",
    "view_fines",
    "view_loans",
    "view_vault_control",
    "view_incidents",
    "view_payroll",
    "view_atm_network",
    "view_audit_logs",
    "manage_tenant",
    "create_tenant",
    "suspend_tenant",
    "activate_tenant",
    "create_staff_user",
    "disable_staff_user",
    "enable_staff_user",
    "reset_staff_session",
    "create_customer_account",
    "deposit_account",
    "withdraw_account",
    "freeze_account",
    "unfreeze_account",
    "lock_card",
    "unlock_card",
    "report_stolen_card",
    "pay_fine",
    "pay_loan",
    "run_payroll",
    "dispatch_police",
    "lock_vault",
    "shutdown_atm_network"
  ],
  tenant_owner: [
    "view_bank_core",
    "view_accounts",
    "view_staff",
    "view_cards",
    "view_transactions",
    "view_fines",
    "view_loans",
    "view_vault_control",
    "view_incidents",
    "view_payroll",
    "view_atm_network",
    "view_audit_logs",
    "manage_tenant",
    "create_staff_user",
    "disable_staff_user",
    "enable_staff_user",
    "reset_staff_session",
    "create_customer_account",
    "deposit_account",
    "withdraw_account",
    "freeze_account",
    "unfreeze_account",
    "lock_card",
    "unlock_card",
    "report_stolen_card",
    "pay_fine",
    "pay_loan",
    "run_payroll",
    "dispatch_police",
    "lock_vault",
    "shutdown_atm_network"
  ],
  bank_admin: [
    "view_bank_core",
    "view_accounts",
    "view_cards",
    "view_transactions",
    "view_fines",
    "view_loans",
    "view_payroll",
    "view_audit_logs",
    "create_customer_account",
    "deposit_account",
    "withdraw_account",
    "freeze_account",
    "unfreeze_account",
    "lock_card",
    "unlock_card",
    "report_stolen_card",
    "pay_fine",
    "pay_loan",
    "run_payroll"
  ],
  teller: [
    "view_accounts",
    "view_cards",
    "view_transactions",
    "view_fines",
    "view_loans",
    "create_customer_account",
    "deposit_account",
    "withdraw_account",
    "lock_card",
    "report_stolen_card",
    "pay_fine",
    "pay_loan"
  ],
  security_admin: [
    "view_bank_core",
    "view_vault_control",
    "view_incidents",
    "view_atm_network",
    "view_audit_logs",
    "dispatch_police",
    "lock_vault",
    "shutdown_atm_network"
  ]
};

function buildPermissions(role) {
  const base = ROLE_PERMISSIONS[String(role || "").trim()] || [];
  return [...new Set(base)];
}

function getTenantAccountIds(store, tenantId) {
  return (store.accounts || [])
    .filter((account) => account.tenant_id === tenantId)
    .map((account) => account.account_id);
}

function buildTenantStore(store, tenantId) {
  if (tenantId === "platform-root") {
    return {
      scope_mode: "platform",
      tenants: (store.tenants || []).map((item) => ({ ...item })),
      users: (store.users || []).map((item) => ({
        user_id: item.user_id,
        tenant_id: item.tenant_id,
        username: item.username,
        role: item.role,
        avatar_name: item.avatar_name,
        status: item.status,
        must_reset_password: item.must_reset_password
      })),
      licenses: (store.licenses || []).map((item) => ({ ...item })),
      players: (store.players || []).map((item) => ({ ...item })),
      accounts: (store.accounts || []).map((item) => ({ ...item })),
      cards: (store.cards || []).map((item) => ({ ...item })),
      fines: (store.fines || []).map((item) => ({ ...item })),
      loans: (store.loans || []).map((item) => ({ ...item })),
      transactions: (store.transactions || []).map((item) => ({ ...item })),
      audit_logs: (store.audit_logs || []).map((item) => ({ ...item })),
      vault_incidents: (store.vault_incidents || []).map((item) => ({ ...item })),
      branches: (store.branches || []).map((item) => ({ ...item })),
      regions: (store.regions || []).map((item) => ({ ...item })),
      atms: (store.atms || []).map((item) => ({ ...item }))
    };
  }

  const accountIds = new Set(getTenantAccountIds(store, tenantId));
  const accounts = (store.accounts || []).filter((item) => item.tenant_id === tenantId);
  const users = (store.users || [])
    .filter((item) => item.tenant_id === tenantId)
    .map((item) => ({
      user_id: item.user_id,
      tenant_id: item.tenant_id,
      username: item.username,
      role: item.role,
      avatar_name: item.avatar_name,
      status: item.status,
      must_reset_password: item.must_reset_password
    }));

  return {
    tenants: (store.tenants || []).filter((item) => item.tenant_id === tenantId),
    users,
    licenses: (store.licenses || []).filter((item) => item.tenant_id === tenantId),
    accounts,
    cards: (store.cards || []).filter((item) => accountIds.has(item.account_id)),
    fines: (store.fines || []).filter((item) => accountIds.has(item.account_id)),
    loans: (store.loans || []).filter((item) => accountIds.has(item.account_id)),
    transactions: (store.transactions || []).filter((item) => accountIds.has(item.account_id)),
    audit_logs: (store.audit_logs || []).filter((item) => item.tenant_id === tenantId),
    vault_incidents: (store.vault_incidents || []).filter((item) => item.tenant_id === tenantId),
    branches: (store.branches || []).filter((item) => item.tenant_id === tenantId),
    regions: (store.regions || []).filter((item) => item.tenant_id === tenantId),
    atms: (store.atms || []).filter((item) => item.tenant_id === tenantId)
  };
}

function findUserBySession(store, token, tenantId) {
  ensureUsers(store);
  const now = Date.now();

  return store.users.find((user) => {
    if (!isActive(user.status)) {
      return false;
    }
    if (String(user.session_token || "") !== String(token || "")) {
      return false;
    }
    if (String(user.tenant_id || "") !== String(tenantId || "")) {
      return false;
    }
    if (!user.session_expires_at) {
      return false;
    }
    return new Date(user.session_expires_at).getTime() > now;
  }) || null;
}

function requireSession(store, payload) {
  const user = findUserBySession(store, payload.token, payload.tenant_id);
  if (!user) {
    throw new Error("Invalid or expired session.");
  }
  return user;
}

function requireOwner(user) {
  if (String(user.role || "").trim() !== "tenant_owner") {
    throw new Error("Tenant owner permission required.");
  }
}

function requirePermission(user, permission) {
  const permissions = buildPermissions(user.role);
  if (!permissions.includes(permission)) {
    throw new Error("Permission denied.");
  }
}

function findAccount(store, tenantId, accountId) {
  return (store.accounts || []).find((account) => account.tenant_id === tenantId && account.account_id === accountId) || null;
}

function findIncident(store, tenantId, incidentId) {
  return (store.vault_incidents || []).find((incident) => incident.tenant_id === tenantId && incident.incident_id === incidentId) || null;
}

function findCard(store, tenantId, cardId) {
  const accountIds = new Set(getTenantAccountIds(store, tenantId));
  return (store.cards || []).find((card) => accountIds.has(card.account_id) && card.card_id === cardId) || null;
}

function findFine(store, tenantId, fineId) {
  const accountIds = new Set(getTenantAccountIds(store, tenantId));
  return (store.fines || []).find((fine) => accountIds.has(fine.account_id) && fine.fine_id === fineId) || null;
}

function findLoan(store, tenantId, loanId) {
  const accountIds = new Set(getTenantAccountIds(store, tenantId));
  return (store.loans || []).find((loan) => accountIds.has(loan.account_id) && loan.loan_id === loanId) || null;
}

function findUserById(store, tenantId, userId) {
  return (store.users || []).find((item) => item.tenant_id === tenantId && item.user_id === userId) || null;
}

function findTenant(store, tenantId) {
  return (store.tenants || []).find((item) => item.tenant_id === tenantId) || null;
}

function findLicenseBySetupBox(store, setupBoxKey) {
  return (store.licenses || []).find((item) => String(item.setup_box_key || "") === String(setupBoxKey || "")) || null;
}

function buildRegistrationResponse(store, tenantId, licenseId) {
  const tenant = findTenant(store, tenantId);
  return {
    ok: true,
    tenant_id: tenantId,
    activation_code: tenant?.activation_code || "",
    license_id: licenseId || "",
    admin_url: config.adminBaseUrl || "",
    message: "Tenant registered from setup box."
  };
}

function nextId(prefix, values) {
  const numeric = values
    .map((value) => Number(String(value || "").replace(prefix, "")))
    .filter((value) => Number.isFinite(value));
  const next = (numeric.length ? Math.max(...numeric) : 10000) + 1;
  return prefix + String(next);
}

function nextTenantId(store) {
  const numeric = (store.tenants || [])
    .map((item) => Number(String(item.tenant_id || "").replace("tenant-", "")))
    .filter((value) => Number.isFinite(value));
  const next = (numeric.length ? Math.max(...numeric) : 1000) + 1;
  return "tenant-" + String(next);
}

function nextLicenseId(store) {
  const numeric = (store.licenses || [])
    .map((item) => Number(String(item.license_id || "").replace("LIC-", "")))
    .filter((value) => Number.isFinite(value));
  const next = (numeric.length ? Math.max(...numeric) : 10000) + 1;
  return "LIC-" + String(next);
}

function appendPortalAudit(store, actorName, tenantId, objectType, objectId, targetAccountId, action, amount, memo) {
  createAuditEntry(store, {
    tenant_id: tenantId,
    region_id: "demo-region",
    branch_id: "main-branch",
    object_type: objectType,
    object_id: objectId,
    actor_name: actorName,
    target_account_id: targetAccountId || null,
    action,
    amount: amount || 0,
    memo: memo || ""
  });
}

async function login(store, payload) {
  ensureUsers(store);
  const user = store.users.find((item) =>
    String(item.username || "").trim() === String(payload.username || "").trim()
    && String(item.password_hash || "") === hashPassword(payload.password)
    && isActive(item.status)
  );

  if (!user) {
    return { ok: false, error: "Invalid username or password." };
  }

  user.session_token = createToken();
  user.session_expires_at = new Date(Date.now() + (12 * 60 * 60 * 1000)).toISOString();
  await writeStore(store);

  return {
    ok: true,
    session: {
      username: user.username,
      role: user.role,
      tenant_id: user.tenant_id,
      token: user.session_token,
      permissions: buildPermissions(user.role),
      must_reset_password: Boolean(user.must_reset_password)
    },
    store: buildTenantStore(store, user.tenant_id)
  };
}

async function activateOwner(store, payload) {
  ensureUsers(store);
  ensureLicenses(store);
  const tenant = (store.tenants || []).find((item) => item.activation_code === payload.activation_code);

  if (!tenant) {
    return { ok: false, error: "Activation code not recognized." };
  }

  if (String(tenant.owner_username || "").trim()) {
    return { ok: false, error: "Activation code has already been used." };
  }

  if ((store.users || []).some((user) => user.tenant_id === tenant.tenant_id && String(user.role || "").trim() === "tenant_owner")) {
    return { ok: false, error: "Tenant owner account already exists." };
  }

  if (store.users.some((user) => String(user.username || "").trim().toLowerCase() === String(payload.username || "").trim().toLowerCase())) {
    return { ok: false, error: "Username is already in use." };
  }

  store.users.push({
    user_id: "USR-" + String(store.users.length + 10001),
    tenant_id: tenant.tenant_id,
    username: payload.username,
    password_hash: hashPassword(payload.password),
    role: "tenant_owner",
    avatar_name: payload.avatar_name || "",
    status: "ACTIVE",
    session_token: "",
    session_expires_at: "",
    must_reset_password: false
  });

  tenant.owner_username = payload.username;
  tenant.owner_avatar_name = payload.avatar_name || tenant.owner_avatar_name || "";
  tenant.activation_code = "";

  const license = (store.licenses || []).find((item) => item.tenant_id === tenant.tenant_id);
  if (license && !license.buyer_avatar_name) {
    license.buyer_avatar_name = payload.avatar_name || payload.username;
  }

  appendPortalAudit(store, payload.avatar_name || payload.username, tenant.tenant_id, "website", "owner-activation", null, "owner_activate", 0, "Owner account created");
  await writeStore(store);

  return {
    ok: true,
    message: "Owner account activated."
  };
}

function dashboard(store, payload) {
  const user = requireSession(store, payload);
  return {
    ok: true,
    session: {
      username: user.username,
      role: user.role,
      tenant_id: user.tenant_id,
      token: user.session_token,
      permissions: buildPermissions(user.role),
      must_reset_password: Boolean(user.must_reset_password)
    },
    store: buildTenantStore(store, user.tenant_id)
  };
}

function updateAccountBalance(store, tenantId, actorName, accountId, delta, label) {
  const account = findAccount(store, tenantId, accountId);
  if (!account) {
    throw new Error("Account not found.");
  }
  if (!isActive(account.status)) {
    throw new Error("Account is not active.");
  }
  if (!delta || delta <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
  if (label === "WITHDRAW" && Number(account.balance || 0) < delta) {
    throw new Error("Insufficient funds for withdrawal.");
  }

  account.balance = Number(account.balance || 0) + (label === "WITHDRAW" ? -delta : delta);

  createTransaction(store, {
    account_id: account.account_id,
    type: label === "WITHDRAW" ? "WITHDRAWAL" : "DEPOSIT",
    amount: delta,
    direction: label === "WITHDRAW" ? "OUT" : "IN",
    memo: label + " via VPS admin"
  });

  appendPortalAudit(
    store,
    actorName,
    tenantId,
    "account",
    account.account_id,
    account.account_id,
    label === "WITHDRAW" ? "account_withdraw" : "account_deposit",
    delta,
    label + " via VPS admin"
  );
}

function updateAccountStatus(store, tenantId, actorName, accountId, status) {
  const account = findAccount(store, tenantId, accountId);
  if (!account) {
    throw new Error("Account not found.");
  }

  account.status = status;
  appendPortalAudit(
    store,
    actorName,
    tenantId,
    "account",
    account.account_id,
    account.account_id,
    status === "ACTIVE" ? "account_unfreeze" : "account_freeze",
    0,
    "Status changed to " + status
  );
}

function dispatchPolice(store, tenantId, actorName, incidentId) {
  const incident = findIncident(store, tenantId, incidentId);
  if (!incident) {
    throw new Error("No matching incident found to dispatch.");
  }
  incident.stage = "UNIT DISPATCHED";
  incident.responding_unit = "UNIT 12";
  incident.last_update = "Dispatch authorized by " + actorName;
  appendPortalAudit(store, actorName, tenantId, "incident", incident.incident_id, null, "incident_dispatch", 0, "Unit 12 dispatched");
}

function lockVault(store, tenantId, actorName, incidentId) {
  const incident = findIncident(store, tenantId, incidentId);
  if (!incident) {
    throw new Error("No matching incident found to lock down.");
  }
  incident.stage = "LOCKDOWN TRIGGERED";
  incident.last_update = "Vault lockdown authorized by " + actorName;
  appendPortalAudit(store, actorName, tenantId, "vault", incident.vault_id, null, "vault_lockdown", 0, "Lockdown triggered from web terminal");
}

function shutdownAtmNetwork(store, tenantId, actorName) {
  let touched = 0;
  (store.atms || []).forEach((atm) => {
    if (atm.tenant_id === tenantId) {
      atm.status = "OFFLINE";
      touched += 1;
    }
  });
  if (!touched) {
    throw new Error("No ATM records found for this tenant.");
  }
  appendPortalAudit(store, actorName, tenantId, "atm_network", "tenant-atm-network", null, "atm_network_shutdown", 0, "ATM network shutdown requested for " + touched + " ATM(s)");
}

function runPayroll(store, tenantId, actorName, amountInput) {
  const tenant = findTenant(store, tenantId);
  const amount = Number(amountInput || tenant?.payroll_default_amount || 250);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  const accounts = (store.accounts || []).filter((account) => account.tenant_id === tenantId && isActive(account.status));
  if (!accounts.length) {
    throw new Error("No active accounts found for payroll.");
  }

  accounts.forEach((account) => {
    account.balance = Number(account.balance || 0) + amount;
    createTransaction(store, {
      account_id: account.account_id,
      type: "PAYROLL",
      amount,
      direction: "IN",
      memo: "VPS payroll run"
    });
    appendPortalAudit(store, actorName, tenantId, "payroll", "vps-payroll", account.account_id, "payroll_run", amount, "Payroll deposit");
  });
}

function updateTenantSettings(store, tenantId, actorName, payload) {
  const targetTenantId = String(payload.target_tenant_id || tenantId);
  const tenant = findTenant(store, targetTenantId);
  if (!tenant) {
    throw new Error("Tenant not found.");
  }

  const nextTenantName = String(payload.tenant_name || tenant.name).trim();
  const nextBankName = String(payload.bank_name || tenant.bank_name).trim();
  const nextRegionName = String(payload.primary_region_name || tenant.primary_region_name || "").trim();
  const nextPayroll = Number(payload.payroll_default_amount ?? tenant.payroll_default_amount ?? 250);

  if (!nextTenantName || !nextBankName) {
    throw new Error("Tenant and bank name are required.");
  }
  if (!Number.isFinite(nextPayroll) || nextPayroll <= 0) {
    throw new Error("Payroll default must be greater than zero.");
  }

  tenant.name = nextTenantName;
  tenant.bank_name = nextBankName;
  tenant.primary_region_name = nextRegionName;
  tenant.payroll_default_amount = nextPayroll;

  const regions = (store.regions || []).filter((item) => item.tenant_id === targetTenantId);
  if (regions.length && nextRegionName) {
    regions[0].name = nextRegionName;
  }

  const branches = (store.branches || []).filter((item) => item.tenant_id === targetTenantId);
  if (branches.length) {
    branches[0].name = nextBankName + " Main Branch";
  }

  (store.atms || []).forEach((atm) => {
    if (atm.tenant_id === targetTenantId) {
      atm.scope = nextTenantName;
    }
  });

  appendPortalAudit(store, actorName, targetTenantId, "tenant", targetTenantId, null, "tenant_settings_update", nextPayroll, "Tenant settings updated");
}

function createTenant(store, actorName, payload) {
  ensureLicenses(store);
  const tenantName = String(payload.tenant_name || "").trim();
  const bankName = String(payload.bank_name || "").trim();
  const regionName = String(payload.primary_region_name || "").trim();
  const payrollDefault = Number(payload.payroll_default_amount || 250);
  const licenseStatus = String(payload.license_status || "TRIAL").trim().toUpperCase();

  if (!tenantName || !bankName) {
    throw new Error("Tenant and bank name are required.");
  }
  if (!Number.isFinite(payrollDefault) || payrollDefault <= 0) {
    throw new Error("Payroll default must be greater than zero.");
  }

  const tenantId = nextTenantId(store);
  const regionId = tenantId + "-region";
  const branchId = tenantId + "-branch";
  const activationCode = "ACT-" + String(tenantId).replace("tenant-", "").padStart(6, "0");
  const licenseId = nextLicenseId(store);

  store.tenants.push({
    tenant_id: tenantId,
    name: tenantName,
    bank_name: bankName,
    status: "ACTIVE",
    owner_avatar_name: "",
    owner_username: "",
    activation_code: activationCode,
    created_at: new Date().toISOString(),
    payroll_default_amount: payrollDefault,
    primary_region_name: regionName || tenantName,
    feature_flags: [
      "base_banking",
      "justice_and_fines",
      "loans_and_credit",
      "crime_and_security"
    ]
  });

  store.licenses.push({
    license_id: licenseId,
    tenant_id: tenantId,
    status: licenseStatus,
    buyer_avatar_name: String(payload.owner_avatar_name || "").trim(),
    buyer_avatar_key: String(payload.buyer_avatar_key || "").trim(),
    setup_box_key: String(payload.setup_box_key || "").trim(),
    marketplace_order_id: String(payload.marketplace_order_id || "").trim(),
    issued_at: new Date().toISOString(),
    source: String(payload.license_source || "platform_console").trim()
  });

  if (!Array.isArray(store.regions)) {
    store.regions = [];
  }
  if (!Array.isArray(store.branches)) {
    store.branches = [];
  }
  if (!Array.isArray(store.atms)) {
    store.atms = [];
  }

  store.regions.push({
    region_id: regionId,
    tenant_id: tenantId,
    name: regionName || tenantName,
    status: "ACTIVE"
  });

  store.branches.push({
    branch_id: branchId,
    tenant_id: tenantId,
    region_id: regionId,
    name: bankName + " Main Branch",
    status: "ACTIVE"
  });

  appendPortalAudit(store, actorName, tenantId, "tenant", tenantId, null, "tenant_create", payrollDefault, "Tenant created from platform console");
  return { tenantId, activationCode, licenseId };
}

async function registerTenantBox(store, payload) {
  if (config.setupBoxSecret && String(payload.setup_secret || "").trim() !== String(config.setupBoxSecret).trim()) {
    throw new Error("Invalid setup box secret.");
  }

  if (!String(payload.buyer_avatar_name || "").trim()) {
    throw new Error("Buyer avatar name is required.");
  }

  ensureLicenses(store);

  if (String(payload.setup_box_key || "").trim()) {
    const existingLicense = findLicenseBySetupBox(store, payload.setup_box_key);
    if (existingLicense) {
      return buildRegistrationResponse(store, existingLicense.tenant_id, existingLicense.license_id);
    }
  }

  const actorName = String(payload.buyer_avatar_name || "Marketplace Buyer").trim() || "Marketplace Buyer";
  const created = createTenant(store, actorName, {
    tenant_name: payload.tenant_name || payload.buyer_avatar_name || "New Tenant",
    bank_name: payload.bank_name || ((payload.tenant_name || payload.buyer_avatar_name || "New Tenant") + " Bank"),
    primary_region_name: payload.primary_region_name || payload.tenant_name || payload.buyer_avatar_name || "New Region",
    payroll_default_amount: Number(payload.payroll_default_amount || 250),
    owner_avatar_name: payload.buyer_avatar_name || "",
    buyer_avatar_key: payload.buyer_avatar_key || "",
    setup_box_key: payload.setup_box_key || "",
    marketplace_order_id: payload.marketplace_order_id || "",
    license_status: "ACTIVE",
    license_source: "setup_box"
  });

  await writeStore(store);
  return buildRegistrationResponse(store, created.tenantId, created.licenseId);
}

function updateTenantStatus(store, actorName, targetTenantId, nextStatus) {
  const tenant = findTenant(store, targetTenantId);
  if (!tenant) {
    throw new Error("Tenant not found.");
  }

  tenant.status = nextStatus;
  appendPortalAudit(store, actorName, targetTenantId, "tenant", targetTenantId, null, nextStatus === "ACTIVE" ? "tenant_activate" : "tenant_suspend", 0, "Tenant status set to " + nextStatus);
}

function updateCardState(store, tenantId, actorName, cardId, nextState, action, memo) {
  const card = findCard(store, tenantId, cardId);
  if (!card) {
    throw new Error("Card not found.");
  }

  card.state = nextState;
  appendPortalAudit(store, actorName, tenantId, "card", card.card_id, card.account_id, action, 0, memo);
}

function payFine(store, tenantId, actorName, fineId) {
  const fine = findFine(store, tenantId, fineId);
  if (!fine) {
    throw new Error("Fine not found.");
  }
  if (String(fine.status || "").toUpperCase() !== "DUE") {
    throw new Error("Fine is not due.");
  }

  const account = findAccount(store, tenantId, fine.account_id);
  if (!account) {
    throw new Error("Linked account not found for fine.");
  }
  if (Number(account.balance || 0) < Number(fine.amount || 0)) {
    throw new Error("Insufficient funds to pay fine.");
  }

  account.balance = Number(account.balance || 0) - Number(fine.amount || 0);
  account.outstanding_fine = Math.max(0, Number(account.outstanding_fine || 0) - Number(fine.amount || 0));
  fine.status = "PAID";

  createTransaction(store, {
    account_id: account.account_id,
    type: "FINE_PAYMENT",
    amount: Number(fine.amount || 0),
    direction: "OUT",
    memo: "Fine " + fine.reference + " paid via VPS admin"
  });

  appendPortalAudit(store, actorName, tenantId, "fine", fine.fine_id, account.account_id, "fine_pay", Number(fine.amount || 0), "Fine paid from admin terminal");
}

function payLoan(store, tenantId, actorName, loanId, amountInput) {
  const loan = findLoan(store, tenantId, loanId);
  if (!loan) {
    throw new Error("Loan not found.");
  }
  if (String(loan.status || "").toUpperCase() !== "ACTIVE") {
    throw new Error("Loan is not active.");
  }

  const amount = Number(amountInput || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Loan payment amount must be greater than zero.");
  }

  const account = findAccount(store, tenantId, loan.account_id);
  if (!account) {
    throw new Error("Linked account not found for loan.");
  }
  if (Number(account.balance || 0) < amount) {
    throw new Error("Insufficient funds to pay loan.");
  }

  account.balance = Number(account.balance || 0) - amount;
  loan.balance = Math.max(0, Number(loan.balance || 0) - amount);
  account.loan_balance = Math.max(0, Number(account.loan_balance || 0) - amount);
  if (loan.balance === 0) {
    loan.status = "PAID";
  }

  createTransaction(store, {
    account_id: account.account_id,
    type: "LOAN_PAYMENT",
    amount,
    direction: "OUT",
    memo: "Loan payment via VPS admin"
  });

  appendPortalAudit(store, actorName, tenantId, "loan", loan.loan_id, account.account_id, "loan_pay", amount, "Loan payment from admin terminal");
}

async function changePassword(store, payload) {
  const user = requireSession(store, payload);
  const newPassword = String(payload.new_password || "");

  if (newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  user.password_hash = hashPassword(newPassword);
  user.must_reset_password = false;
  appendPortalAudit(store, user.username, user.tenant_id, "user", user.user_id, null, "password_change", 0, "Password changed from portal");
  await writeStore(store);

  return {
    ok: true,
    message: "Password updated.",
    session: {
      username: user.username,
      role: user.role,
      tenant_id: user.tenant_id,
      token: user.session_token,
      permissions: buildPermissions(user.role),
      must_reset_password: false
    },
    store: buildTenantStore(store, user.tenant_id)
  };
}

function createStaffUser(store, tenantId, actorName, payload) {
  const username = String(payload.new_username || "").trim();
  const avatarName = String(payload.new_avatar_name || "").trim();
  const role = String(payload.new_role || "").trim() || "bank_admin";
  const password = String(payload.new_password || "");

  if (!username || !avatarName || !password) {
    throw new Error("Username, avatar name, and password are required.");
  }
  if ((store.users || []).some((item) => String(item.username || "").trim().toLowerCase() === username.toLowerCase())) {
    throw new Error("Username already exists.");
  }

  const nextNumber = (store.users || []).length + 10001;
  const user = {
    user_id: "USR-" + String(nextNumber),
    tenant_id: tenantId,
    username,
    password_hash: hashPassword(password),
    role,
    avatar_name: avatarName,
    status: "ACTIVE",
    session_token: "",
    session_expires_at: "",
    must_reset_password: true
  };

  store.users.push(user);
  appendPortalAudit(store, actorName, tenantId, "user", user.user_id, null, "staff_user_create", 0, "Created " + role + " user " + username);
}

function updateStaffStatus(store, tenantId, actorName, userId, nextStatus) {
  const user = findUserById(store, tenantId, userId);
  if (!user) {
    throw new Error("Staff user not found.");
  }
  if (user.role === "tenant_owner") {
    throw new Error("Tenant owner account cannot be disabled.");
  }

  user.status = nextStatus;
  if (nextStatus !== "ACTIVE") {
    user.session_token = "";
    user.session_expires_at = "";
  }

  appendPortalAudit(store, actorName, tenantId, "user", user.user_id, null, nextStatus === "ACTIVE" ? "staff_user_enable" : "staff_user_disable", 0, "Staff user status changed to " + nextStatus);
}

function resetStaffSession(store, tenantId, actorName, userId) {
  const user = findUserById(store, tenantId, userId);
  if (!user) {
    throw new Error("Staff user not found.");
  }

  user.session_token = "";
  user.session_expires_at = "";
  appendPortalAudit(store, actorName, tenantId, "user", user.user_id, null, "staff_user_session_reset", 0, "Staff session cleared");
}

function createCustomerAccount(store, tenantId, actorName, payload) {
  const avatarName = String(payload.avatar_name || "").trim();
  const openingDeposit = Number(payload.opening_deposit || 0);
  const issueCard = Boolean(payload.issue_card);
  const branchId = String(payload.branch_id || "main-branch").trim();

  if (!avatarName) {
    throw new Error("Avatar name is required.");
  }
  if (!Number.isFinite(openingDeposit) || openingDeposit < 0) {
    throw new Error("Opening deposit must be zero or greater.");
  }

  if (!Array.isArray(store.players)) {
    store.players = [];
  }

  const playerId = nextId("PLY-", store.players.map((item) => item.player_id));
  const accountId = nextId("WPB-ACCT-", (store.accounts || []).map((item) => item.account_id));

  store.players.push({
    player_id: playerId,
    tenant_id: tenantId,
    avatar_name: avatarName,
    status: "ACTIVE"
  });

  store.accounts.push({
    account_id: accountId,
    tenant_id: tenantId,
    branch_id: branchId,
    player_id: playerId,
    customer_name: avatarName,
    balance: openingDeposit,
    cash_on_hand: 0,
    outstanding_fine: 0,
    loan_balance: 0,
    status: "ACTIVE"
  });

  if (openingDeposit > 0) {
    createTransaction(store, {
      account_id: accountId,
      type: "OPENING_DEPOSIT",
      amount: openingDeposit,
      direction: "IN",
      memo: "Initial account funding"
    });
  }

  if (issueCard) {
    const cardId = nextId("WPB-CARD-", (store.cards || []).map((item) => item.card_id));
    const accountSuffix = String(accountId).split("-").pop() || "10001";
    store.cards.push({
      card_id: cardId,
      account_id: accountId,
      card_number: "5326-" + accountSuffix.slice(0, 4).padStart(4, "0") + "-0000-0001",
      state: "ACTIVE"
    });
  }

  appendPortalAudit(store, actorName, tenantId, "account", accountId, accountId, "account_create", openingDeposit, "Created customer account for " + avatarName);
}

async function adminAction(store, payload) {
  const user = requireSession(store, payload);
  const actorName = payload.actor_name || user.username;

  switch (payload.action_type) {
    case "dispatch_police":
      requirePermission(user, "dispatch_police");
      dispatchPolice(store, user.tenant_id, actorName, payload.incident_id);
      break;
    case "lock_vault":
      requirePermission(user, "lock_vault");
      lockVault(store, user.tenant_id, actorName, payload.incident_id);
      break;
    case "shutdown_atm_network":
      requirePermission(user, "shutdown_atm_network");
      shutdownAtmNetwork(store, user.tenant_id, actorName);
      break;
    case "run_payroll":
      requirePermission(user, "run_payroll");
      runPayroll(store, user.tenant_id, actorName, payload.amount);
      break;
    case "manage_tenant":
      requirePermission(user, "manage_tenant");
      appendPortalAudit(store, actorName, user.tenant_id, "website", "tenant-console", null, "tenant_manage_open", 0, "Tenant management opened");
      break;
    case "create_tenant":
      requirePermission(user, "create_tenant");
      createTenant(store, actorName, payload);
      break;
    case "suspend_tenant":
      requirePermission(user, "suspend_tenant");
      updateTenantStatus(store, actorName, payload.target_tenant_id, "SUSPENDED");
      break;
    case "activate_tenant":
      requirePermission(user, "activate_tenant");
      updateTenantStatus(store, actorName, payload.target_tenant_id, "ACTIVE");
      break;
    case "update_tenant_settings":
      requirePermission(user, "manage_tenant");
      updateTenantSettings(store, user.tenant_id, actorName, payload);
      break;
    case "create_staff_user":
      requirePermission(user, "create_staff_user");
      createStaffUser(store, user.tenant_id, actorName, payload);
      break;
    case "disable_staff_user":
      requirePermission(user, "disable_staff_user");
      updateStaffStatus(store, user.tenant_id, actorName, payload.user_id, "DISABLED");
      break;
    case "enable_staff_user":
      requirePermission(user, "enable_staff_user");
      updateStaffStatus(store, user.tenant_id, actorName, payload.user_id, "ACTIVE");
      break;
    case "reset_staff_session":
      requirePermission(user, "reset_staff_session");
      resetStaffSession(store, user.tenant_id, actorName, payload.user_id);
      break;
    case "deposit_account":
      requirePermission(user, "deposit_account");
      updateAccountBalance(store, user.tenant_id, actorName, payload.account_id, Number(payload.amount || 0), "DEPOSIT");
      break;
    case "create_customer_account":
      requirePermission(user, "create_customer_account");
      createCustomerAccount(store, user.tenant_id, actorName, payload);
      break;
    case "withdraw_account":
      requirePermission(user, "withdraw_account");
      updateAccountBalance(store, user.tenant_id, actorName, payload.account_id, Number(payload.amount || 0), "WITHDRAW");
      break;
    case "freeze_account":
      requirePermission(user, "freeze_account");
      updateAccountStatus(store, user.tenant_id, actorName, payload.account_id, "FROZEN");
      break;
    case "unfreeze_account":
      requirePermission(user, "unfreeze_account");
      updateAccountStatus(store, user.tenant_id, actorName, payload.account_id, "ACTIVE");
      break;
    case "lock_card":
      requirePermission(user, "lock_card");
      updateCardState(store, user.tenant_id, actorName, payload.card_id, "LOCKED", "card_lock", "Card locked from admin terminal");
      break;
    case "unlock_card":
      requirePermission(user, "unlock_card");
      updateCardState(store, user.tenant_id, actorName, payload.card_id, "ACTIVE", "card_unlock", "Card unlocked from admin terminal");
      break;
    case "report_stolen_card":
      requirePermission(user, "report_stolen_card");
      updateCardState(store, user.tenant_id, actorName, payload.card_id, "STOLEN", "card_report_stolen", "Card reported stolen from admin terminal");
      break;
    case "pay_fine":
      requirePermission(user, "pay_fine");
      payFine(store, user.tenant_id, actorName, payload.fine_id);
      break;
    case "pay_loan":
      requirePermission(user, "pay_loan");
      payLoan(store, user.tenant_id, actorName, payload.loan_id, payload.amount);
      break;
    default:
      return { ok: false, error: "Unsupported admin action." };
  }

  await writeStore(store);
  return {
    ok: true,
    message: "Action completed.",
    store: buildTenantStore(store, user.tenant_id)
  };
}

export async function handlePortal(req, res) {
  let body;

  try {
    body = await readBody(req);
  } catch (_error) {
    sendJson(res, 400, {
      ok: false,
      error: "Invalid JSON body"
    });
    return;
  }

  const action = body.action;
  const store = await getStore();
  let result;

  if (action === "health") {
    result = { ok: true, status: "online" };
  } else if (action === "login") {
    result = await login(store, body);
  } else if (action === "activate_owner") {
    result = await activateOwner(store, body);
  } else if (action === "register_tenant_box") {
    try {
      result = await registerTenantBox(store, body);
    } catch (error) {
      result = { ok: false, error: error.message };
    }
  } else if (action === "dashboard") {
    try {
      result = dashboard(store, body);
    } catch (error) {
      result = { ok: false, error: error.message };
    }
  } else if (action === "admin_action") {
    try {
      result = await adminAction(store, body);
    } catch (error) {
      result = { ok: false, error: error.message };
    }
  } else if (action === "change_password") {
    try {
      result = await changePassword(store, body);
    } catch (error) {
      result = { ok: false, error: error.message };
    }
  } else {
    result = { ok: false, error: "Unsupported action." };
  }

  sendJson(res, result.ok ? 200 : 400, result);
}
