# Threadlight

**Scripture in the conversation, not beside it.**

Threadlight is a self-hosted, Scripture-native presence for shared digital conversations. It
listens with restraint, retrieves attributed Scripture, and responds in the place where people are
already talking.

It is built to be forked: one Node.js service serves the local operator dashboard, control API,
provider orchestration, and Discord gateway. Discord and demo conversation context is processed
in memory and is not retained after a response. YouTube review drafts retain bounded comment and
reply excerpts locally until the operator resolves them.

> [!WARNING]
> Threadlight is not a pastor, counselor, moderator, or emergency service. See the
> [safety model](docs/safety.md) before enabling it in a community.

## What Works Today

| Surface | Status | Notes |
| --- | --- | --- |
| Discord | Available | One configured Discord destination per Threadlight installation. |
| OpenAI, Gloo, AO Lab | Available | Configured locally through Threadlight; the hosted Gloo plus AO Lab preview has completed a live canary. |
| YouVersion | Adapter implemented | Configured locally through Threadlight; live use requires an active App Key and operator authorization for AI-generated output. |
| Local setup dashboard | Available | Credentials are stored locally and returned only as configured/not-configured state. |
| Provider preview | Available | Runs a bounded test response through the saved provider pair without sending to a destination. |
| Gemini, Bonfire | Configuration-ready | Settings can be saved locally; runtime adapters are not yet included. |
| YouTube Comments | Available after OAuth setup | Polls eligible comments, prepares review drafts, and supports explicit threaded replies. |
| Slack | Planned | Visible in the dashboard, not yet selectable. |
| Microsoft Teams, Twitch | Coming soon | Catalog-only placeholders. |

## Quick Start

### Docker

```bash
docker compose up --build -d
```

