# Competition Submission Handoff

## Threadlight

**One-line pitch:** Threadlight brings restrained, Scripture-grounded presence into the digital conversations people already have, starting with Discord and YouTube Comments.

**Challenge fit:** Social & Emerging Interfaces, with a Creator & Content Tools secondary fit.
Threadlight is built around the challenge's YouVersion Platform and Gloo AI Studio building
blocks inside existing conversation habits rather than introducing another destination to manage.

## What Eric Submits

| Submission surface | Prepared artifact | Owner action |
| --- | --- | --- |
| Source code | [GitHub repository](https://github.com/Living-LIVE/threadlight) | Submit this repository URL. |
| Hosted dashboard | [Threadlight dashboard](https://threadlight.vercel.app) | Use for a live configuration walkthrough. |
| Kaggle notebook | [Notebook instructions](../notebook/README.md) and `notebook/threadlight_demo.ipynb` | Publish the notebook and add its URL below. |
| Demo video | Demo script below | Record/upload and add its public URL below. |
| Cover image and media gallery | [Prepared gallery assets](competition-assets.md), plus a controlled Discord/YouTube walkthrough | Upload to the competition form. |
| Written description | Copy below | Paste and adapt to the form's field limits. |

## Final Submission Links

- Kaggle notebook: `TBD`
- Demo video: `TBD`
- Media gallery: `TBD`
- Submission form or project page: `TBD`

## Product Description

Threadlight is a self-hosted, Scripture-native companion for shared digital conversations. It listens for moments where a brief, thoughtful response may help, traces discernment and Scripture source, and respects a community's participation settings.

For Discord, Threadlight can be Prompted, Attentive, or Active. For YouTube, a channel owner signs in with Google, chooses exactly which videos Threadlight should watch, and receives reply drafts by default before anything is posted publicly. Sensitive or urgent comments are never queued or published automatically.

The project uses Gloo for values-aligned AI routing and YouVersion or AO Lab for attributed Scripture retrieval. It is packaged as an open-source, self-hosted Docker application with a lightweight local control dashboard.

## Demo Script

Target length: 2 minutes 30 seconds to 3 minutes.

1. Open with the problem: care, reflection, and Scripture are often disconnected from the moment people need them.
2. Show the Threadlight dashboard, run a test response through the saved Gloo and Scripture pair, and point out the attributed passage and provider trace.
3. Choose Discord and explain Prompted, Attentive, and Active presence, then show a sourced interaction.
4. Show YouTube setup: connect the owner Google account and choose a small allowlist of videos.
5. Show the review queue: a controlled comment produces a draft, with caps and safety suppression before any public post.
6. Close with the build story: an open-source reference implementation that works inside existing community habits.

## Pre-Submission Checklist

- [x] Google OAuth callback saved and a channel-owner account connection completed.
- [x] Controlled YouTube test video selected and manual scan verified.
- [x] One owner-approved reply canary completed on the test video.
- [x] Gloo provider configured and demonstrated in the dashboard/runtime.
- [ ] Valid YouVersion App Key installed and one attributed Scripture retrieval verified.
- [ ] Kaggle notebook published and its URL recorded above.
- [ ] Demo video, cover image, and gallery uploaded.
- [ ] Final form reviewed for links, team attribution, and required disclosures.

## Evidence To Preserve

- [Local full-suite ledger](qa/2026-07-26-full-suite-local.md)
- [YouTube connector QA](qa/2026-07-26-youtube-comments-connector.md)
- [Competition readiness notes](competition-readiness.md)
- [Competition gallery asset manifest](competition-assets.md)
- [Notebook run instructions](../notebook/README.md)
- [Notebook execution evidence](qa/2026-07-26-competition-finish.md)
