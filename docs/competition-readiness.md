# Competition Readiness

The official [evaluation criteria](https://www.kaggle.com/competitions/scripture-in-new-frontiers/overview/evaluation)
require both the YouVersion Platform API and Gloo AI Studio API. The competition scores Impact and
Vision at 40 points, Video Pitch and Storytelling at 30 points, and Technical Depth and Execution at
30 points.

**Current submission status: provider-ready; submission artifacts remain open.** Threadlight is a
working public product using both required provider APIs. The public Kaggle notebook, video, media
gallery, and final form still need to be published or completed.

Gloo and YouVersion runtime adapters are implemented and active in Railway production. On
2026-07-30, an authenticated provider preview returned Psalm 55:22 through `gloo + youversion`,
and the no-login public scenario returned Psalm 34:18 with BSB text and explicit YouVersion
attribution. The live evidence is recorded in the
[YouVersion provider canary](qa/2026-07-30-youversion-live-canary.md).

The public judging path is live at the
[Railway-hosted Threadlight app](https://threadlight-production.up.railway.app/?demo=public) with no
login or access code. It shows the real Discord and YouTube deployment health and a sanitized,
bounded activity feed. The curated public provider scenario now uses Gloo plus YouVersion.
Protected configuration and publishing routes remain unavailable to anonymous visitors.

The credential-free reference notebook lives at `notebook/threadlight_demo.ipynb`. It calls the
same public curated-scenario API used by the web experience and exposes the judged decision,
passage attribution, provider trace, and safety stages without embedding secrets. It must still be
published as a **public Kaggle notebook** and attached to the Kaggle writeup; committing it to
GitHub alone does not create that Kaggle resource.

Run:

```bash
pnpm --filter @threadlight/server readiness
```

The command exits successfully only when both competition provider configurations are complete.
Credential values are never printed.

Submission readiness also requires:

- Real, visible use of both Gloo AI Studio and the YouVersion Platform API.
- A public working product or interactive demo with no login or paywall.
- A public code repository with reproducible setup instructions.
- A public Kaggle notebook.
- A public YouTube demonstration of three minutes or less.
- A cover image, media gallery, and final writeup of no more than 500 words.

Use the [competition submission handoff](competition-submission.md) as the final owner checklist,
demo script, and artifact manifest.

See the [2026-07-29 rules and demo audit](qa/2026-07-29-hackathon-rules-and-demo-audit.md)
for the original requirement matrix and rubric comparison. Its YouVersion red status is superseded
by the [2026-07-30 live canary](qa/2026-07-30-youversion-live-canary.md).
