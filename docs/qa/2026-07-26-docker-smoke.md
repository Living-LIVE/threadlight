# Docker Smoke QA - 2026-07-26

## Scope

Verify the exact current source can build and run as the documented self-hosted Docker service.

## Result

**Passed.** Docker Engine `28.1.1` built the exact current source as `threadlight:smoke` and a
fresh container served both its health and sanitized control-status APIs.

The original recursive `RUN pnpm build` Docker layer appeared stalled because its aggregate
workspace output was buffered during a slow declaration build. The Dockerfile now runs the same
four workspace builds explicitly and in dependency order. The resulting image build completed in
about 35 seconds.

```bash
docker build --progress=plain -t threadlight:smoke .
docker run --rm -d --name threadlight-smoke -p 127.0.0.1:8788:8787 \
  -v threadlight-smoke-data:/data threadlight:smoke
curl --fail http://127.0.0.1:8788/api/health
curl --fail http://127.0.0.1:8788/api/control/status
docker rm -f threadlight-smoke
```

Observed API state from the fresh named volume:

- `GET /api/health` returned `200` with `{"ok":true,"service":"threadlight"}`.
- `GET /api/control/status` returned `200` with the available Discord and YouTube Comments
  destinations, AO Lab configured as the default Scripture fallback, and no deployments.
- No provider, Discord, Google OAuth, or operator configuration was mounted into the container.

## Notes

`docker compose up --build -d` also completed its exact-source build. It could not start on its
documented default port because an existing local Threadlight process already owned
`127.0.0.1:8787`; that process was not interrupted. The same Compose service configuration then
passed the health and control-status smoke on isolated `127.0.0.1:8799` via `docker compose run`.

The production Compose path uses the same Dockerfile and publishes the dashboard only on
`127.0.0.1:8787`. The direct image smoke above is deliberately isolated so it cannot reuse an
operator's existing `threadlight-config` volume.
