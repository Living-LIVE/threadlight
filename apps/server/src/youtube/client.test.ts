import { describe, expect, it, vi } from "vitest";
import { signOAuthState, verifyOAuthState, YouTubeClient } from "./client.js";

const oauth = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://127.0.0.1:8787/api/oauth/youtube/callback",
};

describe("YouTubeClient", () => {
  it("creates an offline authorization request with the restricted reply scope", () => {
    const url = new URL(new YouTubeClient().authorizationUrl(oauth, "signed-state"));
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(oauth.redirectUri);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/youtube.force-ssl");
  });

  it("parses eligible top-level comments and posts a threaded reply", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          items: [
            {
              snippet: {
                canReply: true,
                videoId: "video-1",
                topLevelComment: {
                  id: "comment-1",
                  snippet: {
                    authorDisplayName: "Taylor",
                    authorChannelId: { value: "author-1" },
                    textDisplay: "Could you pray for me?",
                    publishedAt: "2026-07-26T12:00:00.000Z",
                  },
                },
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ id: "reply-1" }));
    const client = new YouTubeClient(fetchFn);
    await expect(client.recentComments("access-token", "channel-1")).resolves.toEqual([
      expect.objectContaining({ id: "comment-1", authorName: "Taylor", videoId: "video-1" }),
    ]);
    await client.reply("access-token", "comment-1", "I am praying with you.");
    expect(fetchFn).toHaveBeenLastCalledWith(
      "https://www.googleapis.com/youtube/v3/comments?part=snippet",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          snippet: { parentId: "comment-1", textOriginal: "I am praying with you." },
        }),
      }),
    );
  });
});

describe("YouTube OAuth state", () => {
  it("accepts a current signed deployment state and rejects a changed signature", () => {
    const state = signOAuthState(
      "f704bf4d-4f7f-4a2a-9ac5-cdb34e1e4f03",
      "client-secret",
      Date.now(),
    );
    expect(verifyOAuthState(state, "client-secret")).toBe("f704bf4d-4f7f-4a2a-9ac5-cdb34e1e4f03");
    expect(verifyOAuthState(`${state}x`, "client-secret")).toBeUndefined();
  });
});
