import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { DEMO_SCENARIOS, type ThreadlightOrchestrator } from "@threadlight/core";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { competitionReadiness, type ThreadlightConfig } from "./env.js";

const AuthorSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(80),
  avatarUrl: z.string().url().optional(),
  isAgent: z.boolean().optional(),
});

const MessageSchema = z.object({
  id: z.string().min(1).max(120),
  author: AuthorSchema,
  content: z.string().min(1).max(2_000),
  createdAt: z.string().datetime(),
});

const DemoRequestSchema = z.object({
  scenarioId: z.string().min(1).max(80),
  messages: z.array(MessageSchema).max(30),
  prompt: z.string().min(1).max(2_000),
});

type BuildAppOptions = {
  config: ThreadlightConfig;
  orchestrator: ThreadlightOrchestrator;
  logger?: boolean;
  runtimeStatus?: () => {
    discord: {
      enabled: boolean;
      ready: boolean;
      state: string;
    };
  };
};

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      options.logger ??
      (options.config.NODE_ENV === "test" ? false : { level: options.config.LOG_LEVEL }),
    bodyLimit: 64 * 1024,
  });
  const limiter = new MemoryRateLimiter(20, 60_000);

  await app.register(cors, {
    origin: options.config.WEB_ORIGIN,
    methods: ["GET", "POST"],
  });

  app.get("/api/health", async () => {
    const runtime = options.runtimeStatus?.();
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
    const runtime = options.runtimeStatus?.();
    const ready = !runtime?.discord.enabled || runtime.discord.ready;
    return reply.code(ready ? 200 : 503).send({
      ready,
      development: {
        discord: runtime?.discord ?? {
          enabled: options.config.DISCORD_ENABLED,
          ready: !options.config.DISCORD_ENABLED,
          state: options.config.DISCORD_ENABLED ? "unknown" : "disabled",
        },
        ai: options.config.AI_PROVIDER,
        scripture: options.config.SCRIPTURE_PROVIDER,
      },
      competition: competitionReadiness(options.config),
    });
  });

  app.get("/api/demo/scenarios", async () => ({
    scenarios: DEMO_SCENARIOS,
  }));

  app.post("/api/demo/respond", async (request, reply) => {
    const clientId = request.ip;
    if (!limiter.take(clientId)) {
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

    try {
      const result = await options.orchestrator.respond({
        context: {
          channelId: `demo:${parsed.data.scenarioId}`,
          roomName:
            DEMO_SCENARIOS.find((scenario) => scenario.id === parsed.data.scenarioId)?.roomName ??
            "Threadlight Demo",
          messages: parsed.data.messages,
        },
        prompt: parsed.data.prompt,
        source: "demo",
        intent: parsed.data.scenarioId === "prayer" ? "prayer" : "reflection",
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
