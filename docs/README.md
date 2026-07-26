# Threadlight Documentation

This directory is the technical and operational source of truth for Threadlight. The root
[README](../README.md) is the fork-and-run entrypoint.

## Start Here

| Document | Use it for |
| --- | --- |
| [Current state](current-state.md) | What is implemented, planned, and blocked today. |
| [Architecture](architecture.md) | System boundaries, runtime shape, and data handling. |
| [Safety model](safety.md) | Product guardrails, urgent-language behavior, and Scripture integrity. |
| [Participation modes](participation-modes.md) | Discord behavior, timing, and operator disclosure needs. |
| [YouTube Comments](youtube-comments.md) | Implemented connector behavior, OAuth setup, safety controls, and test gates. |
| [Competition readiness](competition-readiness.md) | Hackathon submission requirements and provider readiness. |
| [Competition submission handoff](competition-submission.md) | Final links, copy, demo script, evidence, and owner checklist. |
| [QA ledger](qa/2026-07-25-local-control-surface-build.md) | Local control-surface verification evidence and remaining Docker blocker. |
| [YouTube Comments QA](qa/2026-07-26-youtube-comments-connector.md) | Local and Railway proof for the YouTube connector. |

## Maintainer Rules

- Keep implemented, planned, and blocked states distinct.
- Do not write provider secrets or raw conversation content into documentation, logs, examples, or
  issue attachments.
- Update the relevant document when a connector, provider adapter, deployment method, or safety
  policy changes.
- Keep local, hosted, and production proof separate in QA records.
