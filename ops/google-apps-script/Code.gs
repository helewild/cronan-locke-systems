var SHEETS = {
  tenants: "tenants",
  users: "users",
  licenses: "licenses",
  accounts: "accounts",
  cards: "cards",
  fines: "fines",
  loans: "loans",
  incidents: "vault_incidents",
  audit: "audit_logs",
  atms: "atms",
  transactions: "transactions"
};

function doPost(e) {
  try {
    var payload = parsePayload_(e);
    var action = payload.action || "";

    if (action === "health") {
      return json_({ ok: true, status: "online" });
    }

    if (action === "login") {
      return json_(login_(payload));
    }

    if (action === "activate_owner") {
      return json_(activateOwner_(payload));
    }

    if (action === "dashboard") {
      return json_(dashboard_(payload));
    }

    if (action === "register_tenant_box") {
      return json_(registerTenantBox_(payload));
    }

    if (action === "admin_action") {
      return json_(adminAction_(payload));
    }

    return json_({ ok: false, error: "Unsupported action." });
  } catch (error) {
    return json_({
      ok: false,
      error: error.message || "Bridge request failed."
    });
  }
}

function doGet(e) {
  var action = (e.parameter && e.parameter.action) || "";
  if (action === "health") {
    return json_({ ok: true, status: "online" });
  }
  return json_({ ok: false, error: "Unsupported action." });
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }
  return JSON.parse(e.postData.contents);
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function login_(payload) {
  var users = readSheet_(SHEETS.users);
  var user = users.filter(function(row) {
    return String(row.username || "").trim() === String(payload.username || "").trim()
      && String(row.password_hash || "").trim() === hash_(payload.password || "")
      && String(row.status || "").trim() === "ACTIVE";
  })[0];

  if (!user) {
    return { ok: false, error: "Invalid username or password." };
  }

  var token = token_();
  updateUserSession_(user.user_id, token);

  return {
    ok: true,
    session: {
      username: user.username,
      role: user.role,
      tenant_id: user.tenant_id,
      token: token
    },
    store: buildDashboardStore_({ tenant_id: user.tenant_id })
  };
}

function activateOwner_(payload) {
  var tenants = readSheet_(SHEETS.tenants);
  var tenant = tenants.filter(function(row) {
    return String(row.activation_code || "").trim() === String(payload.activation_code || "").trim();
  })[0];

  if (!tenant) {
    return { ok: false, error: "Activation code not recognized." };
  }

  appendRow_(SHEETS.users, {
    user_id: token_(),
    tenant_id: tenant.tenant_id,
    username: payload.username,
    password_hash: hash_(payload.password),
    role: "tenant_owner",
    avatar_name: payload.avatar_name,
    status: "ACTIVE",
    session_token: "",
    session_expires_at: "",
    must_reset_password: "FALSE"
  });

  updateTenantOwner_(tenant.tenant_id, payload.username);
  appendAuditLog_(tenant.tenant_id, {
    actor_name: payload.avatar_name,
    object_type: "website",
    object_id: "owner-activation",
    target_account_id: "",
    action: "owner_activate",
    status: "approved",
    amount: "",
    memo: "Owner account created for " + payload.username
  });

  return {
    ok: true,
    message: "Owner account activated."
  };
}

function registerTenantBox_(payload) {
  var tenantId = "tenant-" + token_().slice(0, 8);
  var activationCode = "ACT-" + token_().slice(0, 10).toUpperCase();
  var licenseId = "lic-" + token_().slice(0, 8);

  appendRow_(SHEETS.tenants, {
    tenant_id: tenantId,
    name: payload.tenant_name || payload.buyer_avatar_name,
    bank_name: payload.bank_name || "New Tenant Bank",
    status: "ACTIVE",
    owner_avatar_name: payload.buyer_avatar_name,
    owner_username: "",
    activation_code: activationCode,
    created_at: new Date().toISOString()
  });

  appendRow_(SHEETS.licenses, {
    license_id: licenseId,
    tenant_id: tenantId,
    buyer_avatar_name: payload.buyer_avatar_name || "",
    buyer_avatar_key: payload.buyer_avatar_key || "",
    marketplace_order_id: payload.marketplace_order_id || "",
    status: "ACTIVE",
    issued_at: new Date().toISOString()
  });

  return {
    ok: true,
    tenant_id: tenantId,
    activation_code: activationCode,
    license_id: licenseId
  };
}

