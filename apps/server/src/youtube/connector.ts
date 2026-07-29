import { randomUUID } from "node:crypto";
import type { ThreadlightOrchestrator } from "@threadlight/core";
import type { ActivityInput, ActivityRecorder } from "../activity.js";
import type { Deployment, LocalControlStore, YouTubeSettings } from "../control.js";
import { YouTubeClient } from "./client.js";

export type YouTubeConnectorStatus = {
  id: string;
  state: "draft" | "running" | "paused" | "error";
  ready: boolean;
  message?: string;
  lastPollAt?: string;
  pendingDrafts: number;
  replyCount: number;
};

export class YouTubeConnector {
  private timer?: NodeJS.Timeout;
  private scanInFlight?: Promise<void>;
  private stopped = true;

  public constructor(
    private readonly deploymentId: string,
    private readonly store: LocalControlStore,
    private readonly orchestrator: ThreadlightOrchestrator,
    private readonly client = new YouTubeClient(),
    private readonly activity?: ActivityRecorder,
  ) {}

  public async start() {
    this.stopped = false;
    await this.scan();
    this.schedule();
  }

  public async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  public scan() {
    if (!this.scanInFlight) {
      this.scanInFlight = this.scanInternal().finally(() => {
        this.scanInFlight = undefined;
      });
    }
    return this.scanInFlight;
  }

  private async scanInternal() {
    const deployment = await this.deployment();
    const settings = requiredSettings(deployment);
    const token = await this.client.refresh(oauthConfig(settings), required(settings.refreshToken));
    const comments = await this.client.recentCommentsForVideos(
      token.accessToken,
      settings.selectedVideos.map((video) => video.id),
    );
    const existing = new Set(settings.processedCommentIds);
    const candidates = comments.filter(
      (comment) =>
        !existing.has(comment.id) &&
        comment.canReply &&
        comment.authorId !== settings.channelId &&
        comment.text.trim().length > 0,
    );

    for (const comment of candidates) {
      await this.process(comment, deployment, settings);
    }

    await this.store.update((config) =>
      updateYoutube(config, this.deploymentId, (youtube) => ({
        ...youtube,
        lastPollAt: new Date().toISOString(),
        lastError: undefined,
      })),
    );
  }

  public async approve(draftId: string) {
    const deployment = await this.deployment();
    const settings = requiredSettings(deployment);
    const draft = settings.drafts.find(
      (entry) => entry.id === draftId && entry.status === "pending",
    );
    if (!draft) throw new Error("That YouTube reply draft is no longer available.");
    if (!canReplyToday(settings))
      throw new Error("The daily YouTube reply limit has been reached.");
    const token = await this.client.refresh(oauthConfig(settings), required(settings.refreshToken));
    try {
      await this.client.reply(token.accessToken, draft.commentId, draft.replyText);
      await this.resolveDraft(draftId, "posted");
      await this.record({
        source: "youtube",
        status: "posted",
        sourceId: draft.commentId,
        actor: draft.authorName,
        input: draft.commentText,
        output: draft.replyText,
        destination: settings.channelName,
        reference: draft.videoTitle ?? draft.videoId,
      });
    } catch (error) {
      await this.resolveDraft(
        draftId,
        "failed",
        error instanceof Error ? error.message : "YouTube reply failed.",
      );
      await this.record({
        source: "youtube",
        status: "error",
        sourceId: draft.commentId,
        reason: error instanceof Error ? error.message : "YouTube reply failed.",
        destination: settings.channelName,
        reference: draft.videoTitle ?? draft.videoId,
      });
      throw error;
    }
  }

  public async reject(draftId: string) {
    const deployment = await this.deployment();
    const draft = deployment.youtube?.drafts.find((entry) => entry.id === draftId);
    await this.resolveDraft(draftId, "rejected");
    if (draft) {
      await this.record({
        source: "youtube",
        status: "skipped",
        sourceId: draft.commentId,
        actor: draft.authorName,
        input: draft.commentText,
        reason: "The operator rejected this reply draft.",
        destination: deployment.youtube?.channelName,
        reference: draft.videoTitle ?? draft.videoId,
      });
    }
  }

