# Threadlight Reference Notebook

`threadlight_demo.ipynb` is the portable demonstration companion for the Threadlight service. It
uses only Python's standard library and calls the same `/api/demo/respond` endpoint used by the
web experience.

The notebook defaults to the hosted public runtime so it can be published to Kaggle without a
credential or operator access code. Override `THREADLIGHT_URL` for a local or self-hosted
installation. The public route accepts only curated scenario IDs; it cannot submit arbitrary
conversation text to the configured provider.

The notebook contains no credentials. AI, Scripture, and Discord secrets remain in the
server-side environment.
