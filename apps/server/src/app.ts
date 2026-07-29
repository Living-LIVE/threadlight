import { randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { DEMO_SCENARIOS, type ThreadlightOrchestrator } from "@threadlight/core";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import {
  type Deployment,
  DestinationCatalog,
  DestinationKindSchema,
  type LocalControlConfig,
  type LocalControlStore,
  providerConfigured,
  sanitizeConfig,
} from "./control.js";
import {
  getDiscordInstallUrl,
  listDiscordLocations,
  type ParticipationStatus,
} from "./discord/index.js";
import { competitionReadiness, type ThreadlightConfig } from "./env.js";
import { createControlRuntime } from "./runtime.js";
import type { ThreadlightRuntimeManager } from "./runtime-manager.js";
import { signOAuthState, verifyOAuthState, YouTubeClient } from "./youtube/index.js";

const DemoRequestSchema = z
  .object({
    scenarioId: z.string().min(1).max(80),
  })
  .strict();

type BuildAppOptions = {
  config: ThreadlightConfig;
  orchestrator: ThreadlightOrchestrator;
  logger?: boolean;
  controlStore?: LocalControlStore;
  runtimeManager?: ThreadlightRuntimeManager;
  controlRuntimeFactory?: (config: LocalControlConfig) => ThreadlightOrchestrator;
  listDiscordLocations?: typeof listDiscordLocations;
  runtimeStatus?: () =>
    | {
        discord: {
          enabled: boolean;
          ready: boolean;
          state: string;
          participation?: ParticipationStatus;
        };
      }
    | Promise<{
        discord: {
          enabled: boolean;
          ready: boolean;
          state: string;
          participation?: ParticipationStatus;
        };
      }>;
};

const ProviderUpdateSchema = z.object({
  ai: z
    .object({
      provider: z.enum(["openai", "gemini", "gloo", "bonfire"]).optional(),
      model: z.string().trim().min(1).max(160).optional(),
      openaiApiKey: z.string().trim().min(1).max(800).optional(),
      geminiApiKey: z.string().trim().min(1).max(800).optional(),
      glooClientId: z.string().trim().min(1).max(300).optional(),
      glooClientSecret: z.string().trim().min(1).max(800).optional(),
      glooModel: z.string().trim().min(1).max(160).optional(),
      bonfireApiKey: z.string().trim().min(1).max(800).optional(),
      bonfireModel: z.string().trim().min(1).max(160).optional(),
    })
    .optional(),
  scripture: z
    .object({
      provider: z.enum(["ao", "youversion"]).optional(),
      bibleId: z.string().trim().min(1).max(80).optional(),
      youVersionAppKey: z.string().trim().min(1).max(800).optional(),
    })
    .optional(),
});

const DeploymentCreateSchema = z.object({
  kind: DestinationKindSchema,
  name: z.string().trim().min(1).max(120).optional(),
});

const ControlPreviewSchema = z.object({
  prompt: z.string().trim().min(1).max(2_000),
});

const DeploymentUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  discord: z
    .object({
      applicationId: z.string().trim().min(1).max(80).optional(),
      publicKey: z.string().trim().min(1).max(160).optional(),
      botToken: z.string().trim().min(1).max(800).optional(),
      guildId: z.string().trim().min(1).max(80).optional(),
      channelId: z.string().trim().min(1).max(80).optional(),
      careRoleId: z.string().trim().min(1).max(80).optional(),
      registerCommands: z.boolean().optional(),
      participationMode: z.enum(["shy", "medium", "high"]).optional(),
      quietSeconds: z.number().int().min(1).max(300).optional(),
      cooldownSeconds: z.number().int().min(0).max(3600).optional(),
    })
    .optional(),
  slack: z
    .object({
      workspaceName: z.string().trim().min(1).max(120).optional(),
      botToken: z.string().trim().min(1).max(800).optional(),
      channelId: z.string().trim().min(1).max(120).optional(),
    })
    .optional(),
  youtube: z
    .object({
      channelId: z.string().trim().min(1).max(160).optional(),
      channelName: z.string().trim().min(1).max(160).optional(),
      clientId: z.string().trim().min(1).max(300).optional(),
      clientSecret: z.string().trim().min(1).max(800).optional(),
      refreshToken: z.string().trim().min(1).max(800).optional(),
      selectedVideos: z
        .array(
          z.object({
            id: z.string().trim().min(1).max(160),
            title: z.string().trim().min(1).max(200),
            thumbnailUrl: z.string().url().max(1_000).optional(),
          }),
        )
        .min(1)
        .max(10)
        .optional(),
      replyMode: z.enum(["review", "selective", "high-touch"]).optional(),
      pollSeconds: z.number().int().min(60).max(3_600).optional(),
      dailyReplyLimit: z.number().int().min(1).max(100).optional(),
    })
    .optional(),
});

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      options.logger ??
      (options.config.NODE_ENV === "test" ? false : { level: options.config.LOG_LEVEL }),
    bodyLimit: 64 * 1024,
  });
  const controlPreviewLimiter = new MemoryRateLimiter(20, 60_000);
  // Allow a judge to run each curated scenario without exposing arbitrary prompt generation.
  const publicDemoLimiter = new MemoryRateLimiter(12, 60_000);
  const youtube = new YouTubeClient();
  const discordLocations = options.listDiscordLocations ?? listDiscordLocations;
  const controlRuntimeFactory = options.controlRuntimeFactory ?? createControlRuntime;
  let cachedPublicDemoRuntime:
    | { config: LocalControlConfig; runtime: ThreadlightOrchestrator }
    | undefined;

  const getPublicDemoRuntime = async () => {
    if (!options.controlStore) return options.orchestrator;
    const savedConfig = await options.controlStore.load();
    if (cachedPublicDemoRuntime?.config === savedConfig) return cachedPublicDemoRuntime.runtime;
    const runtime = controlRuntimeFactory(savedConfig);
    cachedPublicDemoRuntime = { config: savedConfig, runtime };
    return runtime;
  };

  await app.register(cors, {
    origin: options.config.WEB_ORIGIN,
    methods: ["GET", "POST", "PATCH"],
    allowedHeaders: ["authorization", "content-type"],
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    return payload;
  });

  app.get("/api/health", async () => {
    const runtime = await options.runtimeStatus?.();
    return {
      ok: true,
      service: "threadlight",
      providers: {
        ai: options.config.AI_PROVIDER,
        scripture: options.config.SCRIPTURE_PROVIDER,
      },
      ...(runtime ? { runtime } : {}),
    };
  });

  app.get("/api/readiness", async (_request, reply) => {
    const runtime = await options.runtimeStatus?.();
    const discordEnabled = runtime?.discord.enabled ?? options.config.DISCORD_ENABLED;
    const discordReady = runtime?.discord.ready ?? !options.config.DISCORD_ENABLED;
    const ready = !discordEnabled || discordReady;
    const discord = runtime?.discord ?? {
      enabled: options.config.DISCORD_ENABLED,
      ready: !options.config.DISCORD_ENABLED,
      state: options.config.DISCORD_ENABLED ? "unknown" : "disabled",
    };
    const participation = discord.participation ?? {
      mode: options.config.DISCORD_PARTICIPATION_MODE,
      quietWindowMs: options.config.DISCORD_AMBIENT_QUIET_SECONDS * 1_000,
      cooldownMs: options.config.DISCORD_AMBIENT_COOLDOWN_SECONDS * 1_000,
      maxQueueDepth: options.config.DISCORD_MAX_QUEUE_DEPTH,
      pendingConversations: 0,
      queuedMessages: 0,
    };
    return reply.code(ready ? 200 : 503).send({
      ready,
      development: {
        discord: {
          ...discord,
          participation: {
            ...participation,
            configuredMode: options.config.DISCORD_PARTICIPATION_MODE,
          },
          installUrl:
            options.config.DISCORD_ENABLED && options.config.DISCORD_APPLICATION_ID
              ? getDiscordInstallUrl(
                  options.config.DISCORD_APPLICATION_ID,
                  options.config.DISCORD_GUILD_ID,
                )
              : null,
          channelConfigured: Boolean(options.config.DISCORD_CHANNEL_ID),
        },
        ai: options.config.AI_PROVIDER,
        scripture: options.config.SCRIPTURE_PROVIDER,
      },
      competition: competitionReadiness(options.config),
    });
  });

  const controlStore = options.controlStore;
  const runtimeManager = options.runtimeManager;
  if (controlStore && runtimeManager) {
    app.addHook("onRequest", async (request, reply) => {
      if (!isProtectedControlRoute(request.url) || !requiresRemoteControlToken(options.config))
        return;
      const token = options.config.THREADLIGHT_CONTROL_TOKEN;
      if (!token) {
        return reply.code(503).send({
          error: "control_access_not_configured",
          message: "Remote control requires THREADLIGHT_CONTROL_TOKEN.",
        });
      }
      if (!hasControlToken(request.headers.authorization, token)) {
        return reply.code(401).send({
          error: "control_access_required",
          message: "An operator access code is required.",
        });
      }
    });
    app.get("/api/control/status", async () => {
      const config = await controlStore.load();
      const runtime = await runtimeManager.status();
      return {
        catalog: DestinationCatalog,
        youtubeCallbackUrl: youtubeCallbackUrl(options.config),
        youtubeOAuthConfigured: Boolean(
          options.config.YOUTUBE_OAUTH_CLIENT_ID && options.config.YOUTUBE_OAUTH_CLIENT_SECRET,
        ),
        configuration: sanitizeConfig(config),
        runtime,
      };
    });

    app.post("/api/control/providers", async (request, reply) => {
      const parsed = ProviderUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "invalid_request", message: "Provider settings are invalid." });
      }
      await controlStore.update((config) => ({
        ...config,
        providers: {
          ai: { ...config.providers.ai, ...parsed.data.ai },
          scripture: { ...config.providers.scripture, ...parsed.data.scripture },
        },
      }));
      await runtimeManager.reconcile();
      return { ok: true };
    });

    app.post("/api/control/preview", async (request, reply) => {
      const parsed = ControlPreviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "invalid_request", message: "Enter a message for the test response." });
      }
      if (!controlPreviewLimiter.take(request.ip)) {
        return reply.code(429).send({
          error: "rate_limited",
          message: "Threadlight needs a moment before another test response.",
        });
      }

      const config = await controlStore.load();
      if (
        !providerConfigured(config.providers.ai) ||
        !["openai", "gloo"].includes(config.providers.ai.provider) ||
        !["ao", "youversion"].includes(config.providers.scripture.provider)
      ) {
        return reply.code(409).send({
          error: "provider_unavailable",
          message: "Save an executable AI and Scripture provider before running a test response.",
        });
      }

      try {
        const result = await controlRuntimeFactory(config).respond({
          context: {
            channelId: "control-preview",
            roomName: "Threadlight preview",
            messages: [],
          },
          prompt: parsed.data.prompt,
          source: "demo",
          intent: "reflection",
          trigger: "explicit",
        });
        return { reply: result.reply, decision: result.decision, trace: result.trace };
      } catch (error) {
        request.log.error(
          { errorName: error instanceof Error ? error.name : "UnknownError" },
          "Threadlight control preview failed",
        );
        return reply.code(502).send({
          error: "provider_unavailable",
          message: "Threadlight could not form a test response right now.",
        });
      }
    });

    app.post("/api/control/deployments", async (request, reply) => {
      const parsed = DeploymentCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "invalid_request", message: "Deployment settings are invalid." });
      }
      const destination = DestinationCatalog.find((entry) => entry.kind === parsed.data.kind);
      if (destination?.state !== "available") {
        return reply.code(409).send({
          error: "connector_unavailable",
          message: "This destination is planned but is not available in this release.",
        });
      }
      if (
        parsed.data.kind === "discord" &&
        (await controlStore.load()).deployments.some((deployment) => deployment.kind === "discord")
      ) {
        return reply.code(409).send({
          error: "deployment_exists",
          message:
            "This release supports one Discord deployment. Open the existing destination to edit it.",
        });
      }
      if (
        parsed.data.kind === "youtube-comments" &&
        (await controlStore.load()).deployments.some(
          (deployment) => deployment.kind === "youtube-comments",
        )
      ) {
        return reply.code(409).send({
          error: "deployment_exists",
          message:
            "This release supports one YouTube Comments deployment. Open the existing destination to edit it.",
        });
      }
      const now = new Date().toISOString();
      const deployment: Deployment = {
        id: randomUUID(),
        kind: parsed.data.kind,
        name: parsed.data.name ?? catalogLabel(parsed.data.kind),
        state: "draft",
        createdAt: now,
        updatedAt: now,
        ...(parsed.data.kind === "discord"
          ? {
              discord: {
                registerCommands: false,
                participationMode: "shy",
                quietSeconds: 20,
                cooldownSeconds: 180,
              },
            }
          : {}),
        ...(parsed.data.kind === "slack" ? { slack: {} } : {}),
        ...(parsed.data.kind === "youtube-comments"
          ? {
              youtube: {
                clientId: options.config.YOUTUBE_OAUTH_CLIENT_ID,
                clientSecret: options.config.YOUTUBE_OAUTH_CLIENT_SECRET,
                selectedVideos: [],
                replyMode: "review",
                pollSeconds: 180,
                dailyReplyLimit: 12,
                replyCount: 0,
                processedCommentIds: [],
                drafts: [],
              },
            }
          : {}),
      };
      await controlStore.update((config) => ({
        ...config,
        deployments: [...config.deployments, deployment],
      }));
      return reply.code(201).send({ id: deployment.id });
    });

    app.get("/api/control/deployments/:id/discord/locations", async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
      const query = z
        .object({ guildId: z.string().trim().min(1).max(80).optional() })
        .safeParse(request.query);
      if (!params.success || !query.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      const deployment = (await controlStore.load()).deployments.find(
        (entry) => entry.id === params.data.id && entry.kind === "discord",
      );
      const discord = deployment?.discord;
      if (!discord?.botToken) {
        return reply.code(409).send({
          error: "discord_not_connected",
          message: "Save a Discord bot token before choosing a server and channel.",
        });
      }
      const selectedGuildId = query.data.guildId ?? discord.guildId;
      try {
        const locations = await discordLocations(discord.botToken, selectedGuildId);
        return {
          ...locations,
          selectedGuildId,
          selectedChannelId: selectedGuildId === discord.guildId ? discord.channelId : undefined,
        };
      } catch (error) {
        return reply.code(409).send({
          error: "discord_locations_failed",
          message:
            error instanceof Error
              ? error.message
              : "Threadlight could not load Discord locations.",
        });
      }
    });

    app.patch("/api/control/deployments/:id", async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
      const parsed = DeploymentUpdateSchema.safeParse(request.body);
      if (!params.success || !parsed.success) {
        return reply
          .code(400)
          .send({ error: "invalid_request", message: "Deployment settings are invalid." });
      }
      const current = await controlStore.load();
      const existing = current.deployments.find((deployment) => deployment.id === params.data.id);
      if (!existing) return reply.code(404).send({ error: "not_found" });

      await controlStore.update((config) => ({
        ...config,
        deployments: config.deployments.map((deployment) =>
          deployment.id !== params.data.id
            ? deployment
            : {
                ...deployment,
                ...(parsed.data.name ? { name: parsed.data.name } : {}),
                ...(deployment.discord
                  ? { discord: { ...deployment.discord, ...parsed.data.discord } }
                  : {}),
                ...(deployment.slack
                  ? { slack: { ...deployment.slack, ...parsed.data.slack } }
                  : {}),
                ...(deployment.youtube
                  ? { youtube: { ...deployment.youtube, ...parsed.data.youtube } }
                  : {}),
                updatedAt: new Date().toISOString(),
              },
        ),
      }));
      await runtimeManager.reconcile();
      return { ok: true };
    });

    app.post("/api/control/deployments/:id/launch", async (request, reply) => {
      const parsed = z.object({ id: z.string().uuid() }).safeParse(request.params);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
      const config = await controlStore.load();
      const deployment = config.deployments.find((entry) => entry.id === parsed.data.id);
      if (!deployment) return reply.code(404).send({ error: "not_found" });
      if (deployment.kind === "youtube-comments") {
        if (!deploymentConfiguredForLaunch(deployment)) {
          return reply.code(409).send({
            error: "configuration_incomplete",
            message: "Connect the YouTube channel and configure Threadlight before launching.",
          });
        }
        if (
          !providerConfigured(config.providers.ai) ||
          !["openai", "gloo"].includes(config.providers.ai.provider) ||
          !["ao", "youversion"].includes(config.providers.scripture.provider)
        ) {
          return reply.code(409).send({
            error: "provider_unavailable",
            message:
              "Configure OpenAI or Gloo with AO Lab or YouVersion Scripture before launching YouTube Comments.",
          });
        }
        await runtimeManager.launch(parsed.data.id);
        return { ok: true };
      }
      if (deployment.kind !== "discord") {
        return reply.code(409).send({
          error: "connector_unavailable",
          message: "This destination is configured for a future connector release.",
        });
      }
      await runtimeManager.launch(parsed.data.id);
      return { ok: true };
    });

    app.post("/api/control/deployments/:id/pause", async (request, reply) => {
      const parsed = z.object({ id: z.string().uuid() }).safeParse(request.params);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
      const config = await controlStore.load();
      if (!config.deployments.some((entry) => entry.id === parsed.data.id)) {
        return reply.code(404).send({ error: "not_found" });
      }
      await runtimeManager.pause(parsed.data.id);
      return { ok: true };
    });

    app.get("/api/oauth/youtube/start", async (request, reply) => {
      const parsed = z.object({ deploymentId: z.string().uuid() }).safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
      const deployment = (await controlStore.load()).deployments.find(
        (entry) => entry.id === parsed.data.deploymentId && entry.kind === "youtube-comments",
      );
      const settings = deployment?.youtube;
      const oauth = youtubeOAuthConfig(options.config, settings);
      if (!oauth) {
        return reply.code(409).send({
          error: "configuration_incomplete",
          message: "YouTube sign-in is not configured on this Threadlight server.",
        });
      }
      const youtubeDeploymentId = deployment?.id;
      if (!youtubeDeploymentId) return reply.code(404).send({ error: "not_found" });
      return {
        authorizationUrl: youtube.authorizationUrl(
          {
            ...oauth,
          },
          signOAuthState(youtubeDeploymentId, oauth.clientSecret),
        ),
      };
    });

    app.get("/api/oauth/youtube/callback", async (request, reply) => {
      const parsed = z
        .object({
          code: z.string().min(1).optional(),
          state: z.string().min(1).optional(),
          error: z.string().optional(),
        })
        .safeParse(request.query);
      if (!parsed.success || !parsed.data.state || !parsed.data.code || parsed.data.error) {
        return reply.redirect(`${options.config.WEB_ORIGIN}/?youtube=connection-failed`);
      }
      const candidateId = parsed.data.state.split(".")[0];
      const deployment = (await controlStore.load()).deployments.find(
        (entry) => entry.id === candidateId && entry.kind === "youtube-comments",
      );
      const settings = deployment?.youtube;
      const oauth = youtubeOAuthConfig(options.config, settings);
      if (!settings || !oauth || !verifyOAuthState(parsed.data.state, oauth.clientSecret)) {
        return reply.redirect(`${options.config.WEB_ORIGIN}/?youtube=connection-failed`);
      }
      const youtubeDeploymentId = deployment?.id;
      if (!youtubeDeploymentId) {
        return reply.redirect(`${options.config.WEB_ORIGIN}/?youtube=connection-failed`);
      }
      try {
        const token = await youtube.exchangeCode(oauth, parsed.data.code);
        const channel = await youtube.ownedChannel(token.accessToken);
        await controlStore.update((config) => ({
          ...config,
          deployments: config.deployments.map((entry) =>
            entry.id === youtubeDeploymentId && entry.youtube
              ? {
                  ...entry,
                  youtube: {
                    ...entry.youtube,
                    clientId: oauth.clientId,
                    clientSecret: oauth.clientSecret,
                    channelId: channel.id,
                    channelName: channel.name,
                    refreshToken: token.refreshToken ?? entry.youtube.refreshToken,
                  },
                  updatedAt: new Date().toISOString(),
                }
              : entry,
          ),
        }));
        return reply.redirect(`${options.config.WEB_ORIGIN}/?youtube=connected`);
      } catch {
        return reply.redirect(`${options.config.WEB_ORIGIN}/?youtube=connection-failed`);
      }
    });

    app.get("/api/control/deployments/:id/youtube/videos", async (request, reply) => {
      const parsed = z.object({ id: z.string().uuid() }).safeParse(request.params);
      const query = z
        .object({ channelId: z.string().trim().min(1).max(160).optional() })
        .safeParse(request.query);
      if (!parsed.success || !query.success)
        return reply.code(400).send({ error: "invalid_request" });
      const deployment = (await controlStore.load()).deployments.find(
        (entry) => entry.id === parsed.data.id && entry.kind === "youtube-comments",
      );
      const settings = deployment?.youtube;
      const oauth = youtubeOAuthConfig(options.config, settings);
      if (!settings?.refreshToken || !oauth) {
        return reply.code(409).send({
          error: "youtube_not_connected",
          message: "Connect a YouTube account before choosing videos.",
        });
      }
      try {
        const token = await youtube.refresh(oauth, settings.refreshToken);
        const selectedChannelId = query.data.channelId ?? settings.channelId;
        if (!selectedChannelId) {
          return reply.code(409).send({
            error: "youtube_channel_missing",
            message: "Choose a YouTube channel before choosing videos.",
          });
        }
        const channels = await youtube.ownedChannels(token.accessToken);
        if (!channels.some((channel) => channel.id === selectedChannelId)) {
          return reply.code(409).send({
            error: "youtube_channel_invalid",
            message: "Choose a channel owned by the connected Google account.",
          });
        }
        return { videos: await youtube.ownedVideos(token.accessToken, selectedChannelId) };
      } catch (error) {
        return reply.code(409).send({
          error: "youtube_videos_failed",
          message:
            error instanceof Error ? error.message : "Threadlight could not list YouTube videos.",
        });
      }
    });

    app.get("/api/control/deployments/:id/youtube/channels", async (request, reply) => {
      const parsed = z.object({ id: z.string().uuid() }).safeParse(request.params);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
      const deployment = (await controlStore.load()).deployments.find(
        (entry) => entry.id === parsed.data.id && entry.kind === "youtube-comments",
      );
      const settings = deployment?.youtube;
      const oauth = youtubeOAuthConfig(options.config, settings);
      if (!settings?.refreshToken || !oauth) {
        return reply.code(409).send({
          error: "youtube_not_connected",
          message: "Connect a YouTube account before choosing a channel.",
        });
      }
      try {
        const token = await youtube.refresh(oauth, settings.refreshToken);
        return {
          channels: await youtube.ownedChannels(token.accessToken),
          selectedChannelId: settings.channelId,
        };
      } catch (error) {
        return reply.code(409).send({
          error: "youtube_channels_failed",
          message:
            error instanceof Error ? error.message : "Threadlight could not list YouTube channels.",
        });
      }
    });

    app.post("/api/control/deployments/:id/youtube/scan", async (request, reply) => {
      const parsed = z.object({ id: z.string().uuid() }).safeParse(request.params);
      if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
      try {
        await runtimeManager.scanYoutube(parsed.data.id);
        return { ok: true };
      } catch (error) {
        return reply.code(409).send({
          error: "youtube_scan_failed",
          message: error instanceof Error ? error.message : "YouTube scan failed.",
        });
      }
    });

    app.post(
      "/api/control/deployments/:id/youtube/drafts/:draftId/approve",
      async (request, reply) => {
        const parsed = z.object({ id: z.string().uuid(), draftId: z.string().uuid() }).safeParse({
          ...(request.params as object),
        });
        if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
        try {
          await runtimeManager.approveYoutubeDraft(parsed.data.id, parsed.data.draftId);
          return { ok: true };
        } catch (error) {
          return reply.code(409).send({
            error: "youtube_post_failed",
            message: error instanceof Error ? error.message : "YouTube reply failed.",
          });
        }
      },
    );

    app.post(
      "/api/control/deployments/:id/youtube/drafts/:draftId/reject",
      async (request, reply) => {
        const parsed = z.object({ id: z.string().uuid(), draftId: z.string().uuid() }).safeParse({
          ...(request.params as object),
        });
        if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
        await runtimeManager.rejectYoutubeDraft(parsed.data.id, parsed.data.draftId);
        return { ok: true };
      },
    );
  }

  app.get("/api/demo/scenarios", async () => ({
    scenarios: DEMO_SCENARIOS,
  }));

  app.post("/api/demo/respond", async (request, reply) => {
    if (requiresRemoteControlToken(options.config) && !options.config.THREADLIGHT_DEMO_ENABLED) {
      return reply.code(404).send({ error: "not_found" });
    }
    const clientId = request.ip;
    if (!publicDemoLimiter.take(clientId)) {
      return reply.code(429).send({
        error: "rate_limited",
        message: "Threadlight needs a moment before another response.",
      });
    }

    const parsed = DemoRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "The conversation request was not valid.",
      });
    }

    const scenario = DEMO_SCENARIOS.find((candidate) => candidate.id === parsed.data.scenarioId);
    if (!scenario) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "Choose one of the available preview scenarios.",
      });
    }

    const respond = async () => {
      const runtime = await getPublicDemoRuntime();
      return runtime.respond({
        context: {
          channelId: `demo:${scenario.id}`,
          roomName: scenario.roomName,
          messages: scenario.messages,
        },
        prompt: scenario.suggestedPrompt,
        source: "demo",
        intent: scenario.id === "prayer" ? "prayer" : "reflection",
      });
    };

    try {
      const result = await respond().catch(async (error) => {
        request.log.warn(
          { errorName: error instanceof Error ? error.name : "UnknownError" },
          "Threadlight public demo retrying after provider failure",
        );
        return respond();
      });

      return {
        reply:
          result.reply ??
          ({
            id: randomUUID(),
            message:
              "Threadlight chose not to interrupt this moment. Sometimes presence means leaving room for the people already speaking.",
          } as const),
        decision: result.decision,
        trace: result.trace,
      };
    } catch (error) {
      request.log.error(
        {
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
        "Threadlight response failed",
      );
      return reply.code(502).send({
        error: "provider_unavailable",
        message: "Threadlight could not form a response right now.",
      });
    }
  });

  const webRoot = fileURLToPath(new URL("../../web/dist", import.meta.url));
  if (existsSync(webRoot)) {
    await app.register(fastifyStatic, {
      root: webRoot,
      wildcard: false,
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.sendFile("index.html");
    });
  }

  return app;
}

