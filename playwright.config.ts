import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  outputDir: "./output/playwright/results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "./output/playwright/report" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "pnpm --filter @threadlight/web dev --port 4173",
    url: "http://127.0.0.1:4173/?demo=public",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
