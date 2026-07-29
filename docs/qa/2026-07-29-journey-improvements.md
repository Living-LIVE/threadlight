# Web Journey Improvement Ledger

Date: 2026-07-29

## Objective

Improve the setup, deployment, and monitoring journeys without replacing the existing
one-step-at-a-time wizard or weakening the public/operator boundary.

## Build State

- Repository: `/Users/preston/Code/threadlight`
- Branch: `codex/build-threadlight`
- Base revision: `543ae66`
- Deployment authority: local implementation and verification only; no hosted deployment requested

## Selected Improvements

| Journey | Improvement | Acceptance |
| --- | --- | --- |
| Setup | Clear three-stage progress and recommended first connector | Current stage is obvious without showing every setup screen |
| Setup | Explicit Discord credential-to-location handoff | A new install saves credentials before requesting selectable servers and channels |
| Setup | Memory-only hosted operator unlock | Public access remains open while protected controls have an explicit entry and recovery path |
| Deployment | Final readiness review before launch | Destination, presence, AI, model, and Scripture source are visible before launch |
| Deployment | Private provider preflight | Launch remains disabled until the selected provider pair forms a successful response |
| Deployment | Runtime-backed success | A saved deployment is not reported as live unless its connector reports ready |
| Deployment | Dismissible success and error feedback | Launch, pause, and settings changes have visible completion feedback |
| Monitoring | First-class Deployments and Monitoring workspaces | Operators can move between configuration and operational state |
| Monitoring | Health summary and activity filters | Live connectors, event count, errors, and connector-specific activity are scannable |
| Monitoring | Protected operator activity API | Monitoring works when the public demo endpoint is disabled |

## Proof

Completed:

- 33 focused deterministic tests pass, including:
  - protected operator activity and sanitized public activity
  - Discord credential gating before location discovery
  - launch failure when a connector does not become runtime-ready
  - activity filtering while preserving event order
  - OpenAI rejects Gloo's `auto` routing model without changing saved configuration
  - provider changes select a compatible model default
  - YouTube owned-channel and selected-video scoping
  - YouTube review drafts remain pending until approval, deduplicate repeated scans, and post one
    threaded reply after approval
- Four credential-free Playwright tests pass:
  - Monitoring renders live health, activity provenance, external actions, and error filtering.
  - Monitoring renders a completed YouTube source-comment and reply exchange.
  - Public setup advances one stage at a time, keeps the access code masked, resets provider models,
    requires provider preflight, and returns a dismissible, accurate launch success.
  - Discord setup keeps saved credentials hidden while exposing server and channel selectors.
  - Monitoring remains usable at `390x844` without horizontal overflow.
- Web and server TypeScript checks pass.
- Web and server production builds pass.
- Biome passes on every changed implementation and test file.
- The real local Discord user story passed after correcting the saved OpenAI model; see
  [Live Discord immediate-response user story](2026-07-29-live-discord-user-story.md).
- The hosted YouTube connector observed one non-owner comment on `We Paint!`, created one
  `gloo + ao-lab` review draft, and posted exactly one public threaded reply after approval; see
  [Live YouTube comment-to-reply user story](2026-07-29-live-youtube-user-story.md).

## Evidence

- `output/playwright/operator-access-desktop.png`
- `output/playwright/deployment-review-passed-desktop.png`
- `output/playwright/monitoring-mobile.png`
- `output/playwright/deployments-mobile.png`

## Deliberate Deferrals

- URL-backed nested routes and browser back/forward restoration would improve deep linking but are
  not required for this compact single-page control surface.
- The repository-wide deterministic gate and every unrelated connector test were not rerun in this
  feature-scoped pass. `pnpm test:full` is the mandatory later full-suite command.

## Finish-Line Coverage Ledger

