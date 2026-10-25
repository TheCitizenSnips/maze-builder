const { test, expect } = require('@playwright/test');
const { openApp, readMaze, shortestPath, makePointer, defaultPointerType, traceCells } = require('./helpers');

// Today's maze: one maze a day, the same on every device. Its seed and shape
// come from SHA-256 of the local date and a fixed salt, so nearby days give
// unrelated mazes and nobody can count up from today's code to tomorrow's.

const walls = maze => ({ right: maze.right, bottom: maze.bottom, start: maze.start, end: maze.end });

// Pinned: changing DAILY_SALT, DAILY_SIZE, DAILY_STYLE or the planner
// changes every day's maze. Only do that deliberately.
const PINNED = {
  '2026-10-25': '7RMBF-1CG8M',
  '2026-10-26': '1Y5MQ-HCH09'
};

const at = day => new Date(`${day}T09:30:00`);

async function waitForBuilt(page) {
  await expect(page.locator('#phaseLabel')).toHaveText('Built', { timeout: 30_000 });
}

async function growToday(page) {
  await page.click('#dailyBtn');
  await waitForBuilt(page);
  return page.locator('#codeLabel').textContent();
}

test.describe("Today's maze", () => {
  test('everyone gets the same maze on the same day', async ({ page, context }) => {
    await page.clock.setFixedTime(at('2026-10-25'));
    await openApp(page, { speed: 'Super fast' });
    await expect(page.locator('#dailyBtn')).toContainText('Today’s Maze');
    const code = await growToday(page);
    expect(code).toBe(PINNED['2026-10-25']);
    await expect(page.locator('#status')).toContainText("Today's maze is ready");
    const mine = await readMaze(page);
    expect(mine.size).toBe(15);
    expect(shortestPath(mine), 'the daily maze has a way through').not.toBeNull();

    // Someone else, another grid size saved, on the same day.
    const friend = await context.newPage();
    await friend.clock.setFixedTime(at('2026-10-25'));
    await openApp(friend, { size: 31, speed: 'Super fast' });
    expect(await growToday(friend)).toBe(code);
    expect(walls(await readMaze(friend))).toEqual(walls(mine));
    expect(page.mazeErrors).toEqual([]);
    expect(friend.mazeErrors).toEqual([]);
  });

  test('the next day is a different maze that cannot be counted up to', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-25T23:59:00'));
    await openApp(page, { speed: 'Super fast' });
    const today = await growToday(page);

    // Just after local midnight the button gives the next day's maze.
    await page.clock.setFixedTime(new Date('2026-10-26T00:01:00'));
    const tomorrow = await growToday(page);
    expect(tomorrow).toBe(PINNED['2026-10-26']);
    expect(tomorrow).not.toBe(today);

    // A week of codes: all different, and no two days' seeds sit side by
    // side the way a counted-up seed would.
    const seeds = [];
    for (let d = 20; d <= 26; d++) {
      await page.clock.setFixedTime(at(`2026-10-${d}`));
      await growToday(page);
      seeds.push(await page.evaluate(() => document.getElementById('codeLabel').textContent));
    }
    expect(new Set(seeds).size).toBe(seeds.length);
    // The seed is the 25 bits after the 2 version bits, i.e. most of the
    // first five characters.
    const digits = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const seedOf = code => [...code.replace(/-/g, '').slice(0, 6)]
      .map(ch => digits.indexOf(ch).toString(2).padStart(5, '0')).join('').slice(2, 27);
    const numbers = seeds.map(code => parseInt(seedOf(code), 2));
    for (let i = 1; i < numbers.length; i++) expect(Math.abs(numbers[i] - numbers[i - 1])).toBeGreaterThan(1000);
    expect(page.mazeErrors).toEqual([]);
  });

  test("solving today's maze marks it solved, until tomorrow", async ({ page }, testInfo) => {
    await page.clock.setFixedTime(at('2026-10-25'));
    await openApp(page, { speed: 'Super fast' });
    await expect(page.locator('#dailyBtnNote')).not.toHaveText('Solved');
    await growToday(page);

    await page.click('#userSolveBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Your Turn');
    const pointer = await makePointer(page, defaultPointerType(testInfo));
    await traceCells(page, shortestPath(await readMaze(page)), { pointer });
    await expect(page.locator('#successSheet')).toBeVisible();
    await expect(page.locator('#dailyBtnNote')).toHaveText('Solved');
    await expect(page.locator('#dailyBtn')).toHaveClass(/solved/);

    // Still marked after a reload, gone the next day.
    await page.reload();
    await expect(page.locator('#dailyBtnNote')).toHaveText('Solved');
    await page.clock.setFixedTime(at('2026-10-26'));
    await page.reload();
    await expect(page.locator('#dailyBtnNote')).not.toHaveText('Solved');
    expect(page.mazeErrors).toEqual([]);
  });

  test('another maze solved the same day does not count', async ({ page }, testInfo) => {
    await page.clock.setFixedTime(at('2026-10-25'));
    await openApp(page, { size: 11, speed: 'Super fast' });
    await page.click('#generateBtn');
    await waitForBuilt(page);
    await page.click('#userSolveBtn');
    const pointer = await makePointer(page, defaultPointerType(testInfo));
    await traceCells(page, shortestPath(await readMaze(page)), { pointer });
    await expect(page.locator('#successSheet')).toBeVisible();
    await expect(page.locator('#dailyBtnNote')).not.toHaveText('Solved');
    expect(page.mazeErrors).toEqual([]);
  });

  test("Kid Mode has today's maze as a calendar tile with the date", async ({ page }) => {
    await page.clock.setFixedTime(at('2026-10-25'));
    await openApp(page, { speed: 'Super fast' });
    await page.click('#simpleModeBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Your Turn', { timeout: 30_000 });

    await page.click('#simpleShapeBtn');
    const tile = page.locator('#simpleDailyTile');
    await expect(tile).toBeVisible();
    await expect(tile.locator('text')).toHaveText('25');
    await tile.click();
    await expect(page.locator('#simpleShapeSheet')).toBeHidden();
    await expect(page.locator('#phaseLabel')).toHaveText('Your Turn', { timeout: 30_000 });
    await expect(page.locator('#codeLabel')).toHaveText(PINNED['2026-10-25']);
    expect(page.mazeErrors).toEqual([]);
  });
});
