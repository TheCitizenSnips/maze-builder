const { test, expect } = require('@playwright/test');
const { openApp, readMaze, growMaze, reachableCount, cellsWithClass, wallCount, shortestPath } = require('./helpers');

/** Inner edges with no wall: the doors the generator has opened. */
const doors = maze => 2 * maze.size * (maze.size - 1) - wallCount(maze);

/**
 * A perfect maze: every square is part of it and reachable from S, and there
 * are no loops. A spanning tree over N squares has exactly N - 1 doors.
 */
function expectPerfectMaze(maze) {
  const n = maze.size;
  expect(maze.start).toEqual({ r: 0, c: 0 });
  expect(maze.end).toEqual({ r: n - 1, c: n - 1 });
  expect(reachableCount(maze)).toBe(n * n);
  expect(doors(maze)).toBe(n * n - 1);
}

test.describe('Growing a maze', () => {
  test('the maze visibly grows, then is a valid connected maze', async ({ page }) => {
    const errors = await openApp(page, { speed: 'Medium' });
    await page.click('#generateBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Growing');

    // Mid-growth: a live carving tip and a partly carved grid.
    await expect(page.locator('#maze .cell.carve-head')).toHaveCount(1);
    const mid = await readMaze(page);
    expect(doors(mid)).toBeGreaterThan(0);
    expect(doors(mid)).toBeLessThan(15 * 15 - 1);
    // Knocked-out walls flash as they go.
    expect(await page.locator('#wallLayer line.zap').count()).toBeGreaterThan(0);

    await expect(page.locator('#phaseLabel')).toHaveText('Built', { timeout: 30_000 });
    // A grown maze is ready to draw in: Solve It Yourself is already on.
    await expect(page.locator('#userSolveBtn')).toHaveText(/Stop Solving/);
    await expect(page.locator('#status')).toContainText('Touch S');
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

  test('a grown maze zig-zags: long corridors that double back on themselves', async ({ page }) => {
    await openApp(page, { size: 15 });
    const maze = await growMaze(page);
    // Thin walls leave every square as path, so the route through a 15 × 15
    // maze winds far beyond the 29 squares of a straight corner-to-corner run
    // (a depth-first maze that happened to run straight is vanishingly rare).
    expect(shortestPath(maze).length).toBeGreaterThan(29);
    // Every square stays open: no square is ever painted as a wall.
    await expect(page.locator('#maze .cell.wall')).toHaveCount(0);
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
    expect(later.right).toEqual(frozen.right);
    expect(later.bottom).toEqual(frozen.bottom);

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
      return doors(await readMaze(page));
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
