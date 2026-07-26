import { describe, expect, it } from "vitest";
import { resolveStartupRoute } from "./startup-route.js";

describe("resolveStartupRoute", () => {
  it("returns a successful YouTube OAuth return to video selection", () => {
    expect(
      resolveStartupRoute(
        [
          {
            id: "youtube-1",
            kind: "youtube-comments",
            state: "draft",
            youtube: { channelId: "channel-1", refreshTokenConfigured: true },
          },
        ],
        "connected",
      ),
    ).toMatchObject({
      screen: "connect",
      selectedId: "youtube-1",
      notice: expect.stringContaining("Choose the videos"),
    });
  });

  it("returns a failed YouTube OAuth attempt to the connection screen", () => {
    expect(
      resolveStartupRoute(
        [
          {
            id: "youtube-1",
            kind: "youtube-comments",
            state: "draft",
            youtube: { refreshTokenConfigured: false },
          },
        ],
        "connection-failed",
      ),
    ).toMatchObject({
      screen: "connect",
      selectedId: "youtube-1",
      notice: expect.stringContaining("YouTube could not connect"),
    });
  });
});
