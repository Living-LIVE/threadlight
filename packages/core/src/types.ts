import type { ComposedReply, DiscernmentDecision, ScriptureRequest } from "./schemas.js";

export type ConversationAuthor = {
  id: string;
  name: string;
  avatarUrl?: string;
  isAgent?: boolean;
};

export type ConversationMessage = {
  id: string;
  author: ConversationAuthor;
  content: string;
  createdAt: string;
  replyToMessageId?: string;
  replyToAuthorId?: string;
};

export type ConversationContext = {
  channelId: string;
  guildId?: string;
  roomName?: string;
  currentAuthor?: ConversationAuthor;
  currentReplyToMessageId?: string;
  messages: ConversationMessage[];
};

export type ScripturePassage = {
  reference: string;
  text: string;
  translation: string;
  attribution: string;
  sourceUrl?: string;
  copyright?: string;
};

export type ThreadlightReply = {
  id: string;
  message: string;
  passage?: ScripturePassage;
  prayerPrompt?: string;
  carePrompt?: string;
};

export type TraceStep = {
  name: string;
  durationMs: number;
  status: "completed" | "skipped" | "failed";
};

export type ThreadlightTrace = {
  id: string;
  aiProvider: string;
  scriptureProvider: string;
  totalMs: number;
  steps: TraceStep[];
};

export type ThreadlightResult = {
  reply?: ThreadlightReply;
  decision: DiscernmentDecision;
  trace: ThreadlightTrace;
};

export type ThreadlightSource = "discord" | "youtube" | "demo";
export type ThreadlightIntent = "reflection" | "prayer";
export type ThreadlightTrigger = "explicit" | "ambient" | "every-message";

export type ThreadlightRequest = {
  context: ConversationContext;
  prompt: string;
  source: ThreadlightSource;
  intent?: ThreadlightIntent;
  trigger?: ThreadlightTrigger;
};

export type ComposeReplyInput = {
  context: ConversationContext;
  prompt: string;
  intent?: ThreadlightIntent;
  trigger: ThreadlightTrigger;
  decision: DiscernmentDecision;
  passage?: ScripturePassage;
};

export interface AIProvider {
  readonly id: string;
  discern(input: {
    context: ConversationContext;
    prompt: string;
    intent?: ThreadlightIntent;
    trigger: ThreadlightTrigger;
  }): Promise<DiscernmentDecision>;
  compose(input: ComposeReplyInput): Promise<ComposedReply>;
}

export interface ScriptureProvider {
  readonly id: string;
  getPassage(request: ScriptureRequest): Promise<ScripturePassage>;
}

export interface ThreadlightOrchestrator {
  respond(request: ThreadlightRequest): Promise<ThreadlightResult>;
}
