let currentCaseQuery = "";
let currentTicketId = "";
let formOptions = { channels: [], members: [] };
let applicationFormsConfig = { default: { titlePrefix: "Apply:", fields: [] }, roles: {} };
let serverSettingsState = { guildId: "", guildName: "", defaultSettings: {}, guildOverride: {}, mergedSettings: {} };
let guildOptions = [];
let selectedGuildId = "";
const SELECTED_GUILD_STORAGE_KEY = "whispering-pines-dashboard:selected-guild";
const applicationFormRoleOptions = [
  "default",
  "citizen",
  "business-owner",
  "sheriffs-office",
  "bcso",
  "medical",
  "fire-department",
  "doj",
  "media",
  "events-team",
  "real-estate",
  "management",
  "business",
];

async function fetchJson(url, options = {}) {
  const requestUrl = new URL(url, window.location.origin);
  if (selectedGuildId && !requestUrl.searchParams.has("guildId")) {
    requestUrl.searchParams.set("guildId", selectedGuildId);
  }
  const response = await fetch(requestUrl, options);
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text || `Request failed: ${response.status}` };
  }
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

function formatDate(value) {
  if (!value) {
    return "n/a";
  }
  return new Date(value).toLocaleString();
}

function setStatus(title, subtitle) {
  document.getElementById("hero-status").textContent = title;
  document.getElementById("hero-subtitle").textContent = subtitle;
}

function renderGuildSelector() {
  const select = document.getElementById("guild-selector");
  const current = selectedGuildId || guildOptions[0]?.id || "";
  select.innerHTML = guildOptions
    .map((guild) => `<option value="${guild.id}">${guild.name}</option>`)
    .join("");
  if (current) {
    select.value = current;
  }
}

function setProvisionResult(text) {
  document.getElementById("provision-server-result").textContent = text;
}

async function runServerAction(scope, buildSummary) {
  const result = await fetchJson("/api/server-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope }),
  });
  setProvisionResult(buildSummary(result));
  await loadDashboard(currentCaseQuery);
}

function showUiError(error) {
  setStatus("Dashboard Error", error.message || "Something went wrong.");
}

function renderOverview(data) {
  setStatus(
    data.guild.name,
    `${data.guild.memberCount} members | ${data.guild.channelCount} channels | ${data.guild.roleCount} roles`,
  );

  const cards = [
    ["Open Tickets", data.metrics.openTickets],
    ["Open Apps", data.metrics.openApplications],
    ["Waiting Apps", data.metrics.waitingApplications],
    ["Warnings", data.metrics.warnings],
    ["Discipline", data.metrics.discipline],
    ["Businesses", data.metrics.businesses],
    ["Announcements", data.metrics.announcements],
    ["Transcripts", data.metrics.transcripts],
  ];

  document.getElementById("overview-cards").innerHTML = cards
    .map(
      ([label, value]) => `
        <article class="stat-card">
          <div class="stat-label">${label}</div>
          <div class="stat-value">${value}</div>
        </article>
      `,
    )
    .join("");

  document.getElementById("activity-feed").innerHTML = data.recentActivity.length
    ? data.recentActivity
        .map(
          (item) => `
            <article class="activity-item">
              <div class="activity-head">
                <strong>${item.title}</strong>
                <span class="tag ${item.bucket === "discipline" || item.bucket === "warning" ? "warn" : ""}">${item.bucket}</span>
              </div>
              <div class="meta">${item.caseId} | ${formatDate(item.createdAt)}</div>
              <div>${item.detail}</div>
            </article>
          `,
        )
        .join("")
    : `<div class="stack-card">No activity yet.</div>`;

  document.getElementById("announcement-list").innerHTML = data.announcements.length
    ? data.announcements
        .map(
          (entry) => `
            <article class="stack-card">
              <div class="stack-head">
                <strong>${entry.title}</strong>
                <span class="tag">${entry.type}</span>
              </div>
              <div class="meta">${entry.caseId} | #${entry.channelName} | ${formatDate(entry.createdAt)}</div>
              <div>${entry.body}</div>
            </article>
          `,
        )
        .join("")
    : `<div class="stack-card">No announcements recorded yet.</div>`;
}

function renderHealth(data) {
  const entries = [
    ["Bot Ready", data.botReady ? "yes" : "no"],
    ["Guild", data.guildName],
    ["Store Path", data.storePath],
    ["Transcripts", data.transcriptFolder],
  ];
  const counts = Object.entries(data.datasetCounts)
    .map(([key, value]) => `<div class="meta">${key}: ${value}</div>`)
    .join("");

  document.getElementById("health-panel").innerHTML = `
    <article class="stack-card">
      ${entries.map(([label, value]) => `<div><strong>${label}:</strong> <span class="dim">${value}</span></div>`).join("")}
      <div style="margin-top: 12px">${counts}</div>
    </article>
  `;
}

