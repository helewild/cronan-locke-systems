require("dotenv").config();

const {
  ChannelType,
  Client,
  Colors,
  GatewayIntentBits,
  PermissionFlagsBits,
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_TOKEN or GUILD_ID in .env");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const ROLE_DEFS = [
  {
    name: "Founder",
    color: Colors.Gold,
    permissions: [PermissionFlagsBits.Administrator],
    hoist: true,
  },
  {
    name: "Admin",
    color: Colors.Red,
    permissions: [PermissionFlagsBits.Administrator],
    hoist: true,
  },
  {
    name: "Senior Staff",
    color: Colors.DarkRed,
    permissions: [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ViewAuditLog,
      PermissionFlagsBits.MoveMembers,
      PermissionFlagsBits.DeafenMembers,
      PermissionFlagsBits.MuteMembers,
    ],
    hoist: true,
  },
  {
    name: "Moderator",
    color: Colors.Orange,
    permissions: [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ViewAuditLog,
      PermissionFlagsBits.MoveMembers,
      PermissionFlagsBits.MuteMembers,
      PermissionFlagsBits.DeafenMembers,
    ],
    hoist: true,
  },
  {
    name: "Developer",
    color: Colors.DarkAqua,
    permissions: [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageWebhooks,
      PermissionFlagsBits.ViewAuditLog,
      PermissionFlagsBits.ManageMessages,
    ],
    hoist: true,
  },
  {
    name: "Verified",
    color: Colors.Green,
    permissions: [],
    hoist: true,
  },
  {
    name: "Citizen",
    color: Colors.Blue,
    permissions: [],
    hoist: false,
  },
  {
    name: "Business Owner",
    color: Colors.Yellow,
    permissions: [],
    hoist: false,
  },
  {
    name: "LSPD",
    color: Colors.DarkBlue,
    permissions: [],
    hoist: false,
  },
  {
    name: "BCSO",
    color: Colors.Navy,
    permissions: [],
    hoist: false,
  },
  {
    name: "SAFR / EMS",
    color: Colors.DarkOrange,
    permissions: [],
    hoist: false,
  },
  {
    name: "DOJ",
    color: Colors.Purple,
    permissions: [],
    hoist: false,
  },
  {
    name: "Media",
    color: Colors.LuminousVividPink,
    permissions: [],
    hoist: false,
  },
  {
    name: "Unverified",
    color: Colors.Grey,
    permissions: [],
    hoist: false,
  },
];

function overwrite(id, allow = [], deny = []) {
  return { id, allow, deny };
}

async function upsertRole(guild, definition) {
  const existing = guild.roles.cache.find((role) => role.name === definition.name);
  if (existing) {
    await existing.edit({
      color: definition.color,
      hoist: definition.hoist,
      permissions: definition.permissions,
      mentionable: false,
    });
    return existing;
  }

  return guild.roles.create({
    name: definition.name,
    color: definition.color,
    hoist: definition.hoist,
    permissions: definition.permissions,
    mentionable: false,
    reason: "Provision Whispering Pines role layout",
  });
}

async function upsertCategory(guild, name, permissionOverwrites) {
  const existing = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildCategory && channel.name === name,
  );

  if (existing) {
    await existing.edit({ permissionOverwrites });
    return existing;
  }

  return guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    permissionOverwrites,
  });
}

async function upsertTextChannel(guild, category, name, topic, permissionOverwrites) {
  const existing = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.parentId === category.id &&
      channel.name === name,
  );

  if (existing) {
    await existing.edit({
      topic,
      parent: category.id,
      permissionOverwrites,
    });
    return existing;
  }

  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    topic,
    parent: category.id,
    permissionOverwrites,
  });
}

async function upsertVoiceChannel(guild, category, name, permissionOverwrites, userLimit = 0) {
  const existing = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildVoice &&
      channel.parentId === category.id &&
      channel.name === name,
  );

  if (existing) {
    await existing.edit({
      parent: category.id,
      permissionOverwrites,
      userLimit,
    });
    return existing;
  }

  return guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: category.id,
    permissionOverwrites,
    userLimit,
  });
}

