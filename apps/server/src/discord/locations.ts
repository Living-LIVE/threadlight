const DISCORD_API_ROOT = "https://discord.com/api/v10";
const MESSAGE_CHANNEL_TYPES = new Set([0, 5]);

export type DiscordServerLocation = { id: string; name: string };
export type DiscordChannelLocation = { id: string; name: string };
export type DiscordLocations = {
  servers: DiscordServerLocation[];
  channels: DiscordChannelLocation[];
};

type FetchFn = typeof fetch;

export class DiscordLocationsError extends Error {}

export async function listDiscordLocations(
  botToken: string,
  guildId?: string,
  fetchFn: FetchFn = fetch,
): Promise<DiscordLocations> {
  const servers = await discordRequest<Array<{ id?: string; name?: string }>>(
    "/users/@me/guilds",
    botToken,
    fetchFn,
  ).then((guilds) =>
    guilds
      .map((guild): DiscordServerLocation | undefined =>
        guild.id && guild.name ? { id: guild.id, name: guild.name } : undefined,
      )
      .filter((guild): guild is DiscordServerLocation => Boolean(guild))
      .sort((left, right) => left.name.localeCompare(right.name)),
  );

  if (!guildId || !servers.some((server) => server.id === guildId)) {
    return { servers, channels: [] };
  }

  const channels = await discordRequest<Array<{ id?: string; name?: string; type?: number }>>(
    `/guilds/${encodeURIComponent(guildId)}/channels`,
    botToken,
    fetchFn,
  ).then((guildChannels) =>
    guildChannels
      .map((channel): DiscordChannelLocation | undefined =>
        channel.id && channel.name && MESSAGE_CHANNEL_TYPES.has(channel.type ?? -1)
          ? { id: channel.id, name: channel.name }
          : undefined,
      )
      .filter((channel): channel is DiscordChannelLocation => Boolean(channel))
      .sort((left, right) => left.name.localeCompare(right.name)),
  );

  return { servers, channels };
}

async function discordRequest<T>(path: string, botToken: string, fetchFn: FetchFn): Promise<T> {
  const response = await fetchFn(`${DISCORD_API_ROOT}${path}`, {
    headers: { authorization: `Bot ${botToken}` },
  });
  if (!response.ok) {
    throw new DiscordLocationsError("Threadlight could not load Discord locations.");
  }
  return (await response.json()) as T;
}
