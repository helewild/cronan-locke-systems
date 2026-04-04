const CONFIG = {
  apiUrl: "",
  siteMode: "demo",
  sessionKey: "cronan-locke-session",
  previewKey: "cronan-locke-preview-state",
  demoActivationCode: "DEMO-OWNER-001",
  demoAdminUser: "admin",
  demoAdminPassword: "demo123"
};

if (window.CRONAN_LOCKE_CONFIG) {
  Object.assign(CONFIG, window.CRONAN_LOCKE_CONFIG);
}

const state = {
  store: null,
  incident: null,
  logs: [],
  view: "accounts",
  atmNetwork: [],
  session: null,
  setupUsers: {},
  passwordResetPromptedToken: null,
  searchQuery: "",
  selectedAccountId: null
};

let actionModalResolver = null;

const STAFF_ROLE_HELP = {
  platform_admin: {
    title: "Platform Admin",
    copy: "Global Cronan & Locke operator access. Can manage tenants, licensing, and platform-wide controls."
  },
  bank_admin: {
    title: "Bank Admin",
    copy: "Can manage accounts, cards, fines, loans, payroll, and employment records."
  },
  teller: {
    title: "Teller",
    copy: "Can help customers with accounts, cards, fines, and loan payments, but cannot run payroll or security actions."
  },
  security_admin: {
    title: "Security Admin",
    copy: "Can work incidents, vault response, and ATM network controls, but not customer banking actions."
  }
};

const VIEW_PERMISSIONS = {
  platform: "view_platform",
  "bank-core": "view_bank_core",
  alerts: "view_alerts",
  reports: "view_reports",
  accounts: "view_accounts",
  organizations: "view_organizations",
  employment: "view_employment",
  staff: "view_staff",
  cards: "view_cards",
  transactions: "view_transactions",
  fines: "view_fines",
  loans: "view_loans",
  "vault-control": "view_vault_control",
  incidents: "view_incidents",
  payroll: "view_payroll",
  "atm-network": "view_atm_network",
  "audit-logs": "view_audit_logs"
};

function isCustomerSession() {
  return state.session?.role === "customer";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function nowStamp() {
  return "[" + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + "]";
}

function setClock(targetId) {
  const now = new Date();
  const text = "DATE: " + (now.getMonth() + 1) + "/" + now.getDate() + "/" + now.getFullYear()
    + " TIME: " + now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  document.getElementById(targetId).textContent = text;
}

function updateClockDisplays() {
  const adminClock = document.getElementById("clock-line");
  if (adminClock) {
    setClock("clock-line");
  }
  const playerClock = document.getElementById("player-clock-line");
  if (playerClock) {
    setClock("player-clock-line");
  }
}

function savePreviewState() {
  localStorage.setItem(CONFIG.previewKey, JSON.stringify({
    incident: state.incident,
    logs: state.logs,
    view: state.view,
    atmNetwork: state.atmNetwork,
    setupUsers: state.setupUsers
  }));
}

function loadPreviewState() {
  try {
    const raw = localStorage.getItem(CONFIG.previewKey);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(CONFIG.sessionKey, JSON.stringify(session));
}

function loadSession() {
  try {
    const raw = localStorage.getItem(CONFIG.sessionKey);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(CONFIG.sessionKey);
  state.passwordResetPromptedToken = null;
}

function isSessionError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("invalid or expired session") || text.includes("login required");
}

function resetRuntimeLogs(store) {
  state.logs = [];
  seedLogs(store || state.store);
  savePreviewState();
}

function handleSessionFailure(message) {
  clearSession();
  resetRuntimeLogs(state.store);
  logout(message || "Session expired. Please log in again.");
}

function setAuthMessage(message, tone) {
  const box = document.getElementById("auth-message");
  box.textContent = message;
  box.classList.toggle("alert", tone === "alert");
}

function updateStaffRoleHint() {
  const role = document.getElementById("staff-role")?.value || "bank_admin";
  const hint = STAFF_ROLE_HELP[role] || STAFF_ROLE_HELP.bank_admin;
  const node = document.getElementById("staff-role-hint");
  if (!node) {
    return;
  }
  node.innerHTML = `<strong>${hint.title}</strong><div>${hint.copy}</div>`;
}

function openStaffModal() {
  document.getElementById("staff-form").reset();
  document.getElementById("staff-created").classList.add("hidden");
  document.getElementById("staff-created-copy").textContent = "";
  document.getElementById("staff-modal").classList.remove("hidden");
  document.getElementById("staff-modal").setAttribute("aria-hidden", "false");
  const roleSelect = document.getElementById("staff-role");
  roleSelect.innerHTML = `
    ${state.session?.role === "platform_admin" ? '<option value="platform_admin">Platform Admin</option>' : ""}
    <option value="bank_admin">Bank Admin</option>
    <option value="teller">Teller</option>
    <option value="security_admin">Security Admin</option>
  `;
  roleSelect.value = state.session?.role === "platform_admin" ? "platform_admin" : "bank_admin";
  updateStaffRoleHint();
  document.getElementById("staff-username").focus();
}

function closeStaffModal() {
  document.getElementById("staff-modal").classList.add("hidden");
  document.getElementById("staff-modal").setAttribute("aria-hidden", "true");
}

function renderActionField(field) {
  const id = `action-field-${field.name}`;
  const value = typeof field.value === "undefined" || field.value === null ? "" : field.value;
  if (field.type === "select") {
    const options = safeArray(field.options).map((option) => {
      const optionValue = typeof option === "string" ? option : option.value;
      const optionLabel = typeof option === "string" ? option : option.label;
      return `<option value="${optionValue}" ${String(optionValue) === String(value) ? "selected" : ""}>${optionLabel}</option>`;
    }).join("");
    return `<label>${field.label}<select id="${id}" name="${field.name}" ${field.required ? "required" : ""}>${options}</select></label>`;
  }
  if (field.type === "textarea") {
    return `<label>${field.label}<textarea id="${id}" name="${field.name}" ${field.required ? "required" : ""} placeholder="${field.placeholder || ""}">${value}</textarea></label>`;
  }
  return `<label>${field.label}<input id="${id}" name="${field.name}" type="${field.type || "text"}" value="${value}" ${field.required ? "required" : ""} placeholder="${field.placeholder || ""}"></label>`;
}

function closeActionModal(result = null) {
  document.getElementById("action-modal").classList.add("hidden");
  document.getElementById("action-modal").setAttribute("aria-hidden", "true");
  document.getElementById("action-form-fields").innerHTML = "";
  document.getElementById("action-modal-copy").classList.add("hidden");
  document.getElementById("action-modal-copy").innerHTML = "";
  document.querySelector("#action-modal .modal-card")?.classList.remove("wide");
  const resolver = actionModalResolver;
  actionModalResolver = null;
  if (resolver) {
    resolver(result);
  }
}

function openActionModal(config) {
  return new Promise((resolve) => {
    actionModalResolver = resolve;
    document.querySelector("#action-modal .modal-card")?.classList.toggle("wide", Boolean(config.wide));
    document.getElementById("action-modal-title").textContent = config.title || "Action Form";
    document.getElementById("action-submit").textContent = config.submitLabel || "Submit";
    const copy = document.getElementById("action-modal-copy");
    if (config.copy) {
      copy.innerHTML = config.copy;
      copy.classList.remove("hidden");
    } else {
      copy.innerHTML = "";
      copy.classList.add("hidden");
    }
    document.getElementById("action-form-fields").innerHTML = safeArray(config.fields).map(renderActionField).join("");
    document.getElementById("action-modal").classList.remove("hidden");
    document.getElementById("action-modal").setAttribute("aria-hidden", "false");
    const firstField = safeArray(config.fields)[0];
    if (firstField) {
      window.setTimeout(() => {
        document.getElementById(`action-field-${firstField.name}`)?.focus();
      }, 10);
    }
  });
}

async function confirmAction(title, body, submitLabel = "Confirm") {
  const values = await openActionModal({
    title,
    submitLabel,
    copy: body,
    fields: []
  });
  return values !== null;
}

function setBridgeMode(label) {
  const node = document.getElementById("bridge-mode");
  if (!node) {
    return;
  }
  node.textContent = label;
}

function cloneStore(store) {
  return JSON.parse(JSON.stringify(store));
}

function addLog(line) {
  state.logs.unshift(nowStamp() + " " + line);
  state.logs = state.logs.slice(0, 10);
  savePreviewState();
  renderLogs();
}

function renderLogs() {
  const logs = state.logs.length ? state.logs : ["[--:--:--] Awaiting system events"];
  document.getElementById("log-list").innerHTML = logs.map((line) => `<div class="log-item">${line}</div>`).join("");
  document.getElementById("bottom-log-1").textContent = logs[0] || "[--:--:--] Awaiting system events";
  document.getElementById("bottom-log-2").textContent = logs[1] || "[--:--:--] Awaiting system events";
  document.getElementById("bottom-log-3").textContent = logs[2] || "[--:--:--] Awaiting system events";
}

function buildAtmNetwork(store) {
  if (safeArray(store.atms).length) {
    return store.atms.map((atm) => ({
      id: atm.atm_id || atm.id || "atm",
      branch: atm.branch_name || atm.branch || "Main Branch",
      status: atm.status || "ONLINE",
      scope: atm.scope || ((store.tenants || [])[0]?.name || "Tenant")
    }));
  }

  const branch = safeArray(store.branches)[0];
  const tenant = safeArray(store.tenants)[0];
  return [
    {
      id: "atm-001",
      branch: branch ? branch.name : "Main Branch",
      status: "ONLINE",
      scope: tenant ? tenant.name : "Demo Tenant"
    },
    {
      id: "atm-002",
      branch: branch ? branch.name + " Annex" : "Annex",
      status: "ONLINE",
      scope: tenant ? tenant.name : "Demo Tenant"
    }
  ];
}

function initialsFromName(value) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "CL";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function splitBankDisplay(value) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return ["NO BANK", ""];
  }
  if (parts.length === 1) {
    return [parts[0].toUpperCase(), ""];
  }
  const last = parts.pop();
  return [parts.join(" ").toUpperCase(), last.toUpperCase()];
}

function renderTenant() {
  const tenantLabel = document.querySelector(".tenant-card .side-label");
  const crestShield = document.getElementById("crest-shield");
  const crestSubtitle = document.getElementById("crest-subtitle");
  const crestTitle = document.getElementById("crest-title");
  if (state.session?.role === "platform_admin") {
    if (tenantLabel) {
      tenantLabel.textContent = "Platform Scope";
    }
    document.getElementById("tenant-name").textContent = "CRONAN & LOCKE";
    document.getElementById("tenant-bank").textContent = "PLATFORM CONTROL";
    if (crestShield) {
      crestShield.textContent = "CL";
    }
    if (crestSubtitle) {
      crestSubtitle.textContent = "CRONAN & LOCKE";
    }
    if (crestTitle) {
      crestTitle.textContent = "SYSTEMS";
    }
    return;
  }
  if (tenantLabel) {
    tenantLabel.textContent = "Current Tenant";
  }
  const tenant = safeArray(state.store.tenants)[0];
  document.getElementById("tenant-name").textContent = tenant ? tenant.name.toUpperCase() : "NO TENANT";
  document.getElementById("tenant-bank").textContent = tenant ? tenant.bank_name.toUpperCase() : "NO BANK";
  if (tenant) {
    const bankParts = splitBankDisplay(tenant.bank_name);
    if (crestShield) {
      crestShield.textContent = initialsFromName(tenant.bank_name);
    }
    if (crestSubtitle) {
      crestSubtitle.textContent = bankParts[0];
    }
    if (crestTitle) {
      crestTitle.textContent = bankParts[1];
    }
  }
}

function renderMetrics() {
  const store = state.store;
  document.getElementById("metric-tenants").textContent = safeArray(store.tenants).length;
  document.getElementById("metric-accounts").textContent = safeArray(store.accounts).length;
  document.getElementById("metric-cards").textContent = safeArray(store.cards).length;
  document.getElementById("metric-incidents").textContent = safeArray(store.vault_incidents).filter((item) => item.state === "ACTIVE").length;
  document.getElementById("metric-fines").textContent = safeArray(store.fines).filter((item) => item.status === "DUE").length;
  document.getElementById("metric-loans").textContent = safeArray(store.loans).filter((item) => item.status === "ACTIVE").length;
}

function prettyRole(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .toUpperCase();
}

function getPermissions() {
  return Array.isArray(state.session?.permissions) ? state.session.permissions : [];
}

function hasPermission(permission) {
  return getPermissions().includes(permission);
}

function canAccessView(view) {
  const permission = VIEW_PERMISSIONS[view];
  return !permission || hasPermission(permission);
}

function updateSystemStatus() {
  const atmOffline = state.atmNetwork.filter((atm) => atm.status !== "ONLINE").length;
  const incidentActive = state.incident && state.incident.state === "ACTIVE";
  document.getElementById("status-line-1").textContent = "ATM NETWORK: " + (atmOffline ? "DEGRADED" : "ONLINE");
  document.getElementById("status-line-2").textContent = "DISPATCH: " + (incidentActive ? "ENGAGED" : "MONITORING");
  document.getElementById("status-line-3").textContent = "MODE: " + (CONFIG.siteMode === "vps" ? "VPS API" : (CONFIG.apiUrl ? "APPS SCRIPT BRIDGE" : "STATIC PREVIEW"));
}

function syncControlStates() {
  const dispatchButton = document.getElementById("dispatch-btn");
  const lockButton = document.getElementById("lock-btn");
  const shutdownButton = document.getElementById("shutdown-btn");
  const manageButton = document.getElementById("manage-tenant-btn");
  const payrollButton = document.getElementById("view-action-btn");

  dispatchButton.disabled = dispatchButton.disabled || !hasPermission("dispatch_police");
  lockButton.disabled = lockButton.disabled || !hasPermission("lock_vault");
  shutdownButton.disabled = !hasPermission("shutdown_atm_network");
  manageButton.disabled = !hasPermission("manage_tenant");
  payrollButton.disabled = state.view === "payroll" ? !hasPermission("run_payroll") : false;
}

