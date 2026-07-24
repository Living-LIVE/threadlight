import type { ThreadlightTrigger } from "@threadlight/core";

export type DiscordParticipationMode = "shy" | "medium" | "high";
export type ParticipationDisposition = "scheduled" | "ignored" | "duplicate" | "queue-full";

export type ParticipationCandidate = {
  id: string;
  conversationId: string;
  urgent?: boolean;
  execute: (trigger: ThreadlightTrigger) => Promise<boolean>;
};

export type ParticipationStatus = {
  mode: DiscordParticipationMode;
  quietWindowMs: number;
  cooldownMs: number;
  maxQueueDepth: number;
  pendingConversations: number;
  queuedMessages: number;
};

type ConversationState = {
  pending?: ParticipationCandidate;
  timer?: ReturnType<typeof setTimeout>;
  lastAmbientResponseAt?: number;
  queue: Promise<void>;
  queuedMessages: number;
  generation: number;
  seenIds: Set<string>;
  seenOrder: string[];
};

type ParticipationControllerOptions = {
  mode: DiscordParticipationMode;
  quietWindowMs: number;
  cooldownMs: number;
  maxQueueDepth: number;
  onError?: () => void;
  now?: () => number;
};

export class ParticipationController {
  private mode: DiscordParticipationMode;
  private readonly quietWindowMs: number;
  private readonly cooldownMs: number;
  private readonly maxQueueDepth: number;
  private readonly onError: () => void;
  private readonly now: () => number;
  private readonly conversations = new Map<string, ConversationState>();
  private stopped = false;

  public constructor(options: ParticipationControllerOptions) {
    this.mode = options.mode;
    this.quietWindowMs = options.quietWindowMs;
    this.cooldownMs = options.cooldownMs;
    this.maxQueueDepth = options.maxQueueDepth;
    this.onError = options.onError ?? (() => undefined);
    this.now = options.now ?? Date.now;
  }

  public get status(): ParticipationStatus {
    let pendingConversations = 0;
    let queuedMessages = 0;
    for (const state of this.conversations.values()) {
      if (state.pending || state.timer) pendingConversations += 1;
      queuedMessages += state.queuedMessages;
    }
    return {
      mode: this.mode,
      quietWindowMs: this.quietWindowMs,
      cooldownMs: this.cooldownMs,
      maxQueueDepth: this.maxQueueDepth,
      pendingConversations,
      queuedMessages,
    };
  }

  public setMode(mode: DiscordParticipationMode): ParticipationStatus {
    if (mode === this.mode) return this.status;
    this.mode = mode;
    for (const state of this.conversations.values()) {
      if (state.timer) clearTimeout(state.timer);
      state.timer = undefined;
      state.pending = undefined;
      state.lastAmbientResponseAt = undefined;
      state.generation += 1;
    }
    return this.status;
  }

  public handle(candidate: ParticipationCandidate): ParticipationDisposition {
    if (this.stopped || this.mode === "shy") return "ignored";
    const state = this.getConversation(candidate.conversationId);
    if (!this.recordCandidate(state, candidate.id)) return "duplicate";

    if (this.mode === "high") {
      return this.enqueue(state, candidate, "every-message");
    }

    if (candidate.urgent) {
      if (state.timer) clearTimeout(state.timer);
      state.timer = undefined;
      state.pending = undefined;
      state.generation += 1;
      return this.enqueue(state, candidate, "ambient");
    }

    state.pending = candidate;
    this.scheduleMedium(candidate.conversationId, state, this.quietWindowMs);
    return "scheduled";
  }

  public handleExplicit(candidate: ParticipationCandidate): ParticipationDisposition {
    if (this.stopped) return "ignored";
    const state = this.getConversation(candidate.conversationId);
    if (!this.recordCandidate(state, candidate.id)) return "duplicate";
    if (state.timer) clearTimeout(state.timer);
    state.timer = undefined;
    state.pending = undefined;
    state.generation += 1;
    return this.enqueue(state, candidate, "explicit");
  }

  public cancelAmbient(conversationId: string): void {
    const state = this.conversations.get(conversationId);
    if (!state) return;
    if (state.timer) clearTimeout(state.timer);
    state.timer = undefined;
    state.pending = undefined;
    state.generation += 1;
  }

  public stop(): void {
    this.stopped = true;
    for (const state of this.conversations.values()) {
      if (state.timer) clearTimeout(state.timer);
      state.timer = undefined;
      state.pending = undefined;
    }
  }

  private getConversation(conversationId: string): ConversationState {
    const existing = this.conversations.get(conversationId);
    if (existing) return existing;
    const created: ConversationState = {
      queue: Promise.resolve(),
      queuedMessages: 0,
      generation: 0,
      seenIds: new Set(),
      seenOrder: [],
    };
    this.conversations.set(conversationId, created);
    return created;
  }

  private scheduleMedium(conversationId: string, state: ConversationState, delayMs: number): void {
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      state.timer = undefined;
      this.flushMedium(conversationId, state);
    }, delayMs);
  }

  private flushMedium(conversationId: string, state: ConversationState): void {
    if (this.mode !== "medium" || !state.pending) return;
    if (state.queuedMessages > 0) {
      this.scheduleMedium(conversationId, state, this.quietWindowMs);
      return;
    }

    const cooldownRemaining = state.lastAmbientResponseAt
      ? state.lastAmbientResponseAt + this.cooldownMs - this.now()
      : 0;
    if (cooldownRemaining > 0) {
      this.scheduleMedium(conversationId, state, cooldownRemaining);
      return;
    }

    const candidate = state.pending;
    state.pending = undefined;
    this.enqueue(state, candidate, "ambient");
  }

  private enqueue(
    state: ConversationState,
    candidate: ParticipationCandidate,
    trigger: ThreadlightTrigger,
  ): ParticipationDisposition {
    if (state.queuedMessages >= this.maxQueueDepth) return "queue-full";
    state.queuedMessages += 1;
    const generation = state.generation;

    state.queue = state.queue
      .then(async () => {
        if (this.stopped) return;
        if (trigger === "ambient" && generation !== state.generation) return;
        if (trigger === "ambient" && this.mode !== "medium") return;
        if (trigger === "every-message" && this.mode !== "high") return;
        const responded = await candidate.execute(trigger);
        if (trigger === "ambient" && responded) {
          state.lastAmbientResponseAt = this.now();
        }
      })
      .catch(() => {
        this.onError();
      })
      .finally(() => {
        state.queuedMessages -= 1;
        if (this.mode === "medium" && state.pending && !state.timer) {
          this.scheduleMedium(candidate.conversationId, state, this.quietWindowMs);
        }
      });
    return "scheduled";
  }

  private recordCandidate(state: ConversationState, id: string): boolean {
    if (state.seenIds.has(id)) return false;
    state.seenIds.add(id);
    state.seenOrder.push(id);
    while (state.seenOrder.length > this.maxQueueDepth * 4) {
      const expired = state.seenOrder.shift();
      if (expired) state.seenIds.delete(expired);
    }
    return true;
  }
}
