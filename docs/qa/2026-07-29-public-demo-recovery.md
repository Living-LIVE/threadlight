# Public Demo Recovery - 2026-07-29

## Objective

Restore and verify the credential-free public judging path while keeping provider credentials,
deployment controls, and YouTube publishing operator-protected.

## Scope and Boundaries

- Public dashboard: the complete Threadlight dashboard runs as a browser-isolated workspace when
  the hosted control API requires an operator token. Visitors can explore provider settings,
  Discord and YouTube configuration, launch and pause controls, video selection, and draft review.
  Those operations do not call or mutate the real hosted control API.
- Public API: curated `POST /api/demo/respond` requests only. The dashboard maps a preview request
  to a server-owned scenario; arbitrary prompt bodies are still rejected.
- Protected: `/api/control/*`, including provider configuration and deployment actions, requires
  `THREADLIGHT_CONTROL_TOKEN` on the hosted service.
- No public access code is required or issued.
- No Kaggle submission will be made in this recovery pass.

## Initial Hosted Check

| Surface | Result | Checked |
| --- | --- | --- |
| Public scenario catalog | `200` | 2026-07-29 |
| Public curated reflection | `502 provider_unavailable` | 2026-07-29 |
| Unauthenticated control status | `401` | 2026-07-29 |

## Hypothesis

The public route created a new saved-provider runtime per request. For Gloo, that meant a fresh
OAuth client-credentials exchange per public reflection. The failure was therefore likely in Gloo
authentication or completion handling, not in the public-demo or control-token boundary.

## Completed Remediation

1. Cached the saved provider runtime while its configuration is unchanged.
2. Added one retry for a transient provider failure on curated public scenarios only.
3. Added regression coverage for runtime reuse, bounded retry, and incomplete Gloo metadata.
4. Deployed the final recovery revision `2b85401` to Railway production deployment
   `f9f27b78-77a6-4a9f-919a-241fbcc9e6cd`.

## Local Evidence

- `pnpm check` passed on 2026-07-29: lint, type-check, 59 tests, and production builds.
- The focused API regression verifies that two public scenarios reuse one configured runtime and a
  provider configuration update creates exactly one new runtime.
- The hosted pre-deploy canary returned a live Gloo plus AO Lab reflection after the earlier
  transient `502`; the recovery deployment remains required before treating that result as final.
- The first post-deploy request still returned a transient `502`; an immediate second request
  returned `200` with Gloo plus AO Lab in 7.6 seconds. The bounded retry closes that cold-path
  gap without permitting arbitrary prompts or exposing a fixture fallback.
- The first request after the retry deployment exposed the underlying Gloo edge case: a tool call
  omitted the required internal `reason` field. The provider now normalizes that omission from
  the already-required pastoral intent and has a focused regression test.
- A subsequent live check showed the same two metadata fields can exceed their 240-character
  schema maximum. Gloo normalization now bounds both values before validation; this does not
  change the user-facing reply content.

## Final Hosted Evidence

| Surface | Result | Checked |
| --- | --- | --- |
| Railway deployment | `SUCCESS`, one running instance | 2026-07-29 |
| Public scenario catalog | `200`, four curated scenarios | 2026-07-29 |
| First anonymous reflection | `200`, Gloo plus AO Lab, Psalm 34:18 | 2026-07-29 |
| Second anonymous reflection | `200`, Gloo plus AO Lab, Philippians 4:6-7 | 2026-07-29 |
| Anonymous control status | `401 control_access_required` | 2026-07-29 |
| Arbitrary public prompt body | `400 invalid_request` | 2026-07-29 |
| Vercel dashboard shell | `200` | 2026-07-29 |
| Full Vercel public workspace | `200`: simulated provider settings, Discord and YouTube setup, launch, and bounded provider preview | 2026-07-29 |
| Public workspace remote calls | `GET /api/control/status` (`401`) then curated `POST /api/demo/respond` (`200`); no provider or deployment mutation calls | 2026-07-29 |

Judges need no access code. The public dashboard is [threadlight.vercel.app](https://threadlight.vercel.app)
and its full browser-isolated public workspace uses the Railway runtime only for the bounded
provider preview. The operator token remains restricted to configuration, OAuth, draft review, and
publishing routes.

## Superseded Public Entry Point

Later on 2026-07-29, the full public experience moved to
`https://threadlight-production.up.railway.app/?demo=public`. Railway now serves the bundled app,
real Discord and YouTube runtime status, and the bounded connector activity feed. See
[the public live console ledger](2026-07-29-public-live-console.md). The Vercel evidence above is
retained as a historical checkpoint.
