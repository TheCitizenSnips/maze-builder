const { test, expect } = require('@playwright/test');
const { openApp, readMaze, reachableCount, shortestPath, cellsWithClass } = require('./helpers');

// Grids past 25 × 25, now that zoom can make the squares bigger.
test.describe('Big grids', () => {
  test('sizes step up to 51 × 51', async ({ page }) => {
    await openApp(page);
    const values = await page.locator('#sizeSelect option').evaluateAll(options => options.map(o => Number(o.value)));
    expect(values).toEqual([11, 15, 21, 25, 31, 41, 51]);
  });

  test('51 × 51 fits the window without clipping, and zoom still works', async ({ page }) => {
    await openApp(page, { size: 51 });
    const viewport = page.locator('#mazeViewport');
    const fits = await viewport.evaluate(el => ({
      wide: el.scrollWidth <= el.clientWidth + 1,
      tall: el.scrollHeight <= el.clientHeight + 1
    }));
    expect(fits).toEqual({ wide: true, tall: true });
    const mazeBox = await page.locator('#maze').boundingBox();
    expect(mazeBox.x).toBeGreaterThanOrEqual(0);
    expect(mazeBox.x + mazeBox.width).toBeLessThanOrEqual(page.viewportSize().width);

    await page.click('#zoomInBtn');
    await expect(viewport).toHaveClass(/zoomed/);
    expect(page.mazeErrors).toEqual([]);
  });

  test('a 51 × 51 maze grows whole and the search finds the shortest route', async ({ page }) => {
    test.setTimeout(120_000);
    await openApp(page, { size: 51, speed: 'Super fast' });
    await page.click('#generateBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Built', { timeout: 30_000 });

    const maze = await readMaze(page);
    expect(maze.size).toBe(51);
    expect(reachableCount(maze)).toBe(51 * 51);
    const best = shortestPath(maze);

    // Fast speed: the longer route plays in shorter beats, so the wave and
    // the gold trace still finish while a child is watching.
    await page.selectOption('#speedSelect', { label: 'Fast' });
    const startedAt = Date.now();
    await page.click('#animateBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Solved', { timeout: 90_000 });
    expect(Date.now() - startedAt).toBeLessThan(75_000);
    expect(cellsWithClass(await readMaze(page), 'solution')).toHaveLength(best.length);
    expect(page.mazeErrors).toEqual([]);
  });

  test('a picture shape grows on a 51 × 51 grid', async ({ page }) => {
    await openApp(page, { size: 51, speed: 'Super fast' });
    await page.click('#shapeDetails summary');
    await page.locator('.shape-tile:not([data-shape="square"])').first().click();
    await page.click('#generateBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Built', { timeout: 30_000 });
    expect(await page.locator('#maze .cell.off').count()).toBeGreaterThan(0);
    expect(shortestPath(await readMaze(page))).not.toBeNull();
    expect(page.mazeErrors).toEqual([]);
  });
});
