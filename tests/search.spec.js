const { test, expect } = require('@playwright/test');
const { openApp, readMaze, growMaze, shortestPath, cellsWithClass, toggleWall, metric, cell } = require('./helpers');

/** Gold cells must form one unbroken S→E corridor walk of the true shortest length. */
function expectGoldIsShortest(maze) {
  const gold = cellsWithClass(maze, 'solution');
  const expected = shortestPath(maze);
  expect(expected).not.toBeNull();
  expect(gold).toHaveLength(expected.length);

  const goldSet = new Set(gold.map(p => `${p.r},${p.c}`));
  for (const p of gold) expect(maze.walls[p.r][p.c]).toBe(false);
  expect(goldSet.has(`${maze.start.r},${maze.start.c}`)).toBe(true);
  expect(goldSet.has(`${maze.end.r},${maze.end.c}`)).toBe(true);

  // Walk the gold cells from S; each step must have exactly one unvisited gold neighbour.
  let cur = maze.start;
  const walked = new Set([`${cur.r},${cur.c}`]);
  while (!(cur.r === maze.end.r && cur.c === maze.end.c)) {
    const next = [[1, 0], [0, 1], [-1, 0], [0, -1]]
      .map(([dr, dc]) => ({ r: cur.r + dr, c: cur.c + dc }))
      .find(n => goldSet.has(`${n.r},${n.c}`) && !walked.has(`${n.r},${n.c}`));
    expect(next, 'gold path is continuous').toBeTruthy();
    walked.add(`${next.r},${next.c}`);
    cur = next;
  }
  expect(walked.size).toBe(gold.length);
}

/** Wall off E completely on a blank 11 × 11 grid. */
async function boxInFinish(page) {
  for (const [r, c] of [[8, 8], [8, 9], [8, 10], [9, 8], [10, 8]]) await toggleWall(page, r, c);
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

    // The wave never lights up a wall.
    let snapshot = await readMaze(page);
    for (const cls of ['frontier', 'visited', 'current']) {
      for (const p of cellsWithClass(snapshot, cls)) expect(snapshot.walls[p.r][p.c]).toBe(false);
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
    // A wall across most of row 5 forces the route around its open end.
    for (let c = 0; c <= 8; c++) await toggleWall(page, 5, c);
    await page.click('#instantBtn');
    const maze = await readMaze(page);
    expectGoldIsShortest(maze);
    expect(cellsWithClass(maze, 'solution').some(p => p.r === 5 && p.c >= 9)).toBe(true);
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
    expect(after.walls).toEqual(before.walls);
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
    await toggleWall(page, 8, 9);
    await page.click('#instantBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Solved');
  });

  test('the explored count matches every reachable cell when no route exists', async ({ page }) => {
    await openApp(page, { size: 11 });
    await boxInFinish(page);
    await page.click('#instantBtn');
    const maze = await readMaze(page);
    expect(cellsWithClass(maze, 'visited').length).toBe(Number(await metric(page, 2)));
    await expect(cell(page, 9, 9)).not.toHaveClass(/visited/);
  });
});