function dashboard_(payload) {
  var tenantId = validateSession_(payload.token, payload.tenant_id);
  return {
    ok: true,
    store: buildDashboardStore_({ tenant_id: tenantId })
  };
}

function adminAction_(payload) {
  var tenantId = validateSession_(payload.token, payload.tenant_id);
  var actionType = String(payload.action_type || "").trim();
  var actorName = String(payload.actor_name || payload.username || "Admin").trim();
  var message = "Action completed.";

  if (actionType === "dispatch_police") {
    dispatchPolice_(tenantId, actorName, payload.incident_id || "");
    message = "Police dispatch sent.";
  } else if (actionType === "lock_vault") {
    lockVault_(tenantId, actorName, payload.incident_id || "");
    message = "Vault lockdown triggered.";
  } else if (actionType === "shutdown_atm_network") {
    shutdownAtmNetwork_(tenantId, actorName);
    message = "ATM network marked offline.";
  } else if (actionType === "run_payroll") {
    runPayroll_(tenantId, actorName, payload.amount);
    message = "Payroll applied to active accounts.";
  } else if (actionType === "manage_tenant") {
    appendAuditLog_(tenantId, {
      actor_name: actorName,
      object_type: "website",
      object_id: "tenant-console",
      target_account_id: "",
      action: "tenant_manage_open",
      status: "approved",
      amount: "",
      memo: "Tenant management opened from admin terminal"
    });
    message = "Tenant management session logged.";
  } else {
    return { ok: false, error: "Unsupported admin action." };
  }

  return {
    ok: true,
    message: message,
    store: buildDashboardStore_({ tenant_id: tenantId })
  };
}

function buildDashboardStore_(payload) {
  var tenantId = payload.tenant_id || "";
  return {
    tenants: filterByTenant_(readSheet_(SHEETS.tenants), tenantId),
    accounts: filterByTenant_(readSheet_(SHEETS.accounts), tenantId),
    cards: filterCardsByTenant_(tenantId),
    fines: filterFinesByTenant_(tenantId),
    loans: filterLoansByTenant_(tenantId),
    transactions: buildTransactions_(tenantId),
    audit_logs: filterByTenant_(readSheet_(SHEETS.audit), tenantId),
    vault_incidents: filterByTenant_(readSheet_(SHEETS.incidents), tenantId),
    branches: [],
    regions: [],
    atms: filterByTenant_(readSheet_(SHEETS.atms), tenantId)
  };
}

function buildTransactions_(tenantId) {
  var transactions = readSheet_(SHEETS.transactions);
  if (transactions.length) {
    return tenantId ? transactions.filter(function(txn) {
      return String(txn.tenant_id || "").trim() === String(tenantId).trim();
    }) : transactions;
  }

  return filterByTenant_(readSheet_(SHEETS.audit), tenantId).map(function(audit, index) {
    return {
      transaction_id: audit.audit_id || ("txn-audit-" + index),
      tenant_id: audit.tenant_id || tenantId,
      account_id: audit.target_account_id || "",
      type: String(audit.action || "audit").toUpperCase(),
      amount: numberOrZero_(audit.amount),
      direction: numberOrZero_(audit.amount) < 0 ? "OUT" : "IN",
      memo: audit.memo || audit.object_type || ""
    };
  });
}

function filterByTenant_(rows, tenantId) {
  if (!tenantId) {
    return rows;
  }
  return rows.filter(function(row) {
    return String(row.tenant_id || "").trim() === String(tenantId).trim();
  });
}

