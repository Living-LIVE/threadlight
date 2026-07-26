# Competition Finish Ledger - 2026-07-26

## Objective

Prepare Threadlight for competition handoff without submitting it.

## Current Truth Matrix

| Surface | State |
| --- | --- |
| Local source | Gloo AI and YouVersion Scripture adapters implemented; Google-owned-video setup and scoped polling implemented. |
| Branch | `codex/build-threadlight`; the GitHub remote branch is the canonical handoff source. |
| Local verification | `pnpm check` passed: 47 tests across 15 files, lint, typechecks, and production builds. |
| Kaggle notebook | Ran the notebook's code path against a fresh local production server using fixture providers: readiness passed and the grief scenario returned a traced, attributed Psalm 34:18 response. |
| Hosted dashboard | Vercel dashboard is live at `https://threadlight.vercel.app`. The current browser build permits Gloo launch only with both its client ID and secret, uses `auto` routing when Gloo is selected, and no longer presents Gloo as an uninstalled adapter. |
| Hosted runtime | Railway control API reports Gloo `auto` configured, AO Lab Scripture configured, and the selected YouTube deployment running and ready with the Review policy. |
| Hosted provider preview | The `Run a test response` dashboard action completed against the saved Railway configuration. The Gloo/AO canary returned `respond`, attributed Matthew 11:28-30 (BSB, AO Lab), and a trace showing completed safety, discernment, Scripture retrieval, composition, and response-safety stages in 13.787 seconds. |
| Google OAuth | Railway callback is registered and the Preston Pope channel has authorized Threadlight. The selected-video allowlist contains only `We Paint!` (`hiuP2zXds2s`). |
| Owner-comment safety canary | A clearly marked owner-authored comment was posted to `We Paint!`, then a manual connector scan completed at `2026-07-26T18:11:29.539Z`. The deployment remained ready with no error, zero drafts, and zero replies. This verifies owner comments do not trigger a draft or reply; it does not prove non-owner draft generation. |
| Gloo | OAuth token exchange, structured-output handling, and the hosted end-to-end provider preview succeeded. Railway deployment `5a8e4491-b4a1-40b7-adf8-dee1b5dadb7a` is running the current adapter; Vercel serves the preview dashboard at `https://threadlight.vercel.app`. |
| YouVersion | Adapter is implemented and configuration is write-only in the dashboard. The supplied App Key returned `401` from the official API, so live passage retrieval is blocked pending a valid or activated App Key. |
| Docker self-hosting | Docker Engine responded, but the exact-source Compose build stalled in the workspace production-build phase. No current image/runtime smoke claim is made; see the [Docker QA ledger](2026-07-26-docker-smoke.md). |

## Handoff Artifacts

- [Submission handoff](../competition-submission.md)
- [Competition readiness](../competition-readiness.md)
- [Competition gallery asset manifest](../competition-assets.md)
- [Docker smoke QA](2026-07-26-docker-smoke.md)
- [Local full-suite QA](2026-07-26-full-suite-local.md)
- [YouTube connector QA](2026-07-26-youtube-comments-connector.md)
- [Notebook run instructions](../../notebook/README.md)

## Exact Next Actions

1. With explicit authorization from the non-owner account holder, add one controlled comment from a Google identity other than the channel owner to the selected test video. Run a scan and verify a Gloo-backed review draft.
2. Explicitly approve that review draft and verify the one threaded-reply canary.
3. Provide a valid YouVersion App Key, enter it in the dashboard, and verify one attributed passage retrieval.
4. Publish the Kaggle notebook and demo media, then update the final submission links and media checklist.
