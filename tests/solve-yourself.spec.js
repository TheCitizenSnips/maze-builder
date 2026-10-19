const { test, expect } = require('@playwright/test');
const {
  openApp, readMaze, growMaze, shortestPath, makePointer, defaultPointerType,
  traceCells, metric, toggleWall, cellCenter, blankRoute, cellsWithClass
} = require('./helpers');

/** The route the player has drawn, read back from the SVG overlay. */
async function userRoute(page) {
  return page.evaluate(() => {
    const raw = document.getElementById('userPathLine').getAttribute('points').trim();
    if (!raw) return [];
    const cells = [...document.getElementById('maze').children];
    return raw.split(/\s+/).map(pair => {
      const [x, y] = pair.split(',').map(Number);
      const el = cells.find(c =>
        Math.abs(c.offsetLeft + c.offsetWidth / 2 - x) < 0.5 &&
        Math.abs(c.offsetTop + c.offsetHeight / 2 - y) < 0.5);
      return el ? { r: Number(el.dataset.r), c: Number(el.dataset.c) } : null;
    });
  });
}

function expectLegalRoute(route, maze) {
  for (let i = 0; i < route.length; i++) {
    expect(route[i], 'every route point sits on a cell').toBeTruthy();
    expect(maze.walls[route[i].r][route[i].c], 'route never enters a wall').toBe(false);
    if (i > 0) {
      const step = Math.abs(route[i].r - route[i - 1].r) + Math.abs(route[i].c - route[i - 1].c);
      expect(step, 'route moves one square at a time, never diagonally').toBe(1);
    }
  }
  const ids = route.map(p => `${p.r},${p.c}`);
  expect(new Set(ids).size, 'route never loops back over itself').toBe(ids.length);
}

async function enterSolveMode(page) {
  await page.click('#userSolveBtn');
  await expect(page.locator('#phaseLabel')).toHaveText('Your Turn');
  await expect(page.locator('#userSolveBtn')).toHaveText(/Stop Solving/);
  // On iPhone the maze sits below the controls.
  await page.locator('#maze').scrollIntoViewIfNeeded();
}

