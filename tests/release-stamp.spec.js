const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

// The Pages workflow (.github/workflows/pages.yml) replaces __MAZE_BUILD__ in
// index.html and app.js with "<commit>|<commit time>". These tests serve
// stamped copies the same way.
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const stamp = (text, build) => text.split('__MAZE_BUILD__').join(build);

const RELEASE = 'a1b2c3d|2026-10-20T04:05:00+00:00';
const OLDER_RELEASE = '9f8e7d6|2026-10-19T23:40:00+00:00';

function serveStamped(page, { pageBuild, scriptBuild }) {
  const html = stamp(read('index.html'), pageBuild);
  page.route(url => url.pathname.endsWith('/maze-builder/'), route =>
    route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  page.route(url => url.pathname.endsWith('/app.js'), route =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: stamp(read('app.js'), scriptBuild()) }));
}

test.describe('Release stamp', () => {
  // The badge shows the release time in local time; pin the zone so the
  // date it shows does not depend on where the tests run.
  test.use({ timezoneId: 'UTC' });

  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name === 'ipad', 'Desktop and iPhone widths cover the badge');
  });

  test('both files carry the placeholder the workflow fills in', () => {
    expect(read('index.html')).toContain('<meta name="maze-build" content="__MAZE_BUILD__">');
    expect(read('app.js')).toContain("const BUILD = '__MAZE_BUILD__';");
    const workflow = read('.github/workflows/pages.yml');
    expect(workflow).toContain('s/__MAZE_BUILD__/${build}/g');
    expect(workflow).toContain('_site/index.html _site/app.js');
  });

  test('a local copy shows no version', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#maze .cell').first()).toBeVisible();
    await expect(page.locator('.release-label')).toHaveCount(0);
  });

  test('a stamped release shows its date and commit next to the offline state', async ({ page }, testInfo) => {
    serveStamped(page, { pageBuild: RELEASE, scriptBuild: () => RELEASE });
    await page.goto('./');
    await expect(page.locator('#maze .cell').first()).toBeVisible();

    const label = page.locator('#offlineBadge .release-label');
    await expect(label).toContainText('Oct 20');
    await expect(page.locator('#offlineBadge')).toHaveAttribute('title', /^Version a1b2c3d, released /);
    // A phone shows the date only, so the badge stays on one line.
    const commit = page.locator('#offlineBadge .release-commit');
    if (testInfo.project.name === 'iphone') await expect(commit).toBeHidden();
    else await expect(commit).toHaveText('a1b2c3d');
  });

  test('a page and script from different releases reload once for matching copies', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Page loading is the same on every screen size');
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    let scriptLoads = 0;
    // The first load gets an older script; after the fresh reload both match.
    serveStamped(page, { pageBuild: RELEASE, scriptBuild: () => (scriptLoads++ === 0 ? OLDER_RELEASE : RELEASE) });

    await page.goto('./');
    await expect(page.locator('#offlineBadge .release-commit')).toHaveText('a1b2c3d');
    expect(scriptLoads).toBe(2);
    expect(new URL(page.url()).search).toBe('');
    await expect(page.locator('#maze .cell')).toHaveCount(15 * 15);
    expect(errors).toEqual([]);
  });
});
