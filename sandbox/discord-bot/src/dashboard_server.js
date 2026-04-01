require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const { ChannelType, Client, GatewayIntentBits, PermissionFlagsBits } = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const defaultGuildId = process.env.GUILD_ID;
const port = Number(process.env.DASHBOARD_PORT || 3210);

if (!token) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

const BASE_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(BASE_DIR, "data");
const CONFIG_DIR = path.join(BASE_DIR, "config");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const TRANSCRIPTS_DIR = path.join(DATA_DIR, "transcripts");
const PUBLIC_DIR = path.join(BASE_DIR, "public");
const APPLICATION_FORMS_PATH = path.join(CONFIG_DIR, "application_forms.json");
const SERVER_SETTINGS_PATH = path.join(CONFIG_DIR, "server_settings.json");
const DEFAULT_APPLICATION_FORM_CONFIG = {
  default: {
    titlePrefix: "Apply:",
    fields: [
      { key: "character_name", label: "Character Name", style: "short", required: true, maxLength: 60 },
      { key: "character_age", label: "Character Age", style: "short", required: true, maxLength: 10 },
      { key: "background", label: "Short Background", style: "paragraph", required: true, maxLength: 600 },
      { key: "rp_goals", label: "What RP do you want to create?", style: "paragraph", required: true, maxLength: 600 },
    ],
  },
  roles: {},
};

const DEFAULT_SERVER_SETTINGS = {
  default: {
    serverName: "Whispering Pines",
    roles: {
      staff: ["Founder", "Admin", "Senior Staff", "Moderator", "Developer"],
      verified: "Verified",
      unverified: "Unverified",
      review: ["Founder", "Admin", "Senior Staff", "Developer"],
      verify: ["Founder", "Admin", "Senior Staff"],
      roleManager: ["Founder", "Admin", "Senior Staff"],
      diagnostics: ["Founder", "Admin", "Senior Staff", "Developer"],
    },
    requiredChannels: [
      "welcome",
      "rules-and-guidelines",
      "verify-and-roles",
      "support-desk",
      "server-lore",
      "rp-guides",
      "bot-logs",
      "bot-changelog",
    ],
    applicationTargets: {
      citizen: "Citizen",
      business: "Business Owner",
      "business-owner": "Business Owner",
      lspd: "Sheriff's Office",
      "sheriffs-office": "Sheriff's Office",
      sheriffs: "Sheriff's Office",
      bcso: "BCSO",
      ems: "Medical",
      medical: "Medical",
      "safr/ems": "Medical",
      safr: "Medical",
      fire: "Fire Department",
      "fire-department": "Fire Department",
      "fire-depo": "Fire Department",
      doj: "DOJ",
      media: "Media",
      "events-team": "Events Team",
      events: "Events Team",
      "real-estate": "Real Estate",
      management: "Management",
      verified: "Verified",
    },
    applicationButtons: [
      [
        { key: "citizen", label: "Citizen", style: "Secondary" },
        { key: "business-owner", label: "Business Owner", style: "Secondary" },
        { key: "sheriffs-office", label: "Sheriff's Office", style: "Primary" },
        { key: "bcso", label: "BCSO", style: "Primary" },
        { key: "medical", label: "Medical", style: "Success" },
      ],
      [
        { key: "fire-department", label: "Fire Depo", style: "Danger" },
        { key: "doj", label: "DOJ", style: "Secondary" },
        { key: "media", label: "Media", style: "Secondary" },
        { key: "events-team", label: "Events Team", style: "Secondary" },
        { key: "real-estate", label: "Real Estate", style: "Secondary" },
      ],
      [
        { key: "management", label: "Management", style: "Secondary" },
        { key: "business", label: "Business Access", style: "Secondary" },
      ],
    ],
    rosterGroups: {
      staff: ["Founder", "Admin", "Senior Staff", "Moderator", "Developer"],
      lspd: ["Sheriff's Office"],
      "sheriffs-office": ["Sheriff's Office"],
      bcso: ["BCSO"],
      ems: ["Medical"],
      medical: ["Medical"],
      fire: ["Fire Department"],
      "fire-department": ["Fire Department"],
      doj: ["DOJ"],
      media: ["Media"],
      "events-team": ["Events Team"],
      "real-estate": ["Real Estate"],
      management: ["Management"],
      business: ["Business Owner"],
    },
    onboarding: {
      welcomeMessage: [
        "Welcome to Whispering Pines.",
        "",
        "To get access to the full server:",
        "1. Read the rules and lore channels",
        "2. Go to #verify-and-roles",
        "3. Request verification or use the application panel if you need a faction/business path",
        "",
        "If you get stuck, use #support-desk.",
      ],
      verifiedDm: "You have been verified in Whispering Pines. You should now have access to the main server.",
      unverifiedDm: "Your Verified status in Whispering Pines has been removed. Contact staff if you believe this was a mistake.",
      waitingDm: "Your **{role}** application in Whispering Pines needs more information. Staff note: {note}",
      approvedDm: "Your **{role}** application in Whispering Pines was approved.",
      deniedDm: "Your **{role}** application in Whispering Pines was denied. Reason: {reason}",
      disciplineDm: "A staff action was recorded for you in Whispering Pines. Action: {action}. Reason: {reason}",
    },
  },
  guilds: {},
};

