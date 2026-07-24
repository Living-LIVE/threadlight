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

`apps/server` owns runtime configuration, the Discord gateway, participation timing,
per-conversation queues, bounded event deduplication, the public API, rate limiting, static
delivery, and process lifecycle.

### Deployment

The production build is a single Node.js process and a single Docker image. It contains the
compiled web application, API, Discord gateway, core orchestration, and provider adapters.
Startup fails when a selected provider is missing required configuration. A Discord connection
or command-registration failure leaves the HTTP service available for diagnosis and marks
readiness unavailable. The process handles `SIGINT` and `SIGTERM`, disconnects Discord, and
closes the HTTP server before exiting.

Threadlight is intentionally stateless:

- It does not persist Discord messages or demo conversations.
- It fetches only recent context from the configured channel or one of its child threads.
- Participation timers, mode overrides, queues, and deduplication state reset on restart.
- It needs no database or queue for the Discord-first release.
- Container replacement or laptop restart does not require data migration.

The liveness endpoint reports whether the process can serve requests. The readiness endpoint
separately reports whether an enabled Discord gateway can access the configured guild and
channel, exposes the effective participation mode and queue state, provides a sanitized install
URL when authorization is incomplete, and reports whether competition provider credentials are
configured.

### Web

`apps/web` is a no-login demonstration of the same orchestration path used by Discord. Bundled
scenarios provide an explicit fixture preview before a request is sent. A successful request
identifies the live providers in the provenance panel; a failed request shows an error and does
not substitute fixture output.

## Provider Contracts

The AI provider returns two structured outputs:

1. A discernment decision: respond, remain silent, clarify, or escalate.
2. A composed reply constrained to the supplied passage and safety rules.

The Scripture provider receives a normalized USFM book/chapter/verse request and returns text,
translation, attribution, and source metadata.

## Privacy

- Raw message content is not written to application logs.
- Demo sessions are processed in memory and are not persisted.
- Shy mode processes Discord context only after an explicit invocation.
- Medium and High process recent context without an explicit mention. Operators must disclose
  this behavior to participants in the configured channel.
- Provider keys remain server-side.

## Operator Boundary

Configuration is supplied through environment variables, normally with `.env.local` and Docker
Compose. Secrets are never accepted or exposed by the browser UI. The Runtime status drawer
reports sanitized service, provider, gateway, and channel state. An operator can bind the
container to a dedicated host, authorize and register commands into one guild, restrict
operation to one channel, and verify the resulting runtime through the health endpoints.
