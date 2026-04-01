require("dotenv").config();

const https = require("https");

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_TOKEN or GUILD_ID in .env");
  process.exit(1);
}

function api(method, route, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: "discord.com",
        path: `/api/v10${route}`,
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
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            return;
          }
          resolve(data ? JSON.parse(data) : null);
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

async function pinMatchingMessage(channelId, matcher) {
  const messages = await api("GET", `/channels/${channelId}/messages?limit=50`);
  const match = messages.find((message) => matcher(message.content || ""));
  if (!match) {
    return false;
  }
  await api("PUT", `/channels/${channelId}/pins/${match.id}`);
  return true;
}

async function main() {
  const channels = await api("GET", `/guilds/${guildId}/channels`);
  const targets = [
    { name: "welcome", matcher: (content) => content.includes("# Welcome to Whispering Pines") },
    { name: "rules-and-guidelines", matcher: (content) => content.includes("# Whispering Pines Rules & Guidelines") },
    { name: "verify-and-roles", matcher: (content) => content.includes("# Verify & Role Requests") || content.includes("# Application Panel") },
    { name: "support-desk", matcher: (content) => content.includes("# Support Desk") || content.includes("# Support Panel") },
    { name: "server-lore", matcher: (content) => content.includes("# Whispering Pines: Server Lore") },
    { name: "rp-guides", matcher: (content) => content.includes("# Roleplay Starter Guide") },
  ];

  for (const target of targets) {
    const channel = channels.find((entry) => entry.name === target.name);
    if (!channel) {
      console.log(`Missing channel: ${target.name}`);
      continue;
    }
    const pinned = await pinMatchingMessage(channel.id, target.matcher);
    console.log(`${target.name}: ${pinned ? "pinned" : "not found"}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
