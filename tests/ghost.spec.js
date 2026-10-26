const { test, expect } = require('@playwright/test');
const { openApp, readMaze, shortestPath, blocked, makePointer, defaultPointerType, traceCells, cellCenter } = require('./helpers');

// Ghost replay: a maze with a saved finish in My Mazes is raced by the ghost
// of that run. It waits on S, sets off when the line leaves S and steps at
// the run's own recorded times, wrong turns included. The success sheet
// shows who reached F first, and a better finish becomes the new ghost.

const SAVED_KEY = 'mazeBuilder.mazes';
const CODE = '6HB7H-1CG03';

async function growCode(page, code) {
  await page.evaluate(c => { location.hash = `maze=${c}`; }, code);
  await expect(page.locator('#codeLabel')).toHaveText(code);
  await expect(page.locator('#phaseLabel')).toHaveText(/Built|Your Turn/, { timeout: 30_000 });
  return readMaze(page);
}

const waysOf = route => route.slice(1).map((p, i) => {
  const q = route[i];
  return p.r < q.r ? 'U' : p.r > q.r ? 'D' : p.c < q.c ? 'L' : 'R';
}).join('');

// The shortest route with one step into a side corridor and back.
function routeWithBackup(maze) {
  const path = shortestPath(maze);
  const on = new Set(path.map(p => `${p.r},${p.c}`));
  for (let i = 1; i < path.length - 1; i++) {
    for (const [dr, dc] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const side = { r: path[i].r + dr, c: path[i].c + dc };
      if (!on.has(`${side.r},${side.c}`) && !blocked(maze, path[i], side)) {
        return [...path.slice(0, i + 1), side, ...path.slice(i)];
      }
    }
  }
  throw new Error('no side corridor on the route');
}

// Save a finished run of this maze, taking one step every `tenthsPerStep`.
async function saveRun(page, route, { tenthsPerStep, efficiency }) {
  const ways = waysOf(route);
  const times = [...ways].map((_, i) => (i + 1) * tenthsPerStep);
  await page.evaluate(({ key, result }) => {
    localStorage.setItem(key, JSON.stringify({ results: [result], favourites: [] }));
  }, {
    key: SAVED_KEY,
    result: {
      code: CODE, shape: 'square', size: 15, efficiency, ms: times[times.length - 1] * 100,
      cells: route.length, shortest: route.length, backtracks: 0, ways, times, at: Date.now(), picture: ''
    }
  });
  return times[times.length - 1] / 10;
}

// Where the ghost is drawn, as a maze square.
async function ghostCell(page) {
  return page.evaluate(() => {
    const head = document.getElementById('ghostHead');
    if (head.getAttribute('display') === 'none') return null;
    const m = /translate\(([\d.]+)px, ([\d.]+)px\)/.exec(head.style.transform);
    const maze = document.getElementById('maze');
    const size = Math.round(Math.sqrt(maze.children.length));
    const cell = maze.children[0];
    return {
      r: Math.floor((Number(m[2]) - cell.offsetTop) / cell.offsetHeight),
      c: Math.floor((Number(m[1]) - cell.offsetLeft) / cell.offsetWidth),
      size
    };
  });
}

async function solve(page, route, testInfo) {
  const pointer = await makePointer(page, defaultPointerType(testInfo));
  await traceCells(page, route, { pointer });
  await expect(page.locator('#successSheet')).toBeVisible();
}

const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVED_KEY);

