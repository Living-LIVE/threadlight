import { describe, expect, it } from "vitest";
import { DefaultThreadlightOrchestrator } from "./orchestrator.js";
import type {
  AIProvider,
  ComposeReplyInput,
  ScriptureProvider,
  ThreadlightRequest,
} from "./types.js";

const baseRequest: ThreadlightRequest = {
  context: {
    channelId: "channel-1",
    roomName: "Test Room",
    messages: [
      {
        id: "message-1",
        author: { id: "person-1", name: "Jordan" },
        content: "This week has been heavy.",
        createdAt: "2026-07-24T15:00:00.000Z",
      },
    ],
  },
  prompt: "Could you help me reflect on this?",
  source: "demo",
};

function providers(action: "respond" | "silent" = "respond") {
  const aiProvider: AIProvider = {
    id: "fixture-ai",
    async discern() {
      return {
        action,
        riskLevel: "normal",
        reason: "A direct request invites a brief response.",
        pastoralIntent: "Offer grounded encouragement.",
        scriptureRequest:
          action === "silent"
            ? null
            : {
                bookId: "PSA",
                chapter: 34,
                verseStart: 18,
                verseEnd: null,
                reference: "Psalm 34:18",
              },
      };
    },
    async compose(_input: ComposeReplyInput) {
      return {
        message: "You do not have to pretend the weight is not real.",
        prayerPrompt: null,
        carePrompt: null,
      };
    },
  };

  const scriptureProvider: ScriptureProvider = {
    id: "fixture-scripture",
    async getPassage() {
      return {
        reference: "Psalm 34:18",
        text: "The Lord is near to those who have a broken heart.",
        translation: "WEB",
        attribution: "World English Bible",
      };
    },
  };

  return { aiProvider, scriptureProvider };
}

describe("DefaultThreadlightOrchestrator", () => {
  it("composes an attributed reply through both providers", async () => {
    const orchestrator = new DefaultThreadlightOrchestrator(providers());
    const result = await orchestrator.respond(baseRequest);

    expect(result.reply?.passage?.reference).toBe("Psalm 34:18");
    expect(result.trace.aiProvider).toBe("fixture-ai");
    expect(result.trace.scriptureProvider).toBe("fixture-scripture");
    expect(result.trace.steps.map((item) => item.status)).not.toContain("failed");
  });

  it("respects a decision to remain silent", async () => {
    const orchestrator = new DefaultThreadlightOrchestrator(providers("silent"));
    const result = await orchestrator.respond(baseRequest);

    expect(result.reply).toBeUndefined();
    expect(result.trace.steps).toContainEqual({
      name: "scripture retrieval",
      durationMs: 0,
      status: "skipped",
    });
  });

  it("forces human escalation for immediate-harm language", async () => {
    let discernCalls = 0;
    let composeCalls = 0;
    let scriptureCalls = 0;
    const urgentProviders = providers();
    const orchestrator = new DefaultThreadlightOrchestrator({
      aiProvider: {
        ...urgentProviders.aiProvider,
        async discern(input) {
          discernCalls += 1;
          return urgentProviders.aiProvider.discern(input);
        },
        async compose(input) {
          composeCalls += 1;
          return urgentProviders.aiProvider.compose(input);
        },
      },
      scriptureProvider: {
        ...urgentProviders.scriptureProvider,
        async getPassage(request) {
          scriptureCalls += 1;
          return urgentProviders.scriptureProvider.getPassage(request);
        },
      },
    });
    const result = await orchestrator.respond({
      ...baseRequest,
      prompt: "I am going to kill myself tonight.",
    });

    expect(result.decision.action).toBe("escalate");
    expect(result.decision.riskLevel).toBe("urgent");
    expect(result.reply?.carePrompt).toContain("trusted person");
    expect(result.reply?.passage).toBeUndefined();
    expect(discernCalls).toBe(0);
    expect(composeCalls).toBe(0);
    expect(scriptureCalls).toBe(0);
    expect(result.trace.steps).toContainEqual({
      name: "discernment",
      durationMs: 0,
      status: "skipped",
    });
  });
});
