# CLAUDE.md — Maze Builder

This file is the product, design, interaction, animation, architecture, and engineering guide for the Maze Builder project.

Claude Code should treat this document as the default source of truth when modifying the application. Preserve the principles and invariants below unless the user explicitly asks to change them.

---

## 1. Product vision

Maze Builder is an iOS-first educational maze playground for children.

It is not just a utility that generates and solves mazes. The experience should make algorithms visually understandable and genuinely fun to watch.

There are three equally important ways to experience a maze:

1. **Watch a maze grow**
   - The maze should visibly build itself on the page.
   - Generation is an animation and teaching experience, not an instantaneous operation.

2. **Watch the computer discover a path**
   - The search should spread through the maze as an understandable wave.
   - Users should see what is being explored, what is currently active, what has been discarded, and what final route remains.

3. **Solve the maze yourself**
   - A child should be able to use Apple Pencil or a finger to physically trace a route through the maze.
   - The app should celebrate successful completion and give meaningful statistics about the attempt.

The core emotional target is:

> “I can see the maze thinking and growing.”

The application should feel playful and expressive inside the maze, while the surrounding interface remains calm, polished, and unmistakably iOS-oriented.

---

## 2. Primary platform

For now, design for:

- iPhone
- iPad
- Safari on iOS/iPadOS
- Installed iOS Home Screen PWA
- Apple Pencil on supported iPads

Desktop browser support is useful for development and debugging, but it is secondary.

Do not optimize the product around desktop conventions at the expense of iOS.

---

## 3. Technology and architecture

The project intentionally uses a very small static web stack:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `service-worker.js`
- `.nojekyll`
- `icons/`

There is currently:

- no React
- no Vue
- no framework
- no npm build requirement
- no bundler
- no backend
- no database
- no external API requirement
- no CDN requirement

The app is hosted by GitHub Pages.

### Default engineering rule

Prefer keeping the application as plain HTML, CSS, and JavaScript.

Do not introduce a framework, package manager, build pipeline, or dependency merely for convenience.

A dependency or framework should only be introduced if it materially improves maintainability or unlocks a requirement that is difficult to implement cleanly with the current stack.

If adding a dependency is proposed, explain the tradeoff first.

---

## 4. Offline and PWA behavior

The application is a Progressive Web App and must remain usable offline after at least one successful online load.

### Current caching model

The service worker uses a **network-first** strategy for same-origin application assets.

When online:

1. request the latest asset from GitHub Pages
2. bypass stale browser HTTP caching where appropriate
3. use the latest response
4. save that response into the runtime cache

When offline:

1. the network request fails
2. use the most recently cached successful version

This means normal future releases should not require manually changing cache version strings.

### Important invariant

Do not revert the application to a cache-first model for application code.

The desired behavior is:

> Online = latest deployed version  
> Offline = last known good version

### Service worker update behavior

Service-worker registration should continue using:

```js
updateViaCache: 'none'
```

The worker should remain capable of replacing older Maze Builder service-worker/cache implementations.

Do not indiscriminately delete all Cache Storage entries because Cache Storage is origin-wide. Only remove caches that are known to belong to Maze Builder.

### Relative paths

All application paths should remain relative, such as:

```text
./app.js
./styles.css
./icons/icon-180.png
```

This is required so the application works from a GitHub Pages project URL such as:

```text
https://thecitizensnips.github.io/maze-builder/
```

Do not assume deployment at the origin root.

---

## 5. GitHub Pages assumptions

The repository root is also the GitHub Pages publishing root.

Expected structure:

```text
/
├── .nojekyll
├── README.md
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── service-worker.js
└── icons/
    ├── icon-32.png
    ├── icon-180.png
    ├── icon-192.png
    ├── icon-512.png
    ├── icon-app-128.png
    └── icon-maskable-512.png
```

GitHub Pages is configured to deploy:

```text
main → / (root)
```

The live published app is:

```text
https://thecitizensnips.github.io/maze-builder/
```

Use this URL to check a change after it is pushed to `main`.

Do not add a build process unless there is a strong product reason.

