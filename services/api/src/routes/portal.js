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
    "view_reports",
    "view_alerts",
    "view_accounts",
    "view_organizations",
    "view_employment",
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
    "create_organization",
    "update_organization",
    "deactivate_organization",
    "reactivate_organization",
    "fund_organization",
    "spend_organization",
    "transfer_organization",
    "disburse_organization",
    "delete_tenant",
    "suspend_tenant",
    "activate_tenant",
    "reissue_activation_code",
    "suspend_license",
    "activate_license",
    "extend_license",
    "expire_license",
    "create_employment",
    "update_employment",
    "terminate_employment",
    "create_staff_user",
    "disable_staff_user",
    "enable_staff_user",
    "reset_staff_session",
    "create_customer_account",
    "create_customer_portal_user",
    "deposit_account",
    "withdraw_account",
    "flag_account",
    "clear_account_flag",
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
    "view_reports",
    "view_alerts",
    "view_accounts",
    "view_organizations",
    "view_employment",
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
    "create_organization",
    "update_organization",
    "deactivate_organization",
    "reactivate_organization",
    "fund_organization",
    "spend_organization",
    "transfer_organization",
    "disburse_organization",
    "create_staff_user",
    "disable_staff_user",
    "enable_staff_user",
    "reset_staff_session",
    "create_employment",
    "update_employment",
    "terminate_employment",
    "create_customer_account",
    "create_customer_portal_user",
    "deposit_account",
    "withdraw_account",
    "flag_account",
    "clear_account_flag",
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
    "view_reports",
    "view_alerts",
    "view_accounts",
    "view_organizations",
    "view_employment",
    "view_cards",
    "view_transactions",
    "view_fines",
    "view_loans",
    "view_payroll",
    "view_audit_logs",
    "create_customer_account",
    "create_customer_portal_user",
    "create_organization",
    "update_organization",
    "deactivate_organization",
    "reactivate_organization",
    "fund_organization",
    "spend_organization",
    "transfer_organization",
    "disburse_organization",
    "create_employment",
    "update_employment",
    "terminate_employment",
    "deposit_account",
    "withdraw_account",
    "flag_account",
    "clear_account_flag",
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
    "create_customer_portal_user",
    "deposit_account",
    "withdraw_account",
    "lock_card",
    "report_stolen_card",
    "pay_fine",
    "pay_loan"
  ],
  security_admin: [
    "view_bank_core",
    "view_alerts",
    "view_vault_control",
    "view_incidents",
    "view_atm_network",
    "view_audit_logs",
    "dispatch_police",
    "lock_vault",
    "shutdown_atm_network"
  ],
  customer: [
    "view_player_portal",
    "view_cards",
    "view_transactions",
    "view_fines",
    "view_loans",
    "transfer_funds",
    "lock_card",
    "unlock_card",
    "report_stolen_card",
    "pay_fine",
    "pay_loan"
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
      licenses: (store.licenses || []).map((item) => withLicenseMeta(item)),
      players: (store.players || []).map((item) => ({ ...item })),
      organizations: (store.organizations || []).map((item) => ({ ...item })),
      accounts: (store.accounts || []).map((item) => ({ ...item })),
      cards: (store.cards || []).map((item) => ({ ...item })),
      fines: (store.fines || []).map((item) => ({ ...item })),
      loans: (store.loans || []).map((item) => ({ ...item })),
      transactions: (store.transactions || []).map((item) => ({ ...item })),
      employments: (store.employments || []).map((item) => ({ ...item })),
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
    licenses: (store.licenses || []).filter((item) => item.tenant_id === tenantId).map((item) => withLicenseMeta(item)),
    organizations: (store.organizations || []).filter((item) => item.tenant_id === tenantId),
    accounts,
    cards: (store.cards || []).filter((item) => accountIds.has(item.account_id)),
    fines: (store.fines || []).filter((item) => accountIds.has(item.account_id)),
    loans: (store.loans || []).filter((item) => accountIds.has(item.account_id)),
    transactions: (store.transactions || []).filter((item) => accountIds.has(item.account_id)),
    employments: (store.employments || []).filter((item) => item.tenant_id === tenantId),
    audit_logs: (store.audit_logs || []).filter((item) => item.tenant_id === tenantId),
    vault_incidents: (store.vault_incidents || []).filter((item) => item.tenant_id === tenantId),
    branches: (store.branches || []).filter((item) => item.tenant_id === tenantId),
    regions: (store.regions || []).filter((item) => item.tenant_id === tenantId),
    atms: (store.atms || []).filter((item) => item.tenant_id === tenantId)
  };
}