function renderIncident() {
  const incident = state.incident;
  const banner = document.getElementById("incident-banner");
  const stage = document.getElementById("incident-stage");
  const dispatchButton = document.getElementById("dispatch-btn");
  const lockButton = document.getElementById("lock-btn");
  const hasIncident = !!incident && String(incident.state || "").trim().toUpperCase() === "ACTIVE";

  document.getElementById("incident-id").textContent = hasIncident ? incident.incident_id : "-";
  stage.textContent = hasIncident ? incident.stage : "System Running Normal";
  document.getElementById("incident-unit").textContent = hasIncident ? incident.responding_unit : "-";
  document.getElementById("incident-update").textContent = hasIncident ? incident.last_update.toUpperCase() : "No active alerts";

  banner.textContent = hasIncident ? "[!] Vault Incident Detected" : "[OK] System Running Normal";
  banner.classList.toggle("status-alert", hasIncident);
  banner.classList.toggle("status-ok", !hasIncident);
  stage.classList.toggle("hot", hasIncident);
  stage.classList.toggle("ok", !hasIncident);
  dispatchButton.disabled = !hasIncident;
  lockButton.disabled = !hasIncident;
  updateSystemStatus();
}

function getTransactions(store) {
  const liveTransactions = safeArray(store.transactions);
  if (liveTransactions.length) {
    return liveTransactions;
  }

  return safeArray(store.audit_logs).map((audit, index) => ({
    transaction_id: audit.audit_id || `audit-${index}`,
    account_id: audit.target_account_id || "",
    type: String(audit.action || "audit").toUpperCase(),
    amount: Number(audit.amount || 0),
    direction: Number(audit.amount || 0) < 0 ? "OUT" : "IN",
    memo: audit.memo || ""
  }));
}

function getLicenseForTenant(store, tenantId) {
  return safeArray(store.licenses).find((license) => license.tenant_id === tenantId) || null;
}

function getLicenseStatusInfo(license) {
  if (!license) {
    return { label: "UNLICENSED", tone: "alert", detail: "No license" };
  }

  const effective = String(license.effective_status || license.status || "UNLICENSED").toUpperCase();
  let tone = "dim";
  if (effective === "ACTIVE") {
    tone = "";
  } else if (effective === "TRIAL") {
    tone = "dim";
  } else {
    tone = "alert";
  }

  const expiry = license.expires_at ? String(license.expires_at).slice(0, 10) : "No expiry";
  return {
    label: effective,
    tone,
    detail: expiry
  };
}

function getTenantHealth(store, tenantId) {
  const tenant = safeArray(store.tenants).find((item) => item.tenant_id === tenantId);
  if (!tenant) {
    return { label: "UNKNOWN", tone: "alert" };
  }
  if (tenant.status !== "ACTIVE") {
    return { label: "SUSPENDED", tone: "alert" };
  }

  const incidents = safeArray(store.vault_incidents).filter((item) => item.tenant_id === tenantId && item.state === "ACTIVE");
  if (incidents.length) {
    return { label: "ALERT", tone: "alert" };
  }

  const offlineAtms = safeArray(store.atms).filter((item) => item.tenant_id === tenantId && item.status !== "ONLINE");
  if (offlineAtms.length) {
    return { label: "DEGRADED", tone: "dim" };
  }

  return { label: "NOMINAL", tone: "" };
}

function getTenantActivity(store, tenantId) {
  const audit = safeArray(store.audit_logs).filter((item) => item.tenant_id === tenantId);
  if (!audit.length) {
    const tenant = safeArray(store.tenants).find((item) => item.tenant_id === tenantId);
    return tenant?.created_at ? `Tenant created ${String(tenant.created_at).slice(0, 10)}` : "No recent activity";
  }

  const latest = audit[audit.length - 1];
  return `${String(latest.action || "activity").replaceAll("_", " ")} / ${latest.actor_name || latest.object_type || "system"}`.toUpperCase();
}

function getOrganizationPayrollBurden(store, organizationId) {
  return safeArray(store.employments)
    .filter((employment) => employment.organization_id === organizationId && employment.status === "ACTIVE")
    .reduce((total, employment) => total + Number(employment.pay_rate || 0), 0);
}

function getOrganizationHealth(store, organization) {
  const treasury = safeArray(store.accounts).find((account) => account.account_id === organization.treasury_account_id);
  const treasuryBalance = Number(treasury?.balance || 0);
  const burden = getOrganizationPayrollBurden(store, organization.organization_id);
  const reserveTarget = Number(organization.reserve_target || 0);
  const budgetAmount = Number(organization.budget_amount || 0);

  if (organization.status !== "ACTIVE") {
    return { label: "INACTIVE", tone: "dim" };
  }
  if (burden > 0 && treasuryBalance < burden) {
    return { label: "PAYROLL RISK", tone: "alert" };
  }
  if (reserveTarget > 0 && treasuryBalance < reserveTarget) {
    return { label: "UNDER RESERVE", tone: "alert" };
  }
  if (budgetAmount > 0 && burden > budgetAmount) {
    return { label: "OVER BUDGET", tone: "alert" };
  }
  if (budgetAmount > 0 || reserveTarget > 0) {
    return { label: "FUNDED", tone: "" };
  }
  return { label: "OPEN", tone: "dim" };
}

function getTotalDueFines(store) {
  return safeArray(store.fines)
    .filter((fine) => fine.status === "DUE")
    .reduce((total, fine) => total + Number(fine.amount || 0), 0);
}

function getTotalActiveLoanBalance(store) {
  return safeArray(store.loans)
    .filter((loan) => loan.status === "ACTIVE")
    .reduce((total, loan) => total + Number(loan.balance || 0), 0);
}

function getCustomerPortalUsers(store) {
  return safeArray(store.users).filter((user) => user.role === "customer" && user.status === "ACTIVE").length;
}

function getActiveEmploymentCount(store) {
  return safeArray(store.employments).filter((employment) => employment.status === "ACTIVE").length;
}

function getAtmHealthSummary(store) {
  const atms = safeArray(store.atms);
  const offline = atms.filter((atm) => atm.status !== "ONLINE").length;
  return {
    total: atms.length,
    online: Math.max(0, atms.length - offline),
    offline
  };
}

function getOrganizationRiskSummary(store) {
  return safeArray(store.organizations).reduce((summary, organization) => {
    const health = getOrganizationHealth(store, organization);
    if (health.label === "PAYROLL RISK") {
      summary.payrollRisk += 1;
    }
    if (health.label === "UNDER RESERVE") {
      summary.underReserve += 1;
    }
    if (health.label === "OVER BUDGET") {
      summary.overBudget += 1;
    }
    if (organization.status === "ACTIVE") {
      summary.active += 1;
    }
    return summary;
  }, {
    active: 0,
    payrollRisk: 0,
    underReserve: 0,
    overBudget: 0
  });
}

function getPayrollHealth(store) {
  const employments = safeArray(store.employments).filter((employment) => employment.status === "ACTIVE");
  if (!employments.length) {
    return { label: "IDLE", tone: "dim", note: "No active jobs on record" };
  }

  const underfundedOrganizations = safeArray(store.organizations).filter((organization) => {
    const treasury = safeArray(store.accounts).find((account) => account.account_id === organization.treasury_account_id);
    return organization.status === "ACTIVE" && Number(treasury?.balance || 0) < getOrganizationPayrollBurden(store, organization.organization_id);
  });

  if (underfundedOrganizations.length) {
    return {
      label: "PAYROLL RISK",
      tone: "alert",
      note: `${underfundedOrganizations.length} organization(s) cannot fully fund the next payroll run`
    };
  }

  return {
    label: "FUNDED",
    tone: "",
    note: `${employments.length} active job(s) funded for the next payroll cycle`
  };
}

function getTaxConfiguration(store) {
  const tenant = safeArray(store.tenants)[0] || null;
  const rate = Number(tenant?.payroll_tax_rate || 0);
  const organization = tenant?.tax_organization_id
    ? safeArray(store.organizations).find((item) => item.organization_id === tenant.tax_organization_id)
    : null;
  const treasury = organization
    ? safeArray(store.accounts).find((account) => account.account_id === organization.treasury_account_id)
    : null;
  return {
    tenant,
    rate,
    organization,
    treasury
  };
}

function getBankCoreRows(store) {
  const activeIncidentCount = safeArray(store.vault_incidents).filter((incident) => incident.state === "ACTIVE").length;
  const riskSummary = getOrganizationRiskSummary(store);
  const atmSummary = getAtmHealthSummary(store);
  const payrollHealth = getPayrollHealth(store);
  const customerPortals = getCustomerPortalUsers(store);
  const activeAccounts = safeArray(store.accounts).filter((account) => account.status === "ACTIVE").length;
  const dueFineCount = safeArray(store.fines).filter((fine) => fine.status === "DUE").length;
  const activeLoanCount = safeArray(store.loans).filter((loan) => loan.status === "ACTIVE").length;
  const payrollBurden = safeArray(store.organizations)
    .filter((organization) => organization.status === "ACTIVE")
    .reduce((total, organization) => total + getOrganizationPayrollBurden(store, organization.organization_id), 0);
  const taxConfig = getTaxConfiguration(store);

  return [
    [
      "Accounts",
      "Customer banking and portal access",
      { chip: activeAccounts ? "ONLINE" : "IDLE", tone: activeAccounts ? "" : "dim" },
      `${activeAccounts} active account(s) / ${customerPortals} portal login(s)`,
      `${safeArray(store.cards).length} card(s) issued and ${safeArray(store.transactions).length} transaction record(s) available`
    ],
    [
      "Organizations",
      "Business, department, and treasury network",
      {
        chip: riskSummary.payrollRisk || riskSummary.underReserve || riskSummary.overBudget ? "WATCH" : "FUNDED",
        tone: riskSummary.payrollRisk || riskSummary.underReserve || riskSummary.overBudget ? "alert" : ""
      },
      `${riskSummary.active} active org(s) / ${riskSummary.payrollRisk} payroll risk / ${riskSummary.underReserve} under reserve`,
      `${riskSummary.overBudget} over budget and L$${payrollBurden} total payroll burden`
    ],
    [
      "Justice",
      "Fines, collections, and enforcement",
      { chip: dueFineCount ? "OUTSTANDING" : "CLEAR", tone: dueFineCount ? "alert" : "" },
      `${dueFineCount} due fine(s) totaling L$${getTotalDueFines(store)}`,
      dueFineCount ? "Collections queue is active and awaiting payment" : "No due fines are waiting for action"
    ],
    [
      "Credit",
      "Loans, balances, and repayment pressure",
      { chip: activeLoanCount ? "SERVICING" : "IDLE", tone: activeLoanCount ? "" : "dim" },
      `${activeLoanCount} active loan(s) / L$${getTotalActiveLoanBalance(store)} outstanding`,
      activeLoanCount ? "Loan servicing is active across tenant accounts" : "No active loans are on the books"
    ],
    [
      "Payroll",
      "Employment wages and organization funding",
      { chip: payrollHealth.label, tone: payrollHealth.tone },
      `${getActiveEmploymentCount(store)} active job(s) / L$${payrollBurden} next-run burden`,
      payrollHealth.note
    ],
    [
      "Taxation",
      "Payroll withholding and public treasury",
      {
        chip: taxConfig.rate > 0 ? (taxConfig.organization ? "WITHHOLDING" : "MISCONFIGURED") : "DISABLED",
        tone: taxConfig.rate > 0 ? (taxConfig.organization ? "" : "alert") : "dim"
      },
      taxConfig.rate > 0
        ? `${taxConfig.rate}% to ${taxConfig.organization?.name || "UNASSIGNED TREASURY"}`
        : "No payroll tax configured",
      taxConfig.rate > 0
        ? `Tax treasury balance L$${Number(taxConfig.treasury?.balance || 0)}`
        : "Tenant payroll runs deposit full wages with no withholding"
    ],
    [
      "Security",
      "Vault incidents, dispatch, and ATM network",
      {
        chip: activeIncidentCount ? "ALERT" : (atmSummary.offline ? "DEGRADED" : "NORMAL"),
        tone: activeIncidentCount ? "alert" : (atmSummary.offline ? "dim" : "")
      },
      `${activeIncidentCount} active incident(s) / ${atmSummary.offline} ATM(s) offline`,
      activeIncidentCount
        ? (state.incident?.stage || "Incident response active")
        : (atmSummary.total ? `${atmSummary.online}/${atmSummary.total} ATM(s) online` : "No ATM network records configured")
    ]
  ];
}

function getReportRows(store) {
  const transactions = getTransactions(store);
  const customerAccounts = safeArray(store.accounts).filter((account) => account.player_id);
  const organizationAccounts = safeArray(store.accounts).filter((account) => !account.player_id);
  const totalCustomerBalances = customerAccounts.reduce((total, account) => total + Number(account.balance || 0), 0);
  const totalTreasuryBalances = organizationAccounts.reduce((total, account) => total + Number(account.balance || 0), 0);
  const payrollTransactions = transactions.filter((txn) => txn.type === "PAYROLL");
  const taxTransactions = transactions.filter((txn) => txn.type === "PAYROLL_TAX");
  const playerTransferTransactions = transactions.filter((txn) => txn.type === "PLAYER_TRANSFER");
  const disbursementTransactions = transactions.filter((txn) => txn.type === "TREASURY_DISBURSEMENT");
  const dueFineAmount = getTotalDueFines(store);
  const activeLoanBalance = getTotalActiveLoanBalance(store);
  const riskSummary = getOrganizationRiskSummary(store);
  const payrollHealth = getPayrollHealth(store);
  const taxConfig = getTaxConfiguration(store);

  return [
    [
      "Customer Deposits",
      "Player Account Balances",
      { money: totalCustomerBalances },
      { chip: customerAccounts.length ? "LIVE" : "IDLE", tone: customerAccounts.length ? "" : "dim" },
      `${customerAccounts.length} player account(s)`
    ],
    [
      "Treasury Holdings",
      "Organization Treasury Balances",
      { money: totalTreasuryBalances },
      { chip: organizationAccounts.length ? "FUNDED" : "IDLE", tone: organizationAccounts.length ? "" : "dim" },
      `${organizationAccounts.length} treasury account(s)`
    ],
    [
      "Payroll Outflow",
      "Gross payroll transactions on record",
      { money: payrollTransactions.reduce((total, txn) => total + Number(txn.amount || 0), 0) },
      { chip: payrollHealth.label, tone: payrollHealth.tone },
      payrollHealth.note
    ],
    [
      "Tax Collected",
      "Payroll tax withheld to public treasury",
      { money: taxTransactions.reduce((total, txn) => total + Number(txn.amount || 0), 0) },
      { chip: taxConfig.rate > 0 ? "WITHHOLDING" : "DISABLED", tone: taxConfig.rate > 0 ? "" : "dim" },
      taxConfig.rate > 0
        ? `${taxConfig.rate}% routed to ${taxConfig.organization?.name || "UNASSIGNED"}`
        : "No payroll tax configured"
    ],
    [
      "Player Transfers",
      "Customer-to-customer movement",
      { money: playerTransferTransactions.filter((txn) => txn.direction === "OUT").reduce((total, txn) => total + Number(txn.amount || 0), 0) },
      { chip: playerTransferTransactions.length ? "ACTIVE" : "IDLE", tone: playerTransferTransactions.length ? "" : "dim" },
      `${Math.floor(playerTransferTransactions.length / 2)} transfer event(s)`
    ],
    [
      "Public Disbursements",
      "Treasury payments to players",
      { money: disbursementTransactions.filter((txn) => txn.direction === "OUT").reduce((total, txn) => total + Number(txn.amount || 0), 0) },
      { chip: disbursementTransactions.length ? "FLOWING" : "IDLE", tone: disbursementTransactions.length ? "" : "dim" },
      `${Math.floor(disbursementTransactions.length / 2)} treasury disbursement(s)`
    ],
    [
      "Outstanding Fines",
      "Collections still due",
      { money: dueFineAmount },
      { chip: dueFineAmount > 0 ? "COLLECTIONS" : "CLEAR", tone: dueFineAmount > 0 ? "alert" : "" },
      `${safeArray(store.fines).filter((fine) => fine.status === "DUE").length} due fine(s)`
    ],
    [
      "Active Credit",
      "Loan principal currently outstanding",
      { money: activeLoanBalance },
      { chip: activeLoanBalance > 0 ? "SERVICING" : "IDLE", tone: activeLoanBalance > 0 ? "" : "dim" },
      `${safeArray(store.loans).filter((loan) => loan.status === "ACTIVE").length} active loan(s)`
    ],
    [
      "Organization Watchlist",
      "Reserve and payroll funding risks",
      `${riskSummary.payrollRisk} payroll / ${riskSummary.underReserve} reserve / ${riskSummary.overBudget} budget`,
      { chip: (riskSummary.payrollRisk || riskSummary.underReserve || riskSummary.overBudget) ? "WATCH" : "STABLE", tone: (riskSummary.payrollRisk || riskSummary.underReserve || riskSummary.overBudget) ? "alert" : "" },
      `${riskSummary.active} active organization(s)`
    ]
  ];
}

