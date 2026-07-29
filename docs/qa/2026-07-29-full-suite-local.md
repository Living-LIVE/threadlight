# Local Full-Suite QA - 2026-07-29

## Status

**BLOCKED - HOST RESTART AND LOCAL COMPETITION CREDENTIALS REQUIRED**

The canonical repository suite, checked-in browser suite, credentialed local runtime verification,
active OpenAI plus AO Lab provider canary, notebook, and local API matrix passed. Docker and
competition provider canaries remain unrun or blocked because the Codex Desktop safe-run monitor
showed swap increasing from 15.7 GB to 17.3 GB. The remaining container build must resume in a
clean Desktop session or normal terminal.

Three consecutive goal turns reproduced the same host condition. The final sample reported
17.17 GB swap used and approximately 1.73 GB RSS for the primary Codex app-server. The full-suite
goal was therefore marked blocked instead of risking an exact-source Docker build in the current
Desktop session.

This result is local-only. It does not prove the current dirty worktree is committed, pushed,
deployed, or customer-visible.

## Preflight

| Item | Evidence |
| --- | --- |
| Repository | `/Users/preston/Code/threadlight` |
| Branch | `codex/build-threadlight` |
| Baseline HEAD | `543ae66dbaf7f531ec0379b306c559b65e916f7f` |
| Worktree | Dirty by design; 27 modified or untracked paths before the run |
| Local web | Listener present on `127.0.0.1:5173` |
| Local API | Listener present on `127.0.0.1:8787` |
| Node / pnpm | Node `v26.0.0`; pnpm `10.32.1` |
| Docker | Docker Engine `28.1.1` available |
| Credential handling | Variable names and non-empty state checked without printing values |
| Raw logs | `/tmp/threadlight-full-suite-2026-07-29/` |

## Suite Inventory and Results

| Suite | Command or method | Status | Evidence |
| --- | --- | --- | --- |
| Canonical deterministic/build gate | `pnpm check` through `pnpm test:full` | PASS | Biome checked 109 files; all workspace typechecks and production builds passed; 77 Vitest assertions in 21 files passed |
| Checked-in browser journeys | `pnpm test:e2e` through `pnpm test:full` | PASS | Four Playwright journeys passed with one worker, including public setup, monitoring, Discord location privacy, and mobile overflow |
| Local runtime and Discord readiness | `pnpm verify:local -- --preview` | PASS | Readiness and control status passed; configured Discord gateway reported running and ready |
| Saved provider preview | `pnpm verify:local -- --preview` | PASS | OpenAI plus AO Lab returned a Scripture-backed response |
| Direct provider smoke | `pnpm --filter @threadlight/server smoke:providers` | PASS | `respond`, sensitive risk, attributed Psalm 34:18 BSB, all five trace stages completed |
| Competition configuration readiness | `pnpm --filter @threadlight/server readiness` | FAIL | Active local environment reports OpenAI plus AO Lab; Gloo and YouVersion readiness are false |
| Gloo plus AO Lab live canary | Temporary local override with `smoke:providers` | BLOCKED | Local Gloo credential fields are empty; no secret was copied from hosted infrastructure |
| YouVersion live canary | Temporary local provider override | BLOCKED | Local YouVersion credential field is empty; prior hosted key behavior is not local proof |
| Notebook execution | Execute all four code cells against `http://127.0.0.1:8787` | PASS | Readiness, scenario listing, curated grief response, AO Lab attribution, trace output, and final assertions completed |
| Local API matrix | Node fetch canary against web and API listeners | PASS | Web, health, readiness, control, scenario catalog, and curated response returned `200`; arbitrary prompt payload returned `400 invalid_request` |
| Exact-source Docker image build | `docker build --progress=plain -t threadlight:full-suite-local .` | NOT RUN | Deferred because swap was high and rising |
| Isolated container health/control smoke | Run fresh image on an unused loopback port; check `/api/health` and sanitized `/api/control/status` | NOT RUN | Depends on the deferred Docker build |
| Local manual browser walkthrough | Current public setup, deployment, monitoring, and provider response | SUPPLEMENTAL PASS | The same current worktree was visually exercised before this full-suite request; the checked-in Playwright suite is the executable acceptance evidence |

## Finish-Line Ledger Verification

`pnpm test:full` ran every exact deterministic and Playwright assertion listed in
`docs/qa/2026-07-29-journey-improvements.md`:

- staged setup and unavailable connectors
- memory-only hosted operator access
- Discord credential privacy and selectable locations
- compatible provider model transitions
- provider preflight before launch
- runtime-backed launch success and dismissible notices
- monitoring provenance, error filters, and completed YouTube review history
- owned-channel and selected-video scoping
- review-first posting, deduplication, overlapping-scan serialization, and urgent-comment suppression
- activity-filter ordering
- mobile monitoring without horizontal overflow

The credentialed local checks required by
`docs/qa/2026-07-29-local-discord-recovery-finish-line.md` also passed:

- asynchronous readiness reports the live Discord runtime
- `pnpm verify:local -- --preview` proves the configured gateway and saved provider pair

## Failure Analysis

### Competition readiness

The readiness command is a strict configuration-presence gate. The local installation intentionally
uses OpenAI plus AO Lab and does not contain non-empty local Gloo or YouVersion credentials, so it
correctly exits `2`. This is not evidence that either provider API is broken. It is evidence that
this local installation cannot currently prove the competition-required provider pair.

The direct Gloo override then failed closed with `GLOO_CLIENT_ID is required`, confirming the
missing-local-credential diagnosis without exposing any value. Railway's linked variable injection
also reported no Gloo or YouVersion environment credentials; the deployed service keeps its active
provider configuration in the protected persistent volume instead. No hosted credential was read
or copied.

## Repair Loop

| Loop | Failure groups | Action | Result |
| --- | --- | --- | --- |
| 1 of 5 | Competition readiness false; Gloo override missing local credentials; remaining heavy checks unsafe under rising swap | Separated active-provider success from competition-provider readiness, inspected credential presence only, and paused before Docker | No code repair justified. Canonical and active-provider suites remain green; competition canaries and container proof remain open |
| 2 of 5 | Notebook and API proof were still missing; first API wrapper had an unquoted zsh `?` URL | Executed every notebook code cell, corrected only the temporary wrapper quoting, and ran the full local API matrix | Notebook and API matrix passed. No application change was needed; Docker remains host-safety blocked |
| 3 of 5 | Docker remained unsafe and local Gloo/YouVersion credentials remained absent | Rechecked the host once, confirmed the same blockers, and stopped without repeating green suites | Goal blocked after the required three-turn audit; resume requires a clean Desktop baseline and intentional local competition credentials |

## Safe Resume

After fully quitting and reopening Codex Desktop, or from a normal terminal:

1. Recheck swap and app-server footprint with `codex-safe-monitor.sh --once`.
2. Build the exact image and run isolated health/control smoke on an unused port.
3. If local Gloo and YouVersion credentials are intentionally installed, rerun readiness and
   separate Gloo plus AO Lab and OpenAI plus YouVersion canaries.
4. Rerun only the affected checks, then update this ledger. The already green `pnpm test:full`
   does not need repetition unless source files change.

## Safety Accounting

- No credentials were printed or copied.
- No Discord or YouTube message was sent.
- No OAuth, provider account, hosted environment, deployment, database, billing, permission, or
  public content state changed.
- No application code was edited during this full-suite run.
- One read-only inventory subagent was started and then shut down when the host safety pause was
  triggered; it did not edit files or run heavy tests.
