import { randomUUID } from "node:crypto";
import {
  applySafetyOverride,
  assessImmediateSafety,
  sanitizePublicText,
  urgentCarePrompt,
} from "./safety.js";
import type {
  AIProvider,
  ScripturePassage,
  ScriptureProvider,
  ThreadlightOrchestrator,
  ThreadlightRequest,
  ThreadlightResult,
  TraceStep,
} from "./types.js";

type OrchestratorOptions = {
  aiProvider: AIProvider;
  scriptureProvider: ScriptureProvider;
  now?: () => number;
};

export class DefaultThreadlightOrchestrator implements ThreadlightOrchestrator {
  readonly #aiProvider: AIProvider;
  readonly #scriptureProvider: ScriptureProvider;
  readonly #now: () => number;

  constructor(options: OrchestratorOptions) {
    this.#aiProvider = options.aiProvider;
    this.#scriptureProvider = options.scriptureProvider;
    this.#now = options.now ?? (() => performance.now());
  }

  async respond(request: ThreadlightRequest): Promise<ThreadlightResult> {
    const startedAt = this.#now();
    const steps: TraceStep[] = [];
    const combinedText = [
      ...request.context.messages.slice(-20).map((message) => message.content),
      request.prompt,
    ].join("\n");

    const safetyStarted = this.#now();
    const assessment = assessImmediateSafety(combinedText);
    steps.push(step("safety precheck", safetyStarted, this.#now(), "completed"));

    const discernmentStarted = this.#now();
    let decision = await this.#aiProvider.discern({
      context: request.context,
      prompt: request.prompt,
      intent: request.intent,
    });
    decision = applySafetyOverride(decision, assessment);
    steps.push(step("discernment", discernmentStarted, this.#now(), "completed"));

    if (decision.action === "silent") {
      steps.push({ name: "scripture retrieval", durationMs: 0, status: "skipped" });
      steps.push({ name: "response composition", durationMs: 0, status: "skipped" });
      return {
        decision,
        trace: this.#trace(startedAt, steps),
      };
    }

    let passage: ScripturePassage | undefined;
    if (decision.scriptureRequest) {
      const scriptureStarted = this.#now();
      try {
        passage = await this.#scriptureProvider.getPassage(decision.scriptureRequest);
        steps.push(step("scripture retrieval", scriptureStarted, this.#now(), "completed"));
      } catch {
        steps.push(step("scripture retrieval", scriptureStarted, this.#now(), "failed"));
      }
    } else {
      steps.push({ name: "scripture retrieval", durationMs: 0, status: "skipped" });
    }

    const compositionStarted = this.#now();
    const composed = await this.#aiProvider.compose({
      context: request.context,
      prompt: request.prompt,
      intent: request.intent,
      decision,
      passage,
    });
    steps.push(step("response composition", compositionStarted, this.#now(), "completed"));

    const finalSafetyStarted = this.#now();
    const message = sanitizePublicText(composed.message);
    const prayerPrompt = composed.prayerPrompt
      ? sanitizePublicText(composed.prayerPrompt, 500)
      : undefined;
    let carePrompt = composed.carePrompt ? sanitizePublicText(composed.carePrompt, 500) : undefined;
    if (decision.riskLevel === "urgent") {
      carePrompt = urgentCarePrompt();
    }
    steps.push(step("response safety", finalSafetyStarted, this.#now(), "completed"));

    return {
      reply: {
        id: randomUUID(),
        message:
          message ||
          "I want to respond carefully. Would you be willing to say a little more about what you need?",
        passage,
        prayerPrompt,
        carePrompt,
      },
      decision,
      trace: this.#trace(startedAt, steps),
    };
  }

  #trace(startedAt: number, steps: TraceStep[]) {
    return {
      id: randomUUID(),
      aiProvider: this.#aiProvider.id,
      scriptureProvider: this.#scriptureProvider.id,
      totalMs: roundMs(this.#now() - startedAt),
      steps,
    };
  }
}

function step(
  name: string,
  startedAt: number,
  finishedAt: number,
  status: TraceStep["status"],
): TraceStep {
  return {
    name,
    durationMs: roundMs(finishedAt - startedAt),
    status,
  };
}

function roundMs(value: number) {
  return Math.max(0, Math.round(value * 10) / 10);
}
