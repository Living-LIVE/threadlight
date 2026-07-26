import { describe, expect, it } from "vitest";
import { resolveStartupRoute } from "./startup-route.js";

describe("resolveStartupRoute", () => {
  it("continues a successful YouTube OAuth return in model configuration", () => {
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
      screen: "launch",
      selectedId: "youtube-1",
      notice: expect.stringContaining("YouTube connected"),
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
