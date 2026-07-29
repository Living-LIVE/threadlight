import type {
  ConversationContext,
  ConversationMessage,
  ThreadlightOrchestrator,
  ThreadlightTrigger,
} from "@threadlight/core";
import { assessImmediateSafety } from "@threadlight/core";
import {
  type ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  type Interaction,
  type Message,
  type MessageContextMenuCommandInteraction,
  PermissionFlagsBits,
  type TextBasedChannel,
} from "discord.js";
import type { ActivityInput, ActivityRecorder } from "../activity.js";

import {
  ASK_THREADLIGHT_CONTEXT_NAME,
  PRAY_COMMAND_NAME,
  THREADLIGHT_COMMAND_NAME,
  THREADLIGHT_MODE_COMMAND_NAME,
} from "./commands.js";
import {
  type DiscordParticipationMode,
  ParticipationController,
  type ParticipationStatus,
} from "./participation.js";
import { formatThreadlightResponse } from "./response.js";

const DEFAULT_COOLDOWN_MS = 15_000;
const DEFAULT_RECENT_CONTEXT_LIMIT = 8;
const DEFAULT_AMBIENT_QUIET_MS = 20_000;
const DEFAULT_AMBIENT_COOLDOWN_MS = 180_000;
const DEFAULT_MAX_QUEUE_DEPTH = 25;
const MAX_EXPLICIT_COOLDOWNS = 1_000;
const GENERIC_ERROR_MESSAGE = "Threadlight could not respond right now. Please try again.";
const COOLDOWN_MESSAGE = "Please give Threadlight a moment before asking again.";
const QUEUE_FULL_MESSAGE = "Threadlight is catching up. Please give it a moment.";

export interface DiscordGatewayConfig {
  token: string;
  guildId: string;
  channelId?: string;
  cooldownMs?: number;
  recentContextLimit?: number;
  participationMode?: DiscordParticipationMode;
  ambientQuietMs?: number;
  ambientCooldownMs?: number;
  maxQueueDepth?: number;
}

export interface DiscordGatewayLogger {
  error(message: string): void;
}

export interface DiscordGatewayStatus {
  readonly state: "stopped" | "starting" | "ready" | "error" | "stopping";
  readonly ready: boolean;
  readonly participationStatus: ParticipationStatus;
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

export function isAllowedDiscordLocation(
  config: DiscordGatewayConfig,
  guildId: string | null,
  channelId: string | null,
  parentChannelId?: string | null,
): boolean {
  if (guildId !== config.guildId) return false;
  return (
    !config.channelId || channelId === config.channelId || parentChannelId === config.channelId
  );
}

function getChannel(interaction: Interaction): MessageHistoryChannel | undefined {
  const channel = interaction.channel;
  if (!channel?.isTextBased() || !("messages" in channel)) return undefined;
  return channel as MessageHistoryChannel;
}

export class DiscordGatewayClient implements DiscordGatewayStatus {
  public readonly client: Client;
  private readonly config: Required<
    Pick<
      DiscordGatewayConfig,
      | "cooldownMs"
      | "recentContextLimit"
      | "participationMode"
      | "ambientQuietMs"
      | "ambientCooldownMs"
      | "maxQueueDepth"
    >
  > &
    DiscordGatewayConfig;
  private readonly orchestrator: ThreadlightOrchestrator;
  private readonly logger: DiscordGatewayLogger;
  private readonly participation: ParticipationController;
  private readonly cooldowns = new Map<string, number>();
  private currentState: DiscordGatewayStatus["state"] = "stopped";

