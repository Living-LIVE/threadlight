# Deployment And Operations

Threadlight is a long-running Node.js service. The same process serves the dashboard and control
API, maintains the Discord gateway connection, and runs the YouTube Comments poller. Deploy the
complete container to a host that supports persistent processes and durable storage.

## Production Checkpoint

| Field | Current value |
| --- | --- |
| Public application | [Railway production](https://threadlight-production.up.railway.app/?demo=public) |
| Service | `threadlight` |
| Environment | `production` |
| Source branch | `codex/build-threadlight` |
| Source revision | `09764bf6dc6b6d6527a91b9a519138545b6d6169` |
| Railway deployment | `5f461d7f-4155-401a-99d3-ed71b7e99298` |
| Verified | 2026-07-29 |

That deployment reached Railway `SUCCESS` with one running replica. The public workspace and
health endpoint returned `200`, the Discord runtime reported enabled, ready, and running, and the
operator control endpoint returned `401` without authorization. The deployed JavaScript bundle
contained the current public-demo, provider, and live-response surfaces.

This is deployment evidence, not a substitute for feature QA. The current local feature evidence
is recorded in the [full-suite QA ledger](qa/2026-07-29-full-suite-local.md).

## Runtime Topology

```text
Browser
  |
  +-- public demo and sanitized monitoring
  +-- protected operator dashboard
          |
          v
Threadlight container
  +-- web application
  +-- control API
  +-- Discord gateway
  +-- YouTube poller
  +-- AI and Scripture adapters
          |
          v
Persistent /data volume
  +-- sanitized configuration
  +-- bounded activity ledger
  +-- pending YouTube review drafts
```

The production service currently uses a Railway volume mounted at `/data`. Do not replace or
detach that volume during a routine code deployment.

## Required Configuration

Use environment variables or the protected operator setup flow. Never commit real values.

| Variable | Purpose |
| --- | --- |
| `THREADLIGHT_CONFIG_PATH` | Durable operator configuration file. |
| `THREADLIGHT_ACTIVITY_PATH` | Durable bounded activity ledger. |
| `THREADLIGHT_CONTROL_TOKEN` | Protects remote configuration and publishing routes; use at least 32 bytes. |
| `THREADLIGHT_DEMO_ENABLED` | Enables the no-login, read-only public workspace and curated scenarios. |
| `THREADLIGHT_PUBLIC_URL` | Canonical public runtime URL used in links and callbacks. |
| `WEB_ORIGIN` | Browser origin allowed to call the runtime. |
| `YOUTUBE_OAUTH_CLIENT_ID` | Installation-level Google OAuth client identifier. |
| `YOUTUBE_OAUTH_CLIENT_SECRET` | Installation-level Google OAuth client secret. |

Provider and connector credentials may be saved through the protected dashboard into the durable
configuration volume. The API returns configured/not-configured state rather than stored secrets.

## Self-Hosted Docker

```bash
docker compose up --build -d
curl --fail http://localhost:8787/api/health
```

Open [http://localhost:8787](http://localhost:8787). Docker Compose binds to loopback by default.
Use an operator-authenticated HTTPS reverse proxy before exposing a self-hosted instance to a
network.

## Railway Release

Before deploying, confirm the linked Railway project, environment, service, branch, and clean
worktree. Run the repository quality gate separately from the deployment operation.

```bash
git status --short --branch
git rev-parse HEAD
railway status
railway up \
  --service threadlight \
  --environment production \
  --detach \
  --message "Deploy <short-sha>: <release summary>"
```

Wait for the exact deployment to reach a terminal state:

```bash
railway deployment list \
  --service threadlight \
  --environment production \
  --limit 3 \
  --json
```

Do not report a release as deployed while Railway still reports `BUILDING` or `DEPLOYING`.

## Production Verification

After Railway reports `SUCCESS`, verify the runtime and access boundary:

```bash
curl --fail https://threadlight-production.up.railway.app/api/health
curl --fail \
  "https://threadlight-production.up.railway.app/?demo=public"
curl --output /dev/null --silent --write-out "%{http_code}\n" \
  https://threadlight-production.up.railway.app/api/control/status
```

Expected results:

- Health and public demo return `200`.
- Health reports the intended providers and connector readiness.
- The unauthenticated control request returns `401`.
- Railway reports one or more running replicas and the intended deployment ID.
- The deployed bundle contains a marker introduced by the intended source revision.

Keep these proof boundaries separate:

- **Pushed:** the source revision exists on the remote branch.
- **Deployed:** the hosting provider made that exact release active.
- **Healthy:** readiness and security-boundary checks pass.
- **Feature-verified:** focused local or hosted user journeys pass independently.

## Rollback

If a deployment fails before activation, leave the last successful release serving traffic and
inspect the failed deployment logs. If a newly active release fails health or security checks,
redeploy the last known-good source revision through Railway and repeat the production verification
steps. Record the replacement deployment ID; do not describe a removed Railway deployment as an
active rollback target.

Routine rollback must not modify provider credentials, OAuth clients, permissions, or the `/data`
volume.
