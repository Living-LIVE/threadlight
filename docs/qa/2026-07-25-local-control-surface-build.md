# Threadlight Local Control Surface Build Ledger

> Historical snapshot for the local-control build phase. It predates the Gloo and YouTube Comments
> implementation. For the current product state, use [Current State](../current-state.md) and the
> [competition finish ledger](2026-07-26-competition-finish.md).

- Objective: Build the self-hosted configuration wizard and deployment control surface.
- Repository: `/Users/preston/Code/threadlight`
- Branch and base: `codex/build-threadlight` at `8881458`
- Scope: local code, docs, Docker configuration, and local verification only.
- Explicitly excluded: provider account creation, OAuth client creation, external deployment, Discord permission changes, production changes, and credential disclosure.

## Baseline

- The current runtime reads `.env.local` at startup and supports one Discord gateway.
- The existing web experience is a no-login demonstration, not an operator setup surface.
- Docker uses one Node process and has no durable configuration volume.
- Current machine safety snapshot: one Codex app-server root; swap use was high, so this build will avoid browser/agent fan-out and verbose streaming commands.

## Planned Boundaries

- Configuration is durable local state only and returns sanitized status to the browser.
- Discord remains the only executable channel connector in this build.
- Slack and YouTube Comments receive configuration contracts and UI states but cannot start without later connector/OAuth implementation.
- Microsoft Teams and Twitch remain catalog-only, marked coming soon.

## Truth Matrix

- Local source: complete and reviewed with `git diff --check`.
- Local tests/build: `pnpm check` passed: lint, TypeScript, 31 tests, and production builds.
- Local runtime: verified on an unconfigured production build. `GET /api/health` and
  `GET /api/control/status` passed; a Discord draft created through the API returned sanitized
  credential status only.
- Local UI: verified in the in-app browser at desktop and 390px mobile. The route picker,
  Discord connection screen, provider launch guard, interrupted-setup resume state, and
  post-launch provider/Scripture settings surface worked.
- Docker image: `docker compose build` succeeded after removing the optional remote Dockerfile
  frontend directive; `threadlight:local` exists and Compose renders the expected loopback port
  binding and named config volume.
- Docker runtime smoke: unverified. Docker Desktop left the isolated smoke container in
  `created` state and subsequently hung `docker start`, `docker ps`, and `docker inspect` CLI
  calls. No application log or exit state was available.
- Shared/dev/hosted/production: not changed.

## Current Local Session

- Clean local control instance: `http://127.0.0.1:18794`
- Process: local production build with no imported provider or Discord credentials.
- Local configuration path: `.threadlight/local-control-18794.json` (ignored by Git).

## Remaining Constraints

- Discord is the only executable connector. Slack and YouTube Comments have configuration slots
  but require their OAuth/connector implementations; Teams and Twitch are catalog-only.
- OpenAI plus AO Lab are the installed executable provider path. Gemini, Gloo, Bonfire, and
  YouVersion are selectable and stored locally but need adapters and credentials before launch.
- Remote deployment requires a reverse proxy with operator authentication. Docker's default
  Compose binding is loopback-only.
- The latest source has not been rebuilt into a container after the final settings-only UI and
  test-seam change because Docker Desktop is currently blocked by the stuck CLI operations.

## Next Safe Action

Restart Docker Desktop, then rerun `docker compose build` and the isolated container health/API
smoke test. Add external connector/provider adapters only after the required provider accounts,
OAuth clients, and credentials are explicitly approved.

## Blocked Verification

- Confirmed on the third consecutive goal turn: Docker Desktop has not recovered. The prior
  `docker run`, `docker start`, and `docker ps` client operations remain stuck with no container
  state or log output. Docker runtime smoke and the final-source image rebuild require an
  external Docker Desktop restart.

## Make-It-Better Pass

- Product boundary fixes queued for validation: only executable destinations can be created, the
  single Discord gateway is enforced at the API boundary, and the Vite development origin now
  receives PATCH CORS permission for configuration updates.
- Setup recovery and settings completeness: initial load failures offer retry, paused-action
  failures surface in the operator UI, and the settings screen now accepts Gloo client IDs and
  YouVersion app keys without returning secrets.
- Verification: `pnpm check` passed with 31 tests; an isolated current-build server on port
  18796 accepted one Discord draft, rejected a second Discord deployment and planned Slack with
  409 responses, and returned PATCH in the allowed CORS methods.

## Finish-Line Coverage Ledger