function getAlertRows(store) {
  const rows = [];
  const riskSummary = getOrganizationRiskSummary(store);
  const payrollHealth = getPayrollHealth(store);
  const taxConfig = getTaxConfiguration(store);
  const dueFines = safeArray(store.fines).filter((fine) => fine.status === "DUE");
  const activeLoans = safeArray(store.loans).filter((loan) => loan.status === "ACTIVE");
  const incidents = safeArray(store.vault_incidents).filter((incident) => incident.state === "ACTIVE");
  const offlineAtms = safeArray(store.atms).filter((atm) => atm.status !== "ONLINE");

  incidents.forEach((incident) => {
    rows.push([
      "CRITICAL",
      "Security Incident",
      incident.incident_id,
      incident.stage || "ACTIVE INCIDENT",
      `${incident.responding_unit || "NO UNIT"} / ${incident.last_update || "Awaiting response"}`
    ]);
  });

  offlineAtms.forEach((atm) => {
    rows.push([
      "WARN",
      "ATM Network",
      atm.atm_id || atm.id || "ATM",
      `ATM ${atm.status || "OFFLINE"}`,
      `${atm.branch_name || atm.branch || "Unknown branch"} is not online`
    ]);
  });

  if (payrollHealth.label === "PAYROLL RISK") {
    rows.push([
      "WARN",
      "Payroll Funding",
      "NEXT RUN",
      payrollHealth.label,
      payrollHealth.note
    ]);
  }

  if (taxConfig.rate > 0 && !taxConfig.organization) {
    rows.push([
      "WARN",
      "Taxation",
      "PAYROLL TAX",
      "MISCONFIGURED",
      "Payroll tax is enabled but no treasury organization is assigned"
    ]);
  }

  if (riskSummary.underReserve > 0) {
    rows.push([
      "WARN",
      "Treasury Reserve",
      "ORGANIZATIONS",
      "UNDER RESERVE",
      `${riskSummary.underReserve} organization(s) are below reserve target`
    ]);
  }

  if (riskSummary.overBudget > 0) {
    rows.push([
      "WARN",
      "Budget Oversight",
      "ORGANIZATIONS",
      "OVER BUDGET",
      `${riskSummary.overBudget} organization(s) exceed configured budget`
    ]);
  }

  if (dueFines.length) {
    rows.push([
      "NOTICE",
      "Collections",
      "OUTSTANDING FINES",
      `${dueFines.length} DUE`,
      `L$${getTotalDueFines(store)} still outstanding in fines`
    ]);
  }

  if (activeLoans.length) {
    rows.push([
      "NOTICE",
      "Credit Exposure",
      "ACTIVE LOANS",
      `${activeLoans.length} ACTIVE`,
      `L$${getTotalActiveLoanBalance(store)} remains outstanding in active loans`
    ]);
  }

  if (!rows.length) {
    rows.push([
      "OK",
      "System Health",
      "ALL MODULES",
      "NOMINAL",
      "No active alerts require operator action right now"
    ]);
  }

  return rows;
}

function ensureSelectedAccount(store) {
  const accounts = safeArray(store.accounts);
  if (!accounts.length) {
    state.selectedAccountId = null;
    return;
  }

  const stillExists = accounts.some((account) => account.account_id === state.selectedAccountId);
  if (!stillExists) {
    state.selectedAccountId = accounts[0].account_id;
  }
}

function getSelectedAccount(store) {
  return safeArray(store.accounts).find((account) => account.account_id === state.selectedAccountId) || null;
}

function matchesSearch(values) {
  if (!state.searchQuery) {
    return true;
  }

  const haystack = values.join(" ").toLowerCase();
  return haystack.includes(state.searchQuery);
}

function renderDetailPanel() {
  const panel = document.getElementById("detail-panel");
  const grid = document.getElementById("detail-grid");
  const store = state.store;

  if (!store || state.view !== "accounts") {
    panel.classList.add("hidden");
    grid.innerHTML = "";
    return;
  }

  const account = getSelectedAccount(store);
  if (!account) {
    panel.classList.add("hidden");
    grid.innerHTML = "";
    return;
  }

  const card = safeArray(store.cards).find((item) => item.account_id === account.account_id);
  const fine = safeArray(store.fines).find((item) => item.account_id === account.account_id);
  const loan = safeArray(store.loans).find((item) => item.account_id === account.account_id);
  const employment = safeArray(store.employments).find((item) => item.account_id === account.account_id && item.status === "ACTIVE");
  const recent = getTransactions(store).filter((item) => item.account_id === account.account_id).slice(0, 3);

  const items = [
    ["Account", `<strong>${account.account_id}</strong><br>${account.customer_name}<br>Status: ${account.status}`],
    ["Balances", `Bank Balance: <strong>L$${account.balance}</strong><br>Cash On Hand: L$${account.cash_on_hand}<br>Outstanding Fine: L$${account.outstanding_fine}<br>Loan Balance: L$${account.loan_balance}`],
    ["Card", card ? `${card.card_id}<br>State: <strong>${card.state}</strong><br>${card.card_number}` : "No linked card"],
    ["Obligations", `${fine ? `Fine: <strong>${fine.status}</strong> (${fine.reference})<br>` : "No active fine<br>"}${loan ? `Loan: <strong>${loan.status}</strong> (${loan.terms})` : "No active loan"}`],
    ["Recent Activity", recent.length ? recent.map((item) => `${item.type} L$${item.amount} ${item.direction}`).join("<br>") : "No transactions found"],
    ["Employment", employment ? `${employment.title}<br>${employment.employer_name}${employment.organization_id ? `<br>Org: <strong>${employment.organization_id}</strong>` : ""}<br>Pay Rate: <strong>L$${employment.pay_rate}</strong><br>Cycle: ${employment.pay_cycle}` : "No active employment"],
    ["Player Link", `Player ID: ${account.player_id || "-"}<br>Branch: ${account.branch_id || "-"}<br>Tenant: ${account.tenant_id || "-"}`]
  ];

  grid.innerHTML = items.map(([label, value]) => `
    <div class="detail-card">
      <div class="detail-label">${label}</div>
      <div class="detail-value">${value}</div>
    </div>
  `).join("");
  panel.classList.remove("hidden");
}

function getCurrentTenant() {
  if (state.session?.role === "platform_admin") {
    return null;
  }
  return safeArray(state.store?.tenants)[0] || null;
}

function setPlayerBanner(message, tone = "ok") {
  const banner = document.getElementById("player-portal-banner");
  if (!banner) {
    return;
  }
  banner.textContent = message;
  banner.classList.toggle("status-ok", tone !== "alert");
  banner.classList.toggle("status-alert", tone === "alert");
}

function getPrimaryPlayerCard() {
  return safeArray(state.store?.cards)[0] || null;
}

function getPlayerTransferDirectory() {
  return safeArray(state.store?.transfer_directory);
}

