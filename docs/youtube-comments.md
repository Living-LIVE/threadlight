# YouTube Comments Connector

## Status

**Implemented locally and deployed. Live OAuth and public-comment verification remain pending.**

The local dashboard includes a YouTube Comments destination, OAuth connection flow, Data API
client, poller, review queue, and guarded threaded-reply path. The connector is covered by local
deterministic tests and a synthetic-credential control API canary. It is not yet proven against a
real Google OAuth consent flow or a public YouTube comment.

## Product Intent

Threadlight should help a channel owner respond thoughtfully to conversations below their videos.
It should process only new, eligible top-level comments, apply the same discernment, Scripture,
and safety pipeline used by other connectors, and post a reply only under an explicit operator
policy.

The default policy is **Review**: Threadlight prepares a draft, and the channel owner approves it
before it is posted. The implemented policies are:

- **Selective**: post only when discernment requests a response and the daily reply limit allows
  it.
- **High touch**: ask Threadlight to prepare a draft for every eligible comment, still requiring
  owner approval.

Unattended replies to every comment are out of scope. They create public moderation, theological,
and quota risk without an appropriate operator review path.

## Required Operator Setup

Before implementation can be tested against an owned channel, the operator needs:

1. A Google Cloud project with YouTube Data API v3 enabled.
2. A Google OAuth web client with an approved consent screen.
3. Authorized redirect URIs for each environment that will run the connector.
4. A dedicated test video with comments enabled.

The callback paths are:

```text
http://127.0.0.1:8787/api/oauth/youtube/callback
https://threadlight-production.up.railway.app/api/oauth/youtube/callback
```

The public Railway domain is a deployed Threadlight control surface. Operators must add only the
environments they control to the Google OAuth client and must never place OAuth secrets in
committed configuration files.

## Intended Runtime Flow

```text
YouTube poller
  -> commentThreads.list
  -> durable watermark and duplicate check
  -> normalized Threadlight conversation
  -> safety and discernment
  -> Scripture retrieval and reply composition
  -> review queue or posting policy
  -> comments.insert reply
```

The connector needs durable operational state that Discord does not require: processed-comment
IDs, draft/reply status, and rate-limit counters. Pending review drafts retain bounded excerpts of
the original comment and proposed reply in local configuration so the operator can make an
informed decision. Credentials remain server-side and browser status responses expose only whether
each credential is configured.

This release supports one YouTube Comments destination per Threadlight installation. It keeps the
poller, reply quotas, and local operator dashboard unambiguous for a self-hosted single-process
deployment.

## Safety And Operating Controls

- Default to Review mode.
- Enforce a configurable daily reply cap for both automatic and approved replies.
- Do not reply to the channel owner, deleted comments, duplicate comments, or comments on videos
  where replies are unavailable.
- Suppress automated engagement for crisis, self-harm, threats, harassment, sensitive minors
  content, or requests that require pastoral or counseling judgment. Urgent or escalation results
  are never drafted or posted, including in Selective mode.
- Store only the bounded comment and reply excerpts required for a pending review draft; never
  expose secrets in browser status responses.
- Surface expired OAuth credentials, quota exhaustion, disabled comments, and failed post attempts
  in the local dashboard.

## Implementation And Test Gates

The feature is ready for a controlled live test when all of these are present:

1. The local and Railway callback URIs are registered in the Google OAuth client.
2. A channel owner completes OAuth and Threadlight discovers the owned channel.
3. A dedicated test video has comments enabled.
4. A controlled read-only poll finds a test comment.
5. A review draft is approved for one explicit `comments.insert` canary.

No production-channel comment should be posted as a test. Use a controlled test video and explicit
operator approval for the first write canary.
