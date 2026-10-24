const { test, expect } = require('@playwright/test');
const { openApp, setSize, growMaze } = require('./helpers');

/** The colour a cell or swatch is painted, as the browser reports it. */
const background = locator => locator.evaluate(el => getComputedStyle(el).backgroundColor);

async function pickColour(page, trace, hue) {
  await page.click(`.legend-pick[data-trace="${trace}"]`);
  const palette = page.locator('#tracePalette');
  await expect(palette).toBeVisible();
  await palette.locator(`.trace-swatch[aria-label="${hue}"]`).click();
  await expect(palette).toBeHidden();
}

test.describe('Trace colours', () => {
  test('tapping a key colour opens a palette, and purple paints the shortest path', async ({ page }) => {
    await openApp(page, { size: 11, speed: 'Super fast' });

    const pick = page.locator('.legend-pick[data-trace="solution"]');
    await pick.click();
    const palette = page.locator('#tracePalette');
    await expect(palette).toBeVisible();
    await expect(pick).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#tracePaletteTitle')).toHaveText('Shortest path colour');
    await expect(palette.locator('.trace-swatch')).toHaveCount(8);
    await expect(palette.locator('[aria-checked="true"]')).toHaveAttribute('aria-label', 'Gold');

    // The palette stays on screen and every swatch is finger-sized.
    const box = await palette.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
    const swatch = await palette.locator('.trace-swatch').first().boundingBox();
    expect(swatch.width).toBeGreaterThanOrEqual(44);
    expect(swatch.height).toBeGreaterThanOrEqual(44);

    await palette.locator('.trace-swatch[aria-label="Purple"]').click();
    await expect(palette).toBeHidden();
    await expect(pick).toHaveAttribute('aria-expanded', 'false');
    expect(await background(pick.locator('.swatch'))).toBe('rgb(180, 94, 230)');

    await growMaze(page);
    await page.click('#animateBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Solved', { timeout: 60_000 });
    const route = page.locator('#maze .cell.solution:not(.start):not(.end)').first();
    expect(await background(route)).toBe('rgb(180, 94, 230)');
    expect(page.mazeErrors).toEqual([]);
  });

  test('the same hue still keeps explored squares softer than the route', async ({ page }) => {
    await openApp(page, { size: 11 });
    await pickColour(page, 'visited', 'Purple');
    await pickColour(page, 'solution', 'Purple');
    const explored = await background(page.locator('.legend-pick[data-trace="visited"] .swatch'));
    const route = await background(page.locator('.legend-pick[data-trace="solution"] .swatch'));
    expect(explored).not.toBe(route);
  });

  test('a tap elsewhere or Escape closes the palette without changing anything', async ({ page }) => {
    await openApp(page);
    await page.click('.legend-pick[data-trace="frontier"]');
    await expect(page.locator('#tracePalette')).toBeVisible();
    await page.locator('.app-title').click();
    await expect(page.locator('#tracePalette')).toBeHidden();

    await page.click('.legend-pick[data-trace="frontier"]');
    await page.keyboard.press('Escape');
    await expect(page.locator('#tracePalette')).toBeHidden();
    expect(await background(page.locator('.legend-pick[data-trace="frontier"] .swatch'))).toBe('rgb(156, 221, 255)');
  });

  test('picked colours come back next time, and Reset all options forgets every choice', async ({ page }) => {
    await openApp(page, { speed: 'Slow' });
    await setSize(page, 21);
    await pickColour(page, 'frontier', 'Pink');
    await pickColour(page, 'solution', 'Purple');

    await page.reload();
    await expect(page.locator('#maze .cell')).toHaveCount(21 * 21);
    expect(await background(page.locator('.legend-pick[data-trace="frontier"] .swatch'))).toBe('rgb(255, 176, 198)');
    expect(await background(page.locator('.legend-pick[data-trace="solution"] .swatch'))).toBe('rgb(180, 94, 230)');

    // Folded behind the ⓘ, and it takes two taps.
    const reset = page.locator('#resetOptionsBtn');
    await expect(reset).toBeHidden();
    await page.click('#appInfoBtn');
    await reset.click();
    await expect(reset).toHaveText('Tap again to reset');
    await expect(page.locator('#maze .cell')).toHaveCount(21 * 21);
    await reset.click();

    await page.waitForLoadState('load');
    await expect(page.locator('#maze .cell')).toHaveCount(15 * 15);
    await expect(page.locator('#speedSelect option:checked')).toHaveText('Fast');
    expect(await background(page.locator('.legend-pick[data-trace="frontier"] .swatch'))).toBe('rgb(156, 221, 255)');
    expect(await background(page.locator('.legend-pick[data-trace="solution"] .swatch'))).toBe('rgb(255, 214, 10)');
  });

  test('closing the info menu cancels a half-done reset', async ({ page }) => {
    await openApp(page);
    await page.click('#appInfoBtn');
    await page.click('#resetOptionsBtn');
    await page.keyboard.press('Escape');
    await page.click('#appInfoBtn');
    await expect(page.locator('#resetOptionsBtn')).toHaveText('Reset all options');
  });
});