const app = express();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});
const CACHE_TTL_MS = 2 * 60 * 1000;
const guildSnapshotCache = new Map();
const guildSnapshotFetchedAt = new Map();
const guildSnapshotPromise = new Map();
let storeWriteQueue = Promise.resolve();

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(
      STORE_PATH,
      JSON.stringify(
        {
          meta: { nextCaseNumber: 1 },
          warnings: [],
          notes: [],
          tickets: [],
          applications: [],
          verifications: [],
          roleActions: [],
          discipline: [],
          businesses: [],
          announcements: [],
        },
        null,
        2,
      ),
      "utf8",
    );
  }
}

function ensureApplicationFormsConfig() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(APPLICATION_FORMS_PATH)) {
    fs.writeFileSync(APPLICATION_FORMS_PATH, JSON.stringify(DEFAULT_APPLICATION_FORM_CONFIG, null, 2), "utf8");
  }
}

function ensureServerSettingsConfig() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(SERVER_SETTINGS_PATH)) {
    fs.writeFileSync(SERVER_SETTINGS_PATH, JSON.stringify(DEFAULT_SERVER_SETTINGS, null, 2), "utf8");
  }
}

function loadServerSettingsStore() {
  ensureServerSettingsConfig();
  try {
    const parsed = JSON.parse(fs.readFileSync(SERVER_SETTINGS_PATH, "utf8"));
    return {
      default: { ...(DEFAULT_SERVER_SETTINGS.default || {}), ...(parsed.default || {}) },
      guilds: parsed.guilds || {},
    };
  } catch {
    return DEFAULT_SERVER_SETTINGS;
  }
}

