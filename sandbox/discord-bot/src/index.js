require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const STAFF_ROLE_NAMES = ["Founder", "Admin", "Senior Staff", "Moderator", "Developer"];
const VERIFIED_ROLE_NAME = "Verified";
const BASE_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(BASE_DIR, "data");
const CONFIG_DIR = path.join(BASE_DIR, "config");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const TRANSCRIPTS_DIR = path.join(DATA_DIR, "transcripts");
const APPLICATION_FORMS_PATH = path.join(CONFIG_DIR, "application_forms.json");
const SERVER_SETTINGS_PATH = path.join(CONFIG_DIR, "server_settings.json");
const DEFAULT_APPLICATION_FORM_CONFIG = {
  default: {
    titlePrefix: "Apply:",
    fields: [
      {
        key: "character_name",
        label: "Character Name",
        style: "short",
        required: true,
        maxLength: 60,
      },
      {
        key: "character_age",
        label: "Character Age",
        style: "short",
        required: true,
        maxLength: 10,
      },
      {
        key: "background",
        label: "Short Background",
        style: "paragraph",
        required: true,
        maxLength: 600,
      },
      {
        key: "rp_goals",
        label: "What RP do you want to create?",
        style: "paragraph",
        required: true,
        maxLength: 600,
      },
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
      staff: ["Founder", "Admin", "Senior Staff", "Moderator", "Developer"],
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

function normalizeName(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseArgs(content) {
  const parts = content.trim().match(/"[^"]+"|<@!?\d+>|\S+/g) || [];
  return parts.map((part) => part.replace(/^"|"$/g, ""));
}

function ensureDataFiles() {
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

function ensureApplicationFormConfig() {
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

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function getGuildSettings(guildOrId) {
  const guildId = typeof guildOrId === "string" ? guildOrId : guildOrId?.id;
  const store = loadServerSettingsStore();
  const defaults = cloneValue(store.default || DEFAULT_SERVER_SETTINGS.default);
  const override = guildId ? cloneValue((store.guilds || {})[guildId] || {}) : {};
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

function getServerName(guildOrId) {
  return getGuildSettings(guildOrId).serverName || (typeof guildOrId === "object" ? guildOrId.name : "this server");
}

function getStaffRoleNames(guild) {
  return getGuildSettings(guild).roles?.staff || [];
}

function getVerifiedRoleName(guild) {
  return getGuildSettings(guild).roles?.verified || VERIFIED_ROLE_NAME;
}

function getUnverifiedRoleName(guild) {
  return getGuildSettings(guild).roles?.unverified || "Unverified";
}

function getReviewRoleNames(guild) {
  return getGuildSettings(guild).roles?.review || [];
}

function getVerifyRoleNames(guild) {
  return getGuildSettings(guild).roles?.verify || [];
}

function getRoleManagerNames(guild) {
  return getGuildSettings(guild).roles?.roleManager || [];
}

function getDiagnosticRoleNames(guild) {
  return getGuildSettings(guild).roles?.diagnostics || [];
}

function getRequiredChannelNames(guild) {
  return getGuildSettings(guild).requiredChannels || [];
}

function getApplicationTargets(guild) {
  return getGuildSettings(guild).applicationTargets || {};
}

function getRosterGroups(guild) {
  return getGuildSettings(guild).rosterGroups || {};
}

function getApplicationButtonRows(guild) {
  return getGuildSettings(guild).applicationButtons || [];
}

function getOnboardingConfig(guild) {
  return getGuildSettings(guild).onboarding || {};
}

function renderServerMessage(template, guild, replacements = {}) {
  let text = template || "";
  const values = {
    server: getServerName(guild),
    ...replacements,
  };
  for (const [key, value] of Object.entries(values)) {
    text = text.replaceAll(`{${key}}`, String(value));
  }
  return text;
}

function loadApplicationFormConfig(roleKey) {
  ensureApplicationFormConfig();
  try {
    const parsed = JSON.parse(fs.readFileSync(APPLICATION_FORMS_PATH, "utf8"));
    const base = parsed.default || DEFAULT_APPLICATION_FORM_CONFIG.default;
    const override = (parsed.roles || {})[roleKey] || {};
    return {
      titlePrefix: override.titlePrefix || base.titlePrefix || "Apply:",
      title: override.title || null,
      fields: Array.isArray(override.fields) && override.fields.length ? override.fields : base.fields,
    };
  } catch {
    return {
      titlePrefix: DEFAULT_APPLICATION_FORM_CONFIG.default.titlePrefix,
      title: null,
      fields: DEFAULT_APPLICATION_FORM_CONFIG.default.fields,
    };
  }
}

function loadStore() {
  ensureDataFiles();
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
  ensureDataFiles();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function appendStoreRecord(bucket, record) {
  const store = loadStore();
  if (!Array.isArray(store[bucket])) {
    store[bucket] = [];
  }
  const caseId = record.caseId || `WP-${String(store.meta.nextCaseNumber || 1).padStart(4, "0")}`;
  store.meta.nextCaseNumber = (store.meta.nextCaseNumber || 1) + 1;
  store[bucket].push({
    id: `${bucket}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    caseId,
    createdAt: new Date().toISOString(),
    ...record,
  });
  saveStore(store);
  return caseId;
}

function buildMemberButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_support").setLabel("Open Support Ticket").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ticket_report").setLabel("Open Report Ticket").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("ticket_appeal").setLabel("Open Appeal Ticket").setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function buildApplicationButtons(guild) {
  const rows = getApplicationButtonRows(guild);
  return rows.map((row) =>
    new ActionRowBuilder().addComponents(
      ...row.map((button) =>
        new ButtonBuilder()
          .setCustomId(`apply_${button.key}`)
          .setLabel(button.label)
          .setStyle(ButtonStyle[button.style] || ButtonStyle.Secondary),
      ),
    ),
  );
}

function buildApplicationModal(guild, roleKey) {
  const form = loadApplicationFormConfig(roleKey);
  const roleLabel = getApplicationTargets(guild)[roleKey] || roleKey;
  const title = form.title || `${form.titlePrefix || "Apply:"} ${roleLabel}`.trim();
  return new ModalBuilder()
    .setCustomId(`application_modal:${roleKey}`)
    .setTitle(title)
    .addComponents(
      ...form.fields.slice(0, 5).map((field) =>
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(field.key)
            .setLabel(field.label)
            .setStyle((field.style || "short").toLowerCase() === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setRequired(field.required !== false)
            .setMaxLength(field.maxLength || 400),
        ),
      ),
    );
}

function buildStaffReviewButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("review_approve").setLabel("Approve").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("review_deny").setLabel("Deny").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("review_waiting").setLabel("Need Info").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("review_close").setLabel("Close").setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function getStaffRoles(guild) {
  return getStaffRoleNames(guild).map((name) => guild.roles.cache.find((role) => role.name === name)).filter(Boolean);
}

function memberHasNamedRole(member, roleNames) {
  return getStaffRoles(member.guild)
    .concat(roleNames.filter((name) => !getStaffRoleNames(member.guild).includes(name)).map((name) => member.guild.roles.cache.find((role) => role.name === name)).filter(Boolean))
    .some((role) => role && member.roles.cache.has(role.id));
}

function isStaffMember(member) {
  return (
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    getStaffRoles(member.guild).some((role) => member.roles.cache.has(role.id))
  );
}

function canHandleTickets(member) {
  return isStaffMember(member);
}

function canReviewApplications(member) {
  return memberHasNamedRole(member, getReviewRoleNames(member.guild));
}

function canManageVerification(member) {
  return memberHasNamedRole(member, getVerifyRoleNames(member.guild));
}

function canManageRoles(member) {
  return memberHasNamedRole(member, getRoleManagerNames(member.guild));
}

function canUseDiagnostics(member) {
  return memberHasNamedRole(member, getDiagnosticRoleNames(member.guild));
}

async function ensureManageChannels(member) {
  if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error("You need the Manage Channels permission to use this bot.");
  }
}

async function findCategoryByName(guild, categoryName) {
  const normalized = normalizeName(categoryName);
  return guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildCategory &&
      normalizeName(channel.name) === normalized,
  );
}

async function createCategory(guild, rawName, permissionOverwrites = undefined) {
  const existing = await findCategoryByName(guild, rawName);
  if (existing) {
    if (permissionOverwrites) {
      await existing.edit({ permissionOverwrites });
    }
    return { created: false, channel: existing };
  }

  const channel = await guild.channels.create({
    name: rawName,
    type: ChannelType.GuildCategory,
    ...(permissionOverwrites ? { permissionOverwrites } : {}),
  });

  return { created: true, channel };
}

async function createTextChannel(guild, rawName, categoryName = null, options = {}) {
  let parent = null;
  if (categoryName) {
    const categoryResult = await createCategory(guild, categoryName);
    parent = categoryResult.channel;
  }

  const channel = await guild.channels.create({
    name: normalizeName(rawName),
    type: ChannelType.GuildText,
    parent: parent ? parent.id : null,
    topic: options.topic || null,
    ...(options.permissionOverwrites ? { permissionOverwrites: options.permissionOverwrites } : {}),
  });

  return { channel, parent };
}

async function createVoiceChannel(guild, rawName, categoryName = null) {
  let parent = null;
  if (categoryName) {
    const categoryResult = await createCategory(guild, categoryName);
    parent = categoryResult.channel;
  }

  const channel = await guild.channels.create({
    name: rawName.trim(),
    type: ChannelType.GuildVoice,
    parent: parent ? parent.id : null,
  });

  return { channel, parent };
}

async function createTemplate(guild, templateName) {
  const normalized = templateName.trim().toLowerCase();

  if (normalized === "basic") {
    const category = await createCategory(guild, "Community");
    const created = [];
    created.push(await createTextChannel(guild, "general", category.channel.name));
    created.push(await createTextChannel(guild, "announcements", category.channel.name));
    created.push(await createTextChannel(guild, "support", category.channel.name));
    created.push(await createVoiceChannel(guild, "General Voice", category.channel.name));
    return {
      category: category.channel,
      created,
      label: "basic community template",
    };
  }

  if (normalized === "gaming") {
    const category = await createCategory(guild, "Gaming");
    const created = [];
    created.push(await createTextChannel(guild, "game-chat", category.channel.name));
    created.push(await createTextChannel(guild, "lfg", category.channel.name));
    created.push(await createTextChannel(guild, "clips", category.channel.name));
    created.push(await createVoiceChannel(guild, "Squad 1", category.channel.name));
    created.push(await createVoiceChannel(guild, "Squad 2", category.channel.name));
    return {
      category: category.channel,
      created,
      label: "gaming template",
    };
  }

  throw new Error("Unknown template. Use `basic` or `gaming`.");
}

async function ensurePrivateCategory(guild, name) {
  const everyone = guild.roles.everyone;
  const staffRoles = getStaffRoles(guild);
  const overwrites = [
    {
      id: everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    ...staffRoles.map((role) => ({
      id: role.id,
      allow: [PermissionFlagsBits.ViewChannel],
    })),
  ];
  const result = await createCategory(guild, name, overwrites);
  return result.channel;
}

async function ensureTicketCategory(guild) {
  return ensurePrivateCategory(guild, "TICKETS");
}

async function ensureApplicationCategory(guild) {
  return ensurePrivateCategory(guild, "APPLICATION REVIEW");
}

async function ensureBotLogsChannel(guild) {
  const existing = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildText && channel.name === "bot-logs",
  );
  if (existing) {
    return existing;
  }

  const staffCategory = await createCategory(guild, "STAFF");
  const everyone = guild.roles.everyone;
  const staffRoles = getStaffRoles(guild);
  const permissionOverwrites = [
    {
      id: everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    ...staffRoles.map((role) => ({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    })),
  ];

  const result = await createTextChannel(guild, "bot-logs", staffCategory.channel.name, {
    topic: "Automated logs for tickets, applications, verification, and role actions.",
    permissionOverwrites,
  });
  return result.channel;
}

async function sendBotLog(guild, lines) {
  const channel = await ensureBotLogsChannel(guild);
  const chunks = [];
  let current = "";

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > 1900) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) {
    chunks.push(current);
  }

  for (const chunk of chunks) {
    await channel.send(chunk);
  }
}

async function resolveMemberFromArg(guild, raw) {
  if (!raw) {
    return null;
  }
  const id = raw.replace(/[<@!>]/g, "");
  if (!/^\d+$/.test(id)) {
    return null;
  }
  return guild.members.fetch(id);
}

function resolveRoleNameFromArg(guild, raw) {
  if (!raw) {
    return null;
  }
  return getApplicationTargets(guild)[raw.toLowerCase()] || null;
}

async function getRoleOrThrow(guild, roleName) {
  const role = guild.roles.cache.find((entry) => entry.name === roleName);
  if (!role) {
    throw new Error(`Role not found: ${roleName}`);
  }
  return role;
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

async function fetchTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const ordered = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = ordered.map((message) => {
    const stamp = new Date(message.createdTimestamp).toISOString();
    const content = message.content || "[no text]";
    return `[${stamp}] ${message.author.tag}: ${content}`;
  });
  if (lines.length === 0) {
    return ["[No messages captured]"];
  }
  return lines;
}

function writeTranscriptFile(channel, lines) {
  ensureDataFiles();
  const fileName = `${new Date().toISOString().replace(/[:.]/g, "-")}_${channel.name}.txt`;
  const filePath = path.join(TRANSCRIPTS_DIR, fileName);
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return filePath;
}

function formatMemberHistory(memberId) {
  const store = loadStore();
  const warnings = (store.warnings || []).filter((entry) => entry.memberId === memberId);
  const notes = (store.notes || []).filter((entry) => entry.memberId === memberId);
  const applications = (store.applications || []).filter((entry) => entry.applicantId === memberId);
  const lines = [];
  lines.push(`Warnings: ${warnings.length}`);
  for (const entry of warnings.slice(-5)) {
    lines.push(`- [${entry.createdAt}] ${entry.by}: ${entry.reason}`);
  }
  lines.push(`Notes: ${notes.length}`);
  for (const entry of notes.slice(-5)) {
    lines.push(`- [${entry.createdAt}] ${entry.by}: ${entry.reason}`);
  }
  lines.push(`Applications: ${applications.length}`);
  for (const entry of applications.slice(-5)) {
    lines.push(`- [${entry.createdAt}] ${entry.role}: ${entry.status}`);
  }
  return lines.join("\n");
}

function formatMemberProfile(member) {
  const store = loadStore();
  const verifiedRoleName = getVerifiedRoleName(member.guild);
  const roleNames = member.roles.cache
    .filter((role) => role.name !== "@everyone")
    .map((role) => role.name)
    .sort((a, b) => a.localeCompare(b));
  const warnings = (store.warnings || []).filter((entry) => entry.memberId === member.id);
  const notes = (store.notes || []).filter((entry) => entry.memberId === member.id);
  const applications = (store.applications || []).filter((entry) => entry.applicantId === member.id);
  const verifications = (store.verifications || []).filter((entry) => entry.memberId === member.id);
  const discipline = (store.discipline || []).filter((entry) => entry.memberId === member.id);
  const businesses = (store.businesses || []).filter((entry) => entry.ownerId === member.id && entry.status !== "closed");
  const latestApplication = applications.slice(-1)[0];
  const latestWarning = warnings.slice(-1)[0];
  const latestDiscipline = discipline.slice(-1)[0];

  return [
    `User: ${member.user.tag}`,
    `Member ID: ${member.id}`,
    `Verified: ${member.roles.cache.some((role) => role.name === verifiedRoleName) ? "yes" : "no"}`,
    `Roles: ${roleNames.length ? roleNames.join(", ") : "none"}`,
    `Warnings: ${warnings.length}`,
    `Discipline Records: ${discipline.length}`,
    `Escalation Level: ${getEscalationLevel(member.id)}`,
    `Notes: ${notes.length}`,
    `Applications: ${applications.length}`,
    `Verification Actions: ${verifications.length}`,
    `Active Businesses: ${businesses.length ? businesses.map((entry) => `${entry.name} (${entry.licenseStatus})`).join(", ") : "none"}`,
    latestApplication ? `Latest Application: ${latestApplication.role} - ${latestApplication.status}` : "Latest Application: none",
    latestWarning ? `Latest Warning: ${latestWarning.caseId} - ${latestWarning.reason}` : "Latest Warning: none",
    latestDiscipline ? `Latest Discipline: ${latestDiscipline.caseId} - ${latestDiscipline.action}` : "Latest Discipline: none",
  ].join("\n");
}

function getEscalationLevel(memberId) {
  const store = loadStore();
  const warnings = (store.warnings || []).filter((entry) => entry.memberId === memberId).length;
  const discipline = (store.discipline || []).filter((entry) => entry.memberId === memberId).length;
  const score = warnings + discipline * 2;
  if (score >= 6) {
    return "critical";
  }
  if (score >= 4) {
    return "high";
  }
  if (score >= 2) {
    return "medium";
  }
  return "low";
}

function buildHealthReport(guild) {
  const applicationRoles = [...new Set(Object.values(getApplicationTargets(guild)))];
  const missingRoles = [
    ...getStaffRoleNames(guild),
    getVerifiedRoleName(guild),
    ...applicationRoles,
    getUnverifiedRoleName(guild),
  ].filter((name) => !guild.roles.cache.find((role) => role.name === name));
  const missingChannels = getRequiredChannelNames(guild).filter(
    (name) => !guild.channels.cache.find((channel) => channel.name === name),
  );
  const store = loadStore();
  return [
    `Missing Roles: ${missingRoles.length ? missingRoles.join(", ") : "none"}`,
    `Missing Channels: ${missingChannels.length ? missingChannels.join(", ") : "none"}`,
    `Open Tickets: ${(store.tickets || []).filter((entry) => entry.status === "open").length}`,
    `Open Applications: ${(store.applications || []).filter((entry) => entry.status === "open").length}`,
    `Store File: ${STORE_PATH}`,
    `Transcript Folder: ${TRANSCRIPTS_DIR}`,
  ].join("\n");
}

function buildDashboardReport() {
  const store = loadStore();
  const openTickets = (store.tickets || []).filter((entry) => entry.status === "open");
  const openApplications = (store.applications || []).filter((entry) => entry.status === "open");
  const waitingApplications = (store.applications || []).filter((entry) => entry.status === "waiting");
  const approvedToday = (store.applications || []).filter((entry) => entry.status === "approved").slice(-5);
  const recentWarnings = (store.warnings || []).slice(-5);
  const recentDiscipline = (store.discipline || []).slice(-5);
  const activeBusinesses = (store.businesses || []).filter((entry) => entry.status !== "closed");

  const lines = [
    `Open Tickets: ${openTickets.length}`,
    `Open Applications: ${openApplications.length}`,
    `Waiting On Applicant: ${waitingApplications.length}`,
    `Recent Approved Applications: ${approvedToday.length}`,
    `Active Businesses: ${activeBusinesses.length}`,
  ];

  if (approvedToday.length) {
    lines.push("", "Recent Approvals:");
    for (const entry of approvedToday) {
      lines.push(`- ${entry.applicantTag} -> ${entry.role} (${entry.reviewedAt || entry.createdAt})`);
    }
  }

  if (recentWarnings.length) {
    lines.push("", "Recent Warnings:");
    for (const entry of recentWarnings) {
      lines.push(`- ${entry.memberTag}: ${entry.reason}`);
    }
  }

  if (recentDiscipline.length) {
    lines.push("", "Recent Discipline:");
    for (const entry of recentDiscipline) {
      lines.push(`- ${entry.memberTag}: ${entry.action} (${entry.reason})`);
    }
  }

  return lines.join("\n");
}

function formatRoster(guild, target) {
  const key = (target || "staff").toLowerCase();
  const roleNames = getRosterGroups(guild)[key];
  if (!roleNames) {
    throw new Error("Roster not found. Use sheriffs-office, bcso, medical, fire-department, doj, media, events-team, real-estate, management, business, or staff.");
  }
  const members = guild.members.cache
    .filter((member) => roleNames.some((roleName) => member.roles.cache.some((role) => role.name === roleName)))
    .map((member) => `${member.user.tag} | Roles: ${member.roles.cache.filter((role) => role.name !== "@everyone").map((role) => role.name).sort((a, b) => a.localeCompare(b)).join(", ")}`)
    .sort((a, b) => a.localeCompare(b));
  if (!members.length) {
    return `No members are currently in the ${key.toUpperCase()} roster.`;
  }
  return members.map((line) => `- ${line}`).join("\n");
}

function findCaseRecord(caseId) {
  const store = loadStore();
  const buckets = ["warnings", "notes", "tickets", "applications", "verifications", "roleActions", "discipline", "businesses", "announcements"];
  for (const bucket of buckets) {
    const record = (store[bucket] || []).find((entry) => (entry.caseId || "").toLowerCase() === caseId.toLowerCase());
    if (record) {
      return { bucket, record };
    }
  }
  return null;
}

function formatCaseRecord(caseId) {
  const found = findCaseRecord(caseId);
  if (!found) {
    return null;
  }
  const { bucket, record } = found;
  return [
    `Case ID: ${record.caseId}`,
    `Bucket: ${bucket}`,
    `Created: ${record.createdAt || "n/a"}`,
    `Summary: ${record.reason || record.title || record.type || record.role || record.action || record.name || "n/a"}`,
    `Actor: ${record.by || record.createdBy || record.reviewedBy || "n/a"}`,
    `Member: ${record.memberTag || record.ownerTag || record.applicantTag || "n/a"}`,
    `Status: ${record.status || record.licenseStatus || record.action || "n/a"}`,
  ].join("\n");
}

function upsertBusinessRecord({ guildId: currentGuildId, name, ownerId, ownerTag, licenseStatus, createdBy }) {
  const store = loadStore();
  const normalizedName = normalizeName(name);
  let record = (store.businesses || []).find((entry) => normalizeName(entry.name) === normalizedName);
  if (record) {
    record.ownerId = ownerId;
    record.ownerTag = ownerTag;
    record.licenseStatus = licenseStatus;
    record.updatedAt = new Date().toISOString();
    record.updatedBy = createdBy;
    if (!record.caseId) {
      record.caseId = `WP-${String(store.meta.nextCaseNumber || 1).padStart(4, "0")}`;
      store.meta.nextCaseNumber = (store.meta.nextCaseNumber || 1) + 1;
    }
  } else {
    record = {
      id: `business-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      caseId: `WP-${String(store.meta.nextCaseNumber || 1).padStart(4, "0")}`,
      createdAt: new Date().toISOString(),
      guildId: currentGuildId,
      name,
      ownerId,
      ownerTag,
      licenseStatus,
      status: "active",
      createdBy,
    };
    store.meta.nextCaseNumber = (store.meta.nextCaseNumber || 1) + 1;
    store.businesses.push(record);
  }
  saveStore(store);
  return record;
}

function closeBusinessRecord(name, closedBy, reason) {
  const store = loadStore();
  const normalizedName = normalizeName(name);
  const record = (store.businesses || []).find((entry) => normalizeName(entry.name) === normalizedName && entry.status !== "closed");
  if (!record) {
    return null;
  }
  record.status = "closed";
  record.closedAt = new Date().toISOString();
  record.closedBy = closedBy;
  record.closeReason = reason || "No reason provided.";
  saveStore(store);
  return record;
}

function listBusinesses() {
  const store = loadStore();
  const entries = (store.businesses || []).filter((entry) => entry.status !== "closed");
  if (!entries.length) {
    return "No active businesses are registered yet.";
  }
  return entries
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => `- ${entry.name} | Owner: ${entry.ownerTag} | Status: ${entry.licenseStatus} | Case: ${entry.caseId}`)
    .join("\n");
}

async function postAnnouncement(context, targetChannel, type, title, body) {
  if (!canUseDiagnostics(context.member)) {
    throw new Error("Only diagnostics-enabled staff can post announcements.");
  }
  if (!targetChannel || !targetChannel.isTextBased()) {
    throw new Error("Choose a valid text channel for the announcement.");
  }
  const label = (type || "update").toUpperCase();
  const lines = [
    `# ${label}: ${title}`,
    "",
    body,
    "",
    `Posted by ${context.author.tag}`,
  ];
  await targetChannel.send(lines.join("\n"));
  const caseId = appendStoreRecord("announcements", {
    guildId: context.guild.id,
    channelId: targetChannel.id,
    channelName: targetChannel.name,
    type,
    title,
    body,
    by: context.author.tag,
  });
  await sendBotLog(context.guild, [
    `# Announcement Posted`,
    `Case: ${caseId}`,
    `Type: ${type}`,
    `Channel: ${targetChannel.name}`,
    `Title: ${title}`,
    `By: ${context.author.tag}`,
  ]);
  return caseId;
}

async function addDisciplineRecord(context, targetMember, action, reason, durationMinutes = null) {
  if (!canHandleTickets(context.member)) {
    throw new Error("Only staff can add discipline records.");
  }
  const normalizedAction = (action || "").toLowerCase();
  if (!["timeout", "suspend", "banrecord"].includes(normalizedAction)) {
    throw new Error("Discipline action must be timeout, suspend, or banrecord.");
  }

  let appliedTimeout = false;
  if (normalizedAction === "timeout" && durationMinutes && targetMember.moderatable) {
    const durationMs = Math.max(1, Math.min(Number(durationMinutes) || 0, 10080)) * 60 * 1000;
    if (durationMs > 0) {
      await targetMember.timeout(durationMs, reason || "No reason provided.");
      appliedTimeout = true;
    }
  }

  const caseId = appendStoreRecord("discipline", {
    guildId: context.guild.id,
    memberId: targetMember.id,
    memberTag: targetMember.user.tag,
    by: context.author.tag,
    action: normalizedAction,
    reason: reason || "No reason provided.",
    durationMinutes: durationMinutes || null,
    appliedTimeout,
    escalationLevel: getEscalationLevel(targetMember.id),
  });

  await sendBotLog(context.guild, [
    `# Discipline Recorded`,
    `Case: ${caseId}`,
    `Member: ${targetMember.user.tag} (${targetMember.id})`,
    `Action: ${normalizedAction}`,
    `Duration Minutes: ${durationMinutes || "n/a"}`,
    `Applied Timeout: ${appliedTimeout ? "yes" : "no"}`,
    `By: ${context.author.tag}`,
    `Reason: ${reason || "No reason provided."}`,
  ]);

  try {
    await targetMember.send(
      renderServerMessage(getOnboardingConfig(context.guild).disciplineDm, context.guild, {
        action: normalizedAction,
        reason: reason || "No reason provided.",
      }),
    );
  } catch {}

  return caseId;
}

function updateApplicationRecord(channelId, updates) {
  const store = loadStore();
  let changed = false;
  for (const item of store.applications || []) {
    if (item.channelId === channelId && item.status !== "closed") {
      Object.assign(item, updates);
      changed = true;
    }
  }
  if (changed) {
    saveStore(store);
  }
}

async function markApplicationWaiting(context, note = "Waiting on applicant response.") {
  if (!canReviewApplications(context.member)) {
    throw new Error("Only application reviewers can change application status.");
  }
  const channel = context.channel;
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error("This command only works in application channels.");
  }
  const details = parseTopic(channel.topic || "");
  if (!details.applicant || !details.role) {
    throw new Error("This command only works in application channels.");
  }

  const baseName = normalizeName(`app-${details.role}-${details.applicant}`).slice(0, 70);
  const nextName = channel.name.startsWith("waiting-") ? channel.name : `waiting-${channel.name}`.slice(0, 95);
  if (channel.name !== nextName) {
    await channel.setName(nextName);
  }
  updateApplicationRecord(channel.id, {
    status: "waiting",
    waitingAt: new Date().toISOString(),
    waitingBy: context.author.tag,
    waitingNote: note,
  });
  await context.reply("Marked this application as waiting on the applicant.");
  try {
    const applicant = await context.guild.members.fetch(details.applicant);
    await applicant.send(
      renderServerMessage(getOnboardingConfig(context.guild).waitingDm, context.guild, {
        role: details.role,
        note,
      }),
    );
  } catch {}
  await sendBotLog(context.guild, [
    `# Application Waiting`,
    `Channel: ${channel.name}`,
    `Role: ${details.role}`,
    `By: ${context.author.tag}`,
    `Note: ${note}`,
  ]);
}

async function openTicket(message, type) {
  const guild = message.guild;
  const member = message.member;
  if (!guild || !member) {
    throw new Error("This command only works in the server.");
  }

  const ticketType = (type || "support").toLowerCase();
  const validTypes = new Set(["support", "report", "appeal"]);
  if (!validTypes.has(ticketType)) {
    throw new Error("Ticket type must be `support`, `report`, or `appeal`.");
  }

  const category = await ensureTicketCategory(guild);
  const existing = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.parentId === category.id &&
      channel.topic &&
      channel.topic.includes(`ticket-owner:${member.id}`),
  );

  if (existing) {
    return existing;
  }

  const staffRoles = getStaffRoles(guild);
  const channelName = `${ticketType}-${normalizeName(member.user.username)}`.slice(0, 90);
  const topic = `ticket-owner:${member.id}|type:${ticketType}`;
  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    ...staffRoles.map((role) => ({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    })),
  ];

  const result = await createTextChannel(guild, channelName, category.name, {
    topic,
    permissionOverwrites,
  });

  await result.channel.send(
    {
      content: [
        `# ${ticketType[0].toUpperCase()}${ticketType.slice(1)} Ticket`,
        "",
        `${member}, thanks for opening a ticket.`,
        "",
        "Please post the following:",
        "- Character Name",
        "- What happened",
        "- What you need from staff",
        "- Any screenshots or context that matter",
        "",
        "Staff can use the buttons below or `!ticket close`.",
      ].join("\n"),
      components: buildStaffReviewButtons(),
    },
  );

  await sendBotLog(guild, [
    `# Ticket Opened`,
    `Type: ${ticketType}`,
    `User: ${member.user.tag} (${member.id})`,
    `Channel: ${result.channel.name}`,
  ]);

  appendStoreRecord("tickets", {
    guildId: guild.id,
    channelId: result.channel.id,
    ownerId: member.id,
    ownerTag: member.user.tag,
    type: ticketType,
    status: "open",
  });

  return result.channel;
}

async function openApplication(message, targetKey, answers = null) {
  const guild = message.guild;
  const member = message.member;
  if (!guild || !member) {
    throw new Error("This command only works in the server.");
  }

  const normalized = (targetKey || "").toLowerCase();
  const roleName = getApplicationTargets(guild)[normalized];
  const form = loadApplicationFormConfig(normalized);
  if (!roleName) {
    throw new Error(
      "Usage: `!apply citizen`, `!apply business-owner`, `!apply sheriffs-office`, `!apply bcso`, `!apply medical`, `!apply fire-department`, `!apply doj`, `!apply media`, `!apply events-team`, `!apply real-estate`, or `!apply management`.",
    );
  }

  const category = await ensureApplicationCategory(guild);
  const existing = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.parentId === category.id &&
      channel.topic &&
      channel.topic.includes(`applicant:${member.id}`) &&
      channel.topic.includes(`role:${roleName}`),
  );

  if (existing) {
    return existing;
  }

  const targetRole = guild.roles.cache.find((role) => role.name === roleName);
  const staffRoles = getStaffRoles(guild);
  const channelName = `app-${normalizeName(member.user.username)}-${normalizeName(roleName)}`.slice(0, 90);
  const topic = `applicant:${member.id}|role:${roleName}`;
  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    ...staffRoles.map((role) => ({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    })),
  ];

  if (targetRole) {
    permissionOverwrites.push({
      id: targetRole.id,
      allow: [PermissionFlagsBits.ViewChannel],
    });
  }

  const result = await createTextChannel(guild, channelName, category.name, {
    topic,
    permissionOverwrites,
  });

  const content = [
    `# ${roleName} Application`,
    "",
    `${member}, thanks for applying for **${roleName}**.`,
  ];
  if (answers) {
    content.push("");
    for (const field of form.fields) {
      content.push(`**${field.label}:** ${answers[field.key] || "n/a"}`);
    }
  } else {
    content.push(
      "",
      "Please answer the following:",
      ...form.fields.map((field) => `- ${field.label}`),
    );
  }
  content.push(
    "",
    "Staff can review here with the buttons below or by using `!approve`, `!deny <reason>`, or `!ticket close`.",
  );

  await result.channel.send({ content: content.join("\n"), components: buildStaffReviewButtons() });

  await sendBotLog(guild, [
    `# Application Opened`,
    `Role: ${roleName}`,
    `User: ${member.user.tag} (${member.id})`,
    `Channel: ${result.channel.name}`,
  ]);

  appendStoreRecord("applications", {
    guildId: guild.id,
    channelId: result.channel.id,
    applicantId: member.id,
    applicantTag: member.user.tag,
    role: roleName,
    status: "open",
    answers,
  });

  return result.channel;
}

async function closeTicket(message, reason = "Closed by staff") {
  const channel = message.channel;
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error("This command only works inside a text channel.");
  }

  const parentName = channel.parent ? channel.parent.name : "";
  const closableParents = new Set(["TICKETS", "APPLICATION REVIEW"]);
  if (!closableParents.has(parentName)) {
    throw new Error("`!ticket close` only works inside ticket or application channels.");
  }

  if (!isStaffMember(message.member)) {
    throw new Error("Only staff can close tickets and applications.");
  }

  const transcript = await fetchTranscript(channel);
  const transcriptPath = writeTranscriptFile(channel, transcript);
  const details = parseTopic(channel.topic || "");
  await sendBotLog(message.guild, [
    `# Channel Closed`,
    `Channel: ${channel.name}`,
    `Parent: ${parentName}`,
    `Closer: ${message.author.tag}`,
    `Reason: ${reason}`,
    `Topic: ${channel.topic || "n/a"}`,
    "## Transcript",
    ...transcript,
  ]);

  const store = loadStore();
  for (const bucket of ["tickets", "applications"]) {
    if (!Array.isArray(store[bucket])) {
      continue;
    }
    for (const item of store[bucket]) {
      if (item.channelId === channel.id && item.status === "open") {
        item.status = "closed";
        item.closedAt = new Date().toISOString();
        item.closedBy = message.author.tag;
        item.closeReason = reason;
        item.transcriptPath = transcriptPath;
      }
    }
  }
  saveStore(store);

  if (details["ticket-owner"]) {
    const ownerId = details["ticket-owner"];
    try {
      const owner = await message.guild.members.fetch(ownerId);
      await owner.send(`Your ticket **${channel.name}** was closed. Reason: ${reason}`);
    } catch {}
  }

  if (details.applicant) {
    try {
      const applicant = await message.guild.members.fetch(details.applicant);
      await applicant.send(`Your application channel **${channel.name}** was closed. Reason: ${reason}`);
    } catch {}
  }

  await message.reply("Closing this channel in 3 seconds.");
  setTimeout(async () => {
    try {
      await channel.delete(reason);
    } catch (error) {
      console.error(error);
    }
  }, 3000);
}

async function applyRoleToMember(member, roleName) {
  const role = await getRoleOrThrow(member.guild, roleName);
  if (!member.roles.cache.has(role.id)) {
    await member.roles.add(role);
  }
  return role;
}

async function removeRoleFromMember(member, roleName) {
  const role = await getRoleOrThrow(member.guild, roleName);
  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role);
  }
  return role;
}

