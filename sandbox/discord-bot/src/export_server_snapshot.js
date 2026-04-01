require("dotenv").config();

const fs = require("fs");
const path = require("path");
const https = require("https");

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_TOKEN or GUILD_ID in .env");
  process.exit(1);
}

function api(method, route) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "discord.com",
        path: `/api/v10${route}`,
        method,
        headers: {
          Authorization: `Bot ${token}`,
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
    req.end();
  });
}

async function main() {
  const backupDir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const guild = await api("GET", `/guilds/${guildId}`);
  const roles = await api("GET", `/guilds/${guildId}/roles`);
  const channels = await api("GET", `/guilds/${guildId}/channels`);

  const textChannels = channels.filter((channel) => channel.type === 0);
  const messages = {};

  for (const channel of textChannels) {
    try {
      messages[channel.name] = await api("GET", `/channels/${channel.id}/messages?limit=25`);
    } catch (error) {
      messages[channel.name] = { error: error.message };
    }
  }

  const snapshot = {
    exportedAt: new Date().toISOString(),
    guild,
    roles,
    channels,
    messages,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(backupDir, `discord_snapshot_${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(outPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
