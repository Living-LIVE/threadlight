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
| Hosted runtime | Railway control API reports Gloo configured, the YouTube deployment running and ready, and a successful initial poll with no runtime error. The selected-video allowlist and Review policy persisted across deployments. |
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

1. Add one controlled comment from a Google identity other than the channel owner to the selected test video, then run a read-only scan and verify a Gloo-backed review draft.
2. Explicitly approve that review draft and verify the one threaded-reply canary.
3. Provide a valid YouVersion App Key, enter it in the dashboard, and verify one attributed passage retrieval.
4. Publish the Kaggle notebook and demo media, then update the final submission links and media checklist.
