import { describe, expect, it, vi } from "vitest";
import { GlooProvider } from "./gloo.js";

describe("GlooProvider", () => {
  it("uses a required function call for structured discernment", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: "test-token", expires_in: 3600 }))
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      arguments: JSON.stringify({
                        action: "respond",
                        riskLevel: "low",
                        reason: "A brief response would help.",
                        pastoralIntent: "Offer steady encouragement.",
                        scriptureRequest: {
                          book: "PSA",
                          chapter: 34,
                          verseStart: 18,
                          reference: "Psalm 34:18",
                        },
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
      );
    const provider = new GlooProvider({
      clientId: "test-client",
      clientSecret: "test-secret",
      model: "auto",
      fetchFn,
    });

    await expect(
      provider.discern({
        context: { channelId: "test", messages: [] },
        prompt: "I feel overwhelmed today.",
        trigger: "explicit",
      }),
    ).resolves.toMatchObject({
      action: "respond",
      scriptureRequest: { reference: "Psalm 34:18" },
    });

    const [, request] = fetchFn.mock.calls[1] ?? [];
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({
      auto_routing: true,
      tool_choice: "required",
      tools: [
        {
          type: "function",
          function: {
            name: "record_threadlight_discernment",
            parameters: {
              properties: {
                scriptureRequest: {
                  anyOf: [
                    expect.anything(),
                    { properties: { bookId: { enum: expect.arrayContaining(["PSA"]) } } },
                  ],
                },
              },
            },
          },
        },
      ],
    });
  });

  it("fills omitted nullable reply fields from a structured tool call", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: "test-token", expires_in: 3600 }))
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      arguments: JSON.stringify({ message: "You are not alone in this." }),
                    },
                  },
                ],
              },
            },
          ],
        }),
      );
    const provider = new GlooProvider({
      clientId: "test-client",
      clientSecret: "test-secret",
      fetchFn,
    });

    await expect(
      provider.compose({
        context: { channelId: "test", messages: [] },
        prompt: "I feel overwhelmed today.",
        trigger: "explicit",
        decision: {
          action: "respond",
          riskLevel: "normal",
          reason: "A brief response would help.",
          pastoralIntent: "Offer steady encouragement.",
          scriptureRequest: null,
        },
      }),
    ).resolves.toEqual({
      message: "You are not alone in this.",
      prayerPrompt: null,
      carePrompt: null,
    });
  });

  it("sends the latest ten turns as role-correct conversation history", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: "test-token", expires_in: 3600 }))
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      arguments: JSON.stringify({
                        message: "God, give this parent patience and grace today. Amen.",
                        prayerPrompt: null,
                        carePrompt: null,
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
      );
    const provider = new GlooProvider({
      clientId: "test-client",
      clientSecret: "test-secret",
      fetchFn,
    });
    const messages = Array.from({ length: 12 }, (_, index) => ({
      id: `message-${index}`,
      author: {
        id: index === 11 ? "threadlight" : `person-${index}`,
        name: index === 11 ? "Threadlight" : `Person ${index}`,
        isAgent: index === 11,
      },
      content:
        index === 11
          ? "Prayer: Would you like me to offer a short prayer for patience?"
          : `Channel message ${index}`,
      createdAt: new Date(index * 1_000).toISOString(),
      ...(index === 11 ? { replyToAuthorId: "preston" } : {}),
    }));

    await provider.compose({
      context: {
        channelId: "channel-1",
        currentAuthor: { id: "preston", name: "Preston", isAgent: false },
        messages,
      },
      prompt: "yes please",
      trigger: "every-message",
      decision: {
        action: "respond",
        riskLevel: "normal",
        reason: "The user accepted the immediately preceding prayer offer.",
        pastoralIntent: "Continue with the promised prayer.",
        scriptureRequest: null,
      },
    });

    const [, request] = fetchFn.mock.calls[1] ?? [];
    const body = JSON.parse(String(request?.body));
    expect(body.messages).toHaveLength(12);
    expect(body.messages[1]).toEqual({
      role: "user",
      content: "Person 2: Channel message 2",
    });
    expect(body.messages.at(-2)).toEqual({
      role: "assistant",
      content: "Prayer: Would you like me to offer a short prayer for patience?",
    });
    expect(body.messages[0].content).toContain("write the promised short prayer now");
    expect(JSON.parse(body.messages.at(-1).content)).toMatchObject({
      prompt: "yes please",
      currentAuthor: "Preston",
      continuation: {
        type: "accepted_prayer_offer",
        offeredBy: "Threadlight",
      },
      trigger: "every-message",
    });
  });

  it("retries when an accepted prayer offer produces another invitation", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: "test-token", expires_in: 3600 }))
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      arguments: JSON.stringify({
                        message: "Would you like me to offer a short prayer for patience?",
                        prayerPrompt: "Would you like me to pray?",
                        carePrompt: null,
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      arguments: JSON.stringify({
                        message: "God, give this parent patience and grace today. Amen.",
                        prayerPrompt: null,
                        carePrompt: null,
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
      );
    const provider = new GlooProvider({
      clientId: "test-client",
      clientSecret: "test-secret",
      fetchFn,
    });

    await expect(
      provider.compose({
        context: {
          channelId: "channel-1",
          currentAuthor: { id: "preston", name: "Preston", isAgent: false },
          messages: [
            {
              id: "request",
              author: { id: "preston", name: "Preston", isAgent: false },
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
        },
        prompt: "yes please",
        trigger: "every-message",
        decision: {
          action: "respond",
          riskLevel: "normal",
          reason: "The user accepted the prayer offer.",
          pastoralIntent: "Continue with the promised prayer.",
          scriptureRequest: null,
        },
      }),
    ).resolves.toMatchObject({
      message: "God, give this parent patience and grace today. Amen.",
      prayerPrompt: null,
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("retries when a requested prayer invitation produces the prayer immediately", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: "test-token", expires_in: 3600 }))
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      arguments: JSON.stringify({
                        message: "Father, give this parent patience and wisdom today. Amen.",
                        prayerPrompt: null,
                        carePrompt: null,
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      arguments: JSON.stringify({
                        message: "Parenting can stretch us thin.",
                        prayerPrompt: "Would you like me to pray for patience and wisdom?",
                        carePrompt: null,
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
      );
    const provider = new GlooProvider({
      clientId: "test-client",
      clientSecret: "test-secret",
      fetchFn,
    });

    await expect(
      provider.compose({
        context: {
          channelId: "channel-1",
          currentAuthor: { id: "preston", name: "Preston", isAgent: false },
          messages: [],
        },
        prompt:
          "Parenting has stretched my patience today. Please offer a brief Scripture reflection, then ask whether I want a short prayer.",
        trigger: "every-message",
        decision: {
          action: "respond",
          riskLevel: "normal",
          reason: "A brief response would help.",
          pastoralIntent: "Offer encouragement and invite prayer.",
          scriptureRequest: null,
        },
      }),
    ).resolves.toMatchObject({
      message: "Parenting can stretch us thin.",
      prayerPrompt: "Would you like me to pray for patience and wisdom?",
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);

    const [, request] = fetchFn.mock.calls[1] ?? [];
    const body = JSON.parse(String(request?.body));
    expect(JSON.parse(body.messages.at(-1).content)).toMatchObject({
      prayerInvitationRequested: true,
    });
  });

  it("uses pastoral intent when Gloo omits the internal reason field", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: "test-token", expires_in: 3600 }))
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      arguments: JSON.stringify({
                        action: "respond",
                        riskLevel: "normal",
                        pastoralIntent: "Acknowledge the person's grief with steady care.",
                        scriptureRequest: null,
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
      );
    const provider = new GlooProvider({
      clientId: "test-client",
      clientSecret: "test-secret",
      fetchFn,
    });

    await expect(
      provider.discern({
        context: { channelId: "test", messages: [] },
        prompt: "I feel overwhelmed today.",
        trigger: "explicit",
      }),
    ).resolves.toMatchObject({
      reason: "Acknowledge the person's grief with steady care.",
      pastoralIntent: "Acknowledge the person's grief with steady care.",
    });
  });

  it("bounds verbose internal discernment metadata to the schema limit", async () => {
    const longText = "a".repeat(300);
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: "test-token", expires_in: 3600 }))
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      arguments: JSON.stringify({
                        action: "respond",
                        riskLevel: "normal",
                        reason: longText,
                        pastoralIntent: longText,
                        scriptureRequest: null,
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
      );
    const provider = new GlooProvider({
      clientId: "test-client",
      clientSecret: "test-secret",
      fetchFn,
    });

    await expect(
      provider.discern({
        context: { channelId: "test", messages: [] },
        prompt: "I feel overwhelmed today.",
        trigger: "explicit",
      }),
    ).resolves.toMatchObject({
      reason: "a".repeat(240),
      pastoralIntent: "a".repeat(240),
    });
  });

  it("retries a malformed structured discernment response once", async () => {
    const validDecision = {
      action: "respond",
      riskLevel: "normal",
      reason: "A brief response would help.",
      pastoralIntent: "Offer steady encouragement.",
      scriptureRequest: null,
    };
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: "test-token", expires_in: 3600 }))
      .mockResolvedValueOnce(
        Response.json({
          choices: [{ message: { tool_calls: [{ function: { arguments: "not-json" } }] } }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              message: {
                tool_calls: [{ function: { arguments: JSON.stringify(validDecision) } }],
              },
            },
          ],
        }),
      );
    const provider = new GlooProvider({
      clientId: "test-client",
      clientSecret: "test-secret",
      fetchFn,
    });

    await expect(
      provider.discern({
        context: { channelId: "test", messages: [] },
        prompt: "I feel overwhelmed today.",
        trigger: "every-message",
      }),
    ).resolves.toMatchObject(validDecision);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("retries a transient server response but not an authentication failure", async () => {
    const validDecision = {
      action: "respond",
      riskLevel: "normal",
      reason: "A brief response would help.",
      pastoralIntent: "Offer steady encouragement.",
      scriptureRequest: null,
    };
    const transientFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: "test-token", expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ error: { message: "Try again." } }, { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              message: {
                tool_calls: [{ function: { arguments: JSON.stringify(validDecision) } }],
              },
            },
          ],
        }),
      );
    const transientProvider = new GlooProvider({
      clientId: "test-client",
      clientSecret: "test-secret",
      fetchFn: transientFetch,
    });

    await expect(
      transientProvider.discern({
        context: { channelId: "test", messages: [] },
        prompt: "I feel overwhelmed today.",
        trigger: "every-message",
      }),
    ).resolves.toMatchObject(validDecision);
    expect(transientFetch).toHaveBeenCalledTimes(3);

    const authFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: "invalid_client" }, { status: 401 }));
    const authProvider = new GlooProvider({
      clientId: "bad-client",
      clientSecret: "bad-secret",
      fetchFn: authFetch,
    });

    await expect(
      authProvider.discern({
        context: { channelId: "test", messages: [] },
        prompt: "I feel overwhelmed today.",
        trigger: "every-message",
      }),
    ).rejects.toThrow("invalid_client");
    expect(authFetch).toHaveBeenCalledTimes(1);
  });
});
