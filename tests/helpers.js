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

/**
 * Snapshot of the maze as the page shows it. Walls sit on the edges between
 * squares: right[r][c] is the wall between (r, c) and (r, c + 1), bottom[r][c]
 * the wall between (r, c) and (r + 1, c). The outside is always walled.
 */
async function readMaze(page) {
  return page.evaluate(() => {
    const cells = [...document.querySelectorAll('#maze .cell')];
    const size = Math.round(Math.sqrt(cells.length));
    const classes = [];
    let start = null;
    let end = null;
    for (const el of cells) {
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      (classes[r] ||= [])[c] = [...el.classList];
      if (el.classList.contains('start')) start = { r, c };
      if (el.classList.contains('end')) end = { r, c };
    }
    const right = Array.from({ length: size }, () => Array(size - 1).fill(false));
    const bottom = Array.from({ length: size - 1 }, () => Array(size).fill(false));
    for (const line of document.querySelectorAll('#wallLayer line')) {
      const side = line.getAttribute('data-side');
      const r = Number(line.getAttribute('data-r'));
      const c = Number(line.getAttribute('data-c'));
      (side === 'right' ? right : bottom)[r][c] = line.classList.contains('on');
    }
    return { size, right, bottom, classes, start, end };
  });
}

/** True when a step from a to b is blocked by a wall, the border, or is not one square. */
function blocked(maze, a, b) {
  const inside = p => p.r >= 0 && p.c >= 0 && p.r < maze.size && p.c < maze.size;
  if (!inside(a) || !inside(b)) return true;
  if (a.r === b.r && Math.abs(a.c - b.c) === 1) return maze.right[a.r][Math.min(a.c, b.c)];
  if (a.c === b.c && Math.abs(a.r - b.r) === 1) return maze.bottom[Math.min(a.r, b.r)][a.c];
  return true;
}

/** Number of inner walls standing. */
function wallCount(maze) {
  return [...maze.right.flat(), ...maze.bottom.flat()].filter(Boolean).length;
}

/** Every inner edge as { side, r, c }. */
function allEdges(maze) {
  const out = [];
  maze.right.forEach((row, r) => row.forEach((_, c) => out.push({ side: 'right', r, c })));
  maze.bottom.forEach((row, r) => row.forEach((_, c) => out.push({ side: 'bottom', r, c })));
  return out;
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
      if (blocked(maze, cur, n) || prev.has(k(n))) continue;
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
      if (blocked(maze, queue[i], n) || seen.has(`${n.r},${n.c}`)) continue;
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

/**
 * Start recording, every frame, how far the maze and any square move or
 * change size from where they rest. Call the returned function to stop and
 * get the largest drift in CSS pixels. Squares sit under fixed wall lines,
 * so any drift reads as the maze jittering.
 */
async function watchMazeStillness(page) {
  await page.evaluate(() => {
    const maze = document.getElementById('maze');
    const box = el => {
      const r = el.getBoundingClientRect();
      return [r.left, r.top, r.width, r.height];
    };
    const rest = [maze, ...maze.children].map(box);
    const watch = { worst: 0, where: '', frames: 0, running: true };
    window.__mazeStillness = watch;
    const tick = () => {
      if (!watch.running) return;
      watch.frames++;
      [maze, ...maze.children].forEach((el, i) => {
        const now = box(el);
        const drift = Math.max(...now.map((v, k) => Math.abs(v - rest[i][k])));
        if (drift > watch.worst) {
          watch.worst = drift;
          watch.where = i === 0 ? 'maze' : `square ${el.dataset.r},${el.dataset.c} (${el.className})`;
        }
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return () => page.evaluate(() => {
    const watch = window.__mazeStillness;
    watch.running = false;
    return { worst: watch.worst, where: watch.where, frames: watch.frames };
  });
}

async function metric(page, n) {
  const ids = ['metricProgress', 'metricExplored', 'metricFrontier', 'metricDistance', 'metricShortest'];
  return (await page.locator(`#${ids[n - 1]}`).textContent()).trim();
}

/** The middle of the edge on the right ('right') or bottom ('bottom') of square (r, c). */
async function edgePoint(page, r, c, side) {
  const box = await cell(page, r, c).boundingBox();
  return side === 'right'
    ? { x: box.x + box.width, y: box.y + box.height / 2 }
    : { x: box.x + box.width / 2, y: box.y + box.height };
}

/** Click the middle of an edge (mouse) to toggle its wall in Walls mode. */
async function toggleWall(page, r, c, side) {
  if (side !== 'right' && side !== 'bottom') throw new Error(`toggleWall needs a side, got ${side}`);
  await page.locator('#maze').scrollIntoViewIfNeeded();
  const p = await edgePoint(page, r, c, side);
  await page.mouse.click(p.x, p.y);
}

/** Straight route along the top row then down the last column of a blank grid. */
function blankRoute(size) {
  const route = [];
  for (let c = 0; c < size; c++) route.push({ r: 0, c });
  for (let r = 1; r < size; r++) route.push({ r, c: size - 1 });
  return route;
}

module.exports = {
  openApp,
  setSize,
  readMaze,
  cellsWithClass,
  blocked,
  wallCount,
  allEdges,
  shortestPath,
  reachableCount,
  cell,
  cellCenter,
  growMaze,
  makePointer,
  defaultPointerType,
  traceCells,
  metric,
  watchMazeStillness,
  toggleWall,
  edgePoint,
  blankRoute
};
