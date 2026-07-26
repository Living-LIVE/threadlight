import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type LocalControlConfig, LocalControlStore } from "./control.js";
import { ThreadlightRuntimeManager } from "./runtime-manager.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function createDiscordStore(): Promise<LocalControlStore> {
  const directory = await mkdtemp(join(tmpdir(), "threadlight-runtime-"));
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
        kind: "discord",
        name: "Discord",
        state: "draft",
        createdAt: now,
        updatedAt: now,
        discord: {
          applicationId: "app-id",
          botToken: "bot-token",
          guildId: "guild-id",
          channelId: "channel-id",
          registerCommands: false,
          participationMode: "shy",
          quietSeconds: 20,
          cooldownSeconds: 180,
        },
      },
    ],
  };
  return new LocalControlStore(join(directory, "config.json"), () => config);
}

async function createYouTubeStore(): Promise<LocalControlStore> {
  const directory = await mkdtemp(join(tmpdir(), "threadlight-runtime-youtube-"));
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
        id: "22222222-2222-4222-8222-222222222222",
        kind: "youtube-comments",
        name: "YouTube Comments",
        state: "draft",
        createdAt: now,
        updatedAt: now,
        youtube: {
          channelId: "channel-id",
          channelName: "Test Channel",
          selectedVideos: [{ id: "video-id", title: "Test video" }],
          clientId: "client-id",
          clientSecret: "client-secret",
          refreshToken: "refresh-token",
          replyMode: "review",
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

describe("ThreadlightRuntimeManager", () => {
  it("launches and pauses a configured Discord deployment without external side effects", async () => {
    const store = await createDiscordStore();
    let ready = false;
    const start = vi.fn(async () => {
      ready = true;
    });
    const stop = vi.fn(async () => {
      ready = false;
    });
    const manager = new ThreadlightRuntimeManager(store, {
      createGateway: () => ({
        get ready() {
          return ready;
        },
        get participationStatus() {
          return {
            mode: "shy" as const,
            quietWindowMs: 20_000,
            cooldownMs: 180_000,
            maxQueueDepth: 25,
            pendingConversations: 0,
            queuedMessages: 0,
          };
        },
        start,
        stop,
      }),
    });

    await manager.launch("11111111-1111-4111-8111-111111111111");
    const running = await manager.status();
    expect(start).toHaveBeenCalledOnce();
    expect(running.deployments[0]).toMatchObject({ state: "running", ready: true });

    await manager.pause("11111111-1111-4111-8111-111111111111");
    const paused = await manager.status();
    expect(stop).toHaveBeenCalledOnce();
    expect(paused.deployments[0]).toMatchObject({ state: "paused", ready: false });
  });

  it("keeps a failed Discord launch visible as an actionable error", async () => {
    const store = await createDiscordStore();
    const manager = new ThreadlightRuntimeManager(store, {
      createGateway: () => ({
        ready: false,
        participationStatus: {
          mode: "shy",
          quietWindowMs: 20_000,
          cooldownMs: 180_000,
          maxQueueDepth: 25,
          pendingConversations: 0,
          queuedMessages: 0,
        },
        start: async () => {
          throw new Error("Connection failed");
        },
        stop: async () => undefined,
      }),
    });

    await manager.launch("11111111-1111-4111-8111-111111111111");
    const status = await manager.status();
    expect(status.deployments[0]).toMatchObject({
      state: "error",
      ready: false,
      message: "Threadlight could not connect to Discord.",
    });
  });

  it("reports a started YouTube connector as ready in the local dashboard", async () => {
    const store = await createYouTubeStore();
    const start = vi.fn(async () => undefined);
    const manager = new ThreadlightRuntimeManager(store, {
      createYouTube: () => ({
        start,
        stop: async () => undefined,
        scan: async () => undefined,
        approve: async () => undefined,
        reject: async () => undefined,
      }),
    });

    await manager.launch("22222222-2222-4222-8222-222222222222");
    const status = await manager.status();

    expect(start).toHaveBeenCalledOnce();
    expect(status.activeDeploymentId).toBe("22222222-2222-4222-8222-222222222222");
    expect(status.deployments[0]).toMatchObject({ state: "running", ready: true });
  });
});
