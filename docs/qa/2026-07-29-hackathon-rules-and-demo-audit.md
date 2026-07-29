# Hackathon Rules and Deployed Demo Audit

Audited 2026-07-29 against the public Railway demo and the official Kaggle competition pages.

## Official Submission Contract

Sources:

- [Evaluation and submission requirements](https://www.kaggle.com/competitions/scripture-in-new-frontiers/overview/evaluation)
- [Official rules](https://www.kaggle.com/competitions/scripture-in-new-frontiers/rules)

A valid entry must use **both** the YouVersion Platform API and Gloo AI Studio API. It must include:

- A Kaggle writeup of no more than 500 words.
- A cover image and media gallery.
- An attached public Kaggle notebook.
- An attached public YouTube video of no more than three minutes.
- An attached public project link that works without login or paywall, or a public repository with
  detailed setup instructions when a hosted demo is not feasible.

Judging is weighted:

- Impact and Vision: 40 points.
- Video Pitch and Storytelling: 30 points.
- Technical Depth and Execution: 30 points.

The video is the primary judging lens. The code and writeup must prove that the demonstrated
technology is real and working. Draft or unsubmitted writeups are not judged.

## Current Requirement Matrix

| Requirement | Status | Current evidence or exact gap |
| --- | --- | --- |
| Public product without login/paywall | Green | Railway public workspace opens without authentication and exposes read-only live status. |
| Public source and reproducible setup | Green | Public GitHub repository, Docker path, and setup documentation exist. |
| Gloo AI Studio API | Green | Hosted response and Discord canaries expose Gloo in the provider trace. |
| YouVersion Platform API | Red | Adapter exists, but the supplied key still fails its live passage canary. AO Lab is the verified live fallback and does not satisfy the competition's required YouVersion use. |
| Real Discord behavior | Green | Hosted listener and response evidence are visible in monitoring. |
| Real YouTube behavior | Green | Owner-selected video, observed comment, generated draft, and approved reply are visible. |
| Public Discord entry point | Amber | A direct thread link exists, but no public server invite is configured. |
| Public Kaggle notebook | Red | Notebook source exists in GitHub; a public Kaggle notebook URL is still missing. |
| Public demo video, three minutes or less | Red | Script exists; the video has not been recorded and attached. |
| Cover image and media gallery | Red | Candidate captures exist; final competition uploads and URLs are missing. |
| Final writeup and project page | Red | Draft copy exists; final Kaggle submission has not been completed. |

Threadlight is a credible working prototype, but it is **not submission-ready** until every red
competition requirement above is closed. In particular, AO Lab cannot be represented as satisfying
the mandatory YouVersion API requirement.

## Current-Run Product Audit

The screenshots below were captured from the deployed public judge path during this audit.

| Step | Journey | Health | Finding |
| --- | --- | --- | --- |
| 1 | First viewport and live connectors | Needs improvement | The dashboard is clean and immediately usable, but the deployed opening copy does not clearly establish the person-centered problem or hackathon proof. The public Discord invite is visibly missing. |
| 2 | Live activity evidence | Strong | Discord and YouTube events show inputs, outputs, references, provider traces, and timing. This is the strongest technical-execution proof. |
| 3 | Provider response | Needs improvement | The result proves a hosted provider pair, but the free-form-looking field returns a curated named scenario. The interaction needs explicit scenario language. |
| 4 | Destination setup | Strong | Discord and YouTube are available now, while future connectors are honestly labeled. The three-step wizard stays focused. |
| 5 | YouTube scope and review | Mostly strong | Channel, selected-video boundary, review mode, poll interval, and reply limit are understandable. Long video titles are truncated in the deployed build. |
| 6 | Provider and launch review | Needs improvement | The deployed build lacks the provider preflight and final readiness summary already present in local source. Scripture-provider proof is not visible enough at launch. |

### Evidence

1. [Public monitoring](assets/2026-07-29-hackathon-demo-audit/01-public-monitoring.png)
2. [Live activity proof](assets/2026-07-29-hackathon-demo-audit/02-live-activity-proof.png)
3. [Provider test result](assets/2026-07-29-hackathon-demo-audit/03-provider-test-result.png)
4. [Destination setup](assets/2026-07-29-hackathon-demo-audit/04-destination-setup.png)
5. [YouTube scope and review](assets/2026-07-29-hackathon-demo-audit/05-youtube-scope-and-review.png)
6. [Provider and launch review](assets/2026-07-29-hackathon-demo-audit/06-provider-and-launch-review.png)
7. [Improved local judge first viewport](assets/2026-07-29-hackathon-demo-audit/07-local-judge-first-viewport.png)
8. [Improved local live-scenario result](assets/2026-07-29-hackathon-demo-audit/08-local-live-scenario-result.png)
9. [Improved local YouTube title layout](assets/2026-07-29-hackathon-demo-audit/09-local-youtube-full-titles.png)

## Rubric Comparison

### Impact and Vision: Amber

The behavior loop is differentiated: Threadlight meets people inside existing Discord and YouTube
conversations rather than asking them to adopt another devotional destination. The live dashboard
needs a clearer first-viewport statement of who benefits, why the moment matters, and how human
review protects trust.

### Video Pitch and Storytelling: Red

The product has a strong story path, but the required public video does not exist yet. The final
video should lead with one person and one moment, then show the real Discord response and YouTube
review flow before explaining architecture.

### Technical Depth and Execution: Amber

The connectors, monitoring, safety states, provider traces, self-hosted packaging, and public source
are substantive. The missing YouVersion canary is both a technical gap and a submission-validity
blocker. The public notebook must also be published, not merely committed to GitHub.

## Local Fixes From This Audit

- Reframed the public first viewport around the product promise and visible judge proof.
- Added a source link and compact Gloo/connector proof without exposing credentials.
- Replaced misleading free-form public preview behavior with explicit curated scenarios.
- Routed public scenario checks through the real credential-free hosted demo endpoint.
- Allowed full YouTube video titles to wrap.
- Preserved provider preflight and final deployment review in the current local build.

The three final screenshots above are local-source proof only. They are not evidence that the
Railway-hosted demo has been updated.

## Remaining Owner-Gated Actions

1. Obtain a working YouVersion Platform App Key and complete a live attributed-passage canary.
2. Create a non-expiring public Discord invite and configure it for the hosted demo.
3. Publish `notebook/threadlight_demo.ipynb` as a public Kaggle notebook.
4. Record and upload the public video at three minutes or less.
5. Upload the cover image and gallery, complete the 500-word writeup, and attach all links.

## Audit Limits

This audit covers visible desktop and mobile flows, current public API behavior, local source, and
the official competition pages. It does not prove screen-reader behavior, every keyboard path,
provider uptime beyond the bounded canaries, YouVersion success, or final Kaggle attachment state.
