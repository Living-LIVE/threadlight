# Competition Readiness

The official [evaluation criteria](https://www.kaggle.com/competitions/scripture-in-new-frontiers/overview/evaluation)
require both the YouVersion Platform API and Gloo AI Studio API. The competition scores Impact and
Vision at 40 points, Video Pitch and Storytelling at 30 points, and Technical Depth and Execution at
30 points.

**Current submission status: blocked.** Threadlight is a working public product, but it cannot be
represented as a valid final entry until the YouVersion canary and required public Kaggle artifacts
are complete.

Gloo and YouVersion runtime adapters are implemented. Gloo has completed a bounded live
credential/completion canary. The supplied YouVersion App Key was retried after its owner made it
live, but the hosted preview still failed; the live configuration was restored to AO Lab, whose
attributed-passage canary is verified. A working YouVersion key and visible attributed-passage
canary remain a follow-up before claiming a live YouVersion integration in the submission.

The public judging path is live at the
[Railway-hosted Threadlight app](https://threadlight-production.up.railway.app/?demo=public) with no
login or access code. It shows the real Discord and YouTube deployment health and a sanitized,
bounded activity feed. A hosted Discord mention-and-response canary used Gloo plus AO Lab and
appears in that feed. Protected configuration and publishing routes remain unavailable to
anonymous visitors.

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
for the requirement matrix, deployed screenshots, rubric comparison, and exact remaining gates.
