import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

export const DestinationKindSchema = z.enum([
  "discord",
  "slack",
  "youtube-comments",
  "teams",
  "twitch",
]);
export type DestinationKind = z.infer<typeof DestinationKindSchema>;

const ParticipationModeSchema = z.enum(["shy", "medium", "high"]);
const LaunchStateSchema = z.enum(["draft", "running", "paused", "error"]);

const AiSettingsSchema = z.object({
  provider: z.enum(["openai", "gemini", "gloo", "bonfire"]).default("openai"),
  model: z.string().trim().max(160).default("gpt-4.1-mini"),
  openaiApiKey: z.string().trim().max(800).optional(),
  geminiApiKey: z.string().trim().max(800).optional(),
  glooClientId: z.string().trim().max(300).optional(),
  glooClientSecret: z.string().trim().max(800).optional(),
  glooModel: z.string().trim().max(160).optional(),
  bonfireApiKey: z.string().trim().max(800).optional(),
  bonfireModel: z.string().trim().max(160).optional(),
});

const ScriptureSettingsSchema = z.object({
  provider: z.enum(["ao", "youversion"]).default("ao"),
  bibleId: z.string().trim().max(80).default("BSB"),
  youVersionAppKey: z.string().trim().max(800).optional(),
});

const DiscordSettingsSchema = z.object({
  applicationId: z.string().trim().max(80).optional(),
  publicKey: z.string().trim().max(160).optional(),
  botToken: z.string().trim().max(800).optional(),
  guildId: z.string().trim().max(80).optional(),
  channelId: z.string().trim().max(80).optional(),
  careRoleId: z.string().trim().max(80).optional(),
  registerCommands: z.boolean().default(false),
  participationMode: ParticipationModeSchema.default("shy"),
  quietSeconds: z.number().int().min(1).max(300).default(20),
  cooldownSeconds: z.number().int().min(0).max(3600).default(180),
});

const SlackSettingsSchema = z.object({
  workspaceName: z.string().trim().max(120).optional(),
  botToken: z.string().trim().max(800).optional(),
  channelId: z.string().trim().max(120).optional(),
});

const YouTubeReplyModeSchema = z.enum(["review", "selective", "high-touch"]);
const YouTubeDraftStatusSchema = z.enum(["pending", "posted", "rejected", "skipped", "failed"]);
const YouTubeVideoSchema = z.object({
  id: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(200),
  thumbnailUrl: z.string().url().max(1_000).optional(),
});

const YouTubeSettingsSchema = z.object({
  channelId: z.string().trim().max(160).optional(),
  channelName: z.string().trim().max(160).optional(),
  selectedVideos: z.array(YouTubeVideoSchema).max(10).default([]),
  clientId: z.string().trim().max(300).optional(),
  clientSecret: z.string().trim().max(800).optional(),
  refreshToken: z.string().trim().max(800).optional(),
  replyMode: YouTubeReplyModeSchema.default("review"),
  pollSeconds: z.number().int().min(60).max(3_600).default(180),
  dailyReplyLimit: z.number().int().min(1).max(100).default(12),
  lastPollAt: z.string().datetime().optional(),
  lastError: z.string().trim().max(300).optional(),
  lastSafetyAlert: z.string().trim().max(300).optional(),
  replyCountDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  replyCount: z.number().int().min(0).max(100).default(0),
  processedCommentIds: z.array(z.string().trim().min(1).max(160)).max(500).default([]),
  drafts: z
    .array(
      z.object({
        id: z.string().uuid(),
        commentId: z.string().trim().min(1).max(160),
        videoId: z.string().trim().min(1).max(160),
        videoTitle: z.string().trim().max(200).optional(),
        authorName: z.string().trim().max(160),
        commentText: z.string().trim().max(1_000),
        replyText: z.string().trim().max(2_000),
        status: YouTubeDraftStatusSchema,
        createdAt: z.string().datetime(),
        resolvedAt: z.string().datetime().optional(),
        error: z.string().trim().max(300).optional(),
      }),
    )
    .max(100)
    .default([]),
});

