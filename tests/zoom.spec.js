const { test, expect } = require('@playwright/test');
const { openApp, readMaze, wallCount, metric, cell, cellCenter } = require('./helpers');

// Zoom and pan: the maze fits its window by default; a pinch or the zoom
// buttons make the squares bigger inside the same window, and two fingers
// move it around. One finger keeps drawing, solving and editing.

async function cellWidth(page) {
  return (await cell(page, 0, 0).boundingBox()).width;
}

async function viewportBox(page) {
  return page.locator('#mazeViewport').boundingBox();
}

async function scrollPos(page) {
  return page.locator('#mazeViewport').evaluate(el => ({ x: el.scrollLeft, y: el.scrollTop }));
}

/**
 * Several fingers at once through Chromium's DevTools input. Every call
 * lists all the fingers on the glass, as a real touch screen reports them.
 */
async function makeFingers(page) {
  const cdp = await page.context().newCDPSession(page);
  const down = new Map();
  const send = type => cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: [...down].map(([id, p]) => ({ id, x: p.x, y: p.y }))
  });
  return {
    async press(id, x, y) { down.set(id, { x, y }); await send('touchStart'); },
    async move(id, x, y) { down.set(id, { x, y }); await send('touchMove'); },
    async lift(id) { down.delete(id); await send('touchEnd'); },
    /** Two fingers from a and b gliding to a2 and b2. */
    async glide(a, b, a2, b2, steps = 8) {
      for (let s = 1; s <= steps; s++) {
        down.set(1, { x: a.x + (a2.x - a.x) * s / steps, y: a.y + (a2.y - a.y) * s / steps });
        down.set(2, { x: b.x + (b2.x - b.x) * s / steps, y: b.y + (b2.y - b.y) * s / steps });
        await send('touchMove');
      }
    }
  };
}

/** Pinch apart around the middle of the maze window, then lift both fingers. */
async function pinchOpen(page, fingers, spread = 80) {
  const box = await viewportBox(page);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await fingers.press(1, cx - 20, cy);
  await fingers.press(2, cx + 20, cy);
  await fingers.glide({ x: cx - 20, y: cy }, { x: cx + 20, y: cy }, { x: cx - 20 - spread, y: cy }, { x: cx + 20 + spread, y: cy });
  await fingers.lift(2);
  await fingers.lift(1);
}

test.describe('Zoom and pan', () => {
  test('the maze fits by default, and the buttons zoom in, out and back to fit', async ({ page }) => {
    await openApp(page, { size: 25 });
    await page.locator('#mazeViewport').scrollIntoViewIfNeeded();

    await expect(page.locator('#zoomOutBtn')).toBeDisabled();
    await expect(page.locator('#zoomFitBtn')).toBeDisabled();
    await expect(page.locator('#zoomInBtn')).toBeEnabled();
    const fitted = await cellWidth(page);
    const view = await viewportBox(page);
    const maze = await page.locator('#maze').boundingBox();
    expect(maze.height).toBeLessThanOrEqual(view.height + 0.5);

    await page.click('#zoomInBtn');
    expect(await cellWidth(page)).toBeCloseTo(fitted * 1.5, 0);
    await expect(page.locator('#zoomFitBtn')).toBeEnabled();
    await expect(page.locator('#zoomHint')).toHaveText(/two fingers/);

    // The window stays the same size; the page never scrolls sideways.
    const zoomedView = await viewportBox(page);
    expect(zoomedView.width).toBeCloseTo(view.width, 0);
    expect(zoomedView.height).toBeCloseTo(view.height, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    await page.click('#zoomInBtn');
    expect(await cellWidth(page)).toBeCloseTo(fitted * 2.25, 0);
    await page.click('#zoomOutBtn');
    expect(await cellWidth(page)).toBeCloseTo(fitted * 1.5, 0);

    await page.click('#zoomFitBtn');
    expect(await cellWidth(page)).toBeCloseTo(fitted, 1);
    expect(await scrollPos(page)).toEqual({ x: 0, y: 0 });
    await expect(page.locator('#zoomFitBtn')).toBeDisabled();
    expect(page.mazeErrors).toEqual([]);
  });

  test('a new grid size starts from the whole maze again', async ({ page }) => {
    await openApp(page, { size: 15 });
    await page.click('#zoomInBtn');
    await expect(page.locator('#zoomFitBtn')).toBeEnabled();
    await page.selectOption('#sizeSelect', '21');
    await expect(page.locator('#zoomFitBtn')).toBeDisabled();
    await expect(page.locator('#mazeViewport')).not.toHaveClass(/zoomed/);
  });

  test('walls drawn while zoomed land on the line under the pointer', async ({ page }) => {
    await openApp(page, { size: 11 });
    await page.click('#zoomInBtn');
    await page.click('#zoomInBtn');
    await page.locator('#mazeViewport').scrollIntoViewIfNeeded();

    // A square near the middle of the window, so it is on screen.
    const view = await viewportBox(page);
    const hit = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y).closest('.cell');
      return { r: Number(el.dataset.r), c: Number(el.dataset.c) };
    }, { x: view.x + view.width / 2, y: view.y + view.height / 2 });
    const box = await cell(page, hit.r, hit.c).boundingBox();
    await page.mouse.click(box.x + box.width, box.y + box.height / 2);

    const maze = await readMaze(page);
    expect(maze.right[hit.r][hit.c]).toBe(true);
    expect(wallCount(maze)).toBe(1);
  });

  test('printing shows the whole maze however far it is zoomed', async ({ page }) => {
    await openApp(page, { size: 15 });
    await page.click('#zoomInBtn');
    await page.emulateMedia({ media: 'print' });
    const fits = await page.evaluate(() => {
      const view = document.getElementById('mazeViewport').getBoundingClientRect();
      const maze = document.getElementById('maze').getBoundingClientRect();
      return maze.width <= view.width + 0.5 && maze.height <= view.height + 0.5;
    });
    expect(fits).toBe(true);
    await expect(page.locator('.zoom-bar')).toBeHidden();
  });

  test('Ctrl + scroll (a trackpad pinch) zooms on a computer', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await openApp(page, { size: 21 });
    const fitted = await cellWidth(page);
    const view = await viewportBox(page);
    await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -60);
    await page.keyboard.up('Control');
    await expect.poll(() => cellWidth(page)).toBeGreaterThan(fitted * 1.3);
  });
});

