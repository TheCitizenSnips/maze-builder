const { createHash } = require('crypto');
const { test, expect } = require('@playwright/test');
const { openApp, readMaze, growMaze, toggleWall, cell } = require('./helpers');

// Every grown maze has a code: its seed plus every setting the planner reads,
// packed into letters and digits with a check character at the end. Typing
// the code back in must grow exactly the same maze.

const CODE = /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/;
const CODE_WITH_ENDS = /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/;

const walls = maze => ({ right: maze.right, bottom: maze.bottom, start: maze.start, end: maze.end });

async function openCode(page) {
  const details = page.locator('#codeDetails');
  if (!(await details.evaluate(el => el.open))) await page.locator('#codeDetails summary').click();
}

async function currentCode(page) {
  return page.locator('#codeInput').inputValue();
}

async function growCode(page, code) {
  await openCode(page);
  await page.fill('#codeInput', code);
  await page.click('#codeBuildBtn');
  await expect(page.locator('#phaseLabel')).toHaveText('Built', { timeout: 30_000 });
  return readMaze(page);
}

test.describe('Maze codes', () => {
  test('a grown maze shows its code, and the code grows the same maze again', async ({ page }) => {
    await openApp(page, { size: 15, speed: 'Super fast' });
    await expect(page.locator('#codeLabel')).toHaveText('None');

    const first = await growMaze(page);
    const code = await currentCode(page);
    expect(code).toMatch(CODE);
    await expect(page.locator('#codeLabel')).toHaveText(code);

    // A different maze in between, then the code again.
    await page.click('#blankBtn');
    await growMaze(page);
    expect(await currentCode(page)).not.toBe(code);

    const again = await growCode(page, code);
    expect(walls(again)).toEqual(walls(first));
    expect(await currentCode(page)).toBe(code);
    expect(page.mazeErrors).toEqual([]);
  });

  test('a code brings back its size, style, shape and S and F', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Planner behaviour is the same on every screen');
    await openApp(page, { size: 21, speed: 'Super fast' });
    await page.locator('#shapeDetails summary').click();
    await page.locator('.shape-tile[data-shape="heart"]').click();
    await page.locator('#styleDetails summary').click();
    await page.locator('#twistyDial').fill('3');
    await page.locator('#shortcutsDial').fill('1');
    await page.locator('#branchesDial').fill('4');

    // Move S away from where the heart puts it.
    const fresh = await readMaze(page);
    const inside = fresh.classes.flatMap((row, r) => row.map((cls, c) => ({ r, c, cls })))
      .filter(p => !p.cls.includes('off') && !p.cls.includes('start') && !p.cls.includes('end'));
    const spot = inside[Math.floor(inside.length / 2)];
    await page.click('#startBtn');
    await cell(page, spot.r, spot.c).click();

    const first = await growMaze(page);
    const code = await currentCode(page);
    expect(code).toMatch(CODE_WITH_ENDS);

    // Everything back to something else.
    await page.click('[data-level="easy"]');
    await expect(page.locator('#maze .cell')).toHaveCount(121);

    const again = await growCode(page, code);
    expect(again.size).toBe(21);
    expect(walls(again)).toEqual(walls(first));
    expect(again.start).toEqual({ r: spot.r, c: spot.c });
    await expect(page.locator('#shapeLabel')).toHaveText('Heart');
    await expect(page.locator('#levelLabel')).toHaveText('Custom');
    expect(await page.locator('#twistyDial').inputValue()).toBe('3');
    expect(page.mazeErrors).toEqual([]);
  });

  // A code written on a printed maze has to grow that maze for good. These
  // fingerprints of the walls fail the test when a change to the planner,
  // the random numbers or a shape drawing would grow something else from an
  // old code. If that change is meant, old codes stop matching their mazes:
  // say so in the release, then update the fingerprints.
  test('codes keep growing the same mazes from one release to the next', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Planner behaviour is the same on every screen');
    await openApp(page, { size: 15, speed: 'Super fast' });
    const known = {
      // Easy, Medium, Hard in a heart, and 51 × 51 cat with S and F moved.
      '6HB7H-0AG08': '245461751398',
      '6HB7H-1CG03': 'fff7c0f324b3',
      '6HB7H-2S84Q': 'd682d9a78d6f',
      '6HB7H-6EH0J-9EQ8E': 'cf4173e4f357'
    };
    for (const [code, fingerprint] of Object.entries(known)) {
      const maze = await growCode(page, code);
      const bits = [...maze.right.flat(), ...maze.bottom.flat()].map(Number).join('');
      expect(createHash('sha1').update(bits).digest('hex').slice(0, 12), code).toBe(fingerprint);
      expect(await currentCode(page)).toBe(code);
    }
    expect(page.mazeErrors).toEqual([]);
  });

  test('codes forgive case, missing dashes and O for 0, and catch a typo', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Planner behaviour is the same on every screen');
    await openApp(page, { size: 15, speed: 'Super fast' });
    const one = await growCode(page, '6HB7H-1CG03');
    const two = await growCode(page, '6hb7h1cgo3');
    expect(walls(two)).toEqual(walls(one));
    expect(await currentCode(page)).toBe('6HB7H-1CG03');

    // One character changed: the check character no longer fits.
    await page.fill('#codeInput', '6HB7H-1CG04');
    await page.click('#codeBuildBtn');
    await expect(page.locator('#codeNote')).toHaveText(/typo/);
    await expect(page.locator('#phaseLabel')).toHaveText('Ready');
    expect(walls(await readMaze(page))).toEqual(walls(one));
    expect(page.mazeErrors).toEqual([]);
  });

  test('every shape gets a code that grows it again', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Planner behaviour is the same on every screen');
    test.setTimeout(120_000);
    await openApp(page, { size: 15, speed: 'Super fast' });
    await page.locator('#shapeDetails summary').click();
    const shapes = await page.locator('.shape-tile').evaluateAll(tiles => tiles.map(t => t.dataset.shape));
    for (const shape of shapes) {
      await page.locator(`.shape-tile[data-shape="${shape}"]`).click();
      const first = await growMaze(page);
      const code = await currentCode(page);
      expect(code, shape).toMatch(CODE);
      await page.click('#blankBtn');
      expect(walls(await growCode(page, code)), shape).toEqual(walls(first));
    }
    expect(page.mazeErrors).toEqual([]);
  });

  test('Copy puts the code on the clipboard and Paste grows a pasted code', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Clipboard permissions are a desktop Chromium setting');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openApp(page, { size: 15, speed: 'Super fast' });
    await openCode(page);
    await expect(page.locator('#codeCopyBtn')).toBeDisabled();
    const first = await growMaze(page);
    const code = await currentCode(page);
    await page.click('#codeCopyBtn');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);

    await page.click('#blankBtn');
    // A code inside a message, the way it would arrive from a friend.
    await page.evaluate(text => navigator.clipboard.writeText(text), `Try this maze: ${code} !`);
    await page.click('#codePasteBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Built', { timeout: 30_000 });
    expect(walls(await readMaze(page))).toEqual(walls(first));
    expect(await currentCode(page)).toBe(code);
    expect(page.mazeErrors).toEqual([]);
  });

  test('a mistyped code says what is wrong and leaves the maze alone', async ({ page }) => {
    await openApp(page, { size: 15, speed: 'Super fast' });
    const before = await growMaze(page);
    const code = await currentCode(page);
    await openCode(page);
    for (const bad of ['', 'K7M2', 'K7M2Q-X3PAB-Q', 'UUUUU-UUUUU', '6HB7H-1CG04', 'ZZZZZ-ZZZZZ']) {
      await page.fill('#codeInput', bad);
      await page.click('#codeBuildBtn');
      await expect(page.locator('#codeNote')).toHaveClass(/error/);
      await expect(page.locator('#phaseLabel')).toHaveText('Ready');
    }
    expect(walls(await readMaze(page))).toEqual(walls(before));
    await page.fill('#codeInput', code);
    await expect(page.locator('#codeNote')).not.toHaveClass(/error/);
    expect(page.mazeErrors).toEqual([]);
  });

  test('editing the maze takes its code away', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Editing is covered on touch in editing.spec.js');
    await openApp(page, { size: 11, speed: 'Super fast' });
    await growMaze(page);
    await expect(page.locator('#codeLabel')).not.toHaveText('None');
    await toggleWall(page, 3, 3, 'right');
    await expect(page.locator('#codeLabel')).toHaveText('None');
    await expect(page.locator('#printCode')).toHaveText('');

    await growMaze(page);
    await page.click('#endBtn');
    await cell(page, 5, 5).click();
    await expect(page.locator('#codeLabel')).toHaveText('None');
    expect(page.mazeErrors).toEqual([]);
  });

  test('the printed page shows the code small under the maze', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Print layout is the same on every screen');
    await openApp(page, { size: 25, speed: 'Super fast' });
    await expect(page.locator('#printCode')).toBeHidden();
    await growMaze(page);
    const code = await currentCode(page);
    await expect(page.locator('#printCode')).toBeHidden();

    // Safari sizes print from a portrait screen; see print.spec.js.
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.emulateMedia({ media: 'print' });
    const line = page.locator('#printCode');
    await expect(line).toBeVisible();
    await expect(line).toHaveText(`Maze code ${code}`);
    const box = await line.boundingBox();
    const maze = await page.locator('#maze').boundingBox();
    const top = await page.locator('.section-title').evaluate(el => el.getBoundingClientRect().top);
    expect(box.y).toBeGreaterThanOrEqual(maze.y + maze.height);
    expect(await line.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeLessThan(12);
    // Still fits landscape Letter under Safari's header and footer.
    expect(box.y + box.height - top).toBeLessThan(6.8 * 96);

    for (const format of ['Letter', 'A4']) {
      for (const landscape of [false, true]) {
        const pdf = (await page.pdf({ format, landscape })).toString('latin1');
        expect((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(1);
      }
    }
    expect(page.mazeErrors).toEqual([]);
  });
});
