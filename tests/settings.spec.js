const { test, expect } = require('@playwright/test');
const { openApp, setSize } = require('./helpers');

test.describe('Remembered settings', () => {
  test('size and speed come back after a reload', async ({ page }) => {
    await openApp(page, { size: 25, speed: 'Slow' });
    await page.reload();

    await expect(page.locator('#maze .cell')).toHaveCount(25 * 25);
    await expect(page.locator('#sizeSelect')).toHaveValue('25');
    await expect(page.locator('#speedSelect option:checked')).toHaveText('Slow');
    expect(page.mazeErrors).toEqual([]);
  });

  test('the maze itself is not remembered, only the choices', async ({ page }) => {
    await openApp(page, { size: 11 });
    await page.click('#generateBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Built', { timeout: 30_000 });
    await page.reload();

    await expect(page.locator('#maze .cell')).toHaveCount(11 * 11);
    await expect(page.locator('#wallLayer line.on')).toHaveCount(0);
  });

  test('a first visit or unreadable saved settings use the defaults', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mazeBuilder.settings', '{not json'));
    await openApp(page, { speed: null });
    await expect(page.locator('#sizeSelect')).toHaveValue('15');
    await expect(page.locator('#speedSelect option:checked')).toHaveText('Medium');

    await page.evaluate(() => localStorage.setItem('mazeBuilder.settings', JSON.stringify({ size: 99, speed: 'warp' })));
    await page.reload();
    await expect(page.locator('#maze .cell')).toHaveCount(15 * 15);
    await expect(page.locator('#speedSelect option:checked')).toHaveText('Medium');
    expect(page.mazeErrors).toEqual([]);
  });

  test('the app still works when storage is blocked', async ({ page }) => {
    await page.addInitScript(() => {
      const fail = () => { throw new Error('blocked'); };
      Object.defineProperty(window, 'localStorage', { get: fail });
    });
    await openApp(page);
    await setSize(page, 21);
    expect(page.mazeErrors).toEqual([]);
  });
});

test.describe('Play placement', () => {
  test('Solve It Yourself sits right above the maze, not among the build controls', async ({ page }) => {
    await openApp(page);
    const btn = page.locator('#userSolveBtn');
    await expect(btn).toBeVisible();
    await expect(page.locator('.sidebar #userSolveBtn')).toHaveCount(0);
    await expect(page.locator('.content-panel #userSolveBtn')).toHaveCount(1);

    const btnBox = await btn.boundingBox();
    const mazeBox = await page.locator('#maze').boundingBox();
    expect(btnBox.y + btnBox.height).toBeLessThanOrEqual(mazeBox.y);
  });
});