test.describe('Pinch and two-finger pan', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'needs a touch screen');
  });

  test('pinching the grid zooms the maze, not the page, and draws no walls', async ({ page }) => {
    await openApp(page, { size: 25 });
    await page.locator('#mazeViewport').scrollIntoViewIfNeeded();
    const fitted = await cellWidth(page);
    const view = await viewportBox(page);
    const fingers = await makeFingers(page);

    await pinchOpen(page, fingers);

    expect(await cellWidth(page)).toBeGreaterThan(fitted * 1.8);
    expect(wallCount(await readMaze(page)), 'the first finger drew nothing').toBe(0);
    const after = await viewportBox(page);
    expect(after.width).toBeCloseTo(view.width, 0);
    expect(after.height).toBeCloseTo(view.height, 0);
    await expect(page.locator('#zoomFitBtn')).toBeEnabled();

    // Two fingers dragging together move the maze inside its window.
    const before = await scrollPos(page);
    const cx = view.x + view.width / 2;
    const cy = view.y + view.height / 2;
    await fingers.press(1, cx - 30, cy);
    await fingers.press(2, cx + 30, cy);
    await fingers.glide({ x: cx - 30, y: cy }, { x: cx + 30, y: cy }, { x: cx - 90, y: cy - 60 }, { x: cx - 30, y: cy - 60 });
    await fingers.lift(2);
    await fingers.lift(1);
    const moved = await scrollPos(page);
    expect(moved.x).toBeGreaterThan(before.x + 30);
    expect(moved.y).toBeGreaterThan(before.y + 30);
    expect(wallCount(await readMaze(page))).toBe(0);

    await page.click('#zoomFitBtn');
    expect(await cellWidth(page)).toBeCloseTo(fitted, 1);
    expect(page.mazeErrors).toEqual([]);
  });

  test('a pinch that starts on S leaves no line; the line keeps going after zooming', async ({ page }) => {
    await openApp(page, { size: 11 });
    await page.click('#userSolveBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Your Turn');
    await page.locator('#mazeViewport').scrollIntoViewIfNeeded();
    const fingers = await makeFingers(page);

    // Both fingers land together, the first right on S.
    const s = await cellCenter(page, 0, 0);
    await fingers.press(1, s.x, s.y);
    await fingers.press(2, s.x + 60, s.y + 60);
    await fingers.glide(s, { x: s.x + 60, y: s.y + 60 }, { x: s.x - 10, y: s.y - 10 }, { x: s.x + 140, y: s.y + 140 });
    await fingers.lift(2);
    await fingers.lift(1);

    await expect(page.locator('#metricExplored')).toHaveText('0');
    await expect(page.locator('#phaseLabel')).toHaveText('Your Turn');
    await expect(page.locator('#mazeViewport')).toHaveClass(/zoomed/);

    // One finger traces from S as usual, zoomed in.
    const a = await cellCenter(page, 0, 0);
    const b = await cellCenter(page, 0, 1);
    const c = await cellCenter(page, 0, 2);
    await fingers.press(1, a.x, a.y);
    for (const p of [b, c]) {
      await fingers.move(1, (a.x + p.x) / 2, p.y);
      await fingers.move(1, p.x, p.y);
    }
    await fingers.lift(1);
    expect(await metric(page, 2)).toBe('3');
    await expect(page.locator('#phaseLabel')).toHaveText('Paused');
  });

  test('a pinch in the middle of a line pauses it, keeping the line', async ({ page }) => {
    await openApp(page, { size: 11 });
    await page.click('#userSolveBtn');
    await page.locator('#mazeViewport').scrollIntoViewIfNeeded();
    const fingers = await makeFingers(page);

    const pts = [];
    for (let col = 0; col < 4; col++) pts.push(await cellCenter(page, 0, col));
    await fingers.press(1, pts[0].x, pts[0].y);
    await page.waitForTimeout(450);
    for (const p of pts.slice(1)) await fingers.move(1, p.x, p.y);
    expect(await metric(page, 2)).toBe('4');

    // A second finger arrives later and pinches.
    const last = pts[3];
    await fingers.press(2, last.x, last.y + 80);
    await fingers.glide(last, { x: last.x, y: last.y + 80 }, last, { x: last.x, y: last.y + 160 });
    await fingers.lift(2);
    await fingers.lift(1);

    await expect(page.locator('#phaseLabel')).toHaveText('Paused');
    expect(await metric(page, 2), 'the line so far is kept').toBe('4');
    await expect(page.locator('#mazeViewport')).toHaveClass(/zoomed/);
  });

  test('a second finger resting still does not interrupt the line', async ({ page }) => {
    await openApp(page, { size: 11 });
    await page.click('#userSolveBtn');
    await page.locator('#mazeViewport').scrollIntoViewIfNeeded();
    const fingers = await makeFingers(page);

    const pts = [];
    for (let col = 0; col < 4; col++) pts.push(await cellCenter(page, 0, col));
    await fingers.press(1, pts[0].x, pts[0].y);
    const rest = await cellCenter(page, 8, 8);
    await fingers.press(2, rest.x, rest.y);
    for (const p of pts.slice(1)) await fingers.move(1, p.x, p.y);
    await expect(page.locator('#phaseLabel')).toHaveText('Tracing');
    expect(await metric(page, 2)).toBe('4');
    await fingers.lift(2);
    await fingers.lift(1);
    await expect(page.locator('#mazeViewport')).not.toHaveClass(/zoomed/);
  });

  test('a pinch in Start mode leaves S where it was', async ({ page }) => {
    await openApp(page, { size: 11 });
    await page.click('#startBtn');
    await page.locator('#mazeViewport').scrollIntoViewIfNeeded();
    const fingers = await makeFingers(page);
    const p = await cellCenter(page, 5, 5);
    await fingers.press(1, p.x, p.y);
    await fingers.press(2, p.x + 50, p.y);
    await fingers.glide(p, { x: p.x + 50, y: p.y }, { x: p.x - 40, y: p.y }, { x: p.x + 110, y: p.y });
    await fingers.lift(2);
    await fingers.lift(1);
    await expect(cell(page, 0, 0)).toHaveClass(/start/);
  });

  test('Build and Solve shows a picture button back to the whole maze', async ({ page }) => {
    await openApp(page, { size: 11, speed: 'Super fast' });
    await page.click('#simpleModeBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Your Turn', { timeout: 30_000 });
    await expect(page.locator('#simpleFitBtn')).toBeHidden();

    const fingers = await makeFingers(page);
    await pinchOpen(page, fingers);
    await expect(page.locator('#simpleFitBtn')).toBeVisible();
    await expect(page.locator('#mazeStage')).toHaveClass(/await-start/);

    // All the buttons still fit across the screen.
    const width = page.viewportSize().width;
    for (const id of ['#simpleGrowBtn', '#simpleSolveBtn', '#simpleFitBtn', '#simpleShapeBtn']) {
      const box = await page.locator(id).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }

    await page.click('#simpleFitBtn');
    await expect(page.locator('#simpleFitBtn')).toBeHidden();
    await expect(page.locator('#mazeViewport')).not.toHaveClass(/zoomed/);
    expect(page.mazeErrors).toEqual([]);
  });
});
