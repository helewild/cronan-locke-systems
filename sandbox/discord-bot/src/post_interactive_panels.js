require("dotenv").config();

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes } = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_TOKEN or GUILD_ID in .env");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

function memberButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_support").setLabel("Open Support Ticket").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ticket_report").setLabel("Open Report Ticket").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("ticket_appeal").setLabel("Open Appeal Ticket").setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function applicationButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("apply_citizen").setLabel("Citizen").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("apply_business-owner").setLabel("Business Owner").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("apply_sheriffs-office").setLabel("Sheriff's Office").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("apply_bcso").setLabel("BCSO").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("apply_medical").setLabel("Medical").setStyle(ButtonStyle.Success),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("apply_fire-department").setLabel("Fire Depo").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("apply_doj").setLabel("DOJ").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("apply_media").setLabel("Media").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("apply_events-team").setLabel("Events Team").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("apply_real-estate").setLabel("Real Estate").setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("apply_management").setLabel("Management").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("apply_business").setLabel("Business Access").setStyle(ButtonStyle.Secondary),
    ),
  ];
}

(async () => {
  const channels = await rest.get(Routes.guildChannels(guildId));
  const supportDesk = channels.find((channel) => channel.name === "support-desk");
  const verifyChannel = channels.find((channel) => channel.name === "verify-and-roles");

  async function upsertPanel(channelId, marker, body) {
    const messages = await rest.get(`${Routes.channelMessages(channelId)}?limit=20`);
    const existing = messages.find((message) => message.author?.id === "1488118646659088474" && typeof message.content === "string" && message.content.startsWith(marker));
    if (existing) {
      await rest.patch(Routes.channelMessage(channelId, existing.id), { body });
      return;
    }
    await rest.post(Routes.channelMessages(channelId), { body });
  }

  if (supportDesk) {
    await upsertPanel(supportDesk.id, "# Support Panel", {
        content: [
          "# Support Panel",
          "",
          "Use the buttons below to open the kind of private ticket you need.",
          "",
          "- Support: help, questions, setup issues",
          "- Report: behavior issues or incidents that need staff review",
          "- Appeal: punishment or decision review requests",
        ].join("\n"),
        components: memberButtons().map((row) => row.toJSON()),
      });
  }

  if (verifyChannel) {
    await upsertPanel(verifyChannel.id, "# Application Panel", {
        content: [
          "# Application Panel",
          "",
          "Use the buttons below to open a private application channel for the role or path you need.",
          "",
          "Staff will review your application in a private thread with you.",
        ].join("\n"),
        components: applicationButtons().map((row) => row.toJSON()),
      });
  }

  console.log("Interactive panels posted.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
