const { test, expect } = require('@playwright/test');
const { openApp, readMaze, growMaze, reachableCount, cellsWithClass, setSize } = require('./helpers');

/** A perfect maze: border solid, every odd/odd cell open, all open cells connected, no loops. */
function expectPerfectMaze(maze) {
  const n = maze.size;
  for (let i = 0; i < n; i++) {
    expect(maze.walls[0][i]).toBe(true);
    expect(maze.walls[n - 1][i]).toBe(true);
    expect(maze.walls[i][0]).toBe(true);
    expect(maze.walls[i][n - 1]).toBe(true);
  }
  // Even/even cells are pillars and never carved.
  for (let r = 0; r < n; r += 2) {
    for (let c = 0; c < n; c += 2) expect(maze.walls[r][c]).toBe(true);
  }

  const targets = Math.floor(n / 2) ** 2;
  let open = 0;
  for (let r = 1; r < n; r += 2) {
    for (let c = 1; c < n; c += 2) expect(maze.walls[r][c]).toBe(false);
  }
  for (const row of maze.walls) for (const w of row) if (!w) open++;

  // A spanning tree over T rooms has T rooms + (T - 1) doors.
  expect(open).toBe(targets * 2 - 1);
  expect(reachableCount(maze)).toBe(open);
  expect(maze.walls[maze.start.r][maze.start.c]).toBe(false);
  expect(maze.walls[maze.end.r][maze.end.c]).toBe(false);
}

test.describe('Growing a maze', () => {
  test('the maze visibly grows, then is a valid connected maze', async ({ page }) => {
    const errors = await openApp(page, { speed: 'Medium' });
    await page.click('#generateBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Growing');

    // Mid-growth: a live carving tip and a partly carved grid.
    await expect(page.locator('#maze .cell.carve-head')).toHaveCount(1);
    const mid = await readMaze(page);
    const openMid = mid.walls.flat().filter(w => !w).length;
    expect(openMid).toBeGreaterThan(0);
    expect(openMid).toBeLessThan(49 * 2 - 1);

    await expect(page.locator('#phaseLabel')).toHaveText('Built', { timeout: 30_000 });
    const maze = await readMaze(page);
    expectPerfectMaze(maze);
    expect(cellsWithClass(maze, 'carve-head')).toHaveLength(0);
    expect(errors).toEqual([]);
  });

  for (const size of [11, 25]) {
    test(`${size} × ${size} grows into a valid maze`, async ({ page }) => {
      await openApp(page, { size });
      const maze = await growMaze(page);
      expect(maze.size).toBe(size);
      expectPerfectMaze(maze);
    });
  }

  test('several mazes in a row are all valid', async ({ page }) => {
    await openApp(page, { size: 11 });
    for (let i = 0; i < 4; i++) expectPerfectMaze(await growMaze(page));
  });

  test('backtracking is visible: the tip retreats instead of vanishing', async ({ page }) => {
    await openApp(page, { size: 11, speed: 'Slow' });
    await page.click('#generateBtn');

    // Moving forward always lands the tip on a brand-new cell, so seeing it
    // on an earlier cell again means it retreated to a branch point.
    const seen = new Set();
    let lastId = null;
    let retreated = false;
    for (let i = 0; i < 400 && !retreated; i++) {
      const tip = await page.evaluate(() => {
        const heads = document.querySelectorAll('#maze .cell.carve-head');
        const phase = document.getElementById('phaseLabel').textContent;
        return { count: heads.length, id: heads[0] ? `${heads[0].dataset.r},${heads[0].dataset.c}` : null, phase };
      });
      if (tip.phase !== 'Growing') break;
      if (tip.count === 1 && tip.id !== lastId) {
        if (seen.has(tip.id)) retreated = true;
        seen.add(tip.id);
        lastId = tip.id;
      }
      await page.waitForTimeout(20);
    }
    expect(retreated).toBe(true);
  });

  test('pause freezes growth and resume finishes it', async ({ page }) => {
    await openApp(page, { speed: 'Medium' });
    await page.click('#generateBtn');
    await page.waitForTimeout(300);
    await page.click('#pauseBtn');
    await expect(page.locator('#pauseBtn')).toHaveText(/Resume/);
    await expect(page.locator('#phaseLabel')).toHaveText('Paused');

    const frozen = await readMaze(page);
    await page.waitForTimeout(600);
    const later = await readMaze(page);
    expect(later.walls).toEqual(frozen.walls);

    await page.click('#pauseBtn');
    await expect(page.locator('#phaseLabel')).toHaveText(/Growing|Built/);
    await expect(page.locator('#phaseLabel')).toHaveText('Built', { timeout: 30_000 });
    expectPerfectMaze(await readMaze(page));
    await expect(page.locator('#pauseBtn')).toBeDisabled();
  });

  test('speed changes how fast the maze grows', async ({ page }) => {
    const carvedAfter = async (speed) => {
      await openApp(page, { size: 21, speed });
      await page.click('#generateBtn');
      await page.waitForTimeout(500);
      return (await readMaze(page)).walls.flat().filter(w => !w).length;
    };

    const slow = await carvedAfter('Slow');
    const fast = await carvedAfter('Fast');
    expect(fast).toBeGreaterThan(slow * 2);
  });

  test('editing and play controls are locked while the maze grows', async ({ page }) => {
    await openApp(page, { speed: 'Slow' });
    await page.click('#generateBtn');
    for (const id of ['#sizeSelect', '#drawBtn', '#startBtn', '#endBtn', '#generateBtn', '#animateBtn', '#instantBtn', '#blankBtn', '#userSolveBtn']) {
      await expect(page.locator(id)).toBeDisabled();
    }
    await expect(page.locator('#pauseBtn')).toBeEnabled();
  });
});
