import { defineConfig, devices } from "@playwright/test";

// The README's screenshots (`make screenshots`), of the demo household at phone size, in light
// and dark. Not a test: CI doesn't run it.
export default defineConfig({
  testDir: ".",
  testMatch: "*.screenshots.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "results",
  use: { ...devices["Pixel 7"], baseURL: "http://127.0.0.1:8401" },
  webServer: {
    command: "bash demo-server.sh",
    url: "http://127.0.0.1:8401/api/v1/health",
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
