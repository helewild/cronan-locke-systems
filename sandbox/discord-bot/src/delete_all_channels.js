require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_TOKEN or GUILD_ID in .env");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    const channels = await guild.channels.fetch();
    const deletable = channels.filter((channel) => channel && channel.deletable);

    console.log(`Deleting ${deletable.size} channels from ${guild.name}...`);

    for (const channel of deletable.values()) {
      try {
        console.log(`Deleting: ${channel.name} (${channel.id})`);
        await channel.delete("User requested full channel wipe");
      } catch (error) {
        console.error(`Failed to delete ${channel.name}:`, error.message);
      }
    }

    console.log("Done.");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token);
