# Changelog

All notable user-visible changes are documented here. This project follows the spirit of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- Self-hosted local configuration dashboard for a Discord-first Threadlight deployment.
- Local configuration persistence, provider settings, and Docker configuration volume support.
- Discord participation modes and provider-neutral adapter boundaries.
- YouTube Comments destination with Google OAuth setup, owned-channel discovery, polling,
  review drafts, selective replies, and explicit threaded-reply approval.
- A no-login public preview with curated, server-owned conversation scenarios. Operator
  configuration, OAuth, review drafts, and posting controls remain access-code protected.
- A monitored dashboard workspace with connector health, public-safe activity, error filters,
  completed YouTube review history, and direct Discord and YouTube test links.
- Credential-free Playwright coverage for setup, deployment, monitoring, and mobile dashboard
  journeys.
- A production deployment runbook that separates pushed, deployed, healthy, and feature-verified
  evidence and documents safe rollback boundaries.

### Changed

- Repository documentation now distinguishes executable features from planned integrations.
- YouTube comment scans are serialized within a runtime process so overlapping polls cannot create
  duplicate review drafts for the same comment.
- Provider changes now select a compatible default model, and the control API rejects Gloo's
  `auto` routing value when OpenAI is selected.
- The public judge path now explains the live proof up front, runs explicit curated scenarios
  through the hosted demo endpoint, and keeps full YouTube video titles readable.
- Competition documentation now maps the official rubric and required attachments to verified,
  blocked, and owner-gated Threadlight evidence.
- The repository entrypoints now link directly to the complete no-login Railway demo and identify
  the exact verified production source and deployment revisions.