| Issue or behavior | Root cause or failure mode | Executable test | Direct command | Full-suite command | Status |
| --- | --- | --- | --- | --- | --- |
| Setup stages and recommended connector | A dense all-at-once setup surface obscures the current decision | `core-journeys.spec.ts` - `public setup and deployment stay isolated and require a successful provider check` asserts stages 1, 2, and 3 plus unavailable connectors | `pnpm test:e2e --grep "public setup"` | `pnpm test:full` | PASS |
| Hosted operator access is discoverable but protected | Public users could miss control access or expose its value | Same Playwright test asserts the Manage path and password input; `control.test.ts` - `requires an operator token for remote control and disables anonymous demos` asserts API protection | `pnpm test:e2e --grep "public setup"` and `pnpm vitest run apps/server/src/control.test.ts` | `pnpm test:full` | PASS |
| Discord credentials precede location selection | Location discovery without a bot token produces an unactionable failure or saved credentials leak back into the browser | `control.test.ts` - `lists selectable Discord servers and channels without exposing bot credentials`; `core-journeys.spec.ts` - `Discord setup keeps credentials hidden while exposing selectable locations` | `pnpm vitest run apps/server/src/control.test.ts` and `pnpm test:e2e --grep "Discord setup"` | `pnpm test:full` | PASS |
| Launch requires an executable provider | Saved credentials alone can falsely enable unsupported adapters | `launch-readiness.test.ts` - all three provider-readiness cases | `pnpm vitest run apps/web/src/launch-readiness.test.ts` | `pnpm test:full` | PASS |
| Launch requires provider preflight | A deployment could start before proving AI plus Scripture composition | `core-journeys.spec.ts` - public setup test asserts Launch is disabled before Save and test, then enabled afterward | `pnpm test:e2e --grep "public setup"` | `pnpm test:full` | PASS |
| Launch success must reflect runtime readiness | A saved deployment could be labeled live after its connector failed | `control.test.ts` - `does not report a launch as successful until its runtime is ready` | `pnpm vitest run apps/server/src/control.test.ts` | `pnpm test:full` | PASS |
| Success and error feedback must be actionable | Operators could miss a completed action or be unable to clear stale feedback | `core-journeys.spec.ts` - public setup test asserts the launch notice and dismisses it; runtime failure is asserted by `control.test.ts` | `pnpm test:e2e --grep "public setup"` and `pnpm vitest run apps/server/src/control.test.ts` | `pnpm test:full` | PASS |
| Gloo `auto` persisted into OpenAI | Provider switching retained an incompatible model and caused the live Discord fallback | `provider-model.test.ts` - `replaces Gloo auto-routing when switching to OpenAI`; `control.test.ts` - `rejects Gloo auto-routing when OpenAI is selected`; public setup Playwright test asserts the visible model transition | `pnpm vitest run apps/web/src/provider-model.test.ts apps/server/src/control.test.ts` and `pnpm test:e2e --grep "public setup"` | `pnpm test:full` | PASS |
| Monitoring must expose health and provenance | Operators could not explain what Threadlight observed, sent, skipped, or failed | `core-journeys.spec.ts` - `monitoring shows live health, activity details, external actions, and error filtering`; `control.test.ts` sanitization case | `pnpm test:e2e --grep "monitoring shows"` and `pnpm vitest run apps/server/src/control.test.ts` | `pnpm test:full` | PASS |
| YouTube review history must remain visible | A completed source-comment and approved reply could exist at the connector but remain invisible in the dashboard | `core-journeys.spec.ts` - `monitoring shows live health, activity details, external actions, and error filtering` expands the review history and asserts the author, source comment, `posted` state, and generated reply | `pnpm test:e2e --grep "monitoring shows"` | `pnpm test:full` | PASS |
| YouTube selection must scope polling | Signing in could list the wrong channel or poll videos outside the operator allowlist | `client.test.ts` - `lists the authenticated channel's videos and scopes comment requests to selected videos` and `lists all owned channels and scopes the video picker to a selected channel` | `pnpm vitest run apps/server/src/youtube/client.test.ts` | `pnpm test:full` | PASS |
| Review mode must not post before approval or duplicate a comment | Repeat or overlapping polls could create duplicate drafts or replies, and review mode could bypass operator approval | `connector.test.ts` - `creates one review draft, deduplicates it, and posts only after approval` plus `serializes overlapping scans so a comment produces only one draft` | `pnpm vitest run apps/server/src/youtube/connector.test.ts` | `pnpm test:full` | PASS |
| Urgent YouTube comments must fail closed | An urgent safety escalation could be queued or posted as an automated Scripture reply | `connector.test.ts` - `never queues or posts an urgent escalation in any reply mode` | `pnpm vitest run apps/server/src/youtube/connector.test.ts -t "never queues or posts"` | `pnpm test:full` | PASS |
| Activity filters preserve event order | Filtering could hide the wrong connector events or reorder the ledger | `activity-filter.test.ts` - `filters by connector and error status without changing event order` | `pnpm vitest run apps/web/src/activity-filter.test.ts` | `pnpm test:full` | PASS |
| Mobile monitoring layout | Summary, filters, or actions could overflow the lightweight dashboard | `core-journeys.spec.ts` - `monitoring remains usable at a mobile dashboard viewport` asserts key controls and no horizontal overflow at `390x844` | `pnpm test:e2e --grep "mobile dashboard"` | `pnpm test:full` | PASS |

