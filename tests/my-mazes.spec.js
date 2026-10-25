const { test, expect } = require('@playwright/test');
const { openApp, readMaze, shortestPath, blocked, makePointer, defaultPointerType, traceCells } = require('./helpers');

// My Mazes: finished mazes are kept on this device in three lists of 10 (the
// best finishes, the lowest scores to try again, and favourites picked with
// the heart), each with a picture of the route and the whole attempt step by
// step. Reset all options leaves them; Forget my mazes clears them.

const SAVED_KEY = 'mazeBuilder.mazes';
const CODE = '6HB7H-1CG03';
const OTHER = '6HB7H-0AG08';

async function growCode(page, code) {
  await page.evaluate(c => { location.hash = `maze=${c}`; }, code);
  await expect(page.locator('#codeLabel')).toHaveText(code);
  await expect(page.locator('#phaseLabel')).toHaveText(/Built|Your Turn/, { timeout: 30_000 });
  return readMaze(page);
}

// The shortest route with one step into a side corridor and back, so the
// line takes a back-up and the score drops below 100%.
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

async function solve(page, route, testInfo) {
  const pointer = await makePointer(page, defaultPointerType(testInfo));
  await traceCells(page, route, { pointer });
  await expect(page.locator('#successSheet')).toBeVisible();
}

const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVED_KEY);

