const { test, expect } = require('@playwright/test');
const {
  openApp, readMaze, cell, cellCenter, toggleWall, edgePoint, cellsWithClass, setSize, wallCount
} = require('./helpers');

test.describe('Blank maze and editing', () => {
  test('loads with a visible S and F in the corners and no errors', async ({ page }) => {
    const errors = await openApp(page);
    const maze = await readMaze(page);

    expect(maze.size).toBe(15);
    expect(maze.start).toEqual({ r: 0, c: 0 });
    expect(maze.end).toEqual({ r: 14, c: 14 });
    expect(wallCount(maze)).toBe(0);
    await expect(cell(page, 0, 0)).toBeVisible();
    await expect(cell(page, 14, 14)).toBeVisible();
    // The markers spell Start and Finish, matching the buttons and legend.
    const marker = (r, c) => cell(page, r, c).evaluate(el => getComputedStyle(el, '::after').content);
    expect(await marker(0, 0)).toBe('"S"');
    expect(await marker(14, 14)).toBe('"F"');
    await expect(page.locator('#phaseLabel')).toHaveText('Ready');
    expect(errors).toEqual([]);
  });

  test('every size option builds a square grid of open squares', async ({ page }) => {
    await openApp(page);
    for (const size of [11, 15, 21, 25]) {
      await setSize(page, size);
      const maze = await readMaze(page);
      expect(maze.size).toBe(size);
      expect(maze.start).toEqual({ r: 0, c: 0 });
      expect(maze.end).toEqual({ r: size - 1, c: size - 1 });
      // One possible wall on every inner edge, none drawn yet.
      await expect(page.locator('#wallLayer line')).toHaveCount(2 * size * (size - 1));
      expect(wallCount(maze)).toBe(0);
    }
  });

  test('walls are thin lines between squares, inside a thicker outside wall', async ({ page }) => {
    await openApp(page);
    await toggleWall(page, 3, 4, 'right');

    const look = await page.evaluate(() => {
      const maze = document.getElementById('maze');
      const layer = document.getElementById('wallLayer');
      const line = layer.querySelector('line.on');
      const cellBox = maze.querySelector('.cell').getBoundingClientRect();
      const layerBox = layer.getBoundingClientRect();
      const mazeBox = maze.getBoundingClientRect();
      return {
        wall: parseFloat(getComputedStyle(line).strokeWidth),
        stroke: getComputedStyle(line).stroke,
        border: parseFloat(getComputedStyle(maze).borderTopWidth),
        cell: cellBox.width,
        layerLeft: layerBox.left - (mazeBox.left + maze.clientLeft),
        layerWidth: layerBox.width - maze.clientWidth,
        wallCells: maze.querySelectorAll('.cell.wall').length
      };
    });

    // A wall is a border, not a square: no square is ever painted as a wall.
    expect(look.wallCells).toBe(0);
    expect(look.wall).toBeGreaterThanOrEqual(2);
    expect(look.wall).toBeLessThan(look.cell * 0.2);
    expect(look.border).toBeGreaterThan(look.wall);
    expect(look.stroke).toBe('rgb(28, 43, 79)');
    // The wall layer lines up exactly with the squares.
    expect(Math.abs(look.layerLeft)).toBeLessThan(0.5);
    expect(Math.abs(look.layerWidth)).toBeLessThan(0.5);
  });

  test('tapping a grid line draws a wall and a second tap erases it', async ({ page }) => {
    await openApp(page);
    await toggleWall(page, 3, 4, 'right');
    let maze = await readMaze(page);
    expect(maze.right[3][4]).toBe(true);
    expect(wallCount(maze)).toBe(1);

    await toggleWall(page, 3, 4, 'bottom');
    maze = await readMaze(page);
    expect(maze.bottom[3][4]).toBe(true);
    expect(wallCount(maze)).toBe(2);

    await toggleWall(page, 3, 4, 'right');
    maze = await readMaze(page);
    expect(maze.right[3][4]).toBe(false);
    expect(maze.bottom[3][4]).toBe(true);
  });

  test('a tap inside a square picks the grid line nearest the finger', async ({ page }) => {
    await openApp(page);
    await page.locator('#maze').scrollIntoViewIfNeeded();
    const box = await cell(page, 6, 6).boundingBox();

    // Towards the left side of the square: the line between it and (6, 5).
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.45);
    // Towards the top: the line between it and (5, 6).
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.15);

    const maze = await readMaze(page);
    expect(maze.right[6][5]).toBe(true);
    expect(maze.bottom[5][6]).toBe(true);
    expect(wallCount(maze)).toBe(2);
  });

  test('the outside wall cannot be removed', async ({ page }) => {
    await openApp(page);
    await page.locator('#maze').scrollIntoViewIfNeeded();
    const box = await cell(page, 0, 7).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + 1);
    expect(wallCount(await readMaze(page))).toBe(0);
    await expect(page.locator('#status')).toContainText('outside wall is always there');
  });

  test('dragging along a grid line paints a run of walls, and dragging again erases it', async ({ page }) => {
    await openApp(page);
    await page.locator('#maze').scrollIntoViewIfNeeded();
    const from = await edgePoint(page, 4, 2, 'bottom');
    const to = await edgePoint(page, 4, 9, 'bottom');

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 20 });
    await page.mouse.up();

    let maze = await readMaze(page);
    for (let c = 2; c <= 9; c++) expect(maze.bottom[4][c], `wall under (4, ${c})`).toBe(true);
    // Crossing the lines in between never sprouts a stub across the stroke.
    expect(wallCount(maze)).toBe(8);

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 20 });
    await page.mouse.up();

    maze = await readMaze(page);
    expect(wallCount(maze)).toBe(0);
  });

  test('one stroke can turn a corner', async ({ page }) => {
    await openApp(page);
    await page.locator('#maze').scrollIntoViewIfNeeded();
    // Along the line under row 2 from column 2 to 5, then down the line right of column 5.
    const a = await edgePoint(page, 2, 2, 'bottom');
    const corner = await edgePoint(page, 2, 5, 'bottom');
    const box = await cell(page, 2, 5).boundingBox();
    const turn = { x: box.x + box.width, y: box.y + box.height };
    const down = await edgePoint(page, 6, 5, 'right');

    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(corner.x, corner.y, { steps: 12 });
    await page.mouse.move(turn.x, turn.y, { steps: 4 });
    await page.mouse.move(down.x, down.y, { steps: 16 });
    await page.mouse.up();

    const maze = await readMaze(page);
    for (let c = 2; c <= 5; c++) expect(maze.bottom[2][c]).toBe(true);
    for (let r = 3; r <= 6; r++) expect(maze.right[r][5]).toBe(true);
    // No overshoot past the corner.
    expect(wallCount(maze)).toBe(8);
  });

  test('moving the mouse after a cancelled stroke does not keep painting', async ({ page }) => {
    await openApp(page);
    await page.locator('#maze').scrollIntoViewIfNeeded();
    const a = await edgePoint(page, 7, 3, 'bottom');
    const b = await edgePoint(page, 7, 8, 'bottom');

    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.evaluate(() => {
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true }));
    });
    await page.mouse.up();
    await page.mouse.move(b.x, b.y, { steps: 10 });

    const maze = await readMaze(page);
    expect(maze.bottom[7].slice(4, 9).every(w => !w)).toBe(true);
  });

  test('start and finish can be moved to any square', async ({ page }) => {
    await openApp(page);
    await toggleWall(page, 4, 4, 'right');

    await page.click('#startBtn');
    await expect(page.locator('#startBtn')).toHaveClass(/active/);
    await cell(page, 4, 4).click();
    await page.click('#endBtn');
    await cell(page, 9, 6).click();

    const maze = await readMaze(page);
    expect(maze.start).toEqual({ r: 4, c: 4 });
    expect(maze.end).toEqual({ r: 9, c: 6 });
    // Moving a marker never adds or removes walls.
    expect(maze.right[4][4]).toBe(true);
    expect(wallCount(maze)).toBe(1);
    expect(cellsWithClass(maze, 'start')).toHaveLength(1);
    expect(cellsWithClass(maze, 'end')).toHaveLength(1);
    // Placing a marker returns to Walls mode.
    await expect(page.locator('#drawBtn')).toHaveClass(/active/);
  });

  test('a finger can draw walls and place the start', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'Touch runs on the iPad and iPhone projects');
    await openApp(page);
    await page.locator('#maze').scrollIntoViewIfNeeded();
    const from = await edgePoint(page, 3, 1, 'right');
    const to = await edgePoint(page, 7, 1, 'right');
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });

    await touch('touchStart', [{ ...from, id: 0 }]);
    for (let i = 1; i <= 12; i++) {
      await touch('touchMove', [{ x: from.x, y: from.y + (to.y - from.y) * i / 12, id: 0 }]);
    }
    await touch('touchEnd', []);

    let maze = await readMaze(page);
    for (let r = 3; r <= 7; r++) expect(maze.right[r][1]).toBe(true);
    expect(wallCount(maze)).toBe(5);

    // Chrome sometimes drops a tap that lands the instant after the drawing
    // finger lifts (no real finger is that quick), so tap again until the
    // tool is picked. Picking Start twice is harmless.
    await expect(async () => {
      await page.locator('#startBtn').tap();
      await expect(page.locator('#startBtn')).toHaveClass(/active/, { timeout: 500 });
    }).toPass({ timeout: 10000 });
    await page.locator('#maze').scrollIntoViewIfNeeded();
    const target = await cellCenter(page, 5, 5);
    await touch('touchStart', [{ ...target, id: 0 }]);
    await touch('touchEnd', []);
    maze = await readMaze(page);
    expect(maze.start).toEqual({ r: 5, c: 5 });
  });

  test('S and F can never share a square', async ({ page }) => {
    await openApp(page);

    await page.click('#endBtn');
    await cell(page, 0, 0).click();
    let maze = await readMaze(page);
    expect(maze.end).toEqual({ r: 14, c: 14 });
    await expect(page.locator('#status')).toContainText('That square is the start');

    await page.click('#startBtn');
    await cell(page, 14, 14).click();
    maze = await readMaze(page);
    expect(maze.start).toEqual({ r: 0, c: 0 });
    await expect(page.locator('#status')).toContainText('That square is the finish');
  });

  test('drawing a wall across the gold route clears it so gold never crosses a wall', async ({ page }) => {
    await openApp(page);
    await page.click('#instantBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Solved');

    // The route along a blank grid starts by leaving S; wall off that first step.
    let maze = await readMaze(page);
    const gold = cellsWithClass(maze, 'solution');
    const next = gold.find(p => Math.abs(p.r - maze.start.r) + Math.abs(p.c - maze.start.c) === 1);
    if (next.r === maze.start.r) await toggleWall(page, 0, 0, 'right');
    else await toggleWall(page, 0, 0, 'bottom');

    maze = await readMaze(page);
    expect(wallCount(maze)).toBe(1);
    expect(cellsWithClass(maze, 'solution')).toHaveLength(0);
    expect(cellsWithClass(maze, 'visited')).toHaveLength(0);
    await expect(page.locator('#status')).toContainText('old search was cleared');
  });

  test('Blank Grid wipes walls and restores S and F', async ({ page }) => {
    await openApp(page);
    await toggleWall(page, 2, 2, 'bottom');
    await page.click('#startBtn');
    await cell(page, 5, 5).click();
    await page.click('#blankBtn');

    const maze = await readMaze(page);
    expect(wallCount(maze)).toBe(0);
    expect(maze.start).toEqual({ r: 0, c: 0 });
    expect(maze.end).toEqual({ r: 14, c: 14 });
  });
});
