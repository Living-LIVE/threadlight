import type { ActivityRecorder } from "./activity.js";
import {
  deploymentConfigured,
  type LocalControlConfig,
  type LocalControlStore,
  providerConfigured,
} from "./control.js";
import {
  DiscordGatewayClient,
  type DiscordGatewayConfig,
  type ParticipationStatus,
  registerDiscordCommands,
} from "./discord/index.js";
import { createControlRuntime } from "./runtime.js";
import { YouTubeConnector } from "./youtube/index.js";

type DiscordGateway = {
  readonly ready: boolean;
  readonly participationStatus: ParticipationStatus;
  start(): Promise<unknown>;
  stop(): Promise<void>;
};

type YouTubeRuntime = Pick<YouTubeConnector, "start" | "stop" | "scan" | "approve" | "reject">;

type RuntimeManagerDependencies = {
  activity?: ActivityRecorder;
  createGateway?: (
    config: DiscordGatewayConfig,
    orchestrator: ReturnType<typeof createControlRuntime>,
  ) => DiscordGateway;
  registerCommands?: (token: string, applicationId: string, guildId: string) => Promise<unknown>;
  createYouTube?: (
    deploymentId: string,
    store: LocalControlStore,
    orchestrator: ReturnType<typeof createControlRuntime>,
  ) => YouTubeRuntime;
};

export type DeploymentRuntimeStatus = {
  id: string;
  state: "draft" | "running" | "paused" | "error";
  ready: boolean;
  message?: string;
  participation?: ParticipationStatus;
};

export class ThreadlightRuntimeManager {
  private gateway?: DiscordGateway;
  private youtube?: YouTubeRuntime;
  private activeId?: string;
  private youtubeId?: string;
  private activeFingerprint?: string;
  private youtubeFingerprint?: string;
  private statuses = new Map<string, DeploymentRuntimeStatus>();
  private errors = new Map<string, string>();
  private readonly createGateway: NonNullable<RuntimeManagerDependencies["createGateway"]>;
  private readonly registerCommands: NonNullable<RuntimeManagerDependencies["registerCommands"]>;
  private readonly createYouTube: NonNullable<RuntimeManagerDependencies["createYouTube"]>;
  private readonly activity?: ActivityRecorder;

  public constructor(
    private readonly store: LocalControlStore,
    dependencies: RuntimeManagerDependencies = {},
  ) {
    this.activity = dependencies.activity;
    this.createGateway =
      dependencies.createGateway ??
      ((config, orchestrator) =>
        new DiscordGatewayClient(config, orchestrator, undefined, this.activity));
    this.registerCommands = dependencies.registerCommands ?? registerDiscordCommands;
    this.createYouTube =
      dependencies.createYouTube ??
      ((deploymentId, store, orchestrator) =>
        new YouTubeConnector(deploymentId, store, orchestrator, undefined, this.activity));
  }

  public async initialize(): Promise<void> {
    await this.reconcile();
  }

  public async reconcile(): Promise<void> {
    const config = await this.store.load();
    const active = config.deployments.find(
      (deployment) => deployment.kind === "discord" && deployment.state === "running",
    );

    await this.reconcileYouTube(config);

    if (!active) {
      await this.stopGateway();
      this.refreshStatuses(config);
      return;
    }

    if (!providerConfigured(config.providers.ai)) {
      await this.stopGateway();
      this.refreshStatuses(
        config,
        active.id,
        "Configure the selected AI provider before launching.",
      );
      return;
    }

    if (
      !["openai", "gloo"].includes(config.providers.ai.provider) ||
      !["ao", "youversion"].includes(config.providers.scripture.provider)
    ) {
      await this.stopGateway();
      this.refreshStatuses(
        config,
        active.id,
        "This provider selection is saved but its runtime adapter is not installed yet.",
      );
      return;
    }

    if (!deploymentConfigured(active) || !active.discord) {
      await this.stopGateway();
      this.refreshStatuses(config, active.id, "Complete the Discord connection before launching.");
      return;
    }

    const activeFingerprint = JSON.stringify({
      providers: config.providers,
      discord: active.discord,
    });
    if (
      this.gateway &&
      this.activeId === active.id &&
      this.gateway.ready &&
      this.activeFingerprint === activeFingerprint
    ) {
      this.errors.delete(active.id);
      this.refreshStatuses(config);
      return;
    }

    await this.stopGateway();
    const runtime = createControlRuntime(config);
    const discord = active.discord;
    this.gateway = this.createGateway(
      {
        token: required(discord.botToken, "Discord bot token"),
        guildId: required(discord.guildId, "Discord server ID"),
        channelId: required(discord.channelId, "Discord channel ID"),
        participationMode: discord.participationMode,
        ambientQuietMs: discord.quietSeconds * 1_000,
        ambientCooldownMs: discord.cooldownSeconds * 1_000,
      },
      runtime,
    );
    this.activeId = active.id;
    this.activeFingerprint = activeFingerprint;

    try {
      if (discord.registerCommands) {
        await this.registerCommands(
          required(discord.botToken, "Discord bot token"),
          required(discord.applicationId, "Discord application ID"),
          required(discord.guildId, "Discord server ID"),
        );
      }
      await this.gateway.start();
      this.errors.delete(active.id);
      this.refreshStatuses(config);
    } catch {
      this.refreshStatuses(config, active.id, "Threadlight could not connect to Discord.");
    }
  }

