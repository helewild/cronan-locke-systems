import crypto from "node:crypto";
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

function getTenantAccountIds(store, tenantId) {
  return (store.accounts || [])
    .filter((account) => account.tenant_id === tenantId)
    .map((account) => account.account_id);
}

function buildTenantStore(store, tenantId) {
  const accountIds = new Set(getTenantAccountIds(store, tenantId));
  const accounts = (store.accounts || []).filter((item) => item.tenant_id === tenantId);

  return {
    tenants: (store.tenants || []).filter((item) => item.tenant_id === tenantId),
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
      token: user.session_token
    },
    store: buildTenantStore(store, user.tenant_id)
  };
}

async function activateOwner(store, payload) {
  ensureUsers(store);
  const tenant = (store.tenants || []).find((item) => item.activation_code === payload.activation_code);

  if (!tenant) {
    return { ok: false, error: "Activation code not recognized." };
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
  const amount = Number(amountInput || 250);
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

async function adminAction(store, payload) {
  const user = requireSession(store, payload);
  const actorName = payload.actor_name || user.username;

  switch (payload.action_type) {
    case "dispatch_police":
      dispatchPolice(store, user.tenant_id, actorName, payload.incident_id);
      break;
    case "lock_vault":
      lockVault(store, user.tenant_id, actorName, payload.incident_id);
      break;
    case "shutdown_atm_network":
      shutdownAtmNetwork(store, user.tenant_id, actorName);
      break;
    case "run_payroll":
      runPayroll(store, user.tenant_id, actorName, payload.amount);
      break;
    case "manage_tenant":
      appendPortalAudit(store, actorName, user.tenant_id, "website", "tenant-console", null, "tenant_manage_open", 0, "Tenant management opened");
      break;
    case "deposit_account":
      updateAccountBalance(store, user.tenant_id, actorName, payload.account_id, Number(payload.amount || 0), "DEPOSIT");
      break;
    case "withdraw_account":
      updateAccountBalance(store, user.tenant_id, actorName, payload.account_id, Number(payload.amount || 0), "WITHDRAW");
      break;
    case "freeze_account":
      updateAccountStatus(store, user.tenant_id, actorName, payload.account_id, "FROZEN");
      break;
    case "unfreeze_account":
      updateAccountStatus(store, user.tenant_id, actorName, payload.account_id, "ACTIVE");
      break;
    case "lock_card":
      updateCardState(store, user.tenant_id, actorName, payload.card_id, "LOCKED", "card_lock", "Card locked from admin terminal");
      break;
    case "unlock_card":
      updateCardState(store, user.tenant_id, actorName, payload.card_id, "ACTIVE", "card_unlock", "Card unlocked from admin terminal");
      break;
    case "report_stolen_card":
      updateCardState(store, user.tenant_id, actorName, payload.card_id, "STOLEN", "card_report_stolen", "Card reported stolen from admin terminal");
      break;
    case "pay_fine":
      payFine(store, user.tenant_id, actorName, payload.fine_id);
      break;
    case "pay_loan":
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
  } else {
    result = { ok: false, error: "Unsupported action." };
  }

  sendJson(res, result.ok ? 200 : 400, result);
}
