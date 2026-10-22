const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawn } = require('child_process');
const { test, expect } = require('@playwright/test');

// Right after a release a device can get the previous index.html (a stale CDN
// copy, or the offline copy after a network blip) together with the new
// app.js. The live site went blank that way after the Easy/Medium/Hard
// release: the new script crashed on the missing level picker before drawing
// the maze. These tests hand the current script a page without that section.
const currentHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const olderHtml = currentHtml
  .replace(/<div class="segmented level-picker"[\s\S]*?<\/div>/, '')
  .replace(/<details id="styleDetails"[\s\S]*?<\/details>/, '');

function serveOlderPage(page, { always }) {
  const requested = [];
  page.route(url => url.pathname.endsWith('/maze-builder/'), route => {
    const url = new URL(route.request().url());
    requested.push(url.search);
    const stale = always || !url.searchParams.has('fresh');
    if (!stale) return route.continue();
    return route.fulfill({ status: 200, contentType: 'text/html', body: olderHtml });
  });
  return requested;
}

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

test.describe('A page older than the script', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Page loading is the same on every screen size');
  });

  test('reloads once for the fresh page and draws the maze', async ({ page }) => {
    expect(olderHtml).not.toContain('twistyDial');
    const errors = collectErrors(page);
    const requested = serveOlderPage(page, { always: false });

    await page.goto('./');
    await expect(page.locator('#maze .cell')).toHaveCount(15 * 15);
    await expect(page.locator('.level-picker .segment')).toHaveCount(3);
    expect(requested.length).toBe(2);
    expect(requested[1]).toMatch(/^\?fresh=\d+$/);
    expect(new URL(page.url()).search).toBe('');
    expect(errors).toEqual([]);
  });

  test('stops after one try and explains instead of reloading forever', async ({ page }) => {
    const errors = collectErrors(page);
    const requested = serveOlderPage(page, { always: true });

    await page.goto('./');
    await expect(page.locator('#status')).toHaveText(/just updated/);
    await page.waitForTimeout(500);
    expect(requested.length).toBe(2);
    expect(errors).toEqual([]);
  });

  test.describe('when the offline copy is stuck', () => {
    test.use({ serviceWorkers: 'allow' });

    // On an iPad the worker's page fetch kept failing, so every refresh got
    // the page saved at install while app.js kept updating. Here the worker's
    // page fetch is made to fail and an older page is put in its cache.
    test('a refresh drops the stuck copy and loads the fresh page', async ({ page, context }) => {
      const errors = collectErrors(page);
      await page.goto('./');
      await expect(page.locator('#offlineBadge')).toHaveText('Offline ready', { timeout: 30_000 });

      await page.evaluate(async html => {
        const cache = await caches.open('maze-builder-runtime');
        const saved = () => new Response(html, { headers: { 'Content-Type': 'text/html' } });
        await cache.put('./', saved());
        await cache.put('./index.html', saved());
      }, olderHtml);
      await context.route(url => url.pathname.endsWith('/maze-builder/'), route =>
        route.request().serviceWorker() ? route.abort() : route.continue());

      await page.reload();
      await expect(page.locator('#maze .cell')).toHaveCount(15 * 15);
      await expect(page.locator('.level-picker .segment')).toHaveCount(3);
      expect(new URL(page.url()).search).toBe('');
      expect(errors).toEqual([]);

      // With the network healthy again the worker comes back for offline use.
      await context.unrouteAll();
      await page.reload();
      await expect(page.locator('#offlineBadge')).toHaveText(/Offline ready/, { timeout: 30_000 });
    });
  });

  test.describe('under the first service worker', () => {
    test.use({ serviceWorkers: 'allow' });

    // The first working worker (fa79ca6) fetched the page fresh but served app.js and
    // styles from its cache forever, so a device that kept it (an iPad never
    // swapped it out) ran the original script inside every new page. The
    // check in index.html clears it and reloads from the network.
    //
    // A separate server serves a folder that starts as that release. The site
    // is then updated in place while its service-worker.js stays byte-for-byte
    // the same, so Chromium keeps the old worker the way the iPad did.
    const PORT = 4190;
    const repo = path.join(__dirname, '..');
    let site;
    let server;

    test.beforeAll(async () => {
      site = fs.mkdtempSync(path.join(os.tmpdir(), 'maze-first-release-'));
      execFileSync('sh', ['-c', `git archive fa79ca6 | tar -x -C "${site}"`], { cwd: repo });
      server = spawn(process.execPath, [path.join(__dirname, 'static-server.js')], {
        env: { ...process.env, PORT: String(PORT), STATIC_ROOT: site },
        stdio: ['ignore', 'pipe', 'inherit']
      });
      await new Promise(resolve => server.stdout.once('data', resolve));
    });

    test.afterAll(() => {
      server?.kill();
      if (site) fs.rmSync(site, { recursive: true, force: true });
    });

    test('the fresh page clears the old worker and runs the current app', async ({ page }) => {
      const appUrl = `http://localhost:${PORT}/maze-builder/`;
      await page.goto(appUrl);
      await expect(page.locator('#offlineBadge')).toHaveText(/Offline ready/, { timeout: 30_000 });
      await page.reload();
      expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

      for (const file of ['index.html', 'shapes.js', 'app.js', 'styles.css']) {
        fs.copyFileSync(path.join(repo, file), path.join(site, file));
      }
      const errors = collectErrors(page);
      await page.reload();

      await expect(page).toHaveURL(appUrl);
      // Only the current app.js draws thin walls.
      await expect(page.locator('#wallLayer line').first()).toBeAttached();
      await expect(page.locator('.level-picker .segment')).toHaveCount(3);
      expect(await page.evaluate(() => window.mazeBuilderStarted)).toBe(true);
      expect(errors.filter(e => e.startsWith('pageerror'))).toEqual([]);
    });
  });
});
