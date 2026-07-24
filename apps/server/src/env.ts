import { z } from "zod";

const booleanFromEnv = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) return defaultValue;
      return ["1", "true", "yes", "on"].includes(value.toLowerCase());
    });

const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
    WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    AI_PROVIDER: z.enum(["openai", "fixture"]).default("openai"),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
    SCRIPTURE_PROVIDER: z.enum(["ao", "fixture"]).default("ao"),
    AO_BIBLE_ID: z.string().default("BSB"),
    DISCORD_ENABLED: booleanFromEnv(true),
    DISCORD_APPLICATION_ID: z.string().optional(),
    DISCORD_PUBLIC_KEY: z.string().optional(),
    DISCORD_BOT_TOKEN: z.string().optional(),
    DISCORD_GUILD_ID: z.string().optional(),
    DISCORD_CHANNEL_ID: z.string().optional(),
    DISCORD_CARE_ROLE_ID: z.string().optional(),
    DISCORD_REGISTER_COMMANDS: booleanFromEnv(false),
    GLOO_CLIENT_ID: z.string().optional(),
    GLOO_CLIENT_SECRET: z.string().optional(),
    GLOO_MODEL: z.string().optional(),
    YVP_APP_KEY: z.string().optional(),
    YVP_BIBLE_ID: z.string().optional(),
  })
  .superRefine((config, context) => {
    if (config.AI_PROVIDER === "openai" && !config.OPENAI_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when AI_PROVIDER=openai",
      });
    }

    if (config.DISCORD_ENABLED) {
      for (const key of [
        "DISCORD_APPLICATION_ID",
        "DISCORD_BOT_TOKEN",
        "DISCORD_GUILD_ID",
        "DISCORD_CHANNEL_ID",
      ] as const) {
        if (!config[key]) {
          context.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required when DISCORD_ENABLED=true`,
          });
        }
      }
    }
  });

export type ThreadlightConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): ThreadlightConfig {
  return ConfigSchema.parse(environment);
}

export function competitionReadiness(config: ThreadlightConfig) {
  return {
    gloo: Boolean(config.GLOO_CLIENT_ID && config.GLOO_CLIENT_SECRET && config.GLOO_MODEL),
    youVersion: Boolean(config.YVP_APP_KEY && config.YVP_BIBLE_ID),
  };
}
