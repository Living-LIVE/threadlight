import { expect, type Page, test } from "@playwright/test";

const liveStatus = {
  generatedAt: "2026-07-29T19:46:03.667Z",
  discord: {
    configured: true,
    ready: true,
    state: "running",
    name: "Live Tapestry",
    participationLabel: "Active",
    inviteUrl: "https://discord.gg/threadlight-demo",
    openUrl: "https://discord.com/channels/demo/general",
  },
  youtube: {
    configured: true,
    ready: false,
    state: "paused",
    name: "YouTube Comments",
    channelName: "Threadlight Demo Channel",
    replyPolicy: "Review every reply",
    selectedVideos: [
      {
        title: "We Paint!",
        url: "https://www.youtube.com/watch?v=demo-video",
      },
    ],
    replyCount: 0,
    dailyReplyLimit: 12,
    recentComments: [
      {
        authorName: "@SplinteredGlassSolutions",
        commentText:
          "Threadlight controlled test: man, it's been a long day. Is there a Scripture that speaks to rest?",
        replyText:
          "Jesus invites you into His rest. Come to Me, all you who are weary and burdened, and I will give you rest. (Matthew 11:28-30, BSB)",
        status: "posted",
        createdAt: "2026-07-29T20:10:46.091Z",
        resolvedAt: "2026-07-29T20:11:26.760Z",
      },
    ],
  },
  activity: [
    {
      id: "observed-1",
      createdAt: "2026-07-29T19:45:59.157Z",
      source: "discord",
      status: "observed",
      actor: "Preston",
      input: "man its been a long day..",
    },
    {
      id: "response-1",
      createdAt: "2026-07-29T19:46:03.667Z",
      source: "discord",
      status: "responded",
      actor: "Preston",
      input: "man its been a long day..",
      output: "You do not have to carry the whole weight of this moment at once.",
      reference: "Matthew 11:28-30",
      provider: "openai + ao-lab",
      durationMs: 4049,
    },
    {
      id: "youtube-error-1",
      createdAt: "2026-07-29T19:47:03.667Z",
      source: "youtube",
      status: "error",
      reason: "YouTube connector operation failed.",
    },
  ],
};

async function openPublicDemo(page: Page) {
  await page.route("**/api/demo/live", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(liveStatus),
    }),
  );
  await page.route("**/api/demo/respond", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: {
          message: "You are not alone in this moment.",
          passage: {
            reference: "Psalm 34:18",
            translation: "BSB",
            attribution: "AO Lab Bible API",
          },
        },
        decision: { action: "respond", reason: "A brief response may help." },
        trace: { aiProvider: "gloo", scriptureProvider: "ao-lab", totalMs: 120 },
      }),
    }),
  );
  await page.goto("/?demo=public#overview");
}

