# Competition Finish Ledger - 2026-07-26

## Objective

Prepare Threadlight for competition handoff without submitting it.

## Current Truth Matrix

| Surface | State |
| --- | --- |
| Local source | Gloo AI and YouVersion Scripture adapters implemented; Google-owned-video setup and scoped polling implemented. |
| Branch | `codex/build-threadlight`; latest pushed commit: `838c84f`. |
| Local verification | `pnpm check` passed: 46 tests across 15 files, lint, typechecks, and production builds. |
| Kaggle notebook | Ran the notebook's code path against a fresh local production server using fixture providers: readiness passed and the grief scenario returned a traced, attributed Psalm 34:18 response. |
| Hosted dashboard | Vercel dashboard is live at `https://threadlight.vercel.app`. |
| Hosted runtime | Railway control API reports the YouTube OAuth client configured. |
| Google OAuth | Railway callback is registered. Account authorization and selected-video test remain pending browser interaction. |
| Gloo | OAuth token exchange and one bounded completion canary succeeded. |
| YouVersion | Adapter is implemented and configuration is write-only in the dashboard. The supplied App Key returned `401` from the official API, so live passage retrieval is blocked pending a valid or activated App Key. |

## Handoff Artifacts

- [Submission handoff](../competition-submission.md)
- [Competition readiness](../competition-readiness.md)
- [Local full-suite QA](2026-07-26-full-suite-local.md)
- [YouTube connector QA](2026-07-26-youtube-comments-connector.md)
- [Notebook run instructions](../../notebook/README.md)

## Exact Next Actions

1. Use the hosted dashboard to connect the test channel's Google account and select the dedicated test video.
2. Provide a valid YouVersion App Key, enter it in the dashboard, and verify one attributed passage retrieval.
3. Run one read-only YouTube poll, then approve one controlled reply canary.
4. Deploy the current verified source only with explicit current approval, then update the submission links and media checklist.