  private async process(
    comment: { id: string; videoId: string; videoTitle?: string; authorName: string; text: string },
    deployment: Deployment,
    settings: YouTubeSettings,
  ) {
    await this.record({
      source: "youtube",
      status: "observed",
      sourceId: comment.id,
      actor: comment.authorName,
      input: comment.text,
      destination: settings.channelName,
      reference: comment.videoTitle ?? comment.videoId,
    });
    const result = await this.orchestrator.respond({
      context: {
        channelId: `youtube:${deployment.id}:${comment.videoId}`,
        roomName: settings.channelName ?? "YouTube comments",
        messages: [
          {
            id: comment.id,
            author: { id: comment.authorName, name: comment.authorName },
            content: comment.text,
            createdAt: new Date().toISOString(),
          },
        ],
      },
      prompt: "Respond only if this comment invites a brief, thoughtful, Scripture-grounded reply.",
      source: "youtube",
      // High-touch mode intentionally asks the orchestrator to engage on every eligible comment;
      // the review queue still prevents automatic public posting.
      trigger: settings.replyMode === "high-touch" ? "every-message" : "ambient",
    });
    const eligibleForPublicEngagement =
      result.decision.action === "respond" && result.decision.riskLevel !== "urgent";
    if (!eligibleForPublicEngagement) {
      await this.record({
        source: "youtube",
        status: "skipped",
        sourceId: comment.id,
        actor: comment.authorName,
        input: comment.text,
        reason: result.decision.reason,
        destination: settings.channelName,
        reference: comment.videoTitle ?? comment.videoId,
        provider: `${result.trace.aiProvider} + ${result.trace.scriptureProvider}`,
        durationMs: result.trace.totalMs,
      });
      await this.store.update((config) =>
        updateYoutube(config, this.deploymentId, (current) => ({
          ...current,
          processedCommentIds: [...current.processedCommentIds, comment.id].slice(-500),
          ...(result.decision.riskLevel === "urgent" || result.decision.action === "escalate"
            ? {
                lastSafetyAlert:
                  "A sensitive YouTube comment was not queued or posted automatically.",
              }
            : {}),
        })),
      );
      return;
    }
    if (settings.replyMode === "selective" && result.reply && result.decision.action !== "silent") {
      if (!canReplyToday(settings)) {
        await this.store.update((config) =>
          updateYoutube(config, this.deploymentId, (current) => ({
            ...current,
            processedCommentIds: [...current.processedCommentIds, comment.id].slice(-500),
          })),
        );
        return;
      }
      const token = await this.client.refresh(
        oauthConfig(settings),
        required(settings.refreshToken),
      );
      await this.client.reply(token.accessToken, comment.id, result.reply.message);
      await this.record({
        source: "youtube",
        status: "posted",
        sourceId: comment.id,
        actor: comment.authorName,
        input: comment.text,
        output: result.reply.message,
        destination: settings.channelName,
        reference: comment.videoTitle ?? comment.videoId,
        provider: `${result.trace.aiProvider} + ${result.trace.scriptureProvider}`,
        durationMs: result.trace.totalMs,
      });
      await this.store.update((config) =>
        updateYoutube(config, this.deploymentId, (current) => ({
          ...current,
          processedCommentIds: [...current.processedCommentIds, comment.id].slice(-500),
          replyCountDate: new Date().toISOString().slice(0, 10),
          replyCount:
            current.replyCountDate === new Date().toISOString().slice(0, 10)
              ? current.replyCount + 1
              : 1,
        })),
      );
      return;
    }

    await this.store.update((config) =>
      updateYoutube(config, this.deploymentId, (current) => {
        const processedCommentIds = [...current.processedCommentIds, comment.id].slice(-500);
        if (!result.reply || result.decision.action === "silent")
          return { ...current, processedCommentIds };
        const draft = {
          id: randomUUID(),
          commentId: comment.id,
          videoId: comment.videoId,
          ...(comment.videoTitle ? { videoTitle: comment.videoTitle } : {}),
          authorName: comment.authorName,
          commentText: comment.text.slice(0, 1_000),
          replyText: result.reply.message.slice(0, 2_000),
          status: "pending" as const,
          createdAt: new Date().toISOString(),
        };
        return {
          ...current,
          processedCommentIds,
          drafts: [...current.drafts, draft].slice(-100),
        };
      }),
    );
    if (result.reply) {
      await this.record({
        source: "youtube",
        status: "drafted",
        sourceId: comment.id,
        actor: comment.authorName,
        input: comment.text,
        output: result.reply.message,
        destination: settings.channelName,
        reference: comment.videoTitle ?? comment.videoId,
        provider: `${result.trace.aiProvider} + ${result.trace.scriptureProvider}`,
        durationMs: result.trace.totalMs,
      });
    }
  }

