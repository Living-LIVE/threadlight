import { DefaultThreadlightOrchestrator, type ThreadlightOrchestrator } from "@threadlight/core";
import {
  AoLabScriptureProvider,
  FixtureAIProvider,
  FixtureScriptureProvider,
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
  if (config.providers.ai.provider !== "openai") {
    throw new Error(`No runtime adapter is installed for ${config.providers.ai.provider}`);
  }
  if (config.providers.scripture.provider !== "ao") {
    throw new Error(`No runtime adapter is installed for ${config.providers.scripture.provider}`);
  }

  const apiKey = config.providers.ai.openaiApiKey;
  if (!apiKey) throw new Error("OpenAI API key is required");

  return new DefaultThreadlightOrchestrator({
    aiProvider: new OpenAIProvider({
      apiKey,
      model: config.providers.ai.model,
    }),
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
  throw new Error(`No runtime adapter is installed for ${config.AI_PROVIDER}`);
}

function createScriptureProvider(config: ThreadlightConfig) {
  if (config.SCRIPTURE_PROVIDER === "ao") {
    return new AoLabScriptureProvider({ bibleId: config.AO_BIBLE_ID });
  }
  if (config.SCRIPTURE_PROVIDER === "fixture") return new FixtureScriptureProvider();
  throw new Error(`No runtime adapter is installed for ${config.SCRIPTURE_PROVIDER}`);
}
