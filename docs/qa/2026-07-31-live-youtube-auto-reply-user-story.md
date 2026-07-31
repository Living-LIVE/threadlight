# Live YouTube Automatic Reply User Story

Date: 2026-07-31

## Objective

Prove that the production Threadlight worker is connected to Preston's real owned YouTube channel,
watches one real video, and automatically posts one safe Scripture-grounded reply to one new
controlled comment from a separate Google/YouTube identity.

## Execution Boundary

- Repository: `/Users/preston/Code/threadlight`
- Branch: `codex/build-threadlight`
- Base revision: `94cf5ea`
- Hosted runtime: `https://threadlight-production.up.railway.app`
- Owner channel: `Preston Pope` (`UC6OVIH4qLnzIGglvOXyvh8A`)
- Selected video: `We Paint!` (`https://www.youtube.com/watch?v=hiuP2zXds2s`)
- Comment identity: the approved non-owner Splintered Glass Solutions YouTube identity
- Approved production mutations:
  - keep `We Paint!` as the only selected video
  - change the YouTube reply policy from Review to Selective automatic replies
  - publish one transparent controlled test comment
  - allow Threadlight to publish one automatic threaded reply to that exact comment
  - deploy an in-scope repair only if the live story exposes a code defect
- Prohibited: new OAuth credentials, access or permission changes, credential exposure, unrelated
  comments or replies, destructive operations, and unrelated repository changes
- Token/log policy: never record access tokens, refresh tokens, client secrets, control codes, or
  raw provider credentials

## Story

1. Verify the connected OAuth grant lists the real `Preston Pope` owned channel and its real videos.
2. Select `We Paint!`, set `Selective automatic replies`, retain the daily cap, and keep the worker
   running.
3. Open the real video in the separate signed-in SGS browser identity.
4. Publish a controlled comment that invites a brief Scripture-grounded reply.
5. Verify the comment is publicly visible and capture its public URL or provider ID.
6. Wait for the normal poll or run one operator scan.
7. Verify Threadlight records the comment and automatically posts exactly one threaded reply.
8. Audit the reply for relevance, faithful Scripture use, brevity, and safety.
9. Verify the reply is publicly visible below the source comment.
10. If code changes are required, run focused checks, commit and push only the task-owned change,
    deploy to the registered Railway production service, and verify revision health.

## Acceptance Criteria

- The protected control API and live monitoring projection agree on the owner channel and video.
- The production policy is `selective`, the worker is running and ready, and the last poll has no
  error.
- One new comment is publicly visible under the separate SGS identity.
- Threadlight processes only that eligible new comment and posts exactly one reply without manual
  approval.
- The reply is contextually relevant, grounded in Scripture, pastorally restrained, and publicly
  visible beneath the correct parent comment.
- No secret appears in source, logs, screenshots, or the public control response.
- Local, hosted configuration, provider processing, and customer-visible proof remain distinct.

## Run Ledger

- Prerequisites: PASS
  - The production OAuth grant returned the owned `Preston Pope` channel and its real video list.
  - The separate Chrome profile was signed in as `@SplinteredGlassSolutions`, not the owner
    channel `@Prestonepope`.
- Production configuration: PASS
  - Deployment `b0a5848d-af47-4872-bb90-75b2857aa18c` remained scoped to `We Paint!`.
  - Reply mode changed from `review` to `selective`; the worker remained `running` with no last
    error and a 12-reply daily cap.
- External test comment: PASS
  - The first transparency-heavy canary was visible to its author but absent from YouTube's public
    API after repeated checks, consistent with YouTube moderation or spam filtering. Threadlight
    correctly did not process a comment unavailable through the provider API.
  - The acceptance canary used natural language: `I've been feeling discouraged this week. Is
    there a passage that could help me keep going?`
  - Source comment ID: `UgyZa6Is7PWeCsyPSfh4AaABAg`
  - Public source URL:
    `https://www.youtube.com/watch?v=hiuP2zXds2s&lc=UgyZa6Is7PWeCsyPSfh4AaABAg`
  - YouTube's public API returned the comment with `canReply: true` and zero replies before the
    Threadlight scan.
- Automatic provider reply: PASS
  - Threadlight recorded `observed` at `2026-07-31T16:35:09.928Z` and `posted` at
    `2026-07-31T16:35:22.794Z`, with no manual draft or approval.
  - Provider trace: `gloo + youversion`; measured orchestration duration: `11,873 ms`.
  - The reply cited Isaiah 40:31 and connected the passage directly to discouragement and renewed
    strength without overclaiming or escalating the interaction.
- Public visibility: PASS
  - The signed-in non-owner YouTube page showed `1 reply` beneath the exact source comment.
  - Expanding the thread showed the reply from `@Prestonepope` and the same text recorded by the
    Threadlight activity feed.
  - Public reply ID: `UgyZa6Is7PWeCsyPSfh4AaABAg.AZwCzqr263wAZwD4R_fxfq`
  - Public reply URL:
    `https://www.youtube.com/watch?v=hiuP2zXds2s&lc=UgyZa6Is7PWeCsyPSfh4AaABAg.AZwCzqr263wAZwD4R_fxfq`
- Repair and deployment: PASS
  - The live story exposed no Threadlight code defect.
  - Focused verification passed: 22 YouTube connector/client/control tests, workspace typecheck,
    and the monitoring Playwright journey.
  - Commit `5ff31ad` was pushed and deployed successfully as Railway deployment
    `4f7b78bd-17f0-4976-9786-9f7349f3c96c`.
  - After restart, `/api/health` returned `200`; Discord remained running and ready; the public
    live projection retained the selected YouTube video, Selective policy, and exact
    `observed`/`posted` acceptance events.

## Truth Matrix

| Layer | Status | Evidence |
| --- | --- | --- |
| Local repository | BASELINE | Clean branch at `94cf5ea` before this ledger |
| Hosted configuration | PASS | Real owner channel, `We Paint!`, and Selective policy confirmed |
| Hosted worker | PASS | Running, ready, last poll successful, no connector error |
| External source comment | PASS | Public API and browser agree on `UgyZa6Is7PWeCsyPSfh4AaABAg` |
| Provider automatic reply | PASS | One `observed` event followed by one `posted` event |
| Public YouTube reply | PASS | One expanded reply from `@Prestonepope` under the correct parent |
| Production deployment | PASS | Railway `4f7b78bd-17f0-4976-9786-9f7349f3c96c` succeeded and post-release health returned `200` |

## Stateful Operation Accounting

- YouTube source comments submitted: 2
  - 1 author-visible canary held out of YouTube's public API and therefore not processed
  - 1 publicly visible acceptance canary processed by Threadlight
- Automatic public replies posted by Threadlight: 1
- Manual draft approvals: 0
- OAuth grants, credentials, permissions, selected videos, and daily limits changed: 0

## Result

PASS. The production worker observed a real public comment from a separate YouTube identity and
posted exactly one contextually appropriate Scripture-grounded reply beneath the correct parent
without manual approval. The initial held comment demonstrates the expected dependency boundary:
Threadlight only processes comments YouTube exposes through its API.
