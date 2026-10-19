const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { openApp, setSize, makePointer, defaultPointerType, traceCells, blankRoute } = require('./helpers');

/**
 * Every message the app can put in the status line, read straight from
 * app.js so new copy is covered automatically. Template placeholders become
 * a wide two-digit number.
 */
function statusMessages() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const found = new Set();
  const re = /setStatus\(\s*(?:'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/g;
  for (const m of src.matchAll(re)) {
    found.add((m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, '88').replace(/\\'/g, "'"));
  }
  // Messages chosen with a ternary inside setStatus(...).
  const ternary = /setStatus\(\s*\n?\s*[^'`\n]*\?\s*'([^']*)'\s*:\s*'([^']*)'/g;
  for (const m of src.matchAll(ternary)) { found.add(m[1]); found.add(m[2]); }
  const assigned = /(?:const moved = [^']*\?\s*|:\s*)'([A-Z][^']{20,})'/g;
  for (const m of src.matchAll(assigned)) found.add(m[1]);
  return [...found];
}

test.describe('Layout', () => {
  test('no status message ever pushes the maze down', async ({ page }) => {
    await openApp(page);
    const messages = statusMessages();
    expect(messages.length).toBeGreaterThan(30);

    const top = () => page.locator('#maze').evaluate(el => el.getBoundingClientRect().top + window.scrollY);
    const resting = await top();

    for (const message of messages) {
      await page.evaluate(m => { document.getElementById('status').textContent = m; }, message);
      expect(await top(), `"${message}" changed the maze position`).toBe(resting);
    }
  });

  for (const size of [11, 15, 21, 25]) {
    test(`${size} × ${size} fits the screen width without sideways scrolling`, async ({ page }) => {
      await openApp(page);
      await setSize(page, size);

      const fit = await page.evaluate(() => {
        const card = document.querySelector('.maze-card');
        const maze = document.getElementById('maze').getBoundingClientRect();
        return {
          cardOverflow: card.scrollWidth - card.clientWidth,
          pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
          mazeRight: maze.right,
          viewport: window.innerWidth,
          cell: document.querySelector('#maze .cell').getBoundingClientRect().width
        };
      });

      expect(fit.cardOverflow).toBeLessThanOrEqual(0);
      expect(fit.pageOverflow).toBeLessThanOrEqual(0);
      expect(fit.mazeRight).toBeLessThanOrEqual(fit.viewport);
      expect(fit.cell).toBeGreaterThanOrEqual(10);
    });
  }

  test('side-by-side layout keeps the largest maze within the screen height', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Only the wide layout places the maze beside the controls');
    await page.setViewportSize({ width: 1366, height: 1024 });
    await openApp(page);
    await setSize(page, 25);
    await page.evaluate(() => window.scrollTo(0, 0));
    const bottom = await page.locator('#maze').evaluate(el => el.getBoundingClientRect().bottom);
    expect(bottom).toBeLessThanOrEqual(1024);
  });

  test('the drawn line stays on the cells after the screen size changes', async ({ page }, testInfo) => {
    await openApp(page, { size: 11 });
    const pointer = await makePointer(page, defaultPointerType(testInfo));
    await page.click('#userSolveBtn');
    await traceCells(page, blankRoute(11).slice(0, 5), { pointer });

    const vp = page.viewportSize();
    await page.setViewportSize({ width: Math.round(vp.width * 0.8), height: vp.height });

    await expect.poll(() => page.evaluate(() => {
      const raw = document.getElementById('userPathLine').getAttribute('points').trim().split(/\s+/);
      const [x, y] = raw[raw.length - 1].split(',').map(Number);
      const cell = document.querySelector('#maze .cell[data-r="1"][data-c="5"]');
      return Math.hypot(cell.offsetLeft + cell.offsetWidth / 2 - x, cell.offsetTop + cell.offsetHeight / 2 - y) < 1;
    })).toBe(true);
  });

  test('controls are comfortable touch targets', async ({ page }) => {
    await openApp(page);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('button, select')]
        .filter(el => el.offsetParent !== null)
        .map(el => ({ id: el.id || el.textContent.trim(), h: el.getBoundingClientRect().height }))
        .filter(b => b.h < 40));
    expect(small).toEqual([]);
  });
});
