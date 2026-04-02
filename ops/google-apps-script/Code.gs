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
  atms: "atms"
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
    return row.username === payload.username
      && row.password_hash === hash_(payload.password)
      && row.status === "ACTIVE";
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
    return row.activation_code === payload.activation_code;
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

function buildDashboardStore_(payload) {
  var tenantId = payload.tenant_id || "";
  return {
    tenants: filterByTenant_(readSheet_(SHEETS.tenants), tenantId),
    accounts: filterByTenant_(readSheet_(SHEETS.accounts), tenantId),
    cards: filterCardsByTenant_(tenantId),
    fines: filterFinesByTenant_(tenantId),
    loans: filterLoansByTenant_(tenantId),
    transactions: [],
    audit_logs: filterByTenant_(readSheet_(SHEETS.audit), tenantId),
    vault_incidents: filterByTenant_(readSheet_(SHEETS.incidents), tenantId),
    branches: [],
    regions: []
  };
}

function filterByTenant_(rows, tenantId) {
  if (!tenantId) {
    return rows;
  }
  return rows.filter(function(row) {
    return row.tenant_id === tenantId;
  });
}

function filterCardsByTenant_(tenantId) {
  if (!tenantId) {
    return readSheet_(SHEETS.cards);
  }
  var accounts = filterByTenant_(readSheet_(SHEETS.accounts), tenantId);
  var accountIds = accounts.map(function(account) { return account.account_id; });
  return readSheet_(SHEETS.cards).filter(function(card) {
    return accountIds.indexOf(card.account_id) !== -1;
  });
}

function filterFinesByTenant_(tenantId) {
  if (!tenantId) {
    return readSheet_(SHEETS.fines);
  }
  var accounts = filterByTenant_(readSheet_(SHEETS.accounts), tenantId);
  var accountIds = accounts.map(function(account) { return account.account_id; });
  return readSheet_(SHEETS.fines).filter(function(fine) {
    return accountIds.indexOf(fine.account_id) !== -1;
  });
}

function filterLoansByTenant_(tenantId) {
  if (!tenantId) {
    return readSheet_(SHEETS.loans);
  }
  var accounts = filterByTenant_(readSheet_(SHEETS.accounts), tenantId);
  var accountIds = accounts.map(function(account) { return account.account_id; });
  return readSheet_(SHEETS.loans).filter(function(loan) {
    return accountIds.indexOf(loan.account_id) !== -1;
  });
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
  var headers = values[0];
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
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(header) {
    return record[header] || "";
  });
  sheet.appendRow(row);
}

function updateTenantOwner_(tenantId, username) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.tenants);
  if (!sheet) {
    return;
  }
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var tenantIdIndex = headers.indexOf("tenant_id");
  var ownerIndex = headers.indexOf("owner_username");

  for (var i = 1; i < values.length; i += 1) {
    if (values[i][tenantIdIndex] === tenantId) {
      sheet.getRange(i + 1, ownerIndex + 1).setValue(username);
      return;
    }
  }
}

function updateUserSession_(userId, token) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.users);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var userIdIndex = headers.indexOf("user_id");
  var tokenIndex = headers.indexOf("session_token");
  var expiresIndex = headers.indexOf("session_expires_at");

  for (var i = 1; i < values.length; i += 1) {
    if (values[i][userIdIndex] === userId) {
      sheet.getRange(i + 1, tokenIndex + 1).setValue(token);
      sheet.getRange(i + 1, expiresIndex + 1).setValue(new Date(Date.now() + (12 * 60 * 60 * 1000)).toISOString());
      return;
    }
  }
}

function validateSession_(token, tenantId) {
  var users = readSheet_(SHEETS.users);
  var user = users.filter(function(row) {
    return row.session_token === token
      && row.tenant_id === tenantId
      && row.status === "ACTIVE";
  })[0];

  if (!user) {
    throw new Error("Invalid or expired session.");
  }

  return user.tenant_id;
}

function hash_(value) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return digest.map(function(byte) {
    var v = (byte < 0 ? byte + 256 : byte).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

function token_() {
  return Utilities.getUuid().replace(/-/g, "");
}