test.describe('Ghost replay', () => {
  test('no ghost the first time; after a finish, Try Again races its ghost', async ({ page }, testInfo) => {
    await openApp(page, { speed: 'Super fast' });
    const maze = await growCode(page, CODE);
    await expect(page.locator('#ghostChip')).toBeHidden();
    await expect(page.locator('#ghostHead')).toHaveAttribute('display', 'none');

    await solve(page, routeWithBackup(maze), testInfo);
    await expect(page.locator('#successSheet .ghost-race').first()).toBeHidden();
    await page.click('#successAgainBtn');

    await expect(page.locator('#ghostChip')).toBeVisible();
    await expect(page.locator('#ghostChipLabel')).toHaveText(/^Ghost \d+\.\ds$/);
    await expect(page.locator('#status')).toContainText('ghost is waiting on S');
    const at = await ghostCell(page);
    expect({ r: at.r, c: at.c }).toEqual(maze.start);
    expect(page.mazeErrors).toEqual([]);
  });

  test('the ghost steps at its own pace, wrong turn included, and keeps going while the line is lifted', async ({ page }, testInfo) => {
    await openApp(page, { speed: 'Super fast' });
    const maze = await growCode(page, CODE);
    const ghostRoute = routeWithBackup(maze);
    // A step every 0.1 s: the whole run takes a few seconds.
    const ghostSeconds = await saveRun(page, ghostRoute, { tenthsPerStep: 1, efficiency: 95 });
    await growCode(page, CODE);
    await expect(page.locator('#ghostChipLabel')).toHaveText(`Ghost ${ghostSeconds.toFixed(1)}s`);

    // Leave S by two squares and lift: the ghost sets off with the clock.
    const pointer = await makePointer(page, defaultPointerType(testInfo));
    const route = shortestPath(maze);
    await traceCells(page, route.slice(0, 3), { pointer });
    await page.waitForTimeout(1000);
    const midway = await ghostCell(page);
    const index = ghostRoute.findIndex(p => p.r === midway.r && p.c === midway.c);
    expect(index).toBeGreaterThan(3);
    expect(index).toBeLessThan(ghostRoute.length - 1);

    // It reaches F at its recorded time and waits there.
    await page.waitForTimeout(ghostSeconds * 1000);
    const home = await ghostCell(page);
    expect({ r: home.r, c: home.c }).toEqual(maze.end);
    await expect(page.locator('#ghostHead')).toHaveClass(/finished/);
    expect(page.mazeErrors).toEqual([]);
  });

  test('beating a slow ghost puts you on the top step and makes this run the new ghost', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await openApp(page, { speed: 'Super fast' });
    const maze = await growCode(page, CODE);
    // Very slow ghost: 10 s a step.
    await saveRun(page, routeWithBackup(maze), { tenthsPerStep: 100, efficiency: 90 });
    await growCode(page, CODE);
    await solve(page, shortestPath(maze), testInfo);

    const race = page.locator('.success-card > .ghost-race');
    await expect(race).toBeVisible();
    await expect(race.locator('.you')).toHaveClass(/first/);
    await expect(race.locator('.you .ghost-podium')).toHaveText('1');
    await expect(page.locator('#successKicker')).toHaveText('You Beat Your Ghost');
    await expect(page.locator('#successSubtitle')).toHaveText('This run is your new ghost.');
    const [result] = (await saved(page)).results;
    expect(result.efficiency).toBe(100);
    expect(result.ways).toBe(waysOf(shortestPath(maze)));

    // Try again: the new ghost is this run.
    await page.click('#successAgainBtn');
    await expect(page.locator('#ghostChipLabel')).toHaveText(`Ghost ${(result.ms / 1000).toFixed(1)}s`);
    expect(page.mazeErrors).toEqual([]);
  });

  test('a ghost that gets there first keeps its place when its score is better', async ({ page }, testInfo) => {
    await openApp(page, { speed: 'Super fast' });
    const maze = await growCode(page, CODE);
    const route = shortestPath(maze);
    // A perfect run at a step every 0.1 s, too quick to catch.
    await saveRun(page, route, { tenthsPerStep: 0.1, efficiency: 100 });
    await growCode(page, CODE);
    await solve(page, routeWithBackup(maze), testInfo);

    const race = page.locator('.success-card > .ghost-race');
    await expect(race.locator('.ghost')).toHaveClass(/first/);
    await expect(page.locator('#successSubtitle')).toContainText('Your ghost got there');
    expect((await saved(page)).results[0].efficiency).toBe(100);
    expect(page.mazeErrors).toEqual([]);
  });

  test('the chip hides the ghost, and that is remembered', async ({ page }, testInfo) => {
    await openApp(page, { speed: 'Super fast' });
    const maze = await growCode(page, CODE);
    await saveRun(page, shortestPath(maze), { tenthsPerStep: 5, efficiency: 100 });
    await growCode(page, CODE);

    const chip = page.locator('#ghostChip');
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#ghostChipLabel')).toHaveText('Ghost off');
    await expect(page.locator('#ghostHead')).toHaveAttribute('display', 'none');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mazeBuilder.settings')).ghost)).toBe(false);

    // No race on the sheet while it is hidden.
    await solve(page, shortestPath(maze), testInfo);
    await expect(page.locator('.success-card > .ghost-race')).toBeHidden();

    await page.reload();
    await growCode(page, CODE);
    await expect(page.locator('#ghostChipLabel')).toHaveText('Ghost off');
    await page.click('#ghostChip');
    await expect(page.locator('#ghostHead')).not.toHaveAttribute('display', 'none');
    expect(page.mazeErrors).toEqual([]);
  });

  test('a saved run that does not fit the maze gives no ghost', async ({ page }) => {
    await openApp(page, { speed: 'Super fast' });
    const maze = await growCode(page, CODE);
    const route = shortestPath(maze);
    await saveRun(page, route, { tenthsPerStep: 1, efficiency: 100 });
    // Turn the first step around so the run walks into the border.
    await page.evaluate(key => {
      const saved = JSON.parse(localStorage.getItem(key));
      const flip = { U: 'D', D: 'U', L: 'R', R: 'L' };
      saved.results[0].ways = flip[saved.results[0].ways[0]] + saved.results[0].ways.slice(1);
      localStorage.setItem(key, JSON.stringify(saved));
    }, SAVED_KEY);
    await growCode(page, CODE);
    await expect(page.locator('#ghostChip')).toBeHidden();
    await expect(page.locator('#ghostHead')).toHaveAttribute('display', 'none');
    expect(page.mazeErrors).toEqual([]);
  });

  test('Kid Mode races the ghost with no chip and shows the podium in pictures', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await openApp(page, { speed: 'Super fast' });
    await page.click('#simpleModeBtn');
    const maze = await growCode(page, CODE);
    await saveRun(page, routeWithBackup(maze), { tenthsPerStep: 100, efficiency: 90 });
    await growCode(page, CODE);
    await expect(page.locator('#userSolveBtn')).toHaveClass(/active/);

    await expect(page.locator('#ghostChip')).toBeHidden();
    await expect(page.locator('#ghostHead')).not.toHaveAttribute('display', 'none');
    await solve(page, shortestPath(maze), testInfo);
    await expect(page.locator('.simple-result .ghost-race')).toBeVisible();
    await expect(page.locator('.success-card > .ghost-race')).toBeHidden();
    await expect(page.locator('.simple-result .ghost-race .you')).toHaveClass(/first/);
    expect(page.mazeErrors).toEqual([]);
  });
});
