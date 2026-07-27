# Threadlight Architecture

## System Shape

Threadlight uses one provider-neutral orchestration path for Discord and the public demo.

```text
Channel event
  -> participation policy and per-conversation queue
  -> normalized conversation context
  -> deterministic safety precheck
  -> AI discernment
  -> Scripture retrieval
  -> AI composition
  -> response safety
  -> channel-native rendering
```

## Boundaries

### Core

`packages/core` owns normalized conversation types, provider contracts, deterministic safety,
demo scenarios, orchestration, and trace data. It does not import channel or provider SDKs.

### Providers

`packages/providers` owns external request authentication and payload mapping. Provider SDK
types never cross into the core contract.

### Server

`apps/server` owns the local configuration store, runtime lifecycle manager, Discord gateway,
participation timing, per-conversation queues, bounded event deduplication, local control APIs,
rate limiting, static delivery, and process lifecycle.

### Deployment

The production build is a single Node.js process and a single Docker image. It contains the
compiled web application, API, Discord gateway, core orchestration, and provider adapters. It
starts without provider or Discord credentials so the local operator can complete setup. A local
configuration file is atomically written to a Docker volume with restricted permissions. A
Discord connection or command-registration failure leaves the HTTP service available for
diagnosis and marks that deployment as unavailable. The process handles `SIGINT` and `SIGTERM`,
disconnects Discord, and closes the HTTP server before exiting.

Threadlight is message-stateless:

- It does not persist Discord messages or demo conversations.
- Pending YouTube review drafts retain bounded comment and reply excerpts in the local operator
  configuration volume until the operator resolves them.
- It fetches only recent context from the configured channel or one of its child threads.
- Participation timers, mode overrides, queues, and deduplication state reset on restart.
- It needs no database or queue for the Discord-first release.
- Container replacement or laptop restart retains only operator configuration in the local volume.

The liveness endpoint reports whether the process can serve requests. The readiness endpoint
retains the legacy environment bootstrap status. `/api/control/status` reports the local route
catalog, sanitized provider state, deployment state, and runtime health. Control APIs accept
credentials write-only and never return them to the browser. When `THREADLIGHT_PUBLIC_URL` is not
loopback, every control API and the YouTube OAuth-start endpoint require a bearer operator token;
the OAuth callback remains state-signed for Google redirects. Remote anonymous demo requests are
off unless explicitly enabled.

### Hosted Topology

Threadlight's deployed runtime remains the Dockerized Node process because the Discord gateway and
YouTube poller require a long-lived connection and scheduled work. Railway is the current hosted
runtime checkpoint. A Vercel deployment can only be a separately configured static/operator UI;
it must use an explicit API origin for the persistent Threadlight service and cannot replace the
gateway or poller process. `VITE_THREADLIGHT_API_ORIGIN` configures the Vercel UI, while the
runtime's `WEB_ORIGIN` must be the Vercel URL for CORS and OAuth redirects. The remote runtime
also needs `THREADLIGHT_CONTROL_TOKEN`; the dashboard requests that code at runtime and retains it
only in memory. It is never a `VITE_*` variable and never belongs in the static deployment.

### Web

`apps/web` is a no-login local operator surface. It guides one current decision at a time:
choose a destination, connect it, then choose behavior and launch. After setup it becomes a
small deployment dashboard. The existing demo APIs remain available as an integration test path.

## Provider Contracts

The AI provider returns two structured outputs:

1. A discernment decision: respond, remain silent, clarify, or escalate.
2. A composed reply constrained to the supplied passage and safety rules.

The Scripture provider receives a normalized USFM book/chapter/verse request and returns text,
translation, attribution, and source metadata.

## Privacy

- Raw message content is not written to application logs.
- Demo sessions are processed in memory and are not persisted.
- Prompted mode processes Discord context only after an explicit invocation.
- Attentive and Active process recent context without an explicit mention. Operators must disclose
  this behavior to participants in the configured channel.
- Provider keys remain server-side.

## Operator Boundary

Configuration is normally supplied through the local operator UI and persisted in a Docker
volume. `.env.local` is an optional first-start bootstrap path. The browser submits credentials to
write-only APIs and receives sanitized status. Docker binds the control surface to loopback by
default. Remote exposure is protected by the operator token boundary and should also sit behind an
operator-authenticated proxy.