function renderCases(cases) {
  document.getElementById("case-table").innerHTML = cases.length
    ? cases
        .map(
          (entry) => `
            <tr>
              <td><strong>${entry.caseId}</strong></td>
              <td>${entry.bucket}</td>
              <td>${entry.summary}</td>
              <td>${entry.subject}</td>
              <td>${entry.status}</td>
              <td>${formatDate(entry.createdAt)}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="6">No matching cases.</td></tr>`;
}

function renderBusinesses(entries) {
  document.getElementById("business-list").innerHTML = entries.length
    ? entries
        .map(
          (entry) => `
            <article class="stack-card">
              <div class="stack-head">
                <strong>${entry.name}</strong>
                <span class="tag ${entry.status === "closed" ? "warn" : ""}">${entry.status}</span>
              </div>
              <div class="meta">${entry.caseId} | Owner: ${entry.ownerTag}</div>
              <div>License: ${entry.licenseStatus}</div>
              ${
                entry.status !== "closed"
                  ? `<button class="action close-business-button" data-case-id="${entry.caseId}">Close Business</button>`
                  : ""
              }
            </article>
          `,
        )
        .join("")
    : `<div class="stack-card">No businesses registered yet.</div>`;

  for (const button of document.querySelectorAll(".close-business-button")) {
    button.addEventListener("click", async () => {
      try {
        const actor = window.prompt("Close business as who?", "Dashboard");
        if (actor === null) {
          return;
        }
        const reason = window.prompt("Reason for closing this business?", "Closed from dashboard.");
        if (reason === null) {
          return;
        }
        await fetchJson(`/api/businesses/${button.dataset.caseId}/close`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor, reason }),
        });
        await loadDashboard(currentCaseQuery);
      } catch (error) {
        showUiError(error);
      }
    });
  }
}

function renderRosters(data) {
  document.getElementById("roster-grid").innerHTML = Object.entries(data)
    .map(
      ([key, members]) => `
        <article class="roster-card">
          <h3>${key.toUpperCase()}</h3>
          ${
            members.length
              ? `<ul>${members
                  .map((member) => `<li><strong>${member.displayName}</strong><div class="dim">${member.tag}</div><div class="meta">${member.roles.join(", ")}</div></li>`)
                  .join("")}</ul>`
              : `<div class="dim">No members in this roster.</div>`
          }
        </article>
      `,
    )
    .join("");
}

function renderTickets(tickets) {
  document.getElementById("ticket-list").innerHTML = tickets.length
    ? tickets
        .map(
          (ticket) => `
            <article class="stack-card ticket-list-item ${ticket.channelId === currentTicketId ? "active" : ""}" data-ticket-id="${ticket.channelId}">
              <div class="stack-head">
                <strong>#${ticket.channelName}</strong>
                <span class="tag">${ticket.type}</span>
              </div>
              <div class="meta">${ticket.caseId} | ${ticket.ownerTag}</div>
              <div class="dim">${formatDate(ticket.openedAt)}</div>
            </article>
          `,
        )
        .join("")
    : `<div class="stack-card">No open support tickets right now.</div>`;

  for (const item of document.querySelectorAll(".ticket-list-item")) {
    item.addEventListener("click", async () => {
      currentTicketId = item.dataset.ticketId;
      await loadTicketDetail(currentTicketId);
      renderTickets(tickets);
    });
  }
}

function renderTicketDetail(detail) {
  document.getElementById("ticket-detail-header").innerHTML = `
    <strong>#${detail.channelName}</strong>
    <div class="meta">Owner: ${detail.topic["ticket-owner"] || "n/a"} | Type: ${detail.topic.type || "support"}</div>
  `;
  document.getElementById("ticket-messages").innerHTML = detail.messages.length
    ? detail.messages
        .map(
          (message) => `
            <article class="ticket-message">
              <div class="stack-head">
                <strong>${message.authorTag}</strong>
                <span class="dim">${formatDate(message.createdAt)}</span>
              </div>
              <div>${message.content}</div>
            </article>
          `,
        )
        .join("")
    : `<div class="stack-card">No messages yet.</div>`;
}

