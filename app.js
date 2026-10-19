(() => {
  const mazeEl = document.getElementById('maze');
  const sizeSelect = document.getElementById('sizeSelect');
  const speedSelect = document.getElementById('speedSelect');
  const statusEl = document.getElementById('status');
  const phaseLabel = document.getElementById('phaseLabel');
  const pauseBtn = document.getElementById('pauseBtn');
  const offlineBadge = document.getElementById('offlineBadge');
  const offlineBadgeText = offlineBadge.querySelector('span');

  const metricProgress = document.getElementById('metricProgress');
  const metricExplored = document.getElementById('metricExplored');
  const metricFrontier = document.getElementById('metricFrontier');
  const metricDistance = document.getElementById('metricDistance');
  const metricShortest = document.getElementById('metricShortest');
  const metricLabel1 = document.getElementById('metricLabel1');
  const metricLabel2 = document.getElementById('metricLabel2');
  const metricLabel3 = document.getElementById('metricLabel3');
  const metricLabel4 = document.getElementById('metricLabel4');
  const metricLabel5 = document.getElementById('metricLabel5');

  const userSolveBtn = document.getElementById('userSolveBtn');
  const mazeStage = document.getElementById('mazeStage');
  const userPathOverlay = document.getElementById('userPathOverlay');
  const userPathGlow = document.getElementById('userPathGlow');
  const userPathLine = document.getElementById('userPathLine');
  const userPathHead = document.getElementById('userPathHead');

  const successSheet = document.getElementById('successSheet');
  const successKicker = document.getElementById('successKicker');
  const successTitle = document.getElementById('successTitle');
  const successSubtitle = document.getElementById('successSubtitle');
  const successTime = document.getElementById('successTime');
  const successCells = document.getElementById('successCells');
  const successBest = document.getElementById('successBest');
  const successEfficiency = document.getElementById('successEfficiency');
  const successAgainBtn = document.getElementById('successAgainBtn');
  const successCloseBtn = document.getElementById('successCloseBtn');
  const confettiField = document.getElementById('confettiField');

  const buttons = {
    draw: document.getElementById('drawBtn'),
    start: document.getElementById('startBtn'),
    end: document.getElementById('endBtn')
  };

  let size = Number(sizeSelect.value);
  let grid = [];
  let start = null;
  let end = null;
  let mode = 'draw';
  let drawing = false;
  let drawValue = true;
  let lastPainted = null;

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

  function currentDelay() {
    return Number(speedSelect.value);
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
    buttons.draw.disabled = disabled;
    buttons.start.disabled = disabled;
    buttons.end.disabled = disabled;
    document.getElementById('generateBtn').disabled = disabled;
    document.getElementById('animateBtn').disabled = disabled;
    document.getElementById('instantBtn').disabled = disabled;
    document.getElementById('blankBtn').disabled = disabled;
    document.getElementById('clearSolutionBtn').disabled = disabled;
  }

  function createCellState() {
    return {
      wall: false,
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

  function makeBlankGrid() {
    cancelAnimation();
    exitUserSolveMode(false);
    setInteractiveDisabled(false);

    grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => createCellState())
    );

    start = { r: 1, c: 1 };
    end = { r: size - 2, c: size - 2 };

    render();
    resetMetrics();
    setStatus('Draw walls with your finger, or grow a maze from scratch.', 'Ready');
  }

  function render() {
    mazeEl.style.setProperty('--grid-size', size);
    mazeEl.innerHTML = '';

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

    if (data.wall) cellEl.classList.add('wall');
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

    if (mode === 'draw') setStatus('Draw mode: tap or drag to add or remove walls.', 'Editing');
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

  function applyToCell(cellEl, isInitial = false) {
    if (running || userSolveMode || !cellEl || !cellEl.classList.contains('cell')) return;

    const r = Number(cellEl.dataset.r);
    const c = Number(cellEl.dataset.c);

    if (mode === 'start') {
      if (grid[r][c].wall) grid[r][c].wall = false;
      start = { r, c };
      clearSearchMarks();
      render();
      setMode('draw');
      setStatus('Start moved. Ready to search from here.', 'Editing');
      return;
    }

    if (mode === 'end') {
      if (grid[r][c].wall) grid[r][c].wall = false;
      end = { r, c };
      clearSearchMarks();
      render();
      setMode('draw');
      setStatus('Finish moved. Ready to search for it.', 'Editing');
      return;
    }

    if ((start && start.r === r && start.c === c) ||
        (end && end.r === r && end.c === c)) {
      return;
    }

    if (isInitial) drawValue = !grid[r][c].wall;

    grid[r][c].wall = drawValue;
    clearTransientState(grid[r][c]);
    updateCell(r, c);
  }

  mazeEl.addEventListener('pointerdown', e => {
    const cell = e.target.closest('.cell');
    if (!cell || running || userSolveMode) return;

    e.preventDefault();
    drawing = true;
    lastPainted = null;

    if (mode === 'draw') {
      applyToCell(cell, true);
      lastPainted = `${cell.dataset.r},${cell.dataset.c}`;
    } else {
      applyToCell(cell, true);
      drawing = false;
    }
  });

  mazeEl.addEventListener('pointermove', e => {
    if (!drawing || mode !== 'draw' || running || userSolveMode) return;
    e.preventDefault();

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el && el.closest ? el.closest('.cell') : null;
    if (!cell || !mazeEl.contains(cell)) return;

    const id = `${cell.dataset.r},${cell.dataset.c}`;
    if (id === lastPainted) return;

    applyToCell(cell, false);
    lastPainted = id;
  });

  window.addEventListener('pointerup', () => {
    drawing = false;
    lastPainted = null;
  });

  function totalPassageTargets() {
    const oddPerSide = Math.floor(size / 2);
    return oddPerSide * oddPerSide;
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

    grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({
        ...createCellState(),
        wall: true
      }))
    );

    start = { r: 1, c: 1 };
    end = { r: size - 2, c: size - 2 };
    render();

    const dirs = [[2,0],[-2,0],[0,2],[0,-2]];
    const stack = [{ r: 1, c: 1 }];
    const totalTargets = totalPassageTargets();
    let carvedTargets = 1;

    grid[1][1].wall = false;
    grid[1][1].carveHead = true;
    updateCell(1,1);

    useAlgorithmMetricLabels();
    setMetrics({
      progress: `${Math.round(carvedTargets / totalTargets * 100)}%`,
      explored: String(carvedTargets),
      frontier: String(stack.length),
      distance: '—',
      shortest: '—'
    });

    setStatus('The maze is growing from the bright tip. Watch it branch and retreat.', 'Growing');

    while (stack.length) {
      if (!running || myRunId !== runId) return;
      await waitWhilePaused(myRunId);
      if (!running || myRunId !== runId) return;

      const cur = stack[stack.length - 1];

      for (const row of grid) {
        for (const cell of row) {
          cell.carveHead = false;
        }
      }
      grid[cur.r][cur.c].carveHead = true;
      updateCell(cur.r, cur.c);

      const choices = dirs
        .map(([dr, dc]) => ({
          r: cur.r + dr,
          c: cur.c + dc,
          dr,
          dc
        }))
        .filter(n =>
          n.r > 0 && n.c > 0 &&
          n.r < size - 1 && n.c < size - 1 &&
          grid[n.r][n.c].wall
        );

      if (!choices.length) {
        grid[cur.r][cur.c].carveHead = false;
        grid[cur.r][cur.c].carveTrail = true;
        updateCell(cur.r, cur.c);
        stack.pop();

        if (stack.length) {
          const back = stack[stack.length - 1];
          grid[back.r][back.c].carveHead = true;
          updateCell(back.r, back.c);
        }

        setMetrics({
          progress: `${Math.round(carvedTargets / totalTargets * 100)}%`,
          explored: String(carvedTargets),
          frontier: String(stack.length),
          distance: '—',
          shortest: '—'
        });

        await sleep(Math.max(6, currentDelay() * 0.45));
        continue;
      }

      const next = choices[Math.floor(Math.random() * choices.length)];
      const mid = {
        r: cur.r + next.dr / 2,
        c: cur.c + next.dc / 2
      };

      grid[cur.r][cur.c].carveHead = false;
      grid[cur.r][cur.c].carveTrail = true;

      for (const p of [mid, next]) {
        grid[p.r][p.c].wall = false;
        grid[p.r][p.c].carveSpark = true;
        updateCell(p.r, p.c);
      }

      grid[next.r][next.c].carveHead = true;
      updateCell(cur.r, cur.c);
      updateCell(next.r, next.c);

      stack.push({ r: next.r, c: next.c });
      carvedTargets++;

      setMetrics({
        progress: `${Math.min(100, Math.round(carvedTargets / totalTargets * 100))}%`,
        explored: String(carvedTargets),
        frontier: String(stack.length),
        distance: '—',
        shortest: '—'
      });

      await sleep(currentDelay());

      grid[mid.r][mid.c].carveSpark = false;
      grid[mid.r][mid.c].carveTrail = true;
      grid[next.r][next.c].carveSpark = false;
      updateCell(mid.r, mid.c);
      updateCell(next.r, next.c);
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
      explored: String(carvedTargets),
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

        if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
        if (grid[nr][nc].wall) continue;

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

    const totalOpen = grid.flat().filter(c => !c.wall).length;

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

      await sleep(Math.max(70, currentDelay() * 2.2));

      for (const p of layer) {
        grid[p.r][p.c].newFrontier = false;
        grid[p.r][p.c].frontier = false;
        grid[p.r][p.c].current = true;
        updateCell(p.r, p.c);
      }

      await sleep(Math.max(30, currentDelay() * 0.8));

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
        await sleep(Math.max(260, currentDelay() * 5));
        grid[end.r][end.c].goalBurst = false;
        updateCell(end.r, end.c);
        break;
      }

      await sleep(Math.max(25, currentDelay() * 0.45));
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

      await sleep(pathDelay);
    }

    const last = result.path[result.path.length - 1];
    grid[last.r][last.c].solutionHead = false;
    grid[end.r][end.c].goalBurst = true;
    updateCell(last.r, last.c);
    updateCell(end.r, end.c);

    await sleep(Math.max(260, currentDelay() * 4));

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

  function resetUserAttempt() {
    stopUserTimer();
    userTracing = false;
    userCompleted = false;
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

  function updateUserMetrics() {
    const elapsed = userStartedAt ? (performance.now() - userStartedAt) / 1000 : 0;
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
    mazeStage.classList.add('user-solving');
    userPathOverlay.classList.remove('success');
    usePlayerMetricLabels();
    resetUserAttempt();

    setInteractiveDisabled(true);
    document.getElementById('clearSolutionBtn').disabled = false;
    userSolveBtn.disabled = false;

    setStatus('Touch S with Apple Pencil or your finger, then trace through the corridors to E.', 'Your Turn');
  }

  function exitUserSolveMode(updateStatus = true) {
    stopUserTimer();
    userSolveMode = false;
    userTracing = false;
    userCompleted = false;
    userSolveBtn.classList.remove('active');
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

  function eventCell(e) {
    const rect = mazeEl.getBoundingClientRect();
    if (
      e.clientX < rect.left || e.clientX >= rect.right ||
      e.clientY < rect.top || e.clientY >= rect.bottom
    ) return null;

    const innerX = e.clientX - rect.left;
    const innerY = e.clientY - rect.top;
    const cellW = rect.width / size;
    const cellH = rect.height / size;
    const c = Math.max(0, Math.min(size - 1, Math.floor(innerX / cellW)));
    const r = Math.max(0, Math.min(size - 1, Math.floor(innerY / cellH)));
    return { r, c };
  }

  function isAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  function addUserPathCell(next) {
    if (!userTracing || userCompleted) return;
    if (grid[next.r][next.c].wall) return;

    const last = userPath[userPath.length - 1];
    if (!last) return;
    if (last.r === next.r && last.c === next.c) return;

    if (!isAdjacent(last, next)) return;

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

  function processUserPointerEvent(e) {
    const samples = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const sample of samples) {
      const next = eventCell(sample);
      if (next) addUserPathCell(next);
    }
  }

  function startUserTrace(e) {
    if (!userSolveMode || userCompleted) return;

    const p = eventCell(e);
    if (!p || p.r !== start.r || p.c !== start.c) {
      setStatus('Start your line on S, then keep the Pencil or finger down as you trace.', 'Your Turn');
      return;
    }

    e.preventDefault();

    if (e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    }

    resetUserAttempt();
    userTracing = true;
    userPath = [{ r: start.r, c: start.c }];
    userPathSet = new Set([cellId(start.r, start.c)]);
    userMoves = 1;
    startUserTimer();
    syncUserOverlay();
    updateUserMetrics();

    const toolName = e.pointerType === 'pen' ? 'Apple Pencil' : 'touch';
    setStatus(`Tracing with ${toolName}. Stay inside the open corridors and reach E.`, 'Tracing');
  }

  function endUserTrace(e) {
    if (!userSolveMode || !userTracing || userCompleted) return;

    userTracing = false;
    stopUserTimer();
    userPausedElapsedMs = performance.now() - userStartedAt;
    updateUserMetrics();

    setStatus('Line lifted before the finish. Touch the end of your blue route to continue, or clear it and try again.', 'Paused');
  }

  function resumeUserTrace(e) {
    if (!userSolveMode || userCompleted || userTracing || !userPath.length) return false;

    const p = eventCell(e);
    const last = userPath[userPath.length - 1];

    if (!p || p.r !== last.r || p.c !== last.c) return false;

    e.preventDefault();
    userTracing = true;
    startUserTimer(userPausedElapsedMs);

    setStatus('Route resumed from its last point.', 'Tracing');
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
    stopUserTimer();

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
    successSheet.hidden = false;
  }

  mazeEl.addEventListener('pointerdown', e => {
    if (!userSolveMode) return;

    if (userPath.length && !userTracing) {
      if (resumeUserTrace(e)) return;
    }

    startUserTrace(e);
  });

  mazeEl.addEventListener('pointermove', e => {
    if (!userSolveMode || !userTracing) return;
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
  });

  window.addEventListener('resize', () => {
    if (userSolveMode) syncUserOverlay();
  });

  sizeSelect.addEventListener('change', () => {
    size = Number(sizeSelect.value);
    makeBlankGrid();
  });

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

      offlineBadgeText.textContent = navigator.serviceWorker.controller
        ? 'Offline ready'
        : 'Offline ready after reload';
      offlineBadge.classList.add('ready');

      registration.update().catch(() => {});
    } catch (error) {
      offlineBadgeText.textContent = 'Web';
      console.warn('Service worker registration failed:', error);
    }
  }

  useAlgorithmMetricLabels();
  makeBlankGrid();
  window.addEventListener('load', registerServiceWorker);
})();