function renderPlayerPortal() {
  const store = state.store || {};
  const tenant = store.tenant || null;
  const account = store.account || null;
  const cards = safeArray(store.cards);
  const primaryCard = cards[0] || null;
  const fines = safeArray(store.fines);
  const loans = safeArray(store.loans);
  const dueFine = fines.find((item) => item.status === "DUE") || null;
  const activeLoan = loans.find((item) => item.status === "ACTIVE") || null;
  const transferDirectory = getPlayerTransferDirectory();
  const transactions = safeArray(store.transactions).slice(0, 8);
  const employment = safeArray(store.employments).find((item) => item.status === "ACTIVE") || null;

  document.getElementById("player-tenant-name").textContent = (tenant?.name || "NO TENANT").toUpperCase();
  document.getElementById("player-tenant-bank").textContent = (tenant?.bank_name || "NO BANK").toUpperCase();
  document.getElementById("player-username").textContent = (state.session?.username || "CUSTOMER").toUpperCase();
  document.getElementById("player-role").textContent = "ACCOUNT HOLDER";
  document.getElementById("player-header-user-line").textContent = "USERNAME: " + (state.session?.username || "CUSTOMER").toUpperCase();
  const bankParts = splitBankDisplay(tenant?.bank_name || "Customer Banking");
  document.getElementById("player-crest-shield").textContent = initialsFromName(tenant?.bank_name || "Customer");
  document.getElementById("player-crest-subtitle").textContent = bankParts[0];
  document.getElementById("player-crest-title").textContent = bankParts[1];

  document.getElementById("player-metric-account").textContent = account?.account_id || "-";
  document.getElementById("player-metric-balance").textContent = `L$${Number(account?.balance || 0)}`;
  document.getElementById("player-metric-cards").textContent = String(cards.length);
  document.getElementById("player-metric-fines").textContent = String(fines.filter((item) => item.status === "DUE").length);
  document.getElementById("player-metric-loans").textContent = String(loans.filter((item) => item.status === "ACTIVE").length);
  document.getElementById("player-metric-employment").textContent = employment ? employment.title.toUpperCase() : "NONE";

  const summaryItems = [
    ["Account", `<strong>${account?.account_id || "-"}</strong><br>${account?.customer_name || "-"}<br>Status: ${account?.status || "UNKNOWN"}`],
    ["Balances", `Bank Balance: <strong>L$${Number(account?.balance || 0)}</strong><br>Cash On Hand: L$${Number(account?.cash_on_hand || 0)}<br>Outstanding Fine: L$${Number(account?.outstanding_fine || 0)}<br>Loan Balance: L$${Number(account?.loan_balance || 0)}`],
    ["Cards", cards.length ? cards.map((card) => `${card.card_id}<br>State: <strong>${card.state}</strong><br>${card.card_number}`).join("<br><br>") : "No active cards"],
    ["Employment", employment ? `${employment.title}<br>${employment.employer_name}<br>Pay Rate: <strong>L$${employment.pay_rate}</strong><br>Cycle: ${employment.pay_cycle}` : "No active employment"],
    ["Obligations", `${fines.length ? fines.map((fine) => `Fine ${fine.reference}: <strong>${fine.status}</strong> L$${fine.amount}`).join("<br>") : "No active fines"}<br><br>${loans.length ? loans.map((loan) => `Loan ${loan.loan_id}: <strong>${loan.status}</strong> L$${loan.balance}`).join("<br>") : "No active loans"}`]
  ];
  document.getElementById("player-summary-grid").innerHTML = summaryItems.map(([label, value]) => `
    <div class="detail-card">
      <div class="detail-label">${label}</div>
      <div class="detail-value">${value}</div>
    </div>
  `).join("");

  document.getElementById("player-transactions-body").innerHTML = transactions.length
    ? transactions.map((txn) => `
      <tr>
        <td>${txn.type}</td>
        <td class="money">L$${Number(txn.amount || 0)}</td>
        <td><span class="chip ${txn.direction === "OUT" ? "alert" : ""}">${txn.direction}</span></td>
        <td>${txn.memo || "-"}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4" class="dim-copy">No transactions available.</td></tr>`;

  document.getElementById("player-card-state").textContent = cards.length ? cards.map((item) => item.state).join(", ") : "NONE";
  document.getElementById("player-fine-state").textContent = fines.some((item) => item.status === "DUE") ? "PAYMENT DUE" : "CLEAR";
  document.getElementById("player-loan-state").textContent = loans.some((item) => item.status === "ACTIVE") ? "ACTIVE" : "NONE";
  document.getElementById("player-job-state").textContent = employment ? `${employment.title} / ${employment.employer_name}` : "UNLINKED";
  document.getElementById("player-status-line-1").textContent = "PORTAL: ONLINE";
  document.getElementById("player-status-line-2").textContent = `ACCOUNT: ${account?.status || "UNKNOWN"}`;
  document.getElementById("player-status-line-3").textContent = "MODE: " + (CONFIG.siteMode === "vps" ? "VPS API" : (CONFIG.apiUrl ? "APPS SCRIPT BRIDGE" : "STATIC PREVIEW"));

  const lockButton = document.getElementById("player-lock-card-btn");
  const unlockButton = document.getElementById("player-unlock-card-btn");
  const reportButton = document.getElementById("player-report-card-btn");
  const fineButton = document.getElementById("player-pay-fine-btn");
  const loanButton = document.getElementById("player-pay-loan-btn");
  const transferButton = document.getElementById("player-transfer-btn");
  if (lockButton && unlockButton && reportButton && fineButton && loanButton && transferButton) {
    lockButton.disabled = !primaryCard || primaryCard.state !== "ACTIVE";
    unlockButton.disabled = !primaryCard || primaryCard.state !== "LOCKED";
    reportButton.disabled = !primaryCard || primaryCard.state === "STOLEN";
    fineButton.disabled = !dueFine;
    loanButton.disabled = !activeLoan;
    transferButton.disabled = !account || !transferDirectory.length || account.status !== "ACTIVE";
  }

  if (!primaryCard) {
    setPlayerBanner("[OK] ACCOUNT SERVICES AVAILABLE", "ok");
  } else if (primaryCard.state === "STOLEN") {
    setPlayerBanner("[!] CARD REPORTED STOLEN", "alert");
  } else if (primaryCard.state === "LOCKED") {
    setPlayerBanner("[!] CARD CURRENTLY LOCKED", "alert");
  } else {
    setPlayerBanner("[OK] ACCOUNT SERVICES AVAILABLE", "ok");
  }
}

function applyStore(store) {
  state.store = store;
  if (isCustomerSession()) {
    renderPlayerPortal();
    return;
  }
  ensureSelectedAccount(store);
  state.incident = safeArray(store.vault_incidents)[0] || null;
  state.atmNetwork = buildAtmNetwork(store);
  renderTenant();
  renderMetrics();
  renderIncident();
  seedLogs(store);
  renderLogs();
  setActiveView(state.view);
}

function renderTable(view) {
  const store = state.store;
  const head = document.getElementById("table-head");
  const body = document.getElementById("table-body");
  const foot = document.getElementById("accounts-foot");
  const title = document.getElementById("view-title");
  const searchInput = document.getElementById("table-search");
  let columns = [];
  let rows = [];

  const searchPlaceholders = {
    platform: "Search tenant, bank, owner, license, or activity",
    "bank-core": "Search module, scope, health, or note",
    accounts: "Search customer, account, balance, or status",
    organizations: "Search organization, type, treasury account, balance, or status",
    employment: "Search employee, employer, title, department, or pay rate",
    staff: "Search username, avatar, role, or status",
    cards: "Search card, account, state, or card number",
    transactions: "Search type, account, amount, direction, or memo",
    fines: "Search fine, account, reference, amount, or status",
    loans: "Search loan, account, terms, balance, or status",
    "vault-control": "Search vault, stage, unit, or marked cash",
    incidents: "Search incident, actor, stage, or state",
    payroll: "Search payroll type, account, amount, or memo",
    "atm-network": "Search ATM, branch, status, or scope",
    "audit-logs": "Search action, actor, target, or status"
  };
  if (searchInput) {
    searchInput.placeholder = searchPlaceholders[view] || "Search records";
  }

  if (view === "platform") {
    title.textContent = "Platform";
    columns = ["Tenant ID", "Tenant", "License", "Expiry", "Health", "Owner", "Last Activity", "Actions"];
    rows = safeArray(store.tenants)
      .filter((tenant) => matchesSearch([
        tenant.tenant_id,
        tenant.name,
        tenant.bank_name,
        tenant.status,
        tenant.primary_region_name || "",
        tenant.owner_username || "",
        tenant.activation_code || "",
        getLicenseStatusInfo(getLicenseForTenant(store, tenant.tenant_id)).label,
        getLicenseStatusInfo(getLicenseForTenant(store, tenant.tenant_id)).detail,
        getTenantActivity(store, tenant.tenant_id)
      ]))
      .map((tenant) => [
        tenant.tenant_id,
        `${tenant.name}<br><span class="dim-copy">${tenant.bank_name}</span>`,
        (() => {
          const info = getLicenseStatusInfo(getLicenseForTenant(store, tenant.tenant_id));
          return { chip: info.label, tone: info.tone };
        })(),
        (() => getLicenseStatusInfo(getLicenseForTenant(store, tenant.tenant_id)).detail)(),
        (() => {
          const health = getTenantHealth(store, tenant.tenant_id);
          return { chip: health.label, tone: health.tone };
        })(),
        tenant.owner_username ? tenant.owner_username : ("Activation: " + (tenant.activation_code || "PENDING")),
        getTenantActivity(store, tenant.tenant_id),
        {
          actions: [
            { label: "Edit", kind: "edit-tenant", tenantId: tenant.tenant_id, permission: "manage_tenant" },
            !tenant.owner_username
              ? { label: "Reissue Code", kind: "reissue-code", tenantId: tenant.tenant_id, permission: "reissue_activation_code" }
              : null,
            tenant.status === "ACTIVE"
              ? { label: "Suspend", kind: "suspend-tenant", tenantId: tenant.tenant_id, tone: "danger", permission: "suspend_tenant" }
              : { label: "Activate", kind: "activate-tenant", tenantId: tenant.tenant_id, permission: "activate_tenant" },
            { label: "Extend 30d", kind: "extend-license", tenantId: tenant.tenant_id, permission: "extend_license" },
            getLicenseStatusInfo(getLicenseForTenant(store, tenant.tenant_id)).label === "SUSPENDED"
              ? { label: "Activate License", kind: "activate-license", tenantId: tenant.tenant_id, permission: "activate_license" }
              : { label: "Suspend License", kind: "suspend-license", tenantId: tenant.tenant_id, tone: "danger", permission: "suspend_license" },
            { label: "Expire", kind: "expire-license", tenantId: tenant.tenant_id, tone: "danger", permission: "expire_license" },
            { label: "Delete", kind: "delete-tenant", tenantId: tenant.tenant_id, tone: "danger", permission: "delete_tenant" }
          ].filter(Boolean)
        }
      ]);
  } else if (view === "bank-core") {
    title.textContent = "Bank Core";
    columns = ["Module", "Scope", "Health", "Live Signal", "Operator Note"];
    rows = getBankCoreRows(store)
      .filter((row) => matchesSearch([
        row[0],
        row[1],
        typeof row[2] === "object" ? row[2].chip : row[2],
        row[3],
        row[4]
      ]));
  } else if (view === "alerts") {
    title.textContent = "Alerts";
    columns = ["Severity", "Category", "Target", "State", "Detail"];
    rows = getAlertRows(store)
      .filter((row) => matchesSearch(row))
      .map((row) => [
        { chip: row[0], tone: row[0] === "CRITICAL" ? "alert" : (row[0] === "WARN" ? "dim" : "") },
        row[1],
        row[2],
        { chip: row[3], tone: row[3] === "MISCONFIGURED" || row[3] === "UNDER RESERVE" || row[3] === "OVER BUDGET" ? "alert" : "" },
        row[4]
      ]);
  } else if (view === "reports") {
    title.textContent = "Reports";
    columns = ["Report", "Scope", "Value", "Status", "Detail"];
    rows = getReportRows(store)
      .filter((row) => matchesSearch([
        row[0],
        row[1],
        typeof row[2] === "object" ? String(row[2].money) : row[2],
        typeof row[3] === "object" ? row[3].chip : row[3],
        row[4]
      ]));
  } else if (view === "accounts") {
    title.textContent = "Accounts";
    columns = ["Account ID", "Customer", "Balance", "Status", "Actions"];
    rows = (store.accounts || [])
      .filter((account) => matchesSearch([account.account_id, account.customer_name, String(account.balance), account.status]))
      .map((account) => [
      account.account_id,
      account.customer_name,
      { money: account.balance },
      { chip: account.status, tone: account.status === "ACTIVE" ? "" : "dim" },
      {
        actions: [
          { label: "Deposit", kind: "deposit", accountId: account.account_id, permission: "deposit_account" },
          { label: "Withdraw", kind: "withdraw", accountId: account.account_id, permission: "withdraw_account" },
          { label: "Portal Access", kind: "create-customer-portal", accountId: account.account_id, permission: "create_customer_portal_user" },
          account.status === "ACTIVE"
            ? { label: "Freeze", kind: "freeze", accountId: account.account_id, tone: "danger", permission: "freeze_account" }
            : { label: "Unfreeze", kind: "unfreeze", accountId: account.account_id, permission: "unfreeze_account" }
        ]
      }
    ]);
  } else if (view === "organizations") {
    title.textContent = "Organizations";
    columns = ["Org ID", "Organization", "Type", "Treasury", "Budget", "Health", "Status", "Actions"];
    rows = safeArray(store.organizations)
      .filter((organization) => {
        const treasury = safeArray(store.accounts).find((account) => account.account_id === organization.treasury_account_id);
        const burden = getOrganizationPayrollBurden(store, organization.organization_id);
        return matchesSearch([
          organization.organization_id,
          organization.name,
          organization.organization_type,
          organization.department_name || "",
          organization.treasury_account_id || "",
          treasury ? String(treasury.balance) : "",
          String(burden),
          String(organization.budget_amount || 0),
          String(organization.reserve_target || 0),
          organization.budget_cycle || "",
          organization.status,
          organization.notes || ""
        ]);
      })
      .map((organization) => {
        const treasury = safeArray(store.accounts).find((account) => account.account_id === organization.treasury_account_id);
        const tenant = safeArray(store.tenants).find((item) => item.tenant_id === organization.tenant_id);
        const burden = getOrganizationPayrollBurden(store, organization.organization_id);
        const treasuryBalance = Number(treasury?.balance || 0);
        const treasuryTone = burden > 0 && treasuryBalance < burden ? "alert" : "";
        const budgetAmount = Number(organization.budget_amount || 0);
        const reserveTarget = Number(organization.reserve_target || 0);
        const health = getOrganizationHealth(store, organization);
        return [
          organization.organization_id,
          `${organization.name}${organization.department_name ? `<br><span class="dim-copy">${organization.department_name}</span>` : ""}${state.session?.role === "platform_admin" ? `<br><span class="dim-copy">${tenant?.name || organization.tenant_id}</span>` : ""}`,
          { chip: organization.organization_type, tone: organization.organization_type === "GOVERNMENT" ? "dim" : "" },
          `${organization.treasury_account_id || "UNASSIGNED"}<br><span class="dim-copy ${treasuryTone}">L$${treasuryBalance}</span>`,
          `${budgetAmount > 0 ? `L$${budgetAmount}` : "UNSET"}<br><span class="dim-copy">${organization.budget_cycle || "MONTHLY"} / Reserve L$${reserveTarget}</span><br><span class="dim-copy">Payroll L$${burden}</span>`,
          { chip: health.label, tone: health.tone },
          { chip: organization.status, tone: organization.status === "ACTIVE" ? "" : "dim" },
          {
            actions: [
              { label: "Fund", kind: "fund-organization", organizationId: organization.organization_id, permission: "fund_organization" },
              { label: "Spend", kind: "spend-organization", organizationId: organization.organization_id, tone: "danger", permission: "spend_organization" },
              { label: "Transfer", kind: "transfer-organization", organizationId: organization.organization_id, permission: "transfer_organization" },
              { label: "Disburse", kind: "disburse-organization", organizationId: organization.organization_id, permission: "disburse_organization" },
              { label: "Edit", kind: "edit-organization", organizationId: organization.organization_id, permission: "update_organization" },
              organization.status === "ACTIVE"
                ? { label: "Deactivate", kind: "deactivate-organization", organizationId: organization.organization_id, tone: "danger", permission: "deactivate_organization" }
                : { label: "Reactivate", kind: "reactivate-organization", organizationId: organization.organization_id, permission: "reactivate_organization" }
            ].filter(Boolean)
          }
        ];
      });
  } else if (view === "employment") {
    title.textContent = "Employment";
    columns = ["Employment ID", "Employee", "Employer", "Org", "Title", "Pay Rate", "Status", "Actions"];
    rows = safeArray(store.employments)
      .filter((employment) => {
        const account = safeArray(store.accounts).find((item) => item.account_id === employment.account_id);
        return matchesSearch([
          employment.employment_id,
          employment.account_id,
          account?.customer_name || "",
          employment.employer_name,
          employment.organization_id || "",
          employment.department_name || "",
          employment.title,
          employment.status,
          String(employment.pay_rate)
        ]);
      })
      .map((employment) => {
        const account = safeArray(store.accounts).find((item) => item.account_id === employment.account_id);
        return [
          employment.employment_id,
          `${account?.customer_name || employment.account_id}<br><span class="dim-copy">${employment.account_id}</span>`,
          `${employment.employer_name}${employment.department_name ? `<br><span class="dim-copy">${employment.department_name}</span>` : ""}`,
          employment.organization_id ? `<span class="dim-copy">${employment.organization_id}</span>` : "-",
          `${employment.title}<br><span class="dim-copy">${employment.pay_cycle}</span>`,
          { money: employment.pay_rate },
          { chip: employment.status, tone: employment.status === "ACTIVE" ? "" : "dim" },
          {
            actions: [
              { label: "Edit", kind: "edit-employment", employmentId: employment.employment_id, permission: "update_employment" },
              employment.status === "ACTIVE"
                ? { label: "Terminate", kind: "terminate-employment", employmentId: employment.employment_id, tone: "danger", permission: "terminate_employment" }
                : null
            ].filter(Boolean)
          }
        ];
      });
  } else if (view === "staff") {
    title.textContent = "Staff Users";
    columns = ["Username", "Avatar", "Role", "Status", "Actions"];
    rows = safeArray(store.users)
      .filter((staffUser) => matchesSearch([staffUser.username, staffUser.avatar_name || "", staffUser.role, staffUser.status]))
      .map((staffUser) => [
      staffUser.username,
      staffUser.avatar_name || "-",
      prettyRole(staffUser.role),
      { chip: staffUser.status, tone: staffUser.status === "ACTIVE" ? "" : "alert" },
      {
        actions: [
          { label: "Reset Session", kind: "reset-staff-session", userId: staffUser.user_id, permission: "reset_staff_session" },
          staffUser.status === "ACTIVE"
            ? { label: "Disable", kind: "disable-staff", userId: staffUser.user_id, tone: "danger", permission: "disable_staff_user" }
            : { label: "Enable", kind: "enable-staff", userId: staffUser.user_id, permission: "enable_staff_user" }
        ]
      }
    ]);
  } else if (view === "cards") {
    title.textContent = "Cards";
    columns = ["Card ID", "Account", "State", "Actions"];
    rows = safeArray(store.cards)
      .filter((card) => matchesSearch([card.card_id, card.account_id, card.state, card.card_number || ""]))
      .map((card) => [
      card.card_id,
      card.account_id,
      { chip: card.state, tone: card.state === "ACTIVE" ? "" : "alert" },
      {
        actions: [
          card.state === "ACTIVE"
            ? { label: "Lock", kind: "lock-card", cardId: card.card_id, tone: "danger", permission: "lock_card" }
            : { label: "Unlock", kind: "unlock-card", cardId: card.card_id, permission: "unlock_card" },
          { label: "Report Stolen", kind: "report-stolen-card", cardId: card.card_id, tone: "danger", permission: "report_stolen_card" }
        ]
      }
    ]);
  } else if (view === "transactions") {
    title.textContent = "Transactions";
    columns = ["Type", "Account", "Amount", "Direction"];
    rows = getTransactions(store)
      .filter((txn) => matchesSearch([txn.type, txn.account_id, String(txn.amount), txn.direction, txn.memo || ""]))
      .map((txn) => [
      txn.type,
      txn.account_id,
      { money: txn.amount },
      { chip: txn.direction, tone: txn.direction === "OUT" ? "alert" : "" }
    ]);
  } else if (view === "vault-control") {
    title.textContent = "Vault Control";
    columns = ["Vault", "Stage", "Unit", "Marked Cash"];
    rows = state.incident ? [[
      state.incident.vault_id,
      state.incident.stage,
      state.incident.responding_unit,
      state.incident.marked_cash_flag ? "YES" : "NO"
    ]] : [];
  } else if (view === "incidents") {
    title.textContent = "Incidents";
    columns = ["Incident ID", "Actor", "Stage", "State"];
    rows = safeArray(store.vault_incidents)
      .filter((incident) => matchesSearch([incident.incident_id, incident.actor_name, incident.stage, incident.state]))
      .map((incident) => [
      incident.incident_id,
      incident.actor_name,
      incident.stage,
      { chip: incident.state, tone: incident.state === "ACTIVE" ? "alert" : "dim" }
    ]);
  } else if (view === "payroll") {
    title.textContent = "Payroll";
    columns = ["Type", "Account", "Amount", "Memo"];
    rows = getTransactions(store)
      .filter((txn) => txn.type === "PAYROLL")
      .filter((txn) => matchesSearch([txn.type, txn.account_id, String(txn.amount), txn.memo || ""]))
      .map((txn) => [txn.type, txn.account_id, { money: txn.amount }, txn.memo]);
  } else if (view === "fines") {
    title.textContent = "Fines";
    columns = ["Fine ID", "Account", "Amount", "Status", "Actions"];
    rows = safeArray(store.fines)
      .filter((fine) => matchesSearch([fine.fine_id, fine.account_id, fine.reference, fine.status, String(fine.amount)]))
      .map((fine) => [
      fine.fine_id,
      fine.account_id,
      { money: fine.amount },
      { chip: fine.status, tone: fine.status === "DUE" ? "alert" : "" },
      {
        actions: fine.status === "DUE"
          ? [{ label: "Pay Fine", kind: "pay-fine", fineId: fine.fine_id, permission: "pay_fine" }]
          : []
      }
    ]);
  } else if (view === "loans") {
    title.textContent = "Loans";
    columns = ["Loan ID", "Account", "Balance", "Status", "Actions"];
    rows = safeArray(store.loans)
      .filter((loan) => matchesSearch([loan.loan_id, loan.account_id, loan.terms, loan.status, String(loan.balance)]))
      .map((loan) => [
      loan.loan_id,
      loan.account_id,
      { money: loan.balance },
      { chip: loan.status, tone: loan.status === "ACTIVE" ? "" : "dim" },
      {
        actions: loan.status === "ACTIVE"
          ? [{ label: "Pay Loan", kind: "pay-loan", loanId: loan.loan_id, permission: "pay_loan" }]
          : []
      }
    ]);
  } else if (view === "atm-network") {
    title.textContent = "ATM Network";
    columns = ["ATM ID", "Branch", "Status", "Scope"];
    rows = state.atmNetwork
      .filter((atm) => matchesSearch([atm.id, atm.branch, atm.status, atm.scope]))
      .map((atm) => [
      atm.id,
      atm.branch,
      { chip: atm.status, tone: atm.status === "ONLINE" ? "" : "alert" },
      atm.scope
    ]);
  } else if (view === "audit-logs") {
    title.textContent = "Audit Logs";
    columns = ["Action", "Actor", "Target", "Status"];
    rows = safeArray(store.audit_logs)
      .filter((audit) => matchesSearch([audit.action, audit.actor_name, audit.target_account_id || audit.object_id, audit.status]))
      .map((audit) => [
      audit.action,
      audit.actor_name,
      audit.target_account_id || audit.object_id,
      { chip: String(audit.status || "").toUpperCase(), tone: audit.status === "approved" ? "" : "dim" }
    ]);
  }

  searchShell.classList.toggle("hidden", view === "vault-control");
  head.innerHTML = "<tr>" + columns.map((column) => `<th>${column}</th>`).join("") + "</tr>";
  body.innerHTML = rows.map((row) => {
    const isSelected = view === "accounts" && row[0] === state.selectedAccountId;
    return `<tr class="${isSelected ? "selected-row" : ""}" data-select-account="${view === "accounts" ? row[0] : ""}">` + row.map((cell) => {
    if (cell && typeof cell === "object" && "money" in cell) {
      return `<td class="money">L$${cell.money}</td>`;
    }
    if (cell && typeof cell === "object" && "chip" in cell) {
      return `<td><span class="chip ${cell.tone || ""}">${cell.chip}</span></td>`;
    }
    if (cell && typeof cell === "object" && "actions" in cell) {
      return `<td><div class="row-actions">${cell.actions.length ? cell.actions.map((action) =>
        `<button class="row-action ${action.tone || ""}" type="button" ${action.permission && !hasPermission(action.permission) ? "disabled" : ""} data-row-action="${action.kind}" data-account-id="${action.accountId || ""}" data-card-id="${action.cardId || ""}" data-fine-id="${action.fineId || ""}" data-loan-id="${action.loanId || ""}" data-user-id="${action.userId || ""}" data-tenant-id="${action.tenantId || ""}" data-employment-id="${action.employmentId || ""}" data-organization-id="${action.organizationId || ""}">${action.label}</button>`
      ).join("") : '<span class="dim-copy">No actions</span>'}</div></td>`;
    }
    return `<td>${cell}</td>`;
  }).join("") + "</tr>";
  }).join("");
  foot.textContent = "Showing " + rows.length + " records for " + title.textContent.toUpperCase();
  syncControlStates();
  renderDetailPanel();
}

function setActiveView(view) {
  if (!canAccessView(view)) {
    addLog("Access denied for " + view.toUpperCase() + ".");
    return;
  }
  state.view = view;
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
    link.classList.toggle("hidden", !canAccessView(link.dataset.view));
  });
  const actionButton = document.getElementById("view-action-btn");
  actionButton.classList.toggle("hidden", !(view === "platform" || view === "payroll" || view === "accounts" || view === "organizations" || view === "employment" || view === "staff"));
  actionButton.textContent = view === "platform"
    ? "New Tenant"
    : (view === "accounts"
      ? "New Account"
      : (view === "organizations"
        ? "New Org"
        : (view === "employment" ? "New Job" : (view === "staff" ? "New Staff" : "Run Payroll"))));
  actionButton.disabled =
    view === "platform"
      ? !hasPermission("create_tenant")
      : (view === "accounts"
        ? !hasPermission("create_customer_account")
        : (view === "organizations"
          ? !hasPermission("create_organization")
          : (view === "employment" ? !hasPermission("create_employment") : (view === "staff" ? !hasPermission("create_staff_user") : (view === "payroll" ? !hasPermission("run_payroll") : false)))));
  renderTable(view);
  savePreviewState();
}

