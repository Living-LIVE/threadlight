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

### Changed

- Repository documentation now distinguishes executable features from planned integrations.
- YouTube comment scans are serialized within a runtime process so overlapping polls cannot create
  duplicate review drafts for the same comment.
