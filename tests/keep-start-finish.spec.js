const { test, expect } = require('@playwright/test');
const { openApp, readMaze, growMaze, reachableCount, wallCount, shortestPath, cell, blocked } = require('./helpers');

async function placeMarkers(page, s, e) {
  await page.click('#startBtn');
  await cell(page, s.r, s.c).click();
  await page.click('#endBtn');
  await cell(page, e.r, e.c).click();
  const maze = await readMaze(page);
  expect(maze.start).toEqual(s);
  expect(maze.end).toEqual(e);
}

test.describe('Growing keeps a moved Start and Finish', () => {
  test('S and F stay where they were put, and the maze is still valid', async ({ page }) => {
    const errors = await openApp(page, { size: 15 });
    const s = { r: 3, c: 11 };
    const e = { r: 12, c: 2 };
    await placeMarkers(page, s, e);

    const maze = await growMaze(page);
    expect(maze.start).toEqual(s);
    expect(maze.end).toEqual(e);
    // Medium has no shortcuts: a perfect maze joining every square.
    expect(reachableCount(maze)).toBe(15 * 15);
    expect(2 * 15 * 14 - wallCount(maze)).toBe(15 * 15 - 1);
    expect(shortestPath(maze)).not.toBeNull();
    expect(errors).toEqual([]);
  });

  test('S and F side by side still give a long route, not a short hop', async ({ page }) => {
    const errors = await openApp(page, { size: 15 });
    const s = { r: 7, c: 7 };
    const e = { r: 7, c: 8 };
    await placeMarkers(page, s, e);

    for (let i = 0; i < 3; i++) {
      const maze = await growMaze(page);
      expect(maze.start).toEqual(s);
      expect(maze.end).toEqual(e);
      // The wall between them stays up, so there is no one-step answer.
      expect(blocked(maze, s, e)).toBe(true);
      expect(reachableCount(maze)).toBe(15 * 15);
      // Longer than a straight corner-to-corner run across the whole grid.
      expect(shortestPath(maze).length).toBeGreaterThan(29);
    }
    expect(errors).toEqual([]);
  });

  test('Easy, with its shortcuts, still keeps neighbours apart', async ({ page }) => {
    const errors = await openApp(page);
    await page.click('[data-level="easy"]');
    await expect(page.locator('#maze .cell')).toHaveCount(11 * 11);
    const s = { r: 5, c: 5 };
    const e = { r: 6, c: 5 };
    await placeMarkers(page, s, e);

    for (let i = 0; i < 3; i++) {
      const maze = await growMaze(page);
      expect(maze.start).toEqual(s);
      expect(maze.end).toEqual(e);
      expect(blocked(maze, s, e)).toBe(true);
      expect(reachableCount(maze)).toBe(11 * 11);
      expect(shortestPath(maze).length).toBeGreaterThan(10);
    }
    expect(errors).toEqual([]);
  });

  test('changing the size puts S and F back in the corners', async ({ page }) => {
    await openApp(page, { size: 15 });
    await placeMarkers(page, { r: 7, c: 7 }, { r: 7, c: 8 });
    await page.selectOption('#sizeSelect', '11');
    const maze = await growMaze(page);
    expect(maze.start).toEqual({ r: 0, c: 0 });
    expect(maze.end).toEqual({ r: 10, c: 10 });
  });
});

test.describe('The maze comes into view', () => {
  async function scrollToTop(page) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('#generateBtn').scrollIntoViewIfNeeded();
  }

  test('growing and solving scroll the maze onto the screen', async ({ page }) => {
    const errors = await openApp(page, { size: 15 });

    await scrollToTop(page);
    await page.click('#generateBtn');
    await expect(page.locator('#maze')).toBeInViewport({ ratio: 0.95 });
    await expect(page.locator('#phaseLabel')).toHaveText('Built', { timeout: 30_000 });

    await scrollToTop(page);
    await page.click('#animateBtn');
    await expect(page.locator('#maze')).toBeInViewport({ ratio: 0.95 });
    await expect(page.locator('#phaseLabel')).toHaveText('Solved', { timeout: 30_000 });

    await scrollToTop(page);
    await page.click('#instantBtn');
    await expect(page.locator('#maze')).toBeInViewport({ ratio: 0.95 });
    expect(errors).toEqual([]);
  });
});
