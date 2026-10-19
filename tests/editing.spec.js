const { test, expect } = require('@playwright/test');
const { openApp, readMaze, cell, cellCenter, toggleWall, cellsWithClass, setSize } = require('./helpers');

test.describe('Blank maze and editing', () => {
  test('loads with a visible S and E and no errors', async ({ page }) => {
    const errors = await openApp(page);
    const maze = await readMaze(page);

    expect(maze.size).toBe(15);
    expect(maze.start).toEqual({ r: 1, c: 1 });
    expect(maze.end).toEqual({ r: 13, c: 13 });
    await expect(cell(page, 1, 1)).toBeVisible();
    await expect(cell(page, 13, 13)).toBeVisible();
    await expect(page.locator('#phaseLabel')).toHaveText('Ready');
    expect(errors).toEqual([]);
  });

  test('every size option builds a square grid', async ({ page }) => {
    await openApp(page);
    for (const size of [11, 15, 21, 25]) {
      await setSize(page, size);
      const maze = await readMaze(page);
      expect(maze.size).toBe(size);
      expect(maze.start).toEqual({ r: 1, c: 1 });
      expect(maze.end).toEqual({ r: size - 2, c: size - 2 });
    }
  });

  test('tap draws a wall and a second tap erases it', async ({ page }) => {
    await openApp(page);
    await toggleWall(page, 3, 4);
    await expect(cell(page, 3, 4)).toHaveClass(/\bwall\b/);
    await toggleWall(page, 3, 4);
    await expect(cell(page, 3, 4)).not.toHaveClass(/\bwall\b/);
  });

  test('dragging paints a row of walls, and dragging again erases it', async ({ page }) => {
    await openApp(page);
    await page.locator('#maze').scrollIntoViewIfNeeded();
    const from = await cellCenter(page, 5, 2);
    const to = await cellCenter(page, 5, 9);

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 20 });
    await page.mouse.up();

    let maze = await readMaze(page);
    for (let c = 2; c <= 9; c++) expect(maze.walls[5][c]).toBe(true);

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 20 });
    await page.mouse.up();

    maze = await readMaze(page);
    for (let c = 2; c <= 9; c++) expect(maze.walls[5][c]).toBe(false);
  });

  test('moving the mouse after a cancelled stroke does not keep painting', async ({ page }) => {
    await openApp(page);
    await page.locator('#maze').scrollIntoViewIfNeeded();
    const a = await cellCenter(page, 7, 3);
    const b = await cellCenter(page, 7, 8);

    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.evaluate(() => {
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true }));
    });
    await page.mouse.up();
    await page.mouse.move(b.x, b.y, { steps: 10 });

    const maze = await readMaze(page);
    expect(maze.walls[7].slice(4, 9).every(w => !w)).toBe(true);
  });

  test('S and E cannot be painted over with walls', async ({ page }) => {
    await openApp(page);
    await toggleWall(page, 1, 1);
    await toggleWall(page, 13, 13);
    const maze = await readMaze(page);
    expect(maze.walls[1][1]).toBe(false);
    expect(maze.walls[13][13]).toBe(false);
  });

  test('start and finish can be moved, and moving onto a wall clears it', async ({ page }) => {
    await openApp(page);
    await toggleWall(page, 4, 4);
    await toggleWall(page, 9, 6);

    await page.click('#startBtn');
    await expect(page.locator('#startBtn')).toHaveClass(/active/);
    await cell(page, 4, 4).click();
    await page.click('#endBtn');
    await cell(page, 9, 6).click();

    const maze = await readMaze(page);
    expect(maze.start).toEqual({ r: 4, c: 4 });
    expect(maze.end).toEqual({ r: 9, c: 6 });
    expect(maze.walls[4][4]).toBe(false);
    expect(maze.walls[9][6]).toBe(false);
    expect(cellsWithClass(maze, 'start')).toHaveLength(1);
    expect(cellsWithClass(maze, 'end')).toHaveLength(1);
    // Placing a marker returns to Walls mode.
    await expect(page.locator('#drawBtn')).toHaveClass(/active/);
  });

  test('S and E can never share a square', async ({ page }) => {
    await openApp(page);

    await page.click('#endBtn');
    await cell(page, 1, 1).click();
    let maze = await readMaze(page);
    expect(maze.end).toEqual({ r: 13, c: 13 });
    await expect(page.locator('#status')).toContainText('That square is the start');

    await page.click('#startBtn');
    await cell(page, 13, 13).click();
    maze = await readMaze(page);
    expect(maze.start).toEqual({ r: 1, c: 1 });
    await expect(page.locator('#status')).toContainText('That square is the finish');
  });

  test('drawing a wall after a solve clears the old route so gold never crosses a wall', async ({ page }) => {
    await openApp(page);
    await page.click('#instantBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Solved');

    let maze = await readMaze(page);
    const gold = cellsWithClass(maze, 'solution').find(p =>
      !(p.r === maze.start.r && p.c === maze.start.c) && !(p.r === maze.end.r && p.c === maze.end.c));
    await toggleWall(page, gold.r, gold.c);

    maze = await readMaze(page);
    expect(maze.walls[gold.r][gold.c]).toBe(true);
    expect(cellsWithClass(maze, 'solution')).toHaveLength(0);
    expect(cellsWithClass(maze, 'visited')).toHaveLength(0);
    await expect(page.locator('#status')).toContainText('old search was cleared');
  });

  test('Blank Grid wipes walls and restores S and E', async ({ page }) => {
    await openApp(page);
    await toggleWall(page, 2, 2);
    await page.click('#startBtn');
    await cell(page, 5, 5).click();
    await page.click('#blankBtn');

    const maze = await readMaze(page);
    expect(maze.walls.flat().some(Boolean)).toBe(false);
    expect(maze.start).toEqual({ r: 1, c: 1 });
    expect(maze.end).toEqual({ r: 13, c: 13 });
  });
});
