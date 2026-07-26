# Threadlight Safety Model

Threadlight is a bounded conversational presence, not a pastor, counselor, moderator, or
emergency service.

## Response Policy

- In Prompted and Attentive modes, prefer silence when Scripture or a response would feel bolted on.
- In Active mode, respond briefly without Scripture when a passage would feel forced.
- Respond when directly invited through a command or mention.
- Acknowledge the person's actual words before offering a passage.
- Never diagnose, promise an outcome, claim divine certainty, or pressure a user.
- Never autonomously direct-message a participant.
- Never generate mass mentions or role pings.

## Immediate-Risk Handling

A deterministic precheck recognizes a small, auditable set of immediate-harm phrases. Urgent
language bypasses AI discernment, Scripture retrieval, and AI composition entirely. In Attentive
and Active modes, urgent ambient language is evaluated immediately rather than waiting for the
quiet window. Prompted mode does not monitor ordinary messages and is not an emergency-monitoring
service. The resulting message encourages immediate contact with a trusted person or local
emergency support without inventing or hardcoding a location-specific hotline.

## Scripture Integrity

- Passage wording comes only from the configured Scripture provider.
- Composition receives the retrieved passage as immutable source material.
- Every displayed passage includes reference, translation, and attribution.
- Provider errors degrade to a careful response rather than fabricated Scripture.
- Before enabling YouVersion with AI composition, the operator must confirm that their YouVersion
  Platform access and applicable provider terms authorize AI-generated output for the intended
  use. An App Key alone is not proof of that approval.

## Data Handling

- Conversation content is sent only to the active server-side AI provider.
- No raw conversation content is logged at info or error level.
- Demo rate limiting reduces accidental or abusive provider usage.
- Environment files and provider secrets are excluded from Git.
