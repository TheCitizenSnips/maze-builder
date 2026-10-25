const { test, expect } = require('@playwright/test');
const Shapes = require('../shapes.js');
const {
  openApp, setSize, readMaze, growMaze, reachableCount, wallCount, shortestPath, cellsWithClass,
  cell, makePointer, defaultPointerType, traceCells, metric, toggleWall
} = require('./helpers');

// Every size the app offers a shape on, plus bigger ones so a larger board
// later needs no new drawings.
const SIZES = [15, 21, 25, 31, 41, 51];
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/** Squares reachable from `from` without leaving the mask. */
function maskReach(mask, from) {
  const n = mask.length;
  const seen = new Set([`${from.r},${from.c}`]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    for (const [dr, dc] of DIRS) {
      const r = queue[i].r + dr;
      const c = queue[i].c + dc;
      if (r < 0 || c < 0 || r >= n || c >= n || !mask[r][c] || seen.has(`${r},${c}`)) continue;
      seen.add(`${r},${c}`);
      queue.push({ r, c });
    }
  }
  return seen.size;
}

/** Steps from `from` to `to` without leaving the mask. */
function maskWalk(mask, from, to) {
  const n = mask.length;
  const dist = new Map([[`${from.r},${from.c}`, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const d = dist.get(`${queue[i].r},${queue[i].c}`);
    if (queue[i].r === to.r && queue[i].c === to.c) return d;
    for (const [dr, dc] of DIRS) {
      const r = queue[i].r + dr;
      const c = queue[i].c + dc;
      if (r < 0 || c < 0 || r >= n || c >= n || !mask[r][c] || dist.has(`${r},${c}`)) continue;
      dist.set(`${r},${c}`, d + 1);
      queue.push({ r, c });
    }
  }
  return -1;
}

const inside = (mask, p) => mask[p.r][p.c];
const insideCount = mask => mask.flat().filter(Boolean).length;

/** Pick a shape from its picture tile. */
async function pickShape(page, id) {
  const details = page.locator('#shapeDetails');
  if (!(await details.evaluate(el => el.open))) await page.click('#shapeDetails summary');
  await page.click(`.shape-tile[data-shape="${id}"]`);
  await expect(page.locator(`.shape-tile[data-shape="${id}"]`)).toHaveAttribute('aria-checked', 'true');
}

test.describe('Shape masks', () => {
  // Pure checks on shapes.js; once is enough.
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop'));

  test('there are 23 pictures plus the plain square', () => {
    expect(Shapes.list[0].id).toBe('square');
    expect(Shapes.list).toHaveLength(24);
  });

  test('the donut keeps its hole at every size', () => {
    for (const n of SIZES) {
      const mask = Shapes.mask('donut', n);
      const mid = Math.floor(n / 2);
      expect(mask[mid][mid], `donut at ${n}`).toBe(false);
      // The hole is closed in: walking out from the middle through off
      // squares never reaches the edge of the grid.
      const seen = new Set([`${mid},${mid}`]);
      const queue = [[mid, mid]];
      for (let i = 0; i < queue.length; i++) {
        for (const [dr, dc] of DIRS) {
          const r = queue[i][0] + dr;
          const c = queue[i][1] + dc;
          expect(r >= 0 && c >= 0 && r < n && c < n, `donut hole at ${n}`).toBe(true);
          if (mask[r][c] || seen.has(`${r},${c}`)) continue;
          seen.add(`${r},${c}`);
          queue.push([r, c]);
        }
      }
      expect(seen.size / (n * n), `donut at ${n}`).toBeGreaterThan(0.06);
    }
  });

  for (const { id } of Shapes.list) {
    test(`${id} is one connected piece that fills the grid at every size`, () => {
      for (const n of SIZES) {
        const mask = Shapes.mask(id, n);
        const count = insideCount(mask);
        const { start, end } = Shapes.ends(id, n);

        expect(mask).toHaveLength(n);
        // Uses a good share of the grid, and reaches all four edges of it.
        expect(count / (n * n), `${id} at ${n}`).toBeGreaterThan(0.4);
        expect(mask[0].some(Boolean) && mask[n - 1].some(Boolean), `${id} at ${n} rows`).toBe(true);
        expect(mask.some(row => row[0]) && mask.some(row => row[n - 1]), `${id} at ${n} columns`).toBe(true);
        // One piece: every square joins up side to side.
        expect(inside(mask, start) && inside(mask, end)).toBe(true);
        expect(maskReach(mask, start), `${id} at ${n}`).toBe(count);
        // Start and Finish sit well apart: across the grid, or (the snail's
        // coiled shell) a long walk apart.
        const apart = Math.abs(start.r - end.r) + Math.abs(start.c - end.c);
        if (apart < n * 0.6) expect(maskWalk(mask, start, end), `${id} at ${n}`).toBeGreaterThanOrEqual(n * 2);
      }
    });
  }

  test('a square grid keeps Start and Finish in the corners', () => {
    for (const n of SIZES) {
      expect(Shapes.ends('square', n)).toEqual({ start: { r: 0, c: 0 }, end: { r: n - 1, c: n - 1 } });
      expect(insideCount(Shapes.mask('square', n))).toBe(n * n);
    }
  });
});

test.describe('Shaped mazes', () => {
  test('a shape tile shows the shape, and it is remembered', async ({ page }) => {
    await openApp(page, { size: 15 });
    await pickShape(page, 'cat');
    const mask = Shapes.mask('cat', 15);
    const { start, end } = Shapes.ends('cat', 15);

    await expect(page.locator('#shapeLabel')).toHaveText('Cat');
    await expect(page.locator('#maze .cell.off')).toHaveCount(15 * 15 - insideCount(mask));
    await expect(page.locator('#wallLayer .shape-outline')).toHaveCount(1);
    await expect(cell(page, start.r, start.c)).toHaveClass(/start/);
    await expect(cell(page, end.r, end.c)).toHaveClass(/end/);

    // The shape scales with the size and comes back after a reload.
    await setSize(page, 21);
    await expect(page.locator('#maze .cell.off')).toHaveCount(21 * 21 - insideCount(Shapes.mask('cat', 21)));
    await page.reload();
    await expect(page.locator('#shapeLabel')).toHaveText('Cat');
    await expect(page.locator('#maze .cell.off')).toHaveCount(21 * 21 - insideCount(Shapes.mask('cat', 21)));

    // Back to the plain square grid.
    await pickShape(page, 'square');
    await expect(page.locator('#maze .cell.off')).toHaveCount(0);
    await expect(page.locator('#wallLayer .shape-outline')).toHaveCount(0);
    expect(page.mazeErrors).toEqual([]);
  });

  for (const [id, size] of [['dinosaur', 15], ['castle', 21], ['butterfly', 25]]) {
    test(`a ${id} maze grows to fill exactly the shape (${size} × ${size})`, async ({ page }) => {
      await openApp(page, { size, speed: 'Super fast' });
      await pickShape(page, id);
      const mask = Shapes.mask(id, size);
      const count = insideCount(mask);

      const maze = await growMaze(page);
      // A perfect maze over the shape's squares: all reachable, no loops,
      // and no door ever opens through the outline.
      expect(reachableCount(maze)).toBe(count);
      expect(2 * size * (size - 1) - wallCount(maze)).toBe(count - 1);
      expect(cellsWithClass(maze, 'off')).toHaveLength(size * size - count);

      // The search keeps to the shape and finds a true shortest route.
      await page.click('#instantBtn');
      const solved = await readMaze(page);
      const gold = cellsWithClass(solved, 'solution');
      expect(gold.every(p => inside(mask, p))).toBe(true);
      expect(gold.length).toBe(shortestPath(solved).length);
      expect(page.mazeErrors).toEqual([]);
    });
  }

  test('the outline cannot be drawn on, and Start stays inside the shape', async ({ page }) => {
    await openApp(page, { size: 15 });
    await pickShape(page, 'heart');
    const mask = Shapes.mask('heart', 15);

    // An inside edge still toggles.
    const before = await readMaze(page);
    await toggleWall(page, 5, 4, 'right');
    expect(wallCount(await readMaze(page))).toBe(wallCount(before) + 1);

    // An edge on the outline stays a wall.
    const r = mask.findIndex(row => row.some(Boolean));
    const c = mask[r].findIndex(Boolean);
    expect(c).toBeGreaterThan(0);
    await toggleWall(page, r, c - 1, 'right');
    await expect(page.locator('#status')).toContainText('outline');
    expect(wallCount(await readMaze(page))).toBe(wallCount(before) + 1);

    // Start cannot go outside the shape.
    await page.click('#startBtn');
    await cell(page, 0, 0).click();
    await expect(page.locator('#status')).toContainText('outside the shape');
    await expect(cell(page, 0, 0)).not.toHaveClass(/start/);
    expect(page.mazeErrors).toEqual([]);
  });

  test('a child can solve a shaped maze along the best route for 100%', async ({ page }, testInfo) => {
    await openApp(page, { size: 15, speed: 'Super fast' });
    await pickShape(page, 'rocket');
    const maze = await growMaze(page);
    const route = shortestPath(maze);

    const pointer = await makePointer(page, defaultPointerType(testInfo));
    await traceCells(page, route, { pointer });
    await expect(page.locator('#phaseLabel')).toHaveText('Complete');
    expect(await metric(page, 4)).toBe('100%');
    expect(page.mazeErrors).toEqual([]);
  });

  test('the printed picture follows the outline, not the square border', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true });
      navigator.canShare = data => Boolean(data && data.files && data.files.length);
      navigator.share = async data => { window.shared = data; };
    });
    await openApp(page, { size: 15 });
    await pickShape(page, 'heart');
    const mask = Shapes.mask('heart', 15);
    const r = mask.findIndex(row => row.some(Boolean));
    const c = mask[r].findIndex(Boolean);
    expect(mask[0][0]).toBe(false);

    await page.click('#printBtn');
    await page.waitForFunction(() => window.shared);
    const colours = await page.evaluate(async ({ r, c }) => {
      const img = new Image();
      img.src = URL.createObjectURL(window.shared.files[0]);
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const inset = 64 + Math.round(64 * 0.18);
      const at = (x, y) => [...ctx.getImageData(inset + x * 64, inset + y * 64, 1, 1).data.slice(0, 3)].join(',');
      return {
        // The middle of the outline edge on the left of the first square.
        outline: at(c, r + 0.5),
        // Where a square maze's border would run, beside a square outside the shape.
        oldBorder: at(-0.05, 0.5),
        outside: at(0.5, 0.5)
      };
    }, { r, c });
    expect(colours.outline).toBe('28,43,79');
    expect(colours.oldBorder).toBe('255,255,255');
    expect(colours.outside).toBe('255,255,255');
    expect(page.mazeErrors).toEqual([]);
  });

  test('shapes start at 15 × 15: smaller grids are square', async ({ page }) => {
    expect(Shapes.minSize).toBe(15);
    await openApp(page, { size: 11 });
    await page.click('#shapeDetails summary');
    // Only a grid too small for pictures explains the size rule.
    await expect(page.locator('#shapeNote')).toBeVisible();

    // Picking a shape on 11 × 11 grows the grid to 15 × 15.
    await pickShape(page, 'star');
    await expect(page.locator('#sizeSelect')).toHaveValue('15');
    await expect(page.locator('#maze .cell')).toHaveCount(15 * 15);
    await expect(page.locator('#maze .cell.off')).toHaveCount(15 * 15 - insideCount(Shapes.mask('star', 15)));
    await expect(page.locator('#status')).toContainText('15 × 15');
    await expect(page.locator('#shapeNote')).toBeHidden();
    for (const n of [21, 25, 15]) {
      await setSize(page, n);
      await expect(page.locator('#shapeLabel')).toHaveText('Star');
      await expect(page.locator('#shapeNote')).toBeHidden();
      await expect(page.locator('#status')).not.toContainText('square');
    }

    // Going back down to 11 × 11, by size or by Easy, makes it a square again.
    await setSize(page, 11);
    await expect(page.locator('#shapeLabel')).toHaveText('Square');
    await expect(page.locator('#maze .cell.off')).toHaveCount(0);
    await expect(page.locator('#status')).toContainText('square');

    await pickShape(page, 'cat');
    await page.click('.level-picker [data-level="easy"]');
    await expect(page.locator('#sizeSelect')).toHaveValue('11');
    await expect(page.locator('#shapeLabel')).toHaveText('Square');

    // An old saved shape on a small grid also comes back square.
    await page.evaluate(() => localStorage.setItem('mazeBuilder.settings', JSON.stringify({ size: '11', shape: 'cat' })));
    await page.reload();
    await expect(page.locator('#shapeLabel')).toHaveText('Square');
    await expect(page.locator('#maze .cell.off')).toHaveCount(0);
    expect(page.mazeErrors).toEqual([]);
  });

  test('shape tiles are locked while a maze grows', async ({ page }) => {
    await openApp(page, { size: 25, speed: 'Slow' });
    await page.click('#shapeDetails summary');
    await page.click('#generateBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Growing');
    await expect(page.locator('.shape-tile[data-shape="star"]')).toBeDisabled();
  });
});