async function verifyMember(actorMessage, targetMember) {
  if (!canManageVerification(actorMessage.member)) {
    throw new Error("Only senior staff and above can verify members.");
  }
  const verifiedRole = await applyRoleToMember(targetMember, getVerifiedRoleName(actorMessage.guild));
  try {
    await removeRoleFromMember(targetMember, getUnverifiedRoleName(actorMessage.guild));
  } catch {}
  await actorMessage.reply(`Verified ${targetMember}.`);
  try {
    await targetMember.send(renderServerMessage(getOnboardingConfig(actorMessage.guild).verifiedDm, actorMessage.guild));
  } catch {}
  appendStoreRecord("verifications", {
    guildId: actorMessage.guild.id,
    memberId: targetMember.id,
    memberTag: targetMember.user.tag,
    action: "verified",
    by: actorMessage.author.tag,
  });
  await sendBotLog(actorMessage.guild, [
    `# Verification Granted`,
    `Member: ${targetMember.user.tag} (${targetMember.id})`,
    `Role: ${verifiedRole.name}`,
    `By: ${actorMessage.author.tag}`,
  ]);
}

async function unverifyMember(actorMessage, targetMember) {
  if (!canManageVerification(actorMessage.member)) {
    throw new Error("Only senior staff and above can unverify members.");
  }
  await removeRoleFromMember(targetMember, getVerifiedRoleName(actorMessage.guild));
  try {
    await applyRoleToMember(targetMember, getUnverifiedRoleName(actorMessage.guild));
  } catch {}
  await actorMessage.reply(`Removed Verified from ${targetMember}.`);
  try {
    await targetMember.send(renderServerMessage(getOnboardingConfig(actorMessage.guild).unverifiedDm, actorMessage.guild));
  } catch {}
  appendStoreRecord("verifications", {
    guildId: actorMessage.guild.id,
    memberId: targetMember.id,
    memberTag: targetMember.user.tag,
    action: "unverified",
    by: actorMessage.author.tag,
  });
  await sendBotLog(actorMessage.guild, [
    `# Verification Removed`,
    `Member: ${targetMember.user.tag} (${targetMember.id})`,
    `By: ${actorMessage.author.tag}`,
  ]);
}

