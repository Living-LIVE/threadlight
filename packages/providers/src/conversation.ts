import type { ConversationContext } from "@threadlight/core";

const AFFIRMATIVE_FOLLOW_UP =
  /^(?:yes(?:\s+please)?|please(?:\s+do)?|sure|absolutely|okay|ok|i(?:'d| would) like that)[.!]?$/i;
const PRAYER_OFFER = /\b(?:would you like|shall i|can i|may i)\b[\s\S]{0,240}\b(?:pray|prayer)\b/i;
const PRAYER_INVITATION_REQUEST =
  /\b(?:ask|check)\b[\s\S]{0,120}\b(?:whether|if)\b[\s\S]{0,120}\b(?:i|they|the user)\b[\s\S]{0,80}\b(?:want|would like)\b[\s\S]{0,80}\b(?:pray|prayer)\b/i;
const PRAYER_ADDRESS = /\b(?:god|lord|father|jesus|holy spirit)\b/i;

export type ConversationContinuation = {
  type: "accepted_prayer_offer";
  offeredBy: string;
  offer: string;
};

export function detectConversationContinuation(
  context: ConversationContext,
  prompt: string,
): ConversationContinuation | null {
  if (!AFFIRMATIVE_FOLLOW_UP.test(prompt.trim())) return null;

  const previous = context.messages.at(-1);
  if (!previous?.author.isAgent || !PRAYER_OFFER.test(previous.content)) return null;
  const referencedMessage = previous.replyToMessageId
    ? context.messages.find((message) => message.id === previous.replyToMessageId)
    : undefined;
  const offerRecipientId = previous.replyToAuthorId ?? referencedMessage?.author.id;
  const acceptedOwnOffer =
    offerRecipientId === context.currentAuthor?.id ||
    context.currentReplyToMessageId === previous.id;
  if (!acceptedOwnOffer) return null;

  return {
    type: "accepted_prayer_offer",
    offeredBy: previous.author.name,
    offer: previous.content.slice(0, 800),
  };
}

export function requestsPrayerInvitation(prompt: string): boolean {
  return PRAYER_INVITATION_REQUEST.test(prompt.trim());
}

export function fulfillsPrayerInvitationRequest(reply: {
  message: string;
  prayerPrompt?: string | null;
}): boolean {
  return PRAYER_OFFER.test([reply.message, reply.prayerPrompt].filter(Boolean).join(" "));
}

export function fulfillsAcceptedPrayerContinuation(reply: {
  message: string;
  prayerPrompt?: string | null;
}): boolean {
  return (
    !reply.prayerPrompt &&
    !PRAYER_OFFER.test(reply.message) &&
    PRAYER_ADDRESS.test(reply.message) &&
    !reply.message.trim().endsWith("?")
  );
}
