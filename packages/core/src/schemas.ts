import { z } from "zod";
import { BOOK_IDS } from "./book-ids.js";

export const ScriptureRequestSchema = z.object({
  bookId: z.enum(BOOK_IDS),
  chapter: z.number().int().min(1).max(150),
  verseStart: z.number().int().min(1).max(176),
  verseEnd: z.number().int().min(1).max(176).nullable(),
  reference: z.string().min(3).max(80),
});

export const DiscernmentDecisionSchema = z.object({
  action: z.enum(["respond", "silent", "clarify", "escalate"]),
  riskLevel: z.enum(["normal", "sensitive", "urgent"]),
  reason: z.string().min(1).max(240),
  pastoralIntent: z.string().min(1).max(240),
  scriptureRequest: ScriptureRequestSchema.nullable(),
});

export const ComposedReplySchema = z.object({
  message: z.string().min(1).max(1_500),
  prayerPrompt: z.string().max(500).nullable(),
  carePrompt: z.string().max(500).nullable(),
});

export type ScriptureRequest = z.infer<typeof ScriptureRequestSchema>;
export type DiscernmentDecision = z.infer<typeof DiscernmentDecisionSchema>;
export type ComposedReply = z.infer<typeof ComposedReplySchema>;
