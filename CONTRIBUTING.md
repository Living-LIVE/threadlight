# Contributing To Threadlight

Thanks for improving Threadlight. Small, well-scoped contributions are easiest to review and
keep the project safe for community operators.

## Before You Start

1. Search existing issues and pull requests.
2. Open an issue for a significant change before investing in an implementation.
3. Read the [current state](docs/current-state.md), [architecture](docs/architecture.md), and
   [safety model](docs/safety.md).

## Local Setup

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

The dashboard can be used without credentials. Never commit `.env.local`, `.threadlight/`, Docker
volumes, raw Discord content, or provider tokens.

## Development Expectations

- Keep channel, AI, and Scripture integrations behind the contracts in `packages/core`.
- Keep Discord-specific behavior in `apps/server/src/discord`.
- Do not log raw conversation content.
- Preserve Scripture reference, translation, and attribution.
- Do not present Threadlight as emergency, pastoral, counseling, or moderation authority.
- Mark unimplemented integrations as planned rather than available.

## Tests

Run the relevant test files while working, then run the full local quality gate before requesting
review:

```bash
pnpm check
```

For dashboard changes, verify the local flow at desktop and mobile widths. For Discord changes,
add deterministic coverage for the changed participation or lifecycle behavior; do not depend on
a live community server for the only regression proof.

## Pull Requests

- Use a clear, imperative title.
- Explain the user-visible behavior and any safety implications.
- Include tests for behavior changes and state what you ran.
- Update README or `docs/` when setup, architecture, limitations, or operations change.
- Keep unrelated formatting and refactors out of the pull request.

By contributing, you agree that your contribution is licensed under the repository's
[Apache-2.0 license](LICENSE).