function setAuthTab(tab) {
  document.getElementById("login-tab").classList.toggle("active", tab === "login");
  document.getElementById("setup-tab").classList.toggle("active", tab === "setup");
  document.getElementById("login-card").classList.toggle("hidden", tab !== "login");
  document.getElementById("setup-card").classList.toggle("hidden", tab !== "setup");
}

function applySession(session) {
  state.session = session;
  saveSession(session);
  document.getElementById("auth-shell").classList.add("hidden");
  document.getElementById("admin-shell").classList.toggle("hidden", isCustomerSession());
  document.getElementById("player-shell").classList.toggle("hidden", !isCustomerSession());
  if (isCustomerSession()) {
    document.getElementById("admin-shell").classList.add("hidden");
  } else {
    document.getElementById("player-shell").classList.add("hidden");
  }
  document.getElementById("manage-tenant-btn").textContent = session.role === "platform_admin" ? "New Tenant" : "Manage Tenant";
  document.getElementById("admin-username").textContent = session.username.toUpperCase();
  document.getElementById("admin-role").textContent = (session.role || "tenant_owner").toUpperCase().replaceAll("_", " ");
  document.getElementById("header-user-line").textContent = "USERNAME: " + session.username.toUpperCase();
  updateClockDisplays();
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("hidden", !canAccessView(link.dataset.view));
  });
  if (!canAccessView(state.view)) {
    const fallback = session.role === "platform_admin"
      ? "platform"
      : (Object.keys(VIEW_PERMISSIONS).find((view) => canAccessView(view)) || "accounts");
    state.view = fallback;
  }
  resetRuntimeLogs(state.store);
  applyStore(state.store);
  if (session.must_reset_password && state.passwordResetPromptedToken !== session.token) {
    state.passwordResetPromptedToken = session.token;
    window.setTimeout(() => enforcePasswordReset(), 150);
  }
}

async function enforcePasswordReset() {
  if (!state.session || !state.session.must_reset_password) {
    return;
  }

  const values = await openActionModal({
    title: "Password Reset Required",
    submitLabel: "Update Password",
    copy: "This account is using a temporary password. Set a new password to continue.",
    fields: [
      { name: "new_password", label: "New Password", type: "password", required: true, value: "" }
    ]
  });
  if (!values) {
    addLog("Password reset still required for this account.");
    return;
  }
  const nextPassword = String(values.new_password || "");

  const result = await bridgeRequest("change_password", {
    token: state.session.token,
    tenant_id: state.session.tenant_id,
    new_password: nextPassword
  });

  if (!result.ok) {
    addLog(result.error || "Password reset failed.");
    state.passwordResetPromptedToken = null;
    return;
  }

  if (result.session) {
    state.session = result.session;
    saveSession(result.session);
  }
  if (result.store) {
    applyStore(result.store);
  }
  addLog(result.message || "Password changed.");
}

function logout(message) {
  state.session = null;
  clearSession();
  document.getElementById("admin-shell").classList.add("hidden");
  document.getElementById("player-shell").classList.add("hidden");
  document.getElementById("auth-shell").classList.remove("hidden");
  setAuthMessage(message || "Session closed. Login required to access the admin terminal.");
}

async function bridgeRequest(action, payload) {
  if (!CONFIG.apiUrl) {
    return demoRequest(action, payload);
  }

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action,
        ...payload
      })
    });
    const data = await response.json();
    if (data && data.ok) {
      setBridgeMode("APPS SCRIPT");
    } else if (data && isSessionError(data.error) && action !== "login") {
      handleSessionFailure(data.error);
    }
    return data;
  } catch (error) {
    setBridgeMode("DEMO FALLBACK");
    return demoRequest(action, payload);
  }
}

async function runAdminAction(actionType, extras = {}) {
  if (!state.session) {
    return { ok: false, error: "Login required." };
  }

  const payload = {
    token: state.session.token,
    tenant_id: state.session.tenant_id,
    username: state.session.username,
    actor_name: state.session.username,
    action_type: actionType,
    ...extras
  };

  const result = await bridgeRequest("admin_action", payload);
  if (!result.ok && isSessionError(result.error)) {
    handleSessionFailure(result.error);
  }
  return result;
}

async function runAccountAction(kind, accountId) {
  if (kind === "create-account") {
    const values = await openActionModal({
      title: "Create Customer Account",
      submitLabel: "Create Account",
      wide: true,
      fields: [
        { name: "avatar_name", label: "Customer Avatar Or Display Name", required: true, value: "" },
        { name: "opening_deposit", label: "Opening Deposit", type: "number", required: true, value: "0" },
        { name: "issue_card", label: "Issue Starting Bank Card", type: "select", value: "yes", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] }
      ]
    });
    if (!values) {
      return;
    }
    const avatarName = String(values.avatar_name || "").trim();
    const openingDeposit = Number(values.opening_deposit);
    if (!Number.isFinite(openingDeposit) || openingDeposit < 0) {
      addLog("Opening deposit must be zero or greater.");
      return;
    }
    const issueCard = String(values.issue_card || "yes") === "yes";
    const result = await runAdminAction("create_customer_account", {
      avatar_name: avatarName,
      opening_deposit: openingDeposit,
      issue_card: issueCard
    });
    if (!result.ok) {
      addLog(result.error || "Account creation failed.");
      return;
    }
    applyStore(result.store);
    addLog(result.message || `Created account for ${avatarName.trim()}.`);
    return;
  }

  if (kind === "create-customer-portal") {
    if (!accountId) {
      addLog("Missing account id for portal access.");
      return;
    }
    const account = safeArray(state.store?.accounts).find((item) => item.account_id === accountId);
    if (!account) {
      addLog("Account record not found.");
      return;
    }
    const values = await openActionModal({
      title: "Create Customer Portal Access",
      submitLabel: "Create Portal Login",
      copy: `Create a customer login for <strong>${account.customer_name}</strong>.`,
      fields: [
        { name: "username", label: "Portal Username", required: true, value: account.customer_name.toLowerCase().replace(/\s+/g, "") },
        { name: "password", label: "Temporary Password", type: "password", required: true, value: "changeme123" }
      ]
    });
    if (!values) {
      addLog("Customer portal creation canceled.");
      return;
    }
    const username = String(values.username || "").trim();
    const password = String(values.password || "");
    const result = await runAdminAction("create_customer_portal_user", {
      account_id: accountId,
      new_username: username,
      new_password: password
    });
    if (!result.ok) {
      addLog(result.error || "Customer portal access creation failed.");
      return;
    }
    applyStore(result.store);
    addLog(`Customer portal created for ${account.customer_name}. Username: ${username.trim()} Temp Password: ${password}`);
    return;
  }

  if (!accountId) {
    addLog("Missing account id for action.");
    return;
  }

  if (kind === "deposit" || kind === "withdraw") {
    const values = await openActionModal({
      title: `${kind === "deposit" ? "Deposit Funds" : "Withdraw Funds"}`,
      submitLabel: kind === "deposit" ? "Apply Deposit" : "Apply Withdrawal",
      fields: [
        { name: "amount", label: "Amount", type: "number", required: true, value: "100" }
      ]
    });
    if (!values) {
      return;
    }
    const amount = Number(values.amount);
    if (!amount || amount < 1) {
      addLog("Amount must be greater than zero.");
      return;
    }

    const result = await runAdminAction(kind === "deposit" ? "deposit_account" : "withdraw_account", {
      account_id: accountId,
      amount
    });

    if (!result.ok) {
      addLog(result.error || `${kind} failed.`);
      return;
    }

    applyStore(result.store);
    addLog(result.message || `${kind} applied to ${accountId}.`);
    return;
  }

  if (kind === "freeze" || kind === "unfreeze") {
    const result = await runAdminAction(kind === "freeze" ? "freeze_account" : "unfreeze_account", {
      account_id: accountId
    });

    if (!result.ok) {
      addLog(result.error || `${kind} failed.`);
      return;
    }

    applyStore(result.store);
    addLog(result.message || `${kind} applied to ${accountId}.`);
  }
}

