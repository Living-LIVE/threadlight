# Live YouTube Comment-To-Reply User Story

Date: 2026-07-29

## Objective

Prove that a controlled non-owner comment on the currently selected `We Paint!` video is observed
by the hosted Threadlight YouTube connector, becomes a useful Scripture-backed review draft, and
can be approved into one publicly visible threaded reply.

## Execution Boundary

- Repository: `/Users/preston/Code/threadlight`
- Branch: `codex/build-threadlight`
- Base revision: `543ae66`
- Worktree: preserve the existing uncommitted journey and finish-line changes
- Hosted runtime: `https://threadlight-production.up.railway.app`
- Video: `We Paint!` (`https://www.youtube.com/watch?v=hiuP2zXds2s`)
- Comment identity: the previously approved non-owner `@SplinteredGlassSolutions` YouTube identity
- Approved external mutations:
  - one transparent test comment on the selected video
  - one Threadlight scan if the normal poll has not completed
  - one approved Threadlight threaded reply to that exact comment
- Local code authority: diagnosis, smallest necessary repair, focused tests, and retest
- Hosted configuration authority: read and exercise the existing connector only
- Deploy authority: none
- Prohibited: credential creation or exposure, account or OAuth changes, permission changes,
  unrelated comments or replies, deleting existing comments, destructive operations, and
  deployment
- Token/log policy: record no access tokens, refresh tokens, client secrets, control codes, or raw
  provider credentials

## Story

1. Open `We Paint!` using the approved non-owner YouTube identity.
2. Post exactly:
   `Threadlight controlled test: man, it's been a long day. Is there a Scripture that speaks to rest?`
3. Verify the comment is publicly visible under the non-owner identity.
4. Wait for the configured poll or run one operator scan.
5. Verify Threadlight creates one pending review draft for the exact comment.
6. Audit the draft for direct acknowledgement, faithful Scripture use, useful brevity, and no
   invented commitments.
7. Approve the draft once through Threadlight.
8. Verify one threaded reply is publicly visible beneath the original YouTube comment.

## Acceptance Criteria

- The hosted YouTube connector is `running`, `ready=true`, and scoped to `We Paint!`.
- The test comment is created by a non-owner identity and remains visible.
- Threadlight processes only the selected video and exact new comment.
- Exactly one pending draft is selected for approval; duplicates are not posted.
- The generated reply is contextually relevant, grounded in an attributed passage, concise, and
  pastorally restrained.
- Approval changes the authoritative draft state to `posted`.
- One public threaded reply appears beneath the source comment.
- Local, hosted-control, provider, and public YouTube proof remain distinct.

## Baseline

- Hosted YouTube state: `running`, `ready=true`
- Channel: `Preston Pope`
- Selected video: `We Paint!`
- Reply policy: `Review every reply`
- Daily count: `1/12`
- Last successful poll observed before mutation: `2026-07-29T19:58:30.601Z`
- Local YouTube deployment: excluded; it is an unconfigured draft with no selected video or OAuth

## Run Ledger

- Prerequisites: PASS
- Authenticated non-owner comment: PASS
  - Author: `@SplinteredGlassSolutions`
  - Source comment: `Threadlight controlled test: man, it's been a long day. Is there a Scripture that speaks to rest?`
  - Public comment URL: `https://www.youtube.com/watch?v=hiuP2zXds2s&lc=UgxCbEn5nHUXtg4ZvLd4AaABAg`
  - Published at: `2026-07-29T20:08:38Z`
  - Browser proof: YouTube showed the exact comment at `0 seconds ago` under the non-owner identity
- Hosted observation/draft: PASS
  - Scheduled poll observed at: `2026-07-29T20:10:31.411Z`
  - Draft created at: `2026-07-29T20:10:46.091Z`
  - Draft status before approval: `pending`
  - Provider trace: `gloo + ao-lab`
  - Generation duration: `14679 ms`
- Draft quality audit: PASS
  - Directly acknowledges weariness and rest
  - Uses Matthew 11:28-30 in context and attributes the BSB translation
  - Remains concise and pastorally restrained
  - Makes no invented commitment or guarantee
- Threadlight approval: PASS
  - Exactly one approval request was sent for the matching pending draft
  - Authoritative status after approval: `posted`
  - Resolved at: `2026-07-29T20:11:26.760Z`
- Public threaded reply: PASS
  - YouTube Data API returned exactly one reply for the source comment
  - Reply author: `@Prestonepope`
  - Reply ID: `UgxCbEn5nHUXtg4ZvLd4AaABAg.AZrRti9OWT_AZrSDDeT_0K`
  - Reply published at: `2026-07-29T20:11:26Z`
  - Reply parent ID matches the source comment ID
  - Public reply text exactly matches the approved Threadlight draft
- Repair/retest: NOT REQUIRED
  - The scheduled poll, draft generation, approval, and public post all succeeded without a code
    or configuration change

## Stateful Operations

| Operation | Count | Result |
| --- | ---: | --- |
| Non-owner YouTube comments created | 1 | Exact controlled source comment |
| Manual Threadlight scans | 0 | Scheduled poll observed the comment |
| Threadlight draft approvals | 1 | Matching draft moved to `posted` |
| Public YouTube replies created | 1 | One reply beneath the source comment |
| Repairs or deployments | 0 | Not required or authorized |

## Automated Regression Coverage

| Behavior | Executable coverage | Focused command | Full-suite command |
| --- | --- | --- | --- |
| Owned-channel and selected-video scoping | `apps/server/src/youtube/client.test.ts` - the owned-channel and selected-video tests | `pnpm vitest run apps/server/src/youtube/client.test.ts` | `pnpm test:full` |
| Review draft, deduplication, and approval-only posting | `apps/server/src/youtube/connector.test.ts` - `creates one review draft, deduplicates it, and posts only after approval` | `pnpm vitest run apps/server/src/youtube/connector.test.ts` | `pnpm test:full` |
| Overlapping poll deduplication | `apps/server/src/youtube/connector.test.ts` - `serializes overlapping scans so a comment produces only one draft` | `pnpm vitest run apps/server/src/youtube/connector.test.ts` | `pnpm test:full` |
| Public monitoring renders the completed exchange | `apps/web/e2e/core-journeys.spec.ts` - `monitoring shows live health, activity details, external actions, and error filtering` | `pnpm test:e2e --grep "monitoring shows"` | `pnpm test:full` |

Focused finish-line validation on 2026-07-29 passed 33 deterministic tests and all four browser
journeys. The normal `pnpm test:full` command includes every test named above; running that broader
suite remains a separate explicit request.

## Truth Matrix

| Layer | Status | Evidence |
| --- | --- | --- |
| Local repository | FIXED | Current dirty branch preserved at base `543ae66` |
| Local YouTube connector | OUT OF SCOPE | Unconfigured draft |
| Hosted Threadlight runtime | PASS | Scheduled poll observed the comment and the protected control API reports the draft `posted` |
| Provider-backed draft | PASS | Scheduled poll created one pending `gloo + ao-lab` draft grounded in Matthew 11:28-30 BSB |
| Public YouTube comment | PASS | Exact comment visible under `@SplinteredGlassSolutions` with a unique public comment URL |
| Public Threadlight reply | PASS | YouTube Data API reports exactly one `@Prestonepope` reply with matching text and parent ID |

## Final Status

PASS - FEATURE-SCOPED
