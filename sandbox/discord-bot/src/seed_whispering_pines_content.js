require("dotenv").config();

const https = require("https");

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_TOKEN or GUILD_ID in .env");
  process.exit(1);
}

function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: "discord.com",
        path: `/api/v10${path}`,
        method,
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          const parsed = data ? JSON.parse(data) : null;
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            return;
          }
          resolve(parsed);
        });
      },
    );
    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function fetchChannelMap() {
  const channels = await apiRequest("GET", `/guilds/${guildId}/channels`);
  const map = new Map();
  for (const channel of channels) {
    map.set(channel.name, channel.id);
  }
  return map;
}

async function postMessages(channelId, messages) {
  for (const content of messages) {
    await apiRequest("POST", `/channels/${channelId}/messages`, { content });
  }
}

async function main() {
  const channelMap = await fetchChannelMap();

  const seeds = [
    {
      channel: "welcome",
      messages: [
        [
          "# Welcome to Whispering Pines",
          "",
          "Whispering Pines is a serious, story-driven RP community built around small-town pressure, personal stakes, and long-form character stories.",
          "",
          "If you are new here, your path is simple:",
          "- Read `#rules-and-guidelines`",
          "- Read `#server-lore`",
          "- Go to `#verify-and-roles` to request access",
          "- Use `#support-desk` if you need help",
          "",
          "Once you are verified, the rest of the server will open up to you.",
        ].join("\n"),
      ],
    },
    {
      channel: "announcements",
      messages: [
        [
          "# Announcements",
          "",
          "This channel is for official Whispering Pines updates.",
          "",
          "Expect posts here for:",
          "- server openings and major updates",
          "- event announcements",
          "- rules or policy changes",
          "- faction openings",
          "- economy or system changes",
          "",
          "Members should treat this as a read-first channel whenever something changes.",
        ].join("\n"),
      ],
    },
    {
      channel: "rp-guides",
      messages: [
        [
          "# Roleplay Starter Guide",
          "",
          "Whispering Pines works best when characters feel grounded, motivated, and connected to the setting.",
          "",
          "## Building a Good Character",
          "- Give them a believable name, background, and reason to be in town",
          "- Decide what they want: money, safety, status, revenge, power, redemption, stability, or influence",
          "- Give them weaknesses. Strong characters are more interesting when they can fail",
          "- Let their actions have consequences that carry forward",
          "",
          "## Good Starting Character Types",
          "- new resident trying to build a life",
          "- business owner or employee",
          "- public servant",
          "- ex-con trying to stay clean",
          "- career criminal chasing opportunity",
          "- outsider hiding from their past",
        ].join("\n"),
        [
          "## Good RP Habits",
          "- Build scenes instead of rushing outcomes",
          "- Give other players room to respond",
          "- Treat the town like it remembers what happened",
          "- Use reputation, money, law, and relationships as story pressure",
          "",
          "## If You Are New",
          "Start small. Meet people, find work, make contacts, and let your story grow naturally. The best long-term RP usually starts with simple scenes that become personal over time.",
          "",
          "If you need help shaping a character concept, ask in `#support-desk` or `#looking-for-rp`.",
        ].join("\n"),
      ],
    },
    {
      channel: "city-hall",
      messages: [
        [
          "# City Hall",
          "",
          "This is the public civic board for Whispering Pines.",
          "",
          "Use this channel for in-character government notices, civic announcements, town policy updates, and public service information.",
          "",
          "Examples of what belongs here:",
          "- elections or appointments",
          "- public hearings",
          "- municipal notices",
          "- zoning or business license updates",
          "- city-led events",
          "",
          "Keep posts relevant to the public-facing life of the town.",
        ].join("\n"),
      ],
    },
    {
      channel: "marketplace",
      messages: [
        [
          "# Marketplace",
          "",
          "This is the in-character commerce board for Whispering Pines.",
          "",
          "Post here for:",
          "- business ads",
          "- job offers",
          "- service offers",
          "- property leads",
          "- buying and selling opportunities",
          "",
          "Keep listings clear and readable. If you are posting as a business, stay consistent with your character or company identity.",
        ].join("\n"),
      ],
    },
    {
      channel: "whispering-pines-bank",
      messages: [
        [
          "# Whispering Pines Bank",
          "",
          "This channel is the public banking and finance notice board for the server.",
          "",
          "Use it for:",
          "- bank-related announcements",
          "- business financing notices",
          "- public loan or credit updates",
          "- branch or service information",
          "- economy-facing staff messages",
          "",
          "For private account or character-specific issues, use the proper in-game RP flow or staff support process instead of posting sensitive details publicly.",
        ].join("\n"),
      ],
    },
    {
      channel: "looking-for-rp",
      messages: [
        [
          "# Looking For RP",
          "",
          "Use this channel to find scenes, story partners, business opportunities, faction contact, and spontaneous RP.",
          "",
          "A good LFR post includes:",
          "- your character name",
          "- what kind of scene you want",
          "- your current role or situation",
          "- whether the tone is casual, tense, criminal, civic, or business-focused",
          "",
          "Example:",
          "`Character: Rowan Mercer | Looking for business, political, or debt-related RP tonight.`",
        ].join("\n"),
      ],
    },
    {
      channel: "general-chat",
      messages: [
        [
          "# General Chat",
          "",
          "This is the main out-of-character community chat for verified members.",
          "",
          "Use it to talk, ask quick questions, and connect with the community. Keep it respectful, avoid derailing into staff issues, and move support or verification questions to the proper channels when needed.",
        ].join("\n"),
      ],
    },
  ];

  for (const seed of seeds) {
    const channelId = channelMap.get(seed.channel);
    if (!channelId) {
      console.log(`Skipping missing channel: ${seed.channel}`);
      continue;
    }
    console.log(`Seeding #${seed.channel}`);
    await postMessages(channelId, seed.messages);
  }

  console.log("Whispering Pines content seeding complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
