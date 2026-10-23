const { test, expect } = require('@playwright/test');
const {
  openApp, readMaze, shortestPath, makePointer, defaultPointerType, traceCells, cellCenter
} = require('./helpers');

// Build and Solve: the picture-only mode for children who cannot read yet.

async function enterSimpleMode(page) {
  await page.click('#simpleModeBtn');
  await expect(page.locator('html')).toHaveClass(/simple-mode/);
}

/** Wait for the maze to finish growing and the drawing turn to begin. */
async function waitForYourTurn(page) {
  await expect(page.locator('#phaseLabel')).toHaveText('Your Turn', { timeout: 30_000 });
  await expect(page.locator('#mazeStage')).toHaveClass(/await-start/);
}

async function holdFullModeButton(page, ms) {
  const box = await page.locator('#fullModeBtn').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test.describe('Build and Solve mode', () => {
  test('full mode is the default, with one tap into Build and Solve', async ({ page }) => {
    await openApp(page, { size: 11, speed: 'Super fast' });
    await expect(page.locator('html')).not.toHaveClass(/simple-mode/);
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('#fullModeBtn')).toBeHidden();
    await expect(page.locator('.simple-bar')).toBeHidden();

    await enterSimpleMode(page);

    // Words, settings and numbers step aside; the maze and two picture buttons stay.
    for (const hidden of ['.sidebar', '.telemetry', '.legend', '#status', '#userSolveBtn', '#simpleModeBtn', '.info-button']) {
      await expect(page.locator(hidden).first(), `${hidden} is hidden`).toBeHidden();
    }
    await expect(page.locator('#simpleGrowBtn')).toBeVisible();
    await expect(page.locator('#simpleSolveBtn')).toBeVisible();
    await expect(page.locator('#fullModeBtn')).toBeVisible();

    // The maze grows by itself, then drawing starts with S glowing.
    await waitForYourTurn(page);
    const maze = await readMaze(page);
    expect(shortestPath(maze), 'the grown maze has a way through').not.toBeNull();

    // Maze and buttons fit on one screen, so there is nothing to scroll.
    const viewport = page.viewportSize();
    const mazeBox = await page.locator('#maze').boundingBox();
    const barBox = await page.locator('.simple-bar').boundingBox();
    expect(mazeBox.y).toBeGreaterThanOrEqual(0);
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(viewport.height);
    expect(mazeBox.x + mazeBox.width).toBeLessThanOrEqual(viewport.width);
    expect(page.mazeErrors).toEqual([]);
  });

  test('the setting is remembered and the next visit starts growing a maze', async ({ page }) => {
    await openApp(page, { size: 11, speed: 'Super fast' });
    await enterSimpleMode(page);
    await waitForYourTurn(page);

    await page.reload();
    await expect(page.locator('html')).toHaveClass(/simple-mode/);
    await expect(page.locator('.sidebar')).toBeHidden();
    await waitForYourTurn(page);
    await expect(page.locator('#wallLayer line.on').first()).toBeAttached();
    expect(page.mazeErrors).toEqual([]);
  });

  test('a child can solve it and the celebration is all pictures', async ({ page }, testInfo) => {
    await openApp(page, { size: 11, speed: 'Super fast' });
    await enterSimpleMode(page);
    await waitForYourTurn(page);

    const pointer = await makePointer(page, defaultPointerType(testInfo));
    const route = shortestPath(await readMaze(page));

    // Lifting halfway: the end of the line glows to show where to carry on.
    const half = Math.floor(route.length / 2);
    await traceCells(page, route.slice(0, half + 1), { pointer });
    await expect(page.locator('#mazeStage')).toHaveClass(/await-resume/);
    await expect(page.locator('#mazeStage')).not.toHaveClass(/await-start/);
    await traceCells(page, route.slice(half), { pointer });

    await expect(page.locator('#successSheet')).toBeVisible();
    await expect(page.locator('#successEfficiency')).toHaveText('100%');
    for (const hidden of ['#successTitle', '.success-metrics', '#successAgainBtn', '#successCloseBtn']) {
      await expect(page.locator(hidden), `${hidden} is hidden`).toBeHidden();
    }
    await expect(page.locator('#successReplayBtn')).toBeVisible();
    await expect(page.locator('#successNewMazeBtn')).toBeVisible();

    // Same maze again: the line is wiped and S glows.
    const before = await readMaze(page);
    await page.click('#successReplayBtn');
    await expect(page.locator('#successSheet')).toBeHidden();
    await expect(page.locator('#mazeStage')).toHaveClass(/await-start/);
    expect((await readMaze(page)).right).toEqual(before.right);

    // A new maze grows, and drawing begins again by itself.
    await traceCells(page, route, { pointer });
    await expect(page.locator('#successSheet')).toBeVisible();
    await page.click('#successNewMazeBtn');
    await expect(page.locator('#successSheet')).toBeHidden();
    await expect(page.locator('#phaseLabel')).toHaveText('Growing');
    await waitForYourTurn(page);
    expect(page.mazeErrors).toEqual([]);
  });

  test('the picture buttons grow a new maze and wipe the line', async ({ page }, testInfo) => {
    await openApp(page, { size: 11, speed: 'Super fast' });
    await enterSimpleMode(page);
    await waitForYourTurn(page);

    const pointer = await makePointer(page, defaultPointerType(testInfo));
    const route = shortestPath(await readMaze(page));
    await traceCells(page, route.slice(0, 3), { pointer });
    await expect(page.locator('#mazeStage')).toHaveClass(/await-resume/);

    await page.click('#simpleSolveBtn');
    await expect(page.locator('#mazeStage')).toHaveClass(/await-start/);
    await expect(page.locator('#userPathLine')).toHaveAttribute('points', '');

    await page.click('#simpleGrowBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Growing');
    await waitForYourTurn(page);

    // Touching S starts a line straight away.
    await page.locator('#maze').scrollIntoViewIfNeeded();
    const s = await cellCenter(page, 0, 0);
    await pointer.down(s.x, s.y);
    await expect(page.locator('#phaseLabel')).toHaveText('Tracing');
    await pointer.up();
    expect(page.mazeErrors).toEqual([]);
  });

  test('a quick tap stays in Build and Solve; a press and hold goes back to full mode', async ({ page }) => {
    await openApp(page, { size: 11, speed: 'Super fast' });
    await enterSimpleMode(page);
    await waitForYourTurn(page);

    await page.click('#fullModeBtn');
    await holdFullModeButton(page, 500);
    await expect(page.locator('html')).toHaveClass(/simple-mode/);

    await holdFullModeButton(page, 1800);
    await expect(page.locator('html')).not.toHaveClass(/simple-mode/);
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.telemetry')).toBeVisible();
    await expect(page.locator('#simpleModeBtn')).toBeVisible();
    await expect(page.locator('.simple-bar')).toBeHidden();

    // Full mode is remembered too, and opens on a blank grid as before.
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/simple-mode/);
    await expect(page.locator('#phaseLabel')).toHaveText('Ready');
    await expect(page.locator('#wallLayer line.on')).toHaveCount(0);
    expect(page.mazeErrors).toEqual([]);
  });

  test('a keyboard press on the corner button goes back to full mode', async ({ page }) => {
    await openApp(page, { size: 11, speed: 'Super fast' });
    await enterSimpleMode(page);
    await page.locator('#fullModeBtn').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).not.toHaveClass(/simple-mode/);
  });

  test('size, speed and maze style survive a trip through Build and Solve', async ({ page }) => {
    await openApp(page, { size: 21, speed: 'Super fast' });
    await enterSimpleMode(page);
    await expect(page.locator('#maze .cell')).toHaveCount(21 * 21);
    await page.locator('#fullModeBtn').focus();
    await page.keyboard.press('Enter');
    await page.reload();
    await expect(page.locator('#sizeSelect')).toHaveValue('21');
    await expect(page.locator('#speedSelect option:checked')).toHaveText('Super fast');
  });
});