async function runCardAction(kind, cardId) {
  if (!cardId) {
    addLog("Missing card id for action.");
    return;
  }

  const mapping = {
    "lock-card": "lock_card",
    "unlock-card": "unlock_card",
    "report-stolen-card": "report_stolen_card"
  };

  const result = await runAdminAction(mapping[kind], { card_id: cardId });
  if (!result.ok) {
    addLog(result.error || `${kind} failed.`);
    return;
  }

  applyStore(result.store);
  addLog(result.message || `${kind} applied to ${cardId}.`);
}

async function runPlayerCardAction(kind) {
  const card = getPrimaryPlayerCard();
  if (!card) {
    setPlayerBanner("[!] NO LINKED CARD AVAILABLE", "alert");
    return;
  }

  const mapping = {
    "player-lock-card": "lock_card",
    "player-unlock-card": "unlock_card",
    "player-report-card": "report_stolen_card"
  };

  const action = mapping[kind];
  if (!action) {
    return;
  }

  const result = await runAdminAction(action, { card_id: card.card_id });
  if (!result.ok) {
    setPlayerBanner("[!] " + String(result.error || "Card request failed.").toUpperCase(), "alert");
    return;
  }

  applyStore(result.store);
  if (action === "lock_card") {
    setPlayerBanner("[!] CARD LOCKED BY ACCOUNT HOLDER", "alert");
  } else if (action === "unlock_card") {
    setPlayerBanner("[OK] CARD UNLOCKED", "ok");
  } else {
    setPlayerBanner("[!] CARD REPORTED STOLEN", "alert");
  }
}

async function runPlayerFineAction() {
  const fine = safeArray(state.store?.fines).find((item) => item.status === "DUE");
  if (!fine) {
    setPlayerBanner("[OK] NO DUE FINES FOUND", "ok");
    return;
  }

  const confirmed = await confirmAction(
    "Pay Outstanding Fine",
    `This will pay <strong>${fine.reference || fine.fine_id}</strong> for <strong>L$${Number(fine.amount || 0)}</strong> from your linked bank account.`,
    "Pay Fine"
  );
  if (!confirmed) {
    return;
  }

  const result = await runAdminAction("pay_fine", { fine_id: fine.fine_id });
  if (!result.ok) {
    setPlayerBanner("[!] " + String(result.error || "Fine payment failed.").toUpperCase(), "alert");
    return;
  }

  applyStore(result.store);
  setPlayerBanner("[OK] FINE PAYMENT POSTED", "ok");
}

async function runPlayerLoanAction() {
  const loan = safeArray(state.store?.loans).find((item) => item.status === "ACTIVE");
  if (!loan) {
    setPlayerBanner("[OK] NO ACTIVE LOANS FOUND", "ok");
    return;
  }

  const values = await openActionModal({
    title: "Pay Loan Balance",
    submitLabel: "Apply Payment",
    copy: `Submit a payment toward <strong>${loan.loan_id}</strong>. Current balance: <strong>L$${Number(loan.balance || 0)}</strong>.`,
    fields: [
      { name: "amount", label: "Payment Amount", type: "number", required: true, value: String(Math.min(Number(loan.balance || 0), 75) || 25) }
    ]
  });
  if (!values) {
    return;
  }

  const amount = Number(values.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    setPlayerBanner("[!] PAYMENT AMOUNT MUST BE GREATER THAN ZERO", "alert");
    return;
  }

  const result = await runAdminAction("pay_loan", { loan_id: loan.loan_id, amount });
  if (!result.ok) {
    setPlayerBanner("[!] " + String(result.error || "Loan payment failed.").toUpperCase(), "alert");
    return;
  }

  applyStore(result.store);
  setPlayerBanner("[OK] LOAN PAYMENT POSTED", "ok");
}

async function runPlayerTransferAction() {
  const account = state.store?.account || null;
  const transferDirectory = getPlayerTransferDirectory();

  if (!account || account.status !== "ACTIVE") {
    setPlayerBanner("[!] SOURCE ACCOUNT IS NOT ACTIVE", "alert");
    return;
  }
  if (!transferDirectory.length) {
    setPlayerBanner("[!] NO CUSTOMER RECIPIENTS AVAILABLE", "alert");
    return;
  }

  const values = await openActionModal({
    title: "Transfer Funds",
    submitLabel: "Send Transfer",
    copy: `Send funds from <strong>${account.account_id}</strong>. Available balance: <strong>L$${Number(account.balance || 0)}</strong>.`,
    wide: true,
    fields: [
      {
        name: "target_account_id",
        label: "Recipient Account",
        type: "select",
        required: true,
        value: transferDirectory[0]?.account_id || "",
        options: transferDirectory.map((item) => ({
          value: item.account_id,
          label: `${item.customer_name} (${item.account_id})`
        }))
      },
      { name: "amount", label: "Transfer Amount", type: "number", required: true, value: "50" },
      { name: "memo", label: "Memo", value: "" }
    ]
  });
  if (!values) {
    return;
  }

  const amount = Number(values.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    setPlayerBanner("[!] TRANSFER AMOUNT MUST BE GREATER THAN ZERO", "alert");
    return;
  }

  const result = await runAdminAction("transfer_funds", {
    source_account_id: account.account_id,
    target_account_id: String(values.target_account_id || "").trim(),
    amount,
    memo: String(values.memo || "").trim()
  });
  if (!result.ok) {
    setPlayerBanner("[!] " + String(result.error || "Transfer failed.").toUpperCase(), "alert");
    return;
  }

  applyStore(result.store);
  setPlayerBanner("[OK] TRANSFER POSTED", "ok");
}

async function runFineAction(fineId) {
  if (!fineId) {
    addLog("Missing fine id for action.");
    return;
  }

  const result = await runAdminAction("pay_fine", { fine_id: fineId });
  if (!result.ok) {
    addLog(result.error || "Fine payment failed.");
    return;
  }

  applyStore(result.store);
  addLog(result.message || `Fine paid for ${fineId}.`);
}

async function runLoanAction(loanId) {
  if (!loanId) {
    addLog("Missing loan id for action.");
    return;
  }

  const values = await openActionModal({
    title: "Loan Payment",
    submitLabel: "Apply Payment",
    fields: [
      { name: "amount", label: "Payment Amount", type: "number", required: true, value: "75" }
    ]
  });
  if (!values) {
    return;
  }
  const amount = Number(values.amount);
  if (!amount || amount < 1) {
    addLog("Loan payment amount must be greater than zero.");
    return;
  }

  const result = await runAdminAction("pay_loan", {
    loan_id: loanId,
    amount
  });
  if (!result.ok) {
    addLog(result.error || "Loan payment failed.");
    return;
  }

  applyStore(result.store);
  addLog(result.message || `Loan payment applied to ${loanId}.`);
}

async function runStaffAction(kind, userId) {
  if (!userId) {
    addLog("Missing user id for staff action.");
    return;
  }

  const mapping = {
    "disable-staff": "disable_staff_user",
    "enable-staff": "enable_staff_user",
    "reset-staff-session": "reset_staff_session"
  };

  const result = await runAdminAction(mapping[kind], { user_id: userId });
  if (!result.ok) {
    addLog(result.error || `${kind} failed.`);
    return;
  }

  applyStore(result.store);
  addLog(result.message || `${kind} applied to ${userId}.`);
}

async function submitStaffCreate(event) {
  event.preventDefault();
  const username = document.getElementById("staff-username").value.trim();
  const avatarName = document.getElementById("staff-avatar").value.trim();
  const role = document.getElementById("staff-role").value.trim();
  const password = document.getElementById("staff-password").value;

  if (!username || !avatarName || !role || !password) {
    addLog("Staff creation requires all fields.");
    return;
  }

  const result = await runAdminAction("create_staff_user", {
    new_username: username,
    new_avatar_name: avatarName,
    new_role: role,
    new_password: password
  });
  if (!result.ok) {
    addLog(result.error || "Staff creation failed.");
    return;
  }

  applyStore(result.store);
  document.getElementById("staff-created-copy").innerHTML = `
    <div>Username: <span class="accent">${username}</span></div>
    <div>Temporary Password: <span class="accent">${password}</span></div>
    <div>Role: <span class="accent">${prettyRole(role)}</span></div>
    <div>Tell the staff member to log in and change this password immediately.</div>
  `;
  document.getElementById("staff-created").classList.remove("hidden");
  addLog(result.message || `Staff user ${username} created.`);
}

