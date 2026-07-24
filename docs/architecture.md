# Threadlight Architecture

## System Shape

Threadlight uses one provider-neutral orchestration path for Discord and the public demo.

```text
Channel event
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

`apps/server` owns runtime configuration, the Discord gateway, the public API, rate limiting,
static delivery, and process lifecycle.

### Deployment

The production build is a single Node.js process and a single Docker image. It contains the
compiled web application, API, Discord gateway, core orchestration, and provider adapters.
Startup fails when a selected provider or enabled Discord integration is missing required
configuration. The process handles `SIGINT` and `SIGTERM`, disconnects Discord, and closes the
HTTP server before exiting.

Threadlight is intentionally stateless:

- It does not persist Discord messages or demo conversations.
- It fetches only recent channel context after an explicit invocation.
- It needs no database or queue for the Discord-first release.
- Container replacement or laptop restart does not require data migration.

The liveness endpoint reports whether the process can serve requests. The readiness endpoint
separately reports whether an enabled Discord gateway is connected and whether competition
provider credentials are configured.

### Web

`apps/web` is a no-login demonstration of the same orchestration path used by Discord. It has
fixture fallbacks for presentation resilience, but a successful live demo identifies the real
providers in the provenance panel.

## Provider Contracts

The AI provider returns two structured outputs:

1. A discernment decision: respond, remain silent, clarify, or escalate.
2. A composed reply constrained to the supplied passage and safety rules.

The Scripture provider receives a normalized USFM book/chapter/verse request and returns text,
translation, attribution, and source metadata.

## Privacy

- Raw message content is not written to application logs.
- Demo sessions are processed in memory and are not persisted.
- Discord context is fetched only for an explicit command or mention.
- Provider keys remain server-side.

## Operator Boundary

Configuration is supplied through environment variables, normally with `.env.local` and Docker
Compose. Secrets are never accepted or exposed by the browser UI. An operator can bind the
container to a dedicated host, register commands into one guild, restrict operation to one
channel, and verify the resulting runtime through the health endpoints.
