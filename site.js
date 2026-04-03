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

function applyStore(store) {
  state.store = store;
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
    columns = ["Module", "Scope", "Health", "Note"];
    rows = [
      ["Accounts", "Customer banking", "ONLINE", "Balances, cards, and statements available"],
      ["Organizations", "Business and department treasury", "ONLINE", `${safeArray(store.organizations).length} treasury organization(s) active`],
      ["Justice", "Fines and enforcement", "ONLINE", "Fine collection and records active"],
      ["Credit", "Loans and lending", "ONLINE", "Outstanding loan servicing enabled"],
      ["Security", "Vault and dispatch", state.incident ? "ALERT" : "ONLINE", state.incident ? state.incident.stage : "No incident"]
    ];
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
          { label: "New Account", kind: "create-account", permission: "create_customer_account" },
          { label: "Deposit", kind: "deposit", accountId: account.account_id, permission: "deposit_account" },
          { label: "Withdraw", kind: "withdraw", accountId: account.account_id, permission: "withdraw_account" },
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

  searchShell.classList.toggle("hidden", view === "bank-core" || view === "vault-control");
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
  document.getElementById("admin-shell").classList.remove("hidden");
  document.getElementById("manage-tenant-btn").textContent = session.role === "platform_admin" ? "New Tenant" : "Manage Tenant";
  document.getElementById("admin-username").textContent = session.username.toUpperCase();
  document.getElementById("admin-role").textContent = (session.role || "tenant_owner").toUpperCase().replaceAll("_", " ");
  document.getElementById("header-user-line").textContent = "USERNAME: " + session.username.toUpperCase();
  setClock("clock-line");
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

  const nextPassword = window.prompt("Temporary password detected. Enter a new password (8+ characters):", "");
  if (nextPassword === null) {
    addLog("Password reset still required for this account.");
    return;
  }

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
    const avatarName = window.prompt("Customer avatar or display name:", "");
    if (!avatarName) {
      return;
    }
    const depositRaw = window.prompt("Opening deposit amount:", "0");
    if (depositRaw === null) {
      return;
    }
    const openingDeposit = Number(depositRaw);
    if (!Number.isFinite(openingDeposit) || openingDeposit < 0) {
      addLog("Opening deposit must be zero or greater.");
      return;
    }
    const issueCard = window.confirm("Issue a starting bank card for this account?");
    const result = await runAdminAction("create_customer_account", {
      avatar_name: avatarName.trim(),
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

  if (!accountId) {
    addLog("Missing account id for action.");
    return;
  }

  if (kind === "deposit" || kind === "withdraw") {
    const raw = window.prompt(`Enter ${kind} amount in Linden dollars:`, "100");
    if (raw === null) {
      return;
    }
    const amount = Number(raw);
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

  const raw = window.prompt("Enter loan payment amount in Linden dollars:", "75");
  if (raw === null) {
    return;
  }
  const amount = Number(raw);
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
    let targetTenantId = "";
    if (state.session?.role === "platform_admin") {
      targetTenantId = window.prompt("Target tenant ID:", safeArray(state.store?.tenants)[0]?.tenant_id || "demo-tenant") || "";
      if (!targetTenantId.trim()) {
        addLog("Organization creation canceled.");
        return;
      }
    }
    const name = window.prompt("Organization or department name:", "");
    if (!name || !name.trim()) {
      addLog("Organization creation canceled.");
      return;
    }
    const type = window.prompt("Organization type (BUSINESS, GOVERNMENT, DEPARTMENT, NONPROFIT):", "BUSINESS");
    if (!type || !type.trim()) {
      addLog("Organization creation canceled.");
      return;
    }
    const department = window.prompt("Department or division name (optional):", "");
    if (department === null) {
      addLog("Organization creation canceled.");
      return;
    }
    const openingRaw = window.prompt("Opening treasury balance:", "0");
    if (openingRaw === null) {
      addLog("Organization creation canceled.");
      return;
    }
    const openingBalance = Number(openingRaw);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      addLog("Opening treasury balance must be zero or greater.");
      return;
    }
    const budgetCycle = window.prompt("Budget cycle (NONE, WEEKLY, MONTHLY, QUARTERLY, ANNUAL):", "MONTHLY");
    if (!budgetCycle || !budgetCycle.trim()) {
      addLog("Organization creation canceled.");
      return;
    }
    const budgetRaw = window.prompt("Department budget amount (0 for none):", "0");
    if (budgetRaw === null) {
      addLog("Organization creation canceled.");
      return;
    }
    const budgetAmount = Number(budgetRaw);
    if (!Number.isFinite(budgetAmount) || budgetAmount < 0) {
      addLog("Budget amount must be zero or greater.");
      return;
    }
    const reserveRaw = window.prompt("Reserve target amount (0 for none):", "0");
    if (reserveRaw === null) {
      addLog("Organization creation canceled.");
      return;
    }
    const reserveTarget = Number(reserveRaw);
    if (!Number.isFinite(reserveTarget) || reserveTarget < 0) {
      addLog("Reserve target must be zero or greater.");
      return;
    }
    const notes = window.prompt("Notes (optional):", "");
    if (notes === null) {
      addLog("Organization creation canceled.");
      return;
    }

    const result = await runAdminAction("create_organization", {
      target_tenant_id: targetTenantId.trim(),
      name: name.trim(),
      organization_type: type.trim().toUpperCase(),
      department_name: String(department || "").trim(),
      opening_balance: openingBalance,
      budget_cycle: budgetCycle.trim().toUpperCase(),
      budget_amount: budgetAmount,
      reserve_target: reserveTarget,
      notes: String(notes || "").trim()
    });
    if (!result.ok) {
      addLog(result.error || "Organization creation failed.");
      return;
    }
    applyStore(result.store);
    addLog(result.message || `Organization ${name.trim()} created.`);
    return;
  }

  const organization = safeArray(state.store?.organizations).find((item) => item.organization_id === organizationId);
  if (!organization) {
    addLog("Organization record not found.");
    return;
  }

  if (kind === "fund-organization" || kind === "spend-organization") {
    const amountRaw = window.prompt(
      `${kind === "fund-organization" ? "Fund" : "Spend"} amount for ${organization.name}:`,
      kind === "fund-organization" ? "500" : "250"
    );
    if (amountRaw === null) {
      addLog(`Organization ${kind === "fund-organization" ? "funding" : "spend"} canceled.`);
      return;
    }
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      addLog("Treasury amount must be greater than zero.");
      return;
    }
    const memo = window.prompt("Memo or reason (optional):", "");
    if (memo === null) {
      addLog(`Organization ${kind === "fund-organization" ? "funding" : "spend"} canceled.`);
      return;
    }

    const result = await runAdminAction(
      kind === "fund-organization" ? "fund_organization" : "spend_organization",
      {
        target_tenant_id: organization.tenant_id,
        organization_id: organizationId,
        amount,
        memo: String(memo || "").trim()
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

  if (kind === "transfer-organization") {
    const candidates = safeArray(state.store?.organizations)
      .filter((item) => item.tenant_id === organization.tenant_id && item.organization_id !== organization.organization_id);
    if (!candidates.length) {
      addLog("No other organizations are available for transfer.");
      return;
    }
    const suggestion = candidates[0]?.organization_id || "";
    const targetOrganizationId = window.prompt(
      `Transfer from ${organization.name} to organization ID:`,
      suggestion
    );
    if (!targetOrganizationId || !targetOrganizationId.trim()) {
      addLog("Organization transfer canceled.");
      return;
    }
    const targetOrganization = candidates.find((item) => item.organization_id === targetOrganizationId.trim());
    if (!targetOrganization) {
      addLog("Target organization not found in this tenant.");
      return;
    }
    const amountRaw = window.prompt(`Transfer amount to ${targetOrganization.name}:`, "250");
    if (amountRaw === null) {
      addLog("Organization transfer canceled.");
      return;
    }
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      addLog("Transfer amount must be greater than zero.");
      return;
    }
    const memo = window.prompt("Transfer memo (optional):", `Budget transfer to ${targetOrganization.name}`);
    if (memo === null) {
      addLog("Organization transfer canceled.");
      return;
    }

    const result = await runAdminAction("transfer_organization", {
      target_tenant_id: organization.tenant_id,
      organization_id: organizationId,
      target_organization_id: targetOrganization.organization_id,
      amount,
      memo: String(memo || "").trim()
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
    const name = window.prompt("Organization or department name:", organization.name || "");
    if (!name || !name.trim()) {
      addLog("Organization update canceled.");
      return;
    }
    const type = window.prompt("Organization type (BUSINESS, GOVERNMENT, DEPARTMENT, NONPROFIT):", organization.organization_type || "BUSINESS");
    if (!type || !type.trim()) {
      addLog("Organization update canceled.");
      return;
    }
    const department = window.prompt("Department or division name (optional):", organization.department_name || "");
    if (department === null) {
      addLog("Organization update canceled.");
      return;
    }
    const budgetCycle = window.prompt(
      "Budget cycle (NONE, WEEKLY, MONTHLY, QUARTERLY, ANNUAL):",
      organization.budget_cycle || "MONTHLY"
    );
    if (!budgetCycle || !budgetCycle.trim()) {
      addLog("Organization update canceled.");
      return;
    }
    const budgetRaw = window.prompt("Department budget amount (0 for none):", String(organization.budget_amount || 0));
    if (budgetRaw === null) {
      addLog("Organization update canceled.");
      return;
    }
    const budgetAmount = Number(budgetRaw);
    if (!Number.isFinite(budgetAmount) || budgetAmount < 0) {
      addLog("Budget amount must be zero or greater.");
      return;
    }
    const reserveRaw = window.prompt("Reserve target amount (0 for none):", String(organization.reserve_target || 0));
    if (reserveRaw === null) {
      addLog("Organization update canceled.");
      return;
    }
    const reserveTarget = Number(reserveRaw);
    if (!Number.isFinite(reserveTarget) || reserveTarget < 0) {
      addLog("Reserve target must be zero or greater.");
      return;
    }
    const notes = window.prompt("Notes (optional):", organization.notes || "");
    if (notes === null) {
      addLog("Organization update canceled.");
      return;
    }

    const result = await runAdminAction("update_organization", {
      target_tenant_id: organization.tenant_id,
      organization_id: organizationId,
      name: name.trim(),
      organization_type: type.trim().toUpperCase(),
      department_name: String(department || "").trim(),
      budget_cycle: budgetCycle.trim().toUpperCase(),
      budget_amount: budgetAmount,
      reserve_target: reserveTarget,
      notes: String(notes || "").trim()
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
  const confirmed = window.confirm(`${kind === "reactivate-organization" ? "Reactivate" : "Deactivate"} ${organization.name}?`);
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
    const accountId = window.prompt("Account ID to employ:", state.selectedAccountId || "");
    if (!accountId || !accountId.trim()) {
      addLog("Employment creation canceled.");
      return;
    }
    const organizationId = window.prompt("Organization ID (optional, recommended):", safeArray(state.store?.organizations)[0]?.organization_id || "");
    if (organizationId === null) {
      addLog("Employment creation canceled.");
      return;
    }
    const organization = safeArray(state.store?.organizations).find((item) => item.organization_id === String(organizationId || "").trim());
    const employerName = window.prompt("Employer or business name:", organization?.name || "Whispering Pines Bank");
    if (!employerName || !employerName.trim()) {
      addLog("Employment creation canceled.");
      return;
    }
    const departmentName = window.prompt("Department name:", organization?.department_name || "Banking");
    if (departmentName === null) {
      addLog("Employment creation canceled.");
      return;
    }
    const title = window.prompt("Job title:", "Teller");
    if (!title || !title.trim()) {
      addLog("Employment creation canceled.");
      return;
    }
    const payRaw = window.prompt("Pay rate per payroll run:", "250");
    if (payRaw === null) {
      addLog("Employment creation canceled.");
      return;
    }
    const payRate = Number(payRaw);
    if (!payRate || payRate < 1) {
      addLog("Pay rate must be greater than zero.");
      return;
    }
    const cycle = window.prompt("Pay cycle:", "WEEKLY");
    if (!cycle || !cycle.trim()) {
      addLog("Employment creation canceled.");
      return;
    }

    const result = await runAdminAction("create_employment", {
      account_id: accountId.trim(),
      organization_id: String(organizationId || "").trim(),
      employer_name: employerName.trim(),
      department_name: String(departmentName || "").trim(),
      title: title.trim(),
      pay_rate: payRate,
      pay_cycle: cycle.trim().toUpperCase()
    });
    if (!result.ok) {
      addLog(result.error || "Employment creation failed.");
      return;
    }
    applyStore(result.store);
    addLog(result.message || `Employment created for ${accountId.trim()}.`);
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
    const organizationId = window.prompt("Organization ID (optional, recommended):", employment.organization_id || "");
    if (organizationId === null) {
      addLog("Employment update canceled.");
      return;
    }
    const organization = safeArray(state.store?.organizations).find((item) => item.organization_id === String(organizationId || "").trim());
    const employerName = window.prompt("Employer or business name:", organization?.name || employment.employer_name || "");
    if (!employerName || !employerName.trim()) {
      addLog("Employment update canceled.");
      return;
    }
    const departmentName = window.prompt("Department name:", organization?.department_name || employment.department_name || "");
    if (departmentName === null) {
      addLog("Employment update canceled.");
      return;
    }
    const title = window.prompt("Job title:", employment.title || "");
    if (!title || !title.trim()) {
      addLog("Employment update canceled.");
      return;
    }
    const payRaw = window.prompt("Pay rate per payroll run:", String(employment.pay_rate || 0));
    if (payRaw === null) {
      addLog("Employment update canceled.");
      return;
    }
    const payRate = Number(payRaw);
    if (!payRate || payRate < 1) {
      addLog("Pay rate must be greater than zero.");
      return;
    }
    const cycle = window.prompt("Pay cycle:", employment.pay_cycle || "WEEKLY");
    if (!cycle || !cycle.trim()) {
      addLog("Employment update canceled.");
      return;
    }

    const result = await runAdminAction("update_employment", {
      employment_id: employmentId,
      organization_id: String(organizationId || "").trim(),
      employer_name: employerName.trim(),
      department_name: String(departmentName || "").trim(),
      title: title.trim(),
      pay_rate: payRate,
      pay_cycle: cycle.trim().toUpperCase()
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
    const confirmed = window.confirm(`Terminate employment ${employmentId}?`);
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
    if (!tenant) {
      addLog("Target tenant was not found.");
      return;
    }
    const tenantName = window.prompt("Tenant display name:", tenant.name || "");
    if (tenantName === null) {
      return;
    }
    const bankName = window.prompt("Bank display name:", tenant.bank_name || "");
    if (bankName === null) {
      return;
    }
    const regionName = window.prompt("Primary region name:", tenant.primary_region_name || "");
    if (regionName === null) {
      return;
    }
    const payrollRaw = window.prompt("Default payroll amount:", String(tenant.payroll_default_amount ?? 250));
    if (payrollRaw === null) {
      return;
    }

    const result = await runAdminAction("update_tenant_settings", {
      target_tenant_id: tenantId,
      tenant_name: tenantName.trim(),
      bank_name: bankName.trim(),
      primary_region_name: regionName.trim(),
      payroll_default_amount: Number(payrollRaw)
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
    const confirmed = window.confirm(`Delete tenant ${tenantId}? This permanently removes its users, accounts, cards, incidents, audit logs, licenses, and other linked data.`);
    if (!confirmed) {
      addLog(`Delete canceled for ${tenantId}.`);
      return;
    }
  }

  if (kind === "expire-license") {
    const confirmed = window.confirm(`Expire the license for ${tenantId} now? Tenant users will be blocked from logging in until the license is reactivated or extended.`);
    if (!confirmed) {
      addLog(`License expiry canceled for ${tenantId}.`);
      return;
    }
  }

  const payload = {
    target_tenant_id: tenantId
  };

  if (kind === "extend-license") {
    const raw = window.prompt("Extend license by how many days?", "30");
    if (raw === null) {
      addLog(`License extension canceled for ${tenantId}.`);
      return;
    }
    const days = Number(raw);
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
    setInterval(() => setClock("clock-line"), 1000);
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
    if (["create-account", "deposit", "withdraw", "freeze", "unfreeze"].includes(kind)) {
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
      const tenantName = window.prompt("New tenant display name:", "");
      if (!tenantName || !tenantName.trim()) {
        addLog("Platform tenant creation canceled.");
        return;
      }
      const bankName = window.prompt("New bank display name:", tenantName.trim() + " Bank");
      if (!bankName || !bankName.trim()) {
        addLog("Platform tenant creation canceled.");
        return;
      }
      const ownerAvatar = window.prompt("Owner avatar or operator name:", "");
      if (ownerAvatar === null) {
        addLog("Platform tenant creation canceled.");
        return;
      }
      const result = await runAdminAction("create_tenant", {
        tenant_name: tenantName.trim(),
        bank_name: bankName.trim(),
        owner_avatar_name: String(ownerAvatar || "").trim()
      });
      if (!result.ok) {
        addLog(result.error || "Platform tenant creation failed.");
        return;
      }
      applyStore(result.store);
      addLog(result.message || `Created tenant ${tenantName.trim()}.`);
      return;
    }

    const tenant = getCurrentTenant();
    const tenantName = window.prompt("Tenant display name:", tenant?.name || "");
    if (tenantName === null) {
      return;
    }
    const bankName = window.prompt("Bank display name:", tenant?.bank_name || "");
    if (bankName === null) {
      return;
    }
    const regionName = window.prompt("Primary region name:", tenant?.primary_region_name || "");
    if (regionName === null) {
      return;
    }
    const payrollRaw = window.prompt("Default payroll amount:", String(tenant?.payroll_default_amount || 250));
    if (payrollRaw === null) {
      return;
    }

    const result = await runAdminAction("update_tenant_settings", {
      tenant_name: tenantName.trim(),
      bank_name: bankName.trim(),
      primary_region_name: regionName.trim(),
      payroll_default_amount: Number(payrollRaw)
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
      const tenantName = window.prompt("New tenant display name:", "");
      if (!tenantName || !tenantName.trim()) {
        return;
      }
      const bankName = window.prompt("New bank display name:", tenantName.trim() + " Bank");
      if (!bankName || !bankName.trim()) {
        addLog("Platform tenant creation canceled.");
        return;
      }
      const ownerAvatar = window.prompt("Owner avatar or operator name:", "");
      if (ownerAvatar === null) {
        addLog("Platform tenant creation canceled.");
        return;
      }

      const result = await runAdminAction("create_tenant", {
        tenant_name: tenantName.trim(),
        bank_name: bankName.trim(),
        owner_avatar_name: String(ownerAvatar || "").trim()
      });
      if (!result.ok) {
        addLog(result.error || "Tenant creation failed.");
        return;
      }
      applyStore(result.store);
      addLog(result.message || `Created tenant ${tenantName.trim()}.`);
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
  document.getElementById("staff-role").addEventListener("change", updateStaffRoleHint);
  document.getElementById("staff-form").addEventListener("submit", submitStaffCreate);
  document.getElementById("staff-cancel").addEventListener("click", closeStaffModal);
  document.querySelectorAll("[data-close-modal=\"staff\"]").forEach((node) => {
    node.addEventListener("click", closeStaffModal);
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
        setInterval(() => setClock("clock-line"), 1000);
        return;
      }
      handleSessionFailure(result.error || "Saved session is no longer valid.");
    }).catch(() => {
      setInterval(() => setClock("clock-line"), 1000);
    });
  }
}

boot();
