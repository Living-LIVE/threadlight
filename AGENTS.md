# Threadlight Repository Guidance

## Product

Threadlight is a Scripture-native presence for shared digital conversations. The first
production-shaped surface is Discord, and the public web experience exercises the same core
orchestration path.

## Architecture

- Keep channel, AI, and Scripture providers behind interfaces in `packages/core`.
- Do not leak provider SDK types into core or UI contracts.
- Keep Discord-specific behavior in `apps/server/src/discord`.
- Keep public web behavior in `apps/web`.
- Prefer structured provider outputs validated with Zod.

## Safety

- Never commit `.env.local`, credentials, raw conversation exports, or provider tokens.
- Never log message content at info level.
- Do not present Threadlight as a pastor, counselor, or emergency service.
- Preserve Scripture attribution and source metadata.

## Validation

Run `pnpm check` before declaring local completion. For user-facing changes, also verify the
web experience in a real browser at desktop and mobile widths.