  public async launch(id: string): Promise<void> {
    this.errors.delete(id);
    await this.store.update((config) => ({
      ...config,
      deployments: config.deployments.map((deployment) =>
        deployment.id === id
          ? { ...deployment, state: "running" as const, updatedAt: new Date().toISOString() }
          : deployment,
      ),
    }));
    await this.reconcile();
  }

  public async pause(id: string): Promise<void> {
    this.errors.delete(id);
    await this.store.update((config) => ({
      ...config,
      deployments: config.deployments.map((deployment) =>
        deployment.id === id
          ? { ...deployment, state: "paused" as const, updatedAt: new Date().toISOString() }
          : deployment,
      ),
    }));
    await this.reconcile();
  }

  public async stop(): Promise<void> {
    await this.stopGateway();
    await this.stopYouTube();
  }

  public async scanYoutube(id: string) {
    if (!this.youtube || this.youtubeId !== id) await this.reconcile();
    if (!this.youtube || this.youtubeId !== id) throw new Error("YouTube is not running.");
    await this.youtube.scan();
  }

  public async approveYoutubeDraft(id: string, draftId: string) {
    if (!this.youtube || this.youtubeId !== id) await this.reconcile();
    if (!this.youtube || this.youtubeId !== id) throw new Error("YouTube is not running.");
    await this.youtube.approve(draftId);
  }

  public async rejectYoutubeDraft(id: string, draftId: string) {
    if (!this.youtube || this.youtubeId !== id) await this.reconcile();
    if (!this.youtube || this.youtubeId !== id) throw new Error("YouTube is not running.");
    await this.youtube.reject(draftId);
  }

  public async status() {
    const config = await this.store.load();
    this.refreshStatuses(config);
    return {
      deployments: config.deployments.map((deployment) => this.statuses.get(deployment.id)),
      activeDeploymentId: this.activeId ?? this.youtubeId,
    };
  }

  private async stopGateway(): Promise<void> {
    await this.gateway?.stop();
    this.gateway = undefined;
    this.activeId = undefined;
    this.activeFingerprint = undefined;
  }

  private async reconcileYouTube(config: LocalControlConfig) {
    const active = config.deployments.find(
      (deployment) => deployment.kind === "youtube-comments" && deployment.state === "running",
    );
    if (!active) {
      await this.stopYouTube();
      return;
    }
    if (!providerConfigured(config.providers.ai) || !deploymentConfigured(active)) return;
    if (
      !["openai", "gloo"].includes(config.providers.ai.provider) ||
      !["ao", "youversion"].includes(config.providers.scripture.provider)
    )
      return;
    const youtubeFingerprint = JSON.stringify({
      providers: config.providers,
      youtube: active.youtube,
    });
    if (
      this.youtube &&
      this.youtubeId === active.id &&
      this.youtubeFingerprint === youtubeFingerprint
    )
      return;
    await this.stopYouTube();
    this.youtube = this.createYouTube(active.id, this.store, createControlRuntime(config));
    this.youtubeId = active.id;
    this.youtubeFingerprint = youtubeFingerprint;
    try {
      await this.youtube.start();
    } catch {
      this.errors.set(active.id, "Threadlight could not connect to YouTube.");
      await this.stopYouTube();
    }
  }

  private async stopYouTube() {
    await this.youtube?.stop();
    this.youtube = undefined;
    this.youtubeId = undefined;
    this.youtubeFingerprint = undefined;
  }

  private refreshStatuses(
    config: LocalControlConfig,
    errorId?: string,
    errorMessage?: string,
  ): void {
    if (errorId && errorMessage) this.errors.set(errorId, errorMessage);
    for (const deployment of config.deployments) {
      const isActive = deployment.id === this.activeId && this.gateway;
      const isYoutubeActive = deployment.id === this.youtubeId && this.youtube;
      const error = this.errors.get(deployment.id);
      this.statuses.set(deployment.id, {
        id: deployment.id,
        state: error ? "error" : deployment.state,
        ready: Boolean((isActive && this.gateway?.ready) || isYoutubeActive),
        ...(error ? { message: error } : {}),
        ...(isActive ? { participation: this.gateway?.participationStatus } : {}),
      });
    }
  }
}

function required(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required`);
  return value;
}
