# Security Policy

## Supported Scope

Security reports are welcome for the current default branch and the Docker Compose distribution.
Particularly useful reports involve local credential handling, control-surface exposure, Discord
permissions, dependency vulnerabilities, or unintended conversation-data retention.

## Reporting A Vulnerability

Use GitHub private vulnerability reporting when it is enabled for the repository. Otherwise,
contact a repository maintainer privately through GitHub. Do not open a public issue containing a
proof of concept, credentials, Discord identifiers, private message content, or other sensitive
details.

Include a concise description, affected version or commit, reproduction steps, impact, and a safe
redacted example. Allow maintainers time to investigate before public disclosure.

## Operator Guidance

- Keep the control surface bound to loopback unless an authenticated reverse proxy protects it.
- Do not share `.env.local`, Docker volumes, or `.threadlight/` data.
- Use least-privilege Discord permissions and restrict the bot to intended channels.
- Rotate any credential that is accidentally exposed.
