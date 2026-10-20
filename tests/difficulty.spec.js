const { test, expect } = require('@playwright/test');
const { openApp, readMaze, growMaze, reachableCount, wallCount, shortestPath } = require('./helpers');

/** Inner edges with no wall: the doors the generator has opened. */
const doors = maze => 2 * maze.size * (maze.size - 1) - wallCount(maze);

/** Squares where a corridor runs straight through: open on two opposite sides only. */
function straightThroughCount(maze) {
  const open = (r, c, dr, dc) => {
    const r2 = r + dr;
    const c2 = c + dc;
    if (r2 < 0 || c2 < 0 || r2 >= maze.size || c2 >= maze.size) return false;
    if (dr) return !maze.bottom[Math.min(r, r2)][c];
    return !maze.right[r][Math.min(c, c2)];
  };
  let count = 0;
  for (let r = 0; r < maze.size; r++) {
    for (let c = 0; c < maze.size; c++) {
      const up = open(r, c, -1, 0);
      const down = open(r, c, 1, 0);
      const left = open(r, c, 0, -1);
      const right = open(r, c, 0, 1);
      const n = up + down + left + right;
      if (n === 2 && ((up && down) || (left && right))) count++;
    }
  }
  return count;
}

async function openStyle(page) {
  const details = page.locator('#styleDetails');
  if (!(await details.evaluate(el => el.open))) await page.click('#styleDetails summary');
}

async function setDial(page, name, value) {
  await openStyle(page);
  await page.locator(`#${name}Dial`).fill(String(value));
}

async function dialValues(page) {
  return page.evaluate(() => ({
    twisty: Number(document.getElementById('twistyDial').value),
    shortcuts: Number(document.getElementById('shortcutsDial').value),
    branches: Number(document.getElementById('branchesDial').value)
  }));
}

const activeLevel = page => page.locator('.level-picker .segment.active');

test.describe('Levels and maze style', () => {
  test('starts on Medium, the classic maze', async ({ page }) => {
    const errors = await openApp(page, { speed: null });
    await expect(activeLevel(page)).toHaveText('Medium');
    await expect(page.locator('#levelLabel')).toHaveText('Medium');
    await expect(page.locator('#sizeSelect')).toHaveValue('15');
    expect(await dialValues(page)).toEqual({ twisty: 2, shortcuts: 0, branches: 0 });
    expect(errors).toEqual([]);
  });

  test('Easy is a small maze with shortcuts: connected, and more than one way through', async ({ page }) => {
    const errors = await openApp(page);
    await page.click('.level-picker [data-level="easy"]');
    await expect(page.locator('#maze .cell')).toHaveCount(11 * 11);
    await expect(activeLevel(page)).toHaveText('Easy');
    expect(await dialValues(page)).toEqual({ twisty: 1, shortcuts: 3, branches: 2 });

    const maze = await growMaze(page);
    expect(maze.start).toEqual({ r: 0, c: 0 });
    expect(maze.end).toEqual({ r: 10, c: 10 });
    expect(reachableCount(maze)).toBe(121);
    // A single-route maze has exactly N - 1 doors; shortcuts add loops.
    expect(doors(maze)).toBeGreaterThan(121 - 1);
    expect(shortestPath(maze)).not.toBeNull();
    await expect(page.locator('#maze .cell.carve-head')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Hard is a bigger single-route maze', async ({ page }) => {
    const errors = await openApp(page);
    await page.click('.level-picker [data-level="hard"]');
    await expect(page.locator('#maze .cell')).toHaveCount(21 * 21);
    await expect(activeLevel(page)).toHaveText('Hard');

    const maze = await growMaze(page);
    expect(reachableCount(maze)).toBe(21 * 21);
    expect(doors(maze)).toBe(21 * 21 - 1);
    expect(errors).toEqual([]);
  });

  test('moving a dial or the size makes the level Custom', async ({ page }) => {
    await openApp(page, { speed: null });
    await setDial(page, 'twisty', 4);
    await expect(activeLevel(page)).toHaveCount(0);
    await expect(page.locator('#levelLabel')).toHaveText('Custom');

    await setDial(page, 'twisty', 2);
    await expect(activeLevel(page)).toHaveText('Medium');

    await page.selectOption('#sizeSelect', '25');
    await expect(page.locator('#levelLabel')).toHaveText('Custom');
  });

  test('lots of branches still grows a complete single-route maze', async ({ page }) => {
    const errors = await openApp(page, { size: 15 });
    await setDial(page, 'branches', 4);
    const maze = await growMaze(page);
    expect(reachableCount(maze)).toBe(15 * 15);
    expect(doors(maze)).toBe(15 * 15 - 1);
    expect(errors).toEqual([]);
  });

  test('lots of shortcuts keeps every wall rule and the search still finds the shortest route', async ({ page }) => {
    await openApp(page, { size: 11 });
    await setDial(page, 'shortcuts', 4);
    const maze = await growMaze(page);
    expect(reachableCount(maze)).toBe(121);
    expect(doors(maze)).toBe(121 - 1 + Math.round(0.14 * 121));

    await page.click('#instantBtn');
    await expect(page.locator('#metricShortest')).toHaveText(String(shortestPath(maze).length - 1));
  });

  test('the Twisty dial changes how often corridors run straight', async ({ page }) => {
    await openApp(page, { size: 15 });
    await setDial(page, 'twisty', 0);
    const straight = straightThroughCount(await growMaze(page));
    await setDial(page, 'twisty', 4);
    const twisty = straightThroughCount(await growMaze(page));
    expect(straight).toBeGreaterThan(twisty * 2);
  });

  test('level and dials are locked while a maze grows', async ({ page }) => {
    await openApp(page, { speed: 'Slow' });
    await openStyle(page);
    await page.click('#generateBtn');
    await expect(page.locator('.level-picker [data-level="easy"]')).toBeDisabled();
    await expect(page.locator('#twistyDial')).toBeDisabled();
  });

  test('the chosen level and dials are remembered after a reload', async ({ page }) => {
    await openApp(page, { speed: null });
    await page.click('.level-picker [data-level="easy"]');
    await setDial(page, 'branches', 4);
    await page.reload();
    await expect(page.locator('#maze .cell')).toHaveCount(11 * 11);
    expect(await dialValues(page)).toEqual({ twisty: 1, shortcuts: 3, branches: 4 });
    await expect(page.locator('#levelLabel')).toHaveText('Custom');
    await expect(readMaze(page).then(m => m.size)).resolves.toBe(11);
  });
});
