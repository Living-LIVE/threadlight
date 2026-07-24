import { REST, Routes } from "discord.js";

import { discordCommands } from "./commands.js";

export async function registerDiscordCommands(
  token: string,
  applicationId: string,
  guildId: string,
): Promise<unknown> {
  const rest = new REST({ version: "10" }).setToken(token);

  return rest.put(Routes.applicationGuildCommands(applicationId, guildId), {
    body: discordCommands,
  });
}

export const registerCommands = registerDiscordCommands;