function saveServerSettingsStore(store) {
  ensureServerSettingsConfig();
  fs.writeFileSync(SERVER_SETTINGS_PATH, JSON.stringify(store, null, 2), "utf8");
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function getMergedServerSettings(store, targetGuildId = defaultGuildId) {
  const defaults = cloneValue((store || loadServerSettingsStore()).default || DEFAULT_SERVER_SETTINGS.default);
  const override = cloneValue(((store || loadServerSettingsStore()).guilds || {})[targetGuildId] || {});
  return {
    ...defaults,
    ...override,
    roles: { ...(defaults.roles || {}), ...(override.roles || {}) },
    onboarding: { ...(defaults.onboarding || {}), ...(override.onboarding || {}) },
    applicationTargets: { ...(defaults.applicationTargets || {}), ...(override.applicationTargets || {}) },
    rosterGroups: { ...(defaults.rosterGroups || {}), ...(override.rosterGroups || {}) },
    requiredChannels: Array.isArray(override.requiredChannels) ? override.requiredChannels : defaults.requiredChannels,
    applicationButtons: Array.isArray(override.applicationButtons) ? override.applicationButtons : defaults.applicationButtons,
  };
}

function getSelectedGuildId(req) {
  const requested = typeof req?.query?.guildId === "string" ? req.query.guildId.trim() : "";
  return requested || defaultGuildId || null;
}

async function listAvailableGuilds() {
  await client.guilds.fetch();
  return [...client.guilds.cache.values()]
    .map((guild) => ({ id: guild.id, name: guild.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function filterStoreByGuild(store, targetGuildId) {
  const filterRecords = (records) => (records || []).filter((entry) => !entry.guildId || entry.guildId === targetGuildId);
  return {
    ...store,
    warnings: filterRecords(store.warnings),
    notes: filterRecords(store.notes),
    tickets: filterRecords(store.tickets),
    applications: filterRecords(store.applications),
    verifications: filterRecords(store.verifications),
    roleActions: filterRecords(store.roleActions),
    discipline: filterRecords(store.discipline),
    businesses: filterRecords(store.businesses),
    announcements: filterRecords(store.announcements),
  };
}

function loadApplicationFormsConfig() {
  ensureApplicationFormsConfig();
  try {
    const parsed = JSON.parse(fs.readFileSync(APPLICATION_FORMS_PATH, "utf8"));
    return {
      default: parsed.default || DEFAULT_APPLICATION_FORM_CONFIG.default,
      roles: parsed.roles || {},
    };
  } catch {
    return DEFAULT_APPLICATION_FORM_CONFIG;
  }
}

function saveApplicationFormsConfig(config) {
  ensureApplicationFormsConfig();
  fs.writeFileSync(APPLICATION_FORMS_PATH, JSON.stringify(config, null, 2), "utf8");
}

function loadStore() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    return {
      meta: { nextCaseNumber: 1, ...(parsed.meta || {}) },
      warnings: parsed.warnings || [],
      notes: parsed.notes || [],
      tickets: parsed.tickets || [],
      applications: parsed.applications || [],
      verifications: parsed.verifications || [],
      roleActions: parsed.roleActions || [],
      discipline: parsed.discipline || [],
      businesses: parsed.businesses || [],
      announcements: parsed.announcements || [],
    };
  } catch {
    return {
      meta: { nextCaseNumber: 1 },
      warnings: [],
      notes: [],
      tickets: [],
      applications: [],
      verifications: [],
      roleActions: [],
      discipline: [],
      businesses: [],
      announcements: [],
    };
  }
}

function saveStore(store) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function nextCaseId(store) {
  const caseId = `WP-${String(store.meta.nextCaseNumber || 1).padStart(4, "0")}`;
  store.meta.nextCaseNumber = (store.meta.nextCaseNumber || 1) + 1;
  return caseId;
}

async function mutateStore(mutator) {
  let result;
  storeWriteQueue = storeWriteQueue.then(async () => {
    const store = loadStore();
    result = await mutator(store);
    saveStore(store);
  });
  await storeWriteQueue;
  return result;
}

function getTranscriptCount() {
  ensureStore();
  return fs.readdirSync(TRANSCRIPTS_DIR, { withFileTypes: true }).filter((entry) => entry.isFile()).length;
}

function parseTopic(topic) {
  const values = {};
  for (const part of (topic || "").split("|")) {
    const [key, ...rest] = part.split(":");
    if (!key || rest.length === 0) {
      continue;
    }
    values[key] = rest.join(":");
  }
  return values;
}

function writeTranscriptFile(channelName, lines) {
  ensureStore();
  const fileName = `${new Date().toISOString().replace(/[:.]/g, "-")}_${channelName}.txt`;
  const filePath = path.join(TRANSCRIPTS_DIR, fileName);
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return filePath;
}

function buildRecentActivity(store) {
  return [
    ...store.warnings.map((entry) => ({
      bucket: "warning",
      caseId: entry.caseId,
      createdAt: entry.createdAt,
      title: entry.memberTag || "Member",
      detail: entry.reason,
    })),
    ...store.notes.map((entry) => ({
      bucket: "note",
      caseId: entry.caseId,
      createdAt: entry.createdAt,
      title: entry.memberTag || "Member",
      detail: entry.reason,
    })),
    ...store.applications.map((entry) => ({
      bucket: "application",
      caseId: entry.caseId,
      createdAt: entry.createdAt,
      title: entry.applicantTag || "Applicant",
      detail: `${entry.role} - ${entry.status}`,
    })),
    ...store.discipline.map((entry) => ({
      bucket: "discipline",
      caseId: entry.caseId,
      createdAt: entry.createdAt,
      title: entry.memberTag || "Member",
      detail: `${entry.action} - ${entry.reason}`,
    })),
    ...store.businesses.map((entry) => ({
      bucket: "business",
      caseId: entry.caseId,
      createdAt: entry.createdAt,
      title: entry.name,
      detail: `${entry.ownerTag} - ${entry.licenseStatus}`,
    })),
    ...store.announcements.map((entry) => ({
      bucket: "announcement",
      caseId: entry.caseId,
      createdAt: entry.createdAt,
      title: entry.title,
      detail: `${entry.type} in #${entry.channelName}`,
    })),
  ]
    .filter((entry) => entry.createdAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 40);
}

function buildCases(store, query) {
  const normalized = (query || "").trim().toLowerCase();
  const buckets = ["warnings", "notes", "tickets", "applications", "verifications", "roleActions", "discipline", "businesses", "announcements"];
  const cases = [];

  for (const bucket of buckets) {
    for (const entry of store[bucket] || []) {
      const haystack = JSON.stringify(entry).toLowerCase();
      if (!normalized || haystack.includes(normalized)) {
        cases.push({
          bucket,
          caseId: entry.caseId || "n/a",
          createdAt: entry.createdAt || null,
          summary: entry.reason || entry.title || entry.type || entry.role || entry.action || entry.name || entry.status || "n/a",
          actor: entry.by || entry.createdBy || entry.reviewedBy || "n/a",
          subject: entry.memberTag || entry.ownerTag || entry.applicantTag || entry.channelName || "n/a",
          status: entry.status || entry.licenseStatus || entry.action || "n/a",
        });
      }
    }
  }

  return cases.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 200);
}

async function getTextChannelById(targetGuildId, channelId) {
  const { channels } = await getGuildSnapshot(targetGuildId);
  return channels.find((channel) => channel && channel.id === channelId && channel.isTextBased && channel.isTextBased());
}

async function getTicketChannelOrThrow(targetGuildId, channelId) {
  const channel = await getTextChannelById(targetGuildId, channelId);
  if (!channel) {
    throw new Error("Ticket channel not found.");
  }
  const parentName = channel.parent ? channel.parent.name : "";
  if (parentName !== "TICKETS") {
    throw new Error("This channel is not a support ticket.");
  }
  return channel;
}

async function buildOpenTickets(targetGuildId) {
  const store = filterStoreByGuild(loadStore(), targetGuildId);
  const { channels } = await getGuildSnapshot(targetGuildId);
  const openTickets = (store.tickets || []).filter((entry) => entry.status === "open");

  return openTickets
    .map((entry) => {
      const channel = channels.find((item) => item.id === entry.channelId);
      if (!channel) {
        return null;
      }
      const details = parseTopic(channel.topic || "");
      return {
        caseId: entry.caseId,
        channelId: channel.id,
        channelName: channel.name,
        ownerId: entry.ownerId,
        ownerTag: entry.ownerTag,
        type: entry.type,
        openedAt: entry.createdAt,
        topic: details,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime());
}

async function getTicketDetail(targetGuildId, channelId) {
  const channel = await getTicketChannelOrThrow(targetGuildId, channelId);
  const messages = await channel.messages.fetch({ limit: 50 });
  const ordered = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  return {
    channelId: channel.id,
    channelName: channel.name,
    topic: parseTopic(channel.topic || ""),
    messages: ordered.map((message) => ({
      id: message.id,
      authorTag: message.author.tag,
      content: message.content || "[no text]",
      createdAt: new Date(message.createdTimestamp).toISOString(),
    })),
  };
}

async function buildFormOptions(targetGuildId) {
  const { channels, members } = await getGuildSnapshot(targetGuildId);
  return {
    channels: channels
      .filter((channel) => channel && channel.isTextBased && channel.isTextBased() && channel.name)
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    members: members
      .map((member) => ({
        id: member.id,
        tag: member.user.tag,
        displayName: member.displayName,
      }))
      .sort((a, b) => a.tag.localeCompare(b.tag)),
  };
}

async function createAnnouncement(targetGuildId, { channelId, type, title, body, actor }) {
  const channel = await getTextChannelById(targetGuildId, channelId);
  if (!channel) {
    throw new Error("Announcement channel not found.");
  }

  const announcementType = (type || "update").toLowerCase();
  const entry = await mutateStore(async (store) => {
    const caseId = nextCaseId(store);
    const record = {
      id: `announcements-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      caseId,
      createdAt: new Date().toISOString(),
      guildId: targetGuildId,
      channelId: channel.id,
      channelName: channel.name,
      type: announcementType,
      title,
      body,
      by: actor || "Dashboard",
    };
    store.announcements.push(record);
    return record;
  });

  await channel.send([
    `# ${announcementType.toUpperCase()}: ${title}`,
    "",
    body,
    "",
    `Posted by ${entry.by}`,
  ].join("\n"));
  return entry;
}

async function upsertBusiness(targetGuildId, { name, ownerId, ownerTag, licenseStatus, actor }) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Business name is required.");
  }

  return mutateStore(async (store) => {
    let record = store.businesses.find((entry) => entry.guildId === targetGuildId && entry.name.trim().toLowerCase() === normalized && entry.status !== "closed");
    if (record) {
      record.ownerId = ownerId;
      record.ownerTag = ownerTag;
      record.licenseStatus = licenseStatus;
      record.updatedAt = new Date().toISOString();
      record.updatedBy = actor || "Dashboard";
    } else {
      record = {
        id: `business-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        caseId: nextCaseId(store),
        createdAt: new Date().toISOString(),
        guildId: targetGuildId,
        name: name.trim(),
        ownerId,
        ownerTag,
        licenseStatus: licenseStatus || "licensed",
        status: "active",
        createdBy: actor || "Dashboard",
      };
      store.businesses.push(record);
    }
    return record;
  });
}

async function closeBusiness(targetGuildId, caseId, actor, reason) {
  return mutateStore(async (store) => {
    const record = store.businesses.find((entry) => entry.guildId === targetGuildId && entry.caseId === caseId && entry.status !== "closed");
    if (!record) {
      throw new Error("Business case not found.");
    }
    record.status = "closed";
    record.closedAt = new Date().toISOString();
    record.closedBy = actor || "Dashboard";
    record.closeReason = reason || "Closed from dashboard.";
    return record;
  });
}

async function replyToTicket(targetGuildId, channelId, actor, body) {
  const channel = await getTicketChannelOrThrow(targetGuildId, channelId);
  const name = (actor || "Dashboard Staff").trim() || "Dashboard Staff";
  await channel.send(`**${name}:** ${body}`);
  return { ok: true };
}

async function closeTicketFromDashboard(targetGuildId, channelId, actor, reason) {
  const channel = await getTicketChannelOrThrow(targetGuildId, channelId);
  const messages = await channel.messages.fetch({ limit: 100 });
  const ordered = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const transcript = ordered.map((message) => {
    const stamp = new Date(message.createdTimestamp).toISOString();
    const content = message.content || "[no text]";
    return `[${stamp}] ${message.author.tag}: ${content}`;
  });
  const transcriptPath = writeTranscriptFile(channel.name, transcript.length ? transcript : ["[No messages captured]"]);
  const details = parseTopic(channel.topic || "");
  const closedBy = (actor || "Dashboard Staff").trim() || "Dashboard Staff";
  const closeReason = reason || "Closed from dashboard.";

  await channel.send(`This ticket is being closed by **${closedBy}**. Reason: ${closeReason}`);

  await mutateStore(async (store) => {
    for (const item of store.tickets || []) {
      if (item.channelId === channel.id && item.status === "open") {
        item.status = "closed";
        item.closedAt = new Date().toISOString();
        item.closedBy = closedBy;
        item.closeReason = closeReason;
        item.transcriptPath = transcriptPath;
      }
    }
  });

  if (details["ticket-owner"]) {
    try {
      const owner = await channel.guild.members.fetch(details["ticket-owner"]);
      await owner.send(`Your ticket **${channel.name}** was closed. Reason: ${closeReason}`);
    } catch {}
  }

  const response = {
    ok: true,
    channelId: channel.id,
    channelName: channel.name,
    transcriptPath,
  };

  await channel.delete(closeReason);
  guildSnapshotCache.delete(targetGuildId);
  guildSnapshotFetchedAt.delete(targetGuildId);
  return response;
}

async function getGuild(targetGuildId) {
  if (!targetGuildId) {
    throw new Error("No dashboard guild selected. Set GUILD_ID or pick a server.");
  }
  return client.guilds.fetch(targetGuildId);
}

async function getGuildSnapshot(targetGuildId, force = false) {
  const now = Date.now();
  if (!force && guildSnapshotCache.has(targetGuildId) && now - (guildSnapshotFetchedAt.get(targetGuildId) || 0) < CACHE_TTL_MS) {
    return guildSnapshotCache.get(targetGuildId);
  }
  if (guildSnapshotPromise.has(targetGuildId)) {
    return guildSnapshotPromise.get(targetGuildId);
  }

  const snapshotPromise = (async () => {
    const guild = await getGuild(targetGuildId);
    await guild.members.fetch();
    await guild.channels.fetch();
    await guild.roles.fetch();
    const snapshot = {
      guild,
      members: [...guild.members.cache.values()],
      channels: [...guild.channels.cache.values()],
      roles: [...guild.roles.cache.values()],
    };
    guildSnapshotCache.set(targetGuildId, snapshot);
    guildSnapshotFetchedAt.set(targetGuildId, Date.now());
    guildSnapshotPromise.delete(targetGuildId);
    return snapshot;
  })().catch((error) => {
    guildSnapshotPromise.delete(targetGuildId);
    if (guildSnapshotCache.has(targetGuildId)) {
      console.warn(`Dashboard snapshot refresh failed, serving stale data: ${error.message}`);
      return guildSnapshotCache.get(targetGuildId);
    }
    throw error;
  });

  guildSnapshotPromise.set(targetGuildId, snapshotPromise);
  return snapshotPromise;
}

async function buildRosters(targetGuildId) {
  const { members } = await getGuildSnapshot(targetGuildId);
  const rosterGroups = getMergedServerSettings(loadServerSettingsStore(), targetGuildId).rosterGroups || {};

  const rosters = {};
  for (const [key, roleNames] of Object.entries(rosterGroups)) {
    const rosterMembers = members
      .filter((member) => roleNames.some((roleName) => member.roles.cache.some((role) => role.name === roleName)))
      .map((member) => ({
        id: member.id,
        tag: member.user.tag,
        displayName: member.displayName,
        roles: member.roles.cache
          .filter((role) => role.name !== "@everyone")
          .map((role) => role.name)
          .sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
    rosters[key] = rosterMembers;
  }

  return rosters;
}

async function buildOverview(targetGuildId) {
  const store = filterStoreByGuild(loadStore(), targetGuildId);
  const { guild, channels, roles } = await getGuildSnapshot(targetGuildId);

  return {
    guild: {
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      channelCount: channels.length,
      roleCount: roles.length,
    },
    metrics: {
      openTickets: store.tickets.filter((entry) => entry.status === "open").length,
      openApplications: store.applications.filter((entry) => entry.status === "open").length,
      waitingApplications: store.applications.filter((entry) => entry.status === "waiting").length,
      warnings: store.warnings.length,
      discipline: store.discipline.length,
      businesses: store.businesses.filter((entry) => entry.status !== "closed").length,
      announcements: store.announcements.length,
      transcripts: getTranscriptCount(),
      nextCaseNumber: store.meta.nextCaseNumber || 1,
    },
    recentActivity: buildRecentActivity(store),
    announcements: store.announcements.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10),
  };
}

async function ensureRole(guild, roleName) {
  if (!roleName) {
    return null;
  }
  const existing = guild.roles.cache.find((role) => role.name === roleName);
  if (existing) {
    return { role: existing, created: false };
  }
  const role = await guild.roles.create({ name: roleName, reason: "Dashboard provisioning" });
  return { role, created: true };
}

async function ensureCategory(guild, name, permissionOverwrites = null) {
  const existing = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === name);
  if (existing) {
    return { channel: existing, created: false };
  }
  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    ...(permissionOverwrites ? { permissionOverwrites } : {}),
    reason: "Dashboard provisioning",
  });
  return { channel, created: true };
}

async function ensureTextChannel(guild, name, parentId = null, permissionOverwrites = null) {
  const existing = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildText && channel.name === name && (parentId ? channel.parentId === parentId : true),
  );
  if (existing) {
    return { channel: existing, created: false };
  }
  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    ...(parentId ? { parent: parentId } : {}),
    ...(permissionOverwrites ? { permissionOverwrites } : {}),
    reason: "Dashboard provisioning",
  });
  return { channel, created: true };
}

async function provisionServer(targetGuildId) {
  const { guild } = await getGuildSnapshot(targetGuildId, true);
  const settings = getMergedServerSettings(loadServerSettingsStore(), targetGuildId);
  const created = { roles: [], categories: [], channels: [] };

  const roleNames = new Set([
    ...(settings.roles?.staff || []),
    ...(settings.roles?.review || []),
    ...(settings.roles?.verify || []),
    ...(settings.roles?.roleManager || []),
    ...(settings.roles?.diagnostics || []),
    settings.roles?.verified,
    settings.roles?.unverified,
    ...Object.values(settings.applicationTargets || {}),
  ].filter(Boolean));

  for (const roleName of roleNames) {
    const result = await ensureRole(guild, roleName);
    if (result.created) {
      created.roles.push(roleName);
    }
  }

  await guild.channels.fetch();
  await guild.roles.fetch();

  const staffRoleNames = settings.roles?.staff || [];
  const staffRoles = staffRoleNames
    .map((name) => guild.roles.cache.find((role) => role.name === name))
    .filter(Boolean);

  const privateOverwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    ...staffRoles.map((role) => ({
      id: role.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    })),
  ];

  const staffCategory = await ensureCategory(guild, "STAFF");
  if (staffCategory.created) {
    created.categories.push("STAFF");
  }

  const ticketsCategory = await ensureCategory(guild, "TICKETS", privateOverwrites);
  if (ticketsCategory.created) {
    created.categories.push("TICKETS");
  }

  const appReviewCategory = await ensureCategory(guild, "APPLICATION REVIEW", privateOverwrites);
  if (appReviewCategory.created) {
    created.categories.push("APPLICATION REVIEW");
  }

  const botLogs = await ensureTextChannel(guild, "bot-logs", staffCategory.channel.id, privateOverwrites);
  if (botLogs.created) {
    created.channels.push("bot-logs");
  }

  for (const channelName of settings.requiredChannels || []) {
    if (channelName === "bot-logs") {
      continue;
    }
    const result = await ensureTextChannel(guild, channelName);
    if (result.created) {
      created.channels.push(channelName);
    }
  }

  guildSnapshotCache.delete(targetGuildId);
  guildSnapshotFetchedAt.delete(targetGuildId);

  return created;
}

function buildMemberButtons() {
  return [
    {
      type: 1,
      components: [
        { type: 2, custom_id: "ticket_support", label: "Open Support Ticket", style: 1 },
        { type: 2, custom_id: "ticket_report", label: "Open Report Ticket", style: 4 },
        { type: 2, custom_id: "ticket_appeal", label: "Open Appeal Ticket", style: 2 },
      ],
    },
  ];
}

function buttonStyleNumber(style) {
  return { Primary: 1, Secondary: 2, Success: 3, Danger: 4 }[style] || 2;
}

function buildApplicationButtonsPayload(settings) {
  return (settings.applicationButtons || []).map((row) => ({
    type: 1,
    components: row.map((button) => ({
      type: 2,
      custom_id: `apply_${button.key}`,
      label: button.label,
      style: buttonStyleNumber(button.style),
    })),
  }));
}

async function upsertBotMessage(channel, marker, body) {
  const messages = await channel.messages.fetch({ limit: 20 });
  const existing = [...messages.values()].find(
    (message) => message.author?.id === client.user.id && typeof message.content === "string" && message.content.startsWith(marker),
  );
  if (existing) {
    await existing.edit(body);
    return { updated: true, created: false };
  }
  await channel.send(body);
  return { updated: false, created: true };
}

async function postInteractivePanels(targetGuildId) {
  const { channels } = await getGuildSnapshot(targetGuildId, true);
  const settings = getMergedServerSettings(loadServerSettingsStore(), targetGuildId);
  const supportDesk = channels.find((channel) => channel?.name === "support-desk" && channel.isTextBased?.());
  const verifyChannel = channels.find((channel) => channel?.name === "verify-and-roles" && channel.isTextBased?.());
  const result = { supportPanel: false, applicationPanel: false };

  if (supportDesk) {
    await upsertBotMessage(supportDesk, "# Support Panel", {
      content: [
        "# Support Panel",
        "",
        "Use the buttons below to open the kind of private ticket you need.",
        "",
        "- Support: help, questions, setup issues",
        "- Report: behavior issues or incidents that need staff review",
        "- Appeal: punishment or decision review requests",
      ].join("\n"),
      components: buildMemberButtons(),
    });
    result.supportPanel = true;
  }

  if (verifyChannel) {
    await upsertBotMessage(verifyChannel, "# Application Panel", {
      content: [
        "# Application Panel",
        "",
        "Use the buttons below to open a private application channel for the role or path you need.",
        "",
        "Staff will review your application in a private thread with you.",
      ].join("\n"),
      components: buildApplicationButtonsPayload(settings),
    });
    result.applicationPanel = true;
  }

  return result;
}

async function seedServerContent(targetGuildId) {
  const { channels } = await getGuildSnapshot(targetGuildId, true);
  const settings = getMergedServerSettings(loadServerSettingsStore(), targetGuildId);
  const serverName = settings.serverName || "the server";
  const seeds = [
    {
      channel: "welcome",
      marker: "# Welcome",
      messages: [[
        `# Welcome to ${serverName}`,
        "",
        `${serverName} is a story-driven RP community built around long-form character development, town pressure, and layered scenes.`,
        "",
        "If you are new here, your path is simple:",
        "- Read `#rules-and-guidelines`",
        "- Read `#server-lore`",
        "- Go to `#verify-and-roles` to request access",
        "- Use `#support-desk` if you need help",
        "",
        "Once you are verified, the rest of the server will open up to you.",
      ].join("\n")],
    },
    {
      channel: "announcements",
      marker: "# Announcements",
      messages: [[
        "# Announcements",
        "",
        `This channel is for official ${serverName} updates.`,
        "",
        "Expect posts here for:",
        "- server openings and major updates",
        "- event announcements",
        "- rules or policy changes",
        "- faction openings",
        "- economy or system changes",
      ].join("\n")],
    },
    {
      channel: "server-lore",
      marker: "# Server Lore",
      messages: [[
        "# Server Lore",
        "",
        `${serverName} should feel like a living place where decisions carry forward, reputation matters, and institutions remember what happened.`,
        "",
        "Use this channel to establish the tone, pressure points, and social structure players should expect when they enter the world.",
      ].join("\n")],
    },
    {
      channel: "rp-guides",
      marker: "# Roleplay Starter Guide",
      messages: [[
        "# Roleplay Starter Guide",
        "",
        "Build characters with believable motives, visible flaws, and room to grow.",
        "",
        "Good starting habits:",
        "- build scenes instead of rushing outcomes",
        "- give other players room to respond",
        "- let consequences carry forward",
        "- treat money, law, reputation, and relationships as story pressure",
      ].join("\n")],
    },
  ];

  const seeded = [];
  for (const seed of seeds) {
    const channel = channels.find((entry) => entry?.name === seed.channel && entry.isTextBased?.());
    if (!channel) {
      continue;
    }
    for (const content of seed.messages) {
      await upsertBotMessage(channel, seed.marker, { content });
    }
    seeded.push(seed.channel);
  }
  return seeded;
}

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.get("/api/guilds", async (_req, res) => {
  try {
    res.json({
      defaultGuildId,
      guilds: await listAvailableGuilds(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load guild list." });
  }
});

app.get("/api/overview", async (req, res) => {
  try {
    res.json(await buildOverview(getSelectedGuildId(req)));
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to build overview." });
  }
});

app.get("/api/rosters", async (req, res) => {
  try {
    res.json(await buildRosters(getSelectedGuildId(req)));
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to build rosters." });
  }
});

app.get("/api/businesses", (req, res) => {
  const store = filterStoreByGuild(loadStore(), getSelectedGuildId(req));
  res.json(store.businesses.slice().sort((a, b) => a.name.localeCompare(b.name)));
});

app.get("/api/tickets", async (req, res) => {
  try {
    res.json(await buildOpenTickets(getSelectedGuildId(req)));
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load tickets." });
  }
});

app.get("/api/tickets/:channelId", async (req, res) => {
  try {
    res.json(await getTicketDetail(getSelectedGuildId(req), req.params.channelId));
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load ticket detail." });
  }
});

app.post("/api/tickets/:channelId/reply", async (req, res) => {
  try {
    const { actor, body } = req.body || {};
    if (!body || !String(body).trim()) {
      res.status(400).json({ error: "Reply body is required." });
      return;
    }
    await replyToTicket(getSelectedGuildId(req), req.params.channelId, actor, String(body).trim());
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to send ticket reply." });
  }
});

app.post("/api/tickets/:channelId/close", async (req, res) => {
  try {
    const { actor, reason } = req.body || {};
    res.json(await closeTicketFromDashboard(getSelectedGuildId(req), req.params.channelId, actor, reason));
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to close ticket." });
  }
});

app.get("/api/cases", (req, res) => {
  const store = filterStoreByGuild(loadStore(), getSelectedGuildId(req));
  res.json(buildCases(store, req.query.q || ""));
});

app.get("/api/health", async (req, res) => {
  try {
    const targetGuildId = getSelectedGuildId(req);
    const { guild } = await getGuildSnapshot(targetGuildId);
    const store = filterStoreByGuild(loadStore(), targetGuildId);
    res.json({
      botReady: client.isReady(),
      guildName: guild.name,
      storePath: STORE_PATH,
      transcriptFolder: TRANSCRIPTS_DIR,
      datasetCounts: {
        warnings: store.warnings.length,
        notes: store.notes.length,
        tickets: store.tickets.length,
        applications: store.applications.length,
        discipline: store.discipline.length,
        businesses: store.businesses.length,
        announcements: store.announcements.length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to build health response." });
  }
});

app.get("/api/form-options", async (req, res) => {
  try {
    res.json(await buildFormOptions(getSelectedGuildId(req)));
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load form options." });
  }
});

app.get("/api/application-forms", (_req, res) => {
  try {
    res.json(loadApplicationFormsConfig());
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load application forms config." });
  }
});

app.get("/api/server-settings", async (req, res) => {
  try {
    const targetGuildId = getSelectedGuildId(req);
    const { guild } = await getGuildSnapshot(targetGuildId);
    const store = loadServerSettingsStore();
    res.json({
      guildId: guild.id,
      guildName: guild.name,
      settingsPath: SERVER_SETTINGS_PATH,
      defaultSettings: store.default || DEFAULT_SERVER_SETTINGS.default,
      guildOverride: (store.guilds || {})[guild.id] || {},
      mergedSettings: getMergedServerSettings(store, guild.id),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load server settings." });
  }
});

app.post("/api/server-settings", async (req, res) => {
  try {
    const { scope, settings } = req.body || {};
    if (!scope) {
      res.status(400).json({ error: "scope is required." });
      return;
    }

    const targetGuildId = getSelectedGuildId(req);
    const { guild } = await getGuildSnapshot(targetGuildId);
    const store = loadServerSettingsStore();

    if (scope === "provision") {
      const result = await provisionServer(targetGuildId);
      res.json({
        ok: true,
        provisioned: result,
        mergedSettings: getMergedServerSettings(store, guild.id),
        guildOverride: (store.guilds || {})[guild.id] || {},
        defaultSettings: store.default || DEFAULT_SERVER_SETTINGS.default,
      });
      return;
    }

    if (scope === "post-panels") {
      const result = await postInteractivePanels(targetGuildId);
      res.json({
        ok: true,
        postedPanels: result,
        mergedSettings: getMergedServerSettings(store, guild.id),
        guildOverride: (store.guilds || {})[guild.id] || {},
        defaultSettings: store.default || DEFAULT_SERVER_SETTINGS.default,
      });
      return;
    }

    if (scope === "seed-content") {
      const result = await seedServerContent(targetGuildId);
      res.json({
        ok: true,
        seededChannels: result,
        mergedSettings: getMergedServerSettings(store, guild.id),
        guildOverride: (store.guilds || {})[guild.id] || {},
        defaultSettings: store.default || DEFAULT_SERVER_SETTINGS.default,
      });
      return;
    }

    if (!settings || typeof settings !== "object") {
      res.status(400).json({ error: "settings must be an object." });
      return;
    }

    if (scope === "default") {
      store.default = settings;
    } else if (scope === "guild") {
      if (!store.guilds) {
        store.guilds = {};
      }
      store.guilds[guild.id] = settings;
    } else {
      res.status(400).json({ error: "scope must be default or guild." });
      return;
    }

    saveServerSettingsStore(store);
    res.json({
      ok: true,
      mergedSettings: getMergedServerSettings(store, guild.id),
      guildOverride: (store.guilds || {})[guild.id] || {},
      defaultSettings: store.default || DEFAULT_SERVER_SETTINGS.default,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to save server settings." });
  }
});

app.post("/api/application-forms", (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.default || !Array.isArray(payload.default.fields)) {
      res.status(400).json({ error: "A default form with fields is required." });
      return;
    }
    saveApplicationFormsConfig(payload);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to save application forms config." });
  }
});

app.post("/api/announcements", async (req, res) => {
  try {
    const { channelId, type, title, body, actor } = req.body || {};
    if (!channelId || !title || !body) {
      res.status(400).json({ error: "channelId, title, and body are required." });
      return;
    }
    const entry = await createAnnouncement(getSelectedGuildId(req), { channelId, type, title, body, actor });
    res.json({ ok: true, entry });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to create announcement." });
  }
});

app.post("/api/businesses", async (req, res) => {
  try {
    const targetGuildId = getSelectedGuildId(req);
    const { name, ownerId, actor, licenseStatus } = req.body || {};
    if (!name || !ownerId) {
      res.status(400).json({ error: "name and ownerId are required." });
      return;
    }
    const { members } = await getGuildSnapshot(targetGuildId);
    const owner = members.find((member) => member.id === ownerId);
    if (!owner) {
      res.status(404).json({ error: "Owner not found." });
      return;
    }
    const record = await upsertBusiness(targetGuildId, {
      name,
      ownerId: owner.id,
      ownerTag: owner.user.tag,
      licenseStatus: licenseStatus || "licensed",
      actor,
    });
    res.json({ ok: true, record });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to upsert business." });
  }
});

app.post("/api/businesses/:caseId/close", async (req, res) => {
  try {
    const record = await closeBusiness(getSelectedGuildId(req), req.params.caseId, (req.body || {}).actor, (req.body || {}).reason);
    res.json({ ok: true, record });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to close business." });
  }
});

app.post("/api/provision", async (req, res) => {
  try {
    const result = await provisionServer(getSelectedGuildId(req));
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to provision server." });
  }
});

app.get("/api/provision", async (req, res) => {
  try {
    const result = await provisionServer(getSelectedGuildId(req));
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to provision server." });
  }
});

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

client.once("ready", async () => {
  console.log(`Dashboard logged in as ${client.user.tag}`);
  const guilds = await listAvailableGuilds();
  const startupGuildId = defaultGuildId || guilds[0]?.id;
  if (startupGuildId) {
    const { guild } = await getGuildSnapshot(startupGuildId, true);
    console.log(`Dashboard default guild: ${guild.name}`);
  } else {
    console.log("Dashboard started with no connected guilds.");
  }
  app.listen(port, () => {
    console.log(`Dashboard running at http://localhost:${port}`);
  });
});

client.login(token).catch((error) => {
  console.error(error);
  process.exit(1);
});
