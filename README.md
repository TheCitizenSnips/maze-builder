# Maze Builder — Apple Pencil Edition

This build adds a full user-solving experience designed for iPhone and iPad.

## Solve It Yourself

Tap **Solve It Yourself** and trace a route directly through the maze using:

- Apple Pencil
- finger / touch
- mouse when testing on a desktop

The route must start on **S** and move continuously through open neighboring cells.

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

## Existing animation modes

This package still includes:

- animated electric maze growth
- animated breadth-first search wavefront
- shortest-path tracing
- pause / resume
- instant solve
- print mode
- offline PWA support

## GitHub Pages

Upload the package contents to the repository root and enable:

**Settings → Pages → Deploy from a branch → main → / (root)**

## Install on iPhone / iPad

Open the GitHub Pages URL in Safari, then:

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
