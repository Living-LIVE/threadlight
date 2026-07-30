import type { ConversationContext } from "@threadlight/core";
import { describe, expect, it } from "vitest";
import {
  detectConversationContinuation,
  fulfillsAcceptedPrayerContinuation,
  fulfillsPrayerInvitationRequest,
  requestsPrayerInvitation,
} from "./conversation.js";

function contextWithPrevious(content: string, isAgent: boolean): ConversationContext {
  return {
    channelId: "channel-1",
    currentAuthor: { id: "person-1", name: "Preston", isAgent: false },
    messages: [
      {
        id: "previous",
        author: {
          id: isAgent ? "threadlight" : "person-2",
          name: isAgent ? "Threadlight" : "Another person",
          isAgent,
        },
        content,
        createdAt: "2026-07-30T21:00:00.000Z",
        ...(isAgent ? { replyToAuthorId: "person-1" } : {}),
      },
    ],
  };
}

describe("conversation continuation", () => {
  it("recognizes a brief acceptance of Threadlight's immediately preceding prayer offer", () => {
    const context = contextWithPrevious(
      "Prayer: Would you like me to offer a short prayer for patience?",
      true,
    );

    expect(detectConversationContinuation(context, "yes please")).toEqual({
      type: "accepted_prayer_offer",
      offeredBy: "Threadlight",
      offer: "Prayer: Would you like me to offer a short prayer for patience?",
    });
  });

  it("does not treat another participant or a new topic as an accepted prayer offer", () => {
    const humanOffer = contextWithPrevious(
      "Would you like me to offer a short prayer for patience?",
      false,
    );
    const agentOffer = contextWithPrevious(
      "Would you like me to offer a short prayer for patience?",
      true,
    );

    expect(detectConversationContinuation(humanOffer, "yes please")).toBeNull();
    expect(detectConversationContinuation(agentOffer, "I need help with a new topic")).toBeNull();

    expect(
      detectConversationContinuation(
        {
          ...agentOffer,
          currentAuthor: { id: "person-3", name: "Someone else", isAgent: false },
        },
        "yes please",
      ),
    ).toBeNull();
  });

  it("resolves offer ownership through the Discord reply chain when mention metadata is absent", () => {
    const context: ConversationContext = {
      channelId: "channel-1",
      currentAuthor: { id: "person-1", name: "Preston", isAgent: false },
      messages: [
        {
          id: "request",
          author: { id: "person-1", name: "Preston", isAgent: false },
          content: "I could use patience with parenting today.",
          createdAt: "2026-07-30T21:00:00.000Z",
        },
        {
          id: "offer",
          author: { id: "threadlight", name: "Threadlight", isAgent: true },
          content: "Prayer: Would you like me to offer a short prayer for patience?",
          createdAt: "2026-07-30T21:00:10.000Z",
          replyToMessageId: "request",
        },
      ],
    };

    expect(detectConversationContinuation(context, "yes please")).toMatchObject({
      type: "accepted_prayer_offer",
      offeredBy: "Threadlight",
    });
  });

  it("requires an accepted prayer continuation to contain the prayer rather than another offer", () => {
    expect(
      fulfillsAcceptedPrayerContinuation({
        message: "God, give this parent patience and grace today. Amen.",
        prayerPrompt: null,
      }),
    ).toBe(true);
    expect(
      fulfillsAcceptedPrayerContinuation({
        message: "Would you like me to offer a short prayer for patience?",
        prayerPrompt: "Yes?",
      }),
    ).toBe(false);
  });

  it("distinguishes a requested prayer invitation from accepting a prior offer", () => {
    const prompt =
      "Parenting has stretched my patience today. Please offer a brief Scripture reflection, then ask whether I want a short prayer.";

    expect(requestsPrayerInvitation(prompt)).toBe(true);
    expect(
      detectConversationContinuation(
        contextWithPrevious("Would you like me to pray for patience?", true),
        prompt,
      ),
    ).toBeNull();
  });

  it("requires an explicit prayer invitation when the current turn requests one", () => {
    expect(
      fulfillsPrayerInvitationRequest({
        message: "Parenting can stretch us thin.",
        prayerPrompt: "Would you like me to pray for patience and wisdom?",
      }),
    ).toBe(true);
    expect(
      fulfillsPrayerInvitationRequest({
        message: "Father, give this parent patience and wisdom today. Amen.",
        prayerPrompt: null,
      }),
    ).toBe(false);
  });
});
