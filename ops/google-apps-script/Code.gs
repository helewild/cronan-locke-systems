var SHEETS = {
  tenants: "tenants",
  users: "users",
  accounts: "accounts",
  cards: "cards",
  fines: "fines",
  loans: "loans",
  incidents: "vault_incidents",
  audit: "audit_logs",
  atms: "atms"
};

function doPost(e) {
  var payload = parsePayload_(e);
  var action = payload.action || "";

  if (action === "login") {
    return json_({ ok: true, session: login_(payload) });
  }

  if (action === "activate_owner") {
    return json_(activateOwner_(payload));
  }

  if (action === "dashboard") {
    return json_({ ok: true, store: buildDashboardStore_(payload) });
  }

  if (action === "register_tenant_box") {
    return json_(registerTenantBox_(payload));
  }

  return json_({ ok: false, error: "Unsupported action." });
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
    return row.username === payload.username && row.password_hash === hash_(payload.password);
  })[0];

  if (!user) {
    throw new Error("Invalid username or password.");
  }

  var token = token_();
  updateUserSession_(user.user_id, token);

  return {
    username: user.username,
    role: user.role,
    tenant_id: user.tenant_id,
    token: token
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

  return {
    ok: true,
    message: "Owner account activated."
  };
}

function registerTenantBox_(payload) {
  var tenantId = "tenant-" + token_().slice(0, 8);
  var activationCode = "ACT-" + token_().slice(0, 10).toUpperCase();

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

  return {
    ok: true,
    tenant_id: tenantId,
    activation_code: activationCode
  };
}

function buildDashboardStore_(payload) {
  return {
    tenants: readSheet_(SHEETS.tenants),
    accounts: readSheet_(SHEETS.accounts),
    cards: readSheet_(SHEETS.cards),
    fines: readSheet_(SHEETS.fines),
    loans: readSheet_(SHEETS.loans),
    transactions: [],
    audit_logs: readSheet_(SHEETS.audit),
    vault_incidents: readSheet_(SHEETS.incidents),
    branches: [],
    regions: []
  };
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
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(header) {
    return record[header] || "";
  });
  sheet.appendRow(row);
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
