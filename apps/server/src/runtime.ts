import { DefaultThreadlightOrchestrator, type ThreadlightOrchestrator } from "@threadlight/core";
import {
  AoLabScriptureProvider,
  FixtureAIProvider,
  FixtureScriptureProvider,
  OpenAIProvider,
} from "@threadlight/providers";
import type { ThreadlightConfig } from "./env.js";

export function createThreadlightRuntime(config: ThreadlightConfig): ThreadlightOrchestrator {
  const aiProvider =
    config.AI_PROVIDER === "openai"
      ? new OpenAIProvider({
          apiKey: required(config.OPENAI_API_KEY, "OPENAI_API_KEY"),
          model: config.OPENAI_MODEL,
        })
      : new FixtureAIProvider();

  const scriptureProvider =
    config.SCRIPTURE_PROVIDER === "ao"
      ? new AoLabScriptureProvider({ bibleId: config.AO_BIBLE_ID })
      : new FixtureScriptureProvider();

  return new DefaultThreadlightOrchestrator({
    aiProvider,
    scriptureProvider,
  });
}

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}
