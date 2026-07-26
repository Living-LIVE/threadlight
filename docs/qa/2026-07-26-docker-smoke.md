# Docker Smoke QA - 2026-07-26

## Scope

Verify the exact current source can build and run as the documented self-hosted Docker service.

## Result

`docker version` succeeded and reported Docker Engine `28.1.1`. Both exact-source build paths
below started normally, reached the workspace production-build step, then made no observable
progress. Each build process consumed no CPU during its bounded wait and was terminated by the
operator. The Docker daemon remained responsive afterward.

```bash
docker compose build
docker build --progress=plain -t threadlight:smoke .
```

Both commands stalled at the Dockerfile's `RUN pnpm build` layer after printing the workspace
build invocation. This rules out the Compose plugin as the immediate cause, but it does not prove
the image or container succeeds. No Threadlight container was started, no credentials were
mounted, and no image/runtime claim is made from these attempts.

## Remaining Verification

Once Docker's Compose build completes, run the documented clean smoke without mounting existing
operator configuration:

```bash
docker compose build
docker run --rm -d --name threadlight-smoke -p 127.0.0.1:18798:8787 threadlight:local
curl --fail http://127.0.0.1:18798/api/health
curl --fail http://127.0.0.1:18798/api/control/status
docker rm -f threadlight-smoke
```

The expected result is a healthy unconfigured control API. Provider, Discord, Google OAuth, and
operator configuration should not be included in this smoke.
