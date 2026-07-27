# Public Security Review - 2026-07-27

## Scope

Reviewed the public Git repository, its complete reachable Git history, the Vercel dashboard,
and the Railway runtime control surface. Credential values were not printed or copied during this
review.

## Findings

### TL-SEC-001 - High - Remote control API lacked authentication

**Location:** `apps/server/src/app.ts` control routes and the hosted Railway runtime.

**Evidence:** An unauthenticated request to the hosted `/api/control/status` endpoint returned
`200`. The same control namespace includes provider configuration, deployment launch/pause,
YouTube scans, and approved-reply actions. CORS only constrains cooperative browsers and does not
protect direct HTTP clients.

**Fix in source:** Non-loopback deployments now require `THREADLIGHT_CONTROL_TOKEN` for every
`/api/control/*` route and the YouTube OAuth-start route. Missing remote configuration fails
closed with `503`; invalid or absent bearer tokens receive `401`. Comparison uses constant-time
bytes. The static dashboard asks for the code at runtime and retains it only in memory.

**Deployment requirement:** Before deploying this commit, configure a unique token of at least 32
characters in Railway as `THREADLIGHT_CONTROL_TOKEN`. Enter the same token only in the operator
dashboard when prompted. The currently deployed Railway runtime predates this change and remains
an exposure until that configuration and deployment occur.

### TL-SEC-002 - Medium - Anonymous remote demo could consume configured providers

**Location:** `apps/server/src/app.ts` `/api/demo/respond`.

**Evidence:** An earlier draft of the endpoint accepted arbitrary bounded prompts and invoked the
configured orchestrator. Its in-memory IP limiter is not a durable abuse boundary on a hosted
runtime.

**Fix in source:** Remote demo requests return `404` unless
`THREADLIGHT_DEMO_ENABLED=true` is explicitly configured. When enabled, the route accepts only a
known scenario ID; the server owns the prompt and conversation messages. It is independently
limited to five responses per IP per minute. Loopback development remains available for the
credential-free notebook flow.

### TL-SEC-003 - Low - Public dashboard lacked explicit browser hardening headers

**Location:** `vercel.json` and `apps/server/src/app.ts`.

**Fix in source:** Added CSP, clickjacking, MIME-sniffing, referrer, permissions, and no-index
headers. The policy permits only same-origin application assets, HTTPS image/API connections, and
data images needed by selected-video thumbnails.

## Credential Scan

- Current tracked files: no matches for the reviewed Google, OpenAI, GitHub, Slack, YouVersion,
  or private-key patterns.
- Reachable Git history: no matches for those patterns.
- `.env.example` contains only empty placeholders; `.env*`, `.threadlight/`, Vercel metadata, and
  browser-capture artifacts are ignored.
- GitHub secret scanning is not enabled for this public repository, so this review does not replace
  provider-side secret rotation or future platform scanning.
- `pnpm audit --prod` reported zero known production dependency vulnerabilities.

## Verification

- Focused server control and web type checks passed after the access boundary change.
- Control tests prove missing, invalid, and valid remote tokens; they also prove remote demo is
  disabled by default.

## Residual Risk

The code change is not live until an operator configures the Railway token and deploys it. Rotate
any provider credential if there is evidence it was exposed outside the repository review scope.
