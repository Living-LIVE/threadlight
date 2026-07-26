# YouTube Comments Connector QA

- Objective: Implement Threadlight's YouTube Comments connector with OAuth connection, polling,
  review drafts, and guarded threaded replies.
- Repository: `/Users/preston/Code/threadlight`
- Branch: `codex/build-threadlight`
- Hosted service: `https://threadlight-production.up.railway.app`
- Railway deployment: `a80fdc63-2293-4295-9241-b06fab8c2c49`

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

Railway deployment `a80fdc63-2293-4295-9241-b06fab8c2c49` is `SUCCESS` with one running instance.
It proves the connector deployment checkpoint, but it predates the final local high-touch and
dashboard-persistence polish; do not treat it as hosted proof of those final changes.

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

## Remaining Live Verification

The Google OAuth web client must register these callback URIs before a real account connection:

```text
http://127.0.0.1:8787/api/oauth/youtube/callback
https://threadlight-production.up.railway.app/api/oauth/youtube/callback
```

After registration, use a dedicated test video with comments enabled to run one read-only poll and
one explicitly approved threaded-reply canary. Do not use an ordinary public comment as the first
write test.
