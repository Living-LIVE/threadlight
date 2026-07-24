# Threadlight

**Scripture in the conversation, not beside it.**

Threadlight is a Scripture-native presence for shared digital spaces. It listens to the recent
conversation, exercises restraint about when to speak, retrieves an attributed passage, and
responds in the room where the conversation is already happening.

Threadlight ships as one self-contained service. The same process serves the operator/demo web
experience, API, provider orchestration, and Discord gateway. It is stateless by design: recent
conversation context is processed in memory and is not retained after a response.

## Repository Layout

```text
apps/
  server/       Discord gateway and public demo API
  web/          Public no-login conversation experience
packages/
  core/         Provider-neutral domain contracts and orchestration
  providers/    AI and Scripture provider adapters
notebook/       Public, credential-free reference demonstration
```

## Local Development

1. Copy `.env.example` to `.env.local` and provide the credentials for the providers you intend
   to run.
2. Install dependencies with `pnpm install`.
3. Start the server and web app with `pnpm dev`.
4. Open `http://localhost:5173`.

The API server runs at `http://localhost:8787` by default.

## Run as a Container

1. Copy `.env.example` to `.env.local`.
2. Fill in the active AI, Scripture, and Discord settings.
3. Build and start Threadlight:

```bash
docker compose up --build -d
```

Open `http://localhost:8787`. The container exposes:

- `GET /api/health` for process liveness.
- `GET /api/readiness` for Discord and provider readiness.
- The complete web experience at `/`.

Stop the service with `docker compose down`. Threadlight does not require a database or external
queue for its Discord-first deployment.

## Discord Setup

Create a Discord application and bot, enable the **Message Content Intent**, and install it into
the target server with the `bot` and `applications.commands` scopes. The channel permissions
required are:

- View Channels
- Send Messages
- Embed Links
- Read Message History
- Use Application Commands

Set `DISCORD_APPLICATION_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, and
`DISCORD_CHANNEL_ID` in `.env.local`. Generate the guild-locked, least-privilege install URL:

```bash
pnpm --filter @threadlight/server invite:discord
```

After an administrator authorizes that URL, register the guild commands once:

```bash
docker compose run --rm threadlight node apps/server/dist/register-commands.js
```

Threadlight responds to `/threadlight`, `/pray`, the **Ask Threadlight** message action, and
explicit bot mentions in the configured channel. It ignores direct messages, other servers,
other channels, and messages from bots.

For startup-time command registration, set `DISCORD_REGISTER_COMMANDS=true`; leave it false after
the first successful registration.

## Validation

```bash
pnpm check
```

The command runs formatting and lint checks, TypeScript validation, unit tests, and production
builds.

Container validation:

```bash
docker compose build
docker compose up -d
curl --fail http://localhost:8787/api/health
curl --fail http://localhost:8787/api/readiness
```

## Provider Portability

AI and Scripture integrations implement provider-neutral contracts in `packages/core`. The
active development adapters are configured with `AI_PROVIDER=openai` and
`SCRIPTURE_PROVIDER=ao`. Competition credentials are tracked separately by
`pnpm --filter @threadlight/server readiness`; provider readiness must not be inferred from a
successful development build.

## Privacy and Safety

- Message text is never written to application logs.
- Context is fetched only after an explicit command, message action, or mention.
- Conversation context is processed in memory and not persisted.
- Urgent language triggers a deterministic care response before AI composition.
- Threadlight does not claim to be a pastor, counselor, or emergency service.
- Provider credentials remain server-side and `.env.local` is excluded from Git and Docker
  build context.

## License

Apache-2.0. See `LICENSE`.
