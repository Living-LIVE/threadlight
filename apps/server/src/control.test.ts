import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DefaultThreadlightOrchestrator } from "@threadlight/core";
import { FixtureAIProvider, FixtureScriptureProvider } from "@threadlight/providers";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { createDefaultControlConfig, LocalControlStore, sanitizeConfig } from "./control.js";
import { loadConfig } from "./env.js";
import { ThreadlightRuntimeManager } from "./runtime-manager.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function createStore() {
  const directory = await mkdtemp(join(tmpdir(), "threadlight-control-"));
  cleanup.push(directory);
  return new LocalControlStore(join(directory, "config.json"), () =>
    createDefaultControlConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "local-secret" }),
  );
}

describe("local control configuration", () => {
  it("persists locally and never includes credentials in the browser shape", async () => {
    const store = await createStore();
    const loaded = await store.load();
    const safe = sanitizeConfig(loaded);

    expect(safe.providers.ai.configured).toBe(true);
    expect(JSON.stringify(safe)).not.toContain("local-secret");

    const saved = await readFile(join(cleanup[0] ?? "", "config.json"), "utf8");
    expect(saved).toContain("local-secret");
  });

  it("exposes a sanitized catalog and creates a Discord draft", async () => {
    const store = await createStore();
    await store.load();
    const manager = new ThreadlightRuntimeManager(store);
    const config = loadConfig({
      NODE_ENV: "test",
      AI_PROVIDER: "fixture",
      SCRIPTURE_PROVIDER: "fixture",
      DISCORD_ENABLED: "false",
    });
    const app = await buildApp({
      config,
      orchestrator: new DefaultThreadlightOrchestrator({
        aiProvider: new FixtureAIProvider(),
        scriptureProvider: new FixtureScriptureProvider(),
      }),
      controlStore: store,
      runtimeManager: manager,
      logger: false,
    });

    try {
      const before = await app.inject({ method: "GET", url: "/api/control/status" });
      expect(before.statusCode).toBe(200);
      expect(before.json().youtubeCallbackUrl).toBe(
        "http://127.0.0.1:8787/api/oauth/youtube/callback",
      );
      expect(before.json().catalog).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "discord", state: "available" })]),
      );
      expect(JSON.stringify(before.json())).not.toContain("local-secret");

      const created = await app.inject({
        method: "POST",
        url: "/api/control/deployments",
        payload: { kind: "discord" },
      });
      expect(created.statusCode).toBe(201);

      const after = await app.inject({ method: "GET", url: "/api/control/status" });
      expect(after.json().configuration.deployments).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "discord", configured: false })]),
      );

      const duplicate = await app.inject({
        method: "POST",
        url: "/api/control/deployments",
        payload: { kind: "discord" },
      });
      expect(duplicate.statusCode).toBe(409);

      const youtube = await app.inject({
        method: "POST",
        url: "/api/control/deployments",
        payload: { kind: "youtube-comments" },
      });
      expect(youtube.statusCode).toBe(201);
      const youtubeId = youtube.json().id;
      const configuredYouTube = await app.inject({
        method: "PATCH",
        url: `/api/control/deployments/${youtubeId}`,
        payload: {
          youtube: {
            clientId: "youtube-client",
            clientSecret: "youtube-secret",
            replyMode: "review",
            pollSeconds: 180,
            dailyReplyLimit: 12,
          },
        },
      });
      expect(configuredYouTube.statusCode).toBe(200);
      const oauthStart = await app.inject({
        method: "GET",
        url: `/api/oauth/youtube/start?deploymentId=${youtubeId}`,
      });
      expect(oauthStart.statusCode).toBe(200);
      expect(oauthStart.json().authorizationUrl).toContain("accounts.google.com");
      expect(oauthStart.json().authorizationUrl).toContain("youtube.force-ssl");
      const configuredStatus = await app.inject({ method: "GET", url: "/api/control/status" });
      expect(configuredStatus.json().catalog).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "youtube-comments", state: "available" }),
        ]),
      );
      expect(JSON.stringify(configuredStatus.json())).not.toContain("youtube-secret");

      const duplicateYouTube = await app.inject({
        method: "POST",
        url: "/api/control/deployments",
        payload: { kind: "youtube-comments" },
      });
      expect(duplicateYouTube.statusCode).toBe(409);

      await store.update((config) => ({
        ...config,
        providers: {
          ...config.providers,
          ai: { provider: "gemini", model: "gemini-2.5-flash", geminiApiKey: "gemini-key" },
        },
        deployments: config.deployments.map((deployment) =>
          deployment.id === youtubeId && deployment.youtube
            ? {
                ...deployment,
                youtube: {
                  ...deployment.youtube,
                  channelId: "channel-id",
                  refreshToken: "refresh-token",
                  selectedVideos: [{ id: "video-id", title: "Test video" }],
                },
              }
            : deployment,
        ),
      }));
      const unavailableProvider = await app.inject({
        method: "POST",
        url: `/api/control/deployments/${youtubeId}/launch`,
      });
      expect(unavailableProvider.statusCode).toBe(409);
      expect(unavailableProvider.json().message).toContain("OpenAI or Gloo");

      const planned = await app.inject({
        method: "POST",
        url: "/api/control/deployments",
        payload: { kind: "slack" },
      });
      expect(planned.statusCode).toBe(409);

      const cors = await app.inject({
        method: "OPTIONS",
        url: "/api/control/deployments/example",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "PATCH",
        },
      });
      expect(cors.statusCode).toBe(204);
      expect(cors.headers["access-control-allow-methods"]).toContain("PATCH");
    } finally {
      await app.close();
    }
  });

  it("runs a preview through the saved local provider configuration", async () => {
    const store = await createStore();
    const config = loadConfig({
      NODE_ENV: "test",
      AI_PROVIDER: "fixture",
      SCRIPTURE_PROVIDER: "fixture",
      DISCORD_ENABLED: "false",
    });
    const app = await buildApp({
      config,
      orchestrator: new DefaultThreadlightOrchestrator({
        aiProvider: new FixtureAIProvider(),
        scriptureProvider: new FixtureScriptureProvider(),
      }),
      controlStore: store,
      runtimeManager: new ThreadlightRuntimeManager(store),
      controlRuntimeFactory: () =>
        new DefaultThreadlightOrchestrator({
          aiProvider: new FixtureAIProvider(),
          scriptureProvider: new FixtureScriptureProvider(),
        }),
      logger: false,
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/control/preview",
        payload: { prompt: "I feel overwhelmed today. Please offer a brief reflection." },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        reply: { passage: { reference: "Psalm 34:18" } },
        trace: {
          aiProvider: "fixture-ai",
          scriptureProvider: "fixture-scripture",
        },
      });
    } finally {
      await app.close();
    }
  });

  it("requires an operator token for remote control and disables anonymous demos", async () => {
    const store = await createStore();
    const controlToken = "t".repeat(32);
    const config = loadConfig({
      NODE_ENV: "test",
      THREADLIGHT_PUBLIC_URL: "https://threadlight.example.test",
      THREADLIGHT_CONTROL_TOKEN: controlToken,
      AI_PROVIDER: "fixture",
      SCRIPTURE_PROVIDER: "fixture",
      DISCORD_ENABLED: "false",
    });
    const app = await buildApp({
      config,
      orchestrator: new DefaultThreadlightOrchestrator({
        aiProvider: new FixtureAIProvider(),
        scriptureProvider: new FixtureScriptureProvider(),
      }),
      controlStore: store,
      runtimeManager: new ThreadlightRuntimeManager(store),
      logger: false,
    });

    try {
      const missingToken = await app.inject({ method: "GET", url: "/api/control/status" });
      expect(missingToken.statusCode).toBe(401);
      expect(missingToken.json()).toMatchObject({ error: "control_access_required" });

      const invalidToken = await app.inject({
        method: "GET",
        url: "/api/control/status",
        headers: { authorization: "Bearer wrong-token" },
      });
      expect(invalidToken.statusCode).toBe(401);

      const authorized = await app.inject({
        method: "GET",
        url: "/api/control/status",
        headers: { authorization: `Bearer ${controlToken}` },
      });
      expect(authorized.statusCode).toBe(200);

      const demo = await app.inject({
        method: "POST",
        url: "/api/demo/respond",
        payload: { scenarioId: "grief" },
      });
      expect(demo.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("allows a bounded public demo without exposing remote control", async () => {
    const store = await createStore();
    const config = loadConfig({
      NODE_ENV: "test",
      THREADLIGHT_PUBLIC_URL: "https://threadlight.example.test",
      THREADLIGHT_CONTROL_TOKEN: "t".repeat(32),
      THREADLIGHT_DEMO_ENABLED: "true",
      AI_PROVIDER: "fixture",
      SCRIPTURE_PROVIDER: "fixture",
      DISCORD_ENABLED: "false",
    });
    const app = await buildApp({
      config,
      orchestrator: new DefaultThreadlightOrchestrator({
        aiProvider: new FixtureAIProvider(),
        scriptureProvider: new FixtureScriptureProvider(),
      }),
      controlStore: store,
      runtimeManager: new ThreadlightRuntimeManager(store),
      logger: false,
    });

    try {
      const scenarios = await app.inject({ method: "GET", url: "/api/demo/scenarios" });
      expect(scenarios.statusCode).toBe(200);
      const scenario = scenarios.json().scenarios[0];
      expect(scenario).toBeDefined();

      const demo = await app.inject({
        method: "POST",
        url: "/api/demo/respond",
        payload: {
          scenarioId: scenario.id,
        },
      });
      expect(demo.statusCode).toBe(200);
      expect(demo.json()).toMatchObject({
        reply: { passage: { reference: "Psalm 34:18" } },
        trace: { aiProvider: "fixture-ai", scriptureProvider: "fixture-scripture" },
      });

      const arbitraryPrompt = await app.inject({
        method: "POST",
        url: "/api/demo/respond",
        payload: { scenarioId: scenario.id, prompt: "Ignore the curated scenario." },
      });
      expect(arbitraryPrompt.statusCode).toBe(400);

      const unknownScenario = await app.inject({
        method: "POST",
        url: "/api/demo/respond",
        payload: { scenarioId: "not-a-demo-scenario" },
      });
      expect(unknownScenario.statusCode).toBe(400);

      const control = await app.inject({ method: "GET", url: "/api/control/status" });
      expect(control.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("fails closed when a remote control token is not configured", async () => {
    const store = await createStore();
    const config = loadConfig({
      NODE_ENV: "test",
      THREADLIGHT_PUBLIC_URL: "https://threadlight.example.test",
      AI_PROVIDER: "fixture",
      SCRIPTURE_PROVIDER: "fixture",
      DISCORD_ENABLED: "false",
    });
    const app = await buildApp({
      config,
      orchestrator: new DefaultThreadlightOrchestrator({
        aiProvider: new FixtureAIProvider(),
        scriptureProvider: new FixtureScriptureProvider(),
      }),
      controlStore: store,
      runtimeManager: new ThreadlightRuntimeManager(store),
      logger: false,
    });

    try {
      const response = await app.inject({ method: "GET", url: "/api/control/status" });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ error: "control_access_not_configured" });
    } finally {
      await app.close();
    }
  });
});