  public constructor(
    config: DiscordGatewayConfig,
    orchestrator: ThreadlightOrchestrator,
    logger?: DiscordGatewayLogger,
    private readonly activity?: ActivityRecorder,
  ) {
    this.config = {
      ...config,
      cooldownMs: config.cooldownMs ?? DEFAULT_COOLDOWN_MS,
      recentContextLimit: config.recentContextLimit ?? DEFAULT_RECENT_CONTEXT_LIMIT,
      participationMode: config.participationMode ?? "shy",
      ambientQuietMs: config.ambientQuietMs ?? DEFAULT_AMBIENT_QUIET_MS,
      ambientCooldownMs: config.ambientCooldownMs ?? DEFAULT_AMBIENT_COOLDOWN_MS,
      maxQueueDepth: config.maxQueueDepth ?? DEFAULT_MAX_QUEUE_DEPTH,
    };
    this.orchestrator = orchestrator;
    this.logger = createLogger(logger);
    this.participation = new ParticipationController({
      mode: this.config.participationMode,
      quietWindowMs: this.config.ambientQuietMs,
      cooldownMs: this.config.ambientCooldownMs,
      maxQueueDepth: this.config.maxQueueDepth,
      onError: () => this.logger.error("Discord participation handling failed"),
    });
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

  public get participationStatus(): ParticipationStatus {
    return this.participation.status;
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
    this.participation.stop();
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
    if (this.cooldowns.size >= MAX_EXPLICIT_COOLDOWNS) {
      const now = Date.now();
      for (const [id, expiresAt] of this.cooldowns) {
        if (expiresAt <= now) this.cooldowns.delete(id);
      }
      if (this.cooldowns.size >= MAX_EXPLICIT_COOLDOWNS) {
        const oldest = this.cooldowns.keys().next().value;
        if (oldest) this.cooldowns.delete(oldest);
      }
    }
    this.cooldowns.set(userId, Date.now() + this.config.cooldownMs);
  }

  private async handleMessage(message: Message): Promise<void> {
    if (message.author.bot || message.system || message.webhookId || !this.client.user) return;
    const guildId = message.guildId;
    const parentChannelId = message.channel.isThread() ? message.channel.parentId : null;
    if (
      !guildId ||
      !isAllowedDiscordLocation(this.config, guildId, message.channelId, parentChannelId)
    ) {
      return;
    }

    const prompt = extractMentionPrompt(message.content, this.client.user.id);
    if (prompt) {
      await this.record({
        source: "discord",
        status: "observed",
        sourceId: message.id,
        actor: message.member?.displayName ?? message.author.username,
        input: prompt,
        destination: message.channelId,
      });
      if (this.isOnCooldown(message.author.id)) {
        await this.record({
          source: "discord",
          status: "skipped",
          sourceId: message.id,
          reason: "The requester is inside the explicit-response cooldown.",
          destination: message.channelId,
        });
        return;
      }
      this.startCooldown(message.author.id);
      const disposition = this.participation.handleExplicit({
        id: message.id,
        conversationId: message.channelId,
        execute: (trigger) => this.respondToMessage(message, prompt, trigger),
      });
      if (disposition === "queue-full") {
        await this.record({
          source: "discord",
          status: "skipped",
          sourceId: message.id,
          reason: "The Discord response queue was full.",
          destination: message.channelId,
        });
        await message
          .reply({ content: QUEUE_FULL_MESSAGE, allowedMentions: { parse: [] } })
          .catch(() => undefined);
      }
      return;
    }

    if (!message.content.trim()) return;
    await this.record({
      source: "discord",
      status: "observed",
      sourceId: message.id,
      actor: message.member?.displayName ?? message.author.username,
      input: message.content,
      destination: message.channelId,
    });
    const disposition = this.participation.handle({
      id: message.id,
      conversationId: message.channelId,
      urgent: assessImmediateSafety(message.content).riskLevel === "urgent",
      execute: (trigger) => this.respondToMessage(message, message.content, trigger),
    });
    if (disposition === "ignored") {
      await this.record({
        source: "discord",
        status: "skipped",
        sourceId: message.id,
        reason: "Prompted mode requires a direct mention or command.",
        destination: message.channelId,
      });
    } else if (disposition === "scheduled") {
      await this.record({
        source: "discord",
        status: "queued",
        sourceId: message.id,
        reason:
          this.participation.status.mode === "medium"
            ? "Waiting for the attentive-mode quiet window."
            : "Queued for an active-mode response.",
        destination: message.channelId,
      });
    }
    if (disposition === "queue-full" && this.participation.status.mode === "high") {
      await this.record({
        source: "discord",
        status: "skipped",
        sourceId: message.id,
        reason: "The Discord response queue was full.",
        destination: message.channelId,
      });
      await message
        .reply({ content: QUEUE_FULL_MESSAGE, allowedMentions: { parse: [] } })
        .catch(() => undefined);
    }
  }

  private async respondToMessage(
    message: Message,
    prompt: string,
    trigger: ThreadlightTrigger,
  ): Promise<boolean> {
    try {
      const guildId = message.guildId;
      if (!guildId) return false;
      const contextMessages = await fetchRecentContext(
        message.channel as MessageHistoryChannel,
        this.config.recentContextLimit,
      );
      const context = createConversationContext(
        message.channelId,
        guildId,
        contextMessages.filter((item) => item.id !== message.id),
      );
      const result = await this.orchestrator.respond({
        context,
        prompt,
        source: "discord",
        trigger,
      });
      if (!result.reply) {
        await this.record({
          source: "discord",
          status: "skipped",
          sourceId: message.id,
          reason: result.decision.reason,
          destination: message.channelId,
          provider: `${result.trace.aiProvider} + ${result.trace.scriptureProvider}`,
          durationMs: result.trace.totalMs,
        });
        return false;
      }

      await message.reply({
        embeds: formatThreadlightResponse(result),
        allowedMentions: { parse: [] },
      });
      await this.record({
        source: "discord",
        status: "responded",
        sourceId: message.id,
        actor: message.member?.displayName ?? message.author.username,
        input: prompt,
        output: result.reply.message,
        destination: message.channelId,
        reference: result.reply.passage?.reference,
        provider: `${result.trace.aiProvider} + ${result.trace.scriptureProvider}`,
        durationMs: result.trace.totalMs,
      });
      return true;
    } catch {
      this.logger.error("Discord message handling failed");
      await this.record({
        source: "discord",
        status: "error",
        sourceId: message.id,
        input: prompt,
        reason: "Threadlight could not complete or post the Discord response.",
        destination: message.channelId,
      });
      return message
        .reply({ content: GENERIC_ERROR_MESSAGE, allowedMentions: { parse: [] } })
        .then(() => true)
        .catch(() => false);
    }
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.inGuild()) return;
    const parentChannelId = interaction.channel?.isThread() ? interaction.channel.parentId : null;
    if (
      !isAllowedDiscordLocation(
        this.config,
        interaction.guildId,
        interaction.channelId,
        parentChannelId,
      )
    ) {
      return;
    }
    if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) return;

    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === THREADLIGHT_MODE_COMMAND_NAME
    ) {
      await this.handleModeCommand(interaction);
      return;
    }

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