| Issue or behavior | Failure mode / root cause | Executable coverage | Direct command | Broader suite | Status |
| --- | --- | --- | --- | --- | --- |
| Local configuration never exposes credentials | Browser control status could serialize stored secrets | `apps/server/src/control.test.ts` - `persists locally and never includes credentials in the browser shape` | `pnpm vitest run apps/server/src/control.test.ts` | `pnpm test` | Passed |
| A second Discord destination appears runnable despite one gateway | The runtime manager owns one gateway and reconciles only one active Discord deployment | `apps/server/src/control.test.ts` - `exposes a sanitized catalog and creates a Discord draft` asserts a second create returns `409` | `pnpm vitest run apps/server/src/control.test.ts` | `pnpm test` | Passed |
| Planned connectors create unusable, resume-trapping drafts | Slack and YouTube were accepted before executable connectors existed | `apps/server/src/control.test.ts` - `exposes a sanitized catalog and creates a Discord draft` asserts Slack create returns `409` | `pnpm vitest run apps/server/src/control.test.ts` | `pnpm test` | Passed |
| Browser setup fails from Vite because PATCH preflight is omitted | CORS only allowed GET and POST | `apps/server/src/control.test.ts` - `exposes a sanitized catalog and creates a Discord draft` asserts PATCH is returned for an OPTIONS preflight | `pnpm vitest run apps/server/src/control.test.ts` | `pnpm test` | Passed |
| Saved-but-uninstalled providers appear launchable | The setup let non-OpenAI selections reach a runtime failure | `apps/web/src/launch-readiness.test.ts` - `does not falsely enable launch for saved-but-uninstalled adapters` | `pnpm vitest run apps/web/src/launch-readiness.test.ts` | `pnpm test` | Passed |
| Gateway lifecycle and connection failure state | A failed start could leave stale active state | `apps/server/src/runtime-manager.test.ts` - lifecycle and failure tests | `pnpm vitest run apps/server/src/runtime-manager.test.ts` | `pnpm test` | Passed |

## Finish-Line Proof Matrix

| Surface | State | Evidence |
| --- | --- | --- |
| Local source and focused deterministic tests | Proved | Six assertions across `apps/server/src/control.test.ts`, `apps/server/src/runtime-manager.test.ts`, and `apps/web/src/launch-readiness.test.ts` pass under Vitest. |
| Local browser workflow | Proved | The current control surface build at port 18796 saved synthetic local Discord values, displayed an OpenAI credential launch guard, and disabled planned routes without browser console warnings. The final helper extraction retains that guard with an exact deterministic test and final web production build. |
| Full repository quality gate | Stale after final helper extraction | `pnpm check` previously passed with formatting, types, 31 tests, and workspace production builds. The final-source focused tests, lint, and web production build pass; a new full-app suite was intentionally reserved for a later `full-suite-tests` request. |
| Docker image | Proved before the final UI/test-seam change | Previous `docker compose build` succeeded. |
| Docker runtime | Blocked | Docker Desktop leaves client operations stuck; it needs an external restart before exact-source container smoke can run. |
| Hosted, shared provider, production, customer-visible | Not requested | No deployment, provider-account mutation, or external Discord action occurred. |

## Finish-Line Readiness

- Release notes, social copy, and marketing assets: deferred. This is a customer-facing product
  but not a deployable release candidate until Docker runtime verification and real credentials
  are available.
- Shared documentation: not applicable. No Threadlight-specific shared-docs repository was found;
  the repo README and architecture documentation are the current operational source.
- Rollout review: no migrations, schema changes, database work, queues, billing, webhooks, or
  provider-account operations are required for this local control-surface change. Docker remains
  the only deploy-readiness blocker.
- Approval register: `local code/tests/docs + /Users/preston/Code/threadlight + current
  codex/build-threadlight worktree + no external environment` is authorized by the feature-build
  and finish-line requests. No deployment, provider-account change, OAuth client creation,
  Discord mutation, database operation, billing action, or customer communication is authorized
  or was performed.

## Local Feature-Scoped Test Run

- Environment and scope: local `codex/build-threadlight`; self-hosted configuration wizard,
  local control API, launch eligibility, and Discord gateway lifecycle only. Docker runtime,
  live Discord, real provider credentials, hosted environments, and unrelated workspace suites
  were excluded.
- Deterministic result: `pnpm vitest run apps/server/src/control.test.ts
  apps/server/src/runtime-manager.test.ts apps/web/src/launch-readiness.test.ts` passed with six
  assertions. `pnpm lint` and `pnpm --filter @threadlight/web build` also passed.
- Browser result: a clean production server on port 18799 displayed the route chooser, kept Slack
  disabled as planned, created and saved a synthetic local Discord draft, displayed the credential
  launch guard, and rendered the setup fields at 390px width. Browser console warnings and errors
  were empty. The temporary server was stopped after the test.

## Live Provider Connectivity Check

- OpenAI: proved with Threadlight's real `OpenAIProvider.discern` path using an existing local
  operator credential and a synthetic reflection prompt. The provider returned a schema-valid
  normal-risk response with a discernment reason, pastoral intent, and Scripture request.
- Gemini: proved at the provider endpoint with an existing local operator credential and a
  minimal `gemini-2.5-flash` `generateContent` request. The endpoint returned a non-empty
  response.
- Threadlight Gemini runtime: not implemented. `apps/server/src/runtime.ts` only constructs an
  OpenAI provider and rejects `gemini`, so the Gemini result proves credential and endpoint
  connectivity, not a Threadlight Gemini integration. No credential values were logged, stored,
  or written to Threadlight configuration.
