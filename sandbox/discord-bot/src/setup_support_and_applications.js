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

async function main() {
  const channels = await apiRequest("GET", `/guilds/${guildId}/channels`);
  const byName = new Map(channels.map((channel) => [channel.name, channel.id]));

  const supportDesk = byName.get("support-desk");
  const verifyChannel = byName.get("verify-and-roles");

  if (supportDesk) {
    await apiRequest("POST", `/channels/${supportDesk}/messages`, {
      content: [
        "## Fast Private Help",
        "",
        "If your issue should be handled privately, open a ticket with one of these commands:",
        "- `!ticket open support`",
        "- `!ticket open report`",
        "- `!ticket open appeal`",
        "",
        "A private channel will be created for you and staff.",
      ].join("\n"),
    });
  }

  if (verifyChannel) {
    await apiRequest("POST", `/channels/${verifyChannel}/messages`, {
      content: [
        "## Private Applications",
        "",
        "If you are requesting a department or role that needs review, use one of these commands:",
        "- `!apply citizen`",
        "- `!apply business-owner`",
        "- `!apply lspd`",
        "- `!apply bcso`",
        "- `!apply ems`",
        "- `!apply doj`",
        "- `!apply media`",
        "",
        "The bot will open a private application channel for you and staff.",
      ].join("\n"),
    });
  }

  console.log("Support/application setup messages posted.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
