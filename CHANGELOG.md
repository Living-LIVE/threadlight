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

### Changed

- Repository documentation now distinguishes executable features from planned integrations.
- YouTube comment scans are serialized within a runtime process so overlapping polls cannot create
  duplicate review drafts for the same comment.
