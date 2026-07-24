import { registerDiscordCommands } from "./discord/index.js";
import { loadConfig } from "./env.js";

const config = loadConfig();

if (!config.DISCORD_ENABLED) {
  throw new Error("DISCORD_ENABLED must be true to register commands");
}

const result = await registerDiscordCommands(
  required(config.DISCORD_BOT_TOKEN, "DISCORD_BOT_TOKEN"),
  required(config.DISCORD_APPLICATION_ID, "DISCORD_APPLICATION_ID"),
  required(config.DISCORD_GUILD_ID, "DISCORD_GUILD_ID"),
);

const count = Array.isArray(result) ? result.length : undefined;
console.log(
  JSON.stringify({
    registered: true,
    guildId: config.DISCORD_GUILD_ID,
    commandCount: count,
  }),
);

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}