Open [http://localhost:8787](http://localhost:8787), then complete the three-step setup:

1. Choose Discord.
2. Enter the Discord application and bot credentials once, then choose the server and text channel
   from the bot-visible selectors. Saved credentials are never shown in the browser again.
3. Choose a participation mode and configure the executable provider.
4. From the dashboard, run a test response to verify the saved provider pair before enabling a destination.

Compose binds the dashboard to `127.0.0.1` and persists its configuration in the Docker-managed
`threadlight-config` volume. Put an operator-authenticated reverse proxy in front of Threadlight
before exposing it on a network.

### Hosted Runtime

Threadlight's executable runtime is the single Docker service because Discord and YouTube Comments
need a long-lived gateway and poller. The current hosted checkpoint is Railway. Vercel is not a
drop-in replacement for that process: a Vercel-hosted dashboard would need a separately configured
API origin pointing at the persistent Threadlight service, and it would not host the gateway or
poller itself.

The included `vercel.json` builds `apps/web` as that optional dashboard. Set
`VITE_THREADLIGHT_API_ORIGIN` to the HTTPS Railway or self-hosted service URL before deploying it,
then set the runtime's `WEB_ORIGIN` to the Vercel deployment URL so browser requests and OAuth
returns use the same operator surface. A remote runtime also requires a 32-byte-or-longer
`THREADLIGHT_CONTROL_TOKEN`; generate it with `openssl rand -hex 32`, configure it only in the
runtime environment, and enter it in the dashboard when prompted. The access code stays only in
the browser's current memory and is never bundled into the Vercel build.

When a visitor opens a protected remote dashboard without that code, Threadlight presents the full
dashboard as a public live workspace. The top of the page shows sanitized health and bounded recent
activity from the real Discord and YouTube deployments, with links to the operator-selected demo
thread and videos. Visitors cannot publish through the dashboard or call operator actions; they
interact by joining Discord or commenting on an allowlisted YouTube video. The setup flow below
remains browser-isolated and never changes the hosted deployment.

Enable this surface with `THREADLIGHT_DEMO_ENABLED=true`. Persist connector activity with
`THREADLIGHT_ACTIVITY_PATH`; Docker defaults to `/data/threadlight-activity.json`. An optional
`THREADLIGHT_DISCORD_INVITE_URL` adds a Join Discord action. Set
`THREADLIGHT_DISCORD_WIDGET_ENABLED=true` only after enabling the Discord server widget. The public
API omits credentials, application IDs, OAuth data, raw message IDs, and destination IDs.

Provider preview remains deliberately bounded. When the public demo is enabled, it runs
server-owned curated scenarios through the saved AI and Scripture provider pair and is
rate-limited.

### Local Development

Requirements: Node.js 22+ and pnpm 10.32.1. Corepack is included with Node.js.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` requests to the local
API at `http://127.0.0.1:8787`.

Verify a configured local Discord runtime without sending a Discord message:

```bash
pnpm verify:local
pnpm verify:local -- --preview
```

The preview variant calls the saved AI and Scripture providers but does not post to a destination.
If a local dashboard unexpectedly shows a stale destination or provider, stop existing local
Threadlight processes and restart `pnpm dev` without inherited `THREADLIGHT_CONFIG_PATH` or
`DISCORD_ENABLED` environment variables. Those variables deliberately override `.env.local` and
the default local configuration volume.

The dashboard starts without credentials. Copy `.env.example` to `.env.local` only when you want
to bootstrap existing local values:

```bash
cp .env.example .env.local
```

Never commit `.env.local`, Docker volumes, `.threadlight/` configuration files, browser-capture
artifacts, or operator access codes.

### YouTube Comments

Configure `YOUTUBE_OAUTH_CLIENT_ID` and `YOUTUBE_OAUTH_CLIENT_SECRET` once in the server or
Docker environment. They identify the Threadlight installation's Google OAuth application and
are never entered in, or returned to, the dashboard.

After that one-time installation setup, a channel owner selects **YouTube Comments**, signs in
with the Google account that owns their channels, chooses the intended YouTube channel, and then
selects up to ten videos for Threadlight to watch. The connector polls only those selected videos.
Comments become review drafts by default.

## Discord Prerequisites

Create a Discord application and bot, enable **Message Content Intent**, and install it in the
target server with the `bot` and `applications.commands` scopes. Grant the bot:

- View Channels
- Send Messages
- Send Messages in Threads
- Embed Links
- Read Message History
- Use Application Commands

Threadlight responds to `/threadlight`, `/pray`, the **Ask Threadlight** message action, and
explicit bot mentions. It ignores direct messages, unrelated channels, and bot messages.

Generate a guild-locked install URL for an environment-based bootstrap with:

```bash
pnpm --filter @threadlight/server invite:discord
```

See [Discord participation modes](docs/participation-modes.md) for the behavior contract and
channel disclosure requirements.

## Participation Modes

- **Prompted**: speaks only when directly invited. This is the default.
- **Attentive**: evaluates a conversation after a quiet window and replies when appropriate.
- **Active**: responds to each eligible human text message. Use only in a dedicated channel or
  thread.

Attentive and Active send recent conversation context to the configured AI provider. Community
operators should give participants a visible notice before enabling either mode.

## Project Map

```text
apps/server/        Local control API, Discord gateway, and process lifecycle
apps/web/           Local operator dashboard
packages/core/      Provider-neutral domain contracts and orchestration
packages/providers/ Provider adapters and fixture providers
docs/               Product, architecture, safety, and operating documentation
notebook/           Credential-free competition reference demonstration
```

## Documentation

Start with the [documentation index](docs/README.md).

- [Current state and roadmap](docs/current-state.md)
- [Architecture](docs/architecture.md)
- [Safety model](docs/safety.md)
- [Discord participation modes](docs/participation-modes.md)
- [Competition readiness](docs/competition-readiness.md)
- [Competition submission handoff](docs/competition-submission.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Validation

Install Playwright's pinned Chromium build once after installing dependencies:

```bash
pnpm exec playwright install chromium
```

Run the deterministic quality gate:

```bash
pnpm check
```

This runs formatting and lint checks, TypeScript validation, unit tests, and production builds.

Run the browser journeys for setup, deployment, and monitoring:

```bash
pnpm test:e2e
```

Run both gates before release:

```bash
pnpm test:full
```

For the container surface:

```bash
docker compose build
docker compose up -d
curl --fail http://localhost:8787/api/health
curl --fail http://localhost:8787/api/control/status
```

## Contributing And License

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), follow the
[Code of Conduct](CODE_OF_CONDUCT.md), and use the GitHub issue templates to propose changes.

Threadlight is licensed under [Apache-2.0](LICENSE).