function buildCustomerStore(store, user) {
  const tenantId = user.tenant_id;
  const account = findAccount(store, tenantId, user.linked_account_id);
  if (!account) {
    throw new Error("Linked customer account not found.");
  }

  const tenant = findTenant(store, tenantId);
  const cards = (store.cards || []).filter((item) => item.account_id === account.account_id);
  const fines = (store.fines || []).filter((item) => item.account_id === account.account_id);
  const loans = (store.loans || []).filter((item) => item.account_id === account.account_id);
  const transactions = (store.transactions || []).filter((item) => item.account_id === account.account_id);
  const employments = (store.employments || []).filter((item) => item.account_id === account.account_id);
  const organizations = (store.organizations || []).filter((item) =>
    employments.some((job) => job.organization_id && job.organization_id === item.organization_id)
  );
  const transferDirectory = (store.accounts || [])
    .filter((item) =>
      item.tenant_id === tenantId
      && item.account_id !== account.account_id
      && item.player_id
      && isActive(item.status)
    )
    .map((item) => ({
      account_id: item.account_id,
      customer_name: item.customer_name,
      status: item.status
    }));

  return {
    scope_mode: "player",
    tenant: tenant ? { ...tenant } : null,
    account: { ...account },
    cards: cards.map((item) => ({ ...item })),
    fines: fines.map((item) => ({ ...item })),
    loans: loans.map((item) => ({ ...item })),
    transactions: transactions.map((item) => ({ ...item })),
    employments: employments.map((item) => ({ ...item })),
    organizations: organizations.map((item) => ({ ...item })),
    transfer_directory: transferDirectory
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

function findEmployment(store, tenantId, employmentId) {
  return (store.employments || []).find((item) => item.tenant_id === tenantId && item.employment_id === employmentId) || null;
}

function findOrganization(store, tenantId, organizationId) {
  return (store.organizations || []).find((item) => item.tenant_id === tenantId && item.organization_id === organizationId) || null;
}

function findOrganizationAny(store, organizationId) {
  return (store.organizations || []).find((item) => item.organization_id === organizationId) || null;
}

function findOrganizationByAccount(store, tenantId, accountId) {
  return (store.organizations || []).find((item) => item.tenant_id === tenantId && item.treasury_account_id === accountId) || null;
}

function findTenant(store, tenantId) {
  return (store.tenants || []).find((item) => item.tenant_id === tenantId) || null;
}

function findLicenseBySetupBox(store, setupBoxKey) {
  return (store.licenses || []).find((item) => String(item.setup_box_key || "") === String(setupBoxKey || "")) || null;
}

function findLicenseByTenant(store, tenantId) {
  return (store.licenses || []).find((item) => item.tenant_id === tenantId) || null;
}

function dateIsPast(value) {
  if (!value) {
    return false;
  }
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) && stamp <= Date.now();
}

function addDaysIso(days, startValue) {
  const startStamp = startValue ? new Date(startValue).getTime() : Date.now();
  const baseStamp = Number.isFinite(startStamp) ? Math.max(startStamp, Date.now()) : Date.now();
  return new Date(baseStamp + (days * 24 * 60 * 60 * 1000)).toISOString();
}

function getEffectiveLicenseStatus(license) {
  if (!license) {
    return "UNLICENSED";
  }

  const rawStatus = String(license.status || "").trim().toUpperCase() || "UNLICENSED";
  if (rawStatus === "SUSPENDED") {
    return "SUSPENDED";
  }
  if (rawStatus === "EXPIRED") {
    return "EXPIRED";
  }
  if (dateIsPast(license.expires_at)) {
    return "EXPIRED";
  }
  return rawStatus;
}

function enforceTenantAccess(store, tenantId) {
  const tenant = findTenant(store, tenantId);
  if (!tenant) {
    throw new Error("Tenant not found.");
  }
  if (!isActive(tenant.status)) {
    throw new Error("Tenant access is suspended.");
  }

  const license = findLicenseByTenant(store, tenantId);
  const effectiveStatus = getEffectiveLicenseStatus(license);
  if (effectiveStatus === "UNLICENSED") {
    throw new Error("Tenant license is missing.");
  }
  if (effectiveStatus === "SUSPENDED") {
    throw new Error("Tenant license is suspended.");
  }
  if (effectiveStatus === "EXPIRED") {
    throw new Error("Tenant license has expired.");
  }
}

function withLicenseMeta(license) {
  if (!license) {
    return null;
  }
  return {
    ...license,
    effective_status: getEffectiveLicenseStatus(license)
  };
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

function nextEmploymentId(store) {
  const numeric = (store.employments || [])
    .map((item) => Number(String(item.employment_id || "").replace("EMP-", "")))
    .filter((value) => Number.isFinite(value));
  const next = (numeric.length ? Math.max(...numeric) : 10000) + 1;
  return "EMP-" + String(next);
}

function nextOrganizationId(store) {
  const numeric = (store.organizations || [])
    .map((item) => Number(String(item.organization_id || "").replace("ORG-", "")))
    .filter((value) => Number.isFinite(value));
  const next = (numeric.length ? Math.max(...numeric) : 1000) + 1;
  return "ORG-" + String(next);
}

function buildActivationCode(tenantId) {
  return "ACT-" + String(tenantId).replace("tenant-", "").padStart(6, "0");
}

function buildTreasuryAccountName(name) {
  return /treasury$/i.test(String(name || "").trim()) ? String(name || "").trim() : (String(name || "").trim() + " Treasury");
}

function normalizeBudgetCycle(value) {
  const cycle = String(value || "MONTHLY").trim().toUpperCase();
  if (["NONE", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"].includes(cycle)) {
    return cycle;
  }
  throw new Error("Unsupported budget cycle.");
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

  if (user.tenant_id !== "platform-root") {
    enforceTenantAccess(store, user.tenant_id);
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
      linked_account_id: user.linked_account_id || "",
      permissions: buildPermissions(user.role),
      must_reset_password: Boolean(user.must_reset_password)
    },
    store: user.role === "customer" ? buildCustomerStore(store, user) : buildTenantStore(store, user.tenant_id)
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
    linked_account_id: "",
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

function reissueActivationCode(store, actorName, targetTenantId) {
  const tenant = findTenant(store, targetTenantId);
  if (!tenant) {
    throw new Error("Tenant not found.");
  }

  if (String(tenant.owner_username || "").trim()) {
    throw new Error("Tenant already has an owner account.");
  }

  tenant.activation_code = buildActivationCode(targetTenantId) + "-" + createToken().slice(0, 6).toUpperCase();
  appendPortalAudit(store, actorName, targetTenantId, "tenant", targetTenantId, null, "tenant_activation_reissue", 0, "Activation code reissued");
}

function dashboard(store, payload) {
  const user = requireSession(store, payload);
  if (user.tenant_id !== "platform-root") {
    enforceTenantAccess(store, user.tenant_id);
  }
  return {
    ok: true,
    session: {
      username: user.username,
      role: user.role,
      tenant_id: user.tenant_id,
      token: user.session_token,
      linked_account_id: user.linked_account_id || "",
      permissions: buildPermissions(user.role),
      must_reset_password: Boolean(user.must_reset_password)
    },
    store: user.role === "customer" ? buildCustomerStore(store, user) : buildTenantStore(store, user.tenant_id)
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

function updateAccountRiskFlag(store, tenantId, actorName, accountId, nextFlagState, payload = {}) {
  const account = findAccount(store, tenantId, accountId);
  if (!account) {
    throw new Error("Account not found.");
  }

  const note = String(payload.note || "").trim();
  const freezeOnFlag = Boolean(payload.freeze_on_flag);
  const restoreActive = Boolean(payload.restore_active);

  if (nextFlagState) {
    if (!note) {
      throw new Error("Risk note is required when flagging an account.");
    }
    account.risk_flag = true;
    account.risk_note = note;
    if (freezeOnFlag) {
      account.status = "FROZEN";
    }
    appendPortalAudit(
      store,
      actorName,
      tenantId,
      "account",
      account.account_id,
      account.account_id,
      "account_flag",
      0,
      freezeOnFlag ? `Account flagged and frozen: ${note}` : `Account flagged: ${note}`
    );
    return;
  }

  account.risk_flag = false;
  account.risk_note = "";
  if (restoreActive && String(account.status || "").toUpperCase() === "FROZEN") {
    account.status = "ACTIVE";
  }
  appendPortalAudit(
    store,
    actorName,
    tenantId,
    "account",
    account.account_id,
    account.account_id,
    "account_flag_clear",
    0,
    restoreActive ? "Account risk flag cleared and status restored to ACTIVE" : "Account risk flag cleared"
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

function roundCurrency(value) {
  return Number(Number(value || 0).toFixed(2));
}

function runPayroll(store, tenantId, actorName, amountInput) {
  const tenant = findTenant(store, tenantId);
  const employments = (store.employments || []).filter((employment) => employment.tenant_id === tenantId && String(employment.status || "").toUpperCase() === "ACTIVE");
  const fallbackAmount = Number(amountInput || tenant?.payroll_default_amount || 250);
  const taxRate = Math.max(0, Number(tenant?.payroll_tax_rate || 0));
  const taxOrganizationId = String(tenant?.tax_organization_id || "").trim();
  const taxOrganization = taxOrganizationId ? findOrganization(store, tenantId, taxOrganizationId) : null;
  const taxTreasury = taxOrganization ? findAccount(store, tenantId, taxOrganization.treasury_account_id) : null;
  if (!employments.length && (!Number.isFinite(fallbackAmount) || fallbackAmount <= 0)) {
    throw new Error("Amount must be greater than zero.");
  }
  if (taxRate > 100) {
    throw new Error("Payroll tax rate cannot exceed 100%.");
  }
  if (taxRate > 0) {
    if (!taxOrganization || String(taxOrganization.status || "").toUpperCase() !== "ACTIVE") {
      throw new Error("Configured tax organization is unavailable.");
    }
    if (!taxTreasury || !isActive(taxTreasury.status)) {
      throw new Error("Configured tax treasury account is unavailable.");
    }
  }

  const activeAccounts = (store.accounts || []).filter((account) => account.tenant_id === tenantId && isActive(account.status));
  if (!activeAccounts.length) {
    throw new Error("No active accounts found for payroll.");
  }

  const targets = employments.length
    ? employments.map((employment) => {
      const account = findAccount(store, tenantId, employment.account_id);
      return account && isActive(account.status)
        ? { account, amount: Number(employment.pay_rate || 0), employment }
        : null;
    }).filter(Boolean)
    : activeAccounts.map((account) => ({ account, amount: fallbackAmount, employment: null }));

  if (!targets.length) {
    throw new Error("No eligible payroll targets found.");
  }

  targets.forEach(({ amount, employment }) => {
    if (!employment || !employment.organization_id) {
      return;
    }

    const organization = findOrganization(store, tenantId, employment.organization_id);
    if (!organization || String(organization.status || "").toUpperCase() !== "ACTIVE") {
      throw new Error(`Organization funding source is unavailable for ${employment.title}.`);
    }

    const treasury = findAccount(store, tenantId, organization.treasury_account_id);
    if (!treasury || !isActive(treasury.status)) {
      throw new Error(`Treasury account is unavailable for ${organization.name}.`);
    }
    if (Number(treasury.balance || 0) < Number(amount || 0)) {
      throw new Error(`Insufficient treasury funds for ${organization.name}.`);
    }
  });

  targets.forEach(({ account, amount, employment }) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    const grossAmount = roundCurrency(amount);
    const taxAmount = roundCurrency(grossAmount * (taxRate / 100));
    const netAmount = roundCurrency(Math.max(0, grossAmount - taxAmount));
    let payrollMemo = "VPS payroll run";

    if (employment?.organization_id) {
      const organization = findOrganization(store, tenantId, employment.organization_id);
      const treasury = organization ? findAccount(store, tenantId, organization.treasury_account_id) : null;
      if (treasury) {
        treasury.balance = roundCurrency(Number(treasury.balance || 0) - grossAmount);
        createTransaction(store, {
          account_id: treasury.account_id,
          type: "PAYROLL_DISBURSEMENT",
          amount: grossAmount,
          direction: "OUT",
          memo: `${organization?.name || employment.employer_name} payroll for ${account.customer_name}`
        });
      }
      payrollMemo = `${organization?.name || employment.employer_name} payroll`;
    } else if (employment) {
      payrollMemo = `${employment.employer_name} payroll`;
    }

    if (taxAmount > 0 && taxTreasury) {
      taxTreasury.balance = roundCurrency(Number(taxTreasury.balance || 0) + taxAmount);
      createTransaction(store, {
        account_id: taxTreasury.account_id,
        type: "PAYROLL_TAX",
        amount: taxAmount,
        direction: "IN",
        memo: `${tenant?.name || tenantId} payroll tax withheld from ${account.customer_name}`
      });
      appendPortalAudit(
        store,
        actorName,
        tenantId,
        "tax",
        taxOrganization?.organization_id || "tenant-tax",
        taxTreasury.account_id,
        "payroll_tax_collect",
        taxAmount,
        `Payroll tax withheld from ${account.customer_name}`
      );
    }

    account.balance = roundCurrency(Number(account.balance || 0) + netAmount);
    createTransaction(store, {
      account_id: account.account_id,
      type: "PAYROLL",
      amount: netAmount,
      direction: "IN",
      memo: taxAmount > 0 ? `${payrollMemo} (gross L$${grossAmount} / tax L$${taxAmount})` : payrollMemo
    });
    if (employment) {
      employment.last_paid_at = new Date().toISOString();
    }
    appendPortalAudit(
      store,
      actorName,
      tenantId,
      "payroll",
      employment ? employment.employment_id : "vps-payroll",
      account.account_id,
      "payroll_run",
      netAmount,
      employment
        ? `Payroll deposit for ${employment.title}${taxAmount > 0 ? ` (gross L$${grossAmount} / tax L$${taxAmount})` : ""}`
        : `Payroll deposit${taxAmount > 0 ? ` (gross L$${grossAmount} / tax L$${taxAmount})` : ""}`
    );
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
  const nextTaxRate = Number(payload.payroll_tax_rate ?? tenant.payroll_tax_rate ?? 0);
  const nextTaxOrganizationId = String(payload.tax_organization_id ?? tenant.tax_organization_id ?? "").trim();
  const nextTaxOrganization = nextTaxOrganizationId ? findOrganization(store, targetTenantId, nextTaxOrganizationId) : null;

  if (!nextTenantName || !nextBankName) {
    throw new Error("Tenant and bank name are required.");
  }
  if (!Number.isFinite(nextPayroll) || nextPayroll <= 0) {
    throw new Error("Payroll default must be greater than zero.");
  }
  if (!Number.isFinite(nextTaxRate) || nextTaxRate < 0 || nextTaxRate > 100) {
    throw new Error("Payroll tax rate must be between 0 and 100.");
  }
  if (nextTaxRate > 0 && !nextTaxOrganizationId) {
    throw new Error("Select a tax treasury organization before enabling payroll tax.");
  }
  if (nextTaxOrganizationId && !nextTaxOrganization) {
    throw new Error("Selected tax organization was not found.");
  }

  tenant.name = nextTenantName;
  tenant.bank_name = nextBankName;
  tenant.primary_region_name = nextRegionName;
  tenant.payroll_default_amount = nextPayroll;
  tenant.payroll_tax_rate = nextTaxRate;
  tenant.tax_organization_id = nextTaxOrganizationId;

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

  appendPortalAudit(store, actorName, targetTenantId, "tenant", targetTenantId, null, "tenant_settings_update", nextPayroll, `Tenant settings updated${nextTaxRate > 0 ? ` / tax ${nextTaxRate}%` : ""}`);
}

function createTenant(store, actorName, payload) {
  ensureLicenses(store);
  const tenantName = String(payload.tenant_name || "").trim();
  const bankName = String(payload.bank_name || "").trim();
  const regionName = String(payload.primary_region_name || "").trim();
  const payrollDefault = Number(payload.payroll_default_amount || 250);
  const payrollTaxRate = Number(payload.payroll_tax_rate || 0);
  const taxOrganizationId = String(payload.tax_organization_id || "").trim();
  const licenseStatus = String(payload.license_status || "TRIAL").trim().toUpperCase();
  const issuedAt = new Date().toISOString();
  const expiresAt = payload.license_expires_at
    ? new Date(payload.license_expires_at).toISOString()
    : (licenseStatus === "TRIAL" ? addDaysIso(14) : "");

  if (!tenantName || !bankName) {
    throw new Error("Tenant and bank name are required.");
  }
  if (!Number.isFinite(payrollDefault) || payrollDefault <= 0) {
    throw new Error("Payroll default must be greater than zero.");
  }
  if (!Number.isFinite(payrollTaxRate) || payrollTaxRate < 0 || payrollTaxRate > 100) {
    throw new Error("Payroll tax rate must be between 0 and 100.");
  }
  if (payrollTaxRate > 0 && !taxOrganizationId) {
    throw new Error("Select a tax treasury organization before enabling payroll tax.");
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
    payroll_tax_rate: payrollTaxRate,
    tax_organization_id: taxOrganizationId,
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
    issued_at: issuedAt,
    renewed_at: issuedAt,
    expires_at: expiresAt,
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

function deleteTenant(store, actorName, targetTenantId) {
  const tenant = findTenant(store, targetTenantId);
  if (!tenant) {
    throw new Error("Tenant not found.");
  }
  if (targetTenantId === "platform-root") {
    throw new Error("Platform root tenant cannot be deleted.");
  }

  const accountIds = new Set(
    (store.accounts || [])
      .filter((account) => account.tenant_id === targetTenantId)
      .map((account) => account.account_id)
  );

  store.cards = (store.cards || []).filter((card) => !accountIds.has(card.account_id));
  store.fines = (store.fines || []).filter((fine) => !accountIds.has(fine.account_id));
  store.loans = (store.loans || []).filter((loan) => !accountIds.has(loan.account_id));
  store.transactions = (store.transactions || []).filter((transaction) => !accountIds.has(transaction.account_id));
  store.accounts = (store.accounts || []).filter((account) => account.tenant_id !== targetTenantId);
  store.players = (store.players || []).filter((player) => player.tenant_id !== targetTenantId);
  store.users = (store.users || []).filter((item) => item.tenant_id !== targetTenantId);
  store.vault_incidents = (store.vault_incidents || []).filter((incident) => incident.tenant_id !== targetTenantId);
  store.audit_logs = (store.audit_logs || []).filter((entry) => entry.tenant_id !== targetTenantId);
  store.atms = (store.atms || []).filter((atm) => atm.tenant_id !== targetTenantId);
  store.branches = (store.branches || []).filter((branch) => branch.tenant_id !== targetTenantId);
  store.regions = (store.regions || []).filter((region) => region.tenant_id !== targetTenantId);
  store.licenses = (store.licenses || []).filter((license) => license.tenant_id !== targetTenantId);
  store.tenants = (store.tenants || []).filter((item) => item.tenant_id !== targetTenantId);

  appendPortalAudit(
    store,
    actorName,
    "platform-root",
    "tenant",
    targetTenantId,
    null,
    "tenant_delete",
    0,
    "Tenant deleted from platform console"
  );
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

function updateLicenseStatus(store, actorName, targetTenantId, nextStatus) {
  const license = findLicenseByTenant(store, targetTenantId);
  if (!license) {
    throw new Error("License not found for tenant.");
  }

  license.status = nextStatus;
  if (nextStatus === "ACTIVE") {
    license.renewed_at = new Date().toISOString();
    if (!license.expires_at || dateIsPast(license.expires_at)) {
      license.expires_at = addDaysIso(30);
    }
  }
  if (nextStatus === "EXPIRED") {
    license.expires_at = new Date().toISOString();
  }

  appendPortalAudit(
    store,
    actorName,
    targetTenantId,
    "license",
    license.license_id,
    null,
    "license_" + nextStatus.toLowerCase(),
    0,
    "License status set to " + nextStatus
  );
}

function extendLicense(store, actorName, targetTenantId, daysInput) {
  const license = findLicenseByTenant(store, targetTenantId);
  if (!license) {
    throw new Error("License not found for tenant.");
  }

  const days = Number(daysInput || 30);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("Extension days must be greater than zero.");
  }

  license.status = "ACTIVE";
  license.renewed_at = new Date().toISOString();
  license.expires_at = addDaysIso(days, license.expires_at);

  appendPortalAudit(
    store,
    actorName,
    targetTenantId,
    "license",
    license.license_id,
    null,
    "license_extend",
    days,
    "License extended by " + days + " day(s)"
  );
}

function updateCardState(store, tenantId, actorName, cardId, nextState, action, memo, allowedAccountId = "") {
  const card = findCard(store, tenantId, cardId);
  if (!card) {
    throw new Error("Card not found.");
  }
  if (allowedAccountId && card.account_id !== allowedAccountId) {
    throw new Error("Card access denied for this portal account.");
  }

  card.state = nextState;
  appendPortalAudit(store, actorName, tenantId, "card", card.card_id, card.account_id, action, 0, memo);
}

function createEmployment(store, tenantId, actorName, payload) {
  if (!Array.isArray(store.employments)) {
    store.employments = [];
  }

  const accountId = String(payload.account_id || "").trim();
  const organizationId = String(payload.organization_id || "").trim();
  const linkedOrganization = organizationId ? findOrganization(store, tenantId, organizationId) : null;
  const employerName = String(payload.employer_name || linkedOrganization?.name || "").trim();
  const departmentName = String(payload.department_name || "").trim();
  const title = String(payload.title || "").trim();
  const payRate = Number(payload.pay_rate || 0);
  const payCycle = String(payload.pay_cycle || "WEEKLY").trim().toUpperCase();

  if (!accountId || !employerName || !title) {
    throw new Error("Account, employer, and title are required.");
  }
  if (!Number.isFinite(payRate) || payRate <= 0) {
    throw new Error("Pay rate must be greater than zero.");
  }

  const account = findAccount(store, tenantId, accountId);
  if (!account) {
    throw new Error("Linked account not found.");
  }

  const existing = (store.employments || []).find((item) => item.tenant_id === tenantId && item.account_id === accountId && item.status === "ACTIVE");
  if (existing) {
    throw new Error("Account already has an active employment record.");
  }
  if (organizationId && !linkedOrganization) {
    throw new Error("Linked organization not found.");
  }

  const employment = {
    employment_id: nextEmploymentId(store),
    tenant_id: tenantId,
    account_id: accountId,
    organization_id: organizationId,
    employer_name: employerName,
    department_name: departmentName || linkedOrganization?.department_name || "",
    title,
    pay_rate: payRate,
    pay_cycle: payCycle,
    status: "ACTIVE",
    hired_at: new Date().toISOString(),
    last_paid_at: ""
  };

  store.employments.push(employment);
  appendPortalAudit(store, actorName, tenantId, "employment", employment.employment_id, accountId, "employment_create", payRate, `Employment created for ${account.customer_name}`);
}

function resolveCreateUserRole(actorUser, requestedRole) {
  const role = String(requestedRole || "").trim() || "bank_admin";
  const standardRoles = ["bank_admin", "teller", "security_admin"];

  if (role === "platform_admin") {
    if (actorUser.role !== "platform_admin") {
      throw new Error("Only a platform admin can assign the platform_admin role.");
    }
    return { role: "platform_admin", tenantId: "platform-root" };
  }

  if (!standardRoles.includes(role)) {
    throw new Error("Unsupported staff role.");
  }

  return { role, tenantId: actorUser.tenant_id };
}

function updateEmployment(store, tenantId, actorName, payload) {
  const employment = findEmployment(store, tenantId, payload.employment_id);
  if (!employment) {
    throw new Error("Employment record not found.");
  }

  const organizationId = String(payload.organization_id ?? employment.organization_id ?? "").trim();
  const linkedOrganization = organizationId ? findOrganization(store, tenantId, organizationId) : null;
  if (organizationId && !linkedOrganization) {
    throw new Error("Linked organization not found.");
  }

  const employerName = String(payload.employer_name || linkedOrganization?.name || employment.employer_name).trim();
  const departmentName = String(payload.department_name ?? linkedOrganization?.department_name ?? employment.department_name).trim();
  const title = String(payload.title || employment.title).trim();
  const payRate = Number(payload.pay_rate ?? employment.pay_rate);
  const payCycle = String(payload.pay_cycle || employment.pay_cycle || "WEEKLY").trim().toUpperCase();

  if (!employerName || !title) {
    throw new Error("Employer and title are required.");
  }
  if (!Number.isFinite(payRate) || payRate <= 0) {
    throw new Error("Pay rate must be greater than zero.");
  }

  employment.organization_id = organizationId;
  employment.employer_name = employerName;
  employment.department_name = departmentName;
  employment.title = title;
  employment.pay_rate = payRate;
  employment.pay_cycle = payCycle;

  appendPortalAudit(store, actorName, tenantId, "employment", employment.employment_id, employment.account_id, "employment_update", payRate, "Employment record updated");
}

function terminateEmployment(store, tenantId, actorName, employmentId) {
  const employment = findEmployment(store, tenantId, employmentId);
  if (!employment) {
    throw new Error("Employment record not found.");
  }

  employment.status = "TERMINATED";
  appendPortalAudit(store, actorName, tenantId, "employment", employment.employment_id, employment.account_id, "employment_terminate", 0, "Employment terminated");
}

function payFine(store, tenantId, actorName, fineId, allowedAccountId = "") {
  const fine = findFine(store, tenantId, fineId);
  if (!fine) {
    throw new Error("Fine not found.");
  }
  if (allowedAccountId && fine.account_id !== allowedAccountId) {
    throw new Error("Fine access denied for this portal account.");
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

function payLoan(store, tenantId, actorName, loanId, amountInput, allowedAccountId = "") {
  const loan = findLoan(store, tenantId, loanId);
  if (!loan) {
    throw new Error("Loan not found.");
  }
  if (allowedAccountId && loan.account_id !== allowedAccountId) {
    throw new Error("Loan access denied for this portal account.");
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

function transferFunds(store, tenantId, actorName, sourceAccountId, targetAccountId, amountInput, payload = {}, allowedSourceAccountId = "") {
  const sourceAccount = findAccount(store, tenantId, sourceAccountId);
  if (!sourceAccount) {
    throw new Error("Source account not found.");
  }
  if (allowedSourceAccountId && sourceAccount.account_id !== allowedSourceAccountId) {
    throw new Error("Transfer access denied for this portal account.");
  }
  if (!isActive(sourceAccount.status)) {
    throw new Error("Source account is not active.");
  }

  const targetAccount = findAccount(store, tenantId, targetAccountId);
  if (!targetAccount) {
    throw new Error("Transfer recipient not found.");
  }
  if (sourceAccount.account_id === targetAccount.account_id) {
    throw new Error("Choose a different recipient account.");
  }
  if (!isActive(targetAccount.status)) {
    throw new Error("Recipient account is not active.");
  }
  if (allowedSourceAccountId && !targetAccount.player_id) {
    throw new Error("Customer transfers must target another player account.");
  }

  const amount = Number(amountInput || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Transfer amount must be greater than zero.");
  }
  if (Number(sourceAccount.balance || 0) < amount) {
    throw new Error("Insufficient funds for transfer.");
  }

  const memo = String(payload.memo || "").trim();
  const sourceMemo = memo || ("Transfer to " + targetAccount.customer_name);
  const targetMemo = memo || ("Transfer from " + sourceAccount.customer_name);

  sourceAccount.balance = Number(sourceAccount.balance || 0) - amount;
  targetAccount.balance = Number(targetAccount.balance || 0) + amount;

  createTransaction(store, {
    account_id: sourceAccount.account_id,
    type: "PLAYER_TRANSFER",
    amount,
    direction: "OUT",
    memo: sourceMemo
  });

  createTransaction(store, {
    account_id: targetAccount.account_id,
    type: "PLAYER_TRANSFER",
    amount,
    direction: "IN",
    memo: targetMemo
  });

  appendPortalAudit(
    store,
    actorName,
    tenantId,
    "account",
    sourceAccount.account_id,
    targetAccount.account_id,
    "account_transfer",
    amount,
    `${sourceAccount.customer_name} -> ${targetAccount.customer_name}${memo ? " / " + memo : ""}`
  );
}

async function changePassword(store, payload) {
  const user = requireSession(store, payload);
  if (user.tenant_id !== "platform-root") {
    enforceTenantAccess(store, user.tenant_id);
  }
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
      linked_account_id: user.linked_account_id || "",
      permissions: buildPermissions(user.role),
      must_reset_password: false
    },
    store: user.role === "customer" ? buildCustomerStore(store, user) : buildTenantStore(store, user.tenant_id)
  };
}

function createStaffUser(store, actorUser, actorName, payload) {
  const username = String(payload.new_username || "").trim();
  const avatarName = String(payload.new_avatar_name || "").trim();
  const resolved = resolveCreateUserRole(actorUser, payload.new_role);
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
    tenant_id: resolved.tenantId,
    username,
    password_hash: hashPassword(password),
    role: resolved.role,
    linked_account_id: "",
    avatar_name: avatarName,
    status: "ACTIVE",
    session_token: "",
    session_expires_at: "",
    must_reset_password: true
  };

  store.users.push(user);
  appendPortalAudit(store, actorName, resolved.tenantId, "user", user.user_id, null, "staff_user_create", 0, "Created " + resolved.role + " user " + username);
}

function createCustomerPortalUser(store, tenantId, actorName, payload) {
  const accountId = String(payload.account_id || "").trim();
  const username = String(payload.new_username || "").trim();
  const password = String(payload.new_password || "");

  if (!accountId || !username || !password) {
    throw new Error("Account, username, and password are required.");
  }

  const account = findAccount(store, tenantId, accountId);
  if (!account) {
    throw new Error("Linked account not found.");
  }
  if ((store.users || []).some((item) => String(item.username || "").trim().toLowerCase() === username.toLowerCase())) {
    throw new Error("Username already exists.");
  }
  if ((store.users || []).some((item) => item.tenant_id === tenantId && item.role === "customer" && item.linked_account_id === accountId)) {
    throw new Error("This account already has portal access.");
  }

  const nextNumber = (store.users || []).length + 10001;
  const user = {
    user_id: "USR-" + String(nextNumber),
    tenant_id: tenantId,
    username,
    password_hash: hashPassword(password),
    role: "customer",
    linked_account_id: accountId,
    avatar_name: account.customer_name,
    status: "ACTIVE",
    session_token: "",
    session_expires_at: "",
    must_reset_password: true
  };

  store.users.push(user);
  appendPortalAudit(store, actorName, tenantId, "user", user.user_id, accountId, "customer_portal_create", 0, "Created customer portal access for " + account.customer_name);
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

function createOrganization(store, tenantId, actorName, payload) {
  if (!Array.isArray(store.organizations)) {
    store.organizations = [];
  }

  const name = String(payload.name || "").trim();
  const organizationType = String(payload.organization_type || "BUSINESS").trim().toUpperCase();
  const departmentName = String(payload.department_name || "").trim();
  const notes = String(payload.notes || "").trim();
  const branchId = String(payload.branch_id || "main-branch").trim();
  const openingBalance = Number(payload.opening_balance || 0);
  const budgetCycle = normalizeBudgetCycle(payload.budget_cycle || "MONTHLY");
  const budgetAmount = Number(payload.budget_amount || 0);
  const reserveTarget = Number(payload.reserve_target || 0);

  if (!name) {
    throw new Error("Organization name is required.");
  }
  if (!["BUSINESS", "GOVERNMENT", "DEPARTMENT", "NONPROFIT"].includes(organizationType)) {
    throw new Error("Unsupported organization type.");
  }
  if (!Number.isFinite(openingBalance) || openingBalance < 0) {
    throw new Error("Opening balance must be zero or greater.");
  }
  if (!Number.isFinite(budgetAmount) || budgetAmount < 0) {
    throw new Error("Budget amount must be zero or greater.");
  }
  if (!Number.isFinite(reserveTarget) || reserveTarget < 0) {
    throw new Error("Reserve target must be zero or greater.");
  }
  if ((store.organizations || []).some((item) => item.tenant_id === tenantId && String(item.name || "").trim().toLowerCase() === name.toLowerCase())) {
    throw new Error("Organization name already exists.");
  }

  const accountId = nextId("WPB-ACCT-", (store.accounts || []).map((item) => item.account_id));
  const organizationId = nextOrganizationId(store);

  store.accounts.push({
    account_id: accountId,
    tenant_id: tenantId,
    branch_id: branchId,
    player_id: null,
    customer_name: buildTreasuryAccountName(name),
    balance: openingBalance,
    cash_on_hand: 0,
    outstanding_fine: 0,
    loan_balance: 0,
    status: "ACTIVE"
  });

  store.organizations.push({
    organization_id: organizationId,
    tenant_id: tenantId,
    name,
    organization_type: organizationType,
    department_name: departmentName,
    treasury_account_id: accountId,
    budget_cycle: budgetCycle,
    budget_amount: budgetAmount,
    reserve_target: reserveTarget,
    status: "ACTIVE",
    created_at: new Date().toISOString(),
    notes
  });

  if (openingBalance > 0) {
    createTransaction(store, {
      account_id: accountId,
      type: "TREASURY_FUNDING",
      amount: openingBalance,
      direction: "IN",
      memo: "Initial treasury funding"
    });
  }

  appendPortalAudit(store, actorName, tenantId, "organization", organizationId, accountId, "organization_create", openingBalance, "Created " + organizationType + " organization " + name);
}

function updateOrganization(store, tenantId, actorName, payload) {
  const organization = findOrganization(store, tenantId, payload.organization_id);
  if (!organization) {
    throw new Error("Organization not found.");
  }

  const nextName = String(payload.name || organization.name).trim();
  const nextType = String(payload.organization_type || organization.organization_type || "BUSINESS").trim().toUpperCase();
  const nextDepartment = String(payload.department_name ?? organization.department_name ?? "").trim();
  const nextNotes = String(payload.notes ?? organization.notes ?? "").trim();
  const nextBudgetCycle = normalizeBudgetCycle(payload.budget_cycle ?? organization.budget_cycle ?? "MONTHLY");
  const nextBudgetAmount = Number(payload.budget_amount ?? organization.budget_amount ?? 0);
  const nextReserveTarget = Number(payload.reserve_target ?? organization.reserve_target ?? 0);

  if (!nextName) {
    throw new Error("Organization name is required.");
  }
  if (!["BUSINESS", "GOVERNMENT", "DEPARTMENT", "NONPROFIT"].includes(nextType)) {
    throw new Error("Unsupported organization type.");
  }
  if ((store.organizations || []).some((item) => item.tenant_id === tenantId && item.organization_id !== organization.organization_id && String(item.name || "").trim().toLowerCase() === nextName.toLowerCase())) {
    throw new Error("Organization name already exists.");
  }
  if (!Number.isFinite(nextBudgetAmount) || nextBudgetAmount < 0) {
    throw new Error("Budget amount must be zero or greater.");
  }
  if (!Number.isFinite(nextReserveTarget) || nextReserveTarget < 0) {
    throw new Error("Reserve target must be zero or greater.");
  }

  organization.name = nextName;
  organization.organization_type = nextType;
  organization.department_name = nextDepartment;
  organization.budget_cycle = nextBudgetCycle;
  organization.budget_amount = nextBudgetAmount;
  organization.reserve_target = nextReserveTarget;
  organization.notes = nextNotes;

  const treasuryAccount = findAccount(store, tenantId, organization.treasury_account_id);
  if (treasuryAccount) {
    treasuryAccount.customer_name = buildTreasuryAccountName(nextName);
  }

  appendPortalAudit(store, actorName, tenantId, "organization", organization.organization_id, organization.treasury_account_id, "organization_update", 0, "Organization details updated");
}

function updateOrganizationStatus(store, tenantId, actorName, organizationId, nextStatus) {
  const organization = findOrganization(store, tenantId, organizationId);
  if (!organization) {
    throw new Error("Organization not found.");
  }
  const tenant = findTenant(store, tenantId);
  if (nextStatus !== "ACTIVE" && tenant?.tax_organization_id === organizationId && Number(tenant?.payroll_tax_rate || 0) > 0) {
    throw new Error("This organization is assigned as the tenant tax treasury.");
  }

  organization.status = nextStatus;
  const treasuryAccount = findAccount(store, tenantId, organization.treasury_account_id);
  if (treasuryAccount) {
    treasuryAccount.status = nextStatus === "ACTIVE" ? "ACTIVE" : "FROZEN";
  }

  appendPortalAudit(
    store,
    actorName,
    tenantId,
    "organization",
    organization.organization_id,
    organization.treasury_account_id,
    nextStatus === "ACTIVE" ? "organization_reactivate" : "organization_deactivate",
    0,
    "Organization status set to " + nextStatus
  );
}

function updateOrganizationTreasury(store, tenantId, actorName, organizationId, amountInput, mode, payload = {}) {
  const organization = findOrganization(store, tenantId, organizationId);
  if (!organization) {
    throw new Error("Organization not found.");
  }
  if (String(organization.status || "").toUpperCase() !== "ACTIVE") {
    throw new Error("Organization is not active.");
  }

  const treasury = findAccount(store, tenantId, organization.treasury_account_id);
  if (!treasury || !isActive(treasury.status)) {
    throw new Error("Treasury account is unavailable.");
  }

  const amount = Number(amountInput || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  const memo = String(payload.memo || "").trim();
  const note = memo || (mode === "fund" ? "Treasury funded from admin terminal" : "Treasury spend recorded from admin terminal");

  if (mode === "spend" && Number(treasury.balance || 0) < amount) {
    throw new Error("Insufficient treasury funds.");
  }

  treasury.balance = Number(treasury.balance || 0) + (mode === "fund" ? amount : -amount);

  createTransaction(store, {
    account_id: treasury.account_id,
    type: mode === "fund" ? "TREASURY_DEPOSIT" : "TREASURY_WITHDRAWAL",
    amount,
    direction: mode === "fund" ? "IN" : "OUT",
    memo: note
  });

  appendPortalAudit(
    store,
    actorName,
    tenantId,
    "organization",
    organization.organization_id,
    treasury.account_id,
    mode === "fund" ? "organization_fund" : "organization_spend",
    amount,
    note
  );
}

function transferOrganizationTreasury(store, tenantId, actorName, sourceOrganizationId, targetOrganizationId, amountInput, payload = {}) {
  const source = findOrganization(store, tenantId, sourceOrganizationId);
  const target = findOrganization(store, tenantId, targetOrganizationId);

  if (!source || !target) {
    throw new Error("Organization transfer target not found.");
  }
  if (source.organization_id === target.organization_id) {
    throw new Error("Choose a different target organization.");
  }
  if (String(source.status || "").toUpperCase() !== "ACTIVE" || String(target.status || "").toUpperCase() !== "ACTIVE") {
    throw new Error("Both organizations must be active for transfer.");
  }

  const sourceTreasury = findAccount(store, tenantId, source.treasury_account_id);
  const targetTreasury = findAccount(store, tenantId, target.treasury_account_id);
  if (!sourceTreasury || !targetTreasury || !isActive(sourceTreasury.status) || !isActive(targetTreasury.status)) {
    throw new Error("Treasury account unavailable for transfer.");
  }

  const amount = Number(amountInput || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Transfer amount must be greater than zero.");
  }
  if (Number(sourceTreasury.balance || 0) < amount) {
    throw new Error("Insufficient treasury funds for transfer.");
  }

  const memo = String(payload.memo || "").trim() || `Treasury transfer to ${target.name}`;

  sourceTreasury.balance = Number(sourceTreasury.balance || 0) - amount;
  targetTreasury.balance = Number(targetTreasury.balance || 0) + amount;

  createTransaction(store, {
    account_id: sourceTreasury.account_id,
    type: "TREASURY_TRANSFER_OUT",
    amount,
    direction: "OUT",
    memo
  });
  createTransaction(store, {
    account_id: targetTreasury.account_id,
    type: "TREASURY_TRANSFER_IN",
    amount,
    direction: "IN",
    memo: String(payload.memo || "").trim() || `Treasury transfer from ${source.name}`
  });

  appendPortalAudit(
    store,
    actorName,
    tenantId,
    "organization",
    source.organization_id,
    sourceTreasury.account_id,
    "organization_transfer_out",
    amount,
    `${source.name} -> ${target.name}`
  );
  appendPortalAudit(
    store,
    actorName,
    tenantId,
    "organization",
    target.organization_id,
    targetTreasury.account_id,
    "organization_transfer_in",
    amount,
    `${source.name} -> ${target.name}`
  );
}

function disburseOrganizationTreasury(store, tenantId, actorName, organizationId, targetAccountId, amountInput, payload = {}) {
  const organization = findOrganization(store, tenantId, organizationId);
  if (!organization) {
    throw new Error("Organization not found.");
  }
  if (String(organization.status || "").toUpperCase() !== "ACTIVE") {
    throw new Error("Organization is not active.");
  }

  const treasury = findAccount(store, tenantId, organization.treasury_account_id);
  if (!treasury || !isActive(treasury.status)) {
    throw new Error("Treasury account is unavailable.");
  }

  const targetAccount = findAccount(store, tenantId, targetAccountId);
  if (!targetAccount) {
    throw new Error("Recipient account not found.");
  }
  if (!targetAccount.player_id) {
    throw new Error("Disbursements must target a player account.");
  }
  if (!isActive(targetAccount.status)) {
    throw new Error("Recipient account is not active.");
  }
  if (treasury.account_id === targetAccount.account_id) {
    throw new Error("Choose a different recipient account.");
  }

  const amount = Number(amountInput || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Disbursement amount must be greater than zero.");
  }
  if (Number(treasury.balance || 0) < amount) {
    throw new Error("Insufficient treasury funds.");
  }

  const memo = String(payload.memo || "").trim() || (`Disbursement from ${organization.name}`);

  treasury.balance = Number(treasury.balance || 0) - amount;
  targetAccount.balance = Number(targetAccount.balance || 0) + amount;

  createTransaction(store, {
    account_id: treasury.account_id,
    type: "TREASURY_DISBURSEMENT",
    amount,
    direction: "OUT",
    memo: `${memo} -> ${targetAccount.customer_name}`
  });

  createTransaction(store, {
    account_id: targetAccount.account_id,
    type: "TREASURY_DISBURSEMENT",
    amount,
    direction: "IN",
    memo: `${memo} <- ${organization.name}`
  });

  appendPortalAudit(
    store,
    actorName,
    tenantId,
    "organization",
    organization.organization_id,
    targetAccount.account_id,
    "organization_disburse",
    amount,
    `${organization.name} -> ${targetAccount.customer_name}${payload.memo ? " / " + String(payload.memo).trim() : ""}`
  );
}

function resolveOrganizationTenantId(store, actorUser, payload) {
  if (actorUser.tenant_id !== "platform-root") {
    return actorUser.tenant_id;
  }

  if (payload.target_tenant_id) {
    return String(payload.target_tenant_id).trim();
  }

  if (payload.organization_id) {
    const organization = findOrganizationAny(store, payload.organization_id);
    if (organization) {
      return organization.tenant_id;
    }
  }

  throw new Error("Target tenant is required for platform organization management.");
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
    case "delete_tenant":
      requirePermission(user, "delete_tenant");
      deleteTenant(store, actorName, payload.target_tenant_id);
      break;
    case "suspend_tenant":
      requirePermission(user, "suspend_tenant");
      updateTenantStatus(store, actorName, payload.target_tenant_id, "SUSPENDED");
      break;
    case "activate_tenant":
      requirePermission(user, "activate_tenant");
      updateTenantStatus(store, actorName, payload.target_tenant_id, "ACTIVE");
      break;
    case "reissue_activation_code":
      requirePermission(user, "reissue_activation_code");
      reissueActivationCode(store, actorName, payload.target_tenant_id);
      break;
    case "suspend_license":
      requirePermission(user, "suspend_license");
      updateLicenseStatus(store, actorName, payload.target_tenant_id, "SUSPENDED");
      break;
    case "activate_license":
      requirePermission(user, "activate_license");
      updateLicenseStatus(store, actorName, payload.target_tenant_id, "ACTIVE");
      break;
    case "expire_license":
      requirePermission(user, "expire_license");
      updateLicenseStatus(store, actorName, payload.target_tenant_id, "EXPIRED");
      break;
    case "extend_license":
      requirePermission(user, "extend_license");
      extendLicense(store, actorName, payload.target_tenant_id, payload.days);
      break;
    case "update_tenant_settings":
      requirePermission(user, "manage_tenant");
      updateTenantSettings(store, user.tenant_id, actorName, payload);
      break;
    case "create_staff_user":
      requirePermission(user, "create_staff_user");
      createStaffUser(store, user, actorName, payload);
      break;
    case "create_employment":
      requirePermission(user, "create_employment");
      createEmployment(store, user.tenant_id, actorName, payload);
      break;
    case "update_employment":
      requirePermission(user, "update_employment");
      updateEmployment(store, user.tenant_id, actorName, payload);
      break;
    case "terminate_employment":
      requirePermission(user, "terminate_employment");
      terminateEmployment(store, user.tenant_id, actorName, payload.employment_id);
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
    case "create_customer_portal_user":
      requirePermission(user, "create_customer_portal_user");
      createCustomerPortalUser(store, user.tenant_id, actorName, payload);
      break;
    case "create_organization":
      requirePermission(user, "create_organization");
      createOrganization(store, resolveOrganizationTenantId(store, user, payload), actorName, payload);
      break;
    case "update_organization":
      requirePermission(user, "update_organization");
      updateOrganization(store, resolveOrganizationTenantId(store, user, payload), actorName, payload);
      break;
    case "deactivate_organization":
      requirePermission(user, "deactivate_organization");
      updateOrganizationStatus(store, resolveOrganizationTenantId(store, user, payload), actorName, payload.organization_id, "INACTIVE");
      break;
    case "reactivate_organization":
      requirePermission(user, "reactivate_organization");
      updateOrganizationStatus(store, resolveOrganizationTenantId(store, user, payload), actorName, payload.organization_id, "ACTIVE");
      break;
    case "fund_organization":
      requirePermission(user, "fund_organization");
      updateOrganizationTreasury(store, resolveOrganizationTenantId(store, user, payload), actorName, payload.organization_id, payload.amount, "fund", payload);
      break;
    case "spend_organization":
      requirePermission(user, "spend_organization");
      updateOrganizationTreasury(store, resolveOrganizationTenantId(store, user, payload), actorName, payload.organization_id, payload.amount, "spend", payload);
      break;
    case "transfer_organization":
      requirePermission(user, "transfer_organization");
      transferOrganizationTreasury(
        store,
        resolveOrganizationTenantId(store, user, payload),
        actorName,
        payload.organization_id,
        payload.target_organization_id,
        payload.amount,
        payload
      );
      break;
    case "disburse_organization":
      requirePermission(user, "disburse_organization");
      disburseOrganizationTreasury(
        store,
        resolveOrganizationTenantId(store, user, payload),
        actorName,
        payload.organization_id,
        payload.target_account_id,
        payload.amount,
        payload
      );
      break;
    case "withdraw_account":
      requirePermission(user, "withdraw_account");
      updateAccountBalance(store, user.tenant_id, actorName, payload.account_id, Number(payload.amount || 0), "WITHDRAW");
      break;
    case "flag_account":
      requirePermission(user, "flag_account");
      updateAccountRiskFlag(store, user.tenant_id, actorName, payload.account_id, true, payload);
      break;
    case "clear_account_flag":
      requirePermission(user, "clear_account_flag");
      updateAccountRiskFlag(store, user.tenant_id, actorName, payload.account_id, false, payload);
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
      updateCardState(store, user.tenant_id, actorName, payload.card_id, "LOCKED", "card_lock", user.role === "customer" ? "Card locked from customer portal" : "Card locked from admin terminal", user.role === "customer" ? user.linked_account_id : "");
      break;
    case "unlock_card":
      requirePermission(user, "unlock_card");
      updateCardState(store, user.tenant_id, actorName, payload.card_id, "ACTIVE", "card_unlock", user.role === "customer" ? "Card unlocked from customer portal" : "Card unlocked from admin terminal", user.role === "customer" ? user.linked_account_id : "");
      break;
    case "report_stolen_card":
      requirePermission(user, "report_stolen_card");
      updateCardState(store, user.tenant_id, actorName, payload.card_id, "STOLEN", "card_report_stolen", user.role === "customer" ? "Card reported stolen from customer portal" : "Card reported stolen from admin terminal", user.role === "customer" ? user.linked_account_id : "");
      break;
    case "pay_fine":
      requirePermission(user, "pay_fine");
      payFine(store, user.tenant_id, actorName, payload.fine_id, user.role === "customer" ? user.linked_account_id : "");
      break;
    case "pay_loan":
      requirePermission(user, "pay_loan");
      payLoan(store, user.tenant_id, actorName, payload.loan_id, payload.amount, user.role === "customer" ? user.linked_account_id : "");
      break;
    case "transfer_funds":
      requirePermission(user, "transfer_funds");
      transferFunds(
        store,
        user.tenant_id,
        actorName,
        payload.source_account_id || user.linked_account_id,
        payload.target_account_id,
        payload.amount,
        payload,
        user.role === "customer" ? user.linked_account_id : ""
      );
      break;
    default:
      return { ok: false, error: "Unsupported admin action." };
  }

  await writeStore(store);
  return {
    ok: true,
    message: "Action completed.",
    store: user.role === "customer" ? buildCustomerStore(store, user) : buildTenantStore(store, user.tenant_id)
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
    try {
      result = await login(store, body);
    } catch (error) {
      result = { ok: false, error: error.message };
    }
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
