import { buildApp } from "./app.js";
import { DiscordGatewayClient, registerDiscordCommands } from "./discord/index.js";
import { loadConfig } from "./env.js";
import { createThreadlightRuntime } from "./runtime.js";

const config = loadConfig();
const orchestrator = createThreadlightRuntime(config);
let gateway: DiscordGatewayClient | undefined;

if (config.DISCORD_ENABLED) {
  gateway = new DiscordGatewayClient(
    {
      token: required(config.DISCORD_BOT_TOKEN, "DISCORD_BOT_TOKEN"),
      guildId: required(config.DISCORD_GUILD_ID, "DISCORD_GUILD_ID"),
      channelId: config.DISCORD_CHANNEL_ID,
      participationMode: config.DISCORD_PARTICIPATION_MODE,
      ambientQuietMs: config.DISCORD_AMBIENT_QUIET_SECONDS * 1_000,
      ambientCooldownMs: config.DISCORD_AMBIENT_COOLDOWN_SECONDS * 1_000,
      maxQueueDepth: config.DISCORD_MAX_QUEUE_DEPTH,
    },
    orchestrator,
  );
}

const app = await buildApp({
  config,
  orchestrator,
  runtimeStatus: () => ({
    discord: gateway
      ? {
          enabled: true,
          ready: gateway.ready,
          state: gateway.state,
          participation: gateway.participationStatus,
        }
      : {
          enabled: false,
          ready: true,
          state: "disabled",
          participation: {
            mode: config.DISCORD_PARTICIPATION_MODE,
            quietWindowMs: config.DISCORD_AMBIENT_QUIET_SECONDS * 1_000,
            cooldownMs: config.DISCORD_AMBIENT_COOLDOWN_SECONDS * 1_000,
            maxQueueDepth: config.DISCORD_MAX_QUEUE_DEPTH,
            pendingConversations: 0,
            queuedMessages: 0,
          },
        },
  }),
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "Threadlight is shutting down");
  await gateway?.stop();
  await app.close();
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

try {
  await app.listen({ host: config.HOST, port: config.PORT });

  if (config.DISCORD_REGISTER_COMMANDS && config.DISCORD_ENABLED) {
    try {
      await registerDiscordCommands(
        required(config.DISCORD_BOT_TOKEN, "DISCORD_BOT_TOKEN"),
        required(config.DISCORD_APPLICATION_ID, "DISCORD_APPLICATION_ID"),
        required(config.DISCORD_GUILD_ID, "DISCORD_GUILD_ID"),
      );
      app.log.info({ guildId: config.DISCORD_GUILD_ID }, "Discord application commands registered");
    } catch {
      app.log.warn("Discord application command registration failed");
    }
  }

  try {
    await gateway?.start();
  } catch {
    app.log.warn("Threadlight is running without an active Discord gateway");
  }
} catch (error) {
  app.log.error(
    { errorName: error instanceof Error ? error.name : "UnknownError" },
    "Threadlight failed to start",
  );
  await gateway?.stop();
  await app.close();
  process.exitCode = 1;
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}
