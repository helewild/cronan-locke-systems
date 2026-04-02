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
  setupUsers: {}
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
}

function setAuthMessage(message, tone) {
  const box = document.getElementById("auth-message");
  box.textContent = message;
  box.classList.toggle("alert", tone === "alert");
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

function renderTenant() {
  const tenant = safeArray(state.store.tenants)[0];
  document.getElementById("tenant-name").textContent = tenant ? tenant.name.toUpperCase() : "NO TENANT";
  document.getElementById("tenant-bank").textContent = tenant ? tenant.bank_name.toUpperCase() : "NO BANK";
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

function updateSystemStatus() {
  const atmOffline = state.atmNetwork.filter((atm) => atm.status !== "ONLINE").length;
  const incidentActive = state.incident && state.incident.state === "ACTIVE";
  document.getElementById("status-line-1").textContent = "ATM NETWORK: " + (atmOffline ? "DEGRADED" : "ONLINE");
  document.getElementById("status-line-2").textContent = "DISPATCH: " + (incidentActive ? "ENGAGED" : "MONITORING");
  document.getElementById("status-line-3").textContent = "MODE: " + (CONFIG.apiUrl ? "APPS SCRIPT BRIDGE" : "STATIC PREVIEW");
}

function renderIncident() {
  const incident = state.incident;
  document.getElementById("incident-id").textContent = incident ? incident.incident_id : "-";
  document.getElementById("incident-stage").textContent = incident ? incident.stage : "-";
  document.getElementById("incident-unit").textContent = incident ? incident.responding_unit : "-";
  document.getElementById("incident-update").textContent = incident ? incident.last_update.toUpperCase() : "-";
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

function applyStore(store) {
  state.store = store;
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
  let columns = [];
  let rows = [];

  if (view === "bank-core") {
    title.textContent = "Bank Core";
    columns = ["Module", "Scope", "Health", "Note"];
    rows = [
      ["Accounts", "Customer banking", "ONLINE", "Balances, cards, and statements available"],
      ["Justice", "Fines and enforcement", "ONLINE", "Fine collection and records active"],
      ["Credit", "Loans and lending", "ONLINE", "Outstanding loan servicing enabled"],
      ["Security", "Vault and dispatch", state.incident ? "ALERT" : "ONLINE", state.incident ? state.incident.stage : "No incident"]
    ];
  } else if (view === "accounts") {
    title.textContent = "Accounts";
    columns = ["Account ID", "Customer", "Balance", "Status"];
    rows = (store.accounts || []).map((account) => [
      account.account_id,
      account.customer_name,
      { money: account.balance },
      { chip: account.status, tone: account.status === "ACTIVE" ? "" : "dim" }
    ]);
  } else if (view === "transactions") {
    title.textContent = "Transactions";
    columns = ["Type", "Account", "Amount", "Direction"];
    rows = getTransactions(store).map((txn) => [
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
    rows = safeArray(store.vault_incidents).map((incident) => [
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
      .map((txn) => [txn.type, txn.account_id, { money: txn.amount }, txn.memo]);
  } else if (view === "atm-network") {
    title.textContent = "ATM Network";
    columns = ["ATM ID", "Branch", "Status", "Scope"];
    rows = state.atmNetwork.map((atm) => [
      atm.id,
      atm.branch,
      { chip: atm.status, tone: atm.status === "ONLINE" ? "" : "alert" },
      atm.scope
    ]);
  } else if (view === "audit-logs") {
    title.textContent = "Audit Logs";
    columns = ["Action", "Actor", "Target", "Status"];
    rows = safeArray(store.audit_logs).map((audit) => [
      audit.action,
      audit.actor_name,
      audit.target_account_id || audit.object_id,
      { chip: String(audit.status || "").toUpperCase(), tone: audit.status === "approved" ? "" : "dim" }
    ]);
  }

  head.innerHTML = "<tr>" + columns.map((column) => `<th>${column}</th>`).join("") + "</tr>";
  body.innerHTML = rows.map((row) => "<tr>" + row.map((cell) => {
    if (cell && typeof cell === "object" && "money" in cell) {
      return `<td class="money">L$${cell.money}</td>`;
    }
    if (cell && typeof cell === "object" && "chip" in cell) {
      return `<td><span class="chip ${cell.tone || ""}">${cell.chip}</span></td>`;
    }
    return `<td>${cell}</td>`;
  }).join("") + "</tr>").join("");
  foot.textContent = "Showing " + rows.length + " records for " + title.textContent.toUpperCase();
}

function setActiveView(view) {
  state.view = view;
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
  });
  const actionButton = document.getElementById("view-action-btn");
  actionButton.classList.toggle("hidden", view !== "payroll");
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
  document.getElementById("admin-username").textContent = session.username.toUpperCase();
  document.getElementById("admin-role").textContent = (session.role || "tenant_owner").toUpperCase().replaceAll("_", " ");
  document.getElementById("header-user-line").textContent = "USERNAME: " + session.username.toUpperCase();
  setClock("clock-line");
  applyStore(state.store);
}

function logout() {
  state.session = null;
  clearSession();
  document.getElementById("admin-shell").classList.add("hidden");
  document.getElementById("auth-shell").classList.remove("hidden");
  setAuthMessage("Session closed. Login required to access the admin terminal.");
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

  return bridgeRequest("admin_action", payload);
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
      applyStore(result.store);
    }
    addLog("Manual refresh executed for " + state.view.toUpperCase());
  });

  document.getElementById("manage-tenant-btn").addEventListener("click", async () => {
    const result = await runAdminAction("manage_tenant");
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
      if (result.ok && result.store) {
        state.store = result.store;
      }
      applySession(session);
      setInterval(() => setClock("clock-line"), 1000);
    }).catch(() => {
      applySession(session);
      setInterval(() => setClock("clock-line"), 1000);
    });
  }
}

boot();