function catalogLabel(kind: z.infer<typeof DestinationKindSchema>): string {
  return DestinationCatalog.find((entry) => entry.kind === kind)?.label ?? "Destination";
}

function deploymentConfiguredForLaunch(deployment: Deployment) {
  if (deployment.kind !== "youtube-comments") return true;
  return Boolean(
    deployment.youtube?.channelId &&
      deployment.youtube.clientId &&
      deployment.youtube.clientSecret &&
      deployment.youtube.refreshToken &&
      deployment.youtube.selectedVideos.length > 0,
  );
}

function youtubeOAuthConfig(
  config: ThreadlightConfig,
  settings: Deployment["youtube"] | undefined,
) {
  const clientId = config.YOUTUBE_OAUTH_CLIENT_ID ?? settings?.clientId;
  const clientSecret = config.YOUTUBE_OAUTH_CLIENT_SECRET ?? settings?.clientSecret;
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret, redirectUri: youtubeCallbackUrl(config) };
}

function youtubeCallbackUrl(config: ThreadlightConfig) {
  return `${config.THREADLIGHT_PUBLIC_URL}/api/oauth/youtube/callback`;
}

function isProtectedControlRoute(url: string) {
  return url.startsWith("/api/control/") || url.startsWith("/api/oauth/youtube/start");
}

function requiresRemoteControlToken(config: ThreadlightConfig) {
  const hostname = new URL(config.THREADLIGHT_PUBLIC_URL).hostname;
  return !["127.0.0.1", "::1", "localhost"].includes(hostname);
}

function hasControlToken(authorization: string | undefined, expected: string) {
  const candidate = authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!candidate) return false;
  const supplied = Buffer.from(candidate);
  const required = Buffer.from(expected);
  return supplied.length === required.length && timingSafeEqual(supplied, required);
}

class MemoryRateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #entries = new Map<string, { count: number; resetAt: number }>();

  constructor(limit: number, windowMs: number) {
    this.#limit = limit;
    this.#windowMs = windowMs;
  }

  take(key: string) {
    const now = Date.now();
    const current = this.#entries.get(key);
    if (!current || current.resetAt <= now) {
      this.#entries.set(key, { count: 1, resetAt: now + this.#windowMs });
      return true;
    }
    if (current.count >= this.#limit) return false;
    current.count += 1;
    return true;
  }
}
