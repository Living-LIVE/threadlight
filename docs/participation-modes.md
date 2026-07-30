# Discord Participation Modes

Threadlight uses one response pipeline with three Discord participation policies. The policy
decides when to invoke the pipeline; safety, discernment, Scripture retrieval, composition, and
attribution remain shared.

## Prompted

Prompted is the default. Ordinary messages produce no provider calls and no response. Slash commands,
the Ask Threadlight message action, and direct mentions enter the shared per-conversation queue
immediately.

## Attentive

Attentive treats conversation as a burst:

1. A new eligible human text message resets the quiet-window timer for its channel or thread.
2. At the end of the quiet window, Threadlight evaluates the latest message with recent context.
3. Discernment may respond, clarify, escalate, or remain silent.
4. A successful ambient response starts the configured cooldown.
5. New messages received during the cooldown are coalesced and evaluated after it expires.

Urgent language bypasses the quiet window and uses the deterministic care response. Explicit
invocations cancel pending ambient work and enter the same serialized queue.

## Active

Active queues every eligible human text message and produces exactly one response under the normal
operating envelope. Active guarantees engagement, not a Scripture quotation. Discernment may
select no passage when Scripture would feel bolted on.

The queue is bounded. If it is saturated, Threadlight sends a short catch-up response instead of
starting another provider request. Active mode should be used only in a dedicated channel or
thread.

## Scope And Lifecycle

- The configured channel and its child threads are allowed; unrelated channels are ignored.
- Each channel or thread has an independent timer and sequential work queue.
- Bot, webhook, system, attachment-only, and empty messages are not ambient candidates.
- Direct invocations never create a second ambient response for the same message.
- Recent event IDs are retained in a bounded in-memory deduplication window.
- Timers, queues, deduplication, and command-based mode overrides do not persist across restart.

## Operator Configuration

```env
DISCORD_PARTICIPATION_MODE=shy
DISCORD_AMBIENT_QUIET_SECONDS=20
DISCORD_AMBIENT_COOLDOWN_SECONDS=180
DISCORD_MAX_QUEUE_DEPTH=25
```

`/threadlight-mode` is restricted to members with Manage Server permission. With no mode
argument it reports the effective mode. A mode argument changes the in-memory mode until restart.
Active mode also requires `confirm_high: True`.

Attentive and Active send recent conversation context to the configured AI provider without an
explicit mention. The context is bounded to the latest 10 eligible text turns. Threadlight's own
embed replies are included so brief follow-ups such as accepting an offered prayer retain their
meaning. Context is captured before the triggering message enters the response queue, and prayer
acceptance is limited to the participant who received the offer or directly replied to it.
Operators should place a visible notice in every enabled channel and thread.
