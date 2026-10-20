const { test, expect } = require('@playwright/test');
const { openApp, makePointer, defaultPointerType, traceCells, blankRoute } = require('./helpers');

const TOPICS = {
  grow: 'How a maze grows',
  search: 'How the search finds the way',
  solve: 'Solve it yourself'
};

const openSheet = page => page.locator('dialog.info-sheet[open]');

/** The ⓘ button beside a sidebar heading, by its accessible name. */
const infoButton = (page, name) => page.getByRole('button', { name, exact: true });

test.describe('Learn sheets', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, { size: 11 });
  });

  test('the ⓘ buttons open a reading sheet that Done closes', async ({ page }) => {
    await expect(openSheet(page)).toHaveCount(0);

    for (const [topic, title] of Object.entries({ grow: TOPICS.grow, search: TOPICS.search })) {
      await infoButton(page, title).click();
      await expect(openSheet(page)).toHaveCount(1);
      await expect(page.locator(`#info-${topic}`)).toBeVisible();
      await expect(page.locator(`#info-${topic} h2`)).toHaveText(title);
      await page.locator(`#info-${topic} [data-info-close]`).click();
      await expect(openSheet(page)).toHaveCount(0);
    }
    expect(page.mazeErrors).toEqual([]);
  });

  test('the explainers name the real algorithms and checks', async ({ page }) => {
    await expect(page.locator('#info-grow')).toContainText('depth-first search');
    await expect(page.locator('#info-grow')).toContainText('backtracking');
    await expect(page.locator('#info-grow')).toContainText('If the trip is too short');
    await expect(page.locator('#info-search')).toContainText('breadth-first search');
    await expect(page.locator('#info-search')).toContainText('fewest steps possible');
    for (const label of ['Time', 'Cells', 'Best', 'Efficiency', 'Backtracks']) {
      await expect(page.locator('#info-solve dt', { hasText: label })).toHaveCount(1);
    }
  });

  test('Escape and a tap on the backdrop close the sheet', async ({ page }) => {
    await page.click('.learn-list [data-info="search"]');
    await expect(page.locator('#info-search')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(openSheet(page)).toHaveCount(0);

    await page.click('.learn-list [data-info="solve"]');
    await expect(page.locator('#info-solve')).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(openSheet(page)).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveClass(/info-open/);
  });

  test('Next leads from one sheet to the following one', async ({ page }) => {
    await page.click('.learn-list [data-info="grow"]');
    await page.locator('#info-grow .info-next').click();
    await expect(page.locator('#info-search')).toBeVisible();
    await expect(openSheet(page)).toHaveCount(1);
    await page.locator('#info-search .info-next').click();
    await expect(page.locator('#info-solve')).toBeVisible();
    await expect(openSheet(page)).toHaveCount(1);
  });

  test('the ⓘ by the maze title explains what the maze is doing now', async ({ page }) => {
    const now = page.locator('#infoNowBtn');
    const closeOpen = () => page.locator('dialog.info-sheet[open] [data-info-close]').click();

    await now.click();
    await expect(page.locator('#info-grow')).toBeVisible();
    await closeOpen();

    await page.click('#instantBtn');
    await expect(page.locator('#maze .cell.solution').first()).toBeAttached();
    await now.click();
    await expect(page.locator('#info-search')).toBeVisible();
    await closeOpen();

    await page.click('#userSolveBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Your Turn');
    await now.click();
    await expect(page.locator('#info-solve')).toBeVisible();
    await closeOpen();
    expect(page.mazeErrors).toEqual([]);
  });

  test('reading during growth leaves the growth running', async ({ page }) => {
    await page.selectOption('#speedSelect', { label: 'Slow' });
    await page.click('#generateBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Growing');
    await expect(infoButton(page, TOPICS.grow)).toBeEnabled();
    await infoButton(page, TOPICS.grow).click();
    await expect(page.locator('#info-grow')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#phaseLabel')).toHaveText('Growing');
    expect(page.mazeErrors).toEqual([]);
  });

  test('the success sheet links to how the score works', async ({ page }, testInfo) => {
    const pointer = await makePointer(page, defaultPointerType(testInfo));
    await page.click('#userSolveBtn');
    await traceCells(page, blankRoute(11), { pointer });
    await expect(page.locator('#successSheet')).toBeVisible();

    await page.click('.success-learn');
    await expect(page.locator('#info-solve')).toBeVisible();
    await expect(page.locator('#info-solve-score')).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(openSheet(page)).toHaveCount(0);
    await expect(page.locator('#successSheet')).toBeVisible();
    expect(page.mazeErrors).toEqual([]);
  });

  test('sheets fit the screen and scroll inside, never sideways', async ({ page }) => {
    for (const topic of Object.keys(TOPICS)) {
      await page.click(`.learn-list [data-info="${topic}"]`);
      const fit = await page.evaluate(id => {
        const sheet = document.getElementById(id);
        const r = sheet.getBoundingClientRect();
        const body = sheet.querySelector('.info-sheet-body');
        return {
          top: r.top, bottom: r.bottom, left: r.left, right: r.right,
          vw: window.innerWidth, vh: window.innerHeight,
          sideways: body.scrollWidth - body.clientWidth
        };
      }, `info-${topic}`);
      expect(fit.top).toBeGreaterThanOrEqual(0);
      expect(fit.bottom).toBeLessThanOrEqual(fit.vh + 1);
      expect(fit.left).toBeGreaterThanOrEqual(0);
      expect(fit.right).toBeLessThanOrEqual(fit.vw + 1);
      expect(fit.sideways).toBeLessThanOrEqual(0);
      await page.keyboard.press('Escape');
    }
  });

  test('the ⓘ buttons and sheets stay out of print', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Print layout is the same on every screen');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#infoNowBtn')).toBeHidden();
  });
});