async function runOrganizationAction(kind, organizationId) {
  if (kind === "create-organization") {
    const fields = [];
    if (state.session?.role === "platform_admin") {
      fields.push({ name: "target_tenant_id", label: "Target Tenant ID", required: true, value: safeArray(state.store?.tenants)[0]?.tenant_id || "demo-tenant" });
    }
    fields.push(
      { name: "name", label: "Organization Or Department Name", required: true, value: "" },
      { name: "organization_type", label: "Organization Type", type: "select", required: true, value: "BUSINESS", options: ["BUSINESS", "GOVERNMENT", "DEPARTMENT", "NONPROFIT"] },
      { name: "department_name", label: "Department Or Division Name", value: "" },
      { name: "opening_balance", label: "Opening Treasury Balance", type: "number", required: true, value: "0" },
      { name: "budget_cycle", label: "Budget Cycle", type: "select", required: true, value: "MONTHLY", options: ["NONE", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"] },
      { name: "budget_amount", label: "Department Budget Amount", type: "number", required: true, value: "0" },
      { name: "reserve_target", label: "Reserve Target Amount", type: "number", required: true, value: "0" },
      { name: "notes", label: "Notes", type: "textarea", value: "" }
    );
    const values = await openActionModal({
      title: "Create Organization",
      submitLabel: "Create Organization",
      wide: true,
      fields
    });
    if (!values) {
      addLog("Organization creation canceled.");
      return;
    }
    const openingBalance = Number(values.opening_balance);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      addLog("Opening treasury balance must be zero or greater.");
      return;
    }
    const budgetAmount = Number(values.budget_amount);
    if (!Number.isFinite(budgetAmount) || budgetAmount < 0) {
      addLog("Budget amount must be zero or greater.");
      return;
    }
    const reserveTarget = Number(values.reserve_target);
    if (!Number.isFinite(reserveTarget) || reserveTarget < 0) {
      addLog("Reserve target must be zero or greater.");
      return;
    }

    const result = await runAdminAction("create_organization", {
      target_tenant_id: String(values.target_tenant_id || "").trim(),
      name: String(values.name || "").trim(),
      organization_type: String(values.organization_type || "").trim().toUpperCase(),
      department_name: String(values.department_name || "").trim(),
      opening_balance: openingBalance,
      budget_cycle: String(values.budget_cycle || "").trim().toUpperCase(),
      budget_amount: budgetAmount,
      reserve_target: reserveTarget,
      notes: String(values.notes || "").trim()
    });
    if (!result.ok) {
      addLog(result.error || "Organization creation failed.");
      return;
    }
    applyStore(result.store);
    addLog(result.message || `Organization ${String(values.name || "").trim()} created.`);
    return;
  }

  const organization = safeArray(state.store?.organizations).find((item) => item.organization_id === organizationId);
  if (!organization) {
    addLog("Organization record not found.");
    return;
  }

  if (kind === "fund-organization" || kind === "spend-organization") {
    const values = await openActionModal({
      title: kind === "fund-organization" ? "Fund Organization Treasury" : "Record Treasury Spend",
      submitLabel: kind === "fund-organization" ? "Apply Funding" : "Record Spend",
      copy: `<strong>${organization.name}</strong>`,
      fields: [
        { name: "amount", label: "Amount", type: "number", required: true, value: kind === "fund-organization" ? "500" : "250" },
        { name: "memo", label: "Memo Or Reason", type: "textarea", value: "" }
      ]
    });
    if (!values) {
      addLog(`Organization ${kind === "fund-organization" ? "funding" : "spend"} canceled.`);
      return;
    }
    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      addLog("Treasury amount must be greater than zero.");
      return;
    }

    const result = await runAdminAction(
      kind === "fund-organization" ? "fund_organization" : "spend_organization",
      {
        target_tenant_id: organization.tenant_id,
        organization_id: organizationId,
        amount,
        memo: String(values.memo || "").trim()
      }
    );
    if (!result.ok) {
      addLog(result.error || "Organization treasury action failed.");
      return;
    }
    applyStore(result.store);
    addLog(
      result.message || `${kind === "fund-organization" ? "Funded" : "Recorded spend for"} ${organization.name}.`
    );
    return;
  }

  if (kind === "disburse-organization") {
    const targetAccounts = safeArray(state.store?.accounts)
      .filter((account) =>
        account.tenant_id === organization.tenant_id
        && account.player_id
        && account.account_id !== organization.treasury_account_id
        && account.status === "ACTIVE"
      );
    if (!targetAccounts.length) {
      addLog("No active player accounts are available for disbursement.");
      return;
    }

    const values = await openActionModal({
      title: "Disburse Treasury Funds",
      submitLabel: "Send Disbursement",
      wide: true,
      copy: `<strong>Source:</strong> ${organization.name}`,
      fields: [
        {
          name: "target_account_id",
          label: "Recipient Account",
          type: "select",
          required: true,
          value: targetAccounts[0]?.account_id || "",
          options: targetAccounts.map((account) => ({
            value: account.account_id,
            label: `${account.customer_name} (${account.account_id})`
          }))
        },
        { name: "amount", label: "Amount", type: "number", required: true, value: "100" },
        { name: "memo", label: "Memo Or Reason", type: "textarea", value: "Grant / stipend / reimbursement" }
      ]
    });
    if (!values) {
      addLog("Organization disbursement canceled.");
      return;
    }

    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      addLog("Disbursement amount must be greater than zero.");
      return;
    }

    const result = await runAdminAction("disburse_organization", {
      target_tenant_id: organization.tenant_id,
      organization_id: organizationId,
      target_account_id: String(values.target_account_id || "").trim(),
      amount,
      memo: String(values.memo || "").trim()
    });
    if (!result.ok) {
      addLog(result.error || "Organization disbursement failed.");
      return;
    }
    applyStore(result.store);
    addLog(result.message || `Disbursed L$${amount} from ${organization.name}.`);
    return;
  }

  if (kind === "transfer-organization") {
    const candidates = safeArray(state.store?.organizations)
      .filter((item) => item.tenant_id === organization.tenant_id && item.organization_id !== organization.organization_id);
    if (!candidates.length) {
      addLog("No other organizations are available for transfer.");
      return;
    }
    const values = await openActionModal({
      title: "Transfer Treasury Funds",
      submitLabel: "Transfer Funds",
      copy: `<strong>Source:</strong> ${organization.name}`,
      wide: true,
      fields: [
        {
          name: "target_organization_id",
          label: "Target Organization",
          type: "select",
          required: true,
          value: candidates[0]?.organization_id || "",
          options: candidates.map((item) => ({ value: item.organization_id, label: `${item.organization_id} - ${item.name}` }))
        },
        { name: "amount", label: "Transfer Amount", type: "number", required: true, value: "250" },
        { name: "memo", label: "Transfer Memo", type: "textarea", value: `Budget transfer to ${candidates[0]?.name || ""}` }
      ]
    });
    if (!values) {
      addLog("Organization transfer canceled.");
      return;
    }
    const targetOrganization = candidates.find((item) => item.organization_id === String(values.target_organization_id || "").trim());
    if (!targetOrganization) {
      addLog("Target organization not found in this tenant.");
      return;
    }
    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      addLog("Transfer amount must be greater than zero.");
      return;
    }

    const result = await runAdminAction("transfer_organization", {
      target_tenant_id: organization.tenant_id,
      organization_id: organizationId,
      target_organization_id: targetOrganization.organization_id,
      amount,
      memo: String(values.memo || "").trim()
    });
    if (!result.ok) {
      addLog(result.error || "Organization transfer failed.");
      return;
    }
    applyStore(result.store);
    addLog(result.message || `Transferred L$${amount} from ${organization.name} to ${targetOrganization.name}.`);
    return;
  }

  if (kind === "edit-organization") {
    const values = await openActionModal({
      title: "Edit Organization",
      submitLabel: "Save Changes",
      wide: true,
      fields: [
        { name: "name", label: "Organization Or Department Name", required: true, value: organization.name || "" },
        { name: "organization_type", label: "Organization Type", type: "select", required: true, value: organization.organization_type || "BUSINESS", options: ["BUSINESS", "GOVERNMENT", "DEPARTMENT", "NONPROFIT"] },
        { name: "department_name", label: "Department Or Division Name", value: organization.department_name || "" },
        { name: "budget_cycle", label: "Budget Cycle", type: "select", required: true, value: organization.budget_cycle || "MONTHLY", options: ["NONE", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"] },
        { name: "budget_amount", label: "Department Budget Amount", type: "number", required: true, value: String(organization.budget_amount || 0) },
        { name: "reserve_target", label: "Reserve Target Amount", type: "number", required: true, value: String(organization.reserve_target || 0) },
        { name: "notes", label: "Notes", type: "textarea", value: organization.notes || "" }
      ]
    });
    if (!values) {
      addLog("Organization update canceled.");
      return;
    }
    const budgetAmount = Number(values.budget_amount);
    if (!Number.isFinite(budgetAmount) || budgetAmount < 0) {
      addLog("Budget amount must be zero or greater.");
      return;
    }
    const reserveTarget = Number(values.reserve_target);
    if (!Number.isFinite(reserveTarget) || reserveTarget < 0) {
      addLog("Reserve target must be zero or greater.");
      return;
    }

    const result = await runAdminAction("update_organization", {
      target_tenant_id: organization.tenant_id,
      organization_id: organizationId,
      name: String(values.name || "").trim(),
      organization_type: String(values.organization_type || "").trim().toUpperCase(),
      department_name: String(values.department_name || "").trim(),
      budget_cycle: String(values.budget_cycle || "").trim().toUpperCase(),
      budget_amount: budgetAmount,
      reserve_target: reserveTarget,
      notes: String(values.notes || "").trim()
    });
    if (!result.ok) {
      addLog(result.error || "Organization update failed.");
      return;
    }
    applyStore(result.store);
    addLog(result.message || `Organization ${organizationId} updated.`);
    return;
  }

  const nextAction = kind === "reactivate-organization" ? "reactivate_organization" : "deactivate_organization";
  const confirmed = await confirmAction(
    kind === "reactivate-organization" ? "Reactivate Organization" : "Deactivate Organization",
    `${kind === "reactivate-organization" ? "Bring" : "Take"} <strong>${organization.name}</strong> ${kind === "reactivate-organization" ? "back online" : "offline"}.`,
    kind === "reactivate-organization" ? "Reactivate" : "Deactivate"
  );
  if (!confirmed) {
    addLog(`Organization ${kind === "reactivate-organization" ? "reactivation" : "deactivation"} canceled.`);
    return;
  }

  const result = await runAdminAction(nextAction, {
    target_tenant_id: organization.tenant_id,
    organization_id: organizationId
  });
  if (!result.ok) {
    addLog(result.error || "Organization status update failed.");
    return;
  }
  applyStore(result.store);
  addLog(result.message || `Organization ${organizationId} updated.`);
}

async function runEmploymentAction(kind, employmentId) {
  if (kind === "create-employment") {
    const organizations = safeArray(state.store?.organizations);
    const values = await openActionModal({
      title: "Create Employment Record",
      submitLabel: "Create Job",
      wide: true,
      fields: [
        { name: "account_id", label: "Account ID", required: true, value: state.selectedAccountId || "" },
        { name: "organization_id", label: "Organization", type: "select", value: organizations[0]?.organization_id || "", options: [{ value: "", label: "None / manual employer" }, ...organizations.map((item) => ({ value: item.organization_id, label: `${item.organization_id} - ${item.name}` }))] },
        { name: "employer_name", label: "Employer Or Business Name", required: true, value: organizations[0]?.name || "Whispering Pines Bank" },
        { name: "department_name", label: "Department Name", value: organizations[0]?.department_name || "Banking" },
        { name: "title", label: "Job Title", required: true, value: "Teller" },
        { name: "pay_rate", label: "Pay Rate Per Payroll Run", type: "number", required: true, value: "250" },
        { name: "pay_cycle", label: "Pay Cycle", type: "select", required: true, value: "WEEKLY", options: ["WEEKLY", "BIWEEKLY", "MONTHLY"] }
      ]
    });
    if (!values) {
      addLog("Employment creation canceled.");
      return;
    }
    const payRate = Number(values.pay_rate);
    if (!payRate || payRate < 1) {
      addLog("Pay rate must be greater than zero.");
      return;
    }

    const result = await runAdminAction("create_employment", {
      account_id: String(values.account_id || "").trim(),
      organization_id: String(values.organization_id || "").trim(),
      employer_name: String(values.employer_name || "").trim(),
      department_name: String(values.department_name || "").trim(),
      title: String(values.title || "").trim(),
      pay_rate: payRate,
      pay_cycle: String(values.pay_cycle || "").trim().toUpperCase()
    });
    if (!result.ok) {
      addLog(result.error || "Employment creation failed.");
      return;
    }
    applyStore(result.store);
    addLog(result.message || `Employment created for ${String(values.account_id || "").trim()}.`);
    return;
  }

  if (!employmentId) {
    addLog("Missing employment id.");
    return;
  }

  if (kind === "edit-employment") {
    const employment = safeArray(state.store?.employments).find((item) => item.employment_id === employmentId);
    if (!employment) {
      addLog("Employment record not found.");
      return;
    }
    const organizations = safeArray(state.store?.organizations);
    const values = await openActionModal({
      title: "Edit Employment Record",
      submitLabel: "Save Job",
      wide: true,
      fields: [
        { name: "organization_id", label: "Organization", type: "select", value: employment.organization_id || "", options: [{ value: "", label: "None / manual employer" }, ...organizations.map((item) => ({ value: item.organization_id, label: `${item.organization_id} - ${item.name}` }))] },
        { name: "employer_name", label: "Employer Or Business Name", required: true, value: employment.employer_name || "" },
        { name: "department_name", label: "Department Name", value: employment.department_name || "" },
        { name: "title", label: "Job Title", required: true, value: employment.title || "" },
        { name: "pay_rate", label: "Pay Rate Per Payroll Run", type: "number", required: true, value: String(employment.pay_rate || 0) },
        { name: "pay_cycle", label: "Pay Cycle", type: "select", required: true, value: employment.pay_cycle || "WEEKLY", options: ["WEEKLY", "BIWEEKLY", "MONTHLY"] }
      ]
    });
    if (!values) {
      addLog("Employment update canceled.");
      return;
    }
    const payRate = Number(values.pay_rate);
    if (!payRate || payRate < 1) {
      addLog("Pay rate must be greater than zero.");
      return;
    }

    const result = await runAdminAction("update_employment", {
      employment_id: employmentId,
      organization_id: String(values.organization_id || "").trim(),
      employer_name: String(values.employer_name || "").trim(),
      department_name: String(values.department_name || "").trim(),
      title: String(values.title || "").trim(),
      pay_rate: payRate,
      pay_cycle: String(values.pay_cycle || "").trim().toUpperCase()
    });
    if (!result.ok) {
      addLog(result.error || "Employment update failed.");
      return;
    }
    applyStore(result.store);
    addLog(result.message || `Employment updated for ${employmentId}.`);
    return;
  }

  if (kind === "terminate-employment") {
    const confirmed = await confirmAction(
      "Terminate Employment",
      `Terminate employment record <strong>${employmentId}</strong>?`,
      "Terminate"
    );
    if (!confirmed) {
      addLog(`Employment termination canceled for ${employmentId}.`);
      return;
    }
    const result = await runAdminAction("terminate_employment", {
      employment_id: employmentId
    });
    if (!result.ok) {
      addLog(result.error || "Employment termination failed.");
      return;
    }
    applyStore(result.store);
    addLog(result.message || `Employment terminated for ${employmentId}.`);
  }
}

async function runTenantAction(kind, tenantId) {
  if (!tenantId) {
    addLog("Missing tenant id for platform action.");
    return;
  }

  if (kind === "edit-tenant") {
    const tenant = safeArray(state.store?.tenants).find((item) => item.tenant_id === tenantId);
    const taxOrganizationOptions = [{ value: "", label: "No Payroll Tax Treasury" }]
      .concat(
        safeArray(state.store?.organizations)
          .filter((item) => item.tenant_id === tenantId && item.status === "ACTIVE")
          .map((item) => ({ value: item.organization_id, label: `${item.organization_id} - ${item.name}` }))
      );
    if (!tenant) {
      addLog("Target tenant was not found.");
      return;
    }
    const values = await openActionModal({
      title: "Edit Tenant",
      submitLabel: "Save Tenant",
      wide: true,
      fields: [
        { name: "tenant_name", label: "Tenant Display Name", required: true, value: tenant.name || "" },
        { name: "bank_name", label: "Bank Display Name", required: true, value: tenant.bank_name || "" },
        { name: "primary_region_name", label: "Primary Region Name", required: true, value: tenant.primary_region_name || "" },
        { name: "payroll_default_amount", label: "Default Payroll Amount", type: "number", required: true, value: String(tenant.payroll_default_amount ?? 250) },
        { name: "payroll_tax_rate", label: "Payroll Tax Rate (%)", type: "number", required: true, value: String(tenant.payroll_tax_rate ?? 0) },
        { name: "tax_organization_id", label: "Tax Treasury Organization", type: "select", value: tenant.tax_organization_id || "", options: taxOrganizationOptions }
      ]
    });
    if (!values) {
      return;
    }

    const result = await runAdminAction("update_tenant_settings", {
      target_tenant_id: tenantId,
      tenant_name: String(values.tenant_name || "").trim(),
      bank_name: String(values.bank_name || "").trim(),
      primary_region_name: String(values.primary_region_name || "").trim(),
      payroll_default_amount: Number(values.payroll_default_amount),
      payroll_tax_rate: Number(values.payroll_tax_rate),
      tax_organization_id: String(values.tax_organization_id || "").trim()
    });
    if (!result.ok) {
      addLog(result.error || "Tenant update failed.");
      return;
    }
    applyStore(result.store);
    addLog(result.message || (`Updated tenant ${tenantId}.`));
    return;
  }

  const mapping = {
    "suspend-tenant": "suspend_tenant",
    "activate-tenant": "activate_tenant",
    "reissue-code": "reissue_activation_code",
    "delete-tenant": "delete_tenant",
    "suspend-license": "suspend_license",
    "activate-license": "activate_license",
    "extend-license": "extend_license",
    "expire-license": "expire_license"
  };

  if (kind === "delete-tenant") {
    const confirmed = await confirmAction(
      "Delete Tenant",
      `Delete tenant <strong>${tenantId}</strong>? This permanently removes its users, accounts, cards, incidents, audit logs, licenses, and linked data.`,
      "Delete Tenant"
    );
    if (!confirmed) {
      addLog(`Delete canceled for ${tenantId}.`);
      return;
    }
  }

  if (kind === "expire-license") {
    const confirmed = await confirmAction(
      "Expire License",
      `Expire the license for <strong>${tenantId}</strong> now? Tenant users will be blocked from logging in until the license is reactivated or extended.`,
      "Expire License"
    );
    if (!confirmed) {
      addLog(`License expiry canceled for ${tenantId}.`);
      return;
    }
  }

  const payload = {
    target_tenant_id: tenantId
  };

  if (kind === "extend-license") {
    const values = await openActionModal({
      title: "Extend License",
      submitLabel: "Extend License",
      fields: [
        { name: "days", label: "Extend By How Many Days?", type: "number", required: true, value: "30" }
      ]
    });
    if (!values) {
      addLog(`License extension canceled for ${tenantId}.`);
      return;
    }
    const days = Number(values.days);
    if (!days || days < 1) {
      addLog("License extension must be at least 1 day.");
      return;
    }
    payload.days = days;
  }

  const result = await runAdminAction(mapping[kind], payload);
  if (!result.ok) {
    addLog(result.error || `${kind} failed.`);
    return;
  }

  applyStore(result.store);
  addLog(result.message || `${kind} applied to ${tenantId}.`);
}

function demoRequest(action, payload) {
  if (action === "login") {
    const setupUser = state.setupUsers[payload.username];
    if (setupUser && setupUser.password === payload.password) {
      return Promise.resolve({
        ok: true,
        session: {
          username: setupUser.username,
          role: "tenant_owner",
          tenant_id: "demo-tenant",
          token: "demo-owner-session"
        }
      });
    }

    if (payload.username === CONFIG.demoAdminUser && payload.password === CONFIG.demoAdminPassword) {
      return Promise.resolve({
        ok: true,
        session: {
          username: payload.username,
          role: "tenant_owner",
          tenant_id: "demo-tenant",
          token: "demo-admin-session"
        }
      });
    }

    return Promise.resolve({
      ok: false,
      error: "Invalid demo credentials."
    });
  }

  if (action === "activate_owner") {
    if (payload.activation_code !== CONFIG.demoActivationCode) {
      return Promise.resolve({
        ok: false,
        error: "Activation code not recognized."
      });
    }

    state.setupUsers[payload.username] = {
      username: payload.username,
      password: payload.password,
      avatar_name: payload.avatar_name
    };
    savePreviewState();

    return Promise.resolve({
      ok: true,
      message: "Owner account activated. You can now log in with the new username and password."
    });
  }

  if (action === "dashboard") {
    return Promise.resolve({
      ok: true,
      store: cloneStore(state.store)
    });
  }

  return Promise.resolve({
    ok: false,
    error: "Unsupported demo action."
  });
}

function wireNavigation() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      setActiveView(link.dataset.view);
    });
  });
}