---

# DESIGN SYSTEM

## 6. Overall visual direction

The golden standard is modern Apple/iOS application design.

The goal is not to clone a specific Apple screen pixel-for-pixel. Instead use the design principles and visual language that make first-party iOS applications feel coherent:

- strong hierarchy
- restrained use of color
- generous whitespace
- high-quality typography
- subtle depth
- grouped surfaces
- large touch targets
- soft separators
- clear state changes
- intentional animation
- minimal permanent visual noise

The application shell should feel calm.

The maze itself is where visual energy and spectacle belong.

Avoid making every part of the UI animated, glowing, gradient-heavy, or decorative.

---

## 7. Typography

Use the native Apple system font stack.

Preferred CSS:

```css
font-family:
  -apple-system,
  BlinkMacSystemFont,
  "SF Pro Text",
  "SF Pro Display",
  "Helvetica Neue",
  sans-serif;
```

Do not ship font files.

Use weight and spacing to create hierarchy rather than excessive color or decoration.

Typical hierarchy:

- app title: large, confident, slightly tight letter spacing
- section title: strong but secondary to app identity
- control labels: normal iOS body sizing
- secondary information: system secondary-label color
- metrics: tabular numerals when useful

For live numerical values prefer:

```css
font-variant-numeric: tabular-nums;
```

to prevent layout jitter while numbers change.

---

## 8. Core colors

Use iOS-like system colors and neutral surfaces.

Current conceptual palette:

```text
System background      #F2F2F7
Primary iOS blue       #007AFF
Cyan/search frontier   #32ADE6
Indigo                 #5856D6
Success green          #30D158
Error/finish red       #FF453A
Gold solution          #FFD60A
Maze wall navy         #1C2B4F
White path             #FFFFFF
```

These do not need to be treated as immutable constants, but changes should remain visually compatible with iOS.

### Color semantics

Keep colors semantically stable:

- dark navy = walls
- green = start / success
- red = finish
- cyan = active search frontier / electric activity
- blue = explored/search history or user path
- gold = mathematically selected shortest path

Do not randomly change these meanings from screen to screen.

---

## 9. Surfaces and layout

Use iOS-style grouped cards and subtle translucent materials.

Good:

- system-gray page background
- white or slightly translucent grouped panels
- 0.5px-style separators
- modest blur
- restrained shadows
- rounded corners approximately in the iOS visual family
- grouped actions

Avoid:

- giant drop shadows
- excessive glassmorphism
- constant gradients everywhere
- neon surrounding UI
- desktop-dashboard aesthetics
- tiny icon buttons
- dense toolbars

The UI should remain comfortable on both iPhone and iPad.

Use safe-area environment variables:

```css
env(safe-area-inset-top)
env(safe-area-inset-right)
env(safe-area-inset-bottom)
env(safe-area-inset-left)
```

---

## 10. App icon and brand

The current Maze Builder icon is the canonical product icon.

It depicts:

- blue/purple rounded application tile
- white inset maze
- valid maze geometry
- green accessible start
- red accessible finish
- yellow solution route that stays completely inside valid corridors

### Non-negotiable icon rule

The maze depicted by the icon must remain logically valid.

Never create an icon where:

- the yellow solution crosses a wall
- the green start is enclosed
- the finish is unreachable
- the geometry visually contradicts maze rules

The same icon should be used consistently for:

- iOS Home Screen
- PWA icons
- browser/favicon assets
- application branding where appropriate

---

# INTERACTION DESIGN

## 11. Touch-first behavior

Every primary control should be comfortable to use with a finger.

Avoid tiny click targets.

Controls should behave naturally on touch:

- visible pressed state
- no accidental text selection
- no hover-only functionality
- important functions accessible without mouse hover

Use Pointer Events rather than separate mouse/touch code whenever practical.

---

## 12. Apple Pencil support

Apple Pencil is a first-class input method.

Pointer-event code should recognize:

```js
event.pointerType === 'pen'
```

but must not make Pencil mandatory.

Finger input must remain fully functional.

