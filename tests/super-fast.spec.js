const { test, expect } = require('@playwright/test');
const { openApp, readMaze, reachableCount, shortestPath, blocked, cell } = require('./helpers');

// The hardest maze the app can make: the biggest size, every Maze style dial
// at its far end, and S and F side by side in the middle, which makes the
// planner retry for a long route.
async function hardestMaze(page) {
  await openApp(page, { size: 25, speed: 'Super fast' });
  if (!(await page.locator('#styleDetails').evaluate(el => el.open))) await page.click('#styleDetails summary');
  for (const name of ['twisty', 'shortcuts', 'branches']) {
    await page.locator(`#${name}Dial`).fill('4');
  }
  const s = { r: 12, c: 12 };
  const f = { r: 12, c: 13 };
  await page.click('#startBtn');
  await cell(page, s.r, s.c).click();
  await page.click('#endBtn');
  await cell(page, f.r, f.c).click();
  return { s, f };
}

// Taps Grow a Maze and times it, in the page, until the maze is built. Also
// counts how many different frames of walls showed along the way, so a
// maze that simply appeared all at once would be caught.
function timeGrowth(page) {
  return page.evaluate(() => new Promise(resolve => {
    const phase = document.getElementById('phaseLabel');
    const wallFrames = new Set();
    const startedAt = performance.now();
    const tick = () => {
      if (phase.textContent === 'Built') {
        resolve({ ms: performance.now() - startedAt, frames: wallFrames.size });
        return;
      }
      wallFrames.add(document.querySelectorAll('#wallLayer line.on').length);
      requestAnimationFrame(tick);
    };
    document.getElementById('generateBtn').click();
    requestAnimationFrame(tick);
  }));
}

test.describe('Super fast growth', () => {
  test('the hardest maze grows in under 2.5 seconds, every time', async ({ page }) => {
    const { s, f } = await hardestMaze(page);

    for (let i = 0; i < 3; i++) {
      const { ms, frames } = await timeGrowth(page);
      expect(ms).toBeLessThan(2500);
      // Still a growing animation, not an instant swap.
      expect(frames).toBeGreaterThan(3);

      const maze = await readMaze(page);
      expect(maze.start).toEqual(s);
      expect(maze.end).toEqual(f);
      expect(reachableCount(maze)).toBe(25 * 25);
      expect(blocked(maze, s, f)).toBe(true);
      expect(shortestPath(maze).length).toBeGreaterThan(25);
      expect(await page.locator('#maze .carve-head, #maze .carve-spark').count()).toBe(0);
    }
    expect(page.mazeErrors).toEqual([]);
  });

  test('picking Super fast while a maze grows slowly finishes it quickly', async ({ page }) => {
    await openApp(page, { size: 25, speed: 'Slow' });
    await page.click('#generateBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Growing');
    await page.waitForTimeout(400);
    await page.selectOption('#speedSelect', { label: 'Super fast' });
    await expect(page.locator('#phaseLabel')).toHaveText('Built', { timeout: 4_000 });
    expect(reachableCount(await readMaze(page))).toBe(25 * 25);
    expect(page.mazeErrors).toEqual([]);
  });

  test('pause holds a Super fast maze and resume finishes it', async ({ page }) => {
    await openApp(page, { size: 25, speed: 'Super fast' });
    // Pause a few frames in, before the fast-forward can finish.
    await page.evaluate(async () => {
      const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
      document.getElementById('generateBtn').click();
      for (let i = 0; i < 3; i++) await frame();
      document.getElementById('pauseBtn').click();
    });
    await expect(page.locator('#phaseLabel')).toHaveText('Paused');

    const frozen = await readMaze(page);
    await page.waitForTimeout(1500);
    const later = await readMaze(page);
    expect(later.right).toEqual(frozen.right);
    expect(later.bottom).toEqual(frozen.bottom);

    await page.click('#pauseBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Built', { timeout: 4_000 });
    expect(reachableCount(await readMaze(page))).toBe(25 * 25);
    expect(page.mazeErrors).toEqual([]);
  });
});
