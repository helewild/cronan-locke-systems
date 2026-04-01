require("dotenv").config();

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const applicationId = "1488118646659088474";

if (!token) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

const roleChoices = [
  { name: "citizen", value: "citizen" },
  { name: "business-owner", value: "business-owner" },
  { name: "sheriffs-office", value: "sheriffs-office" },
  { name: "bcso", value: "bcso" },
  { name: "medical", value: "medical" },
  { name: "fire-department", value: "fire-department" },
  { name: "doj", value: "doj" },
  { name: "media", value: "media" },
  { name: "events-team", value: "events-team" },
  { name: "real-estate", value: "real-estate" },
  { name: "management", value: "management" },
];

const commands = [
  new SlashCommandBuilder()
    .setName("creator")
    .setDescription("Show who created this bot."),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show available bot commands."),
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Open a private ticket.")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("The kind of ticket to open.")
        .setRequired(true)
        .addChoices(
          { name: "support", value: "support" },
          { name: "report", value: "report" },
          { name: "appeal", value: "appeal" },
        ),
    ),
  new SlashCommandBuilder()
    .setName("apply")
    .setDescription("Open a private application channel.")
    .addStringOption((option) =>
      option
        .setName("role")
        .setDescription("Which role you want to apply for.")
        .setRequired(true)
        .addChoices(...roleChoices),
    ),
  new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Give a user the Verified role.")
    .addUserOption((option) => option.setName("user").setDescription("The user to verify.").setRequired(true)),
  new SlashCommandBuilder()
    .setName("unverify")
    .setDescription("Remove the Verified role from a user.")
    .addUserOption((option) => option.setName("user").setDescription("The user to unverify.").setRequired(true)),
  new SlashCommandBuilder()
    .setName("approve")
    .setDescription("Approve an application.")
    .addUserOption((option) => option.setName("user").setDescription("Optional user override.").setRequired(false))
    .addStringOption((option) =>
      option
        .setName("role")
        .setDescription("Optional role override.")
        .setRequired(false)
        .addChoices(...roleChoices),
    ),
  new SlashCommandBuilder()
    .setName("deny")
    .setDescription("Deny an application.")
    .addStringOption((option) => option.setName("reason").setDescription("Reason for denial.").setRequired(false)),
  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add a role to a user.")
    .addUserOption((option) => option.setName("user").setDescription("The target user.").setRequired(true))
    .addStringOption((option) =>
      option
        .setName("role")
        .setDescription("The role to add.")
        .setRequired(true)
        .addChoices(...roleChoices, { name: "verified", value: "verified" }),
    ),
  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove a role from a user.")
    .addUserOption((option) => option.setName("user").setDescription("The target user.").setRequired(true))
    .addStringOption((option) =>
      option
        .setName("role")
        .setDescription("The role to remove.")
        .setRequired(true)
        .addChoices(...roleChoices, { name: "verified", value: "verified" }),
    ),
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Record a warning for a member.")
    .addUserOption((option) => option.setName("user").setDescription("The target user.").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Warning reason.").setRequired(true)),
  new SlashCommandBuilder()
    .setName("note")
    .setDescription("Record a private staff note for a member.")
    .addUserOption((option) => option.setName("user").setDescription("The target user.").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Staff note.").setRequired(true)),
  new SlashCommandBuilder()
    .setName("history")
    .setDescription("Show recent moderation/application history for a member.")
    .addUserOption((option) => option.setName("user").setDescription("The target user.").setRequired(true)),
  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Show a full staff profile for a member.")
    .addUserOption((option) => option.setName("user").setDescription("The target user.").setRequired(true)),
  new SlashCommandBuilder()
    .setName("roster")
    .setDescription("Show a faction or staff roster.")
    .addStringOption((option) =>
      option
        .setName("target")
        .setDescription("Which roster to show.")
        .setRequired(false)
        .addChoices(
          { name: "staff", value: "staff" },
          { name: "sheriffs-office", value: "sheriffs-office" },
          { name: "bcso", value: "bcso" },
          { name: "medical", value: "medical" },
          { name: "fire-department", value: "fire-department" },
          { name: "doj", value: "doj" },
          { name: "media", value: "media" },
          { name: "events-team", value: "events-team" },
          { name: "real-estate", value: "real-estate" },
          { name: "management", value: "management" },
          { name: "business", value: "business" },
        ),
    ),
  new SlashCommandBuilder()
    .setName("discipline")
    .setDescription("Record a punishment or staff discipline action.")
    .addUserOption((option) => option.setName("user").setDescription("The target user.").setRequired(true))
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("Discipline action.")
        .setRequired(true)
        .addChoices(
          { name: "timeout", value: "timeout" },
          { name: "suspend", value: "suspend" },
          { name: "banrecord", value: "banrecord" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the action.")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("duration_minutes")
        .setDescription("Timeout length in minutes if using timeout.")
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("case")
    .setDescription("Look up a stored case by case ID.")
    .addStringOption((option) =>
      option
        .setName("case_id")
        .setDescription("Case ID like WP-0001.")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("business")
    .setDescription("Manage the business registry.")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("What to do with the registry.")
        .setRequired(true)
        .addChoices(
          { name: "list", value: "list" },
          { name: "add", value: "add" },
          { name: "close", value: "close" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Business name.")
        .setRequired(false),
    )
    .addUserOption((option) =>
      option
        .setName("owner")
        .setDescription("Business owner for add.")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("license_status")
        .setDescription("License status for add.")
        .setRequired(false)
        .addChoices(
          { name: "licensed", value: "licensed" },
          { name: "pending", value: "pending" },
          { name: "suspended", value: "suspended" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason when closing a business.")
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Post a formatted announcement.")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Where to post the announcement.")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Announcement type.")
        .setRequired(true)
        .addChoices(
          { name: "update", value: "update" },
          { name: "event", value: "event" },
          { name: "alert", value: "alert" },
          { name: "maintenance", value: "maintenance" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("Announcement title.")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("body")
        .setDescription("Announcement body.")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("health")
    .setDescription("Show bot/server health checks for staff."),
  new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Show a staff dashboard summary."),
  new SlashCommandBuilder()
    .setName("appstatus")
    .setDescription("Update the status of the current application channel.")
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("The status to set.")
        .setRequired(true)
        .addChoices({ name: "waiting", value: "waiting" }),
    )
    .addStringOption((option) =>
      option
        .setName("note")
        .setDescription("Optional note to send to the applicant.")
        .setRequired(false),
    ),
].map((command) => command.toJSON());

async function registerCommandsForGuilds() {
  const rest = new REST({ version: "10" }).setToken(token);
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  await client.login(token);
  await new Promise((resolve) => client.once("ready", resolve));
  await client.guilds.fetch();

  const guilds = [...client.guilds.cache.values()];
  if (guilds.length === 0) {
    throw new Error("The bot is not in any guilds yet. Invite it to a server first.");
  }

  for (const guild of guilds) {
    await rest.put(Routes.applicationGuildCommands(applicationId, guild.id), {
      body: commands,
    });
    console.log(`Registered guild slash commands for ${guild.name} (${guild.id}).`);
  }

  await client.destroy();
}

registerCommandsForGuilds().catch((error) => {
  console.error(error);
  process.exit(1);
});
