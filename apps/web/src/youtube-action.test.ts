import { describe, expect, it, vi } from "vitest";
import { runYouTubeAction } from "./youtube-action.js";

describe("runYouTubeAction", () => {
  it("persists reply policy changes before a scan or launch request", async () => {
    const events: string[] = [];
    const persist = vi.fn(async () => {
      events.push("persist");
    });
    const action = vi.fn(async () => {
      events.push("action");
    });

    await runYouTubeAction(persist, action, true);

    expect(persist).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledOnce();
    expect(events).toEqual(["persist", "action"]);
  });
});
