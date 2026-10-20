const fs = require('fs');
const path = require('path');
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
});
