import { afterEach, describe, expect, it, vi } from "vitest";
import { ParticipationController, type ParticipationStatus } from "./participation.js";

function candidate(
  id: string,
  execute: (id: string, trigger: string) => Promise<boolean>,
  options?: { urgent?: boolean },
) {
  return {
    id,
    conversationId: "channel-1",
    urgent: options?.urgent,
    execute: (trigger: string) => execute(id, trigger),
  };
}

function controller(mode: ParticipationStatus["mode"]) {
  return new ParticipationController({
    mode,
    quietWindowMs: 20_000,
    cooldownMs: 180_000,
    maxQueueDepth: 25,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ParticipationController", () => {
  it("ignores ordinary messages in shy mode", () => {
    const onTrigger = vi.fn(async () => true);
    const participation = controller("shy");

    expect(participation.handle(candidate("message-1", onTrigger))).toBe("ignored");
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("debounces medium messages and respects the response cooldown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T18:00:00.000Z"));
    const onTrigger = vi.fn(async () => true);
    const participation = controller("medium");

    participation.handle(candidate("message-1", onTrigger));
    await vi.advanceTimersByTimeAsync(10_000);
    participation.handle(candidate("message-2", onTrigger));
    await vi.advanceTimersByTimeAsync(19_999);
    expect(onTrigger).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(onTrigger).toHaveBeenLastCalledWith("message-2", "ambient");

    participation.handle(candidate("message-3", onTrigger));
    await vi.advanceTimersByTimeAsync(179_999);
    expect(onTrigger).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(onTrigger).toHaveBeenCalledTimes(2);
  });

  it("evaluates urgent medium messages immediately", async () => {
    const onTrigger = vi.fn(async () => true);
    const participation = controller("medium");

    participation.handle(candidate("urgent-message", onTrigger, { urgent: true }));
    await vi.waitFor(() => expect(onTrigger).toHaveBeenCalledTimes(1));
    expect(onTrigger).toHaveBeenCalledWith("urgent-message", "ambient");
  });

  it("processes every high-mode message sequentially", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstFinished = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const started: string[] = [];
    const onTrigger = vi.fn(async (id: string) => {
      started.push(id);
      if (id === "message-1") await firstFinished;
      return true;
    });
    const participation = controller("high");

    participation.handle(candidate("message-1", onTrigger));
    participation.handle(candidate("message-2", onTrigger));
    await vi.waitFor(() => expect(started).toEqual(["message-1"]));

    releaseFirst?.();
    await vi.waitFor(() => expect(started).toEqual(["message-1", "message-2"]));
    expect(onTrigger).toHaveBeenNthCalledWith(1, "message-1", "every-message");
    expect(onTrigger).toHaveBeenNthCalledWith(2, "message-2", "every-message");
  });

  it("cancels a pending ambient evaluation when mode changes", async () => {
    vi.useFakeTimers();
    const onTrigger = vi.fn(async () => true);
    const participation = controller("medium");

    participation.handle(candidate("message-1", onTrigger));
    participation.setMode("shy");
    await vi.advanceTimersByTimeAsync(20_000);

    expect(onTrigger).not.toHaveBeenCalled();
    expect(participation.status.mode).toBe("shy");
  });

  it("deduplicates replayed events within a conversation", async () => {
    const onTrigger = vi.fn(async () => true);
    const participation = controller("high");

    expect(participation.handle(candidate("message-1", onTrigger))).toBe("scheduled");
    expect(participation.handle(candidate("message-1", onTrigger))).toBe("duplicate");
    await vi.waitFor(() => expect(onTrigger).toHaveBeenCalledTimes(1));
  });

  it("cancels pending ambient work when an explicit request arrives", async () => {
    vi.useFakeTimers();
    const onTrigger = vi.fn(async () => true);
    const participation = controller("medium");

    participation.handle(candidate("ambient-message", onTrigger));
    participation.handleExplicit(candidate("explicit-message", onTrigger));
    await vi.runAllTimersAsync();

    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(onTrigger).toHaveBeenCalledWith("explicit-message", "explicit");
  });

  it("prevents queued work from sending after shutdown", async () => {
    const onTrigger = vi.fn(async () => true);
    const participation = controller("high");

    participation.handle(candidate("message-1", onTrigger));
    participation.stop();
    await Promise.resolve();

    expect(onTrigger).not.toHaveBeenCalled();
    expect(participation.handle(candidate("message-2", onTrigger))).toBe("ignored");
  });

  it("reports queue saturation without confusing it with a duplicate", async () => {
    const neverFinishes = new Promise<boolean>(() => undefined);
    const onTrigger = vi.fn(() => neverFinishes);
    const participation = new ParticipationController({
      mode: "high",
      quietWindowMs: 20_000,
      cooldownMs: 180_000,
      maxQueueDepth: 1,
    });

    expect(participation.handle(candidate("message-1", onTrigger))).toBe("scheduled");
    expect(participation.handle(candidate("message-2", onTrigger))).toBe("queue-full");
    expect(participation.handle(candidate("message-1", onTrigger))).toBe("duplicate");
  });
});
