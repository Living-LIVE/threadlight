# Threadlight Safety Model

Threadlight is a bounded conversational presence, not a pastor, counselor, moderator, or
emergency service.

## Response Policy

- Prefer silence when Scripture would feel bolted on.
- Respond when directly invited through a command or mention.
- Acknowledge the person's actual words before offering a passage.
- Never diagnose, promise an outcome, claim divine certainty, or pressure a user.
- Never autonomously direct-message a participant.
- Never generate mass mentions or role pings.

## Immediate-Risk Handling

A deterministic precheck recognizes a small, auditable set of immediate-harm phrases. It can
override model output to require human escalation. The resulting message encourages immediate
contact with a trusted person or local emergency support without inventing or hardcoding a
location-specific hotline.

## Scripture Integrity

- Passage wording comes only from the configured Scripture provider.
- Composition receives the retrieved passage as immutable source material.
- Every displayed passage includes reference, translation, and attribution.
- Provider errors degrade to a careful response rather than fabricated Scripture.

## Data Handling

- Conversation content is sent only to the active server-side AI provider.
- No raw conversation content is logged at info or error level.
- Demo rate limiting reduces accidental or abusive provider usage.
- Environment files and provider secrets are excluded from Git.
