import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:8000",
    },
  },

  use: {
    baseURL: "http://localhost:3000",
    browserName: "chromium",
    headless: true,
  },
});