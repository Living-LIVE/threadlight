import type {
  ConversationContext,
  ConversationMessage,
  ThreadlightOrchestrator,
} from "@threadlight/core";
import {
  type ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  type Interaction,
  type Message,
  type MessageContextMenuCommandInteraction,
  type TextBasedChannel,
} from "discord.js";

import {
  ASK_THREADLIGHT_CONTEXT_NAME,
  PRAY_COMMAND_NAME,
  THREADLIGHT_COMMAND_NAME,
} from "./commands.js";
import { formatThreadlightResponse } from "./response.js";

const DEFAULT_COOLDOWN_MS = 15_000;
const DEFAULT_RECENT_CONTEXT_LIMIT = 8;
const GENERIC_ERROR_MESSAGE = "Threadlight could not respond right now. Please try again.";
const COOLDOWN_MESSAGE = "Please give Threadlight a moment before asking again.";

export interface DiscordGatewayConfig {
  token: string;
  guildId: string;
  channelId?: string;
  cooldownMs?: number;
  recentContextLimit?: number;
}

export interface DiscordGatewayLogger {
  error(message: string): void;
}

export interface DiscordGatewayStatus {
  readonly state: "stopped" | "starting" | "ready" | "error" | "stopping";
  readonly ready: boolean;
}

type MessageHistoryChannel = Pick<TextBasedChannel, "messages">;