Desktop mouse input may be supported for development.

Where available, use coalesced pointer events:

```js
event.getCoalescedEvents()
```

for smoother Pencil tracking.

Do not require Pencil-specific proprietary APIs when standard Pointer Events are sufficient.

---

# MAZE GENERATION

## 13. Maze generation algorithm

The current generated-maze algorithm is randomized depth-first search with backtracking.

Conceptually:

1. begin with a grid full of walls
2. begin from an odd-coordinate passage cell
3. choose an unvisited cell two positions away
4. remove the intermediate wall
5. advance
6. when no unvisited neighbor exists, backtrack
7. continue until all passage targets have been visited

Generated mazes should remain valid and connected.

Do not replace this with random wall placement.

The important property is that generated mazes are real mazes, not arbitrary grids that may be nonsensical.

---

## 14. Maze generation animation

Animation is at the heart of the generation experience.

The maze must look like it is **growing directly on the page**.

The visual metaphor is an electric arc or energetic branching path.

The animation should expose the algorithm rather than hiding it.

### Current visual states

The generator uses concepts such as:

- `carve-head`
- `carve-spark`
- `carve-trail`

These represent:

**Carve head**
- active position of the generator
- brightest point
- visually alive
- cyan/indigo electrical energy

**Carve spark**
- passage that has just been opened
- brief bright expansion/flash

**Carve trail**
- recently carved territory
- softer fading energy that settles into a normal corridor

### Backtracking

Backtracking should be visible.

When the algorithm reaches a dead end, the visual tip retreats to an earlier branch rather than teleporting invisibly.

This helps children understand that the generator is exploring possibilities.

### Desired feeling

Think:

> electrical energy propagating through a dark structure and leaving a maze behind

but keep it polished rather than chaotic.

---

## 15. Generation telemetry

During generation, the app should expose useful live information.

Current concepts include:

- progress %
- carved/explored target cells
- active stack/frontier depth

Telemetry should help explain what is happening, not merely decorate the UI.

Avoid overwhelming children with computer-science terminology unless the information is explained naturally.

---

# COMPUTER PATH DISCOVERY

## 16. Search algorithm

The primary computer solver is Breadth-First Search (BFS).

This is intentional because BFS:

- is easy to explain visually
- spreads naturally as a wave
- guarantees a shortest path on an unweighted grid

Do not silently replace BFS with DFS for the main teaching animation.

A future feature may compare algorithms, but BFS remains the baseline shortest-path demonstration.

---

## 17. BFS visualization

The solver should feel like a wave spreading through the maze.

The search must communicate several distinct states.

### Frontier

Color: bright cyan.

Meaning:

> These are the next places the search can investigate.

It should feel alive and visually active.

### Current processing

A stronger/brighter blue state can indicate cells actively being processed.

### Explored territory

Color: softer blue.

Meaning:

> The computer already looked here.

Explored territory should remain visible after the wave passes.

This is critical.

Do not clear explored cells immediately after solving.

Children should be able to compare:

- everything the computer considered
- the small route ultimately selected

### Finish detection

When the BFS wave reaches the finish:

- visibly acknowledge the event
- use a short success/burst animation
- pause enough for the moment to register

Then transition into route tracing.

---

## 18. Shortest-path tracing

Once BFS finds the finish, trace the final path as a distinct second phase.

Color: gold.

The path should visibly travel from start to finish.

Use a bright moving “head” to show the trace advancing.

The blue explored search world remains behind it.

This visual contrast is important:

> Blue = what we investigated  
> Gold = what we kept

Do not replace the whole search visualization with only the answer.

---

## 19. Solver telemetry

During BFS, useful values include:

- explored cells
- current frontier size
- current BFS distance
- shortest route length once known
- overall search progress when a sensible definition is available

Status copy should explain what is happening in kid-accessible terms.

Good:

> Distance 7: 6 squares on the wavefront. 42 left behind as explored.

Avoid overly abstract text such as:

> BFS queue iteration 42.

---

# HUMAN SOLVING MODE

## 20. “Solve It Yourself” is a first-class mode

