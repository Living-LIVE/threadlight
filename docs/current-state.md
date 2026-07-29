# Current State

## Product Position

Threadlight is an open-source, self-hosted control surface and Discord-first conversational
presence. The project is suitable for local development, forks, and demonstration. It is not a
hosted multi-tenant service.

## Implemented

- A no-login local dashboard that guides a Discord setup one decision at a time.
- Local JSON configuration with atomic writes and browser-safe, sanitized status responses.
- A bounded provider preview that runs against the saved local AI and Scripture configuration without
  sending a message to a community destination.
- One executable Discord destination, with Prompted, Attentive, and Active participation policies.
- OpenAI or Gloo for AI composition, paired with AO Lab or YouVersion for Scripture retrieval.
- A YouTube Comments connector with Google OAuth callback handling, owned-channel selection,
  polling limited to owner-selected videos, review drafts, and explicit threaded-reply posting.
  The hosted callback is registered, a channel-owner account is connected, and both the
  owner-comment safety canary and one controlled non-owner draft-and-approved-reply canary are
  complete.
- Docker Compose deployment with loopback-only default binding, a durable configuration volume,
  and an exact-source image/runtime smoke test.
- A Railway hosted-runtime checkpoint for the containerized service. Vercel can host a separate
  operator dashboard through `VITE_THREADLIGHT_API_ORIGIN`; it is not a replacement for the
  persistent gateway and poller runtime.
- A no-login public live workspace that exposes sanitized connector health, operator-selected
  Discord and YouTube links, bounded recent activity, and public-safe error summaries. Operator
  actions remain protected. A hosted operator can explicitly unlock the full control workspace
  using the server's control access code; the code remains in browser memory only. Without that
  code, provider settings, connector setup, launch and pause controls, video selection, and draft
  review remain browser-isolated in the configuration playground. That playground uses a labeled,
  deterministic provider check; real connector health and activity remain in Monitoring.
- A provider-neutral core so channel and provider adapters can be added without coupling them to
  the dashboard.
- A credential-free Playwright suite for the public setup, deployment, monitoring, error-filtering,
  provider-transition, and mobile dashboard journeys.

## Planned

- Runtime adapters for Gemini and Bonfire.
- A connector for Slack.
- Catalog entries for Microsoft Teams and Twitch.
- A remote deployment guide that includes an operator-authenticated reverse proxy.
- An optional static Vercel operator UI deployment with an explicit API-origin configuration.

Planned items are visible to communicate direction. They are not executable features and should
not be described as available in demos, issues, or release notes.

## Known Limits

- One Discord deployment and one YouTube Comments deployment may run in one Threadlight process
  today.
- Operators must supply their own Discord and provider credentials.
- Threadlight persists a bounded 200-event connector ledger for the live dashboard, not full
  conversation history. Pending YouTube review drafts retain bounded comment and reply excerpts in
  the local configuration volume until resolved.
- YouTube Comments has completed live Google OAuth, owner-comment suppression, and one controlled
  non-owner review-draft and approved-threaded-reply canary on the selected `We Paint!` video.
  This proves the one-comment happy path only; it is not a broad moderation or safety evaluation.
- The YouVersion App Key was retried after its owner made it live, but the hosted provider preview
  still could not form a response. The running deployment has been restored to the verified AO Lab
  fallback. The YouVersion adapter therefore still lacks a live passage-retrieval canary.
- Docker binds to loopback by default. Remote control requires `THREADLIGHT_CONTROL_TOKEN` and
  should also sit behind an authenticated proxy owned by the operator. Railway production now has
  that token configured: remote configuration, OAuth, drafts, and posting routes return `401`
  without it. The public dashboard falls back to a browser-isolated full demo workspace without
  that code. Its bounded provider preview uses the saved Gloo plus AO Lab provider pair and
  requires `THREADLIGHT_DEMO_ENABLED=true`. The first anonymous scenario and a second warm scenario
  both returned `200` on 2026-07-29; details are recorded in the
  [public demo recovery ledger](qa/2026-07-29-public-demo-recovery.md).
- The current Docker image passed an exact-source build and isolated container health/control API
  smoke. The evidence is recorded in the [Docker QA ledger](qa/2026-07-26-docker-smoke.md).
- Railway production serves the complete bundled public app at
  `https://threadlight-production.up.railway.app/?demo=public`. Discord and YouTube are both ready,
  and a hosted Discord mention-and-response canary appears in the public activity ledger. Vercel
  was not updated because Threadlight is not yet registered in the required Vercel target registry.

## Production Checkpoint

The current production release is source revision
`09764bf6dc6b6d6527a91b9a519138545b6d6169`, deployed to Railway as
`5f461d7f-4155-401a-99d3-ed71b7e99298` on 2026-07-29.

Deployment verification established:

- Railway reported `SUCCESS` with one running replica.
- `/api/health` and the complete no-login public workspace returned `200`.
- Discord reported enabled, ready, and running.
- The live bundle contained the current public-demo, provider, and live-response surfaces.
- `/api/control/status` returned `401` without operator authorization.

This checkpoint proves production rollout and readiness. Feature behavior remains supported by
separate local and hosted QA ledgers. See [Deployment and operations](deployment.md).

## Verification

For a complete local quality gate:

```bash
pnpm exec playwright install chromium
pnpm test:full
```

For focused local-control regression coverage:

```bash
pnpm vitest run \
  apps/server/src/control.test.ts \
  apps/server/src/runtime-manager.test.ts \
  apps/web/src/launch-readiness.test.ts \
  apps/web/src/provider-model.test.ts \
  apps/web/src/activity-filter.test.ts

pnpm test:e2e --grep "public setup|monitoring"
```

## Next Contributions

Useful contributions should preserve the provider-neutral boundaries in `packages/core`, add
deterministic tests for changed behavior, and update this document when they change the shipped
surface. Read [Contributing](../CONTRIBUTING.md) before opening a pull request.
