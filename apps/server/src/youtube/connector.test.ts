import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ThreadlightOrchestrator } from "@threadlight/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocalControlConfig } from "../control.js";
import { LocalControlStore } from "../control.js";
import type { YouTubeClient } from "./client.js";
import { YouTubeConnector } from "./connector.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function store(replyMode: "review" | "selective" | "high-touch" = "review") {
  const directory = await mkdtemp(join(tmpdir(), "threadlight-youtube-"));
  cleanup.push(directory);
  const now = new Date().toISOString();
  const config: LocalControlConfig = {
    version: 1,
    providers: {
      ai: { provider: "openai", model: "gpt-4.1-mini", openaiApiKey: "test-key" },
      scripture: { provider: "ao", bibleId: "BSB" },
    },
    deployments: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        kind: "youtube-comments",
        name: "YouTube Comments",
        state: "running",
        createdAt: now,
        updatedAt: now,
        youtube: {
          channelId: "owner-channel",
          channelName: "Test Channel",
          selectedVideos: [{ id: "video-1", title: "Test video" }],
          clientId: "client-id",
          clientSecret: "client-secret",
          refreshToken: "refresh-token",
          replyMode,
          pollSeconds: 180,
          dailyReplyLimit: 12,
          replyCount: 0,
          processedCommentIds: [],
          drafts: [],
        },
      },
    ],
  };
  return new LocalControlStore(join(directory, "config.json"), () => config);
}