function filterCardsByTenant_(tenantId) {
  if (!tenantId) {
    return readSheet_(SHEETS.cards);
  }
  var accounts = filterByTenant_(readSheet_(SHEETS.accounts), tenantId);
  var accountIds = accounts.map(function(account) { return String(account.account_id || "").trim(); });
  return readSheet_(SHEETS.cards).filter(function(card) {
    return accountIds.indexOf(String(card.account_id || "").trim()) !== -1;
  });
}

function filterFinesByTenant_(tenantId) {
  if (!tenantId) {
    return readSheet_(SHEETS.fines);
  }
  var accounts = filterByTenant_(readSheet_(SHEETS.accounts), tenantId);
  var accountIds = accounts.map(function(account) { return String(account.account_id || "").trim(); });
  return readSheet_(SHEETS.fines).filter(function(fine) {
    return accountIds.indexOf(String(fine.account_id || "").trim()) !== -1;
  });
}

function filterLoansByTenant_(tenantId) {
  if (!tenantId) {
    return readSheet_(SHEETS.loans);
  }
  var accounts = filterByTenant_(readSheet_(SHEETS.accounts), tenantId);
  var accountIds = accounts.map(function(account) { return String(account.account_id || "").trim(); });
  return readSheet_(SHEETS.loans).filter(function(loan) {
    return accountIds.indexOf(String(loan.account_id || "").trim()) !== -1;
  });
}

function dispatchPolice_(tenantId, actorName, incidentId) {
  var context = getSheetContext_(SHEETS.incidents);
  var activeIndex = findIncidentRowIndex_(context, tenantId, incidentId);
  if (activeIndex === -1) {
    throw new Error("No matching incident found to dispatch.");
  }

  updateSheetCell_(context.sheet, activeIndex, context.headers, "stage", "UNIT DISPATCHED");
  updateSheetCell_(context.sheet, activeIndex, context.headers, "responding_unit", "UNIT 12");
  updateSheetCell_(context.sheet, activeIndex, context.headers, "last_update", "Dispatch authorized by " + actorName);

  var row = context.rows[activeIndex];
  appendAuditLog_(tenantId, {
    actor_name: actorName,
    object_type: "incident",
    object_id: row[context.headerIndex.incident_id] || "",
    target_account_id: "",
    action: "incident_dispatch",
    status: "approved",
    amount: "",
    memo: "Unit 12 dispatched to " + (row[context.headerIndex.vault_id] || "vault")
  });
}

function lockVault_(tenantId, actorName, incidentId) {
  var context = getSheetContext_(SHEETS.incidents);
  var activeIndex = findIncidentRowIndex_(context, tenantId, incidentId);
  if (activeIndex === -1) {
    throw new Error("No matching incident found to lock down.");
  }

  updateSheetCell_(context.sheet, activeIndex, context.headers, "stage", "LOCKDOWN TRIGGERED");
  updateSheetCell_(context.sheet, activeIndex, context.headers, "last_update", "Vault lockdown authorized by " + actorName);

  var row = context.rows[activeIndex];
  appendAuditLog_(tenantId, {
    actor_name: actorName,
    object_type: "vault",
    object_id: row[context.headerIndex.vault_id] || "",
    target_account_id: "",
    action: "vault_lockdown",
    status: "approved",
    amount: "",
    memo: "Lockdown triggered from web terminal"
  });
}

function shutdownAtmNetwork_(tenantId, actorName) {
  var context = getSheetContext_(SHEETS.atms);
  if (!context.rows.length) {
    throw new Error("No ATM records found for this tenant.");
  }

  var tenantColumn = requireHeaderIndex_(context.headers, "tenant_id", SHEETS.atms);
  var statusColumn = requireHeaderIndex_(context.headers, "status", SHEETS.atms);
  var touched = 0;

  for (var i = 0; i < context.rows.length; i += 1) {
    if (String(context.rows[i][tenantColumn] || "").trim() === String(tenantId).trim()) {
      context.sheet.getRange(i + 2, statusColumn + 1).setValue("OFFLINE");
      touched += 1;
    }
  }

  appendAuditLog_(tenantId, {
    actor_name: actorName,
    object_type: "atm_network",
    object_id: "tenant-atm-network",
    target_account_id: "",
    action: "atm_network_shutdown",
    status: "approved",
    amount: "",
    memo: "ATM network shutdown requested for " + touched + " ATM(s)"
  });
}