function populateFormOptions() {
  const channelSelect = document.getElementById("announcement-channel");
  const ownerSelect = document.getElementById("business-owner");

  channelSelect.innerHTML = formOptions.channels
    .map((channel) => `<option value="${channel.id}">#${channel.name}</option>`)
    .join("");

  ownerSelect.innerHTML = `<option value="">Select owner</option>${formOptions.members
    .map((member) => `<option value="${member.id}">${member.displayName} (${member.tag})</option>`)
    .join("")}`;
}

function getApplicationFormForRole(roleKey) {
  if (roleKey === "default") {
    return applicationFormsConfig.default;
  }
  return applicationFormsConfig.roles[roleKey] || applicationFormsConfig.default;
}

function populateApplicationFormEditor() {
  const select = document.getElementById("application-form-role");
  const currentValue = select.value || "default";
  select.innerHTML = applicationFormRoleOptions
    .map((roleKey) => `<option value="${roleKey}">${roleKey}</option>`)
    .join("");
  select.value = applicationFormRoleOptions.includes(currentValue) ? currentValue : "default";

  const roleKey = select.value;
  const config = getApplicationFormForRole(roleKey);
  document.getElementById("application-form-title").value = config.title || "";
  document.getElementById("application-form-title-prefix").value = roleKey === "default" ? (applicationFormsConfig.default.titlePrefix || "Apply:") : "";
  document.getElementById("application-form-title-prefix").disabled = roleKey !== "default";
  document.getElementById("application-form-fields").value = JSON.stringify(config.fields || [], null, 2);
}

function commaSeparated(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function linesValue(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function currentSettingsScope() {
  return document.getElementById("server-settings-scope").value || "guild";
}

function currentSettingsPayload() {
  return currentSettingsScope() === "default"
    ? serverSettingsState.defaultSettings || {}
    : serverSettingsState.guildOverride || {};
}

function populateServerSettingsEditor() {
  const scope = currentSettingsScope();
  const settings = currentSettingsPayload();
  const roles = settings.roles || {};
  const onboarding = settings.onboarding || {};

  document.getElementById("server-settings-summary").innerHTML = `
    <strong>${serverSettingsState.guildName || "Server"}</strong>
    <div class="meta">Guild ID: ${serverSettingsState.guildId || "n/a"}</div>
    <div class="meta">Editing ${scope === "default" ? "global defaults" : "current server override"} in the dashboard.</div>
  `;

  document.getElementById("settings-server-name").value = settings.serverName || "";
  document.getElementById("settings-verified-role").value = roles.verified || "";
  document.getElementById("settings-unverified-role").value = roles.unverified || "";
  document.getElementById("settings-staff-roles").value = commaSeparated(roles.staff);
  document.getElementById("settings-review-roles").value = commaSeparated(roles.review);
  document.getElementById("settings-verify-roles").value = commaSeparated(roles.verify);
  document.getElementById("settings-role-manager-roles").value = commaSeparated(roles.roleManager);
  document.getElementById("settings-diagnostic-roles").value = commaSeparated(roles.diagnostics);
  document.getElementById("settings-required-channels").value = linesValue(settings.requiredChannels);
  document.getElementById("settings-welcome-message").value = linesValue(onboarding.welcomeMessage);
  document.getElementById("settings-application-targets").value = JSON.stringify(settings.applicationTargets || {}, null, 2);
  document.getElementById("settings-application-buttons").value = JSON.stringify(settings.applicationButtons || [], null, 2);
  document.getElementById("settings-roster-groups").value = JSON.stringify(settings.rosterGroups || {}, null, 2);
  document.getElementById("settings-dm-templates").value = JSON.stringify(
    {
      verifiedDm: onboarding.verifiedDm || "",
      unverifiedDm: onboarding.unverifiedDm || "",
      waitingDm: onboarding.waitingDm || "",
      approvedDm: onboarding.approvedDm || "",
      deniedDm: onboarding.deniedDm || "",
      disciplineDm: onboarding.disciplineDm || "",
    },
    null,
    2,
  );
}

function splitLines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function loadTicketDetail(channelId) {
  try {
    const detail = await fetchJson(`/api/tickets/${channelId}`);
    renderTicketDetail(detail);
  } catch (error) {
    showUiError(error);
  }
}

async function loadDashboard(query = currentCaseQuery) {
  currentCaseQuery = query;
  if (!guildOptions.length) {
    const guildPayload = await fetchJson("/api/guilds");
    guildOptions = guildPayload.guilds || [];
    if (!selectedGuildId) {
      selectedGuildId = window.localStorage.getItem(SELECTED_GUILD_STORAGE_KEY) || guildPayload.defaultGuildId || guildOptions[0]?.id || "";
    }
    if (!guildOptions.some((guild) => guild.id === selectedGuildId)) {
      selectedGuildId = guildPayload.defaultGuildId || guildOptions[0]?.id || "";
    }
    renderGuildSelector();
  }

  const [overview, health, rosters, businesses, cases, options, tickets, appForms, serverSettings] = await Promise.all([
    fetchJson("/api/overview"),
    fetchJson("/api/health"),
    fetchJson("/api/rosters"),
    fetchJson("/api/businesses"),
    fetchJson(`/api/cases${query ? `?q=${encodeURIComponent(query)}` : ""}`),
    fetchJson("/api/form-options"),
    fetchJson("/api/tickets"),
    fetchJson("/api/application-forms"),
    fetchJson("/api/server-settings"),
  ]);

  formOptions = options;
  applicationFormsConfig = appForms;
  serverSettingsState = serverSettings;
  populateFormOptions();
  populateApplicationFormEditor();
  populateServerSettingsEditor();
  renderOverview(overview);
  renderHealth(health);
  renderRosters(rosters);
  renderBusinesses(businesses);
  renderCases(cases);

  if (!tickets.some((ticket) => ticket.channelId === currentTicketId)) {
    currentTicketId = tickets[0]?.channelId || "";
  }
  renderTickets(tickets);
  if (currentTicketId) {
    await loadTicketDetail(currentTicketId);
  } else {
    document.getElementById("ticket-detail-header").textContent = "Select a ticket to view it here.";
    document.getElementById("ticket-messages").innerHTML = "";
  }
}

document.getElementById("refresh-button").addEventListener("click", () => loadDashboard(document.getElementById("case-search").value.trim()));
document.getElementById("case-search-button").addEventListener("click", () => loadDashboard(document.getElementById("case-search").value.trim()));
document.getElementById("case-search").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadDashboard(event.target.value.trim());
  }
});