async function approveApplication(message, maybeMemberArg = null, maybeRoleArg = null) {
  if (!canReviewApplications(message.member)) {
    throw new Error("Only application reviewers can approve applications.");
  }

  const channel = message.channel;
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error("This command only works inside a text channel.");
  }

  let targetMember = null;
  let roleName = null;
  const details = parseTopic(channel.topic || "");

  if (details.applicant) {
    targetMember = await message.guild.members.fetch(details.applicant);
  } else if (maybeMemberArg) {
    targetMember = await resolveMemberFromArg(message.guild, maybeMemberArg);
  }

  if (details.role) {
    roleName = details.role;
  } else if (maybeRoleArg) {
    roleName = resolveRoleNameFromArg(message.guild, maybeRoleArg) || maybeRoleArg;
  }

  if (!targetMember) {
    throw new Error("Could not determine which member to approve.");
  }
  if (!roleName) {
    throw new Error("Could not determine which role to approve.");
  }

  await applyRoleToMember(targetMember, getVerifiedRoleName(message.guild));
  const role = await applyRoleToMember(targetMember, roleName);
  try {
    await removeRoleFromMember(targetMember, getUnverifiedRoleName(message.guild));
  } catch {}

  await message.reply(`Approved ${targetMember} for **${role.name}**.`);
  const store = loadStore();
  for (const item of store.applications || []) {
    if (item.channelId === channel.id && item.status === "open") {
      item.status = "approved";
      item.reviewedAt = new Date().toISOString();
      item.reviewedBy = message.author.tag;
      item.approvedRole = role.name;
    }
  }
  saveStore(store);
  appendStoreRecord("roleActions", {
    guildId: message.guild.id,
    memberId: targetMember.id,
    memberTag: targetMember.user.tag,
    role: role.name,
    action: "approved_application",
    by: message.author.tag,
  });
  await sendBotLog(message.guild, [
    `# Application Approved`,
    `Member: ${targetMember.user.tag} (${targetMember.id})`,
    `Role: ${role.name}`,
    `By: ${message.author.tag}`,
    `Channel: ${channel.name}`,
  ]);

  try {
    await targetMember.send(
      renderServerMessage(getOnboardingConfig(message.guild).approvedDm, message.guild, {
        role: role.name,
      }),
    );
  } catch {}

  if (channel.parent && channel.parent.name === "APPLICATION REVIEW") {
    await closeTicket(message, `Application approved for ${role.name}`);
  }
}

