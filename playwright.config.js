// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.PORT || 4173);

// Lets tests see and route the service worker's own fetches (Chromium).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

// Chromium runs by default (desktop mouse, plus iPad- and iPhone-sized touch
// screens). Set PW_WEBKIT=1 (npm run test:webkit) to add Safari's engine;
// install it once with `npx playwright install webkit`.
const projects = [
  {
    name: 'desktop',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } }
  },
  {
    name: 'ipad',
    use: {
      browserName: 'chromium',
      viewport: { width: 1024, height: 1366 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    }
  },
  {
    name: 'iphone',
    use: {
      browserName: 'chromium',
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    }
  }
];

if (process.env.PW_WEBKIT) {
  projects.push({ name: 'webkit-ipad', use: { ...devices['iPad Pro 11'] } });
}

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}/maze-builder/`,
    trace: 'retain-on-failure',
    // Most tests want a fresh page every time; the PWA tests opt back in.
    serviceWorkers: 'block'
  },
  projects,
  webServer: {
    command: 'node tests/static-server.js',
    url: `http://localhost:${PORT}/maze-builder/`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) }
  }
});