document.getElementById("announcement-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = {
      channelId: document.getElementById("announcement-channel").value,
      type: document.getElementById("announcement-type").value,
      title: document.getElementById("announcement-title").value.trim(),
      body: document.getElementById("announcement-body").value.trim(),
      actor: document.getElementById("announcement-actor").value.trim() || "Dashboard",
    };
    await fetchJson("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    event.target.reset();
    populateFormOptions();
    await loadDashboard(currentCaseQuery);
  } catch (error) {
    showUiError(error);
  }
});

document.getElementById("business-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const ownerId = document.getElementById("business-owner").value;
    const owner = formOptions.members.find((member) => member.id === ownerId);
    if (!owner) {
      throw new Error("Choose a business owner.");
    }
    const payload = {
      name: document.getElementById("business-name").value.trim(),
      ownerId,
      licenseStatus: document.getElementById("business-license-status").value,
      actor: document.getElementById("business-actor").value.trim() || "Dashboard",
    };
    await fetchJson("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    event.target.reset();
    populateFormOptions();
    await loadDashboard(currentCaseQuery);
  } catch (error) {
    showUiError(error);
  }
});

document.getElementById("ticket-reply-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    if (!currentTicketId) {
      throw new Error("Select a ticket first.");
    }
    const body = document.getElementById("ticket-reply-body").value.trim();
    if (!body) {
      throw new Error("Reply body is required.");
    }
    await fetchJson(`/api/tickets/${currentTicketId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: document.getElementById("ticket-reply-actor").value.trim() || "Dashboard Staff",
        body,
      }),
    });
    document.getElementById("ticket-reply-body").value = "";
    await loadTicketDetail(currentTicketId);
  } catch (error) {
    showUiError(error);
  }
});

document.getElementById("ticket-close-button").addEventListener("click", async () => {
  try {
    if (!currentTicketId) {
      throw new Error("Select a ticket first.");
    }
    await fetchJson(`/api/tickets/${currentTicketId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: document.getElementById("ticket-reply-actor").value.trim() || "Dashboard Staff",
        reason: document.getElementById("ticket-close-reason").value.trim() || "Closed from dashboard.",
      }),
    });
    currentTicketId = "";
    document.getElementById("ticket-reply-body").value = "";
    document.getElementById("ticket-close-reason").value = "";
    await loadDashboard(currentCaseQuery);
  } catch (error) {
    showUiError(error);
  }
});

document.getElementById("application-form-role").addEventListener("change", () => {
  populateApplicationFormEditor();
});

