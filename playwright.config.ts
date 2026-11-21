import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./test/browser",
  ...(process.env.CI ? { workers: 1 } : {}),
  use: {
    baseURL: "http://127.0.0.1:4321",
    ...devices["Desktop Chrome"],
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4321 --ignore-lock",
    url: "http://127.0.0.1:4321",
    reuseExistingServer: false,
    env: { ASTRO_TELEMETRY_DISABLED: "1" },
  },
});
