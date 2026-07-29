import { describe, expect, it, vi } from "vitest";
import { type ControlPreview, createPublicDemoStatus, runPublicDemoControl } from "./App.js";

const preview: ControlPreview = {
  reply: {
    message: "You are not alone.",
    passage: { reference: "Psalm 34:18", translation: "BSB", attribution: "AO Lab" },
  },
  decision: { action: "respond", reason: "A brief reply helps." },
  trace: { aiProvider: "gloo", scriptureProvider: "ao-lab", totalMs: 12 },
};

describe("public demo workspace", () => {
  it("seeds the full dashboard with a running Discord workspace and no raw credentials", () => {
    const status = createPublicDemoStatus();
    expect(status.configuration.providers.ai).toMatchObject({ provider: "gloo", configured: true });
    expect(status.configuration.deployments).toEqual([
      expect.objectContaining({ kind: "discord", state: "running", configured: true }),
    ]);
    expect(JSON.stringify(status)).not.toMatch(/sk-|AIza|Bearer\s+[A-Za-z0-9._-]+/i);
    expect(status.configuration.deployments[0]?.discord).toEqual(
      expect.objectContaining({ botTokenConfigured: true }),
    );
  });

  it("adds and launches an isolated YouTube workspace without touching a real connector", async () => {
    const initial = createPublicDemoStatus();
    const added = await runPublicDemoControl(
      initial,
      "/api/control/deployments",
      { method: "POST", body: JSON.stringify({ kind: "youtube-comments" }) },
      vi.fn(),
    );
    const id = (added.body as { id: string }).id;
    expect(added.status.configuration.deployments).toContainEqual(
      expect.objectContaining({ id, kind: "youtube-comments", state: "draft" }),
    );

    const videos = await runPublicDemoControl(
      added.status,
      `/api/control/deployments/${id}/youtube/videos`,
      undefined,
      vi.fn(),
    );
    expect(videos.body).toEqual(expect.objectContaining({ videos: expect.any(Array) }));

    const launched = await runPublicDemoControl(
      added.status,
      `/api/control/deployments/${id}/launch`,
      { method: "POST" },
      vi.fn(),
    );
    expect(launched.status.runtime.deployments).toContainEqual(
      expect.objectContaining({ id, state: "running", ready: true }),
    );
  });

  it("delegates public provider preview to a curated scenario while leaving workspace state local", async () => {
    const runPreview = vi.fn().mockResolvedValue(preview);
    const status = createPublicDemoStatus();
    const result = await runPublicDemoControl(
      status,
      "/api/control/preview",
      { method: "POST", body: JSON.stringify({ prompt: "Could you pray with me?" }) },
      runPreview,
    );

    expect(runPreview).toHaveBeenCalledWith("prayer");
    expect(result.body).toEqual(preview);
    expect(result.status).toBe(status);
  });
});
