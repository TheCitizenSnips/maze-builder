const { test, expect } = require('@playwright/test');
const { openApp, readMaze, growMaze, shortestPath, cellsWithClass, toggleWall, metric, cell, blocked } = require('./helpers');

/** Gold cells must form one unbroken S→E corridor walk of the true shortest length. */
function expectGoldIsShortest(maze) {
  const gold = cellsWithClass(maze, 'solution');
  const expected = shortestPath(maze);
  expect(expected).not.toBeNull();
  expect(gold).toHaveLength(expected.length);

  const goldSet = new Set(gold.map(p => `${p.r},${p.c}`));
  expect(goldSet.has(`${maze.start.r},${maze.start.c}`)).toBe(true);
  expect(goldSet.has(`${maze.end.r},${maze.end.c}`)).toBe(true);

  // Walk the gold cells from S, one open edge at a time: gold never crosses a wall.
  let cur = maze.start;
  const walked = new Set([`${cur.r},${cur.c}`]);
  while (!(cur.r === maze.end.r && cur.c === maze.end.c)) {
    const next = [[1, 0], [0, 1], [-1, 0], [0, -1]]
      .map(([dr, dc]) => ({ r: cur.r + dr, c: cur.c + dc }))
      .find(n => goldSet.has(`${n.r},${n.c}`) && !walked.has(`${n.r},${n.c}`) && !blocked(maze, cur, n));
    expect(next, 'gold path is continuous').toBeTruthy();
    walked.add(`${next.r},${next.c}`);
    cur = next;
  }
  expect(walked.size).toBe(gold.length);
}

/** Wall off E (the bottom-right corner) completely on a blank 11 × 11 grid. */
async function boxInFinish(page) {
  await toggleWall(page, 10, 9, 'right');
  await toggleWall(page, 9, 10, 'bottom');
}

