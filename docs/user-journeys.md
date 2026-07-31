# Core User Journeys

Threadlight has four primary web application journeys. Overview, Review, and Monitoring remain
available in the persistent application navigation while setup and connector editing are open.

## 1. Setup

**Goal:** connect one destination without requiring the operator to understand Threadlight's
internal architecture.

1. Choose an available destination. Discord is the recommended first deployment.
2. Connect the destination:
   - Discord: save the application and bot credentials, load the servers available to that bot,
     then choose an accessible server and channel.
   - YouTube: sign in with the owner Google account, choose a channel, then allowlist videos.
3. Choose the participation or reply policy.
4. Choose the AI and Scripture providers.
5. Review the exact destination, behavior, provider, and Scripture source before deployment.

**Completion signal:** the final review has no missing requirement and the deployment can be
launched.

**Recovery:** credential and location failures remain on the current step with actionable copy.
Saved credentials are never redisplayed.

## 2. Deployment

**Goal:** turn a valid configuration into a running listener or poller with no ambiguity about what
will start.

1. Review the connected destination and selected scope.
2. Confirm participation/reply policy and provider pair.
3. Run a private provider check. This must return successfully and does not post to a destination.
4. Launch the deployment.
5. Return to the dashboard with a visible success notice.
6. Edit or pause the deployment from Overview.

**Completion signal:** runtime state is `Live`, not merely saved or configured.

**Recovery:** a failed launch keeps the operator on the review screen and explains the missing
provider, connection, or runtime requirement.

## 3. Review

**Goal:** decide which proposed YouTube replies should be posted and resolve failed replies without
searching through connector configuration.

1. Open Review from the persistent application navigation.
2. Scan the awaiting-review, needs-attention, and recent-decision counts.
3. Compare the original comment with the proposed reply.
4. Post, reject, or dismiss the reply when operating an unlocked Threadlight deployment.
5. Revisit posted, rejected, and skipped decisions in review history.

**Completion signal:** the actionable queue is clear or every remaining item has an understood
owner and next action.

The public demo exposes sanitized review history without operator actions.

## 4. Monitoring

**Goal:** understand whether Threadlight is healthy, what it processed, what it intentionally
skipped, and what needs attention.

1. Open the Monitoring workspace.
2. Scan live connector count, recent event count, and errors.
3. Review connector-specific health and external destination links.
4. Filter recent activity by Discord, YouTube, or errors.
5. Inspect observed messages, generated responses, Scripture references, provider traces,
   intentional skips, and public-safe errors.
6. Return to Overview to edit or pause a destination, or open Review for reply decisions.

**Completion signal:** the operator can explain the current runtime state and identify whether any
action is needed.

## Public Demo Boundary

The public workspace uses the same Monitoring journey against a sanitized read-only API. Visitors
can open the selected Discord and YouTube destinations but cannot change real configuration or call
operator actions. Its Overview workspace includes a browser-only configuration playground. A
deployment operator can choose **Manage**, enter the server's control access code, and transition
into the protected workspace. That code is held in browser memory only and is cleared when the
operator exits control or reloads the page.

The browser-only playground uses a deterministic, clearly labeled sandbox provider check so judges
can complete the setup and deployment walkthrough without changing or depending on the live
provider credentials. Real connector health and activity remain visible only in Monitoring.
