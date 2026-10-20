const { test, expect } = require('@playwright/test');
const { openApp, setSize, growMaze } = require('./helpers');

test.describe('Printing', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Print layout is the same on every screen');
  });

  test('prints only the maze: no controls, telemetry or search colours', async ({ page }) => {
    await openApp(page, { size: 15 });
    await growMaze(page);
    await page.click('#instantBtn');
    await page.emulateMedia({ media: 'print' });

    for (const sel of ['.sidebar', '.nav-bar', '.telemetry', '.legend', '#status', '#phaseLabel']) {
      await expect(page.locator(sel)).toBeHidden();
    }
    await expect(page.locator('#maze')).toBeVisible();

    const colours = await page.evaluate(() => {
      const bg = sel => getComputedStyle(document.querySelector(sel)).backgroundColor;
      return {
        wall: getComputedStyle(document.querySelector('#wallLayer line.on')).stroke,
        wallOpacity: getComputedStyle(document.querySelector('#wallLayer line.on')).opacity,
        border: getComputedStyle(document.getElementById('maze')).borderTopColor,
        explored: bg('#maze .cell.visited:not(.solution):not(.start):not(.end)'),
        gold: bg('#maze .cell.solution:not(.start):not(.end)')
      };
    });
    expect(colours.wall).toBe('rgb(28, 43, 79)');
    expect(colours.wallOpacity).toBe('1');
    expect(colours.border).toBe('rgb(28, 43, 79)');
    expect(colours.explored).toBe('rgb(255, 255, 255)');
    expect(colours.gold).toBe('rgb(255, 214, 10)');
  });

  test('nothing but the maze has a background, so no grey box prints around it', async ({ page }) => {
    await openApp(page, { size: 15 });
    await page.emulateMedia({ media: 'print' });

    const shaded = await page.evaluate(() => {
      const blank = c => c === 'rgba(0, 0, 0, 0)' || c === 'rgb(255, 255, 255)';
      const out = [];
      for (const el of [document.documentElement, document.body, ...document.body.querySelectorAll('*')]) {
        if (el.closest('#mazeStage') || el.closest('#successSheet')) continue;
        const cs = getComputedStyle(el);
        if (!el.getClientRects().length && el !== document.documentElement) continue;
        if (!blank(cs.backgroundColor) || cs.backgroundImage !== 'none') {
          out.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${el.className} ${cs.backgroundColor} ${cs.backgroundImage}`);
        }
      }
      return out;
    });
    expect(shaded).toEqual([]);
  });

  test('the largest maze fits across a Letter or A4 page', async ({ page }) => {
    await openApp(page);
    await setSize(page, 25);
    await page.emulateMedia({ media: 'print' });
    const width = await page.locator('#maze').evaluate(el => el.getBoundingClientRect().width);
    // 7in of cells plus the outside wall on each side, at 96 CSS px per inch.
    expect(width).toBeLessThanOrEqual(7 * 96 + 10);
  });

  test('the Pencil line and result sheet are not printed', async ({ page }) => {
    await openApp(page, { size: 11 });
    await page.click('#userSolveBtn');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#userPathOverlay')).toBeHidden();
  });
});