The application must allow users to solve the maze directly.

This is not a secondary debugging tool.

It should feel like drawing through a physical maze with Apple Pencil.

The interaction starts at `S` and ends at `E`.

---

## 21. User path rules

A valid human path:

- starts on the Start cell
- only moves through non-wall cells
- moves to orthogonally adjacent cells
- cannot jump across cells
- cannot cross walls
- cannot arbitrarily teleport to another location

Diagonal movement is not a valid maze move.

---

## 22. Human path rendering

Render the user's path as an SVG overlay over the grid rather than only recoloring individual cells.

Use:

- smooth rounded line
- iOS blue while solving
- subtle blue glow
- visible path head
- green transition on successful completion

The line should feel like physical ink or a live digital Pencil stroke while still snapping logically to cell centers.

The overlay should resize/recalculate if layout changes.

---

## 23. Starting a user attempt

The user must begin on `S`.

If they touch somewhere else first, provide friendly guidance.

Example:

> Start your line on S, then keep the Pencil or finger down as you trace.

Do not silently begin from an arbitrary location.

---

## 24. Lifting Pencil/finger

If the user lifts before reaching the finish:

- keep the route visible
- pause the attempt
- preserve state
- allow them to resume from the current end of their path

The user should not lose the entire attempt simply because the Pencil was briefly lifted.

Resume must begin from the current route endpoint.

---

## 25. Backtracking

Directly returning to the immediately previous cell retracts the visible route.

Backtracking is valid and should feel natural.

However, it still counts as effort.

This is intentional.

A user should not be able to explore many wrong branches, erase them visually, and receive a perfect efficiency score.

---

## 26. Revisiting cells

Do not allow arbitrary loops through already-used cells unless the interaction model is deliberately redesigned.

The current intended model is a simple trace with direct backtracking.

If adding loop behavior in the future, explicitly revisit scoring and visualization semantics.

---

# PLAYER METRICS

## 27. Timing

Track how long the human takes.

Use high-resolution browser timing such as:

```js
performance.now()
```

Display tenths of a second while active.

Example:

```text
14.7s
```

If the player lifts Pencil/finger and the attempt is paused, the time should not continue advancing while paused.

---

## 28. Optimal-path comparison

Before a human attempt starts, calculate the mathematically shortest route using BFS.

This is used as the baseline for comparison.

Current “Best” represents the optimal path length in cells.

Keep the definition consistent.

If changing the metric from cells to moves/edges, update both UI labels and scoring at the same time.

---

## 29. Human “Cells” / effort metric

The current player metric is intentionally an **effort count**, not merely distinct unique cells.

It includes:

- the start
- forward route movement
- movement subsequently undone by backtracking

This preserves the idea that mistakes still count as work.

If a future UI wants to show “unique cells visited,” add it as a separate metric rather than silently changing the existing scoring semantics.

---

## 30. Efficiency

Current conceptual formula:

```text
efficiency = optimal path effort / actual user effort × 100
```

Clamp to 100%.

A perfect optimal route should produce:

```text
100%
```

The user should understand the metric intuitively.

If the scoring implementation changes, make sure a route with extra exploration cannot score better than the true shortest path.

---

## 31. Backtrack count

Track explicit direct backtracking.

This is useful as both:

- feedback
- a teaching metric

Do not shame the user for backtracking.

The tone should be playful and encouraging.

---

# SUCCESS EXPERIENCE

## 32. Completing the maze should feel special

Reaching `E` should not result in a plain alert or text message.

The completion sequence should feel rewarding.

Current intended sequence:

1. path reaches finish
2. user path transitions from blue to success green
3. energy/success ripple moves through the route
4. finish responds visually
5. an iOS-style success sheet appears
6. restrained confetti animation plays
7. performance statistics are shown

Keep the celebration polished.

Avoid casino-like effects, flashing screens, or excessive motion.

---

## 33. Success statistics

The completion sheet should include:

- time
- user effort/cells
- best possible
- efficiency

Backtracks can remain visible in the underlying telemetry and may be included in future result designs if helpful.

