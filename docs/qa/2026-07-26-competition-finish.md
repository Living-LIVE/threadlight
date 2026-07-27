# Competition Finish Ledger - 2026-07-26

## Objective

Prepare Threadlight for competition handoff without submitting it.

## Current Truth Matrix

| Surface | State |
| --- | --- |
| Local source | Gloo AI and YouVersion Scripture adapters implemented; Google-owned-video setup and scoped polling implemented. |
| Branch | `codex/build-threadlight`; the GitHub remote branch is the canonical handoff source. |
| Local verification | A prior `pnpm check` passed 53 tests across 16 files, lint, typechecks, and production builds. The subsequent finish-line scan-lock retry test has focused proof (`14` targeted tests plus lint and server typecheck); the current full suite is intentionally reserved for a separate full-suite request. |
| Kaggle notebook | Executed the exact notebook code cells against a fresh isolated local fixture server: readiness passed and the grief scenario returned a traced, attributed Psalm 34:18 response. No credentials or live provider calls were used. |
| Hosted dashboard | Vercel dashboard is live at `https://threadlight.vercel.app`. The current browser build permits Gloo launch only with both its client ID and secret, uses `auto` routing when Gloo is selected, and no longer presents Gloo as an uninstalled adapter. |
| Hosted runtime | Railway control API reports Gloo `auto` configured, AO Lab Scripture configured, and the selected YouTube deployment running and ready with the Review policy. |
| Hosted provider preview | The `Run a test response` dashboard action completed against the saved Railway configuration. The Gloo/AO canary returned `respond`, attributed Matthew 11:28-30 (BSB, AO Lab), and a trace showing completed safety, discernment, Scripture retrieval, composition, and response-safety stages in 13.787 seconds. |
| Google OAuth | Railway callback is registered and the Preston Pope channel has authorized Threadlight. The selected-video allowlist contains only `We Paint!` (`hiuP2zXds2s`). |
| Owner-comment safety canary | A clearly marked owner-authored comment was posted to `We Paint!`, then a manual connector scan completed at `2026-07-26T18:11:29.539Z`. The deployment remained ready with no error, zero drafts, and zero replies. This verifies owner comments do not trigger a draft or reply; it does not prove non-owner draft generation. |
| Non-owner reply canary | On 2026-07-27, `We Paint!` (`hiuP2zXds2s`) accepted a clearly marked non-owner comment from `@SplinteredGlassSolutions`. A hosted scan created a Gloo/AO review draft for the reply-eligible controlled comment. One reviewed Isaiah 41:10 reply was approved and posted through YouTube's `comments.insert` path. The deployment then reported one posted reply; two duplicate drafts from overlapping hosted scans were rejected. |
| Gloo | OAuth token exchange, structured-output handling, and the hosted end-to-end provider preview succeeded. Railway deployment `5a8e4491-b4a1-40b7-adf8-dee1b5dadb7a` is running the current adapter; Vercel serves the preview dashboard at `https://threadlight.vercel.app`. |
| YouVersion | Adapter is implemented and configuration is write-only in the dashboard. After the key owner made the supplied App Key live, the hosted `Run a test response` canary was retried and still failed to form a response. The deployment was immediately restored to AO Lab; a subsequent live Gloo/AO preview returned Matthew 11:28-30 (BSB) in 14.808 seconds. YouVersion live passage retrieval remains unverified pending a working key or provider-side diagnosis. |
| Docker self-hosting | Exact-source image build and isolated runtime smoke passed. The image built in about 35 seconds, `/api/health` and `/api/control/status` both returned `200`, and the fresh container had no operator credentials or deployments. See the [Docker QA ledger](2026-07-26-docker-smoke.md). |

## Handoff Artifacts

- [Submission handoff](../competition-submission.md)
- [Competition readiness](../competition-readiness.md)
- [Competition gallery asset manifest](../competition-assets.md)
- [Docker smoke QA](2026-07-26-docker-smoke.md)
- [Local full-suite QA](2026-07-26-full-suite-local.md)
- [YouTube connector QA](2026-07-26-youtube-comments-connector.md)
- [Notebook run instructions](../../notebook/README.md)

## Exact Next Actions

1. Deploy the current source before any further hosted YouTube use. It serializes overlapping scans,
   fixing the duplicate-draft race found in the controlled canary, and includes the remote-control
   hardening documented in the public security review.
2. Resolve the YouVersion provider failure with its owner, then rerun one attributed-passage canary. AO Lab remains the verified fallback for the live demo.
3. Publish the Kaggle notebook and demo media, then update the final submission links and media checklist.
