const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test.describe('PWA and GitHub Pages', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Service worker checks run once, in desktop Chromium');
  });

  test('every app path is relative, so the app works from /maze-builder/', async () => {
    const html = read('index.html');
    for (const [, url] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      expect(url, `${url} in index.html`).toMatch(/^\.\//);
    }
    const manifest = JSON.parse(read('manifest.webmanifest'));
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.display).toBe('standalone');
    for (const icon of manifest.icons) {
      expect(icon.src).toMatch(/^\.\//);
      expect(fs.existsSync(path.join(root, icon.src))).toBe(true);
    }
    const sw = read('service-worker.js');
    for (const [, url] of sw.matchAll(/'(\.?\/[^']*)'/g)) {
      expect(url, `${url} in service-worker.js`).toMatch(/^\.\//);
    }
    for (const [, url] of sw.matchAll(/'\.\/(icons\/[^']+|[a-z-]+\.(?:js|css|html|webmanifest))'/g)) {
      expect(fs.existsSync(path.join(root, url)), `${url} is precached but missing`).toBe(true);
    }
    expect(read('app.js')).toContain("updateViaCache: 'none'");
    expect(fs.existsSync(path.join(root, '.nojekyll'))).toBe(true);
  });

  test.describe('with the service worker', () => {
    test.use({ serviceWorkers: 'allow' });

    test('registers, takes control, and the badge says offline is ready', async ({ page }) => {
      await page.goto('./');
      await expect(page.locator('#offlineBadge')).toHaveText('Offline ready', { timeout: 15_000 });
      const reg = await page.evaluate(async () => {
        const r = await navigator.serviceWorker.ready;
        return { scope: r.scope, updateViaCache: r.updateViaCache };
      });
      expect(reg.scope).toMatch(/\/maze-builder\/$/);
      expect(reg.updateViaCache).toBe('none');
    });

    test('online loads come from the network; offline loads use the last good copy', async ({ page, context }) => {
      await page.goto('./');
      await expect(page.locator('#offlineBadge')).toHaveText('Offline ready', { timeout: 15_000 });

      // Network-first: two fetches through the worker reach the server twice.
      const stamps = await page.evaluate(async () => {
        const a = await fetch('./app.js');
        const b = await fetch('./app.js');
        return [a.headers.get('x-test-request'), b.headers.get('x-test-request')];
      });
      expect(Number(stamps[1])).toBeGreaterThan(Number(stamps[0]));

      await page.reload();
      await expect(page.locator('#maze .cell').first()).toBeVisible();

      await context.setOffline(true);
      await page.reload();
      await expect(page.locator('#maze .cell')).toHaveCount(15 * 15);
      await expect(page.locator('.app-title')).toHaveText('Maze Builder');

      // Launching from a Home Screen style URL with a query string also works offline.
      await page.goto('./?source=homescreen');
      await expect(page.locator('#maze .cell')).toHaveCount(15 * 15);
      await context.setOffline(false);
    });
  });
});
