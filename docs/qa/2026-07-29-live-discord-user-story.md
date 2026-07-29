# Live Discord Immediate-Response User Story

Date: 2026-07-29

## Objective

Prove that a message sent by the authenticated Preston Discord user in the configured Live Tapestry
destination is observed by the local Threadlight gateway and receives a useful, visible reply
without an explicit mention.

## Execution Boundary

- Repository: `/Users/preston/Code/threadlight`
- Branch: `codex/build-threadlight`
- Base revision: `543ae66`
- Worktree: preserve the existing uncommitted web-journey changes
- Local code authority: diagnosis, smallest necessary repair, focused tests, and retest
- External mutation: the approved Discord message, `man its been a long day..`, plus one identical
  failure-loop retest after a narrow local configuration repair
- Deploy authority: none
- Provider/OAuth authority: read and exercise existing configuration only
- Prohibited: credential creation or exposure, permission changes, destructive operations, unrelated
  messages, and production deployment

## Story

1. Open the existing configured Live Tapestry Discord destination using Preston's authenticated
   desktop session.
2. Send `man its been a long day..` as Preston without mentioning Threadlight.
3. Verify Threadlight observes the message in Active mode.
4. Verify Threadlight posts one useful response in the same conversation.
5. Verify the local activity ledger records the observed input and response without exposing
   credentials.

## Acceptance Criteria

- The gateway is `running` and `ready` before the test.
- Participation mode is `Active` (`high`).
- The exact approved message is visible from Preston.
- A Threadlight response appears in the same conversation.
- The response is contextually relevant and does not invent facts or commitments.
- The activity ledger records the Discord event as `responded`, including the input and generated
  output.
- No code repair or deployment is performed unless the live step fails and a concrete diagnosis
  supports a narrow fix.

## Baseline

- Local API: `http://127.0.0.1:8787`
- Discord destination:
  `https://discord.com/channels/1425291268958715935/1425291269424287926`
- Runtime: Discord `running`, `ready=true`
- Participation: `high`
- Activity count before send: `0`

## Run Ledger

- Prerequisites: PASS
- Authenticated Discord send: PASS
- Initial visible Threadlight response: FAIL (fallback response)
- Diagnosis: PASS
- Narrow local repair: PASS
- Retest visible Threadlight response: PASS
- Activity-ledger proof: PASS

## Initial Run

- Preston sent `man its been a long day..` in the configured Live Tapestry `#general` channel at
  2:43 PM.
- Threadlight recorded the message as `observed`, then `queued`.
- Generation failed and the activity ledger recorded `Discord connector operation failed.`
- Discord displayed Threadlight's fallback reply: `Threadlight could not respond right now. Please
  try again.`
- Result: FAIL. A fallback post proved the connector could read and write in the configured channel,
  but it did not satisfy the useful-response acceptance criterion.

## Diagnosis And Repair

- The saved provider was OpenAI, but its saved model was `auto`.
- `auto` is not a valid OpenAI model selection. A direct private preview reproduced the provider
  failure.
- The smallest repair changed only the local saved OpenAI model to `gpt-4.1-mini`; the existing
  provider key and all Discord settings were preserved.
- A private provider preview then passed using OpenAI and AO Lab, returning a contextual Scripture
  response.
- No source code, permissions, credentials, hosted configuration, or deployment were changed.

## Retest

- Preston sent the same approved sentence in `#general` at 2:45 PM.
- Threadlight replied in the same channel at 2:46 PM without an explicit mention.
- The reply acknowledged the long day, used Matthew 11:28-30 to offer rest, offered a short prayer,
  and invited Preston to share what was weighing on him.
- The visible reply included the BSB passage, AO Lab attribution, and source-passage link.
- The local activity ledger recorded:
  - `observed` at `2026-07-29T19:45:59.157Z`
  - `queued` at `2026-07-29T19:45:59.161Z`
  - `responded` at `2026-07-29T19:46:03.667Z`
  - Provider: `openai + ao-lab`
  - Reference: `Matthew 11:28-30`
  - Generation duration: `4049 ms`

## Quality Review

- Contextually relevant: PASS
- No invented facts or commitments: PASS
- Natural Scripture connection: PASS
- Useful next step: PASS
- Same-channel response without mention: PASS
- One response for one retest message: PASS

## Truth Matrix

| Layer | Result | Evidence |
| --- | --- | --- |
| Local runtime | PASS | Health reported Discord `running` and `ready=true` |
| Authenticated Discord UI | PASS | Preston message and Threadlight reply visible in `#general` |
| Local activity ledger | PASS | `observed` -> `queued` -> `responded` |
| Model provider | PASS | OpenAI response completed with `gpt-4.1-mini` |
| Scripture provider | PASS | AO Lab returned Matthew 11:28-30 BSB |
| Hosted deployment | NOT TESTED | No deployment was requested or performed |

## Final Status

PASS - FEATURE-SCOPED

The real local Threadlight deployment automatically observed an unmentioned message from Preston
and posted a useful Scripture-backed response in the configured Discord channel. The result proves
the local app and current Discord deployment only; it does not prove hosted parity.
