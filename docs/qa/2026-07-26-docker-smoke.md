# Docker Smoke QA - 2026-07-26

## Scope

Verify the exact current source can build and run as the documented self-hosted Docker service.

## Result

`docker version` succeeded and reported Docker Engine `28.1.1`. The exact-source command below
started normally, reached the workspace production-build step, then made no observable progress
for more than 85 seconds. The build process consumed no CPU during the bounded wait and was
terminated by the operator. The Docker daemon remained responsive afterward.

```bash
docker compose build
```

This is a host/Docker build-lifecycle blocker, not proof that the image or container succeeds.
No Threadlight container was started, no credentials were mounted, and no image/runtime claim is
made from this attempt.

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
