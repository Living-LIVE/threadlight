# YouTube Comments Connector QA

- Objective: Implement Threadlight's YouTube Comments connector with OAuth connection, polling,
  review drafts, and guarded threaded replies.
- Repository: `/Users/preston/Code/threadlight`
- Branch: `codex/build-threadlight`
- Hosted service: `https://threadlight-production.up.railway.app`
- Railway deployment: `e141c4d2-985e-4899-ad58-4cc9e15a6175`

## Local Proof

`pnpm check` passed on 2026-07-26 after the final high-touch, dashboard-persistence, runtime
status, OAuth-return, and urgent-content safety additions:

- Biome lint and formatting checks passed.
- Workspace typechecks passed.
- All 44 unit/integration tests passed.
- Workspace production builds passed.

Feature-specific coverage includes:

| Behavior | Test |
| --- | --- |
| OAuth authorization URL and signed state validation | `apps/server/src/youtube/client.test.ts` |
| Comment parsing and threaded-reply request payload | `apps/server/src/youtube/client.test.ts` |
| Review draft creation, duplicate suppression, and explicit approval posting | `apps/server/src/youtube/connector.test.ts` |
| Selective policy automatic posting | `apps/server/src/youtube/connector.test.ts` |
| High-touch policy forces an every-message orchestration trigger while retaining review | `apps/server/src/youtube/connector.test.ts` |
| YouTube deployment configuration, OAuth-start URL, catalog availability, and credential redaction | `apps/server/src/control.test.ts` |
| Dashboard saves policy changes before scan or launch | `apps/web/src/youtube-action.test.ts` |
| OAuth success resumes at provider setup and failure resumes at connection | `apps/web/src/startup-route.test.ts` |
| Urgent or escalation result is never queued or posted | `apps/server/src/youtube/connector.test.ts` |
| One YouTube destination and an executable provider path are required to launch | `apps/server/src/control.test.ts` |

The post-polish focused suite passed with 12 tests:

```bash
pnpm vitest run \
  apps/server/src/control.test.ts \
  apps/server/src/youtube/connector.test.ts \
  apps/server/src/runtime-manager.test.ts \
  apps/web/src/startup-route.test.ts \
  apps/web/src/youtube-action.test.ts
```

A clean local API canary ran with synthetic credentials only. It created a YouTube deployment,
saved synthetic OAuth fields, confirmed the OAuth-start URL used
`http://127.0.0.1:18797/api/oauth/youtube/callback`, and verified sanitized status did not return
the synthetic secret. No Google OAuth exchange or YouTube API request occurred.

## Hosted Proof

Railway deployment `e141c4d2-985e-4899-ad58-4cc9e15a6175` is `SUCCESS` with one running instance.
It contains the final local high-touch, dashboard-persistence, safety, and Vercel-dashboard API
compatibility changes.

- `GET /api/health` returned `200`.
- `GET /api/control/status` returned YouTube Comments as `available`.
- No AI provider credential, YouTube OAuth credential, deployment, channel, draft, poll, or reply
  is configured in the hosted service.

## Vercel Dashboard Deployment

On 2026-07-26, the `threadlight` Vercel project was created under
`eric-andstudios-projects` using the same authenticated team context as Bonfire. Production is
available at `https://threadlight.vercel.app` and receives the public
`VITE_THREADLIGHT_API_ORIGIN=https://threadlight-production.up.railway.app` build setting.

Vercel hosts only the static operator dashboard. Railway remains the persistent runtime for the
Discord gateway, YouTube poller, OAuth callback, and control API. Railway `WEB_ORIGIN` is set to
`https://threadlight.vercel.app` so browser requests and OAuth returns use the deployed dashboard.

Deployment verification passed:

- `https://threadlight.vercel.app` serves the production dashboard bundle.
- The bundle contains `https://threadlight-production.up.railway.app` as its public API origin.
- Railway `/api/control/status` returns the expected Railway OAuth callback URL.
- Railway CORS preflight allows `https://threadlight.vercel.app` for `GET`, `POST`, and `PATCH`.

## Remaining Live Verification

Google OAuth connection and a controlled public canary are now complete. The selected `We Paint!`
video accepted a controlled non-owner comment, a hosted scan created a Gloo/AO review draft, and
one approved Isaiah 41:10 reply posted through YouTube's threaded-comment API. The runtime
reported one posted reply. Two duplicate drafts created by overlapping scans were rejected.

The current source serializes same-process scans and is not yet deployed to Railway. Before any
further hosted YouTube use, configure `THREADLIGHT_CONTROL_TOKEN` in Railway and deploy the
current branch. The control token hardening and scan serialization are both in the pending source
release. A future multi-instance runtime will also need a shared lease to prevent cross-instance
scan overlap.

## 2026-07-27 Finish-Line Coverage Ledger

| Issue or behavior | Failure mode or acceptance criterion | Direct executable coverage | Focused command | Broader suite | Status |
| --- | --- | --- | --- | --- | --- |
| Review-first reply flow | An eligible non-owner comment must create a draft and only post after approval. | `apps/server/src/youtube/connector.test.ts` - `creates one review draft, deduplicates it, and posts only after approval` asserts draft creation, no pre-approval post, and exact threaded-reply payload. | `pnpm vitest run apps/server/src/youtube/connector.test.ts` | `pnpm test` | Passed locally; one hosted canary passed. |
| Overlapping scans | Concurrent manual and scheduled scans must not create duplicate drafts. | `apps/server/src/youtube/connector.test.ts` - `serializes overlapping scans so a comment produces only one draft` asserts three concurrent scans make one upstream comment request and one draft. | `pnpm vitest run apps/server/src/youtube/connector.test.ts` | `pnpm test` | Passed locally; source deployment pending. |
| Scan recovery | A failed token refresh must not leave the connector permanently locked. | `apps/server/src/youtube/connector.test.ts` - `releases the scan lock after a failed poll so a later scan can recover` asserts the next scan refreshes and completes. | `pnpm vitest run apps/server/src/youtube/connector.test.ts` | `pnpm test` | Passed locally. |
| Dashboard persistence | Changing reply policy must save before the scan or launch request. | `apps/web/src/youtube-action.test.ts` - `persists reply policy changes before a scan or launch request`. | `pnpm vitest run apps/web/src/youtube-action.test.ts` | `pnpm test` | Passed locally. |
| Remote operator access | Missing or invalid remote control credentials must be rejected; anonymous remote provider demo must be disabled. | `apps/server/src/control.test.ts` - `requires an operator token for remote control and disables anonymous demos` and `fails closed when a remote control token is not configured`. | `pnpm vitest run apps/server/src/control.test.ts` | `pnpm test` | Passed locally; hosted deployment pending. |

Focused finish-line validation ran:

```bash
pnpm vitest run \
  apps/server/src/youtube/connector.test.ts \
  apps/server/src/control.test.ts \
  apps/web/src/youtube-action.test.ts \
  apps/web/src/startup-route.test.ts
pnpm --filter @threadlight/server typecheck
pnpm lint
```

All 14 focused tests passed. The browser workflow was also checked locally at
`http://127.0.0.1:5173`: destination selection opened the YouTube onboarding screen and correctly
disabled Google connection until local OAuth settings exist. This is a browser proof of the setup
guard, not an authenticated Google OAuth test.

`pnpm test` is the repository's full deterministic suite and includes every test named in this
ledger. It was not rerun after the final scan-recovery test because full-suite execution is a
separate requested gate.
