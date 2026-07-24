import { DEMO_SCENARIOS, DefaultThreadlightOrchestrator } from "@threadlight/core";
import { FixtureAIProvider, FixtureScriptureProvider } from "@threadlight/providers";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { loadConfig } from "./env.js";

const openApps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

function fixtureApp() {
  const config = loadConfig({
    NODE_ENV: "test",
    AI_PROVIDER: "fixture",
    SCRIPTURE_PROVIDER: "fixture",
    DISCORD_ENABLED: "false",
  });
  const orchestrator = new DefaultThreadlightOrchestrator({
    aiProvider: new FixtureAIProvider(),
    scriptureProvider: new FixtureScriptureProvider(),
  });
  return buildApp({ config, orchestrator, logger: false }).then((app) => {
    openApps.push(app);
    return app;
  });
}

describe("Threadlight API", () => {
  it("reports active and competition provider readiness separately", async () => {
    const app = await fixtureApp();
    const response = await app.inject({ method: "GET", url: "/api/readiness" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      development: {
        discord: {
          enabled: false,
          ready: true,
          state: "disabled",
        },
        ai: "fixture",
        scripture: "fixture",
      },
      competition: {
        gloo: false,
        youVersion: false,
      },
    });
  });

  it("reports not ready while an enabled Discord gateway is starting", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      AI_PROVIDER: "fixture",
      SCRIPTURE_PROVIDER: "fixture",
      DISCORD_ENABLED: "true",
      DISCORD_APPLICATION_ID: "app-123",
      DISCORD_BOT_TOKEN: "test-token",
      DISCORD_GUILD_ID: "guild-456",
      DISCORD_CHANNEL_ID: "channel-789",
    });
    const orchestrator = new DefaultThreadlightOrchestrator({
      aiProvider: new FixtureAIProvider(),
      scriptureProvider: new FixtureScriptureProvider(),
    });
    const app = await buildApp({
      config,
      orchestrator,
      logger: false,
      runtimeStatus: () => ({
        discord: {
          enabled: true,
          ready: false,
          state: "starting",
          channelConfigured: true,
          installUrl: expect.stringContaining("guild_id=guild-456"),
        },
      }),
    });
    openApps.push(app);

    const response = await app.inject({ method: "GET", url: "/api/readiness" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      ready: false,
      development: {
        discord: {
          enabled: true,
          ready: false,
          state: "starting",
        },
      },
    });
  });

  it("does not infer readiness before an enabled Discord gateway starts", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      AI_PROVIDER: "fixture",
      SCRIPTURE_PROVIDER: "fixture",
      DISCORD_ENABLED: "true",
      DISCORD_APPLICATION_ID: "app-123",
      DISCORD_BOT_TOKEN: "test-token",
      DISCORD_GUILD_ID: "guild-456",
      DISCORD_CHANNEL_ID: "channel-789",
    });
    const orchestrator = new DefaultThreadlightOrchestrator({
      aiProvider: new FixtureAIProvider(),
      scriptureProvider: new FixtureScriptureProvider(),
    });
    const app = await buildApp({ config, orchestrator, logger: false });
    openApps.push(app);

    const response = await app.inject({ method: "GET", url: "/api/readiness" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      ready: false,
      development: {
        discord: {
          enabled: true,
          ready: false,
          state: "unknown",
          channelConfigured: true,
        },
      },
    });
  });

  it("returns the shared scenario catalog", async () => {
    const app = await fixtureApp();
    const response = await app.inject({ method: "GET", url: "/api/demo/scenarios" });

    expect(response.statusCode).toBe(200);
    expect(response.json().scenarios).toHaveLength(DEMO_SCENARIOS.length);
  });

  it("runs a demo conversation through the same orchestrator", async () => {
    const app = await fixtureApp();
    const scenario = DEMO_SCENARIOS[0];
    if (!scenario) throw new Error("Expected a demo scenario");

    const response = await app.inject({
      method: "POST",
      url: "/api/demo/respond",
      payload: {
        scenarioId: scenario.id,
        messages: scenario.messages,
        prompt: scenario.suggestedPrompt,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      reply: {
        passage: {
          reference: "Psalm 34:18",
        },
      },
      trace: {
        aiProvider: "fixture-ai",
        scriptureProvider: "fixture-scripture",
      },
    });
  });
});
