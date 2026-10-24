const { createHash } = require('crypto');
const { test, expect } = require('@playwright/test');
const { openApp, readMaze, growMaze, toggleWall, cell } = require('./helpers');

// Every grown maze has a code: its seed plus every setting the planner reads.
// Typing the code back in must grow exactly the same maze.

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
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}-medium$/);
    await expect(page.locator('#codeLabel')).toHaveText(code.slice(0, 6));

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
    expect(code).toMatch(new RegExp(`^\\w{6}-21-314-heart-s${spot.r + 1}\\.${spot.c + 1}-f\\d+\\.\\d+$`));

    // Everything back to something else.
    await page.click('[data-level="easy"]');
    await expect(page.locator('#maze .cell')).toHaveCount(121);

    const again = await growCode(page, code);
    expect(again.size).toBe(21);
    expect(walls(again)).toEqual(walls(first));
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
      'K7M2QX-easy': '74c6c5454460',
      'K7M2QX-medium': '342af42b3fdd',
      'K7M2QX-hard-heart': 'ab2d8842d239',
      'K7M2QX-51-213-cat-s10.10-f30.30': '9498b4e7aaa9'
    };
    for (const [code, fingerprint] of Object.entries(known)) {
      const maze = await growCode(page, code);
      const bits = [...maze.right.flat(), ...maze.bottom.flat()].map(Number).join('');
      expect(createHash('sha1').update(bits).digest('hex').slice(0, 12), code).toBe(fingerprint);
      expect(await currentCode(page)).toBe(code);
    }
    expect(page.mazeErrors).toEqual([]);
  });

  test('a seed on its own grows that seed on the maze as it is set up', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Planner behaviour is the same on every screen');
    await openApp(page, { size: 15, speed: 'Super fast' });
    const one = await growCode(page, 'k7m2qx');
    expect(await currentCode(page)).toBe('K7M2QX-medium');
    await page.click('#blankBtn');
    // Crockford spelling slips: O for 0, I or L for 1.
    const two = await growCode(page, 'K7M2QX');
    expect(walls(two)).toEqual(walls(one));

    await page.click('[data-level="hard"]');
    const hard = await growCode(page, ' K7M2QX ');
    expect(hard.size).toBe(21);
    expect(await currentCode(page)).toBe('K7M2QX-hard');

    expect(walls(await growCode(page, 'IO0L1O'))).toEqual(walls(await growCode(page, '100110')));
    expect(page.mazeErrors).toEqual([]);
  });

  test('a mistyped code says what is wrong and leaves the maze alone', async ({ page }) => {
    await openApp(page, { size: 15, speed: 'Super fast' });
    const before = await growMaze(page);
    const code = await currentCode(page);
    await openCode(page);
    for (const bad of ['K7M2', 'K7M2QX-giant', 'K7M2QX-12-213', 'K7M2QX-11-213-heart', 'K7M2QX-medium-s1.1', 'K7M2QX-medium-s1.1-f1.1']) {
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