test.describe('My Mazes', () => {
  test('a finished maze is kept with its picture, every step and its back-ups', async ({ page }, testInfo) => {
    await openApp(page, { speed: 'Super fast' });
    const maze = await growCode(page, CODE);
    const route = routeWithBackup(maze);
    await solve(page, route, testInfo);

    const kept = (await saved(page)).results;
    expect(kept).toHaveLength(1);
    const [result] = kept;
    expect(result.code).toBe(CODE);
    expect(result.backtracks).toBe(1);
    expect(result.shortest).toBe(shortestPath(maze).length);
    expect(result.cells).toBe(route.length);
    expect(result.efficiency).toBeLessThan(100);
    // One letter per step, back-up included, each with a time that never goes backwards.
    expect(result.ways).toHaveLength(route.length - 1);
    const ways = route.slice(1).map((p, i) => p.r < route[i].r ? 'U' : p.r > route[i].r ? 'D' : p.c < route[i].c ? 'L' : 'R').join('');
    expect(result.ways).toBe(ways);
    expect(result.times).toHaveLength(route.length - 1);
    expect(result.times).toEqual([...result.times].sort((a, b) => a - b));
    expect(result.picture).toMatch(/^data:image\/png;base64,/);

    // On both lists until there are enough mazes to fill them.
    await page.click('#successCloseBtn');
    await page.click('#myMazesBtn');
    const sheet = page.locator('#myMazesSheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.saved-row')).toHaveCount(1);
    await expect(sheet.locator('.saved-row')).toContainText('1 back-up');
    await sheet.locator('[data-list="again"]').click();
    await expect(sheet.locator('.saved-row')).toHaveCount(1);
    await sheet.locator('[data-list="favourites"]').click();
    await expect(sheet.locator('.saved-row')).toHaveCount(0);
    await expect(page.locator('#myMazesEmpty')).toBeVisible();
    expect(page.mazeErrors).toEqual([]);
  });

  test('a better finish replaces the old one and leaves Try Again; a row grows its maze again', async ({ page }, testInfo) => {
    // Two traces of a long route.
    test.setTimeout(120_000);
    await openApp(page, { speed: 'Super fast' });
    const maze = await growCode(page, CODE);
    await solve(page, routeWithBackup(maze), testInfo);
    await page.click('#successAgainBtn');
    await solve(page, shortestPath(maze), testInfo);

    const kept = (await saved(page)).results;
    expect(kept).toHaveLength(1);
    expect(kept[0].efficiency).toBe(100);
    expect(kept[0].backtracks).toBe(0);

    await page.click('#successCloseBtn');
    await growCode(page, OTHER);
    await page.click('#myMazesBtn');
    const sheet = page.locator('#myMazesSheet');
    await sheet.locator('[data-list="again"]').click();
    await expect(sheet.locator('.saved-row')).toHaveCount(0);
    await sheet.locator('[data-list="best"]').click();
    await sheet.locator('.saved-open').first().click();
    await expect(sheet).toBeHidden();
    await expect(page.locator('#codeLabel')).toHaveText(CODE);
    await expect(page.locator('#phaseLabel')).toHaveText(/Built|Your Turn/, { timeout: 30_000 });
    await expect(page.locator('#userSolveBtn')).toHaveClass(/active/);
    expect(page.mazeErrors).toEqual([]);
  });

  test('the heart keeps a favourite, and an 11th takes the place of the one played least', async ({ page }, testInfo) => {
    await openApp(page, { speed: 'Super fast' });
    // Ten favourites already: the one played least is ZZZZ3.
    await page.evaluate(key => {
      const favourites = Array.from({ length: 10 }, (_, i) => ({ code: `ZZZZ${i}`, plays: i === 3 ? 1 : 5, played: 1000 + i }));
      localStorage.setItem(key, JSON.stringify({ results: [], favourites }));
    }, SAVED_KEY);
    const maze = await growCode(page, CODE);
    await solve(page, shortestPath(maze), testInfo);

    const heart = page.locator('#successFavBtn');
    await expect(heart).toBeVisible();
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
    await heart.click();
    await expect(heart).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#status')).toContainText('made room');

    const favourites = (await saved(page)).favourites.map(f => f.code);
    expect(favourites).toHaveLength(10);
    expect(favourites).toContain(CODE);
    expect(favourites).not.toContain('ZZZZ3');

    // Trying it again counts as a play.
    await page.click('#successAgainBtn');
    expect((await saved(page)).favourites.find(f => f.code === CODE).plays).toBe(2);

    // The list says how many it holds, and the heart there lets it go.
    await page.click('#myMazesBtn');
    const sheet = page.locator('#myMazesSheet');
    await sheet.locator('[data-list="favourites"]').click();
    await expect(page.locator('#myMazesNote')).toContainText('Up to 10 favourites');
    await expect(sheet.locator('.saved-row')).toHaveCount(10);
    await sheet.locator('.saved-row', { hasText: '15 × 15' }).locator('.saved-heart').click();
    await expect(sheet.locator('.saved-row')).toHaveCount(9);
    expect(page.mazeErrors).toEqual([]);
  });

  test('Reset all options keeps saved mazes; Forget my mazes clears them after a second tap', async ({ page }, testInfo) => {
    await openApp(page, { speed: 'Super fast' });
    const maze = await growCode(page, CODE);
    await solve(page, shortestPath(maze), testInfo);
    await page.click('#successCloseBtn');

    await page.click('#appInfoBtn');
    await page.click('#resetOptionsBtn');
    await page.click('#resetOptionsBtn');
    await page.waitForLoadState('load');
    await expect(page.locator('#maze .cell')).toHaveCount(15 * 15);
    expect((await saved(page)).results).toHaveLength(1);

    await page.click('#myMazesBtn');
    const forget = page.locator('#myMazesForgetBtn');
    await forget.click();
    await expect(forget).toHaveText('Tap again to forget them all');
    expect((await saved(page)).results).toHaveLength(1);
    await forget.click();
    expect(await saved(page)).toBeNull();
    await expect(page.locator('#myMazesSheet .saved-row')).toHaveCount(0);
    await expect(forget).toBeDisabled();
  });

  test('a maze changed by hand has no code, so it is not kept and has no heart', async ({ page }, testInfo) => {
    await openApp(page, { speed: 'Super fast' });
    await growCode(page, CODE);
    // Move F one square: the maze no longer matches its code.
    await page.click('#endBtn');
    const maze = await readMaze(page);
    const target = shortestPath(maze)[1];
    await page.locator(`#maze .cell[data-r="${target.r}"][data-c="${target.c}"]`).click();
    await expect(page.locator('#codeLabel')).toHaveText('None');
    await page.click('#userSolveBtn');
    await solve(page, shortestPath(await readMaze(page)), testInfo);
    await expect(page.locator('#successFavBtn')).toBeHidden();
    expect(await saved(page)).toBeNull();
  });

  test('Kid Mode shows a trophy once there is something saved, with picture rows that grow a maze', async ({ page }, testInfo) => {
    await openApp(page, { speed: 'Super fast' });
    await page.click('#simpleModeBtn');
    await expect(page.locator('#simpleMazesBtn')).toBeHidden();
    const maze = await growCode(page, CODE);
    await solve(page, routeWithBackup(maze), testInfo);
    await page.click('#successFavBtn');
    await page.click('#successNewMazeBtn');
    await expect(page.locator('#phaseLabel')).toHaveText(/Built|Your Turn/, { timeout: 30_000 });

    await page.click('#simpleMazesBtn');
    const sheet = page.locator('#simpleMazesSheet');
    await expect(sheet).toBeVisible();
    for (const row of ['#simpleBestRow', '#simpleAgainRow', '#simpleFavouriteRow']) {
      await expect(sheet.locator(`${row} .simple-maze-tile`)).toHaveCount(1);
    }
    await sheet.locator('#simpleFavouriteRow .simple-maze-tile').click();
    await expect(sheet).toBeHidden();
    await expect(page.locator('#codeLabel')).toHaveText(CODE);
    expect(page.mazeErrors).toEqual([]);
  });
});