export const DeploymentSchema = z.object({
  id: z.string().uuid(),
  kind: DestinationKindSchema,
  name: z.string().trim().min(1).max(120),
  state: LaunchStateSchema.default("draft"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  discord: DiscordSettingsSchema.optional(),
  slack: SlackSettingsSchema.optional(),
  youtube: YouTubeSettingsSchema.optional(),
});
export type Deployment = z.infer<typeof DeploymentSchema>;
export type YouTubeSettings = z.infer<typeof YouTubeSettingsSchema>;

export const LocalControlConfigSchema = z.object({
  version: z.literal(1),
  providers: z.object({ ai: AiSettingsSchema, scripture: ScriptureSettingsSchema }),
  deployments: z.array(DeploymentSchema).max(50).default([]),
});
export type LocalControlConfig = z.infer<typeof LocalControlConfigSchema>;

export const DestinationCatalog = [
  { kind: "discord", label: "Discord", state: "available" },
  { kind: "slack", label: "Slack", state: "planned" },
  { kind: "youtube-comments", label: "YouTube Comments", state: "available" },
  { kind: "teams", label: "Microsoft Teams", state: "coming-soon" },
  { kind: "twitch", label: "Twitch", state: "coming-soon" },
] as const;

export function createDefaultControlConfig(environment: NodeJS.ProcessEnv): LocalControlConfig {
  const hasDiscord = Boolean(environment.DISCORD_APPLICATION_ID || environment.DISCORD_BOT_TOKEN);
  const now = new Date().toISOString();
  const discord: Deployment[] = hasDiscord
    ? [
        {
          id: randomUUID(),
          kind: "discord",
          name: "Discord",
          state: environment.DISCORD_ENABLED === "false" ? "paused" : "running",
          createdAt: now,
          updatedAt: now,
          discord: {
            applicationId: environment.DISCORD_APPLICATION_ID,
            publicKey: environment.DISCORD_PUBLIC_KEY,
            botToken: environment.DISCORD_BOT_TOKEN,
            guildId: environment.DISCORD_GUILD_ID,
            channelId: environment.DISCORD_CHANNEL_ID,
            careRoleId: environment.DISCORD_CARE_ROLE_ID,
            registerCommands: ["1", "true", "yes", "on"].includes(
              (environment.DISCORD_REGISTER_COMMANDS ?? "").toLowerCase(),
            ),
            participationMode: (environment.DISCORD_PARTICIPATION_MODE ?? "shy") as z.infer<
              typeof ParticipationModeSchema
            >,
            quietSeconds: Number(environment.DISCORD_AMBIENT_QUIET_SECONDS ?? 20),
            cooldownSeconds: Number(environment.DISCORD_AMBIENT_COOLDOWN_SECONDS ?? 180),
          },
        },
      ]
    : [];

  return LocalControlConfigSchema.parse({
    version: 1,
    providers: {
      ai: {
        provider: environment.AI_PROVIDER === "fixture" ? "openai" : environment.AI_PROVIDER,
        model: environment.OPENAI_MODEL ?? "gpt-4.1-mini",
        openaiApiKey: environment.OPENAI_API_KEY,
        glooClientId: environment.GLOO_CLIENT_ID,
        glooClientSecret: environment.GLOO_CLIENT_SECRET,
        glooModel: environment.GLOO_MODEL,
      },
      scripture: {
        provider:
          environment.SCRIPTURE_PROVIDER === "fixture" ? "ao" : environment.SCRIPTURE_PROVIDER,
        bibleId: environment.AO_BIBLE_ID ?? environment.YVP_BIBLE_ID ?? "BSB",
        youVersionAppKey: environment.YVP_APP_KEY,
      },
    },
    deployments: discord,
  });
}

export class LocalControlStore {
  private current?: LocalControlConfig;

  public constructor(
    private readonly path: string,
    private readonly initial: () => LocalControlConfig,
  ) {}

  public async load(): Promise<LocalControlConfig> {
    if (this.current) return this.current;
    try {
      const content = await readFile(this.path, "utf8");
      this.current = LocalControlConfigSchema.parse(JSON.parse(content));
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      this.current = this.initial();
      await this.persist(this.current);
    }
    return this.current;
  }

  public async update(
    mutator: (config: LocalControlConfig) => LocalControlConfig,
  ): Promise<LocalControlConfig> {
    const next = LocalControlConfigSchema.parse(mutator(await this.load()));
    this.current = next;
    await this.persist(next);
    return next;
  }

  private async persist(config: LocalControlConfig): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.path);
  }
}

