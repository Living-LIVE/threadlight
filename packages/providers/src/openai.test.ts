import type { ConversationContext, DiscernmentDecision } from "@threadlight/core";
import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { OpenAIProvider } from "./openai.js";

const context: ConversationContext = {
  channelId: "thread-1",
  messages: [
    {
      id: "message-1",
      author: { id: "user-1", name: "Preston" },
      content: "I am trying to be patient.",
      createdAt: "2026-07-24T19:00:00.000Z",
    },
  ],
};

const decision: DiscernmentDecision = {
  action: "respond",
  riskLevel: "normal",
  reason: "The current message invites a brief response.",
  pastoralIntent: "Acknowledge the current moment.",
  scriptureRequest: null,
};

describe("OpenAIProvider", () => {
  it("marks the triggering prompt as primary in discernment and composition", async () => {
    const parse = vi
      .fn()
      .mockResolvedValueOnce({ output_parsed: decision })
      .mockResolvedValueOnce({
        output_parsed: {
          message: "That sounds like a good place to pause for the day.",
          prayerPrompt: null,
          carePrompt: null,
        },
      });
    const provider = new OpenAIProvider({
      apiKey: "test-key",
      client: { responses: { parse } } as unknown as OpenAI,
    });

    await provider.discern({
      context,
      prompt: "The build is finished and the team is wrapping up.",
      trigger: "every-message",
    });
    await provider.compose({
      context,
      prompt: "The build is finished and the team is wrapping up.",
      trigger: "every-message",
      decision,
    });

    const discernmentInput = parse.mock.calls[0]?.[0];
    const compositionInput = parse.mock.calls[1]?.[0];
    expect(discernmentInput.input[0].content).toContain(
      "prompt field is the current triggering message",
    );
    expect(discernmentInput.input[0].content).toContain("do not carry a prior topic or passage");
    expect(compositionInput.input[0].content).toContain(
      "prompt field is the current triggering message",
    );
    expect(compositionInput.input[0].content).toContain("never answer a prior topic");
  });

  it("marks an accepted prayer offer as an explicit continuation", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        message: "God, give this parent patience and grace today. Amen.",
        prayerPrompt: null,
        carePrompt: null,
      },
    });
    const provider = new OpenAIProvider({
      apiKey: "test-key",
      client: { responses: { parse } } as unknown as OpenAI,
    });
    const prayerContext: ConversationContext = {
      channelId: "thread-1",
      currentAuthor: { id: "user-1", name: "Preston", isAgent: false },
      messages: [
        {
          id: "message-1",
          author: { id: "threadlight", name: "Threadlight", isAgent: true },
          content: "Prayer: Would you like me to offer a short prayer for patience?",
          createdAt: "2026-07-30T21:00:00.000Z",
          replyToAuthorId: "user-1",
        },
      ],
    };

    await provider.compose({
      context: prayerContext,
      prompt: "yes please",
      trigger: "every-message",
      decision,
    });

    const request = parse.mock.calls[0]?.[0];
    const input = JSON.parse(request.input[1].content);
    expect(input).toMatchObject({
      prompt: "yes please",
      currentAuthor: "Preston",
      continuation: {
        type: "accepted_prayer_offer",
        offeredBy: "Threadlight",
      },
    });
  });
});
