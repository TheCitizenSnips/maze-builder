const { test, expect } = require('@playwright/test');
const {
  openApp, readMaze, growMaze, shortestPath, makePointer, defaultPointerType,
  traceCells, metric, toggleWall, cellCenter, blankRoute, blocked
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
    if (i > 0) {
      const step = Math.abs(route[i].r - route[i - 1].r) + Math.abs(route[i].c - route[i - 1].c);
      expect(step, 'route moves one square at a time, never diagonally').toBe(1);
      expect(blocked(maze, route[i - 1], route[i]), 'route never crosses a wall').toBe(false);
    }
  }
  const ids = route.map(p => `${p.r},${p.c}`);
  expect(new Set(ids).size, 'route never loops back over itself').toBe(ids.length);
}

async function enterSolveMode(page) {
  // A freshly grown maze is already in solve mode.
  if (!/Stop Solving/.test(await page.locator('#userSolveBtn').innerText())) {
    await page.click('#userSolveBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Your Turn');
  }
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
    expect(await metric(page, 3)).toBe('21');

    await traceCells(page, blankRoute(11), { pointer });

    await expect(page.locator('#successSheet')).toBeVisible();
    await expect(page.locator('#successKicker')).toHaveText('Perfect Route');
    await expect(page.locator('#successEfficiency')).toHaveText('100%');
    await expect(page.locator('#successCells')).toHaveText('21');
    await expect(page.locator('#successBest')).toHaveText('21');
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

  test('a thin wall between two squares stops the line', async ({ page }) => {
    await toggleWall(page, 0, 3, 'right');
    await enterSolveMode(page);
    await traceCells(page, [0, 1, 2, 3, 4, 5, 6].map(c => ({ r: 0, c })), { pointer, keepDown: true });

    const route = await userRoute(page);
    expect(route).toEqual([{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }]);
    expectLegalRoute(route, await readMaze(page));
    await pointer.up();
  });

  test('a single quick flick along a corridor is not lost', async ({ page }) => {
    await enterSolveMode(page);
    const s = await cellCenter(page, 0, 0);
    const far = await cellCenter(page, 0, 7);
    await pointer.down(s.x, s.y);
    await pointer.move(far.x, far.y);

    const route = await userRoute(page);
    expect(route).toHaveLength(8);
    expectLegalRoute(route, await readMaze(page));
    await pointer.up();
  });

  test('a quick flick cannot jump over a wall', async ({ page }) => {
    for (let r = 0; r <= 9; r++) await toggleWall(page, r, 2, 'right');
    await enterSolveMode(page);
    const s = await cellCenter(page, 0, 0);
    const beyond = await cellCenter(page, 0, 6);
    await pointer.down(s.x, s.y);
    await pointer.move(beyond.x, beyond.y);

    const route = await userRoute(page);
    expect(route.every(p => p.c < 3)).toBe(true);
    expectLegalRoute(route, await readMaze(page));
    await pointer.up();
  });

  test('cutting a corner diagonally still follows the corridor', async ({ page }) => {
    await enterSolveMode(page);
    const s = await cellCenter(page, 0, 0);
    const diag = await cellCenter(page, 1, 1);
    await pointer.down(s.x, s.y);
    await pointer.move(diag.x, diag.y);

    const route = await userRoute(page);
    expect(route).toHaveLength(3);
    expect(route[2]).toEqual({ r: 1, c: 1 });
    expectLegalRoute(route, await readMaze(page));
    await pointer.up();
  });

  test('cutting a corner goes round a wall on the near side', async ({ page }) => {
    await toggleWall(page, 0, 0, 'right');
    await enterSolveMode(page);
    const s = await cellCenter(page, 0, 0);
    const diag = await cellCenter(page, 1, 1);
    await pointer.down(s.x, s.y);
    await pointer.move(diag.x, diag.y);

    const route = await userRoute(page);
    expect(route).toEqual([{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }]);
    expectLegalRoute(route, await readMaze(page));
    await pointer.up();
  });

  test('a diagonal flick cannot squeeze between two walls', async ({ page }) => {
    await toggleWall(page, 0, 0, 'right');
    await toggleWall(page, 1, 0, 'right');
    await enterSolveMode(page);
    const s = await cellCenter(page, 0, 0);
    const diag = await cellCenter(page, 1, 1);
    await pointer.down(s.x, s.y);
    await pointer.move(diag.x, diag.y);

    expect(await userRoute(page)).toEqual([{ r: 0, c: 0 }]);
    await pointer.up();
  });

  test('backtracking retracts the line but still counts as effort', async ({ page }) => {
    await enterSolveMode(page);
    const wander = [
      { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 },
      { r: 0, c: 2 }, { r: 0, c: 1 }
    ];
    await traceCells(page, wander, { pointer, keepDown: true });

    expect(await userRoute(page)).toEqual([{ r: 0, c: 0 }, { r: 0, c: 1 }]);
    expect(await metric(page, 2)).toBe('6'); // S + 3 forward + 2 back
    expect(await metric(page, 5)).toBe('2');

    // Finish along the best route from here: extra effort means under 100%.
    const rest = blankRoute(11).slice(1);
    await traceCells(page, rest, { pointer, alreadyDown: true });
    await expect(page.locator('#successSheet')).toBeVisible();
    await expect(page.locator('#successCells')).toHaveText('25'); // 6 so far + 19 more
    await expect(page.locator('#successEfficiency')).toHaveText('84%'); // 21 / 25
    await expect(page.locator('#successKicker')).toHaveText('Great Solve');
  });

  test('a finger wobbling on the line between two squares counts one step, not three', async ({ page }) => {
    await enterSolveMode(page);
    await traceCells(page, [{ r: 0, c: 0 }, { r: 0, c: 1 }], { pointer, keepDown: true });
    expect(await metric(page, 2)).toBe('2');

    // Rest on the edge between (0,1) and (0,2), wobbling a little either side.
    const box = await page.locator('#maze .cell[data-r="0"][data-c="2"]').boundingBox();
    const edgeX = box.x;
    const y = box.y + box.height / 2;
    const wobble = box.width * 0.12;
    for (const dx of [-wobble, wobble, -wobble, wobble, -wobble, wobble]) {
      await pointer.move(edgeX + dx, y);
    }
    // Then carry on into the middle of (0,2).
    const mid = await cellCenter(page, 0, 2);
    await pointer.move(mid.x, mid.y);

    expect(await userRoute(page)).toEqual([{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }]);
    expect(await metric(page, 2)).toBe('3');
    expect(await metric(page, 5)).toBe('0');
    await pointer.up();
  });

  test('a line drawn close to the side of a corridor counts each square once', async ({ page }) => {
    await enterSolveMode(page);
    const start = await cellCenter(page, 0, 0);
    const box = await page.locator('#maze .cell[data-r="0"][data-c="0"]').boundingBox();
    // Run along the top row with the finger hugging, and sometimes just
    // crossing, the line into the row below.
    const edgeY = box.y + box.height;
    await page.locator('#maze').scrollIntoViewIfNeeded();
    await pointer.down(start.x, start.y);
    const end = await cellCenter(page, 0, 5);
    const steps = 40;
    for (let i = 1; i <= steps; i++) {
      const x = start.x + (end.x - start.x) * i / steps;
      const y = edgeY + (i % 2 ? 1 : -1) * box.height * 0.1;
      await pointer.move(x, y);
    }
    await pointer.move(end.x, end.y);

    expect(await userRoute(page)).toEqual([0, 1, 2, 3, 4, 5].map(c => ({ r: 0, c })));
    expect(await metric(page, 2)).toBe('6');
    expect(await metric(page, 5)).toBe('0');
    await pointer.up();
  });

  test('the line cannot loop back through a square it already used', async ({ page }) => {
    await enterSolveMode(page);
    await traceCells(page, [
      { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }, { r: 1, c: 0 }, { r: 0, c: 0 }
    ], { pointer, keepDown: true });
    expect(await userRoute(page)).toEqual([{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }, { r: 1, c: 0 }]);
    await pointer.up();
  });

  test('lifting pauses the line but the clock keeps running until the finish', async ({ page }) => {
    await enterSolveMode(page);
    const route = blankRoute(11);
    const startedAt = Date.now();
    await traceCells(page, route.slice(0, 6), { pointer });

    await expect(page.locator('#phaseLabel')).toHaveText('Paused');
    await expect(page.locator('#status')).toContainText('Touch the end of your blue line');
    expect(await userRoute(page)).toHaveLength(6);

    const liftedAt = parseFloat(await metric(page, 1));
    await page.waitForTimeout(1500);
    expect(parseFloat(await metric(page, 1)), 'the clock ticks while lifted').toBeGreaterThanOrEqual(liftedAt + 1.2);

    await traceCells(page, route.slice(5), { pointer });
    await expect(page.locator('#successSheet')).toBeVisible();
    const wallSeconds = (Date.now() - startedAt) / 1000;
    await expect(page.locator('#successEfficiency')).toHaveText('100%');

    // The 1.5s with the finger up is on the clock too.
    const total = parseFloat(await page.locator('#successTime').textContent());
    expect(total).toBeGreaterThanOrEqual(liftedAt + 1.5);
    expect(total).toBeLessThanOrEqual(wallSeconds + 0.2);
  });

  test('resume forgives a touch that lands just beside the end of the line', async ({ page }) => {
    await enterSolveMode(page);
    await traceCells(page, blankRoute(11).slice(0, 4), { pointer });
    await expect(page.locator('#phaseLabel')).toHaveText('Paused');

    const endPt = await cellCenter(page, 0, 3);
    const next = await cellCenter(page, 0, 4);
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

  test('solving locks nothing, and picking an editing tool ends the attempt', async ({ page }) => {
    await enterSolveMode(page);
    for (const id of ['#drawBtn', '#startBtn', '#endBtn', '#generateBtn', '#animateBtn', '#instantBtn', '#blankBtn', '#sizeSelect', '#clearSolutionBtn']) {
      await expect(page.locator(id)).toBeEnabled();
    }
    // No editing tool is lit while drawing.
    await expect(page.locator('.edit-tools .active')).toHaveCount(0);

    await traceCells(page, blankRoute(11).slice(0, 4), { pointer });
    await page.click('#drawBtn');
    await expect(page.locator('#userSolveBtn')).toHaveText(/Solve It Yourself/);
    await expect(page.locator('#drawBtn')).toHaveClass(/active/);
    expect(await userRoute(page)).toEqual([]);
  });

  test('Clear Search during a solve wipes the line and keeps solve mode', async ({ page }) => {
    await enterSolveMode(page);
    await traceCells(page, blankRoute(11).slice(0, 5), { pointer });
    await page.click('#clearSolutionBtn');
    expect(await userRoute(page)).toEqual([]);
    await expect(page.locator('#phaseLabel')).toHaveText('Your Turn');
    await expect(page.locator('#userSolveBtn')).toHaveText(/Stop Solving/);
  });

  test('Try Again keeps solving; Done ends solving so the maze can be edited', async ({ page }) => {
    await enterSolveMode(page);
    await traceCells(page, blankRoute(11), { pointer });
    await expect(page.locator('#successSheet')).toBeVisible();

    await page.click('#successAgainBtn');
    await expect(page.locator('#successSheet')).toBeHidden();
    await expect(page.locator('#userSolveBtn')).toHaveText(/Stop Solving/);
    expect(await userRoute(page)).toEqual([]);

    await traceCells(page, blankRoute(11), { pointer });
    await expect(page.locator('#successSheet')).toBeVisible();
    await page.click('#successCloseBtn');
    await expect(page.locator('#successSheet')).toBeHidden();
    await expect(page.locator('#userSolveBtn')).toHaveText(/Solve It Yourself/);
    await expect(page.locator('#phaseLabel')).toHaveText('Ready');
    await expect(page.locator('#drawBtn')).toHaveClass(/active/);
    expect(await userRoute(page)).toEqual([]);

    // Solve It Yourself again starts a fresh attempt from S.
    await page.click('#userSolveBtn');
    await traceCells(page, blankRoute(11).slice(0, 3), { pointer, keepDown: true });
    await expect(page.locator('#phaseLabel')).toHaveText('Tracing');
    expect(await userRoute(page)).toHaveLength(3);
    await pointer.up();
  });

  test('leaving solve mode right after finishing never pops the result sheet later', async ({ page }) => {
    await enterSolveMode(page);
    await traceCells(page, blankRoute(11), { pointer });
    // Press Stop inside the short pause before the sheet appears. A plain
    // page.click can take longer than that pause on a busy machine.
    await page.evaluate(() => document.getElementById('userSolveBtn').click());
    await expect(page.locator('#userSolveBtn')).toHaveText(/Solve It Yourself/);
    await page.waitForTimeout(900);
    await expect(page.locator('#successSheet')).toBeHidden();
  });

  test('a maze with no route does not pretend it can be solved', async ({ page }) => {
    await toggleWall(page, 10, 9, 'right');
    await toggleWall(page, 9, 10, 'bottom');
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