async function denyApplication(message, reason) {
  if (!canReviewApplications(message.member)) {
    throw new Error("Only application reviewers can deny applications.");
  }

  const channel = message.channel;
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error("This command only works inside a text channel.");
  }

  const details = parseTopic(channel.topic || "");
  const applicantId = details.applicant;
  const roleName = details.role || "application";
  if (!applicantId) {
    throw new Error("`!deny` is meant for application channels.");
  }

  const applicant = await message.guild.members.fetch(applicantId);
  const denyReason = reason || "No reason provided.";

  await message.reply(`Denied ${applicant}'s **${roleName}** application.`);
  const store = loadStore();
  for (const item of store.applications || []) {
    if (item.channelId === channel.id && item.status === "open") {
      item.status = "denied";
      item.reviewedAt = new Date().toISOString();
      item.reviewedBy = message.author.tag;
      item.denyReason = denyReason;
    }
  }
  saveStore(store);
  await sendBotLog(message.guild, [
    `# Application Denied`,
    `Member: ${applicant.user.tag} (${applicant.id})`,
    `Role: ${roleName}`,
    `By: ${message.author.tag}`,
    `Reason: ${denyReason}`,
    `Channel: ${channel.name}`,
  ]);

  try {
    await applicant.send(
      renderServerMessage(getOnboardingConfig(message.guild).deniedDm, message.guild, {
        role: roleName,
        reason: denyReason,
      }),
    );
  } catch {}

  await closeTicket(message, `Application denied: ${denyReason}`);
}

