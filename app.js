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

  // Release stamp. On every deploy the GitHub Pages workflow replaces the
  // placeholder here and in index.html with "<commit>|<commit time>", so the
  // badge can say which release is running with no version to bump by hand.
  // Local copies keep the placeholder and show no version.
  const BUILD = '__MAZE_BUILD__';
  const isStamped = build => /^[0-9a-f]{7,40}\|/.test(build);
  const pageBuildMeta = document.querySelector('meta[name="maze-build"]');
  const pageBuild = pageBuildMeta ? pageBuildMeta.content : '';
  // A stamped page and script from different releases are a mix of old and
  // new copies, even when every element happens to be present.
  const mixedReleases = isStamped(BUILD) && isStamped(pageBuild) && BUILD !== pageBuild;

  const mazeEl = byId('maze');
  const wallLayer = byId('wallLayer');
  const sizeSelect = byId('sizeSelect');
  const speedSelect = byId('speedSelect');
  const levelButtons = [...document.querySelectorAll('.level-picker .segment')];
  const levelLabel = byId('levelLabel');
  const shapePicker = byId('shapePicker');
  const shapeIcon = byId('shapeIcon');
  const shapeLabel = byId('shapeLabel');
  const shapeNote = byId('shapeNote');
  const codeDetails = byId('codeDetails');
  const codeLabel = byId('codeLabel');
  const codeForm = byId('codeForm');
  const codeInput = byId('codeInput');
  const codeBuildBtn = byId('codeBuildBtn');
  const codeCopyBtn = byId('codeCopyBtn');
  const codeShareBtn = byId('codeShareBtn');
  const codePasteBtn = byId('codePasteBtn');
  const codeNote = byId('codeNote');
  const printCode = byId('printCode');
  // The shape pictures and masks come from shapes.js, loaded just before.
  const Shapes = window.MazeShapes;
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
  const appInfoBtn = byId('appInfoBtn');
  const appInfoPanel = byId('appInfoPanel');
  const resetOptionsBtn = byId('resetOptionsBtn');
  const legendPicks = [...document.querySelectorAll('.legend-pick')];
  const tracePalette = byId('tracePalette');
  const tracePaletteTitle = byId('tracePaletteTitle');
  const tracePaletteSwatches = byId('tracePaletteSwatches');

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
  const mazeViewport = byId('mazeViewport');
  const zoomInBtn = byId('zoomInBtn');
  const zoomOutBtn = byId('zoomOutBtn');
  const zoomFitBtn = byId('zoomFitBtn');
  const zoomHint = byId('zoomHint');
  const userPathOverlay = byId('userPathOverlay');
  const userPathGlow = byId('userPathGlow');
  const userPathLine = byId('userPathLine');
  const userPathHead = byId('userPathHead');
  const ghostLayer = byId('ghostLayer');
  const ghostTrail = byId('ghostTrail');
  const ghostHead = byId('ghostHead');
  const ghostChip = byId('ghostChip');
  const ghostChipLabel = byId('ghostChipLabel');
  const ghostRaces = [...document.querySelectorAll('.ghost-race')];

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
  const successReplayBtn = byId('successReplayBtn');
  const successNewMazeBtn = byId('successNewMazeBtn');
  const successNewMazeChoice = byId('successNewMazeChoice');
  const successReplayChoice = byId('successReplayChoice');
  const simpleStars = byId('simpleStars');
  const simpleResultTitle = byId('simpleResultTitle');
  const simpleYouBar = byId('simpleYouBar');
  const simpleBestBar = byId('simpleBestBar');
  const simpleYouSquares = byId('simpleYouSquares');
  const simpleBestSquares = byId('simpleBestSquares');
  const simpleTime = byId('simpleTime');
  const simpleBacktracks = byId('simpleBacktracks');
  const simpleTip = byId('simpleTip');

  const simpleModeBtn = byId('simpleModeBtn');
  const fullModeBtn = byId('fullModeBtn');
  const simpleGrowBtn = byId('simpleGrowBtn');
  const simpleSolveBtn = byId('simpleSolveBtn');
  const simpleShapeBtn = byId('simpleShapeBtn');
  const simpleFitBtn = byId('simpleFitBtn');
  const simpleShapeIcon = byId('simpleShapeIcon');
  const simpleShapeSheet = byId('simpleShapeSheet');
  const simpleShapePicker = byId('simpleShapePicker');
  const dailyBtn = byId('dailyBtn');
  const dailyBtnNote = byId('dailyBtnNote');
  const simpleDailyTile = byId('simpleDailyTile');
  const successFavBtn = byId('successFavBtn');
  const myMazesBtn = byId('myMazesBtn');
  const myMazesSheet = byId('myMazesSheet');
  const myMazesTabs = [...document.querySelectorAll('#myMazesSheet [data-list]')];
  const myMazesList = byId('myMazesList');
  const myMazesEmpty = byId('myMazesEmpty');
  const myMazesNote = byId('myMazesNote');
  const myMazesForgetBtn = byId('myMazesForgetBtn');
  const simpleMazesBtn = byId('simpleMazesBtn');
  const simpleMazesSheet = byId('simpleMazesSheet');
  const simpleBestRow = byId('simpleBestRow');
  const simpleAgainRow = byId('simpleAgainRow');
  const simpleFavouriteRow = byId('simpleFavouriteRow');

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
  if (missingIds.length || !levelButtons.length || !Shapes || mixedReleases) {
    // Offline, the saved copy is all there is, so it is kept and the message
    // below asks for a reopen later instead.
    if (!pageUrl.searchParams.has(FRESH_PARAM) && navigator.onLine !== false) {
      pageUrl.searchParams.set(FRESH_PARAM, Date.now());
      // The safety net in index.html leaves this reload to us.
      window.mazeBuilderReloading = true;
      if (offlineBadgeText) offlineBadgeText.textContent = 'Updating…';
      forgetOfflineCopy().then(() => location.replace(pageUrl.href));
    } else {
      console.warn('Maze Builder page and script are from different releases; missing:',
        missingIds.join(', ') || (mixedReleases ? `none (page ${pageBuild}, script ${BUILD})` : !Shapes ? 'shapes.js' : 'level picker'));
      if (statusEl) statusEl.textContent = 'Maze Builder just updated. Close it and open it again to finish.';
    }
    return;
  }
  if (pageUrl.searchParams.has(FRESH_PARAM)) {
    pageUrl.searchParams.delete(FRESH_PARAM);
    history.replaceState(history.state, '', pageUrl.href);
  }

  // The maze shape lives in the script rather than a form control, so it gets
  // a small stand-in with the same value property the settings code uses.
  let shapeId = 'square';
  const shapeControl = {
    get value() { return shapeId; },
    set value(id) { shapeId = id; },
    isValid: id => Shapes.has(id)
  };

  // The search colours are the child's to pick. Each hue comes in the shade
  // that fits each job: soft for explored squares, brighter for the wave,
  // strongest for the kept route. So the route still stands out from the
  // squares behind it even when both get the same hue. Walls, S and F keep
  // their colours: they mean the same thing everywhere.
  const TRACE_HUES = {
    cyan:   { name: 'Sky',    soft: '#d9f4ff', mid: '#9cddff', deep: '#4cb8ff', glow: '50,173,230' },
    blue:   { name: 'Blue',   soft: '#dcebff', mid: '#a9cbff', deep: '#4a9bff', glow: '0,122,255' },
    indigo: { name: 'Indigo', soft: '#e3e2fb', mid: '#bab8f5', deep: '#7a78ee', glow: '88,86,214' },
    purple: { name: 'Purple', soft: '#f0e1fa', mid: '#d8b0f1', deep: '#b45ee6', glow: '175,82,222' },
    pink:   { name: 'Pink',   soft: '#ffe0ea', mid: '#ffb0c6', deep: '#ff5c8a', glow: '255,45,85' },
    orange: { name: 'Orange', soft: '#ffe8cc', mid: '#ffc57a', deep: '#ff9f0a', glow: '255,149,0' },
    gold:   { name: 'Gold',   soft: '#fff4c4', mid: '#ffe680', deep: '#ffd60a', glow: '255,214,10' },
    green:  { name: 'Green',  soft: '#daf6e2', mid: '#a2e8b5', deep: '#34c759', glow: '52,199,89' }
  };
  const TRACES = {
    frontier: { label: 'Frontier', hue: 'cyan',
      vars: h => ({ '--frontier': h.mid, '--current': h.deep, '--frontier-glow': h.glow }), shade: h => h.mid },
    visited: { label: 'Explored', hue: 'blue',
      vars: h => ({ '--visited': h.soft }), shade: h => h.soft },
    solution: { label: 'Shortest path', hue: 'gold',
      vars: h => ({ '--solution': h.deep, '--solution-glow': h.glow }), shade: h => h.deep }
  };

  function applyTraceColour(trace) {
    const vars = TRACES[trace].vars(TRACE_HUES[TRACES[trace].hue]);
    for (const [name, value] of Object.entries(vars)) document.documentElement.style.setProperty(name, value);
  }

  // A stand-in control per trace, like the shape's, so the settings code
  // remembers the picked hue by name.
  const traceControl = trace => ({
    get value() { return TRACES[trace].hue; },
    set value(hue) { TRACES[trace].hue = hue; applyTraceColour(trace); },
    isValid: hue => Object.hasOwn(TRACE_HUES, hue)
  });

  // Settings a child picked last time (size, speed, shape and maze style) come back
  // on the next visit. Only the choices are remembered, never the maze itself.
  // Storage can be missing or blocked (private browsing), so every access is
  // guarded.
  const SETTINGS_KEY = 'mazeBuilder.settings';
  const rememberedControls = {
    size: sizeSelect, speed: speedSelect, shape: shapeControl, ...dials,
    frontierColour: traceControl('frontier'),
    exploredColour: traceControl('visited'),
    shortestColour: traceControl('solution')
  };
  // Build and Solve mode: the picture-only way to play for children who
  // cannot read yet. Off unless a grown-up turned it on.
  let simpleMode = false;
  // Race the ghost of a maze's best saved run. On unless the chip turned it
  // off; Kid Mode always shows it, since it has no chip.
  let ghostOn = true;

  // A saved value only comes back if the control can still show it: a
  // listed option for a menu, a whole step within range for a dial.
  function isValidSetting(control, value) {
    if (control.isValid) return control.isValid(value);
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
    simpleMode = saved.simple === true;
    ghostOn = saved.ghost !== false;

    for (const [key, control] of Object.entries(rememberedControls)) {
      const value = String(saved[key]);
      if (isValidSetting(control, value)) control.value = value;
    }
  }

  function saveSettings() {
    const settings = {};
    for (const [key, control] of Object.entries(rememberedControls)) settings[key] = control.value;
    settings.simple = simpleMode;
    settings.ghost = ghostOn;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      // Not saved this time; the app works the same without it.
    }
  }

  restoreSettings();

  let size = Number(sizeSelect.value);
  let grid = [];
  // mask[r][c] is true for the squares inside the maze's shape. A square
  // grid is all inside; other shapes leave the squares around them out.
  let mask = [];
  let insideCount = 0;
  let walls = { right: [], bottom: [] };
  let wallEls = { right: [], bottom: [] };
  let start = null;
  let end = null;
  // The settings and seed the maze on screen grew from, while it is still
  // that maze; null for a blank or hand-edited one.
  let grownMaze = null;
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
  let userTimerId = null;
  let userMoves = 0;
  let userBacktracks = 0;
  // Every step of the attempt in order, back-ups included, with when it
  // happened, so a saved maze keeps how it was solved (see recordUserStep).
  let userSteps = [];
  let userOptimalCells = null;
  let userCompleted = false;
  // The run this attempt races (see loadGhost), how far into it the ghost
  // has got in milliseconds, and the frame that moves it.
  let ghost = null;
  let ghostAt = 0;
  let ghostFrame = 0;
  let userPointerId = null;
  let userLastPoint = null;
  let celebrationToken = 0;
  let drawPointerId = null;
  // Puts back whatever the current one-finger stroke changed, for when a
  // second finger lands right after it and the touch turns out to be a pinch.
  let strokeUndo = null;
  let strokeEdges = null;

  // How far the maze is zoomed in: 1 fits the whole maze in its window.
  let zoom = 1;
  let zoomSize = null;

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
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

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
  // Beats shorter than a frame are saved up and slept together, so a big
  // grid's tiny steps keep their speed instead of each waiting on the timer
  // (and the screen) on its own.
  let owedBeat = 0;
  async function pace(ms, myRunId) {
    owedBeat += ms;
    if (owedBeat >= 16) {
      await sleep(owedBeat);
      owedBeat = 0;
    }
    await waitWhilePaused(myRunId);
    return running && myRunId === runId;
  }

  function currentDelay() {
    return Number(speedSelect.value);
  }

  // Super fast (a delay of 0) grows the maze as a short fast-forward rather
  // than one beat per step, so even the biggest maze is ready in moments.
  function isSuperFast() {
    return currentDelay() === 0;
  }

  // Thin walls make every square part of the maze, so a big grid has far
  // more steps to grow. Quicken each step as the grid grows so a large maze
  // still finishes while a child is watching; small mazes keep full speed.
  function growthDelay() {
    return currentDelay() * Math.min(1, Math.sqrt(121 / insideCount));
  }

  // The shortest beat for the tip walking back. Past 25 × 25 it shortens too,
  // so a 51 × 51 maze, four times the squares, grows in about three times
  // as long as a 25 × 25 one.
  function retreatBeat() {
    return Math.max(6 * Math.min(1, Math.sqrt(625 / insideCount)), growthDelay() * 0.45);
  }

  // The search wave and the gold trace move one distance step per beat, and
  // the route through a grid past 25 × 25 gets far longer. Shorten those
  // beats in step so a 51 × 51 search takes about as long as a 25 × 25 one.
  function searchBeat(ms) {
    return ms * Math.min(1, 625 / insideCount);
  }

  // On a phone or portrait iPad the controls sit above the maze, so the
  // button a child just tapped can leave the maze below the screen. When
  // the maze starts growing or being solved, scroll it into view; leave the
  // page alone when it is already fully visible.
  function bringMazeIntoView() {
    const box = mazeViewport.getBoundingClientRect();
    const viewHeight = window.innerHeight || document.documentElement.clientHeight;
    if (box.top >= 0 && box.bottom <= viewHeight) return;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    mazeViewport.scrollIntoView({
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
    for (const tile of shapePicker.children) tile.disabled = disabled;
    buttons.draw.disabled = disabled;
    buttons.start.disabled = disabled;
    buttons.end.disabled = disabled;
    document.getElementById('generateBtn').disabled = disabled;
    dailyBtn.disabled = disabled;
    codeBuildBtn.disabled = disabled;
    codePasteBtn.disabled = disabled;
    document.getElementById('animateBtn').disabled = disabled;
    document.getElementById('instantBtn').disabled = disabled;
    document.getElementById('blankBtn').disabled = disabled;
    document.getElementById('clearSolutionBtn').disabled = disabled;
    userSolveBtn.disabled = disabled;
    // Build and Solve keeps its picture buttons while the child draws; only
    // an animation turns them off.
    simpleGrowBtn.disabled = disabled && running;
    simpleSolveBtn.disabled = disabled && running;
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
    const squared = fitShapeToSize();
    makeBlankGrid();
    if (squared) announceSquared();
  }

  function applyLevel(name) {
    if (running) return;
    const level = LEVELS[name];
    for (const dialName of Object.keys(dials)) dials[dialName].value = String(level[dialName]);
    const shapeBefore = shapeId;
    setSize(level.size);
    syncLevelUI();
    saveSettings();
    setStatus(shapeBefore !== shapeId
      ? `${level.label} is set. Its maze is too small for a shape, so it is a square again.`
      : `${level.label} is set. Tap Grow a Maze to build one.`, 'Ready');
  }

  // Shape picker: one picture tile per shape, so a child who cannot read
  // yet can still choose the cat. The row above the tiles shows the current
  // shape's picture and name.
  function buildShapePicker() {
    for (const { id, label } of Shapes.list) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'shape-tile';
      tile.dataset.shape = id;
      tile.setAttribute('role', 'radio');
      tile.setAttribute('aria-label', label);
      tile.title = label;
      tile.innerHTML = Shapes.svg(id);
      tile.addEventListener('click', () => applyShape(id));
      shapePicker.appendChild(tile);
    }
  }

  // Each copy of a picture gets its own mask ids: a mask inside a hidden
  // panel (the sidebar in Build and Solve) would blank every copy using it.
  const shapeSvg = (id, prefix) => Shapes.svg(id).replace(/shape-mask-/g, `${prefix}-mask-`);

  // Build and Solve's shape picker: the same pictures as big tiles. One tap
  // on a tile grows a maze in that shape straight away.
  function buildSimpleShapePicker() {
    for (const { id, label } of Shapes.list) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'simple-shape-tile';
      tile.dataset.shape = id;
      tile.setAttribute('role', 'radio');
      tile.setAttribute('aria-label', label);
      tile.innerHTML = shapeSvg(id, 'simple-shape');
      tile.addEventListener('click', () => growSimpleShape(id));
      simpleShapePicker.appendChild(tile);
    }
  }

  function openSimpleShapes() {
    closeSimpleMazes();
    simpleShapeSheet.hidden = false;
    simpleShapeBtn.setAttribute('aria-expanded', 'true');
    const current = simpleShapePicker.querySelector('[aria-checked="true"]');
    if (current) current.focus({ preventScroll: true });
  }

  function closeSimpleShapes() {
    simpleShapeSheet.hidden = true;
    simpleShapeBtn.setAttribute('aria-expanded', 'false');
  }

  function growSimpleShape(id) {
    closeSimpleShapes();
    // A child may pick while a maze is still growing; start over in the new shape.
    if (running) cancelAnimation();
    applyShape(id);
    animateMazeGrowth();
  }

  function syncShapeUI() {
    for (const tile of [...shapePicker.children, ...simpleShapePicker.children]) {
      if (!tile.dataset.shape) continue;
      tile.setAttribute('aria-checked', String(tile.dataset.shape === shapeId));
    }
    simpleShapeIcon.innerHTML = shapeSvg(shapeId, 'simple-icon');
    shapeIcon.innerHTML = shapeSvg(shapeId, 'shape-icon');
    shapeLabel.textContent = Shapes.label(shapeId);
    // Only a grid too small for pictures explains the size rule.
    shapeNote.hidden = size >= Shapes.minSize;
  }

  // A picture needs at least Shapes.minSize squares across, so picking one
  // on a smaller grid makes the grid that big first.
  function applyShape(id) {
    if (running || id === shapeId) return;
    shapeId = id;
    const grew = id !== 'square' && size < Shapes.minSize;
    if (grew) {
      size = Shapes.minSize;
      sizeSelect.value = String(size);
      syncLevelUI();
    }
    saveSettings();
    syncShapeUI();
    makeBlankGrid();
    if (grew) {
      setStatus(`Shapes need room, so the grid grew to ${size} × ${size}. Grow a maze to fill the ${Shapes.label(id).toLowerCase()}.`, 'Ready');
    }
  }

  // Going below the smallest shape size turns the maze back into a square.
  // Returns true when it did.
  function fitShapeToSize() {
    if (shapeId === 'square' || size >= Shapes.minSize) return false;
    shapeId = 'square';
    syncShapeUI();
    return true;
  }

  function announceSquared() {
    setStatus(`Shapes need ${Shapes.minSize} × ${Shapes.minSize} or bigger, so this maze is a square again.`, 'Ready');
  }

  function makeBlankGrid() {
    cancelAnimation();
    exitUserSolveMode(false);
    setInteractiveDisabled(false);

    grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => createCellState())
    );
    useShapeMask();
    syncShapeUI();
    walls = makeWalls(false);

    ({ start, end } = Shapes.ends(shapeId, size));
    setGrownMaze(null);

    render();
    resetMetrics();
    setStatus(shapeId === 'square'
      ? 'Draw walls along the grid lines, or grow a maze from scratch.'
      : `${Shapes.label(shapeId)} shape. Grow a maze to fill it, or draw your own walls inside.`, 'Ready');
  }

  // The mask for the chosen shape at this size. Squares outside it are not
  // part of the maze: no route, search or wall can use them.
  function useShapeMask() {
    mask = Shapes.mask(shapeId, size);
    insideCount = mask.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  }

  function isShaped() {
    return shapeId !== 'square';
  }

  // Walls sit on the edges between squares, like cell borders in a
  // spreadsheet, so every square is open path. right[r][c] is the edge
  // between (r, c) and (r, c + 1); bottom[r][c] is the edge between (r, c)
  // and (r + 1, c). The outside of the grid is always a wall.
  // An edge that touches a square outside the shape is always a wall: the
  // shape's outline is the maze's outside wall.
  function makeWalls(value) {
    return {
      right: Array.from({ length: size }, (_, r) =>
        Array.from({ length: size - 1 }, (_, c) => value || !mask[r][c] || !mask[r][c + 1])),
      bottom: Array.from({ length: size - 1 }, (_, r) =>
        Array.from({ length: size }, (_, c) => value || !mask[r][c] || !mask[r + 1][c]))
    };
  }

  function inBounds(p) {
    return p.r >= 0 && p.c >= 0 && p.r < size && p.c < size;
  }

  function isInside(p) {
    return inBounds(p) && mask[p.r][p.c];
  }

  // Part of the shape's outline, or out beyond it: never drawn or erased.
  function isFixedEdge(edge) {
    const a = { r: edge.r, c: edge.c };
    const b = edge.side === 'right' ? { r: edge.r, c: edge.c + 1 } : { r: edge.r + 1, c: edge.c };
    return !isInside(a) || !isInside(b);
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
    if (!isInside(a) || !isInside(b)) return false;
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
          if (isFixedEdge({ side, r, c })) line.classList.add('fixed');
          frag.appendChild(line);
          return line;
        });
      });
    }

    if (isShaped()) frag.appendChild(shapeOutline());
    wallLayer.appendChild(frag);
  }

  // The shape's outline as one path along every edge between a square inside
  // the shape and one outside it (or the grid's edge). A square grid uses
  // the maze border instead.
  function shapeOutline() {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', 'shape-outline');
    path.setAttribute('d', shapeOutlinePath());
    return path;
  }

  // The outline as SVG path data, `unit` long per square.
  function shapeOutlinePath(unit = 1) {
    let d = '';
    for (let r = 0; r <= size; r++) {
      for (let c = 0; c <= size; c++) {
        if (c < size && isInside({ r: r - 1, c }) !== isInside({ r, c })) d += `M${c * unit} ${r * unit}h${unit}`;
        if (r < size && isInside({ r, c: c - 1 }) !== isInside({ r, c })) d += `M${c * unit} ${r * unit}v${unit}`;
      }
    }
    return d;
  }

  function render() {
    mazeViewport.style.setProperty('--grid-size', size);
    // A new grid size starts from the whole maze again.
    if (size !== zoomSize) {
      zoomSize = size;
      resetZoom();
    }
    mazeStage.classList.toggle('shaped', isShaped());
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
    if (!mask[r][c]) {
      cellEl.classList.add('off');
      return;
    }

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
    syncModeButtons();

    if (mode === 'draw') setStatus('Walls mode: tap or drag along a grid line to add or remove a wall.', 'Editing');
    if (mode === 'start') setStatus('Tap a square to place the start.', 'Editing');
    if (mode === 'end') setStatus('Tap a square to place the finish.', 'Editing');
  }

  // While the player draws, no editing tool is lit: the maze is being
  // solved, not edited.
  function syncModeButtons() {
    for (const [name, btn] of Object.entries(buttons)) {
      btn.classList.toggle('active', !userSolveMode && name === mode);
    }
  }

  // Picking an editing tool while solving ends the attempt first, so a wall
  // or a moved S or F never lands in the middle of a line.
  function pickTool(name) {
    if (running) return;
    if (userSolveMode) exitUserSolveMode(false);
    setMode(name);
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

    if (!isInside(p)) {
      setStatus('That square is outside the shape. Pick a square inside it.', 'Editing');
      return;
    }

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
    setGrownMaze(null);
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

    if (hasWall(edge) !== drawValue) {
      if (strokeEdges) strokeEdges.push({ edge, was: !drawValue });
      setWall(edge, drawValue);
      setGrownMaze(null);
    }
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
      const before = { start, end, mode, grown: grownMaze };
      placeMarker(p);
      strokeUndo = () => {
        ({ start, end } = before);
        setGrownMaze(before.grown);
        render();
        setMode(before.mode);
      };
      return;
    }

    e.preventDefault();
    const edge = pointEdge(e.clientX, e.clientY, geo);
    if (!edge || isFixedEdge(edge)) {
      setStatus(isShaped()
        ? 'The outline of the shape is always a wall. Draw along the lines inside it.'
        : 'The outside wall is always there. Draw along the lines inside the maze.', 'Editing');
      return;
    }

    drawing = true;
    drawPointerId = e.pointerId;
    drawLastPoint = { x: e.clientX, y: e.clientY };
    try { mazeEl.setPointerCapture(e.pointerId); } catch (_) {}
    const changed = strokeEdges = [];
    const grownBefore = grownMaze;
    strokeUndo = () => {
      for (const step of changed.reverse()) setWall(step.edge, step.was);
      setGrownMaze(grownBefore);
    };
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
      if (!edge || edge.dist > 0.3 || edge.cross < 0.25 || edgeKey(edge) === lastPainted || isFixedEdge(edge)) continue;
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
    if (e && e.pointerId !== drawPointerId) return;
    drawing = false;
    drawPointerId = null;
    drawLastPoint = null;
    lastPainted = null;
    strokeEdges = null;
  }

  window.addEventListener('pointerup', endDrawStroke);
  window.addEventListener('pointercancel', endDrawStroke);

  // Seeds and maze codes. Every grown maze comes from a seed: a number that
  // drives each chance the planner takes, so the same seed with the same
  // settings grows exactly the same maze. A maze code packs the seed with
  // everything else the planner reads (size, Maze style, shape, and where S
  // and F sit) into a few letters and digits, so a code on its own rebuilds
  // the maze:
  //
  //   K7M2Q-X3PAB              S and F where a fresh grid puts them
  //   K7M2Q-X3PAB-4FQ2Z        S and F moved, so their squares come along
  //
  // The characters are Crockford's base 32, which leaves out I, L, O and U, so
  // a code reads off a page and types back in without mix-ups (O is read as 0,
  // I and L as 1). The last character is a check on the others, so a typo is
  // caught instead of quietly growing some other maze. Codes are only letters,
  // digits and dashes, so a link can carry one as it is.
  //
  // Bits, in order: version (2), seed (SEED_BITS), size (3), style (7: the
  // three dials as one number from 0 to 124), shape (6), then for a moved S
  // and F their row and column (6 bits each). CODE_SIZES and CODE_SHAPES only
  // ever grow at the end, so old codes keep their meaning; a change to what a
  // code means bumps CODE_VERSION.
  const CODE_DIGITS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const CODE_VERSION = 0;
  const SEED_BITS = 25;
  const CODE_SIZES = [11, 15, 21, 25, 31, 41, 51];
  const CODE_SHAPES = [
    'square', 'heart', 'star', 'house', 'castle', 'rocket', 'tree', 'robot', 'cat', 'dog',
    'bunny', 'fish', 'turtle', 'elephant', 'dinosaur', 'butterfly', 'capybara', 'ireland', 'usa', 'car',
    'horse', 'donut', 'octopus', 'snail'
  ];
  // Characters before the check: enough for the bits, plain or with S and F.
  const CODE_PLAIN = 9;
  const CODE_WITH_ENDS = 14;

  function randomSeed() {
    const bits = new Uint32Array(1);
    crypto.getRandomValues(bits);
    return bits[0] % 2 ** SEED_BITS;
  }

  // A small, fast random number source (mulberry32) that gives the same run
  // of numbers in 0 to 1 for the same seed on every device.
  function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // A 32-bit number for a piece of text (FNV-1a), for seeding from a setting
  // and for a code's check character.
  function hashText(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  const samePoint = (a, b) => a.r === b.r && a.c === b.c;
  const codeCheck = data => CODE_DIGITS[hashText(data) % 32];
  const bitsOf = (value, width) => value.toString(2).padStart(width, '0');

  // The code for a maze: { seed, size, style, shape, start, end }, or '' when
  // it cannot have one (a shape this version has no number for).
  function formatMazeCode(maze) {
    const sizeIndex = CODE_SIZES.indexOf(maze.size);
    const shapeIndex = CODE_SHAPES.indexOf(maze.shape);
    if (sizeIndex < 0 || shapeIndex < 0) return '';
    const { twisty, shortcuts, branches } = maze.style;
    let bits = bitsOf(CODE_VERSION, 2) + bitsOf(maze.seed, SEED_BITS) + bitsOf(sizeIndex, 3) +
      bitsOf(twisty * 25 + shortcuts * 5 + branches, 7) + bitsOf(shapeIndex, 6);
    const ends = Shapes.ends(maze.shape, maze.size);
    const moved = !samePoint(maze.start, ends.start) || !samePoint(maze.end, ends.end);
    if (moved) {
      for (const p of [maze.start, maze.end]) bits += bitsOf(p.r, 6) + bitsOf(p.c, 6);
    }
    bits = bits.padEnd(5 * (moved ? CODE_WITH_ENDS : CODE_PLAIN), '0');
    let data = '';
    for (let i = 0; i < bits.length; i += 5) data += CODE_DIGITS[parseInt(bits.slice(i, i + 5), 2)];
    return (data + codeCheck(data)).match(/.{1,5}/g).join('-');
  }

  // Reads a typed or pasted code. Returns { maze } with every setting filled
  // in, or { error } with a sentence saying what is wrong.
  function readMazeCode(text) {
    const typed = String(text).toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
    if (!typed) return { error: 'Type a maze code first, like K7M2Q-X3PAB.' };
    if (typed.length !== CODE_PLAIN + 1 && typed.length !== CODE_WITH_ENDS + 1 || /U/.test(typed)) {
      return { error: 'A maze code has 10 or 15 letters and numbers, like K7M2Q-X3PAB.' };
    }
    const data = typed.slice(0, -1);
    if (codeCheck(data) !== typed.slice(-1)) {
      return { error: 'That code has a typo somewhere. Check each letter and number.' };
    }

    const bits = [...data].map(ch => bitsOf(CODE_DIGITS.indexOf(ch), 5)).join('');
    let at = 0;
    const take = width => parseInt(bits.slice(at, at += width), 2);
    if (take(2) !== CODE_VERSION) return { error: 'This code is from a newer Maze Builder. Open the app while online to update it.' };
    const seed = take(SEED_BITS);
    const size = CODE_SIZES[take(3)];
    const styleNumber = take(7);
    const shape = CODE_SHAPES[take(6)];
    const style = { twisty: Math.floor(styleNumber / 25), shortcuts: Math.floor(styleNumber / 5) % 5, branches: styleNumber % 5 };
    if (!size || styleNumber > 124 || !shape || !Shapes.has(shape) ||
        (shape !== 'square' && size < Shapes.minSize)) {
      return { error: 'That code has a typo somewhere. Check each letter and number.' };
    }

    let { start: s, end: f } = Shapes.ends(shape, size);
    if (data.length === CODE_WITH_ENDS) {
      s = { r: take(6), c: take(6) };
      f = { r: take(6), c: take(6) };
      const shapeMask = Shapes.mask(shape, size);
      const inShape = p => p.r < size && p.c < size && shapeMask[p.r][p.c];
      if (!inShape(s) || !inShape(f) || samePoint(s, f)) {
        return { error: 'That code has a typo somewhere. Check each letter and number.' };
      }
    }
    return { maze: { seed, size, style, shape, start: s, end: f } };
  }

  // Share links carry the code after the page address, like
  //   https://thecitizensnips.github.io/maze-builder/#maze=K7M2Q-X3PAB
  // The part after # never leaves the device, so the link opens the same
  // page (and the same offline copy) as any other visit, and needs no server.
  const LINK_KEY = 'maze';

  function mazeLink(code) {
    const url = new URL('./', location.href);
    url.hash = `${LINK_KEY}=${code}`;
    return url.href;
  }

  // The code in a link's #maze= part, or '' when it has none.
  function codeInLink(hash) {
    const match = String(hash).match(new RegExp(`[#&]${LINK_KEY}=([0-9A-Za-z-]+)`));
    return match ? match[1] : '';
  }

  // The first maze code in some pasted text (a message or a share link), or
  // the text itself when there is none, so its error can say what is wrong.
  function findMazeCode(text) {
    const linked = codeInLink(text);
    if (linked) return linked;
    const found = String(text).match(/[0-9A-Za-z]{5}(?:[-\s]?[0-9A-Za-z]{5}){1,2}/g) || [];
    return found.find(code => readMazeCode(code).maze) || String(text).trim();
  }

  // Shows the code for the maze on screen, beside "Maze code" and on the
  // printed page. Drawing a wall or moving S or F after growing makes a
  // maze the code would not rebuild, so the code goes away until the next grow.
  function setGrownMaze(maze) {
    grownMaze = maze;
    const code = maze ? formatMazeCode(maze) : '';
    codeLabel.textContent = code || 'None';
    if (document.activeElement !== codeInput) codeInput.value = code;
    codeCopyBtn.disabled = !code;
    codeShareBtn.disabled = !code;
    printCode.textContent = code ? `Maze code ${code}` : '';
    syncSavedUI();
  }

  function showCodeNote(message, isError = false) {
    codeNote.textContent = message;
    codeNote.classList.toggle('error', isError);
  }

  const CODE_NOTE = 'Every grown maze has a code. Type or paste one in to grow that maze again.';

  // Sets the app up the way a code says (size, style, shape, S and F), then
  // grows the maze from its seed.
  function growFromCode(text) {
    if (running) return;
    const read = readMazeCode(findMazeCode(text));
    if (read.error) {
      showCodeNote(read.error, true);
      setStatus(read.error, 'Ready');
      return;
    }
    const maze = read.maze;
    countPlay(formatMazeCode(maze));
    for (const name of Object.keys(dials)) dials[name].value = String(maze.style[name]);
    if (maze.size !== size || maze.shape !== shapeId) {
      size = maze.size;
      sizeSelect.value = String(size);
      shapeId = maze.shape;
      makeBlankGrid();
    }
    start = maze.start;
    end = maze.end;
    syncLevelUI();
    syncShapeUI();
    saveSettings();
    showCodeNote(CODE_NOTE);
    codeInput.blur();
    animateMazeGrowth(maze.seed);
  }

  // Paste: reads the clipboard (iOS asks first with a small Paste bubble) and
  // grows the code it holds. Where the page cannot read the clipboard, the
  // box takes a normal paste instead.
  async function pasteMazeCode() {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch (error) {
      codeInput.focus();
      showCodeNote('Paste the code into the box, then tap Grow.');
      return;
    }
    const code = findMazeCode(text);
    codeInput.value = code;
    growFromCode(code);
  }

  async function copyMazeCode() {
    const code = grownMaze && formatMazeCode(grownMaze);
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      showCodeNote(`Copied ${code}. Paste it into a message to share this maze.`);
    } catch (error) {
      codeInput.value = code;
      codeInput.focus();
      codeInput.select();
      showCodeNote('Copy the code from the box.');
    }
  }

  // Share link: the share sheet where there is one (Messages, Mail, AirDrop),
  // otherwise the link goes on the clipboard. The code rides along in the
  // words too, for someone who will type it into the Home Screen app.
  async function shareMazeLink() {
    const code = grownMaze && formatMazeCode(grownMaze);
    if (!code) return;
    const url = mazeLink(code);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Maze Builder', text: `Can you solve this maze? Maze code ${code}`, url });
        showCodeNote('Opening the link grows this very maze.');
      } catch (error) {
        // Closing the share sheet is not a problem worth a message.
        if (error.name !== 'AbortError') showCodeNote('Sharing did not work. Try Copy code instead.', true);
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showCodeNote('Copied a link to this maze. Paste it into a message to share it.');
    } catch (error) {
      codeInput.value = url;
      codeInput.focus();
      codeInput.select();
      showCodeNote('Copy the link from the box.');
    }
  }

  // A link opened in the app (on start, or tapped while it is open) grows
  // its maze, the way typing its code would. The code is then taken off the
  // address, so a reload or a later grow does not bring the link back.
  function growFromLink() {
    const code = codeInLink(location.hash);
    if (!code) return false;
    const url = new URL(location.href);
    url.hash = '';
    history.replaceState(history.state, '', url.href.replace(/#$/, ''));
    exitUserSolveMode(false);
    cancelAnimation();
    const read = readMazeCode(code);
    if (read.error) {
      showCodeNote(read.error, true);
      setStatus(`That link's maze code did not work. ${read.error}`, 'Ready');
      return false;
    }
    codeInput.value = code;
    growFromCode(code);
    return true;
  }

  // Today's maze: one maze a day, the same on every device, with no server.
  //
  // The day is the device's own calendar date, so the maze changes at local
  // midnight; two people in different time zones can be a day apart for a
  // few hours. The date is run through SHA-256 together with DAILY_SALT, a
  // fixed string, and the maze's seed and shape come from the result. So
  // tomorrow's maze cannot be worked out from today's code or by counting up
  // from it: neighbouring days share nothing. (Anyone who reads this file
  // can still compute any day's maze; without a server that cannot be
  // helped.) Changing the salt, the size or the style changes every day's
  // maze, which tests/daily.spec.js pins.
  const DAILY_SALT = 'tLJ2worBeouclMoaO-BtM3KY';
  const DAILY_SIZE = LEVELS.hard.size;
  const DAILY_STYLE = { twisty: LEVELS.hard.twisty, shortcuts: LEVELS.hard.shortcuts, branches: LEVELS.hard.branches };
  // Tries for a seed whose S-to-F route is long enough; every device tries
  // the same seeds in the same order, so they all settle on the same one.
  const DAILY_TRIES = 40;
  // How many of CODE_SHAPES the daily maze picks from, from a given day on.
  // New shapes join from a day a little after they ship, so a device still
  // on the last release grows the same maze until it updates, and days
  // already past keep their mazes. Append only.
  const DAILY_SHAPE_POOLS = [
    ['0000-01-01', 20],
    ['2026-11-01', 24]
  ];
  const dailyShapeCount = day => DAILY_SHAPE_POOLS.filter(([from]) => from <= day).pop()[1];
  // Which day's maze was last solved, and how well, on this device.
  const DAILY_KEY = 'mazeBuilder.daily';

  const dayKey = (date = new Date()) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');

  async function dailyHash(day, attempt) {
    const text = `maze-builder daily|${DAILY_SALT}|${day}|${attempt}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return new DataView(digest);
  }

  // The maze for a day ('2026-10-25'): { seed, size, style, shape, start, end },
  // the same thing a maze code holds. The shape comes from the first hash,
  // then each try takes its seed from the next.
  const dailyCache = new Map();
  function dailyMaze(day) {
    if (!dailyCache.has(day)) dailyCache.set(day, (async () => {
      const first = await dailyHash(day, 0);
      const shape = CODE_SHAPES[first.getUint32(4) % dailyShapeCount(day)];
      const mazeShape = Shapes.mask(shape, DAILY_SIZE);
      const ends = Shapes.ends(shape, DAILY_SIZE);
      const wanted = Math.floor(typicalCornerRoute(DAILY_SIZE, DAILY_STYLE, shape) / 2);
      let seed = 0;
      for (let attempt = 0; attempt < DAILY_TRIES; attempt++) {
        const hash = attempt ? await dailyHash(day, attempt) : first;
        seed = hash.getUint32(0) % 2 ** SEED_BITS;
        const plan = planMaze(DAILY_SIZE, DAILY_STYLE, ends.start, ends.end, wanted,
          { giveUpWhenShort: true, shape: mazeShape, random: seededRandom(seed) });
        if (!plan.short) break;
      }
      return { seed, size: DAILY_SIZE, style: DAILY_STYLE, shape, start: ends.start, end: ends.end };
    })());
    return dailyCache.get(day);
  }

  async function dailyCode(day = dayKey()) {
    return formatMazeCode(await dailyMaze(day));
  }

  // True when the maze on screen is today's (grown from the button, a
  // pasted code or a shared link alike).
  async function isTodaysMaze() {
    const code = grownMaze && formatMazeCode(grownMaze);
    return Boolean(code) && code === await dailyCode();
  }

  function readDailyResult() {
    try {
      const saved = JSON.parse(localStorage.getItem(DAILY_KEY));
      return saved && saved.day === dayKey() ? saved : null;
    } catch (error) {
      return null;
    }
  }

  // Remembers the best result for today's maze on this device, for the
  // mark on the Today's Maze buttons.
  async function rememberDailyResult(efficiency) {
    if (!(await isTodaysMaze())) return;
    const best = Math.max(efficiency, (readDailyResult() || {}).efficiency || 0);
    try {
      localStorage.setItem(DAILY_KEY, JSON.stringify({ day: dayKey(), efficiency: best }));
    } catch (error) {
      // Not saved; the mark just does not show.
    }
    syncDailyUI();
  }

  // A calendar page with today's date on it, so a child who cannot read
  // yet knows which tile is today's maze.
  function calendarSvg(date) {
    return `<svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="5" y="8" width="38" height="36" rx="7" fill="#fff" stroke="currentColor" stroke-width="2.5"/>
      <path d="M5 15a7 7 0 0 1 7-7h24a7 7 0 0 1 7 7v4H5z" fill="#ff453a"/>
      <rect x="14" y="3" width="4" height="10" rx="2" fill="currentColor"/>
      <rect x="30" y="3" width="4" height="10" rx="2" fill="currentColor"/>
      <text x="24" y="38" text-anchor="middle" font-size="18" font-weight="700" fill="currentColor"
        font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif">${date.getDate()}</text>
    </svg>`;
  }

  // The buttons show today's date, and a star once today's maze is solved
  // here. Called again on each grow, so an app left open overnight moves on
  // to the new day.
  function syncDailyUI() {
    const now = new Date();
    const solved = readDailyResult();
    dailyBtn.classList.toggle('solved', Boolean(solved));
    dailyBtnNote.textContent = solved ? 'Solved' : now.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    dailyBtn.setAttribute('aria-label', solved ? "Today's maze, solved" : "Today's maze");
    simpleDailyTile.classList.toggle('solved', Boolean(solved));
    simpleDailyTile.innerHTML = calendarSvg(now) +
      (solved ? '<svg class="daily-star" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-star"></use></svg>' : '');
    simpleDailyTile.setAttribute('aria-label', solved ? "Today's maze, solved" : "Today's maze");
  }

  // Grows today's maze: it is a maze code like any other, so it gets a code,
  // a share link and a printout too.
  async function growDailyMaze() {
    if (running) return;
    const runBefore = runId;
    let code = '';
    try {
      code = await dailyCode();
    } catch (error) {
      // SubtleCrypto needs a secure page (https, or localhost while testing).
      setStatus("Today's maze needs the app's https address. Open it from the Home Screen or the usual link.", 'Ready');
      return;
    }
    // Another grow started while the hash was being worked out.
    if (running || runId !== runBefore) return;
    syncDailyUI();
    growFromCode(code);
    const day = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    showCodeNote(`Today's maze for ${day}. Everyone who taps Today's Maze today gets this same one.`);
  }

  // My Mazes: every finished maze that has a code is kept on this device,
  // with a small picture of the route drawn and every step of the attempt
  // (back-ups and timing too, ready for a ghost replay of the run). The
  // lists show the 10 best finishes, the 10 lowest scores to try again, and
  // up to 10 favourites marked with the heart on the finish sheet.
  //
  // One entry per maze code, holding its best finish so far. Only entries
  // that are on a list (or a favourite) are kept, so storage stays small.
  // Reset all options leaves these alone; Forget my mazes clears them.
  const SAVED_KEY = 'mazeBuilder.mazes';
  const SAVED_LIST_SIZE = 10;
  const THUMB_SIZE = 240;

  function readSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_KEY));
      if (saved && Array.isArray(saved.results) && Array.isArray(saved.favourites)) return saved;
    } catch (error) {
      // Unreadable: start a fresh list.
    }
    return { results: [], favourites: [] };
  }

  // Best first: the highest score, then the quickest.
  const byBest = (a, b) => b.efficiency - a.efficiency || a.ms - b.ms;

  function bestMazes(saved) {
    return saved.results.slice().sort(byBest).slice(0, SAVED_LIST_SIZE);
  }

  // The lowest scores, lowest first. A perfect route has nothing to beat,
  // so it never goes on this list.
  function tryAgainMazes(saved) {
    return saved.results.filter(result => result.efficiency < 100)
      .sort((a, b) => byBest(b, a)).slice(0, SAVED_LIST_SIZE);
  }

  function favouriteMazes(saved) {
    const results = new Map(saved.results.map(result => [result.code, result]));
    return saved.favourites.map(fav => ({ ...results.get(fav.code), ...fav }));
  }

  function writeSaved(saved) {
    const keep = new Set([
      ...bestMazes(saved).map(result => result.code),
      ...tryAgainMazes(saved).map(result => result.code),
      ...saved.favourites.map(fav => fav.code)
    ]);
    saved.results = saved.results.filter(result => keep.has(result.code));
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    } catch (error) {
      // Storage is full or off; the lists just do not change this time.
    }
    syncSavedUI();
  }

  // A small picture of the maze with the player's line on it: walls, the
  // shape's outline, S and F, and the route from S to where it ended.
  function savedMazePicture(route) {
    const cell = THUMB_SIZE / (size + 1);
    const inset = cell / 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = THUMB_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);
    ctx.translate(inset, inset);

    for (const [spot, fill] of [[start, '#30d158'], [end, '#ff453a']]) {
      ctx.fillStyle = fill;
      ctx.fillRect(spot.c * cell, spot.r * cell, cell, cell);
    }

    const wallLines = new Path2D();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        for (const side of ['right', 'bottom']) {
          const edge = { side, r, c };
          if ((side === 'right' ? c === size - 1 : r === size - 1) || isFixedEdge(edge) || !hasWall(edge)) continue;
          const x = side === 'right' ? c + 1 : c;
          const y = side === 'right' ? r : r + 1;
          wallLines.moveTo(x * cell, y * cell);
          wallLines.lineTo((side === 'right' ? x : x + 1) * cell, (side === 'right' ? y + 1 : y) * cell);
        }
      }
    }
    ctx.strokeStyle = '#1c2b4f';
    ctx.lineCap = 'square';
    ctx.lineWidth = Math.max(1, cell * 0.14);
    ctx.stroke(wallLines);

    ctx.lineWidth = Math.max(2, cell * 0.28);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (isShaped()) ctx.stroke(new Path2D(shapeOutlinePath(cell)));
    else ctx.strokeRect(0, 0, size * cell, size * cell);

    if (route.length > 1) {
      ctx.beginPath();
      route.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo']((p.c + 0.5) * cell, (p.r + 0.5) * cell));
      ctx.strokeStyle = '#007aff';
      ctx.lineWidth = Math.max(2, cell * 0.45);
      ctx.stroke();
    }
    return canvas.toDataURL('image/png');
  }

  // Called when a player reaches F. Keeps this finish if the maze is new to
  // the lists or this beats its best.
  function rememberSolve(efficiency, elapsedSeconds) {
    const code = grownMaze && formatMazeCode(grownMaze);
    if (!code) return false;
    const saved = readSaved();
    const ms = Math.round(elapsedSeconds * 1000);
    const before = saved.results.find(result => result.code === code);
    if (before && byBest({ efficiency, ms }, before) >= 0) return false;
    const result = {
      code,
      shape: shapeId,
      size,
      efficiency,
      ms,
      cells: userMoves,
      shortest: userOptimalCells,
      backtracks: userBacktracks,
      // The whole attempt: one letter per step (U, D, L, R) and the timer's
      // tenths of a second at each step. Enough to replay the run exactly.
      ways: userSteps.map(step => step[0]).join(''),
      times: userSteps.map(step => step[1]),
      at: Date.now(),
      picture: savedMazePicture(userPath)
    };
    saved.results = saved.results.filter(other => other.code !== code).concat(result);
    writeSaved(saved);
    return true;
  }

  // Favourites keep at most 10. Each one counts how often it is played, so
  // a new favourite takes the place of the one played least (the one played
  // longest ago when that is a tie). Returns the favourite that made room.
  function toggleFavourite(code) {
    const saved = readSaved();
    const at = saved.favourites.findIndex(fav => fav.code === code);
    let replaced = null;
    if (at >= 0) {
      saved.favourites.splice(at, 1);
    } else {
      if (saved.favourites.length >= SAVED_LIST_SIZE) {
        replaced = saved.favourites.slice().sort((a, b) => a.plays - b.plays || a.played - b.played)[0];
        saved.favourites = saved.favourites.filter(fav => fav !== replaced);
      }
      saved.favourites.push({ code, plays: 1, played: Date.now() });
    }
    writeSaved(saved);
    return replaced;
  }

  function isFavourite(code) {
    return Boolean(code) && readSaved().favourites.some(fav => fav.code === code);
  }

  // A favourite is played each time its maze is grown again or drawn again
  // with Try again.
  function countPlay(code) {
    const saved = readSaved();
    const fav = saved.favourites.find(f => f.code === code);
    if (!fav) return;
    fav.plays++;
    fav.played = Date.now();
    writeSaved(saved);
  }

  function forgetSavedMazes() {
    try {
      localStorage.removeItem(SAVED_KEY);
    } catch (error) {
      // Nothing to forget.
    }
    syncSavedUI();
  }

  const savedTime = ms => ms < 60000
    ? `${(ms / 1000).toFixed(1)}s`
    : `${Math.floor(ms / 60000)}m ${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}s`;

  function savedDay(at) {
    const then = new Date(at);
    const days = Math.round((new Date(dayKey()) - new Date(dayKey(then))) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return then.toLocaleDateString(undefined, { weekday: 'long' });
    return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  function starsHtml(efficiency) {
    const stars = starCount(efficiency);
    return [0, 1, 2].map(i => `<svg class="${i < stars ? 'on' : ''}"><use href="#i-star"></use></svg>`).join('');
  }

  // Grows a saved maze again from its code, ready to draw.
  function playSavedMaze(code) {
    closeMyMazes();
    closeSimpleMazes();
    exitUserSolveMode(false);
    cancelAnimation();
    codeInput.value = code;
    growFromCode(code);
  }

  const SAVED_LISTS = {
    best: {
      pick: bestMazes,
      empty: 'Finish a maze and it shows up here.',
      note: 'Your 10 best finishes: most stars first, then the quickest.'
    },
    again: {
      pick: tryAgainMazes,
      empty: 'Nothing to beat yet. Mazes you finish with less than three stars show up here.',
      note: 'Your 10 lowest scores. Can you find a shorter way?'
    },
    favourites: {
      pick: favouriteMazes,
      empty: 'Tap the heart when you finish a maze to keep it here.',
      note: 'Up to 10 favourites. A new one takes the place of the one played least.'
    }
  };
  let savedListShown = 'best';

  function savedRow(item, index) {
    const li = document.createElement('li');
    li.className = 'saved-row';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'saved-open';
    const label = item.shape ? Shapes.label(item.shape) : item.code;
    const grid = item.size ? `${item.size} × ${item.size}` : '';
    const known = Number.isFinite(item.efficiency);
    open.setAttribute('aria-label', known
      ? `${label} ${grid}, ${item.efficiency}%, ${savedTime(item.ms)}. Play it again.`
      : `${label} ${grid}. Play it again.`);
    open.innerHTML = `
      <span class="saved-rank">${index + 1}</span>
      <span class="saved-picture">${item.picture ? `<img src="${item.picture}" alt="">` : ''}</span>
      <span class="saved-text">
        <b></b>
        <small>${known ? `<span class="saved-stars">${starsHtml(item.efficiency)}</span>` : ''}</small>
        <small class="saved-grid"></small>
      </span>
      ${known ? `<span class="saved-score"><b>${item.efficiency}%</b><small>${savedTime(item.ms)} · ${item.backtracks} back-up${item.backtracks === 1 ? '' : 's'}</small></span>` : ''}`;
    open.querySelector('.saved-text b').textContent = label;
    open.querySelector('.saved-grid').textContent = [grid, known ? savedDay(item.at) : 'Not finished yet'].filter(Boolean).join(' · ');
    open.addEventListener('click', () => playSavedMaze(item.code));

    const heart = document.createElement('button');
    heart.type = 'button';
    heart.className = 'saved-heart';
    const fav = isFavourite(item.code);
    heart.setAttribute('aria-pressed', String(fav));
    heart.setAttribute('aria-label', fav ? 'Remove from favourites' : 'Add to favourites');
    heart.innerHTML = '<svg><use href="#i-heart"></use></svg>';
    heart.addEventListener('click', () => {
      const replaced = toggleFavourite(item.code);
      myMazesNote.textContent = replaced
        ? 'Favourites were full, so the one played least made room.'
        : SAVED_LISTS[savedListShown].note;
    });

    li.append(open, heart);
    return li;
  }

  function renderMyMazes() {
    const saved = readSaved();
    const list = SAVED_LISTS[savedListShown];
    const items = list.pick(saved);
    for (const tab of myMazesTabs) {
      const on = tab.dataset.list === savedListShown;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-pressed', String(on));
    }
    myMazesList.replaceChildren(...items.map(savedRow));
    myMazesEmpty.hidden = items.length > 0;
    myMazesEmpty.textContent = list.empty;
    myMazesNote.textContent = list.note;
    myMazesForgetBtn.disabled = !saved.results.length && !saved.favourites.length;
  }

  function openMyMazes() {
    setForgetConfirming(false);
    renderMyMazes();
    if (typeof myMazesSheet.showModal === 'function') myMazesSheet.showModal();
    else myMazesSheet.setAttribute('open', '');
    document.documentElement.classList.add('info-open');
    const body = myMazesSheet.querySelector('.info-sheet-body');
    body.scrollTop = 0;
    // Focus the list rather than Done, so a tap leaves no focus ring.
    body.focus({ preventScroll: true });
  }

  function closeMyMazes() {
    if (!myMazesSheet.open) return;
    if (typeof myMazesSheet.close === 'function') myMazesSheet.close();
    else myMazesSheet.removeAttribute('open');
  }

  // Forget my mazes: the first tap asks, a second tap within a few seconds
  // clears every list. Not in Kid Mode, so a child cannot wipe them.
  let forgetTimer = 0;
  function setForgetConfirming(on) {
    clearTimeout(forgetTimer);
    myMazesForgetBtn.classList.toggle('confirming', on);
    myMazesForgetBtn.textContent = on ? 'Tap again to forget them all' : 'Forget my mazes';
    if (on) forgetTimer = setTimeout(() => setForgetConfirming(false), 4000);
  }

  // Kid Mode's sheet: rows of pictures, no words. A trophy row of the best,
  // a try-again row and a heart row. One tap grows that maze.
  function renderSimpleMazes() {
    const saved = readSaved();
    const rows = [
      [simpleBestRow, bestMazes(saved)],
      [simpleAgainRow, tryAgainMazes(saved)],
      [simpleFavouriteRow, favouriteMazes(saved)]
    ];
    for (const [row, items] of rows) {
      row.closest('.simple-mazes-group').hidden = !items.length;
      row.replaceChildren(...items.map(item => {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'simple-maze-tile';
        tile.setAttribute('aria-label', item.shape ? Shapes.label(item.shape) : 'Maze');
        tile.innerHTML = (item.picture ? `<img src="${item.picture}" alt="">` : '') +
          (Number.isFinite(item.efficiency) ? `<span class="saved-stars">${starsHtml(item.efficiency)}</span>` : '');
        tile.addEventListener('click', () => playSavedMaze(item.code));
        return tile;
      }));
    }
  }

  function openSimpleMazes() {
    closeSimpleShapes();
    renderSimpleMazes();
    simpleMazesSheet.hidden = false;
    simpleMazesBtn.setAttribute('aria-expanded', 'true');
  }

  function closeSimpleMazes() {
    simpleMazesSheet.hidden = true;
    simpleMazesBtn.setAttribute('aria-expanded', 'false');
  }

  // The heart on the finish sheet, and the trophy button that only shows
  // once there is something to look at.
  function syncSavedUI() {
    const saved = readSaved();
    simpleMazesBtn.hidden = !saved.results.length && !saved.favourites.length;
    const code = grownMaze && formatMazeCode(grownMaze);
    successFavBtn.hidden = !code;
    const fav = isFavourite(code);
    successFavBtn.setAttribute('aria-pressed', String(fav));
    successFavBtn.setAttribute('aria-label', fav ? 'Remove from favourites' : 'Add to favourites');
    if (myMazesSheet.open) renderMyMazes();
    if (!simpleMazesSheet.hidden) renderSimpleMazes();
  }

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
  //
  // `shape` is the mask of squares the maze fills (all of them when left
  // out). The tip only ever carves into squares inside it, so the outline
  // stays a wall and the maze fills the shape exactly.
  //
  // `random` stands in for Math.random: every chance the planner takes comes
  // from it, so a seeded one makes the same plan every time.
  function planMaze(n, style, from, to, minRoute = 0, { giveUpWhenShort = false, shape = null, random = Math.random } = {}) {
    const straightWeight = STRAIGHT_WEIGHT[style.twisty];
    const branchChance = BRANCH_CHANCE[style.branches];
    const steps = [];
    const plan = {
      right: Array.from({ length: n }, () => Array(n - 1).fill(true)),
      bottom: Array.from({ length: n - 1 }, () => Array(n).fill(true))
    };
    const inside = p => p.r >= 0 && p.c >= 0 && p.r < n && p.c < n && (!shape || shape[p.r][p.c]);
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
      let roll = random() * weights.reduce((a, b) => a + b, 0);
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
      if (branchChance && stack.length > 1 && random() < branchChance) {
        const recent = stack.slice(Math.max(0, stack.length - 1 - BRANCH_WINDOW), stack.length - 1);
        const options = recent.filter(p => uncarvedNeighbours(p).length);
        if (options.length) {
          const target = options[Math.floor(random() * options.length)];
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
    const pick = list => list[Math.floor(random() * list.length)];
    const refused = new Set();
    const closedSides = p => !inside(p) ? [] : near(p).filter(q =>
      !isOpen(p, q) && !direct(p, q) && !refused.has(edgeKey(edgeBetween(p, q)))
    );
    const openCount = Array.from({ length: n }, (_, r) =>
      Array.from({ length: n }, (_, c) => near({ r, c }).filter(q => isOpen({ r, c }, q)).length)
    );
    const squares = shape ? shape.flat().filter(Boolean).length : n * n;
    const shortcuts = Math.round(SHORTCUT_SHARE[style.shortcuts] * squares);
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

  // How long the S-to-E route usually is when S and E sit where a fresh
  // grid puts them (opposite corners of a square, far ends of a shape), for
  // this size, shape and Maze style. Worked out once per setting from a
  // handful of sample plans, so it follows the level and the dials. The
  // samples are seeded from the setting itself, so the answer is the same on
  // every device and a maze code always gets the same shortcut limit.
  const cornerRouteCache = new Map();
  function typicalCornerRoute(n, style, shapeName) {
    const cacheKey = `${n}:${shapeName}:${style.twisty}:${style.shortcuts}:${style.branches}`;
    if (!cornerRouteCache.has(cacheKey)) {
      const shape = Shapes.mask(shapeName, n);
      const ends = Shapes.ends(shapeName, n);
      const random = seededRandom(hashText(cacheKey));
      const routes = [];
      for (let i = 0; i < 9; i++) {
        routes.push(planMaze(n, style, ends.start, ends.end, 0, { shape, random }).route);
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
  //
  // Each try is a fresh seed, and the plan keeps the seed it was grown from.
  // A seed that passed plans the same maze again in one go, so a maze code
  // (`seed` given) skips the search and builds its maze straight away.
  const PLAN_BUDGET_MS = 150;
  function planLongMaze(n, style, from, to, seed = null) {
    const shape = Shapes.mask(shapeId, n);
    const wanted = Math.floor(typicalCornerRoute(n, style, shapeId) / 2);
    const plan = (seed, giveUpWhenShort = false) => ({
      ...planMaze(n, style, from, to, wanted, { giveUpWhenShort, shape, random: seededRandom(seed) }),
      seed
    });
    if (seed !== null) return plan(seed);
    const startedAt = performance.now();
    do {
      const tried = plan(randomSeed(), true);
      if (!tried.short) return tried;
    } while (performance.now() - startedAt < PLAN_BUDGET_MS);
    return plan(randomSeed());
  }

  // How long Super fast takes to play a whole maze, after planning.
  const FAST_FORWARD_MS = 900;

  // Grows a new maze from a fresh seed, or from `seed` when rebuilding a maze
  // code. (A button's click hands over its event, which is not a seed.)
  async function animateMazeGrowth(seed) {
    seed = Number.isInteger(seed) ? seed : null;
    exitUserSolveMode(false);
    cancelAnimation();
    syncDailyUI();

    const myRunId = runId;
    running = true;
    paused = false;
    runType = 'generate';
    pauseBtn.disabled = false;
    setInteractiveDisabled(true);

    // S and E stay where the child put them; the maze grows around them.
    const style = mazeStyle();
    const plan = planLongMaze(size, style, start, end, seed);
    setGrownMaze({ seed: plan.seed, size, style, shape: shapeId, start: { ...start }, end: { ...end } });

    // Every edge starts as a wall; the generator knocks out one edge per
    // step until each square is joined to the rest.
    grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => createCellState())
    );
    walls = makeWalls(true);
    render();
    bringMazeIntoView();

    const totalTargets = insideCount;
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
    const announceShortcuts = () => {
      if (shortcutsAnnounced) return;
      setStatus('Adding shortcuts, so there is more than one way through.', 'Growing');
      shortcutsAnnounced = true;
    };

    // Super fast: each frame carries out the steps due by then, so the whole
    // plan plays in about FAST_FORWARD_MS whatever the size and style. The
    // tip still travels every corridor, it just skips the pauses. Returns
    // where it stopped (the speed was changed back), or -1 when cancelled.
    const fastForwardFrom = async from => {
      const work = step => step.type === 'move' ? 0.15 * step.path.length
        : step.type === 'shortcut' ? 2.5 : 1;
      const total = plan.steps.reduce((sum, step) => sum + work(step), 0);
      const perMs = total / FAST_FORWARD_MS;
      let i = from;
      let due = 0;
      let sparks = [];
      let last = performance.now();
      const clearSparks = () => {
        for (const p of sparks) {
          grid[p.r][p.c].carveSpark = false;
          updateCell(p.r, p.c);
        }
        sparks = [];
      };

      mazeStage.classList.add('fast-forward');
      try {
        return await playFrames();
      } finally {
        mazeStage.classList.remove('fast-forward');
      }

      async function playFrames() {
      while (i < plan.steps.length && isSuperFast()) {
        await nextFrame();
        if (!running || myRunId !== runId) return -1;
        if (paused) {
          await waitWhilePaused(myRunId);
          if (!running || myRunId !== runId) return -1;
          last = performance.now();
          continue;
        }
        // Driven by the clock, not the frame count, so a busy device shows
        // bigger jumps but still finishes on time.
        const now = performance.now();
        due += (now - last) * perMs;
        last = now;
        clearSparks();

        let shown = null;
        while (i < plan.steps.length && due > 0) {
          const step = plan.steps[i++];
          due -= work(step);
          if (step.type === 'carve') {
            setWall(edgeBetween(step.from, step.to), false, { zap: true });
            grid[step.to.r][step.to.c].carveSpark = true;
            sparks.push(step.to);
            moveHead(step.to);
            shown = step;
          } else if (step.type === 'move') {
            for (const p of step.path) moveHead(p);
            shown = step;
          } else if (step.type === 'rest') {
            grid[head.r][head.c].carveHead = false;
            grid[head.r][head.c].carveTrail = true;
            updateCell(head.r, head.c);
            shown = step;
          } else if (step.type === 'shortcut') {
            announceShortcuts();
            setWall(edgeBetween(step.a, step.b), false, { zap: true });
            for (const p of [step.a, step.b]) {
              grid[p.r][p.c].carveSpark = true;
              sparks.push(p);
              updateCell(p.r, p.c);
            }
          }
        }
        if (shown) showGrowthMetrics(shown);
      }
      clearSparks();
      return i;
      }
    };

    let next = 0;
    while (next < plan.steps.length) {
      if (!running || myRunId !== runId) return;
      await waitWhilePaused(myRunId);
      if (!running || myRunId !== runId) return;

      if (isSuperFast()) {
        next = await fastForwardFrom(next);
        if (next < 0) return;
        continue;
      }

      const step = plan.steps[next++];
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
          const beat = retreatBeat() / (i < 3 ? 1 : 3);
          if (!(await pace(beat, myRunId))) return;
        }
      } else if (step.type === 'rest') {
        showGrowthMetrics(step);
        grid[head.r][head.c].carveHead = false;
        grid[head.r][head.c].carveTrail = true;
        updateCell(head.r, head.c);
        if (!(await pace(retreatBeat(), myRunId))) return;
      } else if (step.type === 'shortcut') {
        announceShortcuts();
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

    // Most people want to draw in a maze the moment it has grown, so a new
    // maze opens straight into Solve It Yourself. Discover the Path, Grow and
    // the editing tools all still work from here.
    enterUserSolveMode();
    // Kid Mode shows no words, so its drawing cue stands as it is.
    if (simpleMode && userSolveMode) return;
    const builtMessage = userSolveMode
      ? 'Maze complete. Touch S and trace to F, or tap Discover the Path to watch the search wave.'
      : 'Maze complete. Now discover how the search wave finds the finish.';
    setStatus(builtMessage, 'Built');
    isTodaysMaze().then(today => {
      if (today && myRunId === runId && statusEl.textContent === builtMessage) {
        statusEl.textContent = "Today's maze is ready. Everyone gets this same maze today. Touch S to solve it, or discover the path.";
      }
    }, () => {});
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

    const totalOpen = insideCount;

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

      if (!(await pace(searchBeat(Math.max(70, currentDelay() * 2.2)), myRunId))) return;

      for (const p of layer) {
        grid[p.r][p.c].newFrontier = false;
        grid[p.r][p.c].frontier = false;
        grid[p.r][p.c].current = true;
        updateCell(p.r, p.c);
      }

      if (!(await pace(searchBeat(Math.max(30, currentDelay() * 0.8)), myRunId))) return;

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

      if (!(await pace(searchBeat(Math.max(25, currentDelay() * 0.45)), myRunId))) return;
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

    const pathDelay = searchBeat(Math.max(45, currentDelay() * 1.35));

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
    syncSolveHints();
    syncGhost();
  }

  // Picture cues for children who cannot read the status line: S pulses
  // until the line starts, and the end of a paused line pulses until it is
  // picked up again. The styles only show them in Build and Solve mode.
  function syncSolveHints() {
    const waiting = userSolveMode && !userCompleted && !userTracing;
    mazeStage.classList.toggle('await-start', waiting && !userPath.length);
    mazeStage.classList.toggle('await-resume', waiting && userPath.length > 0);
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

  // The ghost is the best saved run on this maze (the one My Mazes keeps for
  // its code), replayed step by step from S. Its cells come from its own
  // U/D/L/R steps, so a run that does not fit this maze (it went through a
  // wall, or left the grid) gives no ghost at all.
  function loadGhost() {
    const code = grownMaze && formatMazeCode(grownMaze);
    const run = code && readSaved().results.find(result => result.code === code);
    if (!run || typeof run.ways !== 'string' || !Array.isArray(run.times)) return null;
    if (!run.ways.length || run.times.length !== run.ways.length || !/^[UDLR]+$/.test(run.ways)) return null;
    const cells = [{ r: start.r, c: start.c }];
    for (const way of run.ways) {
      const from = cells[cells.length - 1];
      const to = {
        r: from.r + (way === 'D') - (way === 'U'),
        c: from.c + (way === 'R') - (way === 'L')
      };
      if (!canMove(from, to)) return null;
      cells.push(to);
    }
    const last = cells[cells.length - 1];
    if (last.r !== end.r || last.c !== end.c) return null;
    return { cells, times: run.times.map(Number), ms: run.ms };
  }

  function ghostShown() {
    return Boolean(userSolveMode && ghost && (ghostOn || simpleMode));
  }

  // Steps the ghost has taken by this point of the race: each step happens
  // at its own tenth of a second, the same clock as the player's.
  function ghostSteps(atMs = ghostAt) {
    if (!ghost) return 0;
    const tenths = atMs / 100;
    let steps = 0;
    while (steps < ghost.times.length && ghost.times[steps] <= tenths) steps++;
    return steps;
  }

  // Draw the ghost where it is now: its head on the square it has reached
  // and a short dotted trail of the squares just before, which shows which
  // way it is heading without drawing out the whole route.
  function syncGhost() {
    ghostChip.hidden = !(userSolveMode && ghost);
    if (ghost) {
      ghostChip.setAttribute('aria-pressed', String(ghostOn));
      ghostChip.classList.toggle('off', !ghostOn);
      ghostChipLabel.textContent = ghostOn ? `Ghost ${(ghost.ms / 1000).toFixed(1)}s` : 'Ghost off';
      ghostChip.setAttribute('aria-label', ghostOn
        ? `Racing your ghost, best time ${(ghost.ms / 1000).toFixed(1)} seconds. Tap to hide it.`
        : 'Ghost hidden. Tap to race it.');
    }
    if (!ghostShown()) {
      ghostLayer.setAttribute('display', 'none');
      ghostHead.setAttribute('display', 'none');
      return;
    }
    ghostLayer.removeAttribute('display');
    ghostHead.removeAttribute('display');
    const steps = ghostSteps();
    const trail = ghost.cells.slice(Math.max(0, steps - 8), steps + 1);
    ghostTrail.setAttribute('points', trail.map(p => {
      const pt = userCellPoint(p.r, p.c);
      return `${pt.x},${pt.y}`;
    }).join(' '));
    const here = ghost.cells[steps];
    const pt = userCellPoint(here.r, here.c);
    const box = Math.max(18, Math.min(34, mazeEl.offsetWidth / size));
    ghostHead.setAttribute('x', -box / 2);
    ghostHead.setAttribute('y', -box / 2);
    ghostHead.setAttribute('width', box);
    ghostHead.setAttribute('height', box);
    ghostHead.style.transform = `translate(${pt.x}px, ${pt.y}px)`;
    ghostHead.classList.toggle('finished', steps >= ghost.cells.length - 1);
  }

  // Moves the ghost while the player's clock runs. It is drawn from the
  // clock each frame, so a slow frame never makes it lose time.
  function runGhost() {
    cancelAnimationFrame(ghostFrame);
    const frame = () => {
      ghostFrame = 0;
      if (!ghostShown() || !userStartedAt || userCompleted) return;
      ghostAt = performance.now() - userStartedAt;
      syncGhost();
      if (ghostSteps() < ghost.times.length) ghostFrame = requestAnimationFrame(frame);
    };
    ghostFrame = requestAnimationFrame(frame);
  }

  function stopGhost() {
    cancelAnimationFrame(ghostFrame);
    ghostFrame = 0;
  }

  // Who reached F first, for the success sheet: the winner stands on the
  // tall gold step. Returns null when there was no ghost to race.
  function fillGhostRace(raced, elapsed) {
    for (const race of ghostRaces) race.hidden = !raced;
    if (!raced) return null;
    const ghostTime = raced.ms / 1000;
    const youFirst = Math.round(elapsed * 10) <= Math.round(ghostTime * 10);
    for (const race of ghostRaces) {
      const you = race.querySelector('.you');
      const other = race.querySelector('.ghost');
      you.classList.toggle('first', youFirst);
      other.classList.toggle('first', !youFirst);
      you.querySelector('.ghost-podium').textContent = youFirst ? '1' : '2';
      other.querySelector('.ghost-podium').textContent = youFirst ? '2' : '1';
      you.querySelector('b').textContent = `${elapsed.toFixed(1)}s`;
      other.querySelector('b').textContent = `${ghostTime.toFixed(1)}s`;
      race.setAttribute('role', 'img');
      race.setAttribute('aria-label', youFirst
        ? `You beat your ghost: ${elapsed.toFixed(1)} seconds to its ${ghostTime.toFixed(1)}.`
        : `Your ghost got there first: ${ghostTime.toFixed(1)} seconds to your ${elapsed.toFixed(1)}.`);
    }
    return { youFirst, gap: Math.abs(ghostTime - elapsed) };
  }

  function ghostRaceCopy(race, kept, copy) {
    const gap = race.gap.toFixed(1);
    if (race.youFirst) {
      return {
        kicker: 'You Beat Your Ghost',
        title: race.gap < 0.05 ? 'Right on its heels!' : `${gap} seconds faster!`,
        subtitle: kept
          ? 'This run is your new ghost.'
          : 'Your ghost had fewer extra squares, so it stays your ghost. Can you beat it on both?'
      };
    }
    return {
      kicker: copy.kicker,
      title: copy.title,
      subtitle: kept
        ? `Your ghost was ${gap}s quicker, but your route was shorter, so this run is your new ghost.`
        : `Your ghost got there ${gap}s sooner. Try again and catch it!`
    };
  }

  function readyStatus() {
    return ghostShown()
      ? 'Your ghost is waiting on S. Start your line on S to race it to F.'
      : 'Touch S with Apple Pencil or your finger, then trace through the corridors to F.';
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
    userSteps = [];
    userStartedAt = 0;
    stopGhost();
    ghost = userSolveMode ? loadGhost() : null;
    ghostAt = 0;
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

  // The clock starts when the line leaves S and keeps running, lifted or
  // not, until F, a fresh start or leaving solve mode stops it.
  function startUserTimer(startedAt = performance.now()) {
    stopUserTimer();
    userStartedAt = startedAt;
    runGhost();

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
      setStatus('This maze has no valid route from S to F. Generate a new maze or edit this one first.', 'No Path');
      return;
    }

    userSolveMode = true;
    userSolveBtn.classList.add('active');
    userSolveBtnLabel.textContent = 'Stop Solving';
    mazeStage.classList.add('user-solving');
    userPathOverlay.classList.remove('success');
    usePlayerMetricLabels();
    resetUserAttempt();
    syncModeButtons();

    // Nothing is locked while solving: Grow, Discover the Path and the
    // editing tools each end the attempt before they change the maze.
    setInteractiveDisabled(false);
    bringMazeIntoView();
    revealCell(start);

    setStatus(readyStatus(), 'Your Turn');
  }

  function exitUserSolveMode(updateStatus = true) {
    stopUserTimer();
    stopGhost();
    ghost = null;
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
    syncModeButtons();

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
      recordUserStep(removed, next);

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
    recordUserStep(last, next);

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

  // One step of the attempt: which way the line moved (U, D, L or R; a
  // back-up is just the step back the way it came) and the timer's tenths
  // of a second when it moved, counted from the first touch on S. The clock
  // runs on while the line is lifted, so the times include those gaps, the
  // same as the timer on screen.
  function recordUserStep(from, to) {
    const way = to.r < from.r ? 'U' : to.r > from.r ? 'D' : to.c < from.c ? 'L' : 'R';
    const tenths = userStartedAt ? Math.round((performance.now() - userStartedAt) / 100) : 0;
    userSteps.push([way, tenths]);
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

  // A finger or Pencil resting on the line between two squares wobbles back
  // and forth across it. The line only leaves its end square once the pointer
  // is this far (a fraction of a square) past the edge, judged separately
  // across and along the corridor, so a wobble cannot count as stepping
  // forward, back and forward again. E is exempt so the finish never needs a
  // deeper reach.
  const USER_EDGE_SLACK = 0.25;

  function userTraceCell(x, y, geo) {
    const cell = pointCell(x, y, geo);
    const last = userPath[userPath.length - 1];
    if (!cell || !last || (cell.r === end.r && cell.c === end.c)) return cell;

    const hold = (inner, lastIndex, index) =>
      inner >= lastIndex - USER_EDGE_SLACK && inner < lastIndex + 1 + USER_EDGE_SLACK ? lastIndex : index;
    return {
      r: hold((y - geo.top) / geo.cellH, last.r, cell.r),
      c: hold((x - geo.left) / geo.cellW, last.c, cell.c)
    };
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
      const cell = userTraceCell(from.x + dx * i / steps, from.y + dy * i / steps, geo);
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

    const before = userAttemptSnapshot();
    resetUserAttempt();
    strokeUndo = () => restoreUserAttempt(before);
    captureUserPointer(e);
    userTracing = true;
    userPath = [{ r: start.r, c: start.c }];
    userPathSet = new Set([cellId(start.r, start.c)]);
    userMoves = 1;
    startUserTimer();
    syncUserOverlay();
    updateUserMetrics();

    setStatus(`Tracing with ${toolLabel(e)}. Stay in the open corridors and reach F.`, 'Tracing');
  }

  function endUserTrace(e) {
    if (!userSolveMode || !userTracing || userCompleted) return;
    if (e && userPointerId !== null && e.pointerId !== userPointerId) return;

    userTracing = false;
    userPointerId = null;
    userLastPoint = null;
    updateUserMetrics();

    syncSolveHints();
    setStatus('Paused. Touch the end of your blue line to keep going. The clock is still running.', 'Paused');
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
    const before = userAttemptSnapshot();
    strokeUndo = () => restoreUserAttempt(before);
    captureUserPointer(e);
    userTracing = true;
    traceUserPointTo(e.clientX, e.clientY);
    syncSolveHints();

    setStatus(`Tracing with ${toolLabel(e)}. Keep going to F.`, 'Tracing');
    return true;
  }

  // The attempt as it stood before a stroke, so a stroke that turns out to
  // be the first finger of a pinch leaves no trace. A finished attempt is
  // not kept: touching S after finishing starts afresh either way.
  function userAttemptSnapshot() {
    return userCompleted ? null : {
      path: userPath.slice(),
      moves: userMoves,
      backtracks: userBacktracks,
      steps: userSteps.slice(),
      startedAt: userStartedAt
    };
  }

  function restoreUserAttempt(before) {
    if (!userSolveMode || userCompleted) return;
    if (!before || !before.path.length) {
      resetUserAttempt();
      setStatus('Start your line on S, then keep the Pencil or finger down as you trace.', 'Your Turn');
      return;
    }
    userTracing = false;
    userPointerId = null;
    userLastPoint = null;
    userPath = before.path;
    userPathSet = new Set(userPath.map(p => cellId(p.r, p.c)));
    userMoves = before.moves;
    userBacktracks = before.backtracks;
    userSteps = before.steps;
    // Touching S again restarted the clock; put the attempt's own back.
    if (userStartedAt !== before.startedAt) startUserTimer(before.startedAt);
    markUserCoveredCells();
    syncUserOverlay();
    updateUserMetrics();
    setStatus('Paused. Touch the end of your blue line to keep going. The clock is still running.', 'Paused');
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

  // Build and Solve result: the stars and the two bars carry the meaning for
  // a child who cannot read; the words and numbers are for an older sibling
  // giving pointers. Stars follow the same tiers as celebrationCopy.
  function starCount(efficiency) {
    if (efficiency >= 100) return 3;
    if (efficiency >= 75) return 2;
    return 1;
  }

  function simpleResultCopy(efficiency, extra) {
    const squares = extra === 1 ? 'square' : 'squares';
    if (efficiency >= 100) {
      return { title: 'Perfect!', tip: 'That was the shortest way. Ready for a new maze?' };
    }
    if (efficiency >= 90) {
      return { title: 'So close!', tip: `Just ${extra} extra ${squares}. Try again for 3 stars!` };
    }
    if (efficiency >= 75) {
      return { title: 'Great job!', tip: `${extra} extra ${squares}. Look for the shortest way and try again!` };
    }
    return { title: 'You did it!', tip: `${extra} extra ${squares}. Look ahead before you draw, then try again!` };
  }

  function fillSimpleResult(efficiency, elapsed) {
    const stars = starCount(efficiency);
    const best = userOptimalCells || userMoves;
    const extra = Math.max(0, userMoves - best);
    const copy = simpleResultCopy(efficiency, extra);

    [...simpleStars.children].forEach((star, i) => star.classList.toggle('on', i < stars));
    simpleStars.setAttribute('aria-label', `${stars} of 3 stars`);
    simpleResultTitle.textContent = copy.title;
    simpleTip.textContent = copy.tip;
    simpleYouSquares.textContent = String(userMoves);
    simpleBestSquares.textContent = String(best);
    simpleYouBar.style.setProperty('--fill', '100%');
    simpleBestBar.style.setProperty('--fill', `${Math.round((best / Math.max(userMoves, 1)) * 100)}%`);
    simpleTime.textContent = `${elapsed.toFixed(1)}s`;
    simpleBacktracks.textContent = String(userBacktracks);

    // Point at what to do next: a perfect route earns a new maze, anything
    // else is worth another go on the same one.
    successNewMazeChoice.classList.toggle('suggested', stars === 3);
    successReplayChoice.classList.toggle('suggested', stars < 3);
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
    syncSolveHints();
    const token = ++celebrationToken;

    const elapsed = userStartedAt ? (performance.now() - userStartedAt) / 1000 : 0;
    const efficiency = userEfficiency() || 100;
    // The ghost stops where it was when the player reached F.
    stopGhost();
    const raced = ghostShown() ? ghost : null;
    if (raced) {
      ghostAt = elapsed * 1000;
      syncGhost();
    }

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

    const kept = rememberSolve(efficiency, elapsed);
    const race = fillGhostRace(raced, elapsed);
    const plain = celebrationCopy(efficiency, elapsed);
    const copy = race ? ghostRaceCopy(race, kept, plain) : plain;
    successKicker.textContent = copy.kicker;
    successTitle.textContent = copy.title;
    successSubtitle.textContent = copy.subtitle;
    successTime.textContent = `${elapsed.toFixed(1)}s`;
    successCells.textContent = String(userMoves);
    successBest.textContent = String(userOptimalCells);
    successEfficiency.textContent = `${efficiency}%`;
    fillSimpleResult(efficiency, elapsed);
    rememberDailyResult(efficiency).catch(() => {});

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

  const playAgainCounts = () => countPlay(grownMaze && formatMazeCode(grownMaze));

  successAgainBtn.addEventListener('click', () => {
    playAgainCounts();
    successSheet.hidden = true;
    resetUserAttempt();
    setStatus(ghostShown()
      ? 'Try again. Your ghost is waiting on S for a rematch.'
      : 'Try again. Start on S and see if you can improve your route.', 'Your Turn');
  });

  successReplayBtn.addEventListener('click', () => {
    playAgainCounts();
    successSheet.hidden = true;
    resetUserAttempt();
    setStatus(ghostShown()
      ? 'Try again. Your ghost is waiting on S for a rematch.'
      : 'Try again. Start on S and see if you can improve your route.', 'Your Turn');
  });

  successNewMazeBtn.addEventListener('click', animateMazeGrowth);

  // The chip hides the ghost (or brings it back) for every maze, remembered
  // like the other settings.
  ghostChip.addEventListener('click', () => {
    ghostOn = !ghostOn;
    saveSettings();
    syncGhost();
    if (ghostOn && userStartedAt && !userCompleted) runGhost();
  });

  // The heart keeps this maze in My Mazes' favourites (or lets it go).
  successFavBtn.addEventListener('click', () => {
    const code = grownMaze && formatMazeCode(grownMaze);
    if (!code) return;
    const replaced = toggleFavourite(code);
    if (isFavourite(code)) {
      setStatus(replaced
        ? 'Saved to your favourites. You had 10, so the one played least made room.'
        : 'Saved to your favourites in My Mazes.', 'Complete');
    }
  });

  myMazesBtn.addEventListener('click', openMyMazes);
  for (const tab of myMazesTabs) {
    tab.addEventListener('click', () => {
      savedListShown = tab.dataset.list;
      setForgetConfirming(false);
      renderMyMazes();
    });
  }
  myMazesForgetBtn.addEventListener('click', () => {
    if (!myMazesForgetBtn.classList.contains('confirming')) {
      setForgetConfirming(true);
      return;
    }
    setForgetConfirming(false);
    forgetSavedMazes();
  });

  // Done means finished with this maze for now: solving ends so the maze
  // can be edited. Try Again stays in Solve It Yourself.
  successCloseBtn.addEventListener('click', () => {
    successSheet.hidden = true;
    exitUserSolveMode(false);
    resetMetrics();
    setStatus('Nice work. Change the maze with Walls, Start or Finish, or tap Solve It Yourself to draw it again.', 'Ready');
  });

  // Learn sheets: each ⓘ button names a topic (grow, search, solve) and opens
  // that explainer over the app. The one by the maze title opens whichever
  // topic matches what the maze is doing right now. Reading never changes
  // the maze, so the buttons stay on during animations and solving.
  function infoTopicNow() {
    if (userSolveMode) return 'solve';
    if (runType === 'solve' || (!running && hasSearchMarks())) return 'search';
    return 'grow';
  }

  function openInfo(topic, sectionId = null) {
    const sheet = document.getElementById(`info-${topic === 'now' ? infoTopicNow() : topic}`);
    if (!sheet) return;
    for (const open of document.querySelectorAll('dialog.info-sheet[open]')) {
      if (open !== sheet) open.close();
    }
    if (!sheet.open) {
      if (typeof sheet.showModal === 'function') sheet.showModal();
      else sheet.setAttribute('open', '');
    }
    document.documentElement.classList.add('info-open');
    const body = sheet.querySelector('.info-sheet-body');
    const section = sectionId && document.getElementById(sectionId);
    if (section) section.scrollIntoView({ block: 'start' });
    else if (body) body.scrollTop = 0;
    // Focus the reading area rather than Done, so a tap does not leave a focus
    // ring on Done and the arrow keys scroll the text.
    if (body) body.focus({ preventScroll: true });
  }

  function closeInfo(sheet) {
    if (typeof sheet.close === 'function') sheet.close();
    else sheet.removeAttribute('open');
  }

  for (const btn of document.querySelectorAll('[data-info]')) {
    btn.addEventListener('click', () => openInfo(btn.dataset.info, btn.dataset.infoSection));
  }

  for (const sheet of document.querySelectorAll('dialog.info-sheet')) {
    sheet.querySelector('[data-info-close]').addEventListener('click', () => closeInfo(sheet));
    // A tap on the dimmed backdrop lands on the dialog itself, outside the card.
    sheet.addEventListener('click', e => {
      if (e.target === sheet) closeInfo(sheet);
    });
    sheet.addEventListener('close', () => {
      if (!document.querySelector('dialog.info-sheet[open]')) {
        document.documentElement.classList.remove('info-open');
      }
    });
  }

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

  // Beside the controls, the maze panel stays on screen while they scroll
  // (styles.css), but only while all of it fits: a big grid can make the
  // panel taller than the screen, and then it scrolls with the page so the
  // bottom of the maze and the tools under it stay reachable.
  const contentPanel = byId('contentPanel');
  function syncPanelFit() {
    contentPanel.classList.toggle('fits-screen', contentPanel.offsetHeight + 32 <= window.innerHeight);
  }
  if ('ResizeObserver' in window) new ResizeObserver(syncPanelFit).observe(contentPanel);
  window.addEventListener('resize', syncPanelFit);
  syncPanelFit();

  // ---------- Zoom and pan ----------
  // The maze fits its window by default. A pinch on the grid, or the zoom
  // buttons under it, make the squares bigger inside that same window, like
  // a map on a page, and two fingers drag it around. Zooming sets the square
  // size itself (--zoom) rather than scaling a picture, so walls stay crisp
  // and every pointer calculation (mazeGeometry) keeps working unchanged.
  const ZOOM_STEP = 1.5;
  // Squares may grow to about this many pixels, and always to at least
  // twice their fitted size.
  const ZOOM_CELL_PX = 64;
  // A second finger that slides this far (px) starts a pinch. One resting
  // or drifting a little, like a palm or the other hand, leaves the line
  // alone.
  const PINCH_SLOP = 24;
  // A second finger this soon (ms) after the first, before the first has
  // gone anywhere (px), means both were meant for a pinch, so whatever the
  // first one just drew or moved is put back.
  const PINCH_TOGETHER_MS = 350;
  const PINCH_TOGETHER_PX = 24;

  function fitCellPx() {
    return mazeEl.clientWidth / size / zoom;
  }

  function maxZoom() {
    const fit = fitCellPx();
    return fit > 0 ? Math.min(6, Math.max(2, ZOOM_CELL_PX / fit)) : 2;
  }

  // Zoom so the point of the maze at fraction (fx, fy) of its width and
  // height lands under the screen point (x, y).
  function applyZoom(next, fx, fy, x, y) {
    next = Math.max(1, Math.min(maxZoom(), next));
    if (next < 1.04) next = 1;
    zoom = next;
    mazeViewport.style.setProperty('--zoom', String(zoom));
    mazeViewport.classList.toggle('zoomed', zoom > 1);
    const box = mazeStage.getBoundingClientRect();
    mazeViewport.scrollLeft += box.left + fx * box.width - x;
    mazeViewport.scrollTop += box.top + fy * box.height - y;
    syncZoomUI();
  }

  // Zoom keeping the maze point under (x, y) still; the window's centre by
  // default, which is what the buttons use.
  function zoomAround(next, x, y) {
    const view = mazeViewport.getBoundingClientRect();
    if (x === undefined) {
      x = view.left + view.width / 2;
      y = view.top + view.height / 2;
    }
    const box = mazeStage.getBoundingClientRect();
    if (!box.width || !box.height) return;
    applyZoom(next, (x - box.left) / box.width, (y - box.top) / box.height, x, y);
  }

  function resetZoom() {
    zoom = 1;
    mazeViewport.style.setProperty('--zoom', '1');
    mazeViewport.classList.remove('zoomed');
    mazeViewport.scrollLeft = 0;
    mazeViewport.scrollTop = 0;
    syncZoomUI();
  }

  function syncZoomUI() {
    const zoomed = zoom > 1;
    zoomOutBtn.disabled = !zoomed;
    zoomFitBtn.disabled = !zoomed;
    zoomInBtn.disabled = zoom >= maxZoom() - 0.01;
    zoomHint.textContent = zoomed
      ? 'Drag with two fingers to look around.'
      : 'Pinch the maze to zoom in.';
    simpleFitBtn.hidden = !zoomed;
    simpleFitBtn.parentElement.classList.toggle('zoomed', zoomed);
  }

  // Scroll the zoomed maze just enough to show a square, such as S when
  // solving starts.
  function revealCell(p) {
    if (zoom <= 1 || !p) return;
    const el = getCellElement(p.r, p.c);
    if (!el) return;
    const view = mazeViewport.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const margin = box.width;
    if (box.left < view.left) mazeViewport.scrollLeft -= view.left - box.left + margin;
    else if (box.right > view.right) mazeViewport.scrollLeft += box.right - view.right + margin;
    if (box.top < view.top) mazeViewport.scrollTop -= view.top - box.top + margin;
    else if (box.bottom > view.bottom) mazeViewport.scrollTop += box.bottom - view.bottom + margin;
  }

  // Touches on the maze window, watched before the maze sees them. A lone
  // finger goes through to drawing, solving or editing as always. Any other
  // finger is kept from the maze; once one slides, the two fingers pinch and
  // pan. Pencil and mouse never pinch.
  const touches = new Map();
  const gestureTouches = new Set();
  let pinch = null;
  let pinchFrame = 0;

  function touchPair() {
    return [...touches.values()].slice(0, 2);
  }

  // The lone finger's stroke ends here: put it back if the two fingers came
  // down together, otherwise keep it, just as if the finger had lifted.
  function interruptStroke(together) {
    const undo = strokeUndo;
    strokeUndo = null;
    if (drawing) endDrawStroke();
    if (together && undo) undo();
    else if (userTracing) endUserTrace();
  }

  function beginPinch(together) {
    const [a, b] = touchPair();
    interruptStroke(together);
    for (const id of touches.keys()) gestureTouches.add(id);
    const box = mazeStage.getBoundingClientRect();
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    pinch = {
      dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      zoom,
      fx: (mx - box.left) / box.width,
      fy: (my - box.top) / box.height
    };
  }

  function stepPinch() {
    pinchFrame = 0;
    if (!pinch || touches.size < 2) return;
    const [a, b] = touchPair();
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    applyZoom(pinch.zoom * dist / pinch.dist, pinch.fx, pinch.fy, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  // A pinch carries on from wherever the remaining two fingers are now.
  function restartPinch() {
    pinch = null;
    if (touches.size >= 2) {
      beginPinch(false);
    }
  }

  mazeViewport.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') {
      strokeUndo = null;
      return;
    }
    const t = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, at: performance.now() };
    // The maze gets this finger unless another finger already has it.
    const mazeHasFinger = [...touches.keys()].some(id => !gestureTouches.has(id));
    touches.set(e.pointerId, t);
    if (!mazeHasFinger && !pinch) {
      strokeUndo = null;
      return;
    }
    gestureTouches.add(e.pointerId);
    e.stopPropagation();
    e.preventDefault();
    try { mazeViewport.setPointerCapture(e.pointerId); } catch (_) {}
    if (pinch) restartPinch();
  }, true);

  mazeViewport.addEventListener('pointermove', e => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    t.x = e.clientX;
    t.y = e.clientY;
    if (!pinch && touches.size >= 2 && gestureTouches.has(e.pointerId) &&
        Math.hypot(t.x - t.x0, t.y - t.y0) >= PINCH_SLOP) {
      const [a, b] = touchPair();
      const first = [...touches].find(([id]) => !gestureTouches.has(id));
      const still = !first || Math.hypot(first[1].x - first[1].x0, first[1].y - first[1].y0) < PINCH_TOGETHER_PX;
      beginPinch(still && Math.abs(b.at - a.at) <= PINCH_TOGETHER_MS);
    }
    if (!gestureTouches.has(e.pointerId)) return;
    e.stopPropagation();
    e.preventDefault();
    if (pinch && !pinchFrame) pinchFrame = requestAnimationFrame(stepPinch);
  }, true);

  function endTouch(e) {
    if (!touches.has(e.pointerId)) return;
    touches.delete(e.pointerId);
    if (gestureTouches.delete(e.pointerId)) e.stopPropagation();
    if (pinch && touches.size < 2) {
      pinch = null;
      syncZoomUI();
    } else if (pinch) {
      restartPinch();
    }
  }

  mazeViewport.addEventListener('pointerup', endTouch, true);
  mazeViewport.addEventListener('pointercancel', endTouch, true);
  // Safari's own pinch gesture would zoom the whole page.
  mazeViewport.addEventListener('gesturestart', e => e.preventDefault());

  // A trackpad pinch (or Ctrl + scroll) on a computer zooms the maze too.
  mazeViewport.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomAround(zoom * Math.exp(-e.deltaY / 100), e.clientX, e.clientY);
  }, { passive: false });

  zoomInBtn.addEventListener('click', () => zoomAround(zoom * ZOOM_STEP));
  zoomOutBtn.addEventListener('click', () => zoomAround(zoom / ZOOM_STEP));
  zoomFitBtn.addEventListener('click', resetZoom);
  simpleFitBtn.addEventListener('click', resetZoom);

  // The fitted square size changes with rotation, so the most a maze may
  // zoom does too.
  window.addEventListener('resize', () => {
    if (zoom > maxZoom()) zoomAround(maxZoom());
    syncZoomUI();
  });

  sizeSelect.addEventListener('change', () => {
    size = Number(sizeSelect.value);
    const squared = fitShapeToSize();
    saveSettings();
    makeBlankGrid();
    syncLevelUI();
    if (squared) announceSquared();
  });

  speedSelect.addEventListener('change', saveSettings);

  // The ⓘ in the top bar folds the offline state, release and reset away; a
  // tap shows them, and a tap anywhere else or Escape folds them again.
  function setAppInfoOpen(open) {
    appInfoPanel.hidden = !open;
    appInfoBtn.setAttribute('aria-expanded', String(open));
    if (!open) setResetConfirming(false);
  }
  appInfoBtn.addEventListener('click', () => setAppInfoOpen(appInfoPanel.hidden));
  document.addEventListener('pointerdown', e => {
    if (!appInfoPanel.hidden && !e.target.closest('.app-info')) setAppInfoOpen(false);
    if (!tracePalette.hidden && !e.target.closest('.trace-palette, .legend-pick')) closeTracePalette();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!appInfoPanel.hidden) setAppInfoOpen(false);
    if (!tracePalette.hidden) closeTracePalette();
  });

  // Reset all options: the first tap asks, a second tap within a few seconds
  // forgets every remembered choice and opens the app again as new.
  let resetTimer = 0;
  function setResetConfirming(on) {
    clearTimeout(resetTimer);
    resetOptionsBtn.classList.toggle('confirming', on);
    resetOptionsBtn.textContent = on ? 'Tap again to reset' : 'Reset all options';
    if (on) resetTimer = setTimeout(() => setResetConfirming(false), 4000);
  }
  resetOptionsBtn.addEventListener('click', () => {
    if (!resetOptionsBtn.classList.contains('confirming')) {
      setResetConfirming(true);
      return;
    }
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch (error) {
      // Nothing was saved, so the reload below already starts from the defaults.
    }
    location.reload();
  });

  // The key under the numbers: a tap on a search colour opens a palette
  // right under it. A pick changes the colour at once, even mid-search,
  // since colours are only how the maze is drawn.
  let paletteTrace = null;
  function openTracePalette(btn) {
    const trace = btn.dataset.trace;
    paletteTrace = trace;
    tracePaletteTitle.textContent = `${TRACES[trace].label} colour`;
    tracePaletteSwatches.replaceChildren(...Object.entries(TRACE_HUES).map(([id, hue]) => {
      const swatch = document.createElement('button');
      swatch.className = 'trace-swatch';
      swatch.dataset.hue = id;
      swatch.setAttribute('role', 'radio');
      swatch.setAttribute('aria-checked', String(id === TRACES[trace].hue));
      swatch.setAttribute('aria-label', hue.name);
      swatch.style.setProperty('--swatch', TRACES[trace].shade(hue));
      swatch.append(document.createElement('i'));
      return swatch;
    }));
    for (const pick of legendPicks) pick.setAttribute('aria-expanded', String(pick === btn));
    tracePalette.hidden = false;
    // Under the tapped colour, kept inside the key's width.
    const room = tracePalette.parentElement.clientWidth - tracePalette.offsetWidth;
    tracePalette.style.left = `${Math.max(0, Math.min(btn.offsetLeft, room))}px`;
    tracePalette.style.top = `${btn.offsetTop + btn.offsetHeight + 8}px`;
    tracePaletteSwatches.querySelector('[aria-checked="true"]').focus({ preventScroll: true });
  }
  function closeTracePalette() {
    tracePalette.hidden = true;
    paletteTrace = null;
    for (const pick of legendPicks) pick.setAttribute('aria-expanded', 'false');
  }
  for (const pick of legendPicks) {
    pick.addEventListener('click', () => {
      if (paletteTrace === pick.dataset.trace) closeTracePalette();
      else openTracePalette(pick);
    });
  }
  tracePaletteSwatches.addEventListener('click', e => {
    const swatch = e.target.closest('.trace-swatch');
    if (!swatch || !paletteTrace) return;
    TRACES[paletteTrace].hue = swatch.dataset.hue;
    applyTraceColour(paletteTrace);
    saveSettings();
    const pick = legendPicks.find(p => p.dataset.trace === paletteTrace);
    closeTracePalette();
    pick.focus({ preventScroll: true });
  });

  for (const btn of levelButtons) {
    btn.addEventListener('click', () => applyLevel(btn.dataset.level));
  }

  for (const dial of Object.values(dials)) {
    dial.addEventListener('input', syncLevelUI);
    dial.addEventListener('change', saveSettings);
  }

  buttons.draw.addEventListener('click', () => pickTool('draw'));
  buttons.start.addEventListener('click', () => pickTool('start'));
  buttons.end.addEventListener('click', () => pickTool('end'));

  document.getElementById('generateBtn').addEventListener('click', animateMazeGrowth);
  dailyBtn.addEventListener('click', growDailyMaze);
  simpleDailyTile.addEventListener('click', () => {
    closeSimpleShapes();
    // As with a shape tile, a pick while a maze grows starts over.
    if (running) cancelAnimation();
    growDailyMaze();
  });
  codeForm.addEventListener('submit', e => {
    e.preventDefault();
    growFromCode(codeInput.value);
  });
  // A whole link or message pasted into the box shrinks to just its code.
  codeInput.addEventListener('input', () => {
    showCodeNote(CODE_NOTE);
    const text = codeInput.value.trim();
    const code = findMazeCode(text);
    if (code !== text && readMazeCode(code).maze) codeInput.value = code;
  });
  codePasteBtn.addEventListener('click', pasteMazeCode);
  codeCopyBtn.addEventListener('click', copyMazeCode);
  codeShareBtn.addEventListener('click', shareMazeLink);
  window.addEventListener('hashchange', growFromLink);
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

  // Build and Solve mode. One tap turns it on, since a grown-up reading the
  // screen does that. The way back is a press and hold on the small button
  // in the corner, so a quick tap from a child never leaves the mode.
  const FULL_MODE_HOLD_MS = 1500;
  let fullModeHoldTimer = null;

  function syncSimpleModeUI() {
    document.documentElement.classList.toggle('simple-mode', simpleMode);
    simpleModeBtn.setAttribute('aria-pressed', String(simpleMode));
  }

  function enterSimpleMode() {
    simpleMode = true;
    syncSimpleModeUI();
    saveSettings();
    window.scrollTo(0, 0);
    // Start with a maze growing, the part little kids love to watch.
    if (!running) animateMazeGrowth();
  }

  function exitSimpleMode() {
    closeSimpleShapes();
    closeSimpleMazes();
    simpleMode = false;
    syncSimpleModeUI();
    saveSettings();
    if (!running) setStatus(userSolveMode ? 'Full mode is back. Keep drawing, or tap Stop Solving.' : 'Full mode is back.', userSolveMode ? null : 'Ready');
  }

  function cancelFullModeHold() {
    clearTimeout(fullModeHoldTimer);
    fullModeHoldTimer = null;
    fullModeBtn.classList.remove('holding');
  }

  simpleModeBtn.addEventListener('click', enterSimpleMode);

  fullModeBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    cancelFullModeHold();
    fullModeBtn.classList.add('holding');
    fullModeHoldTimer = setTimeout(() => {
      cancelFullModeHold();
      exitSimpleMode();
    }, FULL_MODE_HOLD_MS);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
    fullModeBtn.addEventListener(type, cancelFullModeHold);
  }
  // A long press on iOS would otherwise open the callout menu.
  fullModeBtn.addEventListener('contextmenu', e => e.preventDefault());
  // Keyboard and switch users press the button without a pointer (detail 0).
  fullModeBtn.addEventListener('click', e => {
    if (e.detail === 0) exitSimpleMode();
  });

  simpleGrowBtn.addEventListener('click', animateMazeGrowth);
  simpleShapeBtn.addEventListener('click', () => {
    if (simpleShapeSheet.hidden) openSimpleShapes();
    else closeSimpleShapes();
  });
  simpleShapeSheet.querySelector('[data-close-shapes]').addEventListener('click', closeSimpleShapes);
  simpleMazesBtn.addEventListener('click', () => {
    if (simpleMazesSheet.hidden) openSimpleMazes();
    else closeSimpleMazes();
  });
  simpleMazesSheet.querySelector('[data-close-mazes]').addEventListener('click', closeSimpleMazes);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !simpleShapeSheet.hidden) closeSimpleShapes();
    if (e.key === 'Escape' && !simpleMazesSheet.hidden) closeSimpleMazes();
  });
  simpleSolveBtn.addEventListener('click', () => {
    if (running) return;
    if (userSolveMode) resetUserAttempt();
    else enterUserSolveMode();
  });
  document.getElementById('blankBtn').addEventListener('click', makeBlankGrid);
  document.getElementById('printBtn').addEventListener('click', printMaze);

  // Safari's print dialog. An app added to the iPhone or iPad Home Screen has
  // none: window.print() does nothing there, so it hands the share sheet a
  // picture of the maze instead, and Print is one of the share sheet's rows.
  function printMaze() {
    if (navigator.standalone !== true) {
      window.print();
      return;
    }
    const file = new File([mazePicture()], 'maze.png', { type: 'image/png' });
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
      setStatus('Printing needs Safari here. Open the maze in Safari, then tap Print.');
      return;
    }
    navigator.share({ files: [file] }).catch(err => {
      if (err.name !== 'AbortError') setStatus('The maze could not be shared for printing. Try again.');
    });
  }

  // The maze as the printed page shows it: walls, S, E and the route (gold
  // unless a child picked another colour) on white, with no search colours,
  // and the maze code small underneath. Drawn synchronously so the share
  // sheet still opens from the tap.
  function mazePicture() {
    const cell = 64;
    const border = Math.round(cell * 0.18);
    const inset = cell + border;
    const side = size * cell;
    const canvas = document.createElement('canvas');
    canvas.width = side + 2 * inset;
    // The code's type is sized from the whole picture, so it prints at about
    // the same small size whatever the grid.
    const code = printCode.textContent;
    const codeFont = Math.round(canvas.width * 0.016);
    canvas.height = canvas.width + (code ? Math.round(codeFont * 1.5) : 0);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(inset, inset);

    const isAt = (spot, r, c) => spot && spot.r === r && spot.c === c;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const fill = isAt(start, r, c) ? '#e8f8ef'
          : isAt(end, r, c) ? '#ffecef'
          : grid[r][c].solution ? TRACE_HUES[TRACES.solution.hue].deep : null;
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fillRect(c * cell, r * cell, cell, cell);
        }
      }
    }

    // Faint grid lines between squares inside the shape, and the walls.
    const gridLines = new Path2D();
    const wallLines = new Path2D();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        for (const side of ['right', 'bottom']) {
          const edge = { side, r, c };
          if ((side === 'right' ? c === size - 1 : r === size - 1) || isFixedEdge(edge)) continue;
          const x = side === 'right' ? c + 1 : c;
          const y = side === 'right' ? r : r + 1;
          for (const lines of hasWall(edge) ? [gridLines, wallLines] : [gridLines]) {
            lines.moveTo(x * cell, y * cell);
            lines.lineTo((side === 'right' ? x : x + 1) * cell, (side === 'right' ? y + 1 : y) * cell);
          }
        }
      }
    }
    ctx.strokeStyle = '#ececf1';
    ctx.lineWidth = 1;
    ctx.stroke(gridLines);

    for (const [spot, ring, fallback, ink] of [[start, '#30d158', 'S', '#248a3d'], [end, '#ff453a', 'E', '#d70015']]) {
      if (!spot) continue;
      // The same letter the grid shows, so the picture follows any rename.
      const shown = getComputedStyle(mazeEl.children[spot.r * size + spot.c], '::after').content;
      const letter = /^"(.+)"$/.test(shown) ? shown.slice(1, -1) : fallback;
      const ringWidth = cell * 0.08;
      ctx.strokeStyle = ring;
      ctx.lineWidth = ringWidth;
      ctx.strokeRect(spot.c * cell + ringWidth / 2, spot.r * cell + ringWidth / 2, cell - ringWidth, cell - ringWidth);
      ctx.fillStyle = ink;
      ctx.font = `800 ${Math.round(cell * 0.42)}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, (spot.c + 0.5) * cell, (spot.r + 0.5) * cell);
    }

    ctx.strokeStyle = '#1c2b4f';
    ctx.lineCap = 'square';
    ctx.lineWidth = cell * 0.1;
    ctx.stroke(wallLines);

    ctx.lineWidth = border;
    if (isShaped()) {
      // The same outline the screen draws.
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(new Path2D(shapeOutlinePath(cell)));
    } else {
      ctx.lineCap = 'butt';
      ctx.strokeRect(-border / 2, -border / 2, side + border, side + border);
    }

    if (code) {
      ctx.fillStyle = '#6e6e73';
      ctx.font = `${codeFont}px ui-monospace, "SF Mono", Menlo, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(code, side / 2, side + border + (canvas.height - inset - side - border) / 2);
    }

    const bytes = atob(canvas.toDataURL('image/png').split(',')[1]);
    const png = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) png[i] = bytes.charCodeAt(i);
    return png;
  }

  // The release shown next to the offline state: the commit's date and time
  // on this device's clock, then the short commit id that matches GitHub.
  function showRelease() {
    if (!isStamped(BUILD)) return;
    const [commit, time] = BUILD.split('|');
    const when = new Date(time);
    const known = !Number.isNaN(when.getTime());
    const date = known ? when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
    const clock = known ? when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';

    const label = document.createElement('span');
    label.className = 'release-label';
    if (known) {
      const whenEl = document.createElement('span');
      const clockEl = document.createElement('span');
      clockEl.className = 'release-time';
      clockEl.textContent = ` ${clock}`;
      whenEl.append(date, clockEl);
      label.append(whenEl);
    }
    const commitEl = document.createElement('span');
    commitEl.className = 'release-commit';
    commitEl.textContent = commit;
    label.append(commitEl);
    offlineBadge.append(label);
    offlineBadge.title = `Version ${commit}${known ? `, released ${date} ${clock}` : ''}`;
  }

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
  showRelease();
  buildShapePicker();
  buildSimpleShapePicker();
  syncDailyUI();
  syncSavedUI();
  // Saved settings from before shapes had a smallest size.
  fitShapeToSize();
  syncShapeUI();
  syncLevelUI();
  makeBlankGrid();
  syncSimpleModeUI();
  if (!growFromLink() && simpleMode) animateMazeGrowth();
  window.addEventListener('load', registerServiceWorker);
  // Tells the check in index.html that this script started properly.
  window.mazeBuilderStarted = true;
})();