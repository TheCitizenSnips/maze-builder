// Shared helpers for the Maze Builder tests. Everything here reads the app
// through the page itself (DOM classes, visible text) and drives it with real
// pointer input, the same way a child would.
const { expect } = require('@playwright/test');

/** Open the app and fail the test on any console error or page exception. */
async function openApp(page, { size, speed = 'Fast' } = {}) {
  const errors = [];
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.mazeErrors = errors;

  await page.goto('./');
  await expect(page.locator('#maze .cell').first()).toBeVisible();
  if (size) await setSize(page, size);
  if (speed) await page.selectOption('#speedSelect', { label: speed });
  return errors;
}

async function setSize(page, size) {
  await page.selectOption('#sizeSelect', String(size));
  await expect(page.locator('#maze .cell')).toHaveCount(size * size);
}

/** Snapshot of the maze as the page shows it. */
async function readMaze(page) {
  return page.evaluate(() => {
    const cells = [...document.querySelectorAll('#maze .cell')];
    const size = Math.round(Math.sqrt(cells.length));
    const walls = [];
    const classes = [];
    let start = null;
    let end = null;
    for (const el of cells) {
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      (walls[r] ||= [])[c] = el.classList.contains('wall');
      (classes[r] ||= [])[c] = [...el.classList];
      if (el.classList.contains('start')) start = { r, c };
      if (el.classList.contains('end')) end = { r, c };
    }
    return { size, walls, classes, start, end };
  });
}

function cellsWithClass(maze, cls) {
  const out = [];
  for (let r = 0; r < maze.size; r++) {
    for (let c = 0; c < maze.size; c++) {
      if (maze.classes[r][c].includes(cls)) out.push({ r, c });
    }
  }
  return out;
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/** Independent BFS used to check the app's answers. Returns cells S..E or null. */
function shortestPath(maze, from = maze.start, to = maze.end) {
  const k = p => `${p.r},${p.c}`;
  const prev = new Map([[k(from), null]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (cur.r === to.r && cur.c === to.c) {
      const path = [];
      for (let p = cur; p; p = prev.get(k(p))) path.push(p);
      return path.reverse();
    }
    for (const [dr, dc] of DIRS) {
      const n = { r: cur.r + dr, c: cur.c + dc };
      if (n.r < 0 || n.c < 0 || n.r >= maze.size || n.c >= maze.size) continue;
      if (maze.walls[n.r][n.c] || prev.has(k(n))) continue;
      prev.set(k(n), cur);
      queue.push(n);
    }
  }
  return null;
}

function reachableCount(maze, from = maze.start) {
  const seen = new Set([`${from.r},${from.c}`]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    for (const [dr, dc] of DIRS) {
      const n = { r: queue[i].r + dr, c: queue[i].c + dc };
      if (n.r < 0 || n.c < 0 || n.r >= maze.size || n.c >= maze.size) continue;
      if (maze.walls[n.r][n.c] || seen.has(`${n.r},${n.c}`)) continue;
      seen.add(`${n.r},${n.c}`);
      queue.push(n);
    }
  }
  return seen.size;
}

function cell(page, r, c) {
  return page.locator(`#maze .cell[data-r="${r}"][data-c="${c}"]`);
}

async function cellCenter(page, r, c) {
  const box = await cell(page, r, c).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function growMaze(page) {
  await page.click('#generateBtn');
  await expect(page.locator('#phaseLabel')).toHaveText('Built', { timeout: 30_000 });
  return readMaze(page);
}

/**
 * A pointer that can press, move and lift. 'mouse' works everywhere;
 * 'touch' and 'pen' use Chromium's DevTools input so the page sees real
 * pointerType values, as it would from a finger or Apple Pencil.
 */
async function makePointer(page, type = 'mouse') {
  if (type === 'mouse') {
    return {
      type,
      down: async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); },
      move: async (x, y) => page.mouse.move(x, y),
      up: async () => page.mouse.up()
    };
  }

  const cdp = await page.context().newCDPSession(page);

  if (type === 'touch') {
    return {
      type,
      cdp,
      down: async (x, y, id = 0) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id }] }),
      move: async (x, y, id = 0) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id }] }),
      up: async () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    };
  }

  if (type === 'pen') {
    const send = (eventType, x, y, buttons) => cdp.send('Input.dispatchMouseEvent', {
      type: eventType, x, y, button: 'left', buttons, clickCount: 1, pointerType: 'pen'
    });
    let last = { x: 0, y: 0 };
    return {
      type,
      cdp,
      down: async (x, y) => { last = { x, y }; await send('mousePressed', x, y, 1); },
      move: async (x, y) => { last = { x, y }; await send('mouseMoved', x, y, 1); },
      up: async () => send('mouseReleased', last.x, last.y, 0)
    };
  }

  throw new Error(`Unknown pointer type ${type}`);
}

/** The pointer a project naturally uses: touch on the iPad/iPhone projects. */
function defaultPointerType(testInfo) {
  const name = testInfo.project.name;
  return name === 'ipad' || name === 'iphone' ? 'touch' : 'mouse';
}

/**
 * Press on the first cell (or, with alreadyDown, carry on from a stroke left
 * down by keepDown), glide through every following cell centre and, unless
 * keepDown is set, lift at the end.
 */
async function traceCells(page, cells, { pointer, keepDown = false, alreadyDown = false, stepsPerCell = 3 } = {}) {
  if (!alreadyDown) await page.locator('#maze').scrollIntoViewIfNeeded();
  const centres = [];
  for (const p of cells) centres.push(await cellCenter(page, p.r, p.c));

  if (alreadyDown) await pointer.move(centres[0].x, centres[0].y);
  else await pointer.down(centres[0].x, centres[0].y);
  for (let i = 1; i < centres.length; i++) {
    const a = centres[i - 1];
    const b = centres[i];
    for (let s = 1; s <= stepsPerCell; s++) {
      await pointer.move(a.x + (b.x - a.x) * s / stepsPerCell, a.y + (b.y - a.y) * s / stepsPerCell);
    }
  }
  if (!keepDown) await pointer.up();
}

async function metric(page, n) {
  const ids = ['metricProgress', 'metricExplored', 'metricFrontier', 'metricDistance', 'metricShortest'];
  return (await page.locator(`#${ids[n - 1]}`).textContent()).trim();
}

/** Click a cell (mouse) to toggle a wall in Walls mode. */
async function toggleWall(page, r, c) {
  await page.locator('#maze').scrollIntoViewIfNeeded();
  const p = await cellCenter(page, r, c);
  await page.mouse.click(p.x, p.y);
}

/** Straight route along row 1 then down the last open column of a blank grid. */
function blankRoute(size) {
  const route = [];
  for (let c = 1; c <= size - 2; c++) route.push({ r: 1, c });
  for (let r = 2; r <= size - 2; r++) route.push({ r, c: size - 2 });
  return route;
}

module.exports = {
  openApp,
  setSize,
  readMaze,
  cellsWithClass,
  shortestPath,
  reachableCount,
  cell,
  cellCenter,
  growMaze,
  makePointer,
  defaultPointerType,
  traceCells,
  metric,
  toggleWall,
  blankRoute
};