  private async resolveDraft(
    draftId: string,
    status: "posted" | "rejected" | "failed",
    error?: string,
  ) {
    await this.store.update((config) =>
      updateYoutube(config, this.deploymentId, (youtube) => {
        const today = new Date().toISOString().slice(0, 10);
        const replyCount =
          status === "posted"
            ? youtube.replyCountDate === today
              ? youtube.replyCount + 1
              : 1
            : youtube.replyCount;
        return {
          ...youtube,
          replyCountDate: status === "posted" ? today : youtube.replyCountDate,
          replyCount,
          drafts: youtube.drafts.map((draft) =>
            draft.id === draftId
              ? {
                  ...draft,
                  status,
                  resolvedAt: new Date().toISOString(),
                  ...(error ? { error } : {}),
                }
              : draft,
          ),
        };
      }),
    );
  }

  private schedule() {
    if (this.stopped) return;
    void this.deployment().then((deployment) => {
      const delay = deployment.youtube?.pollSeconds ?? 180;
      this.timer = setTimeout(() => {
        void this.scan()
          .catch(async (error) => {
            await this.record({
              source: "youtube",
              status: "error",
              reason: error instanceof Error ? error.message : "YouTube polling failed.",
            });
            await this.store.update((config) =>
              updateYoutube(config, this.deploymentId, (youtube) => ({
                ...youtube,
                lastError:
                  error instanceof Error ? error.message.slice(0, 300) : "YouTube polling failed.",
              })),
            );
          })
          .finally(() => this.schedule());
      }, delay * 1_000);
    });
  }

  private async deployment() {
    const deployment = (await this.store.load()).deployments.find(
      (entry) => entry.id === this.deploymentId,
    );
    if (deployment?.kind !== "youtube-comments" || !deployment.youtube) {
      throw new Error("The YouTube deployment is unavailable.");
    }
    return deployment;
  }

  private record(input: ActivityInput): Promise<void> {
    return this.activity?.record(input).catch(() => undefined) ?? Promise.resolve();
  }
}

function requiredSettings(deployment: Deployment) {
  if (!deployment.youtube || !deploymentConfigured(deployment.youtube)) {
    throw new Error("Complete the YouTube connection before launching.");
  }
  return deployment.youtube;
}

function deploymentConfigured(settings: YouTubeSettings) {
  return Boolean(
    settings.channelId &&
      settings.clientId &&
      settings.clientSecret &&
      settings.refreshToken &&
      settings.selectedVideos.length > 0,
  );
}

function oauthConfig(settings: YouTubeSettings) {
  return {
    clientId: required(settings.clientId),
    clientSecret: required(settings.clientSecret),
    redirectUri: `${process.env.THREADLIGHT_PUBLIC_URL ?? "http://127.0.0.1:8787"}/api/oauth/youtube/callback`,
  };
}

function canReplyToday(settings: YouTubeSettings) {
  const today = new Date().toISOString().slice(0, 10);
  return (settings.replyCountDate === today ? settings.replyCount : 0) < settings.dailyReplyLimit;
}

function required(value: string | undefined) {
  if (!value) throw new Error("YouTube connection settings are missing.");
  return value;
}

function updateYoutube(
  config: Awaited<ReturnType<LocalControlStore["load"]>>,
  deploymentId: string,
  update: (youtube: YouTubeSettings) => YouTubeSettings,
) {
  return {
    ...config,
    deployments: config.deployments.map((deployment) =>
      deployment.id === deploymentId && deployment.youtube
        ? {
            ...deployment,
            youtube: update(deployment.youtube),
            updatedAt: new Date().toISOString(),
          }
        : deployment,
    ),
  };
}