---

## 34. Adaptive celebration copy

Feedback should respond to the result.

Current conceptual tiers:

**100%**
- Perfect Route
- explicitly recognize matching the optimal path

**90%+**
- excellent / almost perfectly efficient

**75%+**
- strong solve with a little extra movement

**below that**
- celebrate completion and invite another attempt

The app is for children.

Do not use failure-oriented, mocking, competitive, or discouraging language.

---

# ANIMATION PRINCIPLES

## 35. Animation is functional

Animation should communicate state and algorithm behavior.

Before adding an animation, ask:

> What does this teach or communicate?

Good uses:

- active generator tip
- freshly carved passage
- search wavefront
- explored history
- active path trace
- successful finish
- path completion

Bad uses:

- endlessly bouncing navigation
- random glowing buttons
- decorative backgrounds competing with the maze
- animation everywhere merely because it is possible

---

## 36. Motion hierarchy

Highest visual energy:

1. maze generation
2. BFS discovery
3. manual Pencil path
4. success celebration

Lowest visual energy:

- panels
- labels
- navigation
- ordinary controls

The chrome should stay calm so motion inside the maze feels meaningful.

---

## 37. Motion timing

Animation speed should remain adjustable.

Current modes conceptually include:

- Slow
- Medium
- Fast

Changing speed should affect algorithm animations without breaking correctness.

Do not tie algorithm logic correctness to frame rate.

Prefer async state transitions with deliberate delays over relying on CSS animation completion events for algorithm progression.

---

## 38. Reduced motion

Respect:

```css
@media (prefers-reduced-motion: reduce)
```

Core functionality must still work.

Reduced motion should suppress decorative or prolonged effects without hiding required state.

---

# MAZE EDITING

## 39. Editing modes

The app supports:

- draw/remove walls
- set Start
- set Finish

Editing should be disabled while an algorithm animation is running or while the user is actively in self-solve mode when editing would invalidate the current attempt.

Mode changes should be obvious through the segmented-control state.

---

## 40. Start and finish

Start and finish cells must always remain traversable.

If a start or finish is moved onto a wall, remove that wall.

Never allow `S` or `E` to remain hidden inside an impassable wall state.

---

# PRINTING

## 41. Print mode is a real feature

The maze should print cleanly for use as a physical worksheet.

Printing should:

- hide application navigation and controls
- hide temporary algorithm visualization unless intentionally useful
- preserve walls clearly
- preserve start and finish
- preserve final shortest path when appropriate
- fit sensibly on a page

Avoid printing translucent UI panels or app chrome.

Human Pencil overlay is currently not intended to print by default unless explicitly requested.

---

# ACCESSIBILITY AND USABILITY

## 42. Do not encode meaning only in motion

Color and animation are helpful but should not be the sole explanation of state.

Use:

- status text
- labels
- telemetry
- distinct visual styles

so the application remains understandable even if motion is reduced.

---

## 43. Touch targets

Use comfortable iOS-sized touch areas.

As a rule of thumb, controls should generally approach the iOS 44pt minimum interaction size.

Avoid tiny buttons even if they look cleaner.

---

## 44. Contrast

Maintain strong contrast for:

- walls
- labels
- primary controls
- current algorithm state
- paths

Do not let translucent materials reduce legibility.

---

## 45. Kid-friendly copy

UI wording should be:

- concise
- encouraging
- understandable
- concrete

Prefer:

> The search wave found the finish.

over:

> BFS terminated successfully.

Technical concepts can be introduced when they are visually understandable, but do not require children to know computer-science terminology to use the app.

---

# CODE QUALITY

## 46. Preserve separation of concerns

Even though this is a small vanilla application, keep responsibilities understandable.

Prefer clear functions for:

- maze state
- rendering
- generation
- search
- animation
- manual solve mode
- scoring
- PWA registration

Avoid one giant event handler that mutates everything.

---

## 47. State management

The maze grid is the logical source of truth.

DOM classes are the visual representation of that state.

Be cautious about introducing DOM-only state that cannot be reconstructed from application state.

