import { defineConfig, devices } from "@playwright/test";

// Browser tests against the app as it runs in production, at phone size:
// - the main journeys, on an empty database (server.sh);
// - what the core tasks cost in taps, fields and page changes, against the demo household
//   (demo-server.sh; see docs/usability.md).
// Each kind shares one server and database, and runs in order.
export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: "report" }]],
  outputDir: "results",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "phone",
      testMatch: "journeys.e2e.ts",
      use: { ...devices["Pixel 7"], baseURL: "http://127.0.0.1:8400" },
    },
    {
      name: "effort",
      testMatch: "effort.e2e.ts",
      use: { ...devices["Pixel 7"], baseURL: "http://127.0.0.1:8402" },
    },
  ],
  webServer: [
    {
      command: "bash server.sh",
      url: "http://127.0.0.1:8400/api/v1/health",
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: "PORT=8402 bash demo-server.sh",
      url: "http://127.0.0.1:8402/api/v1/health",
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