describe("YouTubeConnector", () => {
  it("creates one review draft, deduplicates it, and posts only after approval", async () => {
    const controlStore = await store();
    const reply = vi.fn(async () => undefined);
    const client = {
      refresh: vi.fn(async () => ({ accessToken: "access-token", expiresIn: 3600 })),
      recentCommentsForVideos: vi.fn(async () => [
        {
          id: "comment-1",
          videoId: "video-1",
          authorId: "viewer-1",
          authorName: "Taylor",
          text: "Could you pray for me?",
          publishedAt: "2026-07-26T12:00:00.000Z",
          canReply: true,
        },
      ]),
      reply,
    } as unknown as YouTubeClient;
    const orchestrator = {
      respond: vi.fn(async () => ({
        decision: {
          action: "respond",
          riskLevel: "low",
          reason: "Asked for prayer",
          pastoralIntent: "Care",
          scriptureRequest: null,
        },
        reply: { id: "reply-1", message: "I am praying with you." },
        trace: {
          id: "trace-1",
          aiProvider: "fixture",
          scriptureProvider: "fixture",
          totalMs: 0,
          steps: [],
        },
      })),
    } as unknown as ThreadlightOrchestrator;
    const connector = new YouTubeConnector(
      "11111111-1111-4111-8111-111111111111",
      controlStore,
      orchestrator,
      client,
    );

    await connector.scan();
    await connector.scan();
    const draft = (await controlStore.load()).deployments[0]?.youtube?.drafts[0];
    expect((await controlStore.load()).deployments[0]?.youtube?.drafts).toHaveLength(1);
    expect(reply).not.toHaveBeenCalled();
    expect(draft?.status).toBe("pending");
    if (!draft) throw new Error("Expected a pending YouTube reply draft.");

    await connector.approve(draft.id);
    expect(reply).toHaveBeenCalledWith("access-token", "comment-1", "I am praying with you.");
    expect((await controlStore.load()).deployments[0]?.youtube?.drafts[0]?.status).toBe("posted");
  });

  it("serializes overlapping scans so a comment produces only one draft", async () => {
    const controlStore = await store();
    const client = {
      refresh: vi.fn(async () => ({ accessToken: "access-token", expiresIn: 3600 })),
      recentCommentsForVideos: vi.fn(async () => [
        {
          id: "comment-overlap",
          videoId: "video-1",
          authorId: "viewer-1",
          authorName: "Taylor",
          text: "Could you pray for me?",
          publishedAt: "2026-07-26T12:00:00.000Z",
          canReply: true,
        },
      ]),
      reply: vi.fn(async () => undefined),
    } as unknown as YouTubeClient;
    const connector = new YouTubeConnector(
      "11111111-1111-4111-8111-111111111111",
      controlStore,
      {
        respond: vi.fn(async () => ({
          decision: {
            action: "respond",
            riskLevel: "low",
            reason: "Asked for prayer",
            pastoralIntent: "Care",
            scriptureRequest: null,
          },
          reply: { id: "reply-overlap", message: "I am praying with you." },
          trace: {
            id: "trace-overlap",
            aiProvider: "fixture",
            scriptureProvider: "fixture",
            totalMs: 0,
            steps: [],
          },
        })),
      } as unknown as ThreadlightOrchestrator,
      client,
    );

    await Promise.all([connector.scan(), connector.scan(), connector.scan()]);

    expect((await controlStore.load()).deployments[0]?.youtube?.drafts).toHaveLength(1);
    expect(client.recentCommentsForVideos).toHaveBeenCalledTimes(1);
  });

  it("releases the scan lock after a failed poll so a later scan can recover", async () => {
    const controlStore = await store();
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary token failure"))
      .mockResolvedValue({ accessToken: "access-token", expiresIn: 3600 });
    const client = {
      refresh,
      recentCommentsForVideos: vi.fn(async () => []),
      reply: vi.fn(async () => undefined),
    } as unknown as YouTubeClient;
    const connector = new YouTubeConnector(
      "11111111-1111-4111-8111-111111111111",
      controlStore,
      { respond: vi.fn() } as unknown as ThreadlightOrchestrator,
      client,
    );

    await expect(connector.scan()).rejects.toThrow("temporary token failure");
    await expect(connector.scan()).resolves.toBeUndefined();

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(client.recentCommentsForVideos).toHaveBeenCalledTimes(1);
  });

  it("posts an eligible selective reply without creating a draft", async () => {
    const controlStore = await store("selective");
    const reply = vi.fn(async () => undefined);
    const client = {
      refresh: vi.fn(async () => ({ accessToken: "access-token", expiresIn: 3600 })),
      recentCommentsForVideos: vi.fn(async () => [
        {
          id: "comment-2",
          videoId: "video-1",
          authorName: "Taylor",
          text: "Thank you",
          publishedAt: "2026-07-26T12:00:00.000Z",
          canReply: true,
        },
      ]),
      reply,
    } as unknown as YouTubeClient;
    const orchestrator = {
      respond: vi.fn(async () => ({
        decision: {
          action: "respond",
          riskLevel: "low",
          reason: "Relevant",
          pastoralIntent: "Care",
          scriptureRequest: null,
        },
        reply: { id: "reply-2", message: "You are welcome." },
        trace: {
          id: "trace-2",
          aiProvider: "fixture",
          scriptureProvider: "fixture",
          totalMs: 0,
          steps: [],
        },
      })),
    } as unknown as ThreadlightOrchestrator;
    const connector = new YouTubeConnector(
      "11111111-1111-4111-8111-111111111111",
      controlStore,
      orchestrator,
      client,
    );

    await connector.scan();
    expect(reply).toHaveBeenCalledWith("access-token", "comment-2", "You are welcome.");
    expect((await controlStore.load()).deployments[0]?.youtube?.drafts).toEqual([]);
  });

  it("uses every-message orchestration in high-touch review mode", async () => {
    const controlStore = await store("high-touch");
    const client = {
      refresh: vi.fn(async () => ({ accessToken: "access-token", expiresIn: 3600 })),
      recentCommentsForVideos: vi.fn(async () => [
        {
          id: "comment-3",
          videoId: "video-1",
          authorName: "Taylor",
          text: "I am grateful for this message.",
          publishedAt: "2026-07-26T12:00:00.000Z",
          canReply: true,
        },
      ]),
      reply: vi.fn(async () => undefined),
    } as unknown as YouTubeClient;
    const respond = vi.fn(async () => ({
      decision: {
        action: "respond",
        riskLevel: "low",
        reason: "High-touch response",
        pastoralIntent: "Care",
        scriptureRequest: null,
      },
      reply: { id: "reply-3", message: "Thank you for being here." },
      trace: {
        id: "trace-3",
        aiProvider: "fixture",
        scriptureProvider: "fixture",
        totalMs: 0,
        steps: [],
      },
    }));
    const connector = new YouTubeConnector(
      "11111111-1111-4111-8111-111111111111",
      controlStore,
      { respond } as unknown as ThreadlightOrchestrator,
      client,
    );

    await connector.scan();

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ source: "youtube", trigger: "every-message" }),
    );
    expect((await controlStore.load()).deployments[0]?.youtube?.drafts).toHaveLength(1);
  });

  it("never queues or posts an urgent escalation in any reply mode", async () => {
    const controlStore = await store("selective");
    const reply = vi.fn(async () => undefined);
    const client = {
      refresh: vi.fn(async () => ({ accessToken: "access-token", expiresIn: 3600 })),
      recentCommentsForVideos: vi.fn(async () => [
        {
          id: "comment-urgent",
          videoId: "video-1",
          authorName: "Taylor",
          text: "I am in immediate danger.",
          publishedAt: "2026-07-26T12:00:00.000Z",
          canReply: true,
        },
      ]),
      reply,
    } as unknown as YouTubeClient;
    const connector = new YouTubeConnector(
      "11111111-1111-4111-8111-111111111111",
      controlStore,
      {
        respond: vi.fn(async () => ({
          decision: {
            action: "escalate",
            riskLevel: "urgent",
            reason: "Immediate safety concern",
            pastoralIntent: "Prioritize immediate human support and safety.",
            scriptureRequest: null,
          },
          reply: { id: "urgent-reply", message: "Please contact emergency support now." },
          trace: {
            id: "trace-urgent",
            aiProvider: "fixture",
            scriptureProvider: "fixture",
            totalMs: 0,
            steps: [],
          },
        })),
      } as unknown as ThreadlightOrchestrator,
      client,
    );

    await connector.scan();

    const settings = (await controlStore.load()).deployments[0]?.youtube;
    expect(reply).not.toHaveBeenCalled();
    expect(settings?.drafts).toEqual([]);
    expect(settings?.processedCommentIds).toContain("comment-urgent");
    expect(settings?.lastSafetyAlert).toContain("not queued or posted automatically");
  });
});
