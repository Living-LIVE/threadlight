import { Collection, PermissionFlagsBits } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import {
  ASK_THREADLIGHT_CONTEXT_NAME,
  describeDiscordResponseFailure,
  discordCommands,
  extractDiscordContextText,
  extractMentionPrompt,
  fetchRecentContext,
  formatThreadlightResponse,
  getDiscordInstallUrl,
  isAllowedDiscordLocation,
  PRAY_COMMAND_NAME,
  THREADLIGHT_COMMAND_NAME,
  THREADLIGHT_DISCORD_PERMISSIONS,
  THREADLIGHT_MODE_COMMAND_NAME,
} from "./index.js";

describe("Discord adapter", () => {
  it("records a sanitized response failure phase and category", () => {
    const schemaError = new Error("provider output included invalid content");
    schemaError.name = "GlooDiscernmentSchemaError:scriptureRequest.bookId";

    expect(describeDiscordResponseFailure(schemaError, "generation")).toBe(
      "generation:ProviderStructuredOutputError",
    );
    expect(
      describeDiscordResponseFailure(
        Object.assign(new Error("temporary provider failure"), { name: "GlooRequestError" }),
        "generation",
      ),
    ).toBe("generation:ProviderRequestError");
    expect(
      describeDiscordResponseFailure(
        Object.assign(new Error("request rejected"), { name: "DiscordAPIError[50035]" }),
        "posting",
      ),
    ).toBe("posting:DiscordPostError");
    expect(describeDiscordResponseFailure("unknown", "generation")).toBe(
      "generation:ResponsePipelineError",
    );
  });

  it("registers the three slash commands and message action", () => {
    expect(discordCommands).toHaveLength(4);
    expect(discordCommands.map((command) => command.name)).toEqual([
      THREADLIGHT_COMMAND_NAME,
      PRAY_COMMAND_NAME,
      THREADLIGHT_MODE_COMMAND_NAME,
      ASK_THREADLIGHT_CONTEXT_NAME,
    ]);
  });

  it("builds a guild-locked least-privilege install URL", () => {
    const url = new URL(getDiscordInstallUrl("app-123", "guild-456"));

    expect(url.origin).toBe("https://discord.com");
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(url.searchParams.get("client_id")).toBe("app-123");
    expect(url.searchParams.get("guild_id")).toBe("guild-456");
    expect(url.searchParams.get("disable_guild_select")).toBe("true");
    expect(url.searchParams.get("permissions")).toBe("274877991936");
    expect(url.searchParams.get("scope")).toBe("bot applications.commands");
    expect(
      BigInt(THREADLIGHT_DISCORD_PERMISSIONS) & PermissionFlagsBits.SendMessagesInThreads,
    ).toBe(PermissionFlagsBits.SendMessagesInThreads);
  });

  it("allows a configured channel and its child threads only", () => {
    const config = { token: "token", guildId: "guild-1", channelId: "channel-1" };

    expect(isAllowedDiscordLocation(config, "guild-1", "channel-1")).toBe(true);
    expect(isAllowedDiscordLocation(config, "guild-1", "thread-1", "channel-1")).toBe(true);
    expect(isAllowedDiscordLocation(config, "guild-1", "thread-2", "channel-2")).toBe(false);
    expect(isAllowedDiscordLocation(config, "guild-2", "channel-1")).toBe(false);
  });

  it("extracts only prompts that explicitly mention the bot", () => {
    expect(extractMentionPrompt("<@123> help me reflect", "123")).toBe("help me reflect");
    expect(extractMentionPrompt("<@!123>   pray with us", "123")).toBe("pray with us");
    expect(extractMentionPrompt("help me reflect", "123")).toBeUndefined();
  });

  it("preserves Threadlight embed text for conversational follow-ups", () => {
    expect(
      extractDiscordContextText("", [
        {
          description: "Parenting stretches us all.",
          fields: [
            {
              name: "Prayer",
              value: "Would you like me to offer a short prayer for patience?",
              inline: false,
            },
          ],
        },
      ]),
    ).toBe(
      "Parenting stretches us all.\n\nPrayer: Would you like me to offer a short prayer for patience?",
    );
  });

  it("prioritizes prayer offers inside the bounded context text", () => {
    const content = extractDiscordContextText("", [
      {
        description: "A brief reflection.",
        fields: [
          { name: "Passage", value: `Psalm 103:8\n\n${"x".repeat(3_000)}`, inline: false },
          { name: "Translation", value: "BSB", inline: true },
          {
            name: "Prayer",
            value: "Would you like me to offer a short prayer?",
            inline: false,
          },
        ],
      },
    ]);

    expect(content).toContain("Prayer: Would you like me to offer a short prayer?");
    expect(content.length).toBeLessThanOrEqual(2_000);
    expect(content.indexOf("Prayer:")).toBeLessThan(content.indexOf("Passage:"));
    expect(content).toContain("Passage: Psalm 103:8");
    expect(content).not.toContain("Translation");
    expect(content).not.toContain("xxx");
  });

  it("fetches a bounded context snapshot before the triggering message", async () => {
    const fetch = vi.fn().mockResolvedValue(new Collection());
    const channel = {
      messages: { fetch },
    } as unknown as Parameters<typeof fetchRecentContext>[0];

    await fetchRecentContext(channel, 10, "threadlight", "current-message");

    expect(fetch).toHaveBeenCalledWith({ limit: 30, before: "current-message" });
  });

  it("renders a grounded reply without enabling mentions", () => {
    const embeds = formatThreadlightResponse({
      decision: {
        action: "respond",
        reason: "The user explicitly requested reflection.",
        riskLevel: "normal",
        pastoralIntent: "Offer grounded companionship without replacing human care.",
        scriptureRequest: {
          bookId: "PSA",
          chapter: 34,
          verseStart: 18,
          verseEnd: 18,
          reference: "Psalm 34:18",
        },
      },
      reply: {
        id: "reply-1",
        message: "You do not have to carry this moment alone.",
        passage: {
          reference: "Psalm 34:18",
          text: "The LORD is near to the brokenhearted.",
          translation: "BSB",
          attribution: "Berean Standard Bible",
          sourceUrl: "https://bible.helloao.org/",
        },
        carePrompt: "Who could stay with you tonight?",
      },
      trace: {
        id: "trace-1",
        aiProvider: "fixture",
        scriptureProvider: "fixture",
        totalMs: 4,
        steps: [],
      },
    });

    expect(embeds).toHaveLength(1);
    expect(embeds[0]?.data.description).toContain("You do not have to carry this moment alone.");
    expect(embeds[0]?.data.fields?.some((field) => field.name === "Passage")).toBe(true);
  });
});