Short-lived animation classes are acceptable.

Core maze correctness should never depend solely on CSS classes.

---

## 48. Algorithm correctness before animation

Animation must visualize a correct algorithm.

Never alter the underlying maze/search result merely because a visual effect is easier to implement.

When changing maze generation or solving code:

1. validate maze connectivity
2. validate wall rules
3. validate shortest-path result
4. then animate it

---

## 49. Avoid race conditions

Generation, computer solving, and user solving are mutually sensitive operations.

Continue using cancellation/run identifiers or equivalent mechanisms so that:

- starting a new animation cancels the previous one cleanly
- stale async callbacks cannot mutate a newer maze
- changing maze size does not allow old animation work to continue
- pause/resume does not fork multiple timers

---

## 50. Input handling quality

Pointer handling must remain robust.

Important considerations:

- pointer capture where appropriate
- `pointercancel`
- coalesced events for Apple Pencil
- bounds checking
- grid coordinate calculation
- touch scrolling must not accidentally interfere while drawing
- lifting Pencil should be handled gracefully

Do not implement Apple Pencil behavior using only `touchmove`.

---

## 51. Performance

The maze sizes are deliberately modest.

Current options:

- 11 × 11
- 15 × 15
- 21 × 21
- 25 × 25

Animations should remain smooth at the largest supported size on contemporary iOS devices.

Avoid:

- repeatedly rebuilding the entire DOM for each animation frame when a single cell can be updated
- excessive layout reads in inner loops
- huge shadow/filter effects on hundreds of simultaneous cells
- animation timers substantially faster than the browser can render

Update individual cells when practical.

---

# TESTING EXPECTATIONS

## 52. Test every change against these core scenarios

### Blank maze

- app loads
- `S` and `E` are visible
- walls can be drawn and erased
- start and finish can be moved

### Generated maze

- maze visibly grows
- no invalid disconnected generation
- start and finish remain accessible
- generation can pause/resume
- speed selection works

### Computer solving

- frontier spreads from start
- walls are never crossed
- explored history remains visible
- finish is detected correctly
- gold path is truly shortest
- pause/resume works

### Human solving

- must begin at Start
- cannot draw through walls
- cannot jump cells
- Pencil works
- finger works
- direct backtracking retracts the route
- lifting pauses the attempt
- route can resume from its endpoint
- reaching End triggers completion
- stats are sensible
- optimal route can achieve 100%

### No-path maze

- computer solver reports no route
- human-solve mode does not pretend a solution exists
- UI remains recoverable

### PWA

- normal online load gets current deployed version
- next load after deployment receives changed code
- offline launch still works
- icon displays correctly
- installed Home Screen experience remains standalone

### Printing

- maze prints cleanly
- controls are absent
- maze is legible

---

## 53. Validate JavaScript before release

For any material JavaScript edit, run a syntax check if Node is available:

```bash
node --check app.js
```

Then run the Playwright suite (`npm test`, see README). It covers the core
scenarios in section 52 and fails on any console error. Add or update a test
alongside any behaviour change.

Do not ship known console errors.

---

## 54. Test iOS-specific behavior

Whenever interaction code changes, prioritize real-device testing on Safari/iPadOS if available.

Desktop emulation is not sufficient for:

- Apple Pencil
- standalone PWA behavior
- safe areas
- iOS print behavior
- service-worker lifecycle behavior
- pointer-event nuances

---

# CHANGE MANAGEMENT

## 55. Do not casually regress existing modes

New features must coexist with:

- maze growth animation
- BFS discovery animation
- instant solve
- self-solve/Pencil mode
- wall editing
- start/end editing
- printing
- offline operation
- automatic online updates

When touching shared state, explicitly consider all of these modes.

---

## 56. Preserve the current auto-update model

When changing deployment/PWA code, preserve:

- GitHub Pages compatibility
- relative paths
- network-first application asset loading
- offline fallback
- service-worker registration with update checks
- no manual release cache bump requirement for ordinary updates

