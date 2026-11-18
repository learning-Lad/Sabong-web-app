import { defineConfig } from "@playwright/test";
const port = Number(process.env.TEST_PORT || 4173);
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {}),
      args: JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS || "[]"),
    },
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 45000,
    env: {
      VITE_SUPABASE_URL: `http://127.0.0.1:${port}`,
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
    },
  },
});