function runPayroll_(tenantId, actorName, amountOverride) {
  var amount = numberOrZero_(amountOverride) || 250;
  var context = getSheetContext_(SHEETS.accounts);
  var tenantColumn = requireHeaderIndex_(context.headers, "tenant_id", SHEETS.accounts);
  var statusColumn = requireHeaderIndex_(context.headers, "status", SHEETS.accounts);
  var balanceColumn = requireHeaderIndex_(context.headers, "balance", SHEETS.accounts);
  var accountIdColumn = requireHeaderIndex_(context.headers, "account_id", SHEETS.accounts);
  var touched = 0;

  for (var i = 0; i < context.rows.length; i += 1) {
    var rowTenant = String(context.rows[i][tenantColumn] || "").trim();
    var rowStatus = String(context.rows[i][statusColumn] || "").trim();
    if (rowTenant !== String(tenantId).trim() || rowStatus !== "ACTIVE") {
      continue;
    }

    var currentBalance = numberOrZero_(context.rows[i][balanceColumn]);
    var nextBalance = currentBalance + amount;
    context.sheet.getRange(i + 2, balanceColumn + 1).setValue(nextBalance);
    touched += 1;

    appendAuditLog_(tenantId, {
      actor_name: actorName,
      object_type: "payroll",
      object_id: "web-payroll",
      target_account_id: context.rows[i][accountIdColumn] || "",
      action: "payroll_run",
      status: "approved",
      amount: amount,
      memo: "Web payroll deposit"
    });

    appendTransactionIfSheetExists_(tenantId, {
      transaction_id: "txn-" + token_().slice(0, 10),
      account_id: context.rows[i][accountIdColumn] || "",
      type: "PAYROLL",
      amount: amount,
      direction: "IN",
      memo: "Web payroll run",
      tenant_id: tenantId
    });
  }

  if (!touched) {
    throw new Error("No active accounts found for payroll.");
  }
}

function readSheet_(name) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) {
    return [];
  }

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  var headers = normalizeHeaders_(values[0]);

  return values.slice(1).map(function(row) {
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });
    return item;
  });
}

function appendRow_(sheetName, record) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Missing sheet: " + sheetName);
  }

  var headers = normalizeHeaders_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  var row = headers.map(function(header) {
    var value = record[header];
    return typeof value === "undefined" ? "" : value;
  });

  sheet.appendRow(row);
}

function appendTransactionIfSheetExists_(tenantId, record) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.transactions);
  if (!sheet) {
    return;
  }
  appendRow_(SHEETS.transactions, {
    transaction_id: record.transaction_id,
    tenant_id: tenantId,
    account_id: record.account_id,
    type: record.type,
    amount: record.amount,
    direction: record.direction,
    memo: record.memo
  });
}

function appendAuditLog_(tenantId, payload) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.audit);
  if (!sheet) {
    return;
  }

  appendRow_(SHEETS.audit, {
    audit_id: "aud-" + token_().slice(0, 10),
    tenant_id: tenantId,
    object_type: payload.object_type || "",
    object_id: payload.object_id || "",
    actor_name: payload.actor_name || "",
    target_account_id: payload.target_account_id || "",
    action: payload.action || "",
    status: payload.status || "approved",
    amount: payload.amount || "",
    memo: payload.memo || "",
    created_at: new Date().toISOString()
  });
}

function updateTenantOwner_(tenantId, username) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.tenants);
  if (!sheet) {
    throw new Error("Missing sheet: " + SHEETS.tenants);
  }

  var values = sheet.getDataRange().getValues();
  if (!values.length) {
    throw new Error("Sheet has no header row: " + SHEETS.tenants);
  }

  var headers = normalizeHeaders_(values[0]);
  var tenantIdIndex = requireHeaderIndex_(headers, "tenant_id", SHEETS.tenants);
  var ownerIndex = requireHeaderIndex_(headers, "owner_username", SHEETS.tenants);

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][tenantIdIndex]).trim() === String(tenantId).trim()) {
      sheet.getRange(i + 1, ownerIndex + 1).setValue(username);
      return;
    }
  }

  throw new Error("Tenant row not found for owner update.");
}

