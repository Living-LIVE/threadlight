import type { DiscernmentDecision } from "./schemas.js";

const URGENT_PATTERNS = [
  /\b(?:kill|hurt)\s+myself\b/i,
  /\b(?:end|take)\s+my\s+(?:life|own life)\b/i,
  /\b(?:don'?t|do\s+not)\s+want\s+to\s+(?:live|be here)\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bgoing\s+to\s+(?:kill|hurt)\s+(?:him|her|them|someone)\b/i,
] as const;

const SENSITIVE_PATTERNS = [
  /\bgrief\b/i,
  /\bfuneral\b/i,
  /\bpanic attack\b/i,
  /\babuse\b/i,
  /\baddict(?:ion|ed)\b/i,
  /\bdivorce\b/i,
  /\bdepress(?:ed|ion)\b/i,
] as const;

export type ImmediateSafetyAssessment = {
  riskLevel: "normal" | "sensitive" | "urgent";
  reason?: string;
};

export function assessImmediateSafety(text: string): ImmediateSafetyAssessment {
  if (URGENT_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      riskLevel: "urgent",
      reason: "The conversation contains language indicating possible immediate harm.",
    };
  }
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      riskLevel: "sensitive",
      reason: "The conversation contains a sensitive pastoral-care topic.",
    };
  }
  return { riskLevel: "normal" };
}

export function applySafetyOverride(
  decision: DiscernmentDecision,
  assessment: ImmediateSafetyAssessment,
): DiscernmentDecision {
  if (assessment.riskLevel === "urgent") {
    return {
      ...decision,
      action: "escalate",
      riskLevel: "urgent",
      reason: assessment.reason ?? decision.reason,
    };
  }

  if (assessment.riskLevel === "sensitive" && decision.riskLevel === "normal") {
    return {
      ...decision,
      riskLevel: "sensitive",
      reason: assessment.reason ?? decision.reason,
    };
  }

  return decision;
}

export function sanitizePublicText(value: string, maxLength = 1_500): string {
  return value
    .replace(/@everyone/gi, "everyone")
    .replace(/@here/gi, "here")
    .replace(/<@&\d+>/g, "a community role")
    .replace(/\s{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

export function urgentCarePrompt(): string {
  return [
    "Please pause and connect with a trusted person nearby or local emergency support now.",
    "A human community leader should follow up directly.",
  ].join(" ");
}

export function urgentCareMessage(): string {
  return [
    "Someone may be in immediate danger.",
    "Please pause this conversation and prioritize direct human support now.",
  ].join(" ");
}
