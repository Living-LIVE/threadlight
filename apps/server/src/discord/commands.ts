import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

export const THREADLIGHT_COMMAND_NAME = "threadlight";
export const PRAY_COMMAND_NAME = "pray";
export const THREADLIGHT_MODE_COMMAND_NAME = "threadlight-mode";
export const ASK_THREADLIGHT_CONTEXT_NAME = "Ask Threadlight";
export const THREADLIGHT_DISCORD_PERMISSIONS = 274_877_991_936;

export const threadlightCommand = new SlashCommandBuilder()
  .setName(THREADLIGHT_COMMAND_NAME)
  .setDescription("Ask Threadlight for a thoughtful Scripture-centered response.")
  .addStringOption((option) =>
    option
      .setName("prompt")
      .setDescription("What would you like Threadlight to reflect on?")
      .setRequired(true),
  );

export const prayCommand = new SlashCommandBuilder()
  .setName(PRAY_COMMAND_NAME)
  .setDescription("Ask Threadlight for a prayerful response.")
  .addStringOption((option) =>
    option.setName("request").setDescription("What would you like prayer for?").setRequired(true),
  );

export const threadlightModeCommand = new SlashCommandBuilder()
  .setName(THREADLIGHT_MODE_COMMAND_NAME)
  .setDescription("View or temporarily change how often Threadlight participates.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((option) =>
    option
      .setName("mode")
      .setDescription("The participation mode to use until the service restarts.")
      .addChoices(
        { name: "Prompted - only when asked", value: "shy" },
        { name: "Attentive - when relevant", value: "medium" },
        { name: "Active - every message", value: "high" },
      ),
  )
  .addBooleanOption((option) =>
    option
      .setName("confirm_high")
      .setDescription("Required to enable Active mode in this channel."),
  );

export const askThreadlightContextCommand = new ContextMenuCommandBuilder()
  .setName(ASK_THREADLIGHT_CONTEXT_NAME)
  .setType(ApplicationCommandType.Message);

export const discordCommands = [
  threadlightCommand,
  prayCommand,
  threadlightModeCommand,
  askThreadlightContextCommand,
].map((command) => command.toJSON());

export function getDiscordCommands() {
  return discordCommands.map((command) => ({ ...command }));
}

export function getDiscordInstallUrl(applicationId: string, guildId?: string): string {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", applicationId);
  url.searchParams.set("permissions", String(THREADLIGHT_DISCORD_PERMISSIONS));
  url.searchParams.set("scope", "bot applications.commands");
  if (guildId) {
    url.searchParams.set("guild_id", guildId);
    url.searchParams.set("disable_guild_select", "true");
  }
  return url.toString();
}
