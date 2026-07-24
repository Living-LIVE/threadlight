# Threadlight Reference Notebook

`threadlight_demo.ipynb` is the portable demonstration companion for the Threadlight service. It
uses only Python's standard library and calls the same `/api/demo/respond` endpoint used by the
web experience.

Start Threadlight locally or in Docker, then run the notebook from Jupyter. Override
`THREADLIGHT_URL` when the service is not available at `http://localhost:8787`.

The notebook contains no credentials. AI, Scripture, and Discord secrets remain in the
server-side environment.
