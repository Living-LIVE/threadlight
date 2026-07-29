# Local Discord Recovery Finish Line - 2026-07-29

## Scope

Recover the local Threadlight dashboard and existing Discord deployment after a stale test
environment forced an unintended temporary control file and disabled Discord.

## Local Proof

| Surface | Result |
| --- | --- |
| Local API readiness | `200`, Discord enabled, running, and ready |
| Local provider preview | `200`, OpenAI plus AO Lab, attributed Psalm 34:17-18 |
| Browser dashboard flow | Discord shown as `Live`; preview button produced visible attributed Scripture |
| Discord message delivery | Not run; no message was sent to the community channel |

## Finish-Line Coverage Ledger

| Issue or behavior | Root cause or regression risk | Executable coverage | Direct command | Broader suite |
| --- | --- | --- | --- | --- |
| Readiness reported `503` despite a live Discord gateway | Readiness consulted static environment defaults instead of the runtime manager | `apps/server/src/app.test.ts` - `accepts an asynchronous live runtime status` asserts `200` and `running` | `pnpm vitest run apps/server/src/app.test.ts` | `pnpm test` and `pnpm check` |
| Stale local control state masked the configured Discord installation | Inherited `THREADLIGHT_CONFIG_PATH` and `DISCORD_ENABLED=false` selected a temporary test volume | `scripts/verify-local-runtime.mjs` asserts local readiness, configured providers, and running gateway; `--preview` verifies a real provider response | `pnpm verify:local -- --preview` | Credentialed local canary; intentionally not in CI because it requires a configured local provider and Discord gateway |
| Dashboard could display a provider failure instead of a reply | Saved provider configuration must be exercised through the actual UI | Chrome Playwright local browser flow loads `http://127.0.0.1:5173`, clicks `Run test response`, and asserts visible Scripture | Recorded local browser canary, 2026-07-29 | Manual browser canary; no checked-in browser harness exists yet |

The deterministic server regression is included in the repository-wide test command. The two
credentialed local canaries are deliberately excluded from CI because they require the operator's
local provider credentials and active Discord connection; they must be included in a future
full-suite run when that local environment is requested.

## Rollout Safety

- No migrations, database writes, provider-account changes, OAuth changes, queues, webhooks, or
  deploys were required.
- The local process was restarted without the stale environment overrides.
- No Discord message was sent during verification.

## Release Materials

This is a local operational recovery, not a customer-facing release. Release notes, social copy,
and marketing assets are not applicable.
