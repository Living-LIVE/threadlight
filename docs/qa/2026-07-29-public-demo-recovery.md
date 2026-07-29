# Public Demo Recovery - 2026-07-29

## Objective

Restore and verify the credential-free public judging path while keeping provider credentials,
deployment controls, and YouTube publishing operator-protected.

## Scope and Boundaries

- Public: `GET /api/demo/scenarios` and curated `POST /api/demo/respond` requests only.
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

## Recovery Plan

1. Cache the saved provider runtime only while its configuration is unchanged.
2. Retry one transient provider failure for a curated public scenario only.
3. Add regression coverage for runtime reuse and the bounded retry.
4. Deploy once, then verify public scenario, public reflection, and protected control status.
5. Update competition documentation with the final hosted evidence.

## Local Evidence

- `pnpm check` passed on 2026-07-29: lint, type-check, 56 tests, and production builds.
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