test.describe('Computer path discovery', () => {
  test('the search wave spreads, keeps explored cells, and traces the true shortest path in gold', async ({ page }) => {
    const errors = await openApp(page, { size: 15 });
    await growMaze(page);
    await page.click('#animateBtn');

    await expect(page.locator('#phaseLabel')).toHaveText('Searching');
    await expect(page.locator('#maze .cell.frontier').first()).toBeVisible();
    await expect(page.locator('#status')).toContainText('on the wavefront');
    await expect(page.locator('#maze .cell.visited').first()).toBeAttached();

    // The wave only reaches squares it can walk to from S without crossing a wall.
    const snapshot = await readMaze(page);
    const reachable = new Set();
    for (let d = 0, layer = [snapshot.start]; layer.length; d++) {
      layer.forEach(p => reachable.add(`${p.r},${p.c}`));
      layer = layer.flatMap(p => [[1, 0], [0, 1], [-1, 0], [0, -1]]
        .map(([dr, dc]) => ({ r: p.r + dr, c: p.c + dc }))
        .filter(n => !blocked(snapshot, p, n) && !reachable.has(`${n.r},${n.c}`)));
    }
    for (const cls of ['frontier', 'visited', 'current']) {
      for (const p of cellsWithClass(snapshot, cls)) expect(reachable.has(`${p.r},${p.c}`)).toBe(true);
    }

    await expect(page.locator('#phaseLabel')).toHaveText('Tracing', { timeout: 30_000 });
    await expect(page.locator('#maze .cell.solution-head')).toHaveCount(1);
    await expect(page.locator('#phaseLabel')).toHaveText('Solved', { timeout: 30_000 });

    const maze = await readMaze(page);
    expectGoldIsShortest(maze);

    // Blue explored history stays behind the gold route.
    const visited = cellsWithClass(maze, 'visited');
    expect(visited.length).toBeGreaterThanOrEqual(cellsWithClass(maze, 'solution').length);
    const shortest = shortestPath(maze).length - 1;
    expect(await metric(page, 5)).toBe(String(shortest));
    await expect(page.locator('#status')).toContainText(`shortest route of ${shortest} steps`);
    expect(errors).toEqual([]);
  });

  test('Solve Instantly gives the same shortest path', async ({ page }) => {
    await openApp(page, { size: 21 });
    await growMaze(page);
    await page.click('#instantBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Solved');
    expectGoldIsShortest(await readMaze(page));
  });

  test('finds the shortest route on a hand-drawn maze with a detour', async ({ page }) => {
    await openApp(page, { size: 11 });
    // A wall under row 5, open only at the far left, and another under row 7,
    // open only at the far right, force the route to snake across the grid.
    for (let c = 1; c <= 10; c++) await toggleWall(page, 5, c, 'bottom');
    for (let c = 0; c <= 9; c++) await toggleWall(page, 7, c, 'bottom');
    await page.click('#instantBtn');
    const maze = await readMaze(page);
    expectGoldIsShortest(maze);
    const gold = cellsWithClass(maze, 'solution');
    expect(gold.some(p => p.r === 6 && p.c === 0)).toBe(true);
    expect(gold.some(p => p.r === 7 && p.c === 10)).toBe(true);
  });

  test('a single thin wall between two squares is never crossed', async ({ page }) => {
    await openApp(page, { size: 11 });
    // A corridor along the top row, sealed from the row below except at the end.
    for (let c = 0; c <= 9; c++) await toggleWall(page, 0, c, 'bottom');
    await page.click('#startBtn');
    await page.locator('#maze .cell[data-r="1"][data-c="0"]').click();
    await page.click('#endBtn');
    await page.locator('#maze .cell[data-r="0"][data-c="0"]').click();
    await page.click('#instantBtn');
    const maze = await readMaze(page);
    // S and E are neighbours, but the wall between them means going all the way round.
    expectGoldIsShortest(maze);
    expect(cellsWithClass(maze, 'solution')).toHaveLength(1 + 10 + 1 + 10);
  });

  test('pause freezes the search and resume completes it', async ({ page }) => {
    await openApp(page, { size: 15, speed: 'Medium' });
    await growMaze(page);
    await page.click('#animateBtn');
    await page.waitForTimeout(500);
    await page.click('#pauseBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Paused');

    // Give any in-flight step time to settle, then confirm nothing moves.
    await page.waitForTimeout(400);
    const frozen = await readMaze(page);
    await page.waitForTimeout(700);
    const later = await readMaze(page);
    expect(later.classes).toEqual(frozen.classes);
    await expect(page.locator('#phaseLabel')).toHaveText('Paused');

    await page.click('#pauseBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Solved', { timeout: 45_000 });
    expectGoldIsShortest(await readMaze(page));
  });

  test('Clear Search removes the visualization but keeps the maze', async ({ page }) => {
    await openApp(page, { size: 11 });
    const before = await growMaze(page);
    await page.click('#instantBtn');
    await page.click('#clearSolutionBtn');
    const after = await readMaze(page);
    expect(after.right).toEqual(before.right);
    expect(after.bottom).toEqual(before.bottom);
    expect(cellsWithClass(after, 'solution')).toHaveLength(0);
    expect(cellsWithClass(after, 'visited')).toHaveLength(0);
  });

  test('a maze with no route says so, for both the animated and the instant solver', async ({ page }) => {
    await openApp(page, { size: 11 });
    await boxInFinish(page);

    await page.click('#instantBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('No Path');
    expect(cellsWithClass(await readMaze(page), 'solution')).toHaveLength(0);

    await page.click('#animateBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('No Path', { timeout: 30_000 });
    await expect(page.locator('#status')).toContainText('no path');
    expect(cellsWithClass(await readMaze(page), 'solution')).toHaveLength(0);

    // Still recoverable: controls are back and the maze can be fixed.
    await expect(page.locator('#generateBtn')).toBeEnabled();
    await toggleWall(page, 9, 10, 'bottom');
    await page.click('#instantBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Solved');
  });

  test('the explored count matches every reachable cell when no route exists', async ({ page }) => {
    await openApp(page, { size: 11 });
    await boxInFinish(page);
    await page.click('#instantBtn');
    const maze = await readMaze(page);
    expect(cellsWithClass(maze, 'visited').length).toBe(Number(await metric(page, 2)));
    // Every square but the boxed-in finish was explored.
    expect(cellsWithClass(maze, 'visited')).toHaveLength(11 * 11 - 1);
    await expect(cell(page, 10, 10)).not.toHaveClass(/visited/);
  });
});
