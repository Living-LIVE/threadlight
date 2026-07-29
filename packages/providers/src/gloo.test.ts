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
});
