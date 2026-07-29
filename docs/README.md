# Threadlight Documentation

This directory is the technical and operational source of truth for Threadlight. The root
[README](../README.md) is the fork-and-run entrypoint.

## Start Here

| Document | Use it for |
| --- | --- |
| [Current state](current-state.md) | What is implemented, planned, and blocked today. |
| [Architecture](architecture.md) | System boundaries, runtime shape, and data handling. |
| [Core user journeys](user-journeys.md) | Setup, deployment, monitoring, and public-demo behavior. |
| [Safety model](safety.md) | Product guardrails, urgent-language behavior, and Scripture integrity. |
| [Participation modes](participation-modes.md) | Discord behavior, timing, and operator disclosure needs. |
| [YouTube Comments](youtube-comments.md) | Implemented connector behavior, OAuth setup, safety controls, and test gates. |
| [Competition readiness](competition-readiness.md) | Hackathon submission requirements and provider readiness. |
| [Competition submission handoff](competition-submission.md) | Final links, copy, demo script, evidence, and owner checklist. |
| [Competition gallery assets](competition-assets.md) | Clean desktop and mobile dashboard captures for the submission gallery. |
| [Hackathon rules and demo audit](qa/2026-07-29-hackathon-rules-and-demo-audit.md) | Official criteria, deployed screenshots, rubric comparison, local fixes, and remaining submission gates. |
| [Current local full-suite run](qa/2026-07-29-full-suite-local.md) | Canonical checks, browser journeys, credentialed canaries, host-safety pause, and exact resume steps. |
| [Current Docker smoke QA](qa/2026-07-26-docker-smoke.md) | Exact-source self-hosted image/runtime verification status. |
| [Local Discord recovery finish line](qa/2026-07-29-local-discord-recovery-finish-line.md) | Local Discord runtime recovery, browser proof, and regression coverage. |
| [QA ledger](qa/2026-07-25-local-control-surface-build.md) | Historical local control-surface build evidence. |
| [YouTube Comments QA](qa/2026-07-26-youtube-comments-connector.md) | Local and Railway proof for the YouTube connector. |

## Maintainer Rules

- Keep implemented, planned, and blocked states distinct.
- Do not write provider secrets or raw conversation content into documentation, logs, examples, or
  issue attachments.
- Update the relevant document when a connector, provider adapter, deployment method, or safety
  policy changes.
- Keep local, hosted, and production proof separate in QA records.
