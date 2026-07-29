# Public Live Console QA Ledger

Date: 2026-07-29

## Objective

Replace the browser-only public landing state with a no-login view of the real hosted Threadlight
deployments. Judges should be able to open the selected Discord thread and YouTube video, observe
connector health, and see bounded message outcomes without gaining operator access.

## Build Boundary

- Repository: `https://github.com/Living-LIVE/threadlight`
- Branch: `codex/build-threadlight`
- Baseline: `f9b17f9`
- Hosted UI: `https://threadlight.vercel.app`
- Hosted runtime: `https://threadlight-production.up.railway.app`
- Discord boundary: Live Tapestry `threadlight-live-test`
- YouTube boundary: `We Paint!`

## Truth Matrix

| Surface | Required behavior | Proof |
| --- | --- | --- |
| Public live API | No login; sanitized status and bounded activity only | Focused server test and anonymous route check |
| Operator control API | Bearer access remains mandatory on hosted runtime | Focused server test and hosted `401` check |
| Discord | Dedicated demo thread is the only public interaction target | Runtime configuration and Discord thread inspection |
| YouTube | Only the selected test video is exposed | Runtime configuration and public payload |
| Activity | Observed, queued, responded, drafted, posted, skipped, and error outcomes persist | Activity store and connector tests |
| Secrets | No bot, OAuth, provider, application, or raw message identifiers in public payload | Regression assertions and repository secret scan |
| UI | Live connector status, actions, activity, and errors render responsively | Playwright desktop/mobile screenshots |

## Local Evidence

- `pnpm lint`: pass
- `pnpm typecheck`: pass
- `pnpm test`: 19 files, 70 tests passed
- `pnpm build`: pass
- Desktop browser: `1200px` viewport, no console errors
- Mobile browser: `390px` viewport, no visible overlap
- Local `/api/demo/live`: `200`
- Public control regression: `/api/control/status` remains `401` without a token in the remote test

## Privacy and Safety Decisions

- The public dashboard has no arbitrary post endpoint. Visitors interact by joining Discord or
  commenting on the selected YouTube video.
- Activity is bounded to 200 persisted events and 50 returned events.
- Public events omit source IDs and destination IDs.
- Connector error details are reduced to a public-safe summary. Full operational detail remains in
  the operator surface and service logs.
- Existing private Discord history is not backfilled. Only connector events recorded after this
  release appear in the public activity feed.
- YouTube remains limited to owner-selected videos and the configured daily reply cap.

## Hosted Activation

Pending until the source is committed and deployed:

- Configure the Railway activity volume path.
- Launch the hosted Discord deployment against `threadlight-live-test`.
- Verify hosted Discord and YouTube runtime readiness.
- Add a public Discord invite after action-time approval.
- Verify Vercel live console, anonymous Railway live API, and protected Railway control API.