function createLogger(logger?: DiscordGatewayLogger): DiscordGatewayLogger {
  return logger ?? { error: (message) => console.error(message) };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractMentionPrompt(content: string, botUserId: string): string | undefined {
  const mention = new RegExp(`<@!?${escapeRegExp(botUserId)}>`, "g");
  if (!mention.test(content)) return undefined;

  const prompt = content.replace(mention, " ").replace(/\s+/g, " ").trim();
  return prompt || undefined;
}

function toConversationMessage(message: Message): ConversationMessage {
  return {
    id: message.id,
    author: {
      id: message.author.id,
      name: message.author.username,
      avatarUrl: message.author.displayAvatarURL(),
      isAgent: message.author.bot,
    },
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function fetchRecentContext(
  channel: MessageHistoryChannel,
  limit = DEFAULT_RECENT_CONTEXT_LIMIT,
): Promise<ConversationMessage[]> {
  const messages = await channel.messages.fetch({ limit });
  return [...messages.values()].reverse().map(toConversationMessage);
}

function createConversationContext(
  channelId: string,
  guildId: string,
  messages: ConversationMessage[],
): ConversationContext {
  return {
    channelId,
    guildId,
    messages,
  };
}

function isAllowedLocation(
  config: DiscordGatewayConfig,
  guildId: string | null,
  channelId: string | null,
): boolean {
  if (guildId !== config.guildId) return false;
  return !config.channelId || channelId === config.channelId;
}

function getChannel(interaction: Interaction): MessageHistoryChannel | undefined {
  const channel = interaction.channel;
  if (!channel?.isTextBased() || !("messages" in channel)) return undefined;
  return channel as MessageHistoryChannel;
}

export class DiscordGatewayClient implements DiscordGatewayStatus {
  public readonly client: Client;
  private readonly config: Required<
    Pick<DiscordGatewayConfig, "cooldownMs" | "recentContextLimit">
  > &
    DiscordGatewayConfig;
  private readonly orchestrator: ThreadlightOrchestrator;
  private readonly logger: DiscordGatewayLogger;
  private readonly cooldowns = new Map<string, number>();
  private currentState: DiscordGatewayStatus["state"] = "stopped";

  public constructor(
    config: DiscordGatewayConfig,
    orchestrator: ThreadlightOrchestrator,
    logger?: DiscordGatewayLogger,
  ) {
    this.config = {
      ...config,
      cooldownMs: config.cooldownMs ?? DEFAULT_COOLDOWN_MS,
      recentContextLimit: config.recentContextLimit ?? DEFAULT_RECENT_CONTEXT_LIMIT,
    };
    this.orchestrator = orchestrator;
    this.logger = createLogger(logger);
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      allowedMentions: { parse: [] },
    });

    this.client.on(Events.InteractionCreate, (interaction) => {
      void this.handleInteraction(interaction);
    });
    this.client.on(Events.MessageCreate, (message) => {
      void this.handleMessage(message);
    });
  }

  public get state(): DiscordGatewayStatus["state"] {
    return this.currentState;
  }

  public get ready(): boolean {
    return this.currentState === "ready" && this.client.isReady();
  }

  public isReady(): boolean {
    return this.ready;
  }

  public async start(): Promise<this> {
    if (this.currentState === "ready") return this;
    this.currentState = "starting";

    try {
      const ready = new Promise<void>((resolve) => {
        if (this.client.isReady()) {
          resolve();
          return;
        }
        this.client.once(Events.ClientReady, () => resolve());
      });
      await this.client.login(this.config.token);
      await ready;
      await this.client.guilds.fetch(this.config.guildId);
      if (this.config.channelId) {
        const channel = await this.client.channels.fetch(this.config.channelId);
        if (
          !channel?.isTextBased() ||
          !("guildId" in channel) ||
          channel.guildId !== this.config.guildId
        ) {
          throw new Error("Configured Discord channel is not a text channel in the target guild");
        }
      }
      this.currentState = "ready";
      return this;
    } catch (error) {
      this.client.destroy();
      this.currentState = "error";
      this.logger.error("Discord gateway failed to start");
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (this.currentState === "stopped") return;

    this.currentState = "stopping";
    this.cooldowns.clear();
    this.client.destroy();
    this.currentState = "stopped";
  }

  private isOnCooldown(userId: string): boolean {
    const expiresAt = this.cooldowns.get(userId);
    if (!expiresAt || expiresAt <= Date.now()) {
      this.cooldowns.delete(userId);
      return false;
    }
    return true;
  }

  private startCooldown(userId: string): void {
    this.cooldowns.set(userId, Date.now() + this.config.cooldownMs);
  }

  private async handleMessage(message: Message): Promise<void> {
    if (message.author.bot || !this.client.user) return;
    const guildId = message.guildId;
    if (!guildId || !isAllowedLocation(this.config, guildId, message.channelId)) return;

    const prompt = extractMentionPrompt(message.content, this.client.user.id);
    if (!prompt || this.isOnCooldown(message.author.id)) return;

    this.startCooldown(message.author.id);
    try {
      const contextMessages = await fetchRecentContext(
        message.channel as MessageHistoryChannel,
        this.config.recentContextLimit,
      );
      const context = createConversationContext(message.channelId, guildId, contextMessages);
      const result = await this.orchestrator.respond({
        context,
        prompt,
        source: "discord",
      });
      if (!result.reply) return;

      await message.reply({
        embeds: formatThreadlightResponse(result),
        allowedMentions: { parse: [] },
      });
    } catch {
      this.logger.error("Discord message handling failed");
      await message
        .reply({ content: GENERIC_ERROR_MESSAGE, allowedMentions: { parse: [] } })
        .catch(() => undefined);
    }
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.inGuild()) return;
    if (!isAllowedLocation(this.config, interaction.guildId, interaction.channelId)) return;
    if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) return;

    const userId = interaction.user.id;
    if (this.isOnCooldown(userId)) {
      await interaction
        .reply({ content: COOLDOWN_MESSAGE, ephemeral: true, allowedMentions: { parse: [] } })
        .catch(() => undefined);
      return;
    }

    const request = this.getInteractionRequest(interaction);
    if (!request) return;

    this.startCooldown(userId);
    try {
      await interaction.deferReply();
    } catch {
      this.logger.error("Discord interaction could not be deferred");
      return;
    }

    try {
      const channel = getChannel(interaction);
      if (!channel) throw new Error("Discord interaction channel is unavailable");

      const contextMessages = await fetchRecentContext(channel, this.config.recentContextLimit);
      const context = createConversationContext(
        interaction.channelId,
        interaction.guildId,
        contextMessages,
      );
      const result = await this.orchestrator.respond({
        context,
        prompt: request.prompt,
        source: "discord",
        ...(request.intent ? { intent: request.intent } : {}),
      });
      if (!result.reply) {
        await interaction.deleteReply();
        return;
      }

      await interaction.editReply({
        embeds: formatThreadlightResponse(result),
        allowedMentions: { parse: [] },
      });
    } catch {
      this.logger.error("Discord interaction handling failed");
      await interaction
        .editReply({ content: GENERIC_ERROR_MESSAGE, allowedMentions: { parse: [] } })
        .catch(() => undefined);
    }
  }

  private getInteractionRequest(
    interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction,
  ): { prompt: string; intent?: "reflection" | "prayer" } | undefined {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === THREADLIGHT_COMMAND_NAME) {
        return { prompt: interaction.options.getString("prompt", true), intent: "reflection" };
      }
      if (interaction.commandName === PRAY_COMMAND_NAME) {
        return { prompt: interaction.options.getString("request", true), intent: "prayer" };
      }
      return undefined;
    }

    if (interaction.commandName !== ASK_THREADLIGHT_CONTEXT_NAME) return undefined;
    const target = interaction.targetMessage;
    if (target.author.bot) return undefined;

    const prompt = target.content.trim();
    return prompt ? { prompt, intent: "reflection" } : undefined;
  }
}

export function createDiscordGateway(
  config: DiscordGatewayConfig,
  orchestrator: ThreadlightOrchestrator,
  logger?: DiscordGatewayLogger,
): DiscordGatewayClient {
  return new DiscordGatewayClient(config, orchestrator, logger);
}

export async function startDiscordGateway(
  config: DiscordGatewayConfig,
  orchestrator: ThreadlightOrchestrator,
  logger?: DiscordGatewayLogger,
): Promise<DiscordGatewayClient> {
  return createDiscordGateway(config, orchestrator, logger).start();
}
