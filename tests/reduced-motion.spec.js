const { test, expect } = require('@playwright/test');
const { openApp, growMaze, readMaze, shortestPath, cellsWithClass, makePointer, defaultPointerType, traceCells } = require('./helpers');

test.describe('Reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('every mode still works and still shows its state', async ({ page }, testInfo) => {
    await openApp(page, { size: 11 });
    const maze = await growMaze(page);
    expect(shortestPath(maze)).not.toBeNull();

    await page.click('#animateBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Solved', { timeout: 30_000 });
    const solved = await readMaze(page);
    expect(cellsWithClass(solved, 'solution')).toHaveLength(shortestPath(maze).length);
    expect(cellsWithClass(solved, 'visited').length).toBeGreaterThan(0);

    await page.click('#userSolveBtn');
    await page.locator('#maze').scrollIntoViewIfNeeded();
    const pointer = await makePointer(page, defaultPointerType(testInfo));
    await traceCells(page, shortestPath(maze), { pointer });
    await expect(page.locator('#successSheet')).toBeVisible();
    await expect(page.locator('#successEfficiency')).toHaveText('100%');
  });
});
