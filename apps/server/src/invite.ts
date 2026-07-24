import { getDiscordInstallUrl } from "./discord/index.js";

const applicationId = required(process.env.DISCORD_APPLICATION_ID, "DISCORD_APPLICATION_ID");

console.log(getDiscordInstallUrl(applicationId, process.env.DISCORD_GUILD_ID));

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}