export function sanitizeConfig(config: LocalControlConfig) {
  return {
    version: config.version,
    providers: {
      ai: {
        provider: config.providers.ai.provider,
        model: config.providers.ai.model,
        configured: providerConfigured(config.providers.ai),
      },
      scripture: {
        provider: config.providers.scripture.provider,
        bibleId: config.providers.scripture.bibleId,
        configured:
          config.providers.scripture.provider === "ao" ||
          Boolean(config.providers.scripture.youVersionAppKey),
      },
    },
    deployments: config.deployments.map((deployment) => ({
      id: deployment.id,
      kind: deployment.kind,
      name: deployment.name,
      state: deployment.state,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
      configured: deploymentConfigured(deployment),
      discord: deployment.discord
        ? {
            applicationIdConfigured: Boolean(deployment.discord.applicationId),
            publicKeyConfigured: Boolean(deployment.discord.publicKey),
            botTokenConfigured: Boolean(deployment.discord.botToken),
            guildIdConfigured: Boolean(deployment.discord.guildId),
            channelIdConfigured: Boolean(deployment.discord.channelId),
            participationMode: deployment.discord.participationMode,
            quietSeconds: deployment.discord.quietSeconds,
            cooldownSeconds: deployment.discord.cooldownSeconds,
          }
        : undefined,
      slack: deployment.slack
        ? {
            workspaceName: deployment.slack.workspaceName,
            botTokenConfigured: Boolean(deployment.slack.botToken),
            channelIdConfigured: Boolean(deployment.slack.channelId),
          }
        : undefined,
      youtube: deployment.youtube
        ? {
            channelId: deployment.youtube.channelId,
            channelName: deployment.youtube.channelName,
            selectedVideos: deployment.youtube.selectedVideos,
            clientIdConfigured: Boolean(deployment.youtube.clientId),
            clientSecretConfigured: Boolean(deployment.youtube.clientSecret),
            refreshTokenConfigured: Boolean(deployment.youtube.refreshToken),
            replyMode: deployment.youtube.replyMode,
            pollSeconds: deployment.youtube.pollSeconds,
            dailyReplyLimit: deployment.youtube.dailyReplyLimit,
            lastPollAt: deployment.youtube.lastPollAt,
            lastError: deployment.youtube.lastError,
            lastSafetyAlert: deployment.youtube.lastSafetyAlert,
            replyCount: deployment.youtube.replyCount,
            drafts: deployment.youtube.drafts.map((draft) => ({
              id: draft.id,
              commentId: draft.commentId,
              videoId: draft.videoId,
              videoTitle: draft.videoTitle,
              authorName: draft.authorName,
              commentText: draft.commentText,
              replyText: draft.replyText,
              status: draft.status,
              createdAt: draft.createdAt,
              resolvedAt: draft.resolvedAt,
              error: draft.error,
            })),
          }
        : undefined,
    })),
  };
}

export function providerConfigured(settings: LocalControlConfig["providers"]["ai"]): boolean {
  switch (settings.provider) {
    case "openai":
      return Boolean(settings.openaiApiKey);
    case "gemini":
      return Boolean(settings.geminiApiKey);
    case "gloo":
      return Boolean(settings.glooClientId && settings.glooClientSecret && settings.glooModel);
    case "bonfire":
      return Boolean(settings.bonfireApiKey && settings.bonfireModel);
  }
}

export function deploymentConfigured(deployment: Deployment): boolean {
  if (deployment.kind === "discord") {
    return Boolean(
      deployment.discord?.applicationId &&
        deployment.discord.botToken &&
        deployment.discord.guildId &&
        deployment.discord.channelId,
    );
  }
  if (deployment.kind === "slack") {
    return Boolean(deployment.slack?.botToken && deployment.slack.channelId);
  }
  if (deployment.kind === "youtube-comments") {
    return Boolean(
      deployment.youtube?.channelId &&
        deployment.youtube.refreshToken &&
        deployment.youtube.selectedVideos.length > 0 &&
        deployment.youtube.clientId &&
        deployment.youtube.clientSecret,
    );
  }
  return false;
}
