import { defineConfig } from "cypress";

const WEB_PORT = 3200;
const API_PORT = 4200;

export default defineConfig({
  video: true,
  videosFolder: "cypress/artifacts/videos",
  screenshotsFolder: "cypress/artifacts/screenshots",
  downloadsFolder: "cypress/artifacts/downloads",
  screenshotOnRunFailure: true,
  trashAssetsBeforeRuns: true,
  retries: { runMode: 0, openMode: 0 },
  allowCypressEnv: false,
  expose: {
    apiUrl: `http://localhost:${API_PORT}`,
  },
  viewportWidth: 1280,
  viewportHeight: 720,

  e2e: {
    baseUrl: `http://localhost:${WEB_PORT}`,
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    testIsolation: true,
    defaultCommandTimeout: 10_000,
    pageLoadTimeout: 60_000,
    requestTimeout: 15_000,
    responseTimeout: 30_000,
    watchForFileChanges: false,
  },
});
