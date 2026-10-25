const { test, expect } = require('@playwright/test');
const { openApp, readMaze, growMaze } = require('./helpers');

// A share link is the page address with the maze code after #maze=. Opening
// it grows the very same maze, with no server involved.

const walls = maze => ({ right: maze.right, bottom: maze.bottom, start: maze.start, end: maze.end });

async function openCode(page) {
  const details = page.locator('#codeDetails');
  if (!(await details.evaluate(el => el.open))) await page.locator('#codeDetails summary').click();
}

// Records what Share link hands the share sheet instead of opening one.
async function catchShares(page) {
  await page.addInitScript(() => {
    window.sharedLinks = [];
    navigator.share = data => {
      window.sharedLinks.push(data);
      return Promise.resolve();
    };
  });
}

async function waitForBuilt(page) {
  await expect(page.locator('#phaseLabel')).toHaveText('Built', { timeout: 30_000 });
}

test.describe('Share links', () => {
  test('Share link hands over a link that grows the same maze on another screen', async ({ page, context }) => {
    await catchShares(page);
    await openApp(page, { size: 21, speed: 'Super fast' });
    await openCode(page);
    await expect(page.locator('#codeShareBtn')).toBeDisabled();
    const first = await growMaze(page);
    const code = await page.locator('#codeInput').inputValue();

    await page.click('#codeShareBtn');
    const shared = await page.evaluate(() => window.sharedLinks);
    expect(shared).toHaveLength(1);
    expect(shared[0].text).toContain(code);
    const link = new URL(shared[0].url);
    expect(link.hash).toBe(`#maze=${code}`);
    expect(link.search).toBe('');

    // A friend opens the link: a fresh page, another grid size saved.
    const friend = await context.newPage();
    const errors = [];
    friend.on('pageerror', err => errors.push(err.message));
    friend.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await friend.goto(link.href);
    await waitForBuilt(friend);
    const theirs = await readMaze(friend);
    expect(theirs.size).toBe(21);
    expect(walls(theirs)).toEqual(walls(first));
    // The code comes off the address once used, so a reload is just the app.
    expect(new URL(friend.url()).hash).toBe('');
    await expect(friend.locator('#codeLabel')).toHaveText(code);
    expect(errors).toEqual([]);
    expect(page.mazeErrors).toEqual([]);
  });

  test('a link tapped while the app is open grows its maze', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Same on every screen');
    await openApp(page, { size: 15, speed: 'Super fast' });
    const first = await growMaze(page);
    const code = await page.locator('#codeInput').inputValue();
    await page.click('#blankBtn');
    await growMaze(page);

    await page.evaluate(code => { location.hash = `maze=${code}`; }, code);
    await waitForBuilt(page);
    expect(walls(await readMaze(page))).toEqual(walls(first));
    expect(new URL(page.url()).hash).toBe('');
    expect(page.mazeErrors).toEqual([]);
  });

  test('a broken link says so and leaves the app working', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Same on every screen');
    await openApp(page, { size: 15, speed: 'Super fast' });
    await page.evaluate(() => { location.hash = 'maze=K7M2'; });
    await expect(page.locator('#codeNote')).toHaveClass(/error/);
    await expect(page.locator('#status')).toContainText('link');
    expect(new URL(page.url()).hash).toBe('');
    await growMaze(page);
    expect(page.mazeErrors).toEqual([]);
  });

  test('without a share sheet the link goes on the clipboard, and Paste takes a link', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Clipboard permissions are a desktop Chromium setting');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => { delete Navigator.prototype.share; });
    await openApp(page, { size: 15, speed: 'Super fast' });
    await openCode(page);
    const first = await growMaze(page);
    const code = await page.locator('#codeInput').inputValue();

    await page.click('#codeShareBtn');
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(new URL(link).hash).toBe(`#maze=${code}`);
    await expect(page.locator('#codeNote')).toContainText('Copied a link');

    // The link pasted into the installed app, which iOS will not open links in.
    await page.click('#blankBtn');
    await page.evaluate(text => navigator.clipboard.writeText(text), `Can you solve this? ${link}`);
    await page.click('#codePasteBtn');
    await waitForBuilt(page);
    expect(walls(await readMaze(page))).toEqual(walls(first));
    expect(page.mazeErrors).toEqual([]);
  });

  test('a whole link typed or pasted into the code box shrinks to its code', async ({ page }) => {
    await openApp(page, { size: 15, speed: 'Super fast' });
    const first = await growMaze(page);
    const code = await page.locator('#codeInput').inputValue();
    await page.click('#blankBtn');
    await openCode(page);

    const link = `https://thecitizensnips.github.io/maze-builder/#maze=${code}`;
    for (const pasted of [link, `Can you solve this maze? Maze code ${code} ${link}`, `${link.replace('#', '?fresh=1#')}&x=1`]) {
      await page.fill('#codeInput', pasted);
      await expect(page.locator('#codeInput')).toHaveValue(code);
    }
    // Typing a code by hand is left alone as it grows.
    await page.fill('#codeInput', code.slice(0, 7).toLowerCase());
    await expect(page.locator('#codeInput')).toHaveValue(code.slice(0, 7).toLowerCase());

    await page.fill('#codeInput', link);
    await page.click('#codeBuildBtn');
    await waitForBuilt(page);
    expect(walls(await readMaze(page))).toEqual(walls(first));
    expect(page.mazeErrors).toEqual([]);
  });

  test('in Kid Mode a link grows its maze instead of a random one', async ({ page, context }) => {
    await catchShares(page);
    await openApp(page, { size: 15, speed: 'Super fast' });
    const first = await growMaze(page);
    await page.click('#codeDetails summary');
    await page.click('#codeShareBtn');
    const link = await page.evaluate(() => window.sharedLinks[0].url);

    await page.click('#simpleModeBtn');
    await expect(page.locator('html')).toHaveClass(/simple-mode/);
    const kid = await context.newPage();
    await kid.goto(link);
    await expect(kid.locator('html')).toHaveClass(/simple-mode/);
    await expect.poll(async () => walls(await readMaze(kid)), { timeout: 30_000 }).toEqual(walls(first));
    expect(page.mazeErrors).toEqual([]);
  });
});
