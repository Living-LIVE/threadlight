import { describe, expect, it, vi } from "vitest";
import { listDiscordLocations } from "./locations.js";

describe("listDiscordLocations", () => {
  it("returns bot-visible servers and message channels without returning the token", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json([
          { id: "guild-2", name: "Zion" },
          { id: "guild-1", name: "Alpha" },
        ]),
      )
      .mockResolvedValueOnce(
        Response.json([
          { id: "voice-1", name: "Voice", type: 2 },
          { id: "text-1", name: "general", type: 0 },
          { id: "news-1", name: "announcements", type: 5 },
        ]),
      );

    const locations = await listDiscordLocations("bot-secret", "guild-1", fetchFn);

    expect(locations).toEqual({
      servers: [
        { id: "guild-1", name: "Alpha" },
        { id: "guild-2", name: "Zion" },
      ],
      channels: [
        { id: "news-1", name: "announcements" },
        { id: "text-1", name: "general" },
      ],
    });
    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "https://discord.com/api/v10/users/@me/guilds",
      expect.objectContaining({ headers: { authorization: "Bot bot-secret" } }),
    );
    expect(JSON.stringify(locations)).not.toContain("bot-secret");
  });
});