function wireAuth() {
  document.getElementById("login-tab").addEventListener("click", () => setAuthTab("login"));
  document.getElementById("setup-tab").addEventListener("click", () => setAuthTab("setup"));

  document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    const result = await bridgeRequest("login", { username, password });

    if (!result.ok) {
      setAuthMessage(result.error || "Login failed.", "alert");
      return;
    }

    if (result.store) {
      applyStore(result.store);
    }

    setAuthMessage("Login accepted. Opening admin terminal.");
    applySession(result.session);
    setInterval(updateClockDisplays, 1000);
  });

  document.getElementById("setup-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const activation_code = document.getElementById("setup-code").value.trim();
    const avatar_name = document.getElementById("setup-avatar").value.trim();
    const username = document.getElementById("setup-username").value.trim();
    const password = document.getElementById("setup-password").value;

    const result = await bridgeRequest("activate_owner", {
      activation_code,
      avatar_name,
      username,
      password
    });

    if (!result.ok) {
      setAuthMessage(result.error || "Activation failed.", "alert");
      return;
    }

    setAuthTab("login");
    setAuthMessage(result.message || "Owner account activated.");
    document.getElementById("login-username").value = username;
    document.getElementById("login-password").value = "";
  });

}

function wireAdminActions() {
  document.getElementById("table-search").addEventListener("input", (event) => {
    state.searchQuery = String(event.target.value || "").trim().toLowerCase();
    renderTable(state.view);
  });

  document.getElementById("table-body").addEventListener("click", async (event) => {
    const row = event.target.closest("[data-select-account]");
    if (row && row.dataset.selectAccount) {
      state.selectedAccountId = row.dataset.selectAccount;
      renderTable(state.view);
    }
    const button = event.target.closest("[data-row-action]");
    if (!button) {
      return;
    }
    const kind = button.dataset.rowAction;
    if (["create-account", "create-customer-portal", "deposit", "withdraw", "freeze", "unfreeze"].includes(kind)) {
      await runAccountAction(kind, button.dataset.accountId);
      return;
    }
    if (["disable-staff", "enable-staff", "reset-staff-session"].includes(kind)) {
      await runStaffAction(kind, button.dataset.userId);
      return;
    }
    if (["create-employment", "edit-employment", "terminate-employment"].includes(kind)) {
      await runEmploymentAction(kind, button.dataset.employmentId);
      return;
    }
    if ([
      "create-organization",
      "fund-organization",
      "spend-organization",
      "disburse-organization",
      "transfer-organization",
      "edit-organization",
      "deactivate-organization",
      "reactivate-organization"
    ].includes(kind)) {
      await runOrganizationAction(kind, button.dataset.organizationId);
      return;
    }
    if (["edit-tenant", "suspend-tenant", "activate-tenant", "reissue-code", "delete-tenant", "suspend-license", "activate-license", "extend-license", "expire-license"].includes(kind)) {
      await runTenantAction(kind, button.dataset.tenantId);
      return;
    }
    if (["lock-card", "unlock-card", "report-stolen-card"].includes(kind)) {
      await runCardAction(kind, button.dataset.cardId);
      return;
    }
    if (kind === "pay-fine") {
      await runFineAction(button.dataset.fineId);
      return;
    }
    if (kind === "pay-loan") {
      await runLoanAction(button.dataset.loanId);
    }
  });

  document.getElementById("dispatch-btn").addEventListener("click", async () => {
    if (!state.incident) {
      addLog("No active incident loaded for dispatch.");
      return;
    }
    const result = await runAdminAction("dispatch_police", {
      incident_id: state.incident.incident_id
    });
    if (!result.ok) {
      addLog(result.error || "Dispatch request failed.");
      return;
    }
    applyStore(result.store);
    addLog(result.message || ("Police dispatch sent to " + state.incident.vault_id));
  });

  document.getElementById("lock-btn").addEventListener("click", async () => {
    if (!state.incident) {
      addLog("No active incident loaded for vault lockdown.");
      return;
    }
    const result = await runAdminAction("lock_vault", {
      incident_id: state.incident.incident_id
    });
    if (!result.ok) {
      addLog(result.error || "Vault lockdown request failed.");
      return;
    }
    applyStore(result.store);
    addLog(result.message || ("Vault lockdown triggered for " + state.incident.vault_id));
  });

  document.getElementById("shutdown-btn").addEventListener("click", async () => {
    const result = await runAdminAction("shutdown_atm_network");
    if (!result.ok) {
      addLog(result.error || "ATM shutdown failed.");
      return;
    }
    applyStore(result.store);
    addLog(result.message || "ATM network shutdown queued.");
  });

  document.getElementById("refresh-btn").addEventListener("click", async () => {
    const result = await bridgeRequest("dashboard", {
      token: state.session ? state.session.token : "",
      tenant_id: state.session ? state.session.tenant_id : ""
    });
    if (result.ok && result.store) {
      if (result.session) {
        state.session = result.session;
        saveSession(result.session);
      }
      applyStore(result.store);
      addLog("Manual refresh executed for " + state.view.toUpperCase());
      return;
    }
    if (!isSessionError(result.error)) {
      addLog(result.error || ("Refresh failed for " + state.view.toUpperCase() + "."));
    }
  });

  document.getElementById("manage-tenant-btn").addEventListener("click", async () => {
    if (state.session?.role === "platform_admin") {
      const values = await openActionModal({
        title: "Create Tenant",
        submitLabel: "Create Tenant",
        wide: true,
        fields: [
          { name: "tenant_name", label: "Tenant Display Name", required: true, value: "" },
          { name: "bank_name", label: "Bank Display Name", required: true, value: "" },
          { name: "owner_avatar_name", label: "Owner Avatar Or Operator Name", value: "" }
        ]
      });
      if (!values) {
        addLog("Platform tenant creation canceled.");
        return;
      }
      const result = await runAdminAction("create_tenant", {
        tenant_name: String(values.tenant_name || "").trim(),
        bank_name: String(values.bank_name || "").trim(),
        owner_avatar_name: String(values.owner_avatar_name || "").trim()
      });
      if (!result.ok) {
        addLog(result.error || "Platform tenant creation failed.");
        return;
      }
      applyStore(result.store);
      addLog(result.message || `Created tenant ${String(values.tenant_name || "").trim()}.`);
      return;
    }

    const tenant = getCurrentTenant();
    const taxOrganizationOptions = [{ value: "", label: "No Payroll Tax Treasury" }]
      .concat(
        safeArray(state.store?.organizations)
          .filter((item) => item.tenant_id === tenant?.tenant_id && item.status === "ACTIVE")
          .map((item) => ({ value: item.organization_id, label: `${item.organization_id} - ${item.name}` }))
      );
    const values = await openActionModal({
      title: "Manage Tenant",
      submitLabel: "Save Tenant Settings",
      wide: true,
      fields: [
        { name: "tenant_name", label: "Tenant Display Name", required: true, value: tenant?.name || "" },
        { name: "bank_name", label: "Bank Display Name", required: true, value: tenant?.bank_name || "" },
        { name: "primary_region_name", label: "Primary Region Name", required: true, value: tenant?.primary_region_name || "" },
        { name: "payroll_default_amount", label: "Default Payroll Amount", type: "number", required: true, value: String(tenant?.payroll_default_amount || 250) },
        { name: "payroll_tax_rate", label: "Payroll Tax Rate (%)", type: "number", required: true, value: String(tenant?.payroll_tax_rate || 0) },
        { name: "tax_organization_id", label: "Tax Treasury Organization", type: "select", value: tenant?.tax_organization_id || "", options: taxOrganizationOptions }
      ]
    });
    if (!values) {
      return;
    }

    const result = await runAdminAction("update_tenant_settings", {
      tenant_name: String(values.tenant_name || "").trim(),
      bank_name: String(values.bank_name || "").trim(),
      primary_region_name: String(values.primary_region_name || "").trim(),
      payroll_default_amount: Number(values.payroll_default_amount),
      payroll_tax_rate: Number(values.payroll_tax_rate),
      tax_organization_id: String(values.tax_organization_id || "").trim()
    });
    if (!result.ok) {
      addLog(result.error || "Tenant management request failed.");
      return;
    }
    if (result.store) {
      applyStore(result.store);
    }
    addLog(result.message || "Tenant management requested.");
  });

  document.getElementById("view-action-btn").addEventListener("click", async () => {
    if (state.view === "platform") {
      const values = await openActionModal({
        title: "Create Tenant",
        submitLabel: "Create Tenant",
        wide: true,
        fields: [
          { name: "tenant_name", label: "Tenant Display Name", required: true, value: "" },
          { name: "bank_name", label: "Bank Display Name", required: true, value: "" },
          { name: "owner_avatar_name", label: "Owner Avatar Or Operator Name", value: "" }
        ]
      });
      if (!values) {
        return;
      }

      const result = await runAdminAction("create_tenant", {
        tenant_name: String(values.tenant_name || "").trim(),
        bank_name: String(values.bank_name || "").trim(),
        owner_avatar_name: String(values.owner_avatar_name || "").trim()
      });
      if (!result.ok) {
        addLog(result.error || "Tenant creation failed.");
        return;
      }
      applyStore(result.store);
      addLog(result.message || `Created tenant ${String(values.tenant_name || "").trim()}.`);
      return;
    }
    if (state.view === "accounts") {
      await runAccountAction("create-account");
      return;
    }
    if (state.view === "organizations") {
      await runOrganizationAction("create-organization");
      return;
    }
    if (state.view === "employment") {
      await runEmploymentAction("create-employment");
      return;
    }
    if (state.view === "staff") {
      openStaffModal();
      return;
    }
    if (state.view !== "payroll") {
      return;
    }
    const result = await runAdminAction("run_payroll");
    if (!result.ok) {
      addLog(result.error || "Payroll run failed.");
      return;
    }
    applyStore(result.store);
    addLog(result.message || "Payroll applied.");
  });

  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("player-logout-btn").addEventListener("click", logout);
  document.getElementById("player-lock-card-btn").addEventListener("click", async () => {
    await runPlayerCardAction("player-lock-card");
  });
  document.getElementById("player-unlock-card-btn").addEventListener("click", async () => {
    await runPlayerCardAction("player-unlock-card");
  });
  document.getElementById("player-report-card-btn").addEventListener("click", async () => {
    const confirmed = await confirmAction(
      "Report Card Stolen",
      "This will mark your linked card as stolen and disable normal card use until staff reviews it.",
      "Report Stolen"
    );
    if (!confirmed) {
      return;
    }
    await runPlayerCardAction("player-report-card");
  });
  document.getElementById("player-pay-fine-btn").addEventListener("click", async () => {
    await runPlayerFineAction();
  });
  document.getElementById("player-pay-loan-btn").addEventListener("click", async () => {
    await runPlayerLoanAction();
  });
  document.getElementById("player-transfer-btn").addEventListener("click", async () => {
    await runPlayerTransferAction();
  });
  document.getElementById("staff-role").addEventListener("change", updateStaffRoleHint);
  document.getElementById("staff-form").addEventListener("submit", submitStaffCreate);
  document.getElementById("staff-cancel").addEventListener("click", closeStaffModal);
  document.querySelectorAll("[data-close-modal=\"staff\"]").forEach((node) => {
    node.addEventListener("click", closeStaffModal);
  });
  document.getElementById("action-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    closeActionModal(data);
  });
  document.getElementById("action-cancel").addEventListener("click", () => closeActionModal(null));
  document.querySelectorAll("[data-close-modal=\"action\"]").forEach((node) => {
    node.addEventListener("click", () => closeActionModal(null));
  });
}

function seedLogs(store) {
  if (state.logs.length) {
    renderLogs();
    return;
  }

  const lines = [];
  getTransactions(store).slice(0, 2).forEach((txn) => {
    lines.push(nowStamp() + " " + txn.type + " - L$" + txn.amount + " - " + txn.account_id);
  });
  safeArray(store.audit_logs).slice(0, 1).forEach((audit) => {
    lines.push(nowStamp() + " " + audit.action + " - " + (audit.target_account_id || audit.object_id));
  });
  const incident = safeArray(store.vault_incidents)[0];
  if (incident) {
    lines.push(nowStamp() + " Vault Alarm Triggered");
  }
  state.logs = lines;
  renderLogs();
}

async function boot() {
  const response = await fetch("./services/api/data/store.json");
  const store = await response.json();
  const saved = loadPreviewState();

  state.store = store;
  state.incident = saved && saved.incident ? saved.incident : (safeArray(store.vault_incidents)[0] || null);
  state.logs = saved && Array.isArray(saved.logs) ? saved.logs : [];
  state.view = saved && saved.view ? saved.view : "accounts";
  state.atmNetwork = saved && Array.isArray(saved.atmNetwork) && saved.atmNetwork.length
    ? saved.atmNetwork
    : buildAtmNetwork(store);
  state.setupUsers = saved && saved.setupUsers ? saved.setupUsers : {};

  setBridgeMode(CONFIG.apiUrl ? "APPS SCRIPT" : "DEMO FALLBACK");
  seedLogs(store);
  wireAuth();
  wireNavigation();
  wireAdminActions();
  if (CONFIG.apiUrl) {
    setBridgeMode("CONNECTING");
    bridgeRequest("health", {}).then((result) => {
      if (result && result.ok) {
        setBridgeMode("APPS SCRIPT");
      }
    }).catch(() => {
      setBridgeMode("DEMO FALLBACK");
    });
  }
  const session = loadSession();
  if (session) {
    bridgeRequest("dashboard", {
      token: session.token,
      tenant_id: session.tenant_id
    }).then((result) => {
      if (result.ok) {
        if (result.store) {
          state.store = result.store;
        }
        applySession(result.session || session);
        setInterval(updateClockDisplays, 1000);
        return;
      }
      handleSessionFailure(result.error || "Saved session is no longer valid.");
    }).catch(() => {
      setInterval(() => setClock("clock-line"), 1000);
    });
  }
}

boot();
