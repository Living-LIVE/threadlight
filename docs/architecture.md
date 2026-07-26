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
credentials write-only and never return them to the browser.

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
volume. `.env.local` is an optional first-start bootstrap path. The browser submits credentials
only to local write-only APIs and receives sanitized status. Docker binds the control surface to
loopback by default; any remote exposure must be protected by an operator-authenticated proxy.
