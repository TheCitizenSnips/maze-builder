const { test, expect } = require('@playwright/test');
const { openApp, readMaze, cellsWithClass, blocked, shortestPath, wallCount, makePointer, defaultPointerType, traceCells, metric } = require('./helpers');

// Traps: an optional switch in the Maze card (off by default) hides a few
// traps on the quicker ways of a maze with more than one way through. A trap
// sends the player back to S with the clock and Cells still counting, stays
// marked and never snaps again that attempt. The search steps round them,
// the maze code carries them, and My Mazes and the ghost remember them.

const SAVED_KEY = 'mazeBuilder.mazes';
// An Easy 11 x 11 maze with traps on.
const TRAP_CODE = '69425-RAG21';
// A plain maze code from before traps (also pinned in maze-code.spec.js).
const OLD_CODE = '6HB7H-1CG03';

const k = p => `${p.r},${p.c}`;

async function growCode(page, code) {
  await page.evaluate(c => { location.hash = `maze=${c}`; }, code);
  await expect(page.locator('#codeLabel')).toHaveText(code);
  await expect(page.locator('#phaseLabel')).toHaveText(/Built|Your Turn/, { timeout: 30_000 });
}

// The traps the search wave stepped round, read from the instant solve.
async function trapsFound(page) {
  await page.click('#instantBtn');
  await expect(page.locator('#phaseLabel')).toHaveText('Solved');
  const maze = await readMaze(page);
  return { maze, traps: cellsWithClass(maze, 'trap-found') };
}

// Shortest route from a to b that steps on none of the `avoid` squares
// (and not on F unless F is where it is going).
function routeAvoiding(maze, a, b, avoid) {
  const skip = new Set(avoid.map(k));
  if (k(b) !== k(maze.end)) skip.add(k(maze.end));
  const prev = new Map([[k(a), null]]);
  const queue = [a];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (k(cur) === k(b)) {
      const path = [];
      for (let p = cur; p; p = prev.get(k(p))) path.push(p);
      return path.reverse();
    }
    for (const [dr, dc] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const n = { r: cur.r + dr, c: cur.c + dc };
      if (blocked(maze, cur, n) || prev.has(k(n)) || (skip.has(k(n)) && k(n) !== k(b))) continue;
      prev.set(k(n), cur);
      queue.push(n);
    }
  }
  return null;
}

// The fewest Cells over every plan, daring traps included: a search over
// (square, traps sprung), worked out here without the app's code.
function bestCells(maze, traps) {
  const bit = new Map(traps.map((p, i) => [k(p), 1 << i]));
  const seen = new Set([`${k(maze.start)}|0`]);
  let layer = [{ p: maze.start, sprung: 0 }];
  for (let moves = 0; layer.length; moves++) {
    const next = [];
    for (const { p, sprung } of layer) {
      if (k(p) === k(maze.end)) return moves + 1;
      for (const [dr, dc] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const q = { r: p.r + dr, c: p.c + dc };
        if (blocked(maze, p, q)) continue;
        const b = bit.get(k(q)) || 0;
        const state = b && !(sprung & b) ? { p: maze.start, sprung: sprung | b } : { p: q, sprung };
        const id = `${k(state.p)}|${state.sprung}`;
        if (seen.has(id)) continue;
        seen.add(id);
        next.push(state);
      }
    }
    layer = next;
  }
  return null;
}

const waysOf = route => route.slice(1).map((p, i) => {
  const q = route[i];
  return p.r < q.r ? 'U' : p.r > q.r ? 'D' : p.c < q.c ? 'L' : 'R';
}).join('');