async function addModerationRecord(message, targetMember, type, reason) {
  appendStoreRecord(type === "warn" ? "warnings" : "notes", {
    guildId: message.guild.id,
    memberId: targetMember.id,
    memberTag: targetMember.user.tag,
    by: message.author.tag,
    reason,
  });
  await sendBotLog(message.guild, [
    `# ${type === "warn" ? "Warning Issued" : "Staff Note Added"}`,
    `Member: ${targetMember.user.tag} (${targetMember.id})`,
    `By: ${message.author.tag}`,
    `Reason: ${reason}`,
  ]);
}

client.once("ready", async () => {
  ensureDataFiles();
  console.log(`Logged in as ${client.user.tag}`);
  await client.guilds.fetch();
  const guildNames = [...client.guilds.cache.values()].map((guild) => guild.name).sort();
  console.log(`Connected to ${guildNames.length} guild(s): ${guildNames.join(", ") || "none"}`);
});

client.on("guildMemberAdd", async (member) => {
  try {
    const unverifiedRole = member.guild.roles.cache.find((role) => role.name === getUnverifiedRoleName(member.guild));
    if (unverifiedRole && !member.roles.cache.has(unverifiedRole.id)) {
      await member.roles.add(unverifiedRole);
    }

    try {
      await member.send(getOnboardingConfig(member.guild).welcomeMessage.join("\n"));
    } catch {}

    await sendBotLog(member.guild, [
      `# Member Joined`,
      `Member: ${member.user.tag} (${member.id})`,
      `Assigned ${getUnverifiedRoleName(member.guild)}: ${unverifiedRole ? "yes" : "no"}`,
    ]);
  } catch (error) {
    console.error(error);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) {
    return;
  }

  if (!message.guildId) {
    return;
  }

  if (!message.content.startsWith("!")) {
    return;
  }

  try {
    const [command, ...args] = parseArgs(message.content.slice(1));
    if (!command) {
      return;
    }

    const guild = message.guild;
    if (!guild) {
      return;
    }

    const needsManageChannels = new Set(["category", "text", "voice", "template"]);
    if (needsManageChannels.has(command)) {
      await ensureManageChannels(message.member);
    }

    if (command === "help") {
      await message.reply(
        [
          "Commands:",
          "`!creator`",
          "`!help`",
          "`!category \"Category Name\"`",
          "`!text \"channel-name\" \"Optional Category\"`",
          "`!voice \"Voice Name\" \"Optional Category\"`",
          "`!template basic`",
          "`!template gaming`",
          "`!ticket open support`",
          "`!ticket open report`",
          "`!ticket open appeal`",
          "`!ticket close`",
          "`!apply citizen`",
          "`!apply business-owner`",
          "`!apply sheriffs-office`",
          "`!apply bcso`",
          "`!apply medical`",
          "`!apply fire-department`",
          "`!apply doj`",
          "`!apply media`",
          "`!apply events-team`",
          "`!apply real-estate`",
          "`!apply management`",
          "`!verify @user`",
          "`!unverify @user`",
          "`!approve`",
          "`!approve @user role`",
          "`!deny <reason>`",
          "`!warn @user <reason>`",
          "`!note @user <note>`",
          "`!history @user`",
          "`!profile @user`",
          "`!roster sheriffs-office`",
          "`!discipline @user timeout 60 Scene violation`",
          "`!case WP-0001`",
          "`!business add \"name\" @owner licensed`",
          "`!business list`",
          "`!business close \"name\" <reason>`",
          "`!announce #channel update \"Title\" \"Body\"`",
          "`!health`",
          "`!dashboard`",
          "`!appstatus waiting <note>`",
          "`!addrole @user role`",
          "`!removerole @user role`",
        ].join("\n"),
      );
      return;
    }

    if (command === "creator") {
      await message.reply("This bot was created by **Xander Evergarden ( Wicked )**.");
      return;
    }

    if (command === "category") {
      if (args.length < 1) {
        throw new Error("Usage: `!category \"Category Name\"`");
      }
      const result = await createCategory(guild, args[0]);
      await message.reply(
        result.created
          ? `Created category **${result.channel.name}**.`
          : `Category **${result.channel.name}** already exists.`,
      );
      return;
    }

    if (command === "text") {
      if (args.length < 1) {
        throw new Error("Usage: `!text \"channel-name\" \"Optional Category\"`");
      }
      const result = await createTextChannel(guild, args[0], args[1] || null);
      const parentText = result.parent ? ` in **${result.parent.name}**` : "";
      await message.reply(`Created text channel <#${result.channel.id}>${parentText}.`);
      return;
    }

    if (command === "voice") {
      if (args.length < 1) {
        throw new Error("Usage: `!voice \"Voice Name\" \"Optional Category\"`");
      }
      const result = await createVoiceChannel(guild, args[0], args[1] || null);
      const parentText = result.parent ? ` in **${result.parent.name}**` : "";
      await message.reply(`Created voice channel **${result.channel.name}**${parentText}.`);
      return;
    }

    if (command === "template") {
      if (args.length < 1) {
        throw new Error("Usage: `!template basic` or `!template gaming`");
      }
      const result = await createTemplate(guild, args[0]);
      await message.reply(`Created the ${result.label} under **${result.category.name}**.`);
      return;
    }

    if (command === "ticket") {
      const subcommand = (args[0] || "").toLowerCase();
      if (subcommand === "open") {
        const channel = await openTicket(message, args[1] || "support");
        await message.reply(`Your ticket is ready: ${channel}`);
        return;
      }
      if (subcommand === "close") {
        await closeTicket(message);
        return;
      }
      throw new Error("Usage: `!ticket open support` or `!ticket close`.");
    }

    if (command === "apply") {
      const channel = await openApplication(message, args[0] || "");
      await message.reply(`Your application channel is ready: ${channel}`);
      return;
    }

    if (command === "verify") {
      const member = await resolveMemberFromArg(guild, args[0]);
      if (!member) {
        throw new Error("Usage: `!verify @user`");
      }
      await verifyMember(message, member);
      return;
    }

    if (command === "unverify") {
      const member = await resolveMemberFromArg(guild, args[0]);
      if (!member) {
        throw new Error("Usage: `!unverify @user`");
      }
      await unverifyMember(message, member);
      return;
    }

    if (command === "approve") {
      await approveApplication(message, args[0] || null, args[1] || null);
      return;
    }

    if (command === "deny") {
      await denyApplication(message, args.join(" ").trim());
      return;
    }

    if (command === "warn") {
      if (!canHandleTickets(message.member)) {
        throw new Error("Only staff can issue warnings.");
      }
      const member = await resolveMemberFromArg(guild, args[0]);
      const reason = args.slice(1).join(" ").trim();
      if (!member || !reason) {
        throw new Error("Usage: `!warn @user <reason>`");
      }
      await addModerationRecord(message, member, "warn", reason);
      await message.reply(`Warning recorded for ${member}.`);
      return;
    }

    if (command === "note") {
      if (!canHandleTickets(message.member)) {
        throw new Error("Only staff can add notes.");
      }
      const member = await resolveMemberFromArg(guild, args[0]);
      const reason = args.slice(1).join(" ").trim();
      if (!member || !reason) {
        throw new Error("Usage: `!note @user <note>`");
      }
      await addModerationRecord(message, member, "note", reason);
      await message.reply(`Staff note recorded for ${member}.`);
      return;
    }

    if (command === "history") {
      if (!canHandleTickets(message.member)) {
        throw new Error("Only staff can view history.");
      }
      const member = await resolveMemberFromArg(guild, args[0]);
      if (!member) {
        throw new Error("Usage: `!history @user`");
      }
      await message.reply(`## History for ${member.user.tag}\n${formatMemberHistory(member.id)}`);
      return;
    }

    if (command === "profile") {
      if (!canHandleTickets(message.member)) {
        throw new Error("Only staff can view member profiles.");
      }
      const member = await resolveMemberFromArg(guild, args[0]);
      if (!member) {
        throw new Error("Usage: `!profile @user`");
      }
      await message.reply(`## Profile for ${member.user.tag}\n${formatMemberProfile(member)}`);
      return;
    }

    if (command === "roster") {
      if (!canHandleTickets(message.member)) {
        throw new Error("Only staff can view rosters.");
      }
      await guild.members.fetch();
      await message.reply(`## ${String(args[0] || "staff").toUpperCase()} Roster\n${formatRoster(guild, args[0] || "staff")}`);
      return;
    }

    if (command === "discipline") {
      if (!canHandleTickets(message.member)) {
        throw new Error("Only staff can add discipline records.");
      }
      const member = await resolveMemberFromArg(guild, args[0]);
      const action = (args[1] || "").toLowerCase();
      const durationMinutes = action === "timeout" ? Number(args[2]) || 60 : null;
      const reason = action === "timeout" ? args.slice(3).join(" ").trim() : args.slice(2).join(" ").trim();
      if (!member || !action || !reason) {
        throw new Error("Usage: `!discipline @user timeout 60 <reason>`, `!discipline @user suspend <reason>`, or `!discipline @user banrecord <reason>`");
      }
      const caseId = await addDisciplineRecord(message, member, action, reason, durationMinutes);
      await message.reply(`Discipline recorded for ${member}. Case: ${caseId}.`);
      return;
    }

    if (command === "case") {
      if (!canHandleTickets(message.member)) {
        throw new Error("Only staff can view case records.");
      }
      const details = formatCaseRecord(args[0] || "");
      if (!details) {
        throw new Error("Case not found.");
      }
      await message.reply(`## Case Lookup\n${details}`);
      return;
    }

    if (command === "business") {
      if (!canReviewApplications(message.member)) {
        throw new Error("Only review staff can manage the business registry.");
      }
      const sub = (args[0] || "").toLowerCase();
      if (sub === "list") {
        await message.reply(`## Business Registry\n${listBusinesses()}`);
        return;
      }
      if (sub === "add") {
        const name = args[1];
        const owner = await resolveMemberFromArg(guild, args[2]);
        const licenseStatus = args[3] || "licensed";
        if (!name || !owner) {
          throw new Error("Usage: `!business add \"name\" @owner licensed`");
        }
        const record = upsertBusinessRecord({
          guildId: guild.id,
          name,
          ownerId: owner.id,
          ownerTag: owner.user.tag,
          licenseStatus,
          createdBy: message.author.tag,
        });
        await message.reply(`Registered business **${record.name}** for ${owner}. Case: ${record.caseId}.`);
        await sendBotLog(guild, [
          `# Business Registered`,
          `Case: ${record.caseId}`,
          `Business: ${record.name}`,
          `Owner: ${owner.user.tag} (${owner.id})`,
          `Status: ${record.licenseStatus}`,
          `By: ${message.author.tag}`,
        ]);
        return;
      }
      if (sub === "close") {
        const name = args[1];
        const reason = args.slice(2).join(" ").trim() || "No reason provided.";
        if (!name) {
          throw new Error("Usage: `!business close \"name\" <reason>`");
        }
        const record = closeBusinessRecord(name, message.author.tag, reason);
        if (!record) {
          throw new Error("Business not found or already closed.");
        }
        await message.reply(`Closed business **${record.name}**. Case: ${record.caseId}.`);
        await sendBotLog(guild, [
          `# Business Closed`,
          `Case: ${record.caseId}`,
          `Business: ${record.name}`,
          `Reason: ${reason}`,
          `By: ${message.author.tag}`,
        ]);
        return;
      }
      throw new Error("Usage: `!business list`, `!business add \"name\" @owner licensed`, or `!business close \"name\" <reason>`");
    }

    if (command === "announce") {
      if (!canUseDiagnostics(message.member)) {
        throw new Error("Only diagnostics-enabled staff can post announcements.");
      }
      const channelId = (args[0] || "").replace(/[<#>]/g, "");
      const targetChannel = guild.channels.cache.get(channelId);
      const type = (args[1] || "update").toLowerCase();
      const title = args[2];
      const body = args[3];
      if (!targetChannel || !title || !body) {
        throw new Error("Usage: `!announce #channel update \"Title\" \"Body\"`");
      }
      const caseId = await postAnnouncement(message, targetChannel, type, title, body);
      await message.reply(`Announcement posted in ${targetChannel}. Case: ${caseId}.`);
      return;
    }

    if (command === "health") {
      if (!canUseDiagnostics(message.member)) {
        throw new Error("Only diagnostics-enabled staff can use health checks.");
      }
      await message.reply(`## Bot Health\n${buildHealthReport(guild)}`);
      return;
    }

    if (command === "dashboard") {
      if (!canUseDiagnostics(message.member)) {
        throw new Error("Only diagnostics-enabled staff can use dashboard summaries.");
      }
      await message.reply(`## Staff Dashboard\n${buildDashboardReport()}`);
      return;
    }

    if (command === "appstatus") {
      const sub = (args[0] || "").toLowerCase();
      if (sub !== "waiting") {
        throw new Error("Usage: `!appstatus waiting <note>`");
      }
      await markApplicationWaiting(message, args.slice(1).join(" ").trim() || "Waiting on applicant response.");
      return;
    }

    if (command === "addrole") {
      if (!canManageRoles(message.member)) {
        throw new Error("Only senior staff and above can add roles.");
      }
      const member = await resolveMemberFromArg(guild, args[0]);
      const roleName = resolveRoleNameFromArg(guild, args[1]) || args.slice(1).join(" ");
      if (!member || !roleName) {
        throw new Error("Usage: `!addrole @user role`");
      }
      const role = await applyRoleToMember(member, roleName);
      appendStoreRecord("roleActions", {
        guildId: guild.id,
        memberId: member.id,
        memberTag: member.user.tag,
        role: role.name,
        action: "manual_add",
        by: message.author.tag,
      });
      await message.reply(`Added **${role.name}** to ${member}.`);
      await sendBotLog(guild, [
        `# Role Added`,
        `Member: ${member.user.tag} (${member.id})`,
        `Role: ${role.name}`,
        `By: ${message.author.tag}`,
      ]);
      return;
    }

    if (command === "removerole") {
      if (!canManageRoles(message.member)) {
        throw new Error("Only senior staff and above can remove roles.");
      }
      const member = await resolveMemberFromArg(guild, args[0]);
      const roleName = resolveRoleNameFromArg(guild, args[1]) || args.slice(1).join(" ");
      if (!member || !roleName) {
        throw new Error("Usage: `!removerole @user role`");
      }
      const role = await removeRoleFromMember(member, roleName);
      appendStoreRecord("roleActions", {
        guildId: guild.id,
        memberId: member.id,
        memberTag: member.user.tag,
        role: role.name,
        action: "manual_remove",
        by: message.author.tag,
      });
      await message.reply(`Removed **${role.name}** from ${member}.`);
      await sendBotLog(guild, [
        `# Role Removed`,
        `Member: ${member.user.tag} (${member.id})`,
        `Role: ${role.name}`,
        `By: ${message.author.tag}`,
      ]);
      return;
    }

    await message.reply("Unknown command. Use `!help`.");
  } catch (error) {
    console.error(error);
    const text = error instanceof Error ? error.message : "Something went wrong.";
    await message.reply(text);
  }
});

function makeInteractionContext(interaction) {
  return {
    guild: interaction.guild,
    member: interaction.member,
    author: interaction.user,
    channel: interaction.channel,
    reply: async (content) => {
      const payload = { content, ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp(payload);
      }
      return interaction.reply(payload);
    },
  };
}

client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton()) {
    if (!interaction.guildId) {
      return;
    }

    const ctx = makeInteractionContext(interaction);

    try {
      if (interaction.customId.startsWith("ticket_")) {
        const type = interaction.customId.replace("ticket_", "");
        const channel = await openTicket(ctx, type);
        await ctx.reply(`Your ticket is ready: ${channel}`);
        return;
      }

      if (interaction.customId.startsWith("apply_")) {
        const roleKey = interaction.customId.replace("apply_", "");
        await interaction.showModal(buildApplicationModal(interaction.guild, roleKey));
        return;
      }

      if (interaction.customId === "review_approve") {
        await approveApplication(ctx, null, null);
        return;
      }

      if (interaction.customId === "review_deny") {
        await denyApplication(ctx, "Denied via review button.");
        return;
      }

      if (interaction.customId === "review_waiting") {
        await markApplicationWaiting(ctx, "Staff requested more information via review button.");
        return;
      }

      if (interaction.customId === "review_close") {
        await closeTicket(ctx, "Closed via review button");
        return;
      }
    } catch (error) {
      console.error(error);
      const text = error instanceof Error ? error.message : "Something went wrong.";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: text, ephemeral: true });
      } else {
        await interaction.reply({ content: text, ephemeral: true });
      }
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    const ctx = makeInteractionContext(interaction);
    try {
      if (interaction.customId.startsWith("application_modal:")) {
        const roleKey = interaction.customId.split(":")[1];
        const form = loadApplicationFormConfig(roleKey);
        const answers = {};
        for (const field of form.fields) {
          answers[field.key] = interaction.fields.getTextInputValue(field.key);
        }
        const channel = await openApplication(ctx, roleKey, {
          ...answers,
        });
        await ctx.reply(`Your application channel is ready: ${channel}`);
      }
    } catch (error) {
      console.error(error);
      await ctx.reply(error instanceof Error ? error.message : "Something went wrong.");
    }
    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (!interaction.guildId) {
    return;
  }

  const ctx = makeInteractionContext(interaction);

  try {
    if (interaction.commandName === "help") {
      await ctx.reply(
        [
          "Slash commands:",
          "`/creator`",
          "`/ticket type:support`",
          "`/apply role:sheriffs-office`",
          "`/verify user:@member`",
          "`/unverify user:@member`",
          "`/approve`",
          "`/deny reason:...`",
          "`/warn user:@member reason:...`",
          "`/note user:@member reason:...`",
          "`/history user:@member`",
          "`/profile user:@member`",
          "`/roster target:sheriffs-office`",
          "`/discipline user:@member action:timeout duration_minutes:60 reason:...`",
          "`/case case_id:WP-0001`",
          "`/business action:list`",
          "`/business action:add name:... owner:@member license_status:licensed`",
          "`/announce channel:#announcements type:update title:... body:...`",
          "`/health`",
          "`/dashboard`",
          "`/appstatus`",
          "`/addrole user:@member role:media`",
          "`/removerole user:@member role:media`",
        ].join("\n"),
      );
      return;
    }

    if (interaction.commandName === "creator") {
      await ctx.reply("This bot was created by **Xander Evergarden ( Wicked )**.");
      return;
    }

    if (interaction.commandName === "ticket") {
      const type = interaction.options.getString("type", true);
      const channel = await openTicket(ctx, type);
      await ctx.reply(`Your ticket is ready: ${channel}`);
      return;
    }

    if (interaction.commandName === "apply") {
      const role = interaction.options.getString("role", true);
      const channel = await openApplication(ctx, role);
      await ctx.reply(`Your application channel is ready: ${channel}`);
      return;
    }

    if (interaction.commandName === "verify") {
      const user = interaction.options.getMember("user");
      if (!user) {
        throw new Error("User not found.");
      }
      await verifyMember(ctx, user);
      return;
    }

    if (interaction.commandName === "unverify") {
      const user = interaction.options.getMember("user");
      if (!user) {
        throw new Error("User not found.");
      }
      await unverifyMember(ctx, user);
      return;
    }

    if (interaction.commandName === "approve") {
      const user = interaction.options.getMember("user");
      const role = interaction.options.getString("role");
      await approveApplication(ctx, user ? `<@${user.id}>` : null, role);
      return;
    }

    if (interaction.commandName === "deny") {
      const reason = interaction.options.getString("reason") || "No reason provided.";
      await denyApplication(ctx, reason);
      return;
    }

    if (interaction.commandName === "warn") {
      if (!canHandleTickets(interaction.member)) {
        throw new Error("Only staff can issue warnings.");
      }
      const user = interaction.options.getMember("user");
      const reason = interaction.options.getString("reason", true);
      if (!user) {
        throw new Error("User not found.");
      }
      await addModerationRecord(ctx, user, "warn", reason);
      await ctx.reply(`Warning recorded for ${user}.`);
      return;
    }

    if (interaction.commandName === "note") {
      if (!canHandleTickets(interaction.member)) {
        throw new Error("Only staff can add notes.");
      }
      const user = interaction.options.getMember("user");
      const reason = interaction.options.getString("reason", true);
      if (!user) {
        throw new Error("User not found.");
      }
      await addModerationRecord(ctx, user, "note", reason);
      await ctx.reply(`Staff note recorded for ${user}.`);
      return;
    }

    if (interaction.commandName === "history") {
      if (!canHandleTickets(interaction.member)) {
        throw new Error("Only staff can view history.");
      }
      const user = interaction.options.getMember("user");
      if (!user) {
        throw new Error("User not found.");
      }
      await ctx.reply(`## History for ${user.user.tag}\n${formatMemberHistory(user.id)}`);
      return;
    }

    if (interaction.commandName === "profile") {
      if (!canHandleTickets(interaction.member)) {
        throw new Error("Only staff can view member profiles.");
      }
      const user = interaction.options.getMember("user");
      if (!user) {
        throw new Error("User not found.");
      }
      await ctx.reply(`## Profile for ${user.user.tag}\n${formatMemberProfile(user)}`);
      return;
    }

    if (interaction.commandName === "roster") {
      if (!canHandleTickets(interaction.member)) {
        throw new Error("Only staff can view rosters.");
      }
      await interaction.guild.members.fetch();
      const target = interaction.options.getString("target") || "staff";
      await ctx.reply(`## ${target.toUpperCase()} Roster\n${formatRoster(interaction.guild, target)}`);
      return;
    }

    if (interaction.commandName === "discipline") {
      if (!canHandleTickets(interaction.member)) {
        throw new Error("Only staff can add discipline records.");
      }
      const user = interaction.options.getMember("user");
      const action = interaction.options.getString("action", true);
      const durationMinutes = interaction.options.getInteger("duration_minutes");
      const reason = interaction.options.getString("reason", true);
      if (!user) {
        throw new Error("User not found.");
      }
      const caseId = await addDisciplineRecord(ctx, user, action, reason, durationMinutes);
      await ctx.reply(`Discipline recorded for ${user}. Case: ${caseId}.`);
      return;
    }

    if (interaction.commandName === "case") {
      if (!canHandleTickets(interaction.member)) {
        throw new Error("Only staff can view case records.");
      }
      const caseId = interaction.options.getString("case_id", true);
      const details = formatCaseRecord(caseId);
      if (!details) {
        throw new Error("Case not found.");
      }
      await ctx.reply(`## Case Lookup\n${details}`);
      return;
    }

    if (interaction.commandName === "business") {
      if (!canReviewApplications(interaction.member)) {
        throw new Error("Only review staff can manage the business registry.");
      }
      const action = interaction.options.getString("action", true);
      if (action === "list") {
        await ctx.reply(`## Business Registry\n${listBusinesses()}`);
        return;
      }
      if (action === "add") {
        const name = interaction.options.getString("name", true);
        const owner = interaction.options.getMember("owner");
        const licenseStatus = interaction.options.getString("license_status") || "licensed";
        if (!owner) {
          throw new Error("Owner is required for business add.");
        }
        const record = upsertBusinessRecord({
          guildId: interaction.guild.id,
          name,
          ownerId: owner.id,
          ownerTag: owner.user.tag,
          licenseStatus,
          createdBy: interaction.user.tag,
        });
        await ctx.reply(`Registered business **${record.name}** for ${owner}. Case: ${record.caseId}.`);
        await sendBotLog(interaction.guild, [
          `# Business Registered`,
          `Case: ${record.caseId}`,
          `Business: ${record.name}`,
          `Owner: ${owner.user.tag} (${owner.id})`,
          `Status: ${record.licenseStatus}`,
          `By: ${interaction.user.tag}`,
        ]);
        return;
      }
      if (action === "close") {
        const name = interaction.options.getString("name", true);
        const reason = interaction.options.getString("reason") || "No reason provided.";
        const record = closeBusinessRecord(name, interaction.user.tag, reason);
        if (!record) {
          throw new Error("Business not found or already closed.");
        }
        await ctx.reply(`Closed business **${record.name}**. Case: ${record.caseId}.`);
        await sendBotLog(interaction.guild, [
          `# Business Closed`,
          `Case: ${record.caseId}`,
          `Business: ${record.name}`,
          `Reason: ${reason}`,
          `By: ${interaction.user.tag}`,
        ]);
        return;
      }
      throw new Error("Unsupported business action.");
    }

    if (interaction.commandName === "announce") {
      const channel = interaction.options.getChannel("channel", true);
      const type = interaction.options.getString("type", true);
      const title = interaction.options.getString("title", true);
      const body = interaction.options.getString("body", true);
      const caseId = await postAnnouncement(ctx, channel, type, title, body);
      await ctx.reply(`Announcement posted in ${channel}. Case: ${caseId}.`);
      return;
    }

    if (interaction.commandName === "health") {
      if (!canUseDiagnostics(interaction.member)) {
        throw new Error("Only diagnostics-enabled staff can use health checks.");
      }
      await ctx.reply(`## Bot Health\n${buildHealthReport(interaction.guild)}`);
      return;
    }

    if (interaction.commandName === "dashboard") {
      if (!canUseDiagnostics(interaction.member)) {
        throw new Error("Only diagnostics-enabled staff can use dashboard summaries.");
      }
      await ctx.reply(`## Staff Dashboard\n${buildDashboardReport()}`);
      return;
    }

    if (interaction.commandName === "appstatus") {
      const status = interaction.options.getString("status", true);
      const note = interaction.options.getString("note") || "Waiting on applicant response.";
      if (status !== "waiting") {
        throw new Error("Only `waiting` is supported right now.");
      }
      await markApplicationWaiting(ctx, note);
      return;
    }

    if (interaction.commandName === "addrole") {
      if (!canManageRoles(interaction.member)) {
        throw new Error("Only senior staff and above can add roles.");
      }
      const user = interaction.options.getMember("user");
      const roleName = interaction.options.getString("role", true);
      if (!user) {
        throw new Error("User not found.");
      }
      const role = await applyRoleToMember(user, resolveRoleNameFromArg(interaction.guild, roleName) || roleName);
      appendStoreRecord("roleActions", {
        guildId: interaction.guild.id,
        memberId: user.id,
        memberTag: user.user.tag,
        role: role.name,
        action: "manual_add",
        by: interaction.user.tag,
      });
      await ctx.reply(`Added **${role.name}** to ${user}.`);
      await sendBotLog(interaction.guild, [
        `# Role Added`,
        `Member: ${user.user.tag} (${user.id})`,
        `Role: ${role.name}`,
        `By: ${interaction.user.tag}`,
      ]);
      return;
    }

    if (interaction.commandName === "removerole") {
      if (!canManageRoles(interaction.member)) {
        throw new Error("Only senior staff and above can remove roles.");
      }
      const user = interaction.options.getMember("user");
      const roleName = interaction.options.getString("role", true);
      if (!user) {
        throw new Error("User not found.");
      }
      const role = await removeRoleFromMember(user, resolveRoleNameFromArg(interaction.guild, roleName) || roleName);
      appendStoreRecord("roleActions", {
        guildId: interaction.guild.id,
        memberId: user.id,
        memberTag: user.user.tag,
        role: role.name,
        action: "manual_remove",
        by: interaction.user.tag,
      });
      await ctx.reply(`Removed **${role.name}** from ${user}.`);
      await sendBotLog(interaction.guild, [
        `# Role Removed`,
        `Member: ${user.user.tag} (${user.id})`,
        `Role: ${role.name}`,
        `By: ${interaction.user.tag}`,
      ]);
    }
  } catch (error) {
    console.error(error);
    const text = error instanceof Error ? error.message : "Something went wrong.";
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: text, ephemeral: true });
    } else {
      await interaction.reply({ content: text, ephemeral: true });
    }
  }
});

client.login(token);
