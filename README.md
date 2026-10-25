# Maze Builder — Apple Pencil Edition

This build adds a full user-solving experience designed for iPhone and iPad.

## Walls

Every square in the grid is open path. Walls are thin lines on the edges
between squares, like cell borders in a spreadsheet: you cannot cross them,
but they do not take up a square. The thicker outside border is always a
wall.

In **Walls** mode, tap a grid line to add or remove a wall, or drag along a
line to draw several at once. Grown mazes knock out one edge at a time until
every square is joined, which leaves room for long, winding corridors.

## Solve It Yourself

Tap **Solve It Yourself** and trace a route directly through the maze using:

- Apple Pencil
- finger / touch
- mouse when testing on a desktop

The route must start on **S** and move continuously through neighboring cells without crossing a wall.

The path is drawn as a smooth blue line over the maze. It updates live as you move.

### Backtracking

If you move directly back into the previous cell, the route retracts.

Backtracking counts toward the player's total effort, so the final result reflects how efficiently they actually solved the maze.

### Live stats

While solving, the telemetry switches to player stats:

- **Time**
- **Cells** covered
- **Best** possible cell count
- **Efficiency**
- **Backtracks**

The optimal value is computed using breadth-first search before the user begins.

### Completion

When the route reaches the finish:

- the traced path turns green
- success ripples travel through the route
- a native-feeling celebration sheet appears
- confetti falls across the result
- performance is summarized
- the message changes based on efficiency

A 100% result means the player matched the mathematically shortest route.

## Shapes

Under **Shape** in the Maze card, picture tiles pick the outline the maze
grows in: a plain square, or one of 19 pictures (heart, star, house, castle,
rocket, tree, robot, cat, dog, bunny, fish, turtle, elephant, dinosaur,
butterfly, capybara, Ireland, USA, car). Ireland and the USA are traced from
real map points and stretched to the square grid, with Florida drawn a little
fatter so it survives on small boards. The choice is remembered like the size and speed.

Each picture is drawn once as a few simple vector parts in `shapes.js` and
turned into a mask of squares for whichever size is picked, so the same cat
works on every grid from 15 × 15 up (the masks are checked up to 51 × 51, so
bigger boards need no new drawings). An 11 × 11 grid is too small for a
picture: picking a shape there grows the grid to 15 × 15, and going back to
11 × 11 (or Easy) makes the maze a square again. Small details such as eyes or a door only
appear once the grid is big enough to show them. Every mask is one connected
piece; the outline is the outside wall, and growing, searching, solving and
drawing walls all stay inside it. Start and Finish begin far apart inside the
shape and can still be moved.

## Maze codes

Every grown maze has a code, shown under **Maze code** in the Maze card and
printed small under the maze. Typing or pasting a code and tapping **Grow**
grows that exact maze again, on any device: the same size, Maze style, shape,
Start, Finish and walls. **Copy code** puts the current code on the clipboard
for a message; **Paste** grows the code in a pasted message or link straight
away (iOS asks first with its small Paste bubble).

**Share link** opens the share sheet (Messages, Mail, AirDrop) with a link
like `https://thecitizensnips.github.io/maze-builder/#maze=K7M2Q-X3PAB`.
Opening it grows the same maze, with no server involved: the code sits after
`#`, which never leaves the device. On iOS a tapped link opens in Safari, not
the Home Screen app, so to play a shared maze in the installed app, copy the
link (or the code in the message) and tap Paste there. A whole link or
message typed or pasted into the code box shrinks to just its code.

A code is ten letters and digits, or fifteen when S or F was moved:

```text
K7M2Q-X3PAB
K7M2Q-X3PAB-4FQ2Z
```

It packs the maze's seed (the number behind every chance the generator
takes) with the size, the three style dials, the shape and, when moved, the S
and F squares. The last character checks the others, so a typo says so
instead of growing some other maze. Case and dashes do not matter, and O, I
and L read as 0, 1 and 1. Drawing a wall or moving S or F after growing makes
a maze the code would not rebuild, so the code goes away until the next grow.
`tests/maze-code.spec.js` pins a few codes to their mazes, so a change that
would make old printed codes grow different mazes shows up as a failing test.

## Today's maze

**Today's Maze** (above Grow a Maze; in Kid Mode, the calendar tile at the top
of the shape sheet) grows one maze a day that is the same for everyone, with
no server. The day is the device's own date, so the maze changes at local
midnight. The date goes through SHA-256 with a fixed salt to pick the shape
and seed, so days next to each other give unrelated mazes and nobody can count
up from today's code to tomorrow's. It is a 21 × 21 Hard maze in a shape
picked for the day, and once grown it is an ordinary maze code to copy, share
or print. Solving it marks the button **Solved** (a gold star in Kid Mode)
until the day ends.

