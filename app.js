(() => {
  // Every page element this script uses. A missing one means the page is from
  // an older release than this script (a stale CDN copy, or the offline copy
  // served after a network blip), so the app reloads for the fresh page
  // instead of crashing with a blank maze.
  const missingIds = [];
  const byId = id => {
    const el = document.getElementById(id);
    if (!el) missingIds.push(id);
    return el;
  };

  const mazeEl = byId('maze');
  const wallLayer = byId('wallLayer');
  const sizeSelect = byId('sizeSelect');
  const speedSelect = byId('speedSelect');
  const levelButtons = [...document.querySelectorAll('.level-picker .segment')];
  const levelLabel = byId('levelLabel');
  const dials = {
    twisty: byId('twistyDial'),
    shortcuts: byId('shortcutsDial'),
    branches: byId('branchesDial')
  };
  const statusEl = byId('status');
  const phaseLabel = byId('phaseLabel');
  const pauseBtn = byId('pauseBtn');
  const offlineBadge = byId('offlineBadge');
  const offlineBadgeText = offlineBadge && offlineBadge.querySelector('span');

  const metricProgress = byId('metricProgress');
  const metricExplored = byId('metricExplored');
  const metricFrontier = byId('metricFrontier');
  const metricDistance = byId('metricDistance');
  const metricShortest = byId('metricShortest');
  const metricLabel1 = byId('metricLabel1');
  const metricLabel2 = byId('metricLabel2');
  const metricLabel3 = byId('metricLabel3');
  const metricLabel4 = byId('metricLabel4');
  const metricLabel5 = byId('metricLabel5');

  const userSolveBtn = byId('userSolveBtn');
  const userSolveBtnLabel = userSolveBtn && userSolveBtn.querySelector('span');
  const mazeStage = byId('mazeStage');
  const userPathOverlay = byId('userPathOverlay');
  const userPathGlow = byId('userPathGlow');
  const userPathLine = byId('userPathLine');
  const userPathHead = byId('userPathHead');

  const successSheet = byId('successSheet');
  const successKicker = byId('successKicker');
  const successTitle = byId('successTitle');
  const successSubtitle = byId('successSubtitle');
  const successTime = byId('successTime');
  const successCells = byId('successCells');
  const successBest = byId('successBest');
  const successEfficiency = byId('successEfficiency');
  const successAgainBtn = byId('successAgainBtn');
  const successCloseBtn = byId('successCloseBtn');
  const confettiField = byId('confettiField');

  const buttons = {
    draw: byId('drawBtn'),
    start: byId('startBtn'),
    end: byId('endBtn')
  };

  // Before reloading, the offline copy is dropped: this app's service worker
  // is unregistered and its cache deleted, so the reload goes straight to the
  // network like a first visit, whatever the worker on this device does. The
  // app registers the worker again once the fresh page has loaded. Only Maze
  // Builder's own worker and cache are touched, since both are origin-wide.
  function forgetOfflineCopy() {
    const work = [];
    const scope = new URL('./', location.href).href;
    if ('serviceWorker' in navigator) {
      work.push(navigator.serviceWorker.getRegistrations().then(registrations =>
        Promise.all(registrations.filter(r => r.scope === scope).map(r => r.unregister()))));
    }
    if (window.caches) work.push(caches.delete('maze-builder-runtime'));
    const giveUp = new Promise(resolve => setTimeout(resolve, 3000));
    return Promise.race([Promise.all(work), giveUp]).catch(() => {});
  }

  // The fresh page is fetched with a one-off query so neither the browser nor
  // the GitHub Pages CDN can answer with the old copy. The query also marks
  // the retry, so a page that is still old (offline with mismatched copies)
  // shows a message instead of reloading forever.
  const FRESH_PARAM = 'fresh';
  const pageUrl = new URL(location.href);
  if (missingIds.length || !levelButtons.length) {
    // Offline, the saved copy is all there is, so it is kept and the message
    // below asks for a reopen later instead.
    if (!pageUrl.searchParams.has(FRESH_PARAM) && navigator.onLine !== false) {
      pageUrl.searchParams.set(FRESH_PARAM, Date.now());
      forgetOfflineCopy().then(() => location.replace(pageUrl.href));
    } else {
      console.warn('Maze Builder page is older than its script; missing:', missingIds.join(', ') || 'level picker');
      if (statusEl) statusEl.textContent = 'Maze Builder just updated. Close it and open it again to finish.';
    }
    return;
  }
  if (pageUrl.searchParams.has(FRESH_PARAM)) {
    pageUrl.searchParams.delete(FRESH_PARAM);
    history.replaceState(history.state, '', pageUrl.href);
  }

  // Settings a child picked last time (size, speed and maze style) come back
  // on the next visit. Only the choices are remembered, never the maze itself.
  // Storage can be missing or blocked (private browsing), so every access is
  // guarded.
  const SETTINGS_KEY = 'mazeBuilder.settings';
  const rememberedControls = { size: sizeSelect, speed: speedSelect, ...dials };

  // A saved value only comes back if the control can still show it: a
  // listed option for a menu, a whole step within range for a dial.
  function isValidSetting(control, value) {
    if (control.tagName === 'SELECT') return [...control.options].some(option => option.value === value);
    const n = Number(value);
    return Number.isInteger(n) && n >= Number(control.min) && n <= Number(control.max);
  }

  function restoreSettings() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    } catch (error) {
      return;
    }
    if (!saved || typeof saved !== 'object') return;

    for (const [key, control] of Object.entries(rememberedControls)) {
      const value = String(saved[key]);
      if (isValidSetting(control, value)) control.value = value;
    }
  }

  function saveSettings() {
    const settings = {};
    for (const [key, control] of Object.entries(rememberedControls)) settings[key] = control.value;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      // Not saved this time; the app works the same without it.
    }
  }

  restoreSettings();

  let size = Number(sizeSelect.value);
  let grid = [];
  let walls = { right: [], bottom: [] };
  let wallEls = { right: [], bottom: [] };
  let start = null;
  let end = null;
  let mode = 'draw';
  let drawing = false;
  let drawValue = true;
  let lastPainted = null;
  let drawLastPoint = null;

  let runId = 0;
  let running = false;
  let paused = false;
  let runType = null;

  let userSolveMode = false;
  let userTracing = false;
  let userPath = [];
  let userPathSet = new Set();
  let userStartedAt = 0;
  let userPausedElapsedMs = 0;
  let userTimerId = null;
  let userMoves = 0;
  let userBacktracks = 0;
  let userOptimalCells = null;
  let userCompleted = false;
  let userPointerId = null;
  let userLastPoint = null;
  let celebrationToken = 0;
  let drawPointerId = null;

  // Each level is a size plus a setting for each Maze style dial (0 to 4).
  // Medium is the classic depth-first maze: no turn preference, no
  // shortcuts, no extra branching.
  const LEVELS = {
    easy: { label: 'Easy', size: 11, twisty: 1, shortcuts: 3, branches: 2 },
    medium: { label: 'Medium', size: 15, twisty: 2, shortcuts: 0, branches: 0 },
    hard: { label: 'Hard', size: 21, twisty: 4, shortcuts: 0, branches: 1 }
  };

  // How much the carving tip prefers to keep going straight, how often it
  // jumps back to start a side path, and what share of squares gets a
  // shortcut, for dial positions 0 to 4.
  const STRAIGHT_WEIGHT = [6, 2.5, 1, 0.4, 0.12];
  const BRANCH_CHANCE = [0, 0.08, 0.2, 0.4, 0.65];
  const SHORTCUT_SHARE = [0, 0.02, 0.05, 0.09, 0.14];
  // A side path starts from one of the last few squares the tip carved, so
  // the jump back stays short enough to watch.
  const BRANCH_WINDOW = 6;

  const key = (r, c) => `${r},${c}`;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function setStatus(message, phase = null) {
    statusEl.textContent = message;
    if (phase) phaseLabel.textContent = phase;
  }

  function setMetricLabels(a, b, c, d, e) {
    metricLabel1.textContent = a;
    metricLabel2.textContent = b;
    metricLabel3.textContent = c;
    metricLabel4.textContent = d;
    metricLabel5.textContent = e;
  }

  function useAlgorithmMetricLabels() {
    setMetricLabels('Progress', 'Explored', 'Frontier', 'Distance', 'Shortest');
  }

  function usePlayerMetricLabels() {
    setMetricLabels('Time', 'Cells', 'Best', 'Efficiency', 'Backtracks');
  }

  function setMetrics({ progress = null, explored = null, frontier = null, distance = null, shortest = null } = {}) {
    if (progress !== null) metricProgress.textContent = progress;
    if (explored !== null) metricExplored.textContent = explored;
    if (frontier !== null) metricFrontier.textContent = frontier;
    if (distance !== null) metricDistance.textContent = distance;
    if (shortest !== null) metricShortest.textContent = shortest;
  }

  function resetMetrics() {
    if (userSolveMode) {
      usePlayerMetricLabels();
      setMetrics({ progress: '0.0s', explored: '0', frontier: userOptimalCells ? String(userOptimalCells) : '—', distance: '—', shortest: '0' });
    } else {
      useAlgorithmMetricLabels();
      setMetrics({ progress: '0%', explored: '0', frontier: '0', distance: '—', shortest: '—' });
    }
  }

  async function waitWhilePaused(myRunId) {
    while (paused && running && myRunId === runId) {
      await sleep(50);
    }
  }

  // Sleep for one animation beat, then hold while paused. Returns false when
  // the run was cancelled or replaced so stale callers stop touching the grid.
  async function pace(ms, myRunId) {
    await sleep(ms);
    await waitWhilePaused(myRunId);
    return running && myRunId === runId;
  }

  function currentDelay() {
    return Number(speedSelect.value);
  }

  // Thin walls make every square part of the maze, so a big grid has far
  // more steps to grow. Quicken each step as the grid grows so a large maze
  // still finishes while a child is watching; small mazes keep full speed.
  function growthDelay() {
    return currentDelay() * Math.min(1, Math.sqrt(121 / (size * size)));
  }

  // On a phone or portrait iPad the controls sit above the maze, so the
  // button a child just tapped can leave the maze below the screen. When
  // the maze starts growing or being solved, scroll it into view; leave the
  // page alone when it is already fully visible.
  function bringMazeIntoView() {
    const box = mazeEl.getBoundingClientRect();
    const viewHeight = window.innerHeight || document.documentElement.clientHeight;
    if (box.top >= 0 && box.bottom <= viewHeight) return;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    mazeEl.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      // Show the status line above the maze too when there is room.
      block: box.height <= viewHeight ? 'end' : 'start'
    });
  }

  function cancelAnimation() {
    runId++;
    running = false;
    paused = false;
    runType = null;
    pauseBtn.disabled = true;
    pauseBtn.innerHTML = `<svg><use href="#i-pause"></use></svg><span>Pause</span>`;
  }

  function setInteractiveDisabled(disabled) {
    sizeSelect.disabled = disabled;
    for (const btn of levelButtons) btn.disabled = disabled;
    for (const dial of Object.values(dials)) dial.disabled = disabled;
    buttons.draw.disabled = disabled;
    buttons.start.disabled = disabled;
    buttons.end.disabled = disabled;
    document.getElementById('generateBtn').disabled = disabled;
    document.getElementById('animateBtn').disabled = disabled;
    document.getElementById('instantBtn').disabled = disabled;
    document.getElementById('blankBtn').disabled = disabled;
    document.getElementById('clearSolutionBtn').disabled = disabled;
    userSolveBtn.disabled = disabled;
  }

  function createCellState() {
    return {
      visited: false,
      frontier: false,
      current: false,
      solution: false,
      carveHead: false,
      carveSpark: false,
      carveTrail: false,
      newFrontier: false,
      solutionHead: false,
      goalBurst: false
    };
  }

  function clearTransientState(cell) {
    cell.visited = false;
    cell.frontier = false;
    cell.current = false;
    cell.solution = false;
    cell.carveHead = false;
    cell.carveSpark = false;
    cell.carveTrail = false;
    cell.newFrontier = false;
    cell.solutionHead = false;
    cell.goalBurst = false;
  }

  function mazeStyle() {
    return {
      twisty: Number(dials.twisty.value),
      shortcuts: Number(dials.shortcuts.value),
      branches: Number(dials.branches.value)
    };
  }

  // The level whose size and dials match the screen, or 'custom'.
  function currentLevel() {
    const style = mazeStyle();
    for (const [name, level] of Object.entries(LEVELS)) {
      if (level.size === size &&
          level.twisty === style.twisty &&
          level.shortcuts === style.shortcuts &&
          level.branches === style.branches) {
        return name;
      }
    }
    return 'custom';
  }

  function syncLevelUI() {
    const level = currentLevel();
    for (const btn of levelButtons) {
      const on = btn.dataset.level === level;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    }
    levelLabel.textContent = level === 'custom' ? 'Custom' : LEVELS[level].label;
  }

  function setSize(nextSize) {
    if (nextSize === size) return;
    size = nextSize;
    sizeSelect.value = String(size);
    makeBlankGrid();
  }

  function applyLevel(name) {
    if (running) return;
    const level = LEVELS[name];
    for (const dialName of Object.keys(dials)) dials[dialName].value = String(level[dialName]);
    setSize(level.size);
    syncLevelUI();
    saveSettings();
    setStatus(`${level.label} is set. Tap Grow a Maze to build one.`, 'Ready');
  }

  function makeBlankGrid() {
    cancelAnimation();
    exitUserSolveMode(false);
    setInteractiveDisabled(false);

    grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => createCellState())
    );
    walls = makeWalls(false);

    start = { r: 0, c: 0 };
    end = { r: size - 1, c: size - 1 };

    render();
    resetMetrics();
    setStatus('Draw walls along the grid lines, or grow a maze from scratch.', 'Ready');
  }

  // Walls sit on the edges between squares, like cell borders in a
  // spreadsheet, so every square is open path. right[r][c] is the edge
  // between (r, c) and (r, c + 1); bottom[r][c] is the edge between (r, c)
  // and (r + 1, c). The outside of the grid is always a wall.
  function makeWalls(value) {
    return {
      right: Array.from({ length: size }, () => Array(size - 1).fill(value)),
      bottom: Array.from({ length: size - 1 }, () => Array(size).fill(value))
    };
  }

  function inBounds(p) {
    return p.r >= 0 && p.c >= 0 && p.r < size && p.c < size;
  }

  // The edge shared by two orthogonally adjacent squares, or null.
  function edgeBetween(a, b) {
    if (a.r === b.r && Math.abs(a.c - b.c) === 1) return { side: 'right', r: a.r, c: Math.min(a.c, b.c) };
    if (a.c === b.c && Math.abs(a.r - b.r) === 1) return { side: 'bottom', r: Math.min(a.r, b.r), c: a.c };
    return null;
  }

  function hasWall(edge) {
    return walls[edge.side][edge.r][edge.c];
  }

  // The one movement rule every mode shares: one square across an open edge.
  function canMove(a, b) {
    if (!inBounds(a) || !inBounds(b)) return false;
    const edge = edgeBetween(a, b);
    return Boolean(edge) && !hasWall(edge);
  }

  function setWall(edge, value, { zap = false } = {}) {
    walls[edge.side][edge.r][edge.c] = value;
    const el = wallEls[edge.side][edge.r][edge.c];
    el.classList.toggle('on', value);
    el.classList.toggle('zap', !value && zap);
  }

  function edgeKey(edge) {
    return `${edge.side}:${edge.r},${edge.c}`;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // One line per inner edge, drawn in square units so the walls scale with
  // the grid. Only the edge that changed is touched afterwards.
  function renderWalls() {
    wallLayer.setAttribute('viewBox', `0 0 ${size} ${size}`);
    wallLayer.innerHTML = '';
    wallEls = { right: [], bottom: [] };
    const frag = document.createDocumentFragment();

    for (const side of ['right', 'bottom']) {
      walls[side].forEach((row, r) => {
        wallEls[side][r] = row.map((on, c) => {
          const x = side === 'right' ? c + 1 : c;
          const y = side === 'right' ? r : r + 1;
          const line = document.createElementNS(SVG_NS, 'line');
          line.setAttribute('x1', x);
          line.setAttribute('y1', y);
          line.setAttribute('x2', side === 'right' ? x : x + 1);
          line.setAttribute('y2', side === 'right' ? y + 1 : y);
          line.setAttribute('data-side', side);
          line.setAttribute('data-r', r);
          line.setAttribute('data-c', c);
          if (on) line.classList.add('on');
          frag.appendChild(line);
          return line;
        });
      });
    }

    wallLayer.appendChild(frag);
  }

  function render() {
    mazeStage.style.setProperty('--grid-size', size);
    mazeEl.innerHTML = '';
    renderWalls();

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.setAttribute('role', 'gridcell');
        mazeEl.appendChild(cell);
        updateCell(r, c);
      }
    }
  }

  function updateCell(r, c) {
    const index = r * size + c;
    const cellEl = mazeEl.children[index];
    if (!cellEl) return;

    const data = grid[r][c];
    cellEl.className = 'cell';

    if (data.carveTrail) cellEl.classList.add('carve-trail');
    if (data.carveSpark) cellEl.classList.add('carve-spark');
    if (data.carveHead) cellEl.classList.add('carve-head');
    if (data.visited) cellEl.classList.add('visited');
    if (data.frontier) cellEl.classList.add('frontier');
    if (data.newFrontier) cellEl.classList.add('new-frontier');
    if (data.current) cellEl.classList.add('current');
    if (data.solution) cellEl.classList.add('solution');
    if (data.solutionHead) cellEl.classList.add('solution-head');
    if (data.goalBurst) cellEl.classList.add('goal-burst');

    if (start && start.r === r && start.c === c) cellEl.classList.add('start');
    if (end && end.r === r && end.c === c) cellEl.classList.add('end');
  }

  function setMode(nextMode) {
    if (running) return;
    mode = nextMode;

    for (const [name, btn] of Object.entries(buttons)) {
      btn.classList.toggle('active', name === mode);
    }

    if (mode === 'draw') setStatus('Walls mode: tap or drag along a grid line to add or remove a wall.', 'Editing');
    if (mode === 'start') setStatus('Tap a square to place the start.', 'Editing');
    if (mode === 'end') setStatus('Tap a square to place the finish.', 'Editing');
  }

  function clearSearchMarks() {
    for (const row of grid) {
      for (const cell of row) {
        cell.visited = false;
        cell.frontier = false;
        cell.current = false;
        cell.solution = false;
        cell.newFrontier = false;
        cell.solutionHead = false;
        cell.goalBurst = false;
        cell.carveHead = false;
        cell.carveSpark = false;
        cell.carveTrail = false;
      }
    }
  }

  function clearSolution() {
    cancelAnimation();
    clearSearchMarks();
    render();

    if (userSolveMode) {
      // Editing stays locked: the player is still in solve mode.
      resetUserAttempt();
      setStatus('Your route was cleared. Start again from S.', 'Your Turn');
    } else {
      setInteractiveDisabled(false);
      resetMetrics();
      setStatus('Search visualization cleared. The maze is unchanged.', 'Ready');
    }
  }

  function hasSearchMarks() {
    return grid.some(row => row.some(cell =>
      cell.visited || cell.frontier || cell.current || cell.solution
    ));
  }

  function placeMarker(p) {
    const isStart = start && start.r === p.r && start.c === p.c;
    const isEnd = end && end.r === p.r && end.c === p.c;

    // S and E sharing a square would make a maze with nothing to solve.
    if ((mode === 'start' && isEnd) || (mode === 'end' && isStart)) {
      setStatus(
        mode === 'start'
          ? 'That square is the finish. Pick a different square for the start.'
          : 'That square is the start. Pick a different square for the finish.',
        'Editing'
      );
      return;
    }

    if (mode === 'start') start = { r: p.r, c: p.c };
    else end = { r: p.r, c: p.c };
    clearSearchMarks();
    render();
    resetMetrics();
    const moved = mode === 'start'
      ? 'Start moved. Ready to search from here.'
      : 'Finish moved. Ready to search for it.';
    setMode('draw');
    setStatus(moved, 'Editing');
  }

  function paintEdge(edge, isInitial) {
    if (isInitial) {
      drawValue = !hasWall(edge);

      // An old search result could otherwise show a gold path running
      // through a wall that was just drawn.
      if (hasSearchMarks()) {
        clearSearchMarks();
        render();
        resetMetrics();
        setStatus('The maze changed, so the old search was cleared.', 'Editing');
      }
    }

    if (hasWall(edge) !== drawValue) setWall(edge, drawValue);
    lastPainted = edgeKey(edge);
  }

  // The grid line nearest a point, as the inner edge it belongs to, or null
  // when the nearest line is the outside border. dist is how far the point
  // is from that line and cross how far from the nearest line across it,
  // both in squares from 0 (on the line) to 0.5 (the middle of a square).
  function pointEdge(x, y, geo = mazeGeometry()) {
    const gx = (x - geo.left) / geo.cellW;
    const gy = (y - geo.top) / geo.cellH;
    if (gx < 0 || gy < 0 || gx > size || gy > size) return null;

    const lineX = Math.round(gx);
    const lineY = Math.round(gy);
    const dv = Math.abs(gx - lineX);
    const dh = Math.abs(gy - lineY);
    const row = Math.max(0, Math.min(size - 1, Math.floor(gy)));
    const col = Math.max(0, Math.min(size - 1, Math.floor(gx)));

    if (dv <= dh) {
      return lineX > 0 && lineX < size ? { side: 'right', r: row, c: lineX - 1, dist: dv, cross: dh } : null;
    }
    return lineY > 0 && lineY < size ? { side: 'bottom', r: lineY - 1, c: col, dist: dh, cross: dv } : null;
  }

  mazeEl.addEventListener('pointerdown', e => {
    if (running || userSolveMode || drawing) return;
    const geo = mazeGeometry();

    if (mode !== 'draw') {
      const p = pointCell(e.clientX, e.clientY, geo);
      if (!p) return;
      e.preventDefault();
      placeMarker(p);
      return;
    }

    e.preventDefault();
    const edge = pointEdge(e.clientX, e.clientY, geo);
    if (!edge) {
      setStatus('The outside wall is always there. Draw along the lines inside the maze.', 'Editing');
      return;
    }

    drawing = true;
    drawPointerId = e.pointerId;
    drawLastPoint = { x: e.clientX, y: e.clientY };
    try { mazeEl.setPointerCapture(e.pointerId); } catch (_) {}
    paintEdge(edge, true);
  });

  // Walk from the last sample in quarter-square steps so a quick stroke
  // along a line paints every edge it passes. Points near the middle of a
  // square are skipped because they are not close to any one line, and so
  // are points near a crossing, where a stroke running straight through
  // would otherwise sprout a stub across its own path.
  function paintStrokeTo(x, y) {
    const geo = mazeGeometry();
    const from = drawLastPoint || { x, y };
    const dx = x - from.x;
    const dy = y - from.y;
    const stepSize = Math.max(1, Math.min(geo.cellW, geo.cellH) / 4);
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / stepSize));

    for (let i = 1; i <= steps; i++) {
      const edge = pointEdge(from.x + dx * i / steps, from.y + dy * i / steps, geo);
      if (!edge || edge.dist > 0.3 || edge.cross < 0.25 || edgeKey(edge) === lastPainted) continue;
      paintEdge(edge, false);
    }

    drawLastPoint = { x, y };
  }

  mazeEl.addEventListener('pointermove', e => {
    if (!drawing || mode !== 'draw' || running || userSolveMode) return;
    if (e.pointerId !== drawPointerId) return;
    e.preventDefault();

    const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const sample of coalesced.length ? coalesced : [e]) {
      paintStrokeTo(sample.clientX, sample.clientY);
    }
  });

  function endDrawStroke(e) {
    if (e.pointerId !== drawPointerId) return;
    drawing = false;
    drawPointerId = null;
    drawLastPoint = null;
    lastPainted = null;
  }

  window.addEventListener('pointerup', endDrawStroke);
  window.addEventListener('pointercancel', endDrawStroke);

  // A grown maze is planned in full first, then the plan is played back as
  // the growth animation. Planning first lets us check the finished maze
  // (S and E wherever the child put them) and quietly try again when the
  // route between them would be too short to be worth solving.
  //
  // The plan is a list of steps for the animation:
  //   carve    the tip knocks out the wall from `from` into `to`
  //   move     the tip travels back along carved corridors (`path`)
  //   rest     the tip settles at `at` once every square is joined
  //   shortcut the Shortcuts dial opens the wall between `a` and `b`
  // Each carve, move and rest step also records the carved count and stack
  // depth at that moment, for the live telemetry.
  function planMaze(n, style, from, to, minRoute = 0, { giveUpWhenShort = false } = {}) {
    const straightWeight = STRAIGHT_WEIGHT[style.twisty];
    const branchChance = BRANCH_CHANCE[style.branches];
    const steps = [];
    const plan = {
      right: Array.from({ length: n }, () => Array(n - 1).fill(true)),
      bottom: Array.from({ length: n - 1 }, () => Array(n).fill(true))
    };
    const inside = p => p.r >= 0 && p.c >= 0 && p.r < n && p.c < n;
    const near = p => [[1,0],[-1,0],[0,1],[0,-1]]
      .map(([dr, dc]) => ({ r: p.r + dr, c: p.c + dc }))
      .filter(inside);
    const same = (a, b) => a.r === b.r && a.c === b.c;
    // When S and E sit side by side, the wall between them always stays up,
    // so the route has to go the long way round.
    const direct = (a, b) => (same(a, from) && same(b, to)) || (same(a, to) && same(b, from));
    const isOpen = (a, b) => {
      const edge = edgeBetween(a, b);
      return !plan[edge.side][edge.r][edge.c];
    };
    const knock = (a, b) => {
      const edge = edgeBetween(a, b);
      plan[edge.side][edge.r][edge.c] = false;
    };

    const carved = Array.from({ length: n }, () => Array(n).fill(false));
    // The carved squares form a tree: parent and depth let the tip travel
    // back along real corridors when it retreats or starts a side path.
    const parent = Array.from({ length: n }, () => Array(n).fill(null));
    const depth = Array.from({ length: n }, () => Array(n).fill(0));
    // Squares that may still have uncarved neighbours. With Branches at its
    // lowest this is exactly the depth-first stack.
    const stack = [from];
    let carvedCount = 1;
    carved[from.r][from.c] = true;

    const uncarvedNeighbours = p => near(p).filter(q => !carved[q.r][q.c] && !direct(p, q));

    // Pick the next square, weighting the one straight ahead by the Twisty
    // dial. A weight of 1 is a plain random choice.
    function pickNext(cur, choices) {
      const back = parent[cur.r][cur.c];
      const weights = choices.map(q => {
        if (!back) return 1;
        const straight = q.r - cur.r === cur.r - back.r && q.c - cur.c === cur.c - back.c;
        return straight ? straightWeight : 1;
      });
      let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < choices.length; i++) {
        roll -= weights[i];
        if (roll < 0) return choices[i];
      }
      return choices[choices.length - 1];
    }

    // Squares from a (exclusive) to b (inclusive) along carved corridors.
    function treePath(a, b) {
      const up = [];
      const down = [];
      let x = a;
      let y = b;
      while (depth[x.r][x.c] > depth[y.r][y.c]) { x = parent[x.r][x.c]; up.push(x); }
      while (depth[y.r][y.c] > depth[x.r][x.c]) { down.push(y); y = parent[y.r][y.c]; }
      while (!same(x, y)) {
        x = parent[x.r][x.c];
        up.push(x);
        down.push(y);
        y = parent[y.r][y.c];
      }
      return up.concat(down.reverse());
    }

    while (stack.length) {
      let cur = stack[stack.length - 1];
      let choices = uncarvedNeighbours(cur);

      if (!choices.length) {
        stack.pop();
        if (stack.length) {
          steps.push({ type: 'move', from: cur, path: treePath(cur, stack[stack.length - 1]), carved: carvedCount, stack: stack.length });
        } else {
          steps.push({ type: 'rest', at: cur, carved: carvedCount, stack: 0 });
        }
        continue;
      }

      // Branches dial: sometimes leave this corridor for later and start a
      // side path from a square carved a moment ago.
      if (branchChance && stack.length > 1 && Math.random() < branchChance) {
        const recent = stack.slice(Math.max(0, stack.length - 1 - BRANCH_WINDOW), stack.length - 1);
        const options = recent.filter(p => uncarvedNeighbours(p).length);
        if (options.length) {
          const target = options[Math.floor(Math.random() * options.length)];
          stack.splice(stack.indexOf(target), 1);
          stack.push(target);
          steps.push({ type: 'move', from: cur, path: treePath(cur, target), carved: carvedCount, stack: stack.length });
          cur = target;
          choices = uncarvedNeighbours(cur);
        }
      }

      const next = pickNext(cur, choices);
      knock(cur, next);
      carved[next.r][next.c] = true;
      parent[next.r][next.c] = cur;
      depth[next.r][next.c] = depth[cur.r][cur.c] + 1;
      stack.push(next);
      carvedCount++;
      steps.push({ type: 'carve', from: cur, to: next, carved: carvedCount, stack: stack.length });
    }

    // Shortcuts only add ways through, so if the corridors already join S
    // and E too soon, nothing below can fix it.
    if (giveUpWhenShort && minRoute) {
      const route = routeLength(n, plan, from, to);
      if (route < minRoute) return { steps, walls: plan, carved: carvedCount, route, short: true };
    }

    // Shortcuts dial: once the maze is a single-route tree, open a few extra
    // walls so there is more than one way through. Each one opens a dead end
    // where possible, so a wrong turn is less of a trap. A shortcut that
    // would cut the S-to-E route below minRoute is put back and another
    // tried, so shortcuts never turn the maze into a short hop.
    const pick = list => list[Math.floor(Math.random() * list.length)];
    const refused = new Set();
    const closedSides = p => near(p).filter(q =>
      !isOpen(p, q) && !direct(p, q) && !refused.has(edgeKey(edgeBetween(p, q)))
    );
    const openCount = Array.from({ length: n }, (_, r) =>
      Array.from({ length: n }, (_, c) => near({ r, c }).filter(q => isOpen({ r, c }, q)).length)
    );
    const shortcuts = Math.round(SHORTCUT_SHARE[style.shortcuts] * n * n);
    for (let i = 0; i < shortcuts; i++) {
      for (let tries = 0; tries < 12; tries++) {
        const deadEnds = [];
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (openCount[r][c] === 1 && closedSides({ r, c }).length) deadEnds.push({ r, c });
          }
        }

        let a = null;
        let b = null;
        if (deadEnds.length) {
          a = pick(deadEnds);
          b = pick(closedSides(a));
        } else {
          const walled = [];
          for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
              for (const q of closedSides({ r, c })) if (q.r > r || q.c > c) walled.push({ a: { r, c }, b: q });
            }
          }
          if (!walled.length) break;
          ({ a, b } = pick(walled));
        }

        knock(a, b);
        if (minRoute && routeLength(n, plan, from, to) < minRoute) {
          const edge = edgeBetween(a, b);
          plan[edge.side][edge.r][edge.c] = true;
          refused.add(edgeKey(edge));
          continue;
        }
        openCount[a.r][a.c]++;
        openCount[b.r][b.c]++;
        steps.push({ type: 'shortcut', a, b });
        break;
      }
    }

    return { steps, walls: plan, carved: carvedCount, route: routeLength(n, plan, from, to) };
  }

  // Steps along the shortest route from a to b through a planned set of
  // walls, or -1 when there is none.
  function routeLength(n, plan, a, b) {
    const dist = Array.from({ length: n }, () => Array(n).fill(-1));
    dist[a.r][a.c] = 0;
    const queue = [a];
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i];
      if (cur.r === b.r && cur.c === b.c) return dist[cur.r][cur.c];
      for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const next = { r: cur.r + dr, c: cur.c + dc };
        if (next.r < 0 || next.c < 0 || next.r >= n || next.c >= n || dist[next.r][next.c] >= 0) continue;
        const edge = edgeBetween(cur, next);
        if (plan[edge.side][edge.r][edge.c]) continue;
        dist[next.r][next.c] = dist[cur.r][cur.c] + 1;
        queue.push(next);
      }
    }
    return -1;
  }

  // How long the S-to-E route usually is when S and E sit in opposite
  // corners, for this size and Maze style. Worked out once per setting from
  // a handful of sample plans, so it follows the level and the dials.
  const cornerRouteCache = new Map();
  function typicalCornerRoute(n, style) {
    const cacheKey = `${n}:${style.twisty}:${style.shortcuts}:${style.branches}`;
    if (!cornerRouteCache.has(cacheKey)) {
      const routes = [];
      for (let i = 0; i < 9; i++) {
        routes.push(planMaze(n, style, { r: 0, c: 0 }, { r: n - 1, c: n - 1 }).route);
      }
      routes.sort((a, b) => a - b);
      cornerRouteCache.set(cacheKey, routes[Math.floor(routes.length / 2)]);
    }
    return cornerRouteCache.get(cacheKey);
  }

  // Plan mazes until the route from S to E is at least half as long as a
  // typical corner-to-corner route at this level, so moving S and E close
  // together still gives a proper maze rather than a short hop. Shortcuts
  // already steer clear of cutting the route short; when the corridors
  // themselves join S and E too soon, plan again. After a short time it
  // settles for the next maze, whatever its route.
  const PLAN_BUDGET_MS = 150;
  function planLongMaze(n, style, from, to) {
    const wanted = Math.floor(typicalCornerRoute(n, style) / 2);
    const startedAt = performance.now();
    do {
      const plan = planMaze(n, style, from, to, wanted, { giveUpWhenShort: true });
      if (!plan.short) return plan;
    } while (performance.now() - startedAt < PLAN_BUDGET_MS);
    return planMaze(n, style, from, to, wanted);
  }

  async function animateMazeGrowth() {
    exitUserSolveMode(false);
    cancelAnimation();

    const myRunId = runId;
    running = true;
    paused = false;
    runType = 'generate';
    pauseBtn.disabled = false;
    setInteractiveDisabled(true);

    // S and E stay where the child put them; the maze grows around them.
    const plan = planLongMaze(size, mazeStyle(), start, end);

    // Every edge starts as a wall; the generator knocks out one edge per
    // step until each square is joined to the rest.
    grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => createCellState())
    );
    walls = makeWalls(true);
    render();
    bringMazeIntoView();

    const totalTargets = size * size;
    const showGrowthMetrics = step => setMetrics({
      progress: `${Math.min(100, Math.round(step.carved / totalTargets * 100))}%`,
      explored: String(step.carved),
      frontier: String(step.stack),
      distance: '—',
      shortest: '—'
    });

    let head = start;
    const moveHead = (to, { trail = true } = {}) => {
      grid[head.r][head.c].carveHead = false;
      if (trail) grid[head.r][head.c].carveTrail = true;
      updateCell(head.r, head.c);
      head = to;
      grid[head.r][head.c].carveHead = true;
      updateCell(head.r, head.c);
    };

    grid[start.r][start.c].carveHead = true;
    updateCell(start.r, start.c);

    useAlgorithmMetricLabels();
    showGrowthMetrics({ carved: 1, stack: 1 });

    setStatus('The maze is growing from the bright tip. Watch it branch and retreat.', 'Growing');

    let shortcutsAnnounced = false;
    for (const step of plan.steps) {
      if (!running || myRunId !== runId) return;
      await waitWhilePaused(myRunId);
      if (!running || myRunId !== runId) return;

      if (step.type === 'carve') {
        setWall(edgeBetween(step.from, step.to), false, { zap: true });
        grid[step.to.r][step.to.c].carveSpark = true;
        moveHead(step.to);
        showGrowthMetrics(step);
        if (!(await pace(growthDelay(), myRunId))) return;
        grid[step.to.r][step.to.c].carveSpark = false;
        updateCell(step.to.r, step.to.c);
      } else if (step.type === 'move') {
        // Walk the bright tip back through carved corridors so a retreat is
        // always visible, never a teleport.
        showGrowthMetrics(step);
        for (let i = 0; i < step.path.length; i++) {
          moveHead(step.path[i]);
          // Long trips back speed up after the first few steps.
          const beat = Math.max(6, growthDelay() * 0.45) / (i < 3 ? 1 : 3);
          if (!(await pace(beat, myRunId))) return;
        }
      } else if (step.type === 'rest') {
        showGrowthMetrics(step);
        grid[head.r][head.c].carveHead = false;
        grid[head.r][head.c].carveTrail = true;
        updateCell(head.r, head.c);
        if (!(await pace(Math.max(6, growthDelay() * 0.45), myRunId))) return;
      } else if (step.type === 'shortcut') {
        if (!shortcutsAnnounced) {
          setStatus('Adding shortcuts, so there is more than one way through.', 'Growing');
          shortcutsAnnounced = true;
        }
        setWall(edgeBetween(step.a, step.b), false, { zap: true });
        for (const p of [step.a, step.b]) {
          grid[p.r][p.c].carveSpark = true;
          updateCell(p.r, p.c);
        }
        if (!(await pace(growthDelay() * 2.5, myRunId))) return;
        for (const p of [step.a, step.b]) {
          grid[p.r][p.c].carveSpark = false;
          updateCell(p.r, p.c);
        }
      }
    }

    for (const row of grid) {
      for (const cell of row) {
        cell.carveHead = false;
        cell.carveSpark = false;
      }
    }

    render();
    running = false;
    runType = null;
    pauseBtn.disabled = true;
    setInteractiveDisabled(false);
    setMetrics({
      progress: '100%',
      explored: String(plan.carved),
      frontier: '0',
      distance: '—',
      shortest: '—'
    });
    setStatus('Maze complete. Now discover how the search wave finds the finish.', 'Built');
  }

  function computeBFSLayers() {
    if (!start || !end) return null;

    const queue = [{ ...start, d: 0 }];
    const seen = new Set([key(start.r, start.c)]);
    const previous = new Map();
    const layers = [];
    const dirs = [[1,0], [0,1], [-1,0], [0,-1]];
    let found = null;

    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i];

      if (!layers[cur.d]) layers[cur.d] = [];
      layers[cur.d].push({ r: cur.r, c: cur.c });

      if (cur.r === end.r && cur.c === end.c) {
        found = cur;
        break;
      }

      for (const [dr, dc] of dirs) {
        const nr = cur.r + dr;
        const nc = cur.c + dc;

        if (!canMove(cur, { r: nr, c: nc })) continue;

        const k = key(nr, nc);
        if (seen.has(k)) continue;

        seen.add(k);
        previous.set(k, { r: cur.r, c: cur.c });
        queue.push({ r: nr, c: nc, d: cur.d + 1 });
      }
    }

    if (!found) {
      return { found: false, layers, previous, path: [] };
    }

    const path = [];
    let cur = { r: end.r, c: end.c };

    while (!(cur.r === start.r && cur.c === start.c)) {
      path.push(cur);
      cur = previous.get(key(cur.r, cur.c));
      if (!cur) break;
    }

    path.push(start);
    path.reverse();

    return { found: true, layers, previous, path };
  }

  async function animatePathDiscovery() {
    exitUserSolveMode(false);
    cancelAnimation();
    clearSearchMarks();
    render();

    const result = computeBFSLayers();
    if (!result) {
      setStatus('Choose both a start and finish first.', 'Ready');
      return;
    }

    const myRunId = runId;
    running = true;
    paused = false;
    runType = 'solve';
    pauseBtn.disabled = false;
    setInteractiveDisabled(true);
    bringMazeIntoView();

    let explored = 0;

    useAlgorithmMetricLabels();
    setMetrics({
      progress: '0%',
      explored: '0',
      frontier: '1',
      distance: '0',
      shortest: '—'
    });

    setStatus('A search wave is spreading from the start. The bright edge is the frontier.', 'Searching');

    const totalOpen = size * size;

    for (let d = 0; d < result.layers.length; d++) {
      if (!running || myRunId !== runId) return;
      await waitWhilePaused(myRunId);
      if (!running || myRunId !== runId) return;

      const layer = result.layers[d] || [];

      for (const p of layer) {
        grid[p.r][p.c].frontier = true;
        grid[p.r][p.c].newFrontier = true;
        updateCell(p.r, p.c);
      }

      setMetrics({
        progress: `${Math.round(Math.min(1, explored / Math.max(1, totalOpen)) * 100)}%`,
        explored: String(explored),
        frontier: String(layer.length),
        distance: String(d),
        shortest: '—'
      });

      setStatus(
        `Distance ${d}: ${layer.length} square${layer.length === 1 ? '' : 's'} on the wavefront. ${explored} left behind as explored.`,
        'Searching'
      );

      if (!(await pace(Math.max(70, currentDelay() * 2.2), myRunId))) return;

      for (const p of layer) {
        grid[p.r][p.c].newFrontier = false;
        grid[p.r][p.c].frontier = false;
        grid[p.r][p.c].current = true;
        updateCell(p.r, p.c);
      }

      if (!(await pace(Math.max(30, currentDelay() * 0.8), myRunId))) return;

      for (const p of layer) {
        grid[p.r][p.c].current = false;
        grid[p.r][p.c].visited = true;
        explored++;
        updateCell(p.r, p.c);
      }

      const goalInLayer = layer.some(p => p.r === end.r && p.c === end.c);

      setMetrics({
        progress: `${Math.round(Math.min(1, explored / Math.max(1, totalOpen)) * 100)}%`,
        explored: String(explored),
        frontier: '0',
        distance: String(d),
        shortest: goalInLayer && result.found ? String(result.path.length - 1) : '—'
      });

      if (goalInLayer) {
        grid[end.r][end.c].goalBurst = true;
        updateCell(end.r, end.c);
        setStatus(`Finish found at distance ${d}. Now follow the breadcrumbs back into a shortest route.`, 'Found');
        if (!(await pace(Math.max(260, currentDelay() * 5), myRunId))) return;
        grid[end.r][end.c].goalBurst = false;
        updateCell(end.r, end.c);
        break;
      }

      if (!(await pace(Math.max(25, currentDelay() * 0.45), myRunId))) return;
    }

    if (!result.found) {
      running = false;
      runType = null;
      pauseBtn.disabled = true;
      setInteractiveDisabled(false);
      setMetrics({
        progress: '100%',
        explored: String(explored),
        frontier: '0',
        distance: String(Math.max(0, result.layers.length - 1)),
        shortest: '—'
      });
      setStatus('The wave ran out of reachable squares. This maze has no path to the finish.', 'No Path');
      return;
    }

    setStatus('Tracing the shortest route from start to finish. Gold is the path we keep.', 'Tracing');

    const pathDelay = Math.max(45, currentDelay() * 1.35);

    for (let i = 0; i < result.path.length; i++) {
      if (!running || myRunId !== runId) return;
      await waitWhilePaused(myRunId);
      if (!running || myRunId !== runId) return;

      if (i > 0) {
        const prev = result.path[i - 1];
        grid[prev.r][prev.c].solutionHead = false;
        updateCell(prev.r, prev.c);
      }

      const p = result.path[i];
      grid[p.r][p.c].solution = true;
      grid[p.r][p.c].solutionHead = true;
      updateCell(p.r, p.c);

      setMetrics({
        progress: '100%',
        explored: String(explored),
        frontier: '0',
        distance: String(i),
        shortest: String(result.path.length - 1)
      });

      setStatus(
        `Path step ${i} of ${result.path.length - 1}. The explored blue world remains behind; gold marks the route we keep.`,
        'Tracing'
      );

      if (!(await pace(pathDelay, myRunId))) return;
    }

    const last = result.path[result.path.length - 1];
    grid[last.r][last.c].solutionHead = false;
    grid[end.r][end.c].goalBurst = true;
    updateCell(last.r, last.c);
    updateCell(end.r, end.c);

    if (!(await pace(Math.max(260, currentDelay() * 4), myRunId))) return;

    grid[end.r][end.c].goalBurst = false;
    updateCell(end.r, end.c);

    running = false;
    runType = null;
    pauseBtn.disabled = true;
    setInteractiveDisabled(false);

    setMetrics({
      progress: '100%',
      explored: String(explored),
      frontier: '0',
      distance: String(result.path.length - 1),
      shortest: String(result.path.length - 1)
    });

    setStatus(
      `Solved. The search explored ${explored} squares and kept a shortest route of ${result.path.length - 1} steps.`,
      'Solved'
    );
  }

  function solveInstantly() {
    exitUserSolveMode(false);
    cancelAnimation();
    clearSearchMarks();

    const result = computeBFSLayers();
    if (!result) {
      setStatus('Choose both a start and finish first.', 'Ready');
      return;
    }

    let explored = 0;

    for (const layer of result.layers) {
      for (const p of layer || []) {
        grid[p.r][p.c].visited = true;
        explored++;
      }
    }

    if (!result.found) {
      render();
      setMetrics({
        progress: '100%',
        explored: String(explored),
        frontier: '0',
        distance: String(Math.max(0, result.layers.length - 1)),
        shortest: '—'
      });
      bringMazeIntoView();
      setStatus(`No path found after exploring ${explored} squares.`, 'No Path');
      return;
    }

    for (const p of result.path) {
      grid[p.r][p.c].solution = true;
    }

    render();
    setMetrics({
      progress: '100%',
      explored: String(explored),
      frontier: '0',
      distance: String(result.path.length - 1),
      shortest: String(result.path.length - 1)
    });
    bringMazeIntoView();
    setStatus(`Solved instantly. Shortest route: ${result.path.length - 1} steps.`, 'Solved');
  }


  function shortestPathCellCount() {
    const result = computeBFSLayers();
    return result && result.found ? result.path.length : null;
  }

  function cellId(r, c) {
    return `${r},${c}`;
  }

  function getCellElement(r, c) {
    return mazeEl.children[r * size + c] || null;
  }

  function userCellPoint(r, c) {
    const cell = getCellElement(r, c);
    if (!cell) return { x: 0, y: 0 };
    return {
      x: cell.offsetLeft + cell.offsetWidth / 2,
      y: cell.offsetTop + cell.offsetHeight / 2
    };
  }

  function syncUserOverlay() {
    const w = mazeEl.offsetWidth;
    const h = mazeEl.offsetHeight;
    userPathOverlay.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const points = userPath.map(p => {
      const pt = userCellPoint(p.r, p.c);
      return `${pt.x},${pt.y}`;
    }).join(' ');

    userPathLine.setAttribute('points', points);
    userPathGlow.setAttribute('points', points);

    if (userPath.length) {
      const last = userCellPoint(userPath[userPath.length - 1].r, userPath[userPath.length - 1].c);
      userPathHead.setAttribute('cx', last.x);
      userPathHead.setAttribute('cy', last.y);
      userPathHead.setAttribute('r', Math.max(5, Math.min(9, mazeEl.offsetWidth / size * 0.22)));
    } else {
      userPathHead.setAttribute('r', 0);
    }
  }

  function clearUserCellClasses() {
    for (const cell of mazeEl.children) {
      cell.classList.remove('user-covered', 'user-backtrack', 'user-success');
    }
  }

  function markUserCoveredCells() {
    clearUserCellClasses();
    for (const p of userPath) {
      const el = getCellElement(p.r, p.c);
      if (el && !el.classList.contains('start') && !el.classList.contains('end')) {
        el.classList.add('user-covered');
      }
    }
  }

  function hideCelebration() {
    celebrationToken++;
    successSheet.hidden = true;
  }

  function resetUserAttempt() {
    stopUserTimer();
    hideCelebration();
    userTracing = false;
    userCompleted = false;
    userPointerId = null;
    userLastPoint = null;
    userPath = [];
    userPathSet = new Set();
    userMoves = 0;
    userBacktracks = 0;
    userStartedAt = 0;
    userPausedElapsedMs = 0;
    userPathOverlay.classList.remove('success');
    clearUserCellClasses();
    syncUserOverlay();

    if (userSolveMode) {
      usePlayerMetricLabels();
      setMetrics({
        progress: '0.0s',
        explored: '0',
        frontier: userOptimalCells ? String(userOptimalCells) : '—',
        distance: '—',
        shortest: '0'
      });
    }
  }

  function startUserTimer(alreadyElapsedMs = 0) {
    stopUserTimer();
    userStartedAt = performance.now() - alreadyElapsedMs;

    userTimerId = setInterval(() => {
      if (!userStartedAt || userCompleted) return;
      const elapsed = (performance.now() - userStartedAt) / 1000;
      metricProgress.textContent = `${elapsed.toFixed(1)}s`;
    }, 100);
  }

  function stopUserTimer() {
    if (userTimerId) {
      clearInterval(userTimerId);
      userTimerId = null;
    }
  }

  function userEfficiency() {
    if (!userOptimalCells || userMoves <= 0) return null;
    return Math.min(100, Math.round((userOptimalCells / userMoves) * 100));
  }

  function updateUserMetrics(elapsedMs = userStartedAt ? performance.now() - userStartedAt : 0) {
    const elapsed = elapsedMs / 1000;
    const efficiency = userEfficiency();

    setMetrics({
      progress: `${elapsed.toFixed(1)}s`,
      explored: String(userMoves),
      frontier: userOptimalCells ? String(userOptimalCells) : '—',
      distance: efficiency === null ? '—' : `${efficiency}%`,
      shortest: String(userBacktracks)
    });
  }

  function enterUserSolveMode() {
    if (running) return;

    clearSearchMarks();
    render();

    userOptimalCells = shortestPathCellCount();

    if (!userOptimalCells) {
      setStatus('This maze has no valid route from S to E. Generate a new maze or edit this one first.', 'No Path');
      return;
    }

    userSolveMode = true;
    userSolveBtn.classList.add('active');
    userSolveBtnLabel.textContent = 'Stop Solving';
    mazeStage.classList.add('user-solving');
    userPathOverlay.classList.remove('success');
    usePlayerMetricLabels();
    resetUserAttempt();

    setInteractiveDisabled(true);
    document.getElementById('clearSolutionBtn').disabled = false;
    userSolveBtn.disabled = false;
    bringMazeIntoView();

    setStatus('Touch S with Apple Pencil or your finger, then trace through the corridors to E.', 'Your Turn');
  }

  function exitUserSolveMode(updateStatus = true) {
    stopUserTimer();
    hideCelebration();
    userSolveMode = false;
    userTracing = false;
    userCompleted = false;
    userPointerId = null;
    userLastPoint = null;
    userSolveBtn.classList.remove('active');
    userSolveBtnLabel.textContent = 'Solve It Yourself';
    mazeStage.classList.remove('user-solving');
    userPathOverlay.classList.remove('success');
    userPath = [];
    userPathSet = new Set();
    clearUserCellClasses();
    syncUserOverlay();

    if (!running) {
      setInteractiveDisabled(false);
    }

    useAlgorithmMetricLabels();
    if (updateStatus) {
      resetMetrics();
      setStatus('User solve mode ended.', 'Ready');
    }
  }

  // Grid geometry in client coordinates, measured inside the maze border so
  // cell maths matches the rendered cells exactly.
  function mazeGeometry() {
    const rect = mazeEl.getBoundingClientRect();
    const left = rect.left + mazeEl.clientLeft;
    const top = rect.top + mazeEl.clientTop;
    return {
      left,
      top,
      cellW: mazeEl.clientWidth / size,
      cellH: mazeEl.clientHeight / size
    };
  }

  function pointCell(x, y, geo = mazeGeometry()) {
    const innerX = x - geo.left;
    const innerY = y - geo.top;
    if (innerX < 0 || innerY < 0 || innerX >= geo.cellW * size || innerY >= geo.cellH * size) return null;

    const c = Math.max(0, Math.min(size - 1, Math.floor(innerX / geo.cellW)));
    const r = Math.max(0, Math.min(size - 1, Math.floor(innerY / geo.cellH)));
    return { r, c };
  }

  function eventCell(e) {
    return pointCell(e.clientX, e.clientY);
  }

  function isAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  function addUserPathCell(next) {
    if (!userTracing || userCompleted) return;

    const last = userPath[userPath.length - 1];
    if (!last) return;
    if (last.r === next.r && last.c === next.c) return;

    if (!isAdjacent(last, next) || !canMove(last, next)) return;

    const previous = userPath.length >= 2 ? userPath[userPath.length - 2] : null;

    if (previous && previous.r === next.r && previous.c === next.c) {
      const removed = userPath.pop();
      userPathSet.delete(cellId(removed.r, removed.c));
      userMoves++;
      userBacktracks++;

      const removedEl = getCellElement(removed.r, removed.c);
      if (removedEl) {
        removedEl.classList.remove('user-covered');
        removedEl.classList.add('user-backtrack');
        setTimeout(() => removedEl.classList.remove('user-backtrack'), 280);
      }

      syncUserOverlay();
      updateUserMetrics();
      return;
    }

    const id = cellId(next.r, next.c);

    if (userPathSet.has(id)) {
      return;
    }

    userPath.push(next);
    userPathSet.add(id);
    userMoves++;

    const el = getCellElement(next.r, next.c);
    if (el && !el.classList.contains('start') && !el.classList.contains('end')) {
      el.classList.add('user-covered');
    }

    syncUserOverlay();
    updateUserMetrics();

    if (next.r === end.r && next.c === end.c) {
      completeUserSolve();
    }
  }

  // Move the route toward the cell under the pointer. A stroke that clips a
  // corner lands diagonally; route it through whichever orthogonal neighbour
  // is open on both sides so the line still follows the corridors, never
  // across a wall.
  function stepUserPathTo(next) {
    const last = userPath[userPath.length - 1];
    if (!last || (last.r === next.r && last.c === next.c)) return;

    if (isAdjacent(last, next)) {
      addUserPathCell(next);
      return;
    }

    if (Math.abs(last.r - next.r) !== 1 || Math.abs(last.c - next.c) !== 1) return;

    const previous = userPath.length >= 2 ? userPath[userPath.length - 2] : null;
    const via = [{ r: last.r, c: next.c }, { r: next.r, c: last.c }]
      .filter(p => canMove(last, p) && canMove(p, next))
      .sort((a, b) => {
        const aBack = previous && previous.r === a.r && previous.c === a.c;
        const bBack = previous && previous.r === b.r && previous.c === b.c;
        return Number(aBack) - Number(bBack);
      })
      .find(p => !userPathSet.has(cellId(p.r, p.c)) ||
        (previous && previous.r === p.r && previous.c === p.c));

    if (!via) return;

    addUserPathCell(via);
    const now = userPath[userPath.length - 1];
    if (now.r === via.r && now.c === via.c) addUserPathCell(next);
  }

  // Walk from the previous pointer sample to this one in quarter-cell steps so
  // a quick finger or Pencil flick cannot skip over a cell and stall the line.
  function traceUserPointTo(x, y) {
    const geo = mazeGeometry();
    const from = userLastPoint || { x, y };
    const dx = x - from.x;
    const dy = y - from.y;
    const stepSize = Math.max(1, Math.min(geo.cellW, geo.cellH) / 4);
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / stepSize));

    for (let i = 1; i <= steps; i++) {
      if (!userTracing || userCompleted) break;
      const cell = pointCell(from.x + dx * i / steps, from.y + dy * i / steps, geo);
      if (cell) stepUserPathTo(cell);
    }

    userLastPoint = { x, y };
  }

  function processUserPointerEvent(e) {
    const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    const samples = coalesced.length ? coalesced : [e];
    for (const sample of samples) {
      traceUserPointTo(sample.clientX, sample.clientY);
    }
  }

  function captureUserPointer(e) {
    userPointerId = e.pointerId;
    userLastPoint = { x: e.clientX, y: e.clientY };
    if (e.currentTarget && e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    }
  }

  function toolLabel(e) {
    if (e.pointerType === 'pen') return 'Apple Pencil';
    if (e.pointerType === 'mouse') return 'the mouse';
    return 'your finger';
  }

  function startUserTrace(e) {
    if (!userSolveMode) return;

    const p = eventCell(e);
    const onStart = p && p.r === start.r && p.c === start.c;

    if (userCompleted && !onStart) return;

    if (!onStart) {
      setStatus(
        userPath.length
          ? 'Touch the white dot at the end of your blue line to keep going.'
          : 'Start your line on S, then keep the Pencil or finger down as you trace.',
        userPath.length ? 'Paused' : 'Your Turn'
      );
      return;
    }

    e.preventDefault();

    resetUserAttempt();
    captureUserPointer(e);
    userTracing = true;
    userPath = [{ r: start.r, c: start.c }];
    userPathSet = new Set([cellId(start.r, start.c)]);
    userMoves = 1;
    startUserTimer();
    syncUserOverlay();
    updateUserMetrics();

    setStatus(`Tracing with ${toolLabel(e)}. Stay in the open corridors and reach E.`, 'Tracing');
  }

  function endUserTrace(e) {
    if (!userSolveMode || !userTracing || userCompleted) return;
    if (e && userPointerId !== null && e.pointerId !== userPointerId) return;

    userTracing = false;
    userPointerId = null;
    userLastPoint = null;
    stopUserTimer();
    userPausedElapsedMs = performance.now() - userStartedAt;
    updateUserMetrics(userPausedElapsedMs);

    setStatus('Paused. Touch the end of your blue line to keep going.', 'Paused');
  }

  // Resuming is forgiving: a touch on the end cell, or close to its centre,
  // picks the line back up. Small hands and a lifted Pencil rarely land on
  // the exact square.
  function resumeUserTrace(e) {
    if (!userSolveMode || userCompleted || userTracing || !userPath.length) return false;

    const geo = mazeGeometry();
    const last = userPath[userPath.length - 1];
    const p = pointCell(e.clientX, e.clientY, geo);
    const centreX = geo.left + (last.c + 0.5) * geo.cellW;
    const centreY = geo.top + (last.r + 0.5) * geo.cellH;
    const near = Math.hypot(e.clientX - centreX, e.clientY - centreY) <= 0.8 * Math.min(geo.cellW, geo.cellH);
    const onLast = p && p.r === last.r && p.c === last.c;

    if (!onLast && !near) return false;

    e.preventDefault();
    captureUserPointer(e);
    userTracing = true;
    startUserTimer(userPausedElapsedMs);
    traceUserPointTo(e.clientX, e.clientY);

    setStatus(`Tracing with ${toolLabel(e)}. Keep going to E.`, 'Tracing');
    return true;
  }

  function celebrationCopy(efficiency, elapsed) {
    if (efficiency >= 100) {
      return {
        kicker: 'Perfect Route',
        title: 'Exactly the shortest path.',
        subtitle: `You matched the optimal route in ${elapsed.toFixed(1)} seconds.`
      };
    }
    if (efficiency >= 90) {
      return {
        kicker: 'Excellent',
        title: 'Almost perfectly efficient.',
        subtitle: 'You found a very clean route with almost no wasted movement.'
      };
    }
    if (efficiency >= 75) {
      return {
        kicker: 'Great Solve',
        title: 'You found it.',
        subtitle: 'A few extra cells, but a strong route through the maze.'
      };
    }
    return {
      kicker: 'Maze Complete',
      title: 'You made it to the finish.',
      subtitle: 'The blue trail shows your journey. Try again and see if you can get closer to the best route.'
    };
  }

  function createConfetti() {
    confettiField.innerHTML = '';
    const colors = ['#007aff', '#30d158', '#ffd60a', '#ff375f', '#5856d6', '#64d2ff'];

    for (let i = 0; i < 42; i++) {
      const piece = document.createElement('i');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty('--delay', `${Math.random() * 0.35}s`);
      piece.style.setProperty('--dur', `${1.4 + Math.random() * 1.1}s`);
      piece.style.setProperty('--drift', `${-90 + Math.random() * 180}px`);
      piece.style.setProperty('--spin', `${360 + Math.random() * 900}deg`);
      confettiField.appendChild(piece);
    }
  }

  async function completeUserSolve() {
    if (userCompleted) return;

    userCompleted = true;
    userTracing = false;
    userPointerId = null;
    userLastPoint = null;
    stopUserTimer();
    const token = ++celebrationToken;

    const elapsed = userStartedAt ? (performance.now() - userStartedAt) / 1000 : 0;
    const efficiency = userEfficiency() || 100;

    userPathOverlay.classList.add('success');

    for (let i = 0; i < userPath.length; i++) {
      const p = userPath[i];
      const el = getCellElement(p.r, p.c);
      if (!el) continue;
      setTimeout(() => {
        el.classList.add('user-success');
        setTimeout(() => el.classList.remove('user-success'), 760);
      }, i * 22);
    }

    setMetrics({
      progress: `${elapsed.toFixed(1)}s`,
      explored: String(userMoves),
      frontier: String(userOptimalCells),
      distance: `${efficiency}%`,
      shortest: String(userBacktracks)
    });

    setStatus(
      `Completed in ${elapsed.toFixed(1)}s using ${userMoves} covered cells. Best possible: ${userOptimalCells}. Efficiency: ${efficiency}%.`,
      'Complete'
    );

    const copy = celebrationCopy(efficiency, elapsed);
    successKicker.textContent = copy.kicker;
    successTitle.textContent = copy.title;
    successSubtitle.textContent = copy.subtitle;
    successTime.textContent = `${elapsed.toFixed(1)}s`;
    successCells.textContent = String(userMoves);
    successBest.textContent = String(userOptimalCells);
    successEfficiency.textContent = `${efficiency}%`;

    createConfetti();

    await sleep(520);
    // The player may have cleared, exited or started over during the pause.
    if (token !== celebrationToken || !userSolveMode || !userCompleted) return;
    successSheet.hidden = false;
  }

  mazeEl.addEventListener('pointerdown', e => {
    if (!userSolveMode) return;

    // One line at a time: a resting palm or second finger must not restart
    // or interrupt the stroke already in progress.
    if (userTracing) return;

    if (userPath.length && !userCompleted) {
      if (resumeUserTrace(e)) return;
    }

    startUserTrace(e);
  });

  mazeEl.addEventListener('pointermove', e => {
    if (!userSolveMode || !userTracing || e.pointerId !== userPointerId) return;
    e.preventDefault();
    processUserPointerEvent(e);
  });

  mazeEl.addEventListener('pointerup', endUserTrace);
  mazeEl.addEventListener('pointercancel', endUserTrace);

  userSolveBtn.addEventListener('click', () => {
    if (userSolveMode) {
      exitUserSolveMode(true);
    } else {
      enterUserSolveMode();
    }
  });

  successAgainBtn.addEventListener('click', () => {
    successSheet.hidden = true;
    resetUserAttempt();
    setStatus('Try again. Start on S and see if you can improve your route.', 'Your Turn');
  });

  successCloseBtn.addEventListener('click', () => {
    successSheet.hidden = true;
    setStatus('Nice work. Touch S to try this maze again, or tap Stop Solving.', 'Complete');
  });

  // Keep the route overlay on the cells when the maze changes size for any
  // reason: rotation, a different grid size, or the layout around it moving.
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (userSolveMode) syncUserOverlay();
    }).observe(mazeEl);
  }

  window.addEventListener('resize', () => {
    if (userSolveMode) syncUserOverlay();
  });

  sizeSelect.addEventListener('change', () => {
    size = Number(sizeSelect.value);
    saveSettings();
    makeBlankGrid();
    syncLevelUI();
  });

  speedSelect.addEventListener('change', saveSettings);

  for (const btn of levelButtons) {
    btn.addEventListener('click', () => applyLevel(btn.dataset.level));
  }

  for (const dial of Object.values(dials)) {
    dial.addEventListener('input', syncLevelUI);
    dial.addEventListener('change', saveSettings);
  }

  buttons.draw.addEventListener('click', () => setMode('draw'));
  buttons.start.addEventListener('click', () => setMode('start'));
  buttons.end.addEventListener('click', () => setMode('end'));

  document.getElementById('generateBtn').addEventListener('click', animateMazeGrowth);
  document.getElementById('animateBtn').addEventListener('click', animatePathDiscovery);
  document.getElementById('instantBtn').addEventListener('click', solveInstantly);

  pauseBtn.addEventListener('click', () => {
    if (!running) return;

    paused = !paused;
    pauseBtn.innerHTML = paused
      ? `<svg><use href="#i-play"></use></svg><span>Resume</span>`
      : `<svg><use href="#i-pause"></use></svg><span>Pause</span>`;

    if (paused) {
      setStatus(
        runType === 'generate'
          ? 'Paused. The bright tip shows exactly where the maze stopped growing.'
          : 'Paused. The current search state is frozen so you can inspect it.',
        'Paused'
      );
    } else {
      setStatus(
        runType === 'generate'
          ? 'Growth resumed.'
          : 'Search resumed.',
        runType === 'generate' ? 'Growing' : 'Searching'
      );
    }
  });

  document.getElementById('clearSolutionBtn').addEventListener('click', clearSolution);
  document.getElementById('blankBtn').addEventListener('click', makeBlankGrid);
  document.getElementById('printBtn').addEventListener('click', () => window.print());

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      offlineBadgeText.textContent = 'Web only';
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './', updateViaCache: 'none' });
      await navigator.serviceWorker.ready;

      const showOfflineState = () => {
        offlineBadgeText.textContent = navigator.serviceWorker.controller
          ? 'Offline ready'
          : 'Offline ready after reload';
      };
      showOfflineState();
      // A first-time worker claims this page shortly after it is ready.
      navigator.serviceWorker.addEventListener('controllerchange', showOfflineState);
      offlineBadge.classList.add('ready');

      registration.update().catch(() => {});
    } catch (error) {
      offlineBadgeText.textContent = 'Web';
      console.warn('Service worker registration failed:', error);
    }
  }

  useAlgorithmMetricLabels();
  syncLevelUI();
  makeBlankGrid();
  window.addEventListener('load', registerServiceWorker);
})();