test.describe('Traps', () => {
  test('are off by default and leave codes from before traps alone', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#trapsSwitch')).toHaveAttribute('aria-checked', 'false');
    await growCode(page, OLD_CODE);
    const { traps } = await trapsFound(page);
    expect(traps).toEqual([]);
    expect(page.mazeErrors).toEqual([]);
  });

  test('switch on is remembered, and a one-way Hard maze keeps its route and traps its dead ends', async ({ page }) => {
    await openApp(page, { speed: 'Super fast' });
    await page.click('#trapsSwitch');
    await expect(page.locator('#trapsSwitch')).toHaveAttribute('aria-checked', 'true');
    await page.reload();
    await expect(page.locator('#trapsSwitch')).toHaveAttribute('aria-checked', 'true');

    await page.click('[data-level="hard"]');
    await page.click('#generateBtn');
    await expect(page.locator('#phaseLabel')).toHaveText(/Built|Your Turn/, { timeout: 30_000 });
    await expect(page.locator('#levelLabel')).toHaveText('Hard');
    await expect(page.locator('#status')).toContainText('in the dead ends');
    const code = (await page.locator('#codeLabel').textContent()).trim();
    const plain = await readMaze(page);
    // Still one single way through: no extra loops for the traps.
    expect(wallCount(plain)).toBe(2 * plain.size * (plain.size - 1) - (plain.size * plain.size - 1));
    // Best is the one route: the traps never sit on it.
    expect(Number(await metric(page, 3))).toBe(shortestPath(plain).length);

    const { maze, traps } = await trapsFound(page);
    const route = shortestPath(maze);
    const onRoute = new Set(route.map(k));
    const gold = cellsWithClass(maze, 'solution');
    expect(gold.length).toBe(route.length);
    // Any trap the wave reached is at least two squares off the route.
    for (const trap of traps) {
      expect(onRoute.has(k(trap))).toBe(false);
      const near = [[1, 0], [0, 1], [-1, 0], [0, -1]]
        .map(([dr, dc]) => ({ r: trap.r + dr, c: trap.c + dc }))
        .filter(q => !blocked(maze, trap, q));
      expect(near.some(q => onRoute.has(k(q)))).toBe(false);
    }

    // The code carries the traps: growing it again hides them in the same squares.
    await page.click('#generateBtn');
    await expect(page.locator('#phaseLabel')).toHaveText(/Built|Your Turn/, { timeout: 30_000 });
    await growCode(page, code);
    await expect(page.locator('#trapLegend')).toBeVisible();
    const again = await trapsFound(page);
    expect(again.traps.map(k)).toEqual(traps.map(k));
    expect(page.mazeErrors).toEqual([]);
  });

  test('with more than one way through, traps sit on the ways and the gold route steps round them', async ({ page }) => {
    await openApp(page);
    await growCode(page, TRAP_CODE);
    const { maze, traps } = await trapsFound(page);
    expect(traps.length).toBeGreaterThan(0);
    const keys = traps.map(k);
    expect(keys).not.toContain(k(maze.start));
    expect(keys).not.toContain(k(maze.end));
    const gold = cellsWithClass(maze, 'solution');
    expect(gold.some(p => keys.includes(k(p)))).toBe(false);
    const safe = routeAvoiding(maze, maze.start, maze.end, traps);
    expect(safe).not.toBeNull();
    expect(gold.length).toBe(safe.length);
    // A trap on a way through: the shortest route that ignores traps uses one.
    expect(shortestPath(maze).length).toBeLessThan(safe.length);
    await expect(page.locator('#status')).toContainText('traps it stepped round');
    expect(page.mazeErrors).toEqual([]);
  });

  test('a trap sends the player back to S, keeps counting and stays safe after', async ({ page }, testInfo) => {
    await openApp(page);
    await growCode(page, TRAP_CODE);
    // The code brings its traps along; the switch stays as it was.
    await expect(page.locator('#trapsSwitch')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#trapLegend')).toBeVisible();
    const { maze, traps } = await trapsFound(page);
    expect(traps.length).toBeGreaterThan(0);
    const trap = traps[0];
    const others = traps.slice(1);

    await page.click('#userSolveBtn');
    await expect(page.locator('#phaseLabel')).toHaveText('Your Turn');
    // Best counts every plan, a dare through a trap included.
    expect(Number(await metric(page, 3))).toBe(bestCells(maze, traps));

    const pointer = await makePointer(page, defaultPointerType(testInfo));
    const toTrap = routeAvoiding(maze, maze.start, trap, others);
    await traceCells(page, toTrap, { pointer });
    await expect(page.locator('#phaseLabel')).toHaveText('Trapped');
    const trapCell = page.locator(`#maze .cell[data-r="${trap.r}"][data-c="${trap.c}"]`);
    await expect(trapCell).toHaveClass(/trap-sprung/);
    // The line is wiped back to S, but Cells and the clock carry on.
    await expect(page.locator('#userPathLine')).toHaveAttribute('points', /^[\d.]+,[\d.]+$/);
    expect(Number(await metric(page, 2))).toBe(toTrap.length);
    const clock = parseFloat(await metric(page, 1));
    await expect.poll(async () => parseFloat(await metric(page, 1))).toBeGreaterThan(clock);

    // Back from S: the sprung trap is safe now, so the way through it is open.
    const home = routeAvoiding(maze, maze.start, maze.end, others);
    await traceCells(page, home, { pointer });
    await expect(page.locator('#successSheet')).toBeVisible();
    await expect(page.locator('#successSubtitle')).toContainText('You sprang 1 trap');
    expect(Number(await page.locator('#successCells').textContent())).toBe(toTrap.length + home.length - 1);

    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVED_KEY);
    const run = saved.results.find(r => r.code === TRAP_CODE);
    expect(run.traps).toEqual([[trap.r, trap.c]]);
    expect(run.ways).toBe(waysOf(toTrap) + waysOf(home));
    expect(run.times.length).toBe(run.ways.length);

    // Try again re-arms every trap.
    await page.click('#successAgainBtn');
    await expect(trapCell).not.toHaveClass(/trap-sprung/);
    expect(page.mazeErrors).toEqual([]);
  });

  test('the ghost falls into the same trap and hops back to S', async ({ page }, testInfo) => {
    await openApp(page);
    await growCode(page, TRAP_CODE);
    const { maze, traps } = await trapsFound(page);
    const trap = traps[0];
    const toTrap = routeAvoiding(maze, maze.start, trap, traps.slice(1));
    const home = routeAvoiding(maze, maze.start, maze.end, traps.slice(1));
    const ways = waysOf(toTrap) + waysOf(home);
    const times = [...ways].map((_, i) => (i + 1) * 6);
    await page.evaluate(({ key, result }) => {
      localStorage.setItem(key, JSON.stringify({ results: [result], favourites: [] }));
    }, {
      key: SAVED_KEY,
      result: {
        code: TRAP_CODE, shape: 'square', size: 11, efficiency: 80, ms: times[times.length - 1] * 100,
        cells: ways.length + 1, shortest: 20, backtracks: 0, ways, times, traps: [[trap.r, trap.c]],
        at: Date.now(), picture: ''
      }
    });

    await page.click('#userSolveBtn');
    await expect(page.locator('#ghostChip')).toBeVisible();

    // Start the clock with one step off S and hold there, then watch the ghost.
    const pointer = await makePointer(page, defaultPointerType(testInfo));
    const first = shortestPath(maze).slice(0, 2);
    await traceCells(page, first, { pointer, keepDown: true });
    const seen = await page.evaluate(async ({ trap, start, until }) => {
      const maze = document.getElementById('maze');
      const head = document.getElementById('ghostHead');
      const cell = maze.children[0];
      const out = [];
      const stop = performance.now() + until;
      while (performance.now() < stop) {
        const m = /translate\(([\d.]+)px, ([\d.]+)px\)/.exec(head.style.transform);
        if (m) {
          const r = Math.floor((Number(m[2]) - cell.offsetTop) / cell.offsetHeight);
          const c = Math.floor((Number(m[1]) - cell.offsetLeft) / cell.offsetWidth);
          const at = r === trap.r && c === trap.c ? 'trap' : r === start.r && c === start.c ? 'S' : 'other';
          if (out[out.length - 1] !== at) out.push(at);
        }
        await new Promise(requestAnimationFrame);
      }
      return out;
    }, { trap, start: maze.start, until: toTrap.length * 600 + 1500 });
    await pointer.up();

    const onTrap = seen.indexOf('trap');
    expect(onTrap).toBeGreaterThan(0);
    expect(seen.slice(onTrap + 1)).toContain('S');
    expect(page.mazeErrors).toEqual([]);
  });
});
