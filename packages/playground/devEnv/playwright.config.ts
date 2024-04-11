import type {PlaywrightTestConfig} from '@playwright/test'
import {devices} from '@playwright/test'

const port = 8082
const url = `http://localhost:${port}`

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config: PlaywrightTestConfig = {
  testDir: '../src',
  testMatch: /.*\.e2e\.ts/,
  /* Maximum time one test can run for. */
  timeout: 4000,
  expect: {
    // maximum timeout for expect assertions. If longer than the test timeout above, it'll still fail.
    timeout: 10000,
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 0 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'github' : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    // actionTimeout: 200,
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    baseURL: url,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // args: ["--headless","--no-sandbox","--use-angle=gl"]
          args: ['--no-sandbox'],
        },
      },
    },

    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //   },
    // },
  ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: '../test-results/',

  /*
  This will serve the playground before running the tests, unless the playground is already running.

  Note that if the playground is not running but some other server is serving at port 8080, this will fail.
  TODO 👆
  */
  webServer: {
    command: `yarn run serve:ci --port ${port}`,
    reuseExistingServer: !process.env.CI,
    url: url,
  },
}

export default config
