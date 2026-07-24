# Competition Readiness

Threadlight can be developed with local provider adapters, but the competition submission must
demonstrate the required providers doing real, visible work.

The credential-free reference notebook lives at `notebook/threadlight_demo.ipynb`. It calls the
same public API used by the web experience and exposes the judged decision, passage attribution,
provider trace, and safety stages without embedding secrets.

Run:

```bash
pnpm --filter @threadlight/server readiness
```

The command exits successfully only when both competition provider configurations are complete.
Credential values are never printed.

Submission readiness also requires:

- A public working product or interactive demo with no login or paywall.
- A public code repository with reproducible setup instructions.
- A public Kaggle notebook.
- A public YouTube demonstration of three minutes or less.
- A cover image, media gallery, and final writeup of no more than 500 words.