    const disposition = this.participation.handleExplicit({
      id: interaction.id,
      conversationId: interaction.channelId,
      execute: () => this.respondToInteraction(interaction, request),
    });
    if (disposition === "queue-full") {
      await interaction
        .editReply({ content: QUEUE_FULL_MESSAGE, allowedMentions: { parse: [] } })
        .catch(() => undefined);
    }
  }

  private async respondToInteraction(
    interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction,
    request: {
      prompt: string;
      intent?: "reflection" | "prayer";
      targetMessageId?: string;
    },
  ): Promise<boolean> {
    try {
      if (!interaction.guildId) return false;
      const channel = getChannel(interaction);
      if (!channel) throw new Error("Discord interaction channel is unavailable");

      const contextMessages = await fetchRecentContext(channel, this.config.recentContextLimit);
      const context = createConversationContext(
        interaction.channelId,
        interaction.guildId,
        request.targetMessageId
          ? contextMessages.filter((item) => item.id !== request.targetMessageId)
          : contextMessages,
      );
      const result = await this.orchestrator.respond({
        context,
        prompt: request.prompt,
        source: "discord",
        trigger: "explicit",
        ...(request.intent ? { intent: request.intent } : {}),
      });
      if (!result.reply) {
        await this.record({
          source: "discord",
          status: "skipped",
          sourceId: interaction.id,
          reason: result.decision.reason,
          destination: interaction.channelId,
          provider: `${result.trace.aiProvider} + ${result.trace.scriptureProvider}`,
          durationMs: result.trace.totalMs,
        });
        await interaction.deleteReply();
        return false;
      }

      await interaction.editReply({
        embeds: formatThreadlightResponse(result),
        allowedMentions: { parse: [] },
      });
      await this.record({
        source: "discord",
        status: "responded",
        sourceId: interaction.id,
        actor: interaction.user.globalName ?? interaction.user.username,
        input: request.prompt,
        output: result.reply.message,
        destination: interaction.channelId,
        reference: result.reply.passage?.reference,
        provider: `${result.trace.aiProvider} + ${result.trace.scriptureProvider}`,
        durationMs: result.trace.totalMs,
      });
      return true;
    } catch {
      this.logger.error("Discord interaction handling failed");
      await this.record({
        source: "discord",
        status: "error",
        sourceId: interaction.id,
        input: request.prompt,
        reason: "Threadlight could not complete or post the Discord interaction response.",
        destination: interaction.channelId,
      });
      return interaction
        .editReply({ content: GENERIC_ERROR_MESSAGE, allowedMentions: { parse: [] } })
        .then(() => true)
        .catch(() => false);
    }
  }

  private record(input: ActivityInput): Promise<void> {
    return this.activity?.record(input).catch(() => undefined) ?? Promise.resolve();
  }

  private async handleModeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: "Manage Server permission is required to change Threadlight's participation mode.",
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    const requested = interaction.options.getString("mode") as DiscordParticipationMode | null;
    if (!requested) {
      await interaction.reply({
        content: `Threadlight is currently in **${this.participation.status.mode}** mode.`,
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (requested === "high" && !interaction.options.getBoolean("confirm_high")) {
      await interaction.reply({
        content:
          "Active mode replies to every eligible human message. Run the command again with `confirm_high: True`.",
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    this.participation.setMode(requested);
    await interaction.reply({
      content: `Threadlight is now in **${requested}** mode until the service restarts.`,
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
  }

  private getInteractionRequest(
    interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction,
  ):
    | {
        prompt: string;
        intent?: "reflection" | "prayer";
        targetMessageId?: string;
      }
    | undefined {
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
    return prompt ? { prompt, intent: "reflection", targetMessageId: target.id } : undefined;
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
