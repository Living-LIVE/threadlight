import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityStore } from "./activity.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("ActivityStore", () => {
  it("persists a bounded, sanitized activity history", async () => {
    const directory = await mkdtemp(join(tmpdir(), "threadlight-activity-"));
    cleanup.push(directory);
    const path = join(directory, "activity.json");
    const store = new ActivityStore(path, 2);

    await store.record({
      source: "discord",
      status: "observed",
      actor: "  Jordan   M. ",
      input: "Please\nshare a verse.",
    });
    await store.record({ source: "discord", status: "responded", output: "Psalm 34:18" });
    await store.record({ source: "youtube", status: "error", reason: "Polling failed." });

    await expect(store.list()).resolves.toEqual([
      expect.objectContaining({ source: "youtube", status: "error" }),
      expect.objectContaining({ source: "discord", status: "responded" }),
    ]);
    expect(await readFile(path, "utf8")).not.toContain("Please");
  });
});
