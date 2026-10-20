const { test, expect } = require('@playwright/test');
const { openApp, setSize, growMaze } = require('./helpers');

test.describe('Printing', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Print layout is the same on every screen');
  });

  test('prints only the maze: no controls, telemetry or search colours', async ({ page }) => {
    await openApp(page, { size: 15 });
    await growMaze(page);
    await page.click('#instantBtn');
    await page.emulateMedia({ media: 'print' });

    for (const sel of ['.sidebar', '.nav-bar', '.telemetry', '.legend', '#status', '#phaseLabel']) {
      await expect(page.locator(sel)).toBeHidden();
    }
    await expect(page.locator('#maze')).toBeVisible();

    const colours = await page.evaluate(() => {
      const bg = sel => getComputedStyle(document.querySelector(sel)).backgroundColor;
      return {
        wall: getComputedStyle(document.querySelector('#wallLayer line.on')).stroke,
        wallOpacity: getComputedStyle(document.querySelector('#wallLayer line.on')).opacity,
        border: getComputedStyle(document.getElementById('maze')).borderTopColor,
        explored: bg('#maze .cell.visited:not(.solution):not(.start):not(.end)'),
        gold: bg('#maze .cell.solution:not(.start):not(.end)')
      };
    });
    expect(colours.wall).toBe('rgb(28, 43, 79)');
    expect(colours.wallOpacity).toBe('1');
    expect(colours.border).toBe('rgb(28, 43, 79)');
    expect(colours.explored).toBe('rgb(255, 255, 255)');
    expect(colours.gold).toBe('rgb(255, 214, 10)');
  });

  test('nothing but the maze has a background, so no grey box prints around it', async ({ page }) => {
    await openApp(page, { size: 15 });
    await page.emulateMedia({ media: 'print' });

    const shaded = await page.evaluate(() => {
      const blank = c => c === 'rgba(0, 0, 0, 0)' || c === 'rgb(255, 255, 255)';
      const out = [];
      for (const el of [document.documentElement, document.body, ...document.body.querySelectorAll('*')]) {
        if (el.closest('#mazeStage') || el.closest('#successSheet')) continue;
        const cs = getComputedStyle(el);
        if (!el.getClientRects().length && el !== document.documentElement) continue;
        if (!blank(cs.backgroundColor) || cs.backgroundImage !== 'none') {
          out.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${el.className} ${cs.backgroundColor} ${cs.backgroundImage}`);
        }
      }
      return out;
    });
    expect(shaded).toEqual([]);
  });

  test('every maze size prints on one page, portrait or landscape', async ({ page }) => {
    await openApp(page);
    for (const size of [11, 25]) {
      await setSize(page, size);
      for (const format of ['Letter', 'A4']) {
        for (const landscape of [false, true]) {
          const pdf = (await page.pdf({ format, landscape })).toString('latin1');
          const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
          expect(pages, `${size} × ${size} on ${format}${landscape ? ' landscape' : ''}`).toBe(1);
        }
      }
    }
  });

  test('a small maze grows to fill the page instead of printing tiny', async ({ page }) => {
    await openApp(page, { size: 11 });
    // A Letter page in portrait, at 96 CSS px per inch.
    await page.setViewportSize({ width: 816, height: 1056 });
    await page.emulateMedia({ media: 'print' });
    const width = await page.locator('#maze').evaluate(el => el.getBoundingClientRect().width);
    // As wide as the 25 × 25 maze: about 6in at 96 CSS px per inch.
    expect(width).toBeGreaterThan(5.9 * 96);
    expect(width).toBeLessThanOrEqual(6 * 96 + 1);
  });

  test('with Safari sizing the page from a portrait screen, the maze and title still fit landscape paper', async ({ page }) => {
    // Safari takes vw, vh and orientation from the screen, so a portrait iPad
    // printing on landscape Letter gets the portrait rules. The printable
    // height there is about 6.8in once Safari adds its header and footer.
    await openApp(page, { size: 25 });
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.emulateMedia({ media: 'print' });
    const bottom = await page.locator('#maze').evaluate(el => el.getBoundingClientRect().bottom);
    const top = await page.locator('.section-title').evaluate(el => el.getBoundingClientRect().top);
    expect(bottom - top).toBeLessThan(6.6 * 96);
  });

  test('Print opens the print dialog in the browser', async ({ page }) => {
    await page.addInitScript(() => {
      window.printCalls = 0;
      window.print = () => { window.printCalls++; };
    });
    await openApp(page, { size: 11 });
    await page.click('#printBtn');
    expect(await page.evaluate(() => window.printCalls)).toBe(1);
  });

  test('in the Home Screen app, Print shares a picture of the maze to print', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true });
      window.printCalls = 0;
      window.print = () => { window.printCalls++; };
      navigator.canShare = data => Boolean(data && data.files && data.files.length);
      navigator.share = async data => { window.shared = data; };
    });
    await openApp(page, { size: 11 });
    await growMaze(page);
    await page.click('#instantBtn');
    await page.click('#printBtn');
    await page.waitForFunction(() => window.shared);

    const picture = await page.evaluate(async () => {
      const file = window.shared.files[0];
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      // Square centres in the picture: 64px squares inside a one-square margin
      // and the outer wall.
      const inset = 64 + Math.round(64 * 0.18);
      const colourAt = (r, c, dx = 0.5, dy = 0.5) =>
        [...ctx.getImageData(inset + (c + dx) * 64, inset + (r + dy) * 64, 1, 1).data.slice(0, 3)].join(',');
      const cells = [...document.querySelectorAll('#maze .cell')];
      const gold = cells.find(el => el.classList.contains('solution') && !el.matches('.start, .end'));
      const plain = cells.find(el => !el.matches('.solution, .start, .end'));
      const start = document.querySelector('#maze .cell.start');
      return {
        name: file.name,
        type: file.type,
        width: img.width,
        height: img.height,
        inset,
        prints: window.printCalls,
        gold: colourAt(+gold.dataset.r, +gold.dataset.c, 0.25, 0.25),
        plain: colourAt(+plain.dataset.r, +plain.dataset.c, 0.25, 0.25),
        start: colourAt(+start.dataset.r, +start.dataset.c, 0.2, 0.8)
      };
    });
    expect(picture.name).toBe('maze.png');
    expect(picture.type).toBe('image/png');
    expect(picture.width).toBe(11 * 64 + 2 * picture.inset);
    expect(picture.height).toBe(picture.width);
    expect(picture.prints).toBe(0);
    expect(picture.gold).toBe('255,214,10');
    expect(picture.plain).toBe('255,255,255');
    expect(picture.start).toBe('232,248,239');
  });

  test('the picture labels Start and Finish with the letters the grid shows', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true });
      navigator.canShare = () => true;
      navigator.share = async data => { window.shared = data; };
      const texts = [];
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
        texts.push(text);
        return fillText.call(this, text, ...rest);
      };
      window.pictureTexts = texts;
    });
    await openApp(page, { size: 11 });
    await page.click('#printBtn');
    await page.waitForFunction(() => window.shared);
    const { drawn, shown } = await page.evaluate(() => ({
      drawn: window.pictureTexts,
      shown: ['.start', '.end'].map(sel =>
        getComputedStyle(document.querySelector(`#maze .cell${sel}`), '::after').content.replace(/"/g, ''))
    }));
    expect(drawn).toEqual(shown);
  });

  test('in a Home Screen app that cannot share files, Print explains where to print', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true });
      navigator.canShare = () => false;
    });
    await openApp(page, { size: 11 });
    await page.click('#printBtn');
    await expect(page.locator('#status')).toContainText('Open the maze in Safari');
  });

  test('the Pencil line and result sheet are not printed', async ({ page }) => {
    await openApp(page, { size: 11 });
    await page.click('#userSolveBtn');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#userPathOverlay')).toBeHidden();
  });
});
