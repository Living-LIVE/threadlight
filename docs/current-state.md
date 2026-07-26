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
- A YouTube Comments connector with Google OAuth callback handling, owned-channel discovery,
  polling limited to owner-selected videos, review drafts, and explicit threaded-reply posting.
  The hosted callback is registered, a channel-owner account is connected, and an owner-comment
  safety canary is complete. A non-owner draft-and-approved-reply canary remains.
- Docker Compose deployment with loopback-only default binding and a durable configuration volume.
- A Railway hosted-runtime checkpoint for the containerized service. Vercel can host a separate
  operator dashboard through `VITE_THREADLIGHT_API_ORIGIN`; it is not a replacement for the
  persistent gateway and poller runtime.
- A provider-neutral core so channel and provider adapters can be added without coupling them to
  the dashboard.

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
- Threadlight does not persist Discord conversation history. Pending YouTube review drafts retain
  bounded comment and reply excerpts in the local configuration volume until resolved.
- YouTube Comments has completed live Google OAuth and an owner-comment suppression canary. A
  controlled non-owner comment still needs to produce and approve one review draft before the
  public-reply path can be called live-verified.
- The current YouVersion App Key is rejected by the provider, so the implemented YouVersion path
  lacks a live passage-retrieval canary.
- Docker binds to loopback by default. Remote exposure requires an authenticated proxy owned by
  the operator.
- Docker Desktop reports a healthy server, but an exact-source `docker compose build` currently
  stalls after beginning the workspace build. The current smoke evidence and termination boundary
  are recorded in the [Docker QA ledger](qa/2026-07-26-docker-smoke.md).

## Verification

For a complete local quality gate:

```bash
pnpm check
```

For focused local-control regression coverage:

```bash
pnpm vitest run \
  apps/server/src/control.test.ts \
  apps/server/src/runtime-manager.test.ts \
  apps/web/src/launch-readiness.test.ts
```

## Next Contributions

Useful contributions should preserve the provider-neutral boundaries in `packages/core`, add
deterministic tests for changed behavior, and update this document when they change the shipped
surface. Read [Contributing](../CONTRIBUTING.md) before opening a pull request.