test("monitoring shows live health, activity details, external actions, and error filtering", async ({
  page,
}) => {
  await openPublicDemo(page);

  await expect(
    page.getByText(
      "A Scripture-grounded companion active across live Discord and YouTube conversations.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Hackathon demo proof")).toContainText("Gloo AI Studio integrated");
  await expect(page.getByRole("link", { name: /View source/ })).toHaveAttribute(
    "href",
    "https://github.com/Living-LIVE/threadlight",
  );
  await page.getByRole("button", { name: "Monitoring", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Watch Threadlight work." })).toBeVisible();
  await expect(page.getByLabel("Monitoring summary")).toContainText("1Live connectors");
  await expect(page.getByLabel("Monitoring summary")).toContainText("3Recent events");
  await expect(page.getByLabel("Monitoring summary")).toContainText("1Errors");
  await expect(page.getByRole("link", { name: /Join Discord/ })).toHaveAttribute(
    "href",
    "https://discord.gg/threadlight-demo",
  );
  const activityList = page.locator(".activity-list");
  await expect(activityList.getByText("Matthew 11:28-30")).toBeVisible();
  await expect(activityList.getByText("openai + ao-lab")).toBeVisible();

  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByText("@SplinteredGlassSolutions")).toBeVisible();
  await expect(page.getByText("posted", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Threadlight controlled test: man, it's been a long day. Is there a Scripture that speaks to rest?",
    ),
  ).toBeVisible();
  await expect(page.getByText(/Jesus invites you into His rest/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Post reply" })).toHaveCount(0);

  await page.getByRole("button", { name: "Monitoring", exact: true }).click();
  await page.getByRole("button", { name: "Errors" }).click();
  await expect(activityList.getByText("YouTube connector operation failed.")).toBeVisible();
  await expect(activityList.getByText("man its been a long day..")).not.toBeVisible();
});

test("public setup and deployment stay isolated and require a successful provider check", async ({
  page,
}) => {
  await openPublicDemo(page);

  await page.getByRole("button", { name: "Manage" }).click();
  await expect(page.getByRole("heading", { name: "Manage this Threadlight." })).toBeVisible();
  await expect(page.getByLabel("Access code")).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Back to public demo" }).click();

  await page.getByRole("button", { name: /Overview/ }).click();
  await expect(page.getByRole("heading", { name: "Run a live response." })).toBeVisible();
  await expect(page.getByLabel("Sample scenario")).toHaveValue("grief");
  await page.getByLabel("Sample scenario").selectOption("conflict");
  await expect(page.getByText(/I am frustrated and I do not want to send/)).toBeVisible();
  await page.getByRole("button", { name: "Run live response" }).click();
  await expect(page.getByText("gloo + ao-lab")).toBeVisible();
  await page.getByRole("button", { name: /Add destination/ }).click();
  await expect(page.getByText("Setup · 1 of 3")).toBeVisible();
  await expect(page.getByRole("button", { name: /Microsoft Teams/ })).toBeDisabled();

  await page.getByRole("button", { name: /YouTube Comments/ }).click();
  await expect(page.getByText("Setup · 2 of 3")).toBeVisible();
  await expect(page.getByLabel("YouTube channel")).toHaveValue("demo-channel");
  await expect(page.getByLabel("Making room for a quieter kind of hope")).toBeChecked();
  const selectedVideoLabel = page.getByText("Making room for a quieter kind of hope");
  await expect(selectedVideoLabel).toBeVisible();
  expect(
    await selectedVideoLabel.evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.getByRole("button", { name: /Configure Threadlight/ }).click();

  await expect(page.getByText("Deploy · 3 of 3")).toBeVisible();
  const model = page.getByLabel("Model");
  await expect(model).toHaveValue("auto");
  await page.getByRole("button", { name: "Openai" }).click();
  await expect(model).toHaveValue("gpt-4.1-mini");
  await page.getByRole("button", { name: "Gloo" }).click();
  await expect(model).toHaveValue("auto");

  const launch = page.getByRole("button", { name: /Launch Threadlight/ });
  await expect(launch).toBeDisabled();
  await page.getByRole("button", { name: /Save and test/ }).click();
  await expect(page.getByText(/Sandbox check: .* returned in 120 ms/)).toBeVisible();
  await expect(launch).toBeEnabled();
  await launch.click();

  await expect(
    page.getByText("YouTube Comments is ready in the browser-only demo workspace."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.getByRole("button", { name: "Monitoring", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Watch Threadlight work." })).toBeVisible();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(
    page.getByText("YouTube Comments is ready in the browser-only demo workspace."),
  ).not.toBeVisible();
});

test("operator review queue posts an approved reply and moves it to history", async ({ page }) => {
  const draft = {
    id: "draft-1",
    authorName: "Jordan M.",
    commentText: "This week has been difficult. Is there a passage that might help?",
    replyText: "Isaiah 41:10 offers a steady reminder that God is present and will strengthen you.",
    status: "pending",
  };
  const controlStatus = {
    youtubeCallbackUrl: "http://127.0.0.1:8787/api/oauth/youtube/callback",
    youtubeOAuthConfigured: true,
    catalog: [],
    configuration: {
      providers: {
        ai: { provider: "gloo", model: "auto", configured: true },
        scripture: { provider: "ao", bibleId: "BSB", configured: true },
      },
      deployments: [
        {
          id: "youtube-1",
          kind: "youtube-comments",
          name: "YouTube Comments",
          state: "running",
          configured: true,
          youtube: {
            channelName: "Preston Pope",
            selectedVideos: [{ id: "video-1", title: "We Paint!" }],
            clientIdConfigured: true,
            clientSecretConfigured: true,
            refreshTokenConfigured: true,
            replyMode: "review",
            pollSeconds: 180,
            dailyReplyLimit: 12,
            replyCount: 0,
            drafts: [draft],
          },
        },
      ],
    },
    runtime: { deployments: [{ id: "youtube-1", state: "running", ready: true }] },
  };

  await page.route("**/api/control/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(controlStatus),
    }),
  );
  await page.route("**/api/control/activity", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(liveStatus),
    }),
  );
  await page.route(
    "**/api/control/deployments/youtube-1/youtube/drafts/draft-1/approve",
    (route) => {
      draft.status = "posted";
      return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    },
  );

  await page.goto("/#review");
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
  await expect(page.getByLabel("Review summary")).toContainText("1Awaiting review");
  await page.getByRole("button", { name: "Post reply" }).click();
  await expect(page.getByLabel("Review summary")).toContainText("0Awaiting review");
  await expect(page.getByText("posted", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Post reply" })).toHaveCount(0);
});

test("Discord setup keeps credentials hidden while exposing selectable locations", async ({
  page,
}) => {
  await openPublicDemo(page);

  await page.getByRole("button", { name: /Overview/ }).click();
  await page.getByRole("button", { name: "Open Live Tapestry" }).click();
  await expect(page.getByText("Setup · 2 of 3")).toBeVisible();
  await expect(page.getByLabel("Application ID")).toHaveValue("");
  await expect(page.getByLabel("Application ID")).toHaveAttribute(
    "placeholder",
    "Replace saved application ID",
  );
  await expect(page.getByLabel("Bot token")).toHaveValue("");
  await expect(page.getByLabel("Bot token")).toHaveAttribute("type", "password");
  await expect(page.getByLabel("Server")).toHaveValue("demo-live-tapestry");
  await expect(page.getByLabel("Channel")).toHaveValue("demo-integrations");
});

test("monitoring remains usable at a mobile dashboard viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPublicDemo(page);

  await page.getByRole("button", { name: "Monitoring", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Watch Threadlight work." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Errors" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Join Discord/ })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("primary navigation stays available through setup and supports browser back", async ({
  page,
}) => {
  await openPublicDemo(page);

  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await page.getByRole("button", { name: /Add destination/ }).click();
  await expect(page.getByText("Setup · 1 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Cancel setup" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.getByRole("button", { name: /Add destination/ }).click();
  await expect(page.getByText("Setup · 1 of 3")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Monitoring", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
  await page.getByRole("button", { name: "Monitoring", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Watch Threadlight work." })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
});