test.describe('Solve It Yourself', () => {
  let pointer;

  test.beforeEach(async ({ page }, testInfo) => {
    await openApp(page, { size: 11 });
    pointer = await makePointer(page, defaultPointerType(testInfo));
  });

  test('the shortest route scores a Perfect Route at 100%', async ({ page }) => {
    await enterSolveMode(page);
    expect(await metric(page, 3)).toBe('17');

    await traceCells(page, blankRoute(11), { pointer });

    await expect(page.locator('#successSheet')).toBeVisible();
    await expect(page.locator('#successKicker')).toHaveText('Perfect Route');
    await expect(page.locator('#successEfficiency')).toHaveText('100%');
    await expect(page.locator('#successCells')).toHaveText('17');
    await expect(page.locator('#successBest')).toHaveText('17');
    await expect(page.locator('#successTime')).toHaveText(/^\d+\.\ds$/);
    await expect(page.locator('#userPathOverlay')).toHaveClass(/success/);
    await expect(page.locator('#phaseLabel')).toHaveText('Complete');
    expect(page.mazeErrors).toEqual([]);
  });

  test('following the computer’s shortest path through a grown maze scores 100%', async ({ page }) => {
    const maze = await growMaze(page);
    await enterSolveMode(page);
    const best = shortestPath(maze);
    expect(await metric(page, 3)).toBe(String(best.length));

    await traceCells(page, best, { pointer });
    await expect(page.locator('#successEfficiency')).toHaveText('100%');
    expectLegalRoute(await userRoute(page), maze);
  });

  test('the line must start on S', async ({ page }) => {
    await enterSolveMode(page);
    await traceCells(page, [{ r: 4, c: 4 }, { r: 4, c: 5 }, { r: 4, c: 6 }], { pointer });
    await expect(page.locator('#status')).toContainText('Start your line on S');
    expect(await userRoute(page)).toEqual([]);
  });

  test('walls stop the line', async ({ page }) => {
    await toggleWall(page, 1, 4);
    await enterSolveMode(page);
    await traceCells(page, [1, 2, 3, 4, 5, 6].map(c => ({ r: 1, c })), { pointer, keepDown: true });

    const route = await userRoute(page);
    expect(route).toEqual([{ r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }]);
    expectLegalRoute(route, await readMaze(page));
    await pointer.up();
  });

  test('a single quick flick along a corridor is not lost', async ({ page }) => {
    await enterSolveMode(page);
    const s = await cellCenter(page, 1, 1);
    const far = await cellCenter(page, 1, 8);
    await pointer.down(s.x, s.y);
    await pointer.move(far.x, far.y);

    const route = await userRoute(page);
    expect(route).toHaveLength(8);
    expectLegalRoute(route, await readMaze(page));
    await pointer.up();
  });

  test('a quick flick cannot jump over a wall', async ({ page }) => {
    for (let r = 0; r <= 9; r++) await toggleWall(page, r, 3);
    await enterSolveMode(page);
    const s = await cellCenter(page, 1, 1);
    const beyond = await cellCenter(page, 1, 6);
    await pointer.down(s.x, s.y);
    await pointer.move(beyond.x, beyond.y);

    const route = await userRoute(page);
    expect(route.every(p => p.c < 3)).toBe(true);
    expectLegalRoute(route, await readMaze(page));
    await pointer.up();
  });

  test('cutting a corner diagonally still follows the corridor', async ({ page }) => {
    await enterSolveMode(page);
    const s = await cellCenter(page, 1, 1);
    const diag = await cellCenter(page, 2, 2);
    await pointer.down(s.x, s.y);
    await pointer.move(diag.x, diag.y);

    const route = await userRoute(page);
    expect(route).toHaveLength(3);
    expect(route[2]).toEqual({ r: 2, c: 2 });
    expectLegalRoute(route, await readMaze(page));
    await pointer.up();
  });

  test('backtracking retracts the line but still counts as effort', async ({ page }) => {
    await enterSolveMode(page);
    const wander = [
      { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }, { r: 1, c: 4 },
      { r: 1, c: 3 }, { r: 1, c: 2 }
    ];
    await traceCells(page, wander, { pointer, keepDown: true });

    expect(await userRoute(page)).toEqual([{ r: 1, c: 1 }, { r: 1, c: 2 }]);
    expect(await metric(page, 2)).toBe('6'); // S + 3 forward + 2 back
    expect(await metric(page, 5)).toBe('2');

    // Finish along the best route from here: extra effort means under 100%.
    const rest = blankRoute(11).slice(1);
    await traceCells(page, [{ r: 1, c: 2 }, ...rest], { pointer, alreadyDown: true });
    await expect(page.locator('#successSheet')).toBeVisible();
    await expect(page.locator('#successCells')).toHaveText('21');
    await expect(page.locator('#successEfficiency')).toHaveText('81%');
    await expect(page.locator('#successKicker')).toHaveText('Great Solve');
  });

  test('the line cannot loop back through a square it already used', async ({ page }) => {
    await enterSolveMode(page);
    await traceCells(page, [
      { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 2 }, { r: 2, c: 1 }, { r: 1, c: 1 }
    ], { pointer, keepDown: true });
    expect(await userRoute(page)).toEqual([{ r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 2 }, { r: 2, c: 1 }]);
    await pointer.up();
  });

  test('lifting pauses the attempt and the clock, then resumes from the end of the line', async ({ page }) => {
    await enterSolveMode(page);
    const route = blankRoute(11);
    await traceCells(page, route.slice(0, 6), { pointer });

    await expect(page.locator('#phaseLabel')).toHaveText('Paused');
    await expect(page.locator('#status')).toContainText('Touch the end of your blue line');
    expect(await userRoute(page)).toHaveLength(6);

    const pausedAt = parseFloat(await metric(page, 1));
    await page.waitForTimeout(1500);
    expect(parseFloat(await metric(page, 1))).toBe(pausedAt);

    const resumedAt = Date.now();
    await traceCells(page, route.slice(5), { pointer });
    await expect(page.locator('#successSheet')).toBeVisible();
    const tracingSeconds = (Date.now() - resumedAt) / 1000;
    await expect(page.locator('#successEfficiency')).toHaveText('100%');

    // The 1.5s pause is not on the clock: only the time spent drawing is.
    const total = parseFloat(await page.locator('#successTime').textContent());
    expect(total).toBeGreaterThanOrEqual(pausedAt);
    expect(total).toBeLessThanOrEqual(pausedAt + tracingSeconds + 0.2);
  });

  test('resume forgives a touch that lands just beside the end of the line', async ({ page }) => {
    await enterSolveMode(page);
    await traceCells(page, blankRoute(11).slice(0, 4), { pointer });
    await expect(page.locator('#phaseLabel')).toHaveText('Paused');

    const endPt = await cellCenter(page, 1, 4);
    const next = await cellCenter(page, 1, 5);
    const offset = (next.x - endPt.x) * 0.65;
    await pointer.down(endPt.x + offset, endPt.y);
    await expect(page.locator('#phaseLabel')).toHaveText('Tracing');
    await pointer.up();
  });

  test('touching somewhere else while paused explains how to continue and keeps the line', async ({ page }) => {
    await enterSolveMode(page);
    await traceCells(page, blankRoute(11).slice(0, 4), { pointer });
    await traceCells(page, [{ r: 7, c: 7 }], { pointer });
    await expect(page.locator('#status')).toContainText('white dot at the end of your blue line');
    expect(await userRoute(page)).toHaveLength(4);
  });

  test('the maze does not move when the line is lifted, so resume touches land', async ({ page }) => {
    const maze = await growMaze(page);
    await enterSolveMode(page);
    const box = () => page.locator('#maze').boundingBox();
    const before = await box();

    const best = shortestPath(maze);
    await traceCells(page, best.slice(0, 4), { pointer, keepDown: true });
    expect(await box()).toEqual(before);
    await pointer.up();
    await expect(page.locator('#phaseLabel')).toHaveText('Paused');
    expect(await box()).toEqual(before);

    await traceCells(page, [{ r: maze.size - 1, c: 0 }], { pointer });
    expect(await box()).toEqual(before);

    await traceCells(page, best.slice(3), { pointer });
    await expect(page.locator('#successEfficiency')).toHaveText('100%');
  });

  test('editing is locked while solving and Stop Solving unlocks it', async ({ page }) => {
    await enterSolveMode(page);
    for (const id of ['#drawBtn', '#startBtn', '#endBtn', '#generateBtn', '#animateBtn', '#instantBtn', '#blankBtn', '#sizeSelect']) {
      await expect(page.locator(id)).toBeDisabled();
    }
    await expect(page.locator('#clearSolutionBtn')).toBeEnabled();

    await page.click('#userSolveBtn');
    await expect(page.locator('#userSolveBtn')).toHaveText(/Solve It Yourself/);
    await expect(page.locator('#generateBtn')).toBeEnabled();
  });

  test('Clear Search during a solve wipes the line and keeps solve mode', async ({ page }) => {
    await enterSolveMode(page);
    await traceCells(page, blankRoute(11).slice(0, 5), { pointer });
    await page.click('#clearSolutionBtn');
    expect(await userRoute(page)).toEqual([]);
    await expect(page.locator('#phaseLabel')).toHaveText('Your Turn');
    await expect(page.locator('#drawBtn')).toBeDisabled();
  });

  test('Try Again and Done both work, and touching S after Done starts a fresh attempt', async ({ page }) => {
    await enterSolveMode(page);
    await traceCells(page, blankRoute(11), { pointer });
    await expect(page.locator('#successSheet')).toBeVisible();

    await page.click('#successAgainBtn');
    await expect(page.locator('#successSheet')).toBeHidden();
    expect(await userRoute(page)).toEqual([]);

    await traceCells(page, blankRoute(11), { pointer });
    await expect(page.locator('#successSheet')).toBeVisible();
    await page.click('#successCloseBtn');
    await expect(page.locator('#successSheet')).toBeHidden();
    expect(await userRoute(page)).toHaveLength(17);

    await traceCells(page, blankRoute(11).slice(0, 3), { pointer, keepDown: true });
    await expect(page.locator('#phaseLabel')).toHaveText('Tracing');
    expect(await userRoute(page)).toHaveLength(3);
    await pointer.up();
  });

  test('leaving solve mode right after finishing never pops the result sheet later', async ({ page }) => {
    await enterSolveMode(page);
    await traceCells(page, blankRoute(11), { pointer });
    await page.click('#userSolveBtn');
    await page.waitForTimeout(900);
    await expect(page.locator('#successSheet')).toBeHidden();
  });

  test('a maze with no route does not pretend it can be solved', async ({ page }) => {
    for (const [r, c] of [[8, 8], [8, 9], [8, 10], [9, 8], [10, 8]]) await toggleWall(page, r, c);
    await page.click('#userSolveBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('No Path');
    await expect(page.locator('#userSolveBtn')).toHaveText(/Solve It Yourself/);
    await expect(page.locator('#generateBtn')).toBeEnabled();
  });
});

test.describe('Solve It Yourself with touch and Apple Pencil', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Uses Chromium DevTools input for pen and multi-touch');

  test('Apple Pencil input is recognised and can solve the maze', async ({ page }) => {
    await openApp(page, { size: 11 });
    const pen = await makePointer(page, 'pen');
    await enterSolveMode(page);
    await traceCells(page, blankRoute(11).slice(0, 3), { pointer: pen, keepDown: true });
    await expect(page.locator('#status')).toContainText('Apple Pencil');
    await traceCells(page, blankRoute(11).slice(2), { pointer: pen, alreadyDown: true });
    await expect(page.locator('#successEfficiency')).toHaveText('100%');
  });

  test('finger input can solve the maze', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'Touch runs on the iPad and iPhone projects');
    await openApp(page, { size: 11 });
    const finger = await makePointer(page, 'touch');
    await enterSolveMode(page);
    await traceCells(page, blankRoute(11), { pointer: finger });
    await expect(page.locator('#successEfficiency')).toHaveText('100%');
  });

  test('a second finger or resting palm does not interrupt the line', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'Touch runs on the iPad and iPhone projects');
    await openApp(page, { size: 11 });
    const { cdp } = await makePointer(page, 'touch');
    await enterSolveMode(page);

    const route = blankRoute(11);
    await page.locator('#maze').scrollIntoViewIfNeeded();
    const pts = [];
    for (const p of route) pts.push(await cellCenter(page, p.r, p.c));
    const palm = await cellCenter(page, 8, 2);
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });

    await touch('touchStart', [{ ...pts[0], id: 1 }]);
    for (let i = 1; i <= 5; i++) await touch('touchMove', [{ ...pts[i], id: 1 }]);

    // A palm lands, drags a little and lifts while the first finger keeps going.
    await touch('touchStart', [{ ...pts[5], id: 1 }, { ...palm, id: 2 }]);
    await touch('touchMove', [{ ...pts[6], id: 1 }, { x: palm.x + 20, y: palm.y, id: 2 }]);
    // Leaving a point out of the next event lifts it (the palm here).
    await touch('touchMove', [{ ...pts[6], id: 1 }]);
    await expect(page.locator('#phaseLabel')).toHaveText('Tracing');

    for (let i = 7; i < pts.length; i++) await touch('touchMove', [{ ...pts[i], id: 1 }]);
    await touch('touchEnd', []);
    await expect(page.locator('#successEfficiency')).toHaveText('100%');
  });
});
