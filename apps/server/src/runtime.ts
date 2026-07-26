import { DefaultThreadlightOrchestrator, type ThreadlightOrchestrator } from "@threadlight/core";
import {
  AoLabScriptureProvider,
  FixtureAIProvider,
  FixtureScriptureProvider,
  GlooProvider,
  OpenAIProvider,
} from "@threadlight/providers";
import type { LocalControlConfig } from "./control.js";
import type { ThreadlightConfig } from "./env.js";

export function createThreadlightRuntime(config: ThreadlightConfig): ThreadlightOrchestrator {
  const aiProvider = createAiProvider(config);
  const scriptureProvider = createScriptureProvider(config);

  return new DefaultThreadlightOrchestrator({
    aiProvider,
    scriptureProvider,
  });
}

export function createDemoRuntime(config: ThreadlightConfig): ThreadlightOrchestrator {
  try {
    return createThreadlightRuntime(config);
  } catch {
    return new DefaultThreadlightOrchestrator({
      aiProvider: new FixtureAIProvider(),
      scriptureProvider: new FixtureScriptureProvider(),
    });
  }
}

export function createControlRuntime(config: LocalControlConfig): ThreadlightOrchestrator {
  if (!["openai", "gloo"].includes(config.providers.ai.provider)) {
    throw new Error(`No runtime adapter is installed for ${config.providers.ai.provider}`);
  }
  if (config.providers.scripture.provider !== "ao") {
    throw new Error(`No runtime adapter is installed for ${config.providers.scripture.provider}`);
  }

  const aiProvider =
    config.providers.ai.provider === "gloo"
      ? new GlooProvider({
          clientId: required(config.providers.ai.glooClientId, "GLOO_CLIENT_ID"),
          clientSecret: required(config.providers.ai.glooClientSecret, "GLOO_CLIENT_SECRET"),
          model: config.providers.ai.glooModel,
        })
      : new OpenAIProvider({
          apiKey: required(config.providers.ai.openaiApiKey, "OPENAI_API_KEY"),
          model: config.providers.ai.model,
        });

  return new DefaultThreadlightOrchestrator({
    aiProvider,
    scriptureProvider: new AoLabScriptureProvider({ bibleId: config.providers.scripture.bibleId }),
  });
}

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function createAiProvider(config: ThreadlightConfig) {
  if (config.AI_PROVIDER === "openai") {
    return new OpenAIProvider({
      apiKey: required(config.OPENAI_API_KEY, "OPENAI_API_KEY"),
      model: config.OPENAI_MODEL,
    });
  }
  if (config.AI_PROVIDER === "fixture") return new FixtureAIProvider();
  if (config.AI_PROVIDER === "gloo") {
    return new GlooProvider({
      clientId: required(config.GLOO_CLIENT_ID, "GLOO_CLIENT_ID"),
      clientSecret: required(config.GLOO_CLIENT_SECRET, "GLOO_CLIENT_SECRET"),
      model: config.GLOO_MODEL,
    });
  }
  throw new Error(`No runtime adapter is installed for ${config.AI_PROVIDER}`);
}

function createScriptureProvider(config: ThreadlightConfig) {
  if (config.SCRIPTURE_PROVIDER === "ao") {
    return new AoLabScriptureProvider({ bibleId: config.AO_BIBLE_ID });
  }
  if (config.SCRIPTURE_PROVIDER === "fixture") return new FixtureScriptureProvider();
  throw new Error(`No runtime adapter is installed for ${config.SCRIPTURE_PROVIDER}`);
}