document.getElementById("application-form-editor").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const roleKey = document.getElementById("application-form-role").value;
    const fields = JSON.parse(document.getElementById("application-form-fields").value);
    if (!Array.isArray(fields) || !fields.length) {
      throw new Error("Fields must be a non-empty JSON array.");
    }

    const nextConfig = structuredClone(applicationFormsConfig);
    if (roleKey === "default") {
      nextConfig.default = {
        titlePrefix: document.getElementById("application-form-title-prefix").value.trim() || "Apply:",
        title: document.getElementById("application-form-title").value.trim() || undefined,
        fields,
      };
    } else {
      nextConfig.roles[roleKey] = {
        title: document.getElementById("application-form-title").value.trim() || undefined,
        fields,
      };
    }

    await fetchJson("/api/application-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextConfig),
    });
    applicationFormsConfig = nextConfig;
    setStatus("Forms Saved", `Updated the ${roleKey} application form.`);
  } catch (error) {
    showUiError(error);
  }
});

document.getElementById("server-settings-scope").addEventListener("change", () => {
  populateServerSettingsEditor();
});

document.getElementById("server-settings-editor").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const settings = {
      serverName: document.getElementById("settings-server-name").value.trim(),
      roles: {
        verified: document.getElementById("settings-verified-role").value.trim(),
        unverified: document.getElementById("settings-unverified-role").value.trim(),
        staff: splitLines(document.getElementById("settings-staff-roles").value.replace(/,\s*/g, "\n")),
        review: splitLines(document.getElementById("settings-review-roles").value.replace(/,\s*/g, "\n")),
        verify: splitLines(document.getElementById("settings-verify-roles").value.replace(/,\s*/g, "\n")),
        roleManager: splitLines(document.getElementById("settings-role-manager-roles").value.replace(/,\s*/g, "\n")),
        diagnostics: splitLines(document.getElementById("settings-diagnostic-roles").value.replace(/,\s*/g, "\n")),
      },
      requiredChannels: splitLines(document.getElementById("settings-required-channels").value),
      applicationTargets: JSON.parse(document.getElementById("settings-application-targets").value || "{}"),
      applicationButtons: JSON.parse(document.getElementById("settings-application-buttons").value || "[]"),
      rosterGroups: JSON.parse(document.getElementById("settings-roster-groups").value || "{}"),
      onboarding: {
        welcomeMessage: splitLines(document.getElementById("settings-welcome-message").value),
        ...JSON.parse(document.getElementById("settings-dm-templates").value || "{}"),
      },
    };

    const scope = currentSettingsScope();
    const result = await fetchJson("/api/server-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, settings }),
    });

    serverSettingsState = {
      ...serverSettingsState,
      defaultSettings: result.defaultSettings,
      guildOverride: result.guildOverride,
      mergedSettings: result.mergedSettings,
    };
    populateServerSettingsEditor();
    setStatus("Settings Saved", `${scope === "default" ? "Default" : "Server"} settings updated.`);
  } catch (error) {
    showUiError(error);
  }
});

document.getElementById("guild-selector").addEventListener("change", async (event) => {
  selectedGuildId = event.target.value;
  window.localStorage.setItem(SELECTED_GUILD_STORAGE_KEY, selectedGuildId);
  currentTicketId = "";
  await loadDashboard(currentCaseQuery);
});

document.getElementById("provision-server-button").addEventListener("click", async () => {
  try {
    setProvisionResult("Provisioning server...");
    await runServerAction("provision", (result) => {
      const provisioned = result.provisioned || result.result || {};
      return [
        `Roles created: ${(provisioned.roles || []).length}`,
        `Categories created: ${(provisioned.categories || []).length}`,
        `Channels created: ${(provisioned.channels || []).length}`,
      ].join(" | ");
    });
  } catch (error) {
    showUiError(error);
    setProvisionResult(error.message || "Provisioning failed.");
  }
});

document.getElementById("post-panels-button").addEventListener("click", async () => {
  try {
    setProvisionResult("Posting support and application panels...");
    await runServerAction("post-panels", (result) => {
      const posted = result.postedPanels || {};
      return `Support panel: ${posted.supportPanel ? "ready" : "missing channel"} | Application panel: ${posted.applicationPanel ? "ready" : "missing channel"}`;
    });
  } catch (error) {
    showUiError(error);
    setProvisionResult(error.message || "Posting panels failed.");
  }
});

document.getElementById("seed-content-button").addEventListener("click", async () => {
  try {
    setProvisionResult("Seeding onboarding content...");
    await runServerAction("seed-content", (result) => {
      const seeded = result.seededChannels || [];
      return seeded.length ? `Seeded channels: ${seeded.join(", ")}` : "No matching channels found to seed.";
    });
  } catch (error) {
    showUiError(error);
    setProvisionResult(error.message || "Seeding content failed.");
  }
});

loadDashboard().catch((error) => {
  showUiError(error);
});