Do not tell maintainers to increment a cache version for every normal release unless the caching architecture is deliberately changed.

---

## 57. App versioning philosophy

Normal UI/code changes should deploy by committing to `main`.

Expected flow:

```text
edit
→ commit
→ push
→ GitHub Pages deploys
→ next online app load retrieves latest assets
→ latest successful version becomes offline fallback
```

An already-open application does not need to hot-replace its running JavaScript.

The natural update boundary is the next page/app load.

---

# FUTURE FEATURE GUIDANCE

## 58. Good future additions

Features that fit the product especially well include:

- animated comparison of BFS vs DFS vs A*
- difficulty levels
- larger iPad-specific boards
- daily maze
- saved personal bests stored locally
- ghost replay of previous user route
- optimal-path replay after human completion
- optional hints
- “show me where I went wrong”
- generation seeds so a maze can be replayed/shared
- step-by-step algorithm teaching mode
- sound/haptics where web-platform support makes sense
- age-appropriate challenge modes

Any such feature should preserve the central visual/educational philosophy.

---

## 59. Features to approach cautiously

Be careful with:

- accounts
- cloud databases
- social features
- ads
- heavy analytics
- large external libraries
- complicated authentication
- network-dependent gameplay

The current product is intentionally lightweight, private, local-friendly, and useful for children.

Do not add infrastructure without a clear user benefit.

---

# PRODUCT DECISION PRINCIPLES

## 60. When choosing between two implementations

Prefer the option that is:

1. easier for a child to understand
2. more natural on iOS
3. visually explanatory
4. responsive to Apple Pencil and touch
5. reliable offline
6. simple to deploy on GitHub Pages
7. maintainable in plain web technology
8. correct before clever

---

## 61. Visual decision rule

If choosing between:

- more decoration
- clearer algorithm visualization

choose clearer algorithm visualization.

If choosing between:

- more permanent UI
- more room for the maze

choose more room for the maze.

If choosing between:

- a flashy panel animation
- an expressive maze animation

choose the maze animation.

---

## 62. Interaction decision rule

The user should never need to understand implementation details to use the app.

Actions should be obvious:

- Grow a Maze
- Discover the Path
- Solve It Yourself
- Pause
- Clear
- Print

Do not expose internal terminology unless it adds educational value.

---

# NON-NEGOTIABLE REGRESSION CHECKLIST

Before considering a feature complete, verify:

- [ ] iOS-first layout still feels native and uncluttered
- [ ] app icon remains the valid canonical maze icon
- [ ] Start and Finish are always traversable
- [ ] generated mazes are logically valid
- [ ] generation visibly grows rather than appearing instantly
- [ ] generation backtracking is visible
- [ ] BFS frontier is visually distinct
- [ ] explored BFS territory remains visible
- [ ] final shortest path is traced separately in gold
- [ ] computer path never crosses walls
- [ ] human path never crosses walls
- [ ] Apple Pencil and finger input work
- [ ] human route can pause/resume after Pencil lift
- [ ] backtracking retracts visually but still counts as effort
- [ ] player timing is correct
- [ ] optimal comparison is mathematically correct
- [ ] 100% efficiency is achievable by following the shortest route
- [ ] success animation is celebratory but tasteful
- [ ] reduced-motion users retain full functionality
- [ ] print mode remains clean
- [ ] all asset paths remain GitHub Pages-safe and relative
- [ ] online load checks for latest deployed app assets
- [ ] offline load uses the last successful cached version
- [ ] no ordinary release requires a manual cache-version bump
- [ ] JavaScript has no syntax errors
- [ ] no new framework/dependency was added without a strong reason

---

# FINAL NORTH STAR

Maze Builder should feel like a small, exceptionally polished iOS application that happens to be made with web technology.

The surrounding interface should feel calm, obvious, and Apple-like.

The maze should feel alive.

Generation should look like energy growing a world.

Search should look like knowledge spreading through that world.

The final path should feel discovered, not merely displayed.

And when a child takes an Apple Pencil and solves it themselves, the application should make that achievement feel rewarding, measurable, and fun.