function updateUserSession_(userId, token) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.users);
  if (!sheet) {
    throw new Error("Missing sheet: " + SHEETS.users);
  }

  var values = sheet.getDataRange().getValues();
  if (!values.length) {
    throw new Error("Sheet has no header row: " + SHEETS.users);
  }

  var headers = normalizeHeaders_(values[0]);
  var userIdIndex = requireHeaderIndex_(headers, "user_id", SHEETS.users);
  var tokenIndex = requireHeaderIndex_(headers, "session_token", SHEETS.users);
  var expiresIndex = requireHeaderIndex_(headers, "session_expires_at", SHEETS.users);

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][userIdIndex]).trim() === String(userId).trim()) {
      sheet.getRange(i + 1, tokenIndex + 1).setValue(token);
      sheet.getRange(i + 1, expiresIndex + 1).setValue(
        new Date(Date.now() + (12 * 60 * 60 * 1000)).toISOString()
      );
      return;
    }
  }

  throw new Error("User row not found for session update.");
}

function validateSession_(token, tenantId) {
  var users = readSheet_(SHEETS.users);
  var user = users.filter(function(row) {
    return String(row.session_token || "").trim() === String(token || "").trim()
      && String(row.tenant_id || "").trim() === String(tenantId || "").trim()
      && String(row.status || "").trim() === "ACTIVE";
  })[0];

  if (!user) {
    throw new Error("Invalid or expired session.");
  }

  return user.tenant_id;
}

function getSheetContext_(sheetName) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Missing sheet: " + sheetName);
  }

  var values = sheet.getDataRange().getValues();
  if (!values.length) {
    throw new Error("Sheet has no header row: " + sheetName);
  }

  var headers = normalizeHeaders_(values[0]);
  var headerIndex = {};
  headers.forEach(function(header, index) {
    headerIndex[header] = index;
  });

  return {
    sheet: sheet,
    headers: headers,
    headerIndex: headerIndex,
    rows: values.slice(1)
  };
}

function findIncidentRowIndex_(context, tenantId, incidentId) {
  var incidentIdColumn = requireHeaderIndex_(context.headers, "incident_id", SHEETS.incidents);
  var tenantIdColumn = requireHeaderIndex_(context.headers, "tenant_id", SHEETS.incidents);

  for (var i = 0; i < context.rows.length; i += 1) {
    var rowIncidentId = String(context.rows[i][incidentIdColumn] || "");
    var rowTenantId = String(context.rows[i][tenantIdColumn] || "");
    if (incidentId && rowIncidentId === String(incidentId)) {
      return i;
    }
    if (!incidentId && rowTenantId === String(tenantId)) {
      return i;
    }
  }
  return -1;
}

function updateSheetCell_(sheet, rowIndex, headers, headerName, value) {
  var columnIndex = requireHeaderIndex_(headers, headerName, sheet.getName());
  sheet.getRange(rowIndex + 2, columnIndex + 1).setValue(value);
}

function normalizeHeaders_(headers) {
  return headers.map(function(header) {
    return String(header || "").trim();
  });
}

function requireHeaderIndex_(headers, name, sheetName) {
  var index = headers.indexOf(name);
  if (index === -1) {
    throw new Error("Missing header '" + name + "' in sheet '" + sheetName + "'.");
  }
  return index;
}

function numberOrZero_(value) {
  var num = Number(value);
  return isNaN(num) ? 0 : num;
}

function hash_(value) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8
  );

  return digest.map(function(byte) {
    var v = (byte < 0 ? byte + 256 : byte).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

function token_() {
  return Utilities.getUuid().replace(/-/g, "");
}