## Kid Mode (for little kids)

A picture-only way to play for children who cannot read yet. Tap the
smiley **Kid Mode** button at the top to turn it on. The words,
settings and numbers step aside, a maze grows on its own, and then S glows
to show where to start drawing. Three big picture buttons sit under the maze:
the sparkle grows a new maze, the round arrow wipes the line to draw again, and
the orange button (wearing the current shape) opens big picture tiles of the
shapes. Tapping one, a cat or a rocket say, grows a new maze in that shape
straight away (on an 11 × 11 grid it grows to 15 × 15 first).
Finishing shows a trophy, confetti and the same two buttons.

The maze uses the size, level and speed last chosen in full mode, so a
grown-up can pick Easy and Medium speed first (speed starts on Fast until
someone picks another).

To go back to full mode, **press and hold** the button in the top corner
until its ring fills (about a second and a half). A quick tap does nothing,
so a small child is unlikely to leave by accident. The choice is remembered
on the device, like the other settings.

## Learn how it works

Small ⓘ buttons open reading sheets written for children under 12:

- **How a maze grows**: the depth-first carve, backtracking, the Maze style dials and the checks that make every maze real (ⓘ by Maze)
- **How the search finds the way**: the breadth-first search wave and why the gold path is shortest (ⓘ by Animate)
- **Solve it yourself**: how to play and how the score works (also linked from the success sheet)

The ⓘ by the maze title opens whichever sheet matches what the maze is doing. The sheets live in `index.html`; keep their wording in step with `app.js` when the generator, search or scoring changes.

## Existing animation modes

This package still includes:

- animated electric maze growth
- animated breadth-first search wavefront
- shortest-path tracing
- pause / resume
- instant solve
- print mode
- offline PWA support

## Testing locally

The app itself has no build step. The tests are development-only and use
[Playwright](https://playwright.dev) to drive the real app in a browser with
mouse, touch and Apple Pencil-style input. You need Node.js 18 or newer.

One-time setup:

```bash
npm install
npx playwright install chromium   # add "webkit" too for Safari's engine
```

Run every test (desktop, iPad and iPhone screen sizes):

```bash
npm test
```

Other handy commands:

- `npm run test:webkit` also runs the suite in WebKit at iPad size.
- `npm run test:headed` shows the browser while the tests run.
- `npm run test:report` opens the report from the last run, with a trace
  for any failure.
- `npm run serve` serves the app at http://localhost:4173/maze-builder/ for
  trying it by hand.

GitHub also runs the whole suite on every pull request and every push to
`main` (`.github/workflows/test.yml`); the result shows as the **Tests**
check on the pull request, with the report attached when something fails.

The tests cover editing, maze growth (every grown maze is checked to be a
real, fully connected maze), the search wave and its gold shortest path,
Solve It Yourself (walls, backtracking, lifting and resuming, scoring,
palm and second-finger touches), layout on iPad and iPhone, printing, and
offline loading. They still don't replace a quick check on a real iPad
with Apple Pencil.

## GitHub Pages

The repository root is the site. Every push to `main` runs
`.github/workflows/pages.yml`, which copies the site (minus the test tooling),
stamps the release into `index.html` and `app.js`, and publishes it. Pages must
be set to:

**Settings → Pages → Source → GitHub Actions**

The stamp is the short commit id and commit time. Tap the small ⓘ at the top
right to see it with the offline state (for example "Offline ready · Oct 20,
4:07 AM · 8e4b569"), so you can tell which release a device is running. Local copies show no version. If a
device ever ends up with a page and script from different releases, the app
notices the mismatch and reloads once for matching copies.

## Install on iPhone / iPad

Open the live app in Safari at https://thecitizensnips.github.io/maze-builder/, then:

**Share → Add to Home Screen → Open as Web App**

After the first successful load the service worker caches the app for offline use.


## Automatic updates

This edition no longer requires manual service-worker cache version bumps for ordinary app updates.

When the device is online, the service worker uses a **network-first** strategy for the app HTML, JavaScript, CSS, manifest, and icon assets:

1. GitHub Pages is checked for the newest file.
2. The newest successful response is saved into the offline runtime cache.
3. If the device is offline, that last successful cached copy is used instead.

The app also explicitly checks the service worker for updates on launch and requests the worker script without relying on the browser's normal HTTP cache.

For normal future releases, the workflow is simply:

```text
Edit files → commit/push to GitHub → GitHub Pages deploys → open the app online
```

You do **not** need to change a `CACHE_VERSION` value anymore.

### First upgrade from an older package

Older builds used cache-first versioned storage. This release removes the known old Maze Builder cache names during activation. After publishing this version, open the installed app while online and then close/reopen it once. After that one-time migration, future updates follow the automatic flow above.
