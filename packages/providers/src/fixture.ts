import type {
  AIProvider,
  ComposeReplyInput,
  ScriptureProvider,
  ScriptureRequest,
} from "@threadlight/core";

export class FixtureAIProvider implements AIProvider {
  readonly id = "fixture-ai";

  async discern(input: Parameters<AIProvider["discern"]>[0]) {
    const isPrayer = input.intent === "prayer" || /\bpray(?:er)?\b/i.test(input.prompt);
    return {
      action: "respond" as const,
      riskLevel: "normal" as const,
      reason: "A direct request creates a natural moment for a brief response.",
      pastoralIntent: isPrayer
        ? "Offer a grounded invitation to prayer."
        : "Acknowledge the moment and offer grounded encouragement.",
      scriptureRequest: {
        bookId: isPrayer ? ("PHP" as const) : ("PSA" as const),
        chapter: isPrayer ? 4 : 34,
        verseStart: isPrayer ? 6 : 18,
        verseEnd: isPrayer ? 7 : null,
        reference: isPrayer ? "Philippians 4:6-7" : "Psalm 34:18",
      },
    };
  }

  async compose(input: ComposeReplyInput) {
    return {
      message: input.passage
        ? "What you shared deserves more than a quick answer. This passage does not erase the weight of the moment, but it gives the community language for staying present with you."
        : "What you shared deserves a careful response. Would you be willing to say a little more about what support would feel helpful right now?",
      prayerPrompt:
        input.intent === "prayer"
          ? "God, meet us with peace, courage, and the grace to take the next faithful step."
          : null,
      carePrompt: null,
    };
  }
}

export class FixtureScriptureProvider implements ScriptureProvider {
  readonly id = "fixture-scripture";

  async getPassage(request: ScriptureRequest) {
    const prayer = request.bookId === "PHP";
    return {
      reference: request.reference,
      text: prayer
        ? "In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus."
        : "Yahweh is near to those who have a broken heart, and saves those who have a crushed spirit.",
      translation: "WEB",
      attribution: "World English Bible · Fixture passage",
      sourceUrl: "https://worldenglish.bible/",
    };
  }
}