function publicStaffRoles(roleMap) {
  return [
    roleMap.Founder,
    roleMap.Admin,
    roleMap["Senior Staff"],
    roleMap.Moderator,
    roleMap.Developer,
  ];
}

function buildVerifiedViewOverwrites(guild, roleMap, extras = []) {
  const everyone = guild.roles.everyone.id;
  const verified = roleMap.Verified.id;
  const staff = publicStaffRoles(roleMap).map((role) => role.id);

  return [
    overwrite(everyone, [], [PermissionFlagsBits.ViewChannel]),
    overwrite(verified, [PermissionFlagsBits.ViewChannel]),
    ...staff.map((id) => overwrite(id, [PermissionFlagsBits.ViewChannel])),
    ...extras,
  ];
}

client.once("ready", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.channels.fetch();
    await guild.roles.fetch();

    const roleMap = {};
    for (const definition of ROLE_DEFS) {
      roleMap[definition.name] = await upsertRole(guild, definition);
    }

    const everyone = guild.roles.everyone.id;
    const staffRoleIds = publicStaffRoles(roleMap).map((role) => role.id);
    const verifiedView = buildVerifiedViewOverwrites(guild, roleMap);

    const startHereOverwrites = [
      overwrite(everyone, [PermissionFlagsBits.ViewChannel]),
      ...staffRoleIds.map((id) => overwrite(id, [PermissionFlagsBits.ViewChannel])),
    ];

    const startHere = await upsertCategory(guild, "START HERE", startHereOverwrites);
    await upsertTextChannel(
      guild,
      startHere,
      "welcome",
      "Arrival point for new members.",
      [
        ...startHereOverwrites,
        overwrite(everyone, [PermissionFlagsBits.ReadMessageHistory], [PermissionFlagsBits.SendMessages]),
      ],
    );
    await upsertTextChannel(
      guild,
      startHere,
      "rules-and-guidelines",
      "Server rules, RP standards, and expected behavior.",
      [
        ...startHereOverwrites,
        overwrite(everyone, [PermissionFlagsBits.ReadMessageHistory], [PermissionFlagsBits.SendMessages]),
      ],
    );
    await upsertTextChannel(
      guild,
      startHere,
      "verify-and-roles",
      "How to get verified and request faction roles.",
      [
        ...startHereOverwrites,
        overwrite(everyone, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
      ],
    );
    await upsertTextChannel(
      guild,
      startHere,
      "support-desk",
      "Questions, technical help, and onboarding issues.",
      [
        ...startHereOverwrites,
        overwrite(everyone, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
      ],
    );

    const serverInfo = await upsertCategory(guild, "WHISPERING PINES", verifiedView);
    await upsertTextChannel(
      guild,
      serverInfo,
      "announcements",
      "Official server announcements and news.",
      [
        ...verifiedView,
        overwrite(roleMap.Verified.id, [PermissionFlagsBits.ReadMessageHistory], [PermissionFlagsBits.SendMessages]),
      ],
    );
    await upsertTextChannel(
      guild,
      serverInfo,
      "server-lore",
      "Lore, setting, and city background.",
      [
        ...verifiedView,
        overwrite(roleMap.Verified.id, [PermissionFlagsBits.ReadMessageHistory], [PermissionFlagsBits.SendMessages]),
      ],
    );
    await upsertTextChannel(
      guild,
      serverInfo,
      "rp-guides",
      "Character creation, gameplay guides, and economy references.",
      [
        ...verifiedView,
        overwrite(roleMap.Verified.id, [PermissionFlagsBits.ReadMessageHistory], [PermissionFlagsBits.SendMessages]),
      ],
    );
    await upsertTextChannel(
      guild,
      serverInfo,
      "city-hall",
      "Public notices, government bulletins, and city updates.",
      [
        ...verifiedView,
        overwrite(roleMap.Verified.id, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
      ],
    );

    const community = await upsertCategory(guild, "COMMUNITY", verifiedView);
    await upsertTextChannel(
      guild,
      community,
      "general-chat",
      "Main OOC community chat for verified members.",
      [
        ...verifiedView,
        overwrite(roleMap.Verified.id, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
      ],
    );
    await upsertTextChannel(
      guild,
      community,
      "looking-for-rp",
      "Find scenes, storylines, and RP partners.",
      [
        ...verifiedView,
        overwrite(roleMap.Verified.id, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
      ],
    );
    await upsertTextChannel(
      guild,
      community,
      "media-share",
      "Screenshots, clips, edits, and event photos.",
      [
        ...verifiedView,
        overwrite(roleMap.Verified.id, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory]),
      ],
    );
    await upsertTextChannel(
      guild,
      community,
      "suggestions",
      "Suggestions and feedback for improving the server.",
      [
        ...verifiedView,
        overwrite(roleMap.Verified.id, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
      ],
    );

    const economyExtras = [
      overwrite(roleMap["Business Owner"].id, [PermissionFlagsBits.ViewChannel]),
    ];
    const economy = await upsertCategory(
      guild,
      "ECONOMY & BUSINESS",
      buildVerifiedViewOverwrites(guild, roleMap, economyExtras),
    );
    await upsertTextChannel(
      guild,
      economy,
      "business-hub",
      "Business owner networking, requests, and operational chatter.",
      buildVerifiedViewOverwrites(guild, roleMap, [
        overwrite(roleMap["Business Owner"].id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
      ]),
    );
    await upsertTextChannel(
      guild,
      economy,
      "marketplace",
      "Buy, sell, hire, and advertise in-character services.",
      [
        ...buildVerifiedViewOverwrites(guild, roleMap),
        overwrite(roleMap.Verified.id, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
      ],
    );
    await upsertTextChannel(
      guild,
      economy,
      "whispering-pines-bank",
      "Banking notices, loan updates, and economy information.",
      [
        ...buildVerifiedViewOverwrites(guild, roleMap),
        overwrite(roleMap.Verified.id, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
      ],
    );

    const leoVisible = buildVerifiedViewOverwrites(guild, roleMap, [
      overwrite(roleMap.LSPD.id, [PermissionFlagsBits.ViewChannel]),
      overwrite(roleMap.BCSO.id, [PermissionFlagsBits.ViewChannel]),
    ]);
    const law = await upsertCategory(guild, "LAW ENFORCEMENT", leoVisible);
    await upsertTextChannel(
      guild,
      law,
      "leo-briefings",
      "Private law enforcement coordination and notices.",
      [
        overwrite(everyone, [], [PermissionFlagsBits.ViewChannel]),
        overwrite(roleMap.LSPD.id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
        overwrite(roleMap.BCSO.id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
        ...staffRoleIds.map((id) => overwrite(id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])),
      ],
    );
    await upsertVoiceChannel(
      guild,
      law,
      "LEO Ops",
      [
        overwrite(everyone, [], [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]),
        overwrite(roleMap.LSPD.id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]),
        overwrite(roleMap.BCSO.id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]),
        ...staffRoleIds.map((id) => overwrite(id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])),
      ],
    );

    const emsCategory = await upsertCategory(
      guild,
      "EMS & FIRE",
      buildVerifiedViewOverwrites(guild, roleMap, [
        overwrite(roleMap["SAFR / EMS"].id, [PermissionFlagsBits.ViewChannel]),
      ]),
    );
    await upsertTextChannel(
      guild,
      emsCategory,
      "ems-briefings",
      "Private EMS and fire coordination.",
      [
        overwrite(everyone, [], [PermissionFlagsBits.ViewChannel]),
        overwrite(roleMap["SAFR / EMS"].id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
        ...staffRoleIds.map((id) => overwrite(id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])),
      ],
    );
    await upsertVoiceChannel(
      guild,
      emsCategory,
      "EMS Ops",
      [
        overwrite(everyone, [], [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]),
        overwrite(roleMap["SAFR / EMS"].id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]),
        ...staffRoleIds.map((id) => overwrite(id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])),
      ],
    );

    const dojCategory = await upsertCategory(
      guild,
      "DOJ & GOVERNMENT",
      buildVerifiedViewOverwrites(guild, roleMap, [
        overwrite(roleMap.DOJ.id, [PermissionFlagsBits.ViewChannel]),
      ]),
    );
    await upsertTextChannel(
      guild,
      dojCategory,
      "court-chambers",
      "Private court scheduling and DOJ coordination.",
      [
        overwrite(everyone, [], [PermissionFlagsBits.ViewChannel]),
        overwrite(roleMap.DOJ.id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
        ...staffRoleIds.map((id) => overwrite(id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])),
      ],
    );

    const mediaCategory = await upsertCategory(
      guild,
      "MEDIA",
      buildVerifiedViewOverwrites(guild, roleMap, [
        overwrite(roleMap.Media.id, [PermissionFlagsBits.ViewChannel]),
      ]),
    );
    await upsertTextChannel(
      guild,
      mediaCategory,
      "press-room",
      "Interviews, event coverage, and publication planning.",
      [
        ...buildVerifiedViewOverwrites(guild, roleMap),
        overwrite(roleMap.Media.id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory]),
        overwrite(roleMap.Verified.id, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
      ],
    );

    const supportCategory = await upsertCategory(guild, "SUPPORT", verifiedView);
    await upsertTextChannel(
      guild,
      supportCategory,
      "tickets-and-reports",
      "Player reports, appeal requests, and staff contact.",
      [
        ...verifiedView,
        overwrite(roleMap.Verified.id, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
      ],
    );

    const staffOnly = [
      overwrite(everyone, [], [PermissionFlagsBits.ViewChannel]),
      ...staffRoleIds.map((id) => overwrite(id, [PermissionFlagsBits.ViewChannel])),
    ];
    const staff = await upsertCategory(guild, "STAFF", staffOnly);
    await upsertTextChannel(
      guild,
      staff,
      "staff-chat",
      "Private staff discussion and case handling.",
      [
        ...staffOnly,
        ...staffRoleIds.map((id) => overwrite(id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory])),
      ],
    );
    await upsertTextChannel(
      guild,
      staff,
      "staff-announcements",
      "Internal staff notices and policy changes.",
      [
        ...staffOnly,
        overwrite(roleMap.Founder.id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
        overwrite(roleMap.Admin.id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
        overwrite(roleMap["Senior Staff"].id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]),
        overwrite(roleMap.Moderator.id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], [PermissionFlagsBits.SendMessages]),
        overwrite(roleMap.Developer.id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], [PermissionFlagsBits.SendMessages]),
      ],
    );
    await upsertVoiceChannel(
      guild,
      staff,
      "Staff Voice",
      [
        ...staffOnly,
        ...staffRoleIds.map((id) => overwrite(id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])),
      ],
    );

    const voiceCategory = await upsertCategory(guild, "VOICE", verifiedView);
    await upsertVoiceChannel(
      guild,
      voiceCategory,
      "Waiting Room",
      [
        ...verifiedView,
        overwrite(roleMap.Verified.id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]),
      ],
    );
    await upsertVoiceChannel(
      guild,
      voiceCategory,
      "Civilian RP 1",
      [
        ...verifiedView,
        overwrite(roleMap.Verified.id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]),
      ],
      10,
    );
    await upsertVoiceChannel(
      guild,
      voiceCategory,
      "Civilian RP 2",
      [
        ...verifiedView,
        overwrite(roleMap.Verified.id, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]),
      ],
      10,
    );

    console.log("Whispering Pines provisioning complete.");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token);