Every test in this ledger is included by `pnpm test:full`.

## Proof Matrix

| Layer | Status | Evidence |
| --- | --- | --- |
| Local implementation | PROVED | Focused deterministic tests, typechecks, and builds pass |
| Local browser | PROVED | Four Playwright journeys pass with pinned Chromium |
| Authenticated local Discord | PROVED | Real `#general` message produced a response and activity trace |
| Committed/pushed | NOT REQUESTED | Finish-line changes remain in the current worktree |
| Hosted connector runtime | PROVED, DEPLOYED SOURCE DISTINCT | Existing Railway runtime completed the Discord and YouTube canaries; this does not prove the current dirty dashboard source is deployed |
| Provider-backed behavior | PROVED | Hosted YouTube draft trace reported `gloo + ao-lab`; public reply matched the approved draft |
| Public YouTube result | PROVED | YouTube reported one `@Prestonepope` reply beneath the controlled non-owner comment |
| Current-source deployment | NOT REQUESTED | No deployment or publication of the dirty finish-line source occurred |

## Rollout Safety

- No migrations, schemas, databases, billing, webhooks, queues, jobs, seeds, backfills, provider
  accounts, OAuth clients, permissions, or hosted environment values changed.
- The only runtime configuration repair was the already approved local OpenAI model change from
  `auto` to `gpt-4.1-mini`.
- The previously authorized live story created one controlled non-owner YouTube comment and one
  approved threaded reply. It did not change connector configuration, credentials, OAuth, or
  deployment state.
- No deploy, push, merge, or traffic promotion occurred.
- The API compatibility guard is additive: it rejects only the invalid OpenAI plus `auto`
  combination and leaves valid saved configurations unchanged.

## Release Materials

- Release-note source: `CHANGELOG.md` Unreleased section.
- Suggested handoff headline: "Threadlight now guides setup, proves readiness before launch, and
  shows what every connector observed and returned."
- Suggested short copy: "Configure one destination at a time, validate the provider pair before
  launch, and monitor responses, Scripture references, skips, and connector errors from one
  lightweight dashboard."
- Existing screenshots remain under `output/playwright/` and are intentionally gitignored.
- Marketing image generation is deferred. This is an uncommitted open-source/hackathon handoff, not
  a verified production launch, and the available marketing workflow is Bonfire-branded rather
  than Threadlight-branded.

## Finish-Line Sequence Status

| Step | Status | Evidence |
| --- | --- | --- |
| Verify feature complete | COMPLETED | Changed implementation and journeys reviewed |
| Focused QA/regression | COMPLETED | 21 deterministic tests and 4 Playwright tests pass |
| Acceptance criteria | COMPLETED | Selected-improvements table and coverage ledger are green |
| Documentation/changelog | COMPLETED | README, contributing guide, current state, changelog, and this ledger updated |
| Release notes | COMPLETED | Drafted in `CHANGELOG.md`; not published |
| Social copy | COMPLETED | Suggested local handoff copy above; not published |
| Marketing assets | DEFERRED | Threadlight brand package needed; no production-live claim |
| Bundled handoff | COMPLETED | This ledger links proof, commands, and status |
| Ready for release | INCOMPLETE | Local finish-line gates are green; commit/push, the separate full-suite request, and current-source deployment were not requested |
