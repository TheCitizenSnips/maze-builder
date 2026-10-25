// Maze shapes. Each shape is drawn once as a small vector picture in a
// 100 × 100 box, then turned into a mask of on and off squares for whatever
// grid size the child picks, so one drawing serves 11 × 11 up to 25 × 25.
// The app grows, searches and solves only through the on squares; the edge
// of the shape is the maze's outside wall.
//
// A picture is a list of parts, painted in order: `add` parts are filled in,
// `cut` parts are rubbed out again (an eye, a door). A part with `min` only
// appears on grids at least that big, so small mazes keep the chunky outline
// and bigger ones gain details; `max` keeps a part to the smaller grids.
//
// Loaded before app.js in the page, and by the tests in Node.
(function (root) {
  'use strict';

  const rect = (x, y, w, h, r = 0) => ({ kind: 'rect', x, y, w, h, r: Math.min(r, w / 2, h / 2) });
  const ellipse = (cx, cy, rx, ry = rx, rotate = 0) => ({ kind: 'ellipse', cx, cy, rx, ry, rotate });
  const poly = (...pts) => {
    const points = [];
    for (let i = 0; i < pts.length; i += 2) points.push([pts[i], pts[i + 1]]);
    return { kind: 'poly', points };
  };
  const add = (shape, opts = {}) => ({ ...shape, cut: false, ...opts });
  const cut = (shape, opts = {}) => ({ ...shape, cut: true, ...opts });

  // A star with chunky points, so each point is still a few squares wide on
  // the smallest grid.
  function starPoints(cx, cy, outer, inner, points = 5) {
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 ? inner : outer;
      const angle = -Math.PI / 2 + i * Math.PI / points;
      pts.push(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    }
    return poly(...pts);
  }

  // Mirror parts left to right across x = 50, for faces and symmetric things.
  const mirror = part => {
    if (part.kind === 'rect') return { ...part, x: 100 - part.x - part.w };
    if (part.kind === 'ellipse') return { ...part, cx: 100 - part.cx, rotate: -part.rotate };
    return { ...part, points: part.points.map(([x, y]) => [100 - x, y]).reverse() };
  };
  const pair = part => [part, mirror(part)];

  // A country's outline from [longitude, latitude] points around its coast
  // and borders, stretched to fill the 100 × 100 box (the mask stretches
  // every picture to a square anyway). Islands and thin inlets are left out
  // so the maze stays one piece.
  function outline(...lonLat) {
    const lon = lonLat.filter((_, i) => i % 2 === 0);
    const lat = lonLat.filter((_, i) => i % 2 === 1);
    const x0 = Math.min(...lon), x1 = Math.max(...lon);
    const y0 = Math.min(...lat), y1 = Math.max(...lat);
    const pts = [];
    for (let i = 0; i < lon.length; i++) {
      pts.push((lon[i] - x0) / (x1 - x0) * 100, (y1 - lat[i]) / (y1 - y0) * 100);
    }
    return poly(...pts);
  }

  // A coiled band, like the groove on a snail's shell: a strip `width` wide
  // along a spiral that winds out from radius r0 to r1 over `turns` turns.
  function spiral(cx, cy, r0, r1, turns, width, start = 0) {
    const steps = Math.round(turns * 24);
    const outer = [];
    const inner = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = start + t * turns * 2 * Math.PI;
      const radius = r0 + (r1 - r0) * t;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      outer.push([cx + (radius + width / 2) * dx, cy + (radius + width / 2) * dy]);
      inner.push([cx + (radius - width / 2) * dx, cy + (radius - width / 2) * dy]);
    }
    return { kind: 'poly', points: outer.concat(inner.reverse()) };
  }

  const SHAPES = [
    {
      id: 'square',
      label: 'Square',
      parts: [add(rect(0, 0, 100, 100))]
    },
    {
      id: 'heart',
      label: 'Heart',
      parts: [
        add(ellipse(27, 29, 27)),
        add(ellipse(73, 29, 27)),
        add(poly(3.5, 40, 50, 100, 96.5, 40, 50, 22))
      ]
    },
    {
      id: 'star',
      label: 'Star',
      parts: [add(starPoints(50, 55, 55, 29))]
    },
    {
      id: 'house',
      label: 'House',
      parts: [
        add(poly(0, 46, 50, 0, 100, 46)),
        add(rect(10, 40, 80, 60)),
        add(rect(68, 6, 14, 30), { min: 15 }),
        cut(rect(40, 68, 20, 32)),
        cut(rect(19, 56, 14, 14), { min: 21 }),
        cut(rect(67, 56, 14, 14), { min: 21 })
      ]
    },
    {
      id: 'castle',
      label: 'Castle',
      parts: [
        add(rect(0, 0, 28, 100)),
        add(rect(72, 0, 28, 100)),
        add(rect(20, 30, 60, 70)),
        // Battlements along the tops of the towers and the wall.
        cut(rect(10, 0, 8, 10)),
        cut(rect(82, 0, 8, 10)),
        cut(rect(36, 30, 9, 10)),
        cut(rect(55, 30, 9, 10)),
        // The gate.
        cut(rect(39, 68, 22, 44, 11))
      ]
    },
    {
      id: 'rocket',
      label: 'Rocket',
      parts: [
        add(poly(50, 0, 72, 24, 72, 80, 28, 80, 28, 24)),
        add(ellipse(50, 30, 22, 30)),
        add(poly(31, 46, 4, 74, 4, 94, 31, 80)),
        add(poly(69, 46, 96, 74, 96, 94, 69, 80)),
        add(poly(36, 80, 64, 80, 58, 100, 42, 100)),
        cut(ellipse(50, 40, 9), { min: 15 })
      ]
    },
    {
      id: 'tree',
      label: 'Tree',
      parts: [
        add(poly(50, 0, 80, 30, 20, 30)),
        add(poly(50, 12, 90, 56, 10, 56)),
        add(poly(50, 30, 100, 82, 0, 82)),
        add(rect(38, 78, 24, 22))
      ]
    },
    {
      id: 'robot',
      label: 'Robot',
      parts: [
        add(rect(45, 0, 10, 10)),
        add(rect(24, 6, 52, 34, 6)),
        add(rect(14, 44, 72, 34, 4)),
        add(rect(40, 38, 20, 8)),
        add(rect(0, 46, 16, 30, 4)),
        add(rect(84, 46, 16, 30, 4)),
        add(rect(22, 76, 20, 24)),
        add(rect(58, 76, 20, 24)),
        cut(rect(30, 14, 15, 15)),
        cut(rect(55, 14, 15, 15)),
        cut(rect(32, 54, 36, 10), { min: 21 })
      ]
    },
    {
      id: 'cat',
      label: 'Cat',
      parts: [
        add(ellipse(50, 60, 48, 40)),
        ...pair(add(poly(4, 52, 10, 0, 46, 26))),
        ...pair(cut(rect(23, 46, 15, 17, 5))),
        cut(poly(43, 70, 57, 70, 50, 78), { min: 21 })
      ]
    },
    {
      id: 'dog',
      label: 'Dog',
      parts: [
        add(rect(10, 42, 64, 30, 14)),
        add(ellipse(76, 30, 18, 18)),
        add(rect(80, 30, 20, 17, 7)),
        add(ellipse(65, 38, 8, 16, 20)),
        add(rect(12, 60, 15, 40, 5)),
        add(rect(55, 60, 15, 40, 5)),
        add(poly(16, 50, 0, 16, 9, 12, 27, 46)),
        cut(ellipse(80, 24, 3.5), { min: 21 })
      ]
    },
    {
      id: 'bunny',
      label: 'Bunny',
      parts: [
        add(ellipse(50, 70, 40, 30)),
        ...pair(add(ellipse(32, 26, 13, 28, -8))),
        ...pair(cut(rect(28, 58, 14, 15, 4)))
      ]
    },
    {
      id: 'fish',
      label: 'Fish',
      parts: [
        add(ellipse(42, 50, 42, 34)),
        add(poly(66, 50, 100, 12, 100, 88)),
        add(poly(30, 18, 52, 2, 62, 22)),
        add(poly(34, 80, 52, 98, 56, 80)),
        cut(rect(16, 38, 13, 13, 4))
      ]
    },
    {
      id: 'turtle',
      label: 'Turtle',
      parts: [
        add(ellipse(46, 66, 42, 58)),
        cut(rect(0, 66, 100, 34)),
        add(rect(4, 56, 84, 14, 7)),
        add(ellipse(89, 46, 11, 10)),
        add(rect(76, 50, 14, 11)),
        add(rect(16, 64, 17, 30, 5)),
        add(rect(58, 64, 17, 30, 5)),
        add(poly(6, 60, 0, 72, 12, 68)),
        cut(ellipse(92, 43, 3), { min: 21 })
      ]
    },
    {
      id: 'elephant',
      label: 'Elephant',
      parts: [
        add(ellipse(58, 50, 40, 30)),
        add(ellipse(26, 36, 24, 24)),
        add(ellipse(42, 36, 18, 26)),
        add(poly(4, 40, 18, 46, 14, 96, 2, 96)),
        add(rect(30, 64, 18, 36, 4)),
        add(rect(74, 64, 18, 36, 4)),
        add(poly(96, 40, 100, 42, 100, 64, 96, 60)),
        cut(ellipse(22, 30, 4), { min: 21 })
      ]
    },
    {
      id: 'dinosaur',
      label: 'Dinosaur',
      parts: [
        add(ellipse(44, 62, 36, 24)),
        add(poly(58, 48, 74, 14, 86, 14, 76, 60)),
        add(ellipse(84, 12, 16, 11)),
        add(poly(16, 56, 0, 92, 4, 96, 34, 76)),
        add(rect(24, 70, 15, 30, 4)),
        add(rect(56, 70, 15, 30, 4))
      ]
    },
    {
      id: 'butterfly',
      label: 'Butterfly',
      parts: [
        ...pair(add(ellipse(26, 30, 26, 28, -25))),
        ...pair(add(ellipse(30, 74, 20, 24, 25))),
        ...pair(cut(poly(0, 48, 42, 54, 0, 66))),
        cut(poly(36, 0, 50, 24, 64, 0)),
        cut(poly(40, 100, 50, 86, 60, 100)),
        add(ellipse(50, 54, 7, 38))
      ]
    },
    {
      id: 'capybara',
      label: 'Capybara',
      parts: [
        add(ellipse(40, 60, 40, 26)),
        add(poly(56, 42, 68, 16, 90, 12, 100, 28, 100, 46, 92, 52, 62, 62)),
        add(ellipse(70, 14, 7, 7)),
        add(rect(12, 72, 15, 28, 5)),
        add(rect(54, 72, 15, 28, 5)),
        cut(ellipse(84, 26, 3), { min: 21 })
      ]
    },
    {
      id: 'ireland',
      label: 'Ireland',
      parts: [
        add(outline(
          -7.4, 55.4, -7.65, 55.25, -8.3, 55.15, -8.5, 54.95, -8.8, 54.7, -8.1, 54.55,
          -8.55, 54.3, -9.3, 54.32, -10.0, 54.25, -10.15, 54.0, -9.6, 53.82, -10.2, 53.42,
          -8.9, 53.22, -9.3, 53.05, -9.95, 52.56, -9.5, 52.6, -9.9, 52.35, -10.45, 52.1,
          -10.35, 51.85, -9.8, 51.45, -8.55, 51.6, -7.85, 51.95, -6.95, 52.12, -6.35, 52.18,
          -6.0, 52.95, -6.1, 53.35, -6.25, 53.72, -6.1, 54.05, -5.45, 54.4, -5.7, 54.7,
          -6.1, 55.2, -6.5, 55.25, -7.0, 55.15
        ))
      ]
    },
    {
      id: 'usa',
      label: 'USA',
      parts: [
        add(outline(
          -124.7, 48.4, -95.2, 49.0, -89.6, 48.0, -84.8, 46.5, -82.5, 45.3, -83.0, 42.3,
          -79.0, 42.8, -76.2, 44.2, -74.7, 45.0, -71.5, 45.0, -69.2, 47.45, -67.8, 47.0,
          -67.0, 44.8, -70.0, 41.8, -74.0, 40.6, -74.9, 38.9, -75.4, 38.0, -75.5, 35.2,
          -77.9, 33.9, -81.0, 32.0, -80.8, 30.5, -78.6, 27.4, -79.0, 24.2, -82.6, 24.0, -84.4, 27.0,
          -84.8, 29.9, -86.0, 30.0, -88.0, 30.4, -89.2, 29.0, -90.5, 29.2, -93.8, 29.7,
          -94.8, 29.3, -97.0, 27.7, -97.4, 25.4, -99.8, 27.2, -100.9, 29.4, -103.2, 29.0,
          -106.5, 31.8, -108.2, 31.8, -108.2, 31.33, -111.1, 31.33, -114.8, 32.5, -117.1, 32.5,
          -118.4, 34.0, -120.6, 34.6, -122.5, 37.8, -124.4, 40.4, -124.0, 46.2
        ))
      ]
    },
    {
      id: 'car',
      label: 'Car',
      parts: [
        add(rect(0, 42, 100, 34, 10)),
        add(poly(16, 44, 30, 8, 68, 8, 86, 44)),
        add(ellipse(24, 80, 15)),
        add(ellipse(76, 80, 15)),
        cut(poly(30, 40, 38, 18, 47, 18, 47, 40), { min: 21 }),
        cut(poly(53, 40, 53, 18, 64, 18, 74, 40), { min: 21 })
      ]
    },
    {
      id: 'horse',
      label: 'Horse',
      parts: [
        add(ellipse(42, 54, 30, 15)),
        add(ellipse(64, 52, 12, 15)),
        // An arched neck and a long head with the nose down, ears up.
        add(poly(58, 46, 64, 26, 74, 10, 86, 12, 82, 32, 74, 60)),
        add(poly(76, 12, 85, 5, 93, 12, 100, 30, 97, 38, 89, 38, 82, 28)),
        add(poly(77, 11, 79, 0, 86, 8)),
        // Legs: two chunky ones on small grids, four once there is room,
        // the back ones bent at the hock.
        add(rect(56, 60, 17, 40, 4), { max: 20 }),
        add(rect(16, 60, 17, 40, 4), { max: 20 }),
        add(poly(56, 60, 65, 62, 63, 94, 64, 100, 55, 100, 56, 94), { min: 21 }),
        add(poly(67, 62, 75, 58, 76, 94, 77, 100, 68, 100, 69, 94), { min: 21 }),
        add(poly(13, 56, 25, 62, 22, 74, 24, 94, 25, 100, 16, 100, 17, 94, 14, 76), { min: 21 }),
        add(poly(28, 64, 38, 64, 35, 76, 37, 94, 38, 100, 29, 100, 30, 94, 28, 78), { min: 21 }),
        // A flowing tail and, on big grids, a ragged mane and an eye.
        add(poly(16, 44, 6, 48, 0, 62, 0, 78, 5, 86, 7, 72, 12, 62, 20, 56), { min: 21 }),
        add(poly(16, 44, 6, 48, 0, 60, 2, 70, 10, 62, 20, 56), { max: 20 }),
        add(poly(74, 10, 68, 14, 67, 19, 62, 23, 62, 28, 57, 33, 57, 40, 53, 45, 61, 47, 68, 24), { min: 31 }),
        cut(ellipse(86, 17, 2.6), { min: 31 })
      ]
    },
    {
      id: 'donut',
      label: 'Donut',
      parts: [
        add(ellipse(50, 50, 50)),
        cut(ellipse(50, 50, 18))
      ]
    },
    {
      id: 'octopus',
      label: 'Octopus',
      parts: [
        add(ellipse(50, 32, 34, 32)),
        add(rect(14, 36, 72, 26, 8)),
        // Curly arms: four on small grids, six once there is room.
        add(poly(14, 52, 28, 56, 20, 80, 26, 100, 4, 96, 4, 74), { max: 24 }),
        add(poly(32, 56, 46, 58, 44, 100, 30, 100), { max: 24 }),
        add(poly(54, 58, 68, 56, 70, 100, 56, 100), { max: 24 }),
        add(poly(72, 56, 86, 52, 96, 74, 96, 96, 74, 100, 80, 80), { max: 24 }),
        add(poly(14, 50, 22, 56, 12, 78, 16, 94, 0, 90, 2, 72), { min: 25 }),
        add(poly(26, 58, 36, 58, 30, 80, 33, 100, 20, 100, 20, 80), { min: 25 }),
        add(poly(40, 58, 48, 58, 46, 100, 37, 100), { min: 25 }),
        mirror(add(poly(14, 50, 22, 56, 12, 78, 16, 94, 0, 90, 2, 72), { min: 25 })),
        mirror(add(poly(26, 58, 36, 58, 30, 80, 33, 100, 20, 100, 20, 80), { min: 25 })),
        mirror(add(poly(40, 58, 48, 58, 46, 100, 37, 100), { min: 25 })),
        ...pair(cut(ellipse(37, 34, 6, 7), { min: 21 }))
      ]
    },
    {
      id: 'snail',
      label: 'Snail',
      parts: [
        add(ellipse(42, 44, 38, 40)),
        add(rect(0, 74, 96, 22, 11)),
        add(poly(72, 86, 76, 46, 92, 40, 100, 52, 98, 88)),
        add(rect(56, 60, 24, 20)),
        // Feelers, and the coil of the shell: a wide groove with fewer turns
        // on small grids, a finer one on big grids.
        add(poly(78, 46, 74, 4, 84, 4, 88, 44)),
        add(poly(90, 44, 94, 2, 100, 6, 98, 48), { min: 25 }),
        cut(spiral(42, 44, 5, 26, 1.25, 10, Math.PI), { max: 24 }),
        cut(spiral(42, 44, 4, 27, 2.1, 6, Math.PI), { min: 25 })
      ]
    }
  ];

  const byId = new Map(SHAPES.map(shape => [shape.id, shape]));

  // The smallest grid a picture is offered on. Below it a cat or a castle
  // is too few squares to read as one. The masks themselves work at any
  // size from here up, so bigger grids need no extra drawings.
  const MIN_SIZE = 15;

  function partsFor(shape, n) {
    return shape.parts.filter(part => (!part.min || n >= part.min) && (!part.max || n <= part.max));
  }

  function insidePart(part, x, y) {
    if (part.kind === 'rect') {
      if (x < part.x || y < part.y || x > part.x + part.w || y > part.y + part.h) return false;
      const r = part.r;
      if (!r) return true;
      const qx = Math.max(part.x + r - x, 0, x - (part.x + part.w - r));
      const qy = Math.max(part.y + r - y, 0, y - (part.y + part.h - r));
      return qx * qx + qy * qy <= r * r;
    }
    if (part.kind === 'ellipse') {
      const a = -part.rotate * Math.PI / 180;
      const dx = x - part.cx;
      const dy = y - part.cy;
      const u = dx * Math.cos(a) - dy * Math.sin(a);
      const v = dx * Math.sin(a) + dy * Math.cos(a);
      return (u * u) / (part.rx * part.rx) + (v * v) / (part.ry * part.ry) <= 1;
    }
    // Even-odd ray test.
    let inside = false;
    const pts = part.points;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function insideShape(parts, x, y) {
    let inside = false;
    for (const part of parts) {
      if (part.cut ? inside : !inside) {
        if (insidePart(part, x, y)) inside = !part.cut;
      }
    }
    return inside;
  }

  // Each square is sampled on a SAMPLES × SAMPLES grid of points and is on
  // when at least half of them fall inside the picture.
  const SAMPLES = 6;
  const COVER = 0.5;

  // The part of the 100 × 100 box the picture really covers, so the mask can
  // stretch it to fill the grid edge to edge.
  function extent(parts) {
    let x0 = 100, y0 = 100, x1 = 0, y1 = 0;
    for (let y = 0.25; y < 100; y += 0.5) {
      for (let x = 0.25; x < 100; x += 0.5) {
        if (!insideShape(parts, x, y)) continue;
        x0 = Math.min(x0, x - 0.25);
        x1 = Math.max(x1, x + 0.25);
        y0 = Math.min(y0, y - 0.25);
        y1 = Math.max(y1, y + 0.25);
      }
    }
    return { x0, y0, w: x1 - x0, h: y1 - y0 };
  }

  function coverage(parts, box, n) {
    const out = [];
    for (let r = 0; r < n; r++) {
      out.push([]);
      for (let c = 0; c < n; c++) {
        let hits = 0;
        for (let i = 0; i < SAMPLES; i++) {
          for (let j = 0; j < SAMPLES; j++) {
            const x = box.x0 + (c + (j + 0.5) / SAMPLES) / n * box.w;
            const y = box.y0 + (r + (i + 0.5) / SAMPLES) / n * box.h;
            if (insideShape(parts, x, y)) hits++;
          }
        }
        out[r].push(hits / (SAMPLES * SAMPLES));
      }
    }
    return out;
  }

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // The shape's squares grouped into pieces joined side to side, biggest first.
  function pieces(on, n) {
    const label = on.map(row => row.map(() => -1));
    const groups = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!on[r][c] || label[r][c] >= 0) continue;
        const group = [[r, c]];
        label[r][c] = groups.length;
        for (let i = 0; i < group.length; i++) {
          const [gr, gc] = group[i];
          for (const [dr, dc] of DIRS) {
            const nr = gr + dr;
            const nc = gc + dc;
            if (nr < 0 || nc < 0 || nr >= n || nc >= n || !on[nr][nc] || label[nr][nc] >= 0) continue;
            label[nr][nc] = groups.length;
            group.push([nr, nc]);
          }
        }
        groups.push(group);
      }
    }
    return groups.sort((a, b) => b.length - a.length);
  }

  // The cheapest run of off squares that joins `group` to the main piece,
  // preferring squares the picture nearly covers, or null.
  function bridge(on, cover, n, group, isMain) {
    const cost = on.map(row => row.map(() => Infinity));
    const prev = on.map(row => row.map(() => null));
    const queue = group.map(([r, c]) => [0, r, c]);
    for (const [, r, c] of queue) cost[r][c] = 0;
    while (queue.length) {
      queue.sort((a, b) => a[0] - b[0]);
      const [d, r, c] = queue.shift();
      if (d > cost[r][c]) continue;
      if (isMain(r, c)) {
        const path = [];
        for (let p = prev[r][c]; p && !on[p[0]][p[1]]; p = prev[p[0]][p[1]]) path.push(p);
        return path;
      }
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
        const step = on[nr][nc] ? 0 : 1.5 - cover[nr][nc];
        if (d + step < cost[nr][nc]) {
          cost[nr][nc] = d + step;
          prev[nr][nc] = [r, c];
          queue.push([d + step, nr, nc]);
        }
      }
    }
    return null;
  }

  // Squares at least half covered, made into one piece: a stray bit the
  // picture only touches at a corner or across a thin gap is joined on with
  // a short bridge, and a speck too far away is left out.
  function joinPieces(cover, n) {
    const on = cover.map(row => row.map(v => v >= COVER));
    const maxBridge = Math.max(1, Math.round(n / 10));
    let groups = pieces(on, n);
    while (groups.length > 1) {
      const main = new Set(groups[0].map(([r, c]) => r * n + c));
      const isMain = (r, c) => main.has(r * n + c);
      const other = groups[1];
      const path = other.length >= 2 ? bridge(on, cover, n, other, isMain) : null;
      if (path && path.length <= maxBridge) {
        for (const [r, c] of path) on[r][c] = true;
      } else {
        for (const [r, c] of other) on[r][c] = false;
      }
      groups = pieces(on, n);
    }
    return on;
  }

  // The mask for a shape at an n × n grid: mask[r][c] is true for squares in
  // the maze. Always one piece, and it reaches all four sides of the grid.
  const cache = new Map();
  function shapeMask(id, n) {
    const cacheKey = `${id}:${n}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const shape = byId.get(id) || byId.get('square');
    const parts = partsFor(shape, n);
    const box = extent(parts);
    // A point or a sloping roof can leave the first or last row or column
    // just under half covered (or only joined on by a speck that gets left
    // out), which wastes a whole line of the grid. Trim that edge of the
    // picture a little at a time until the finished mask reaches it.
    let on;
    for (let tries = 0; ; tries++) {
      on = joinPieces(coverage(parts, box, n), n);
      const trim = { top: !on[0].some(Boolean), bottom: !on[n - 1].some(Boolean),
        left: !on.some(row => row[0]), right: !on.some(row => row[n - 1]) };
      if (tries >= 4 + n / 4 || !(trim.top || trim.bottom || trim.left || trim.right)) break;
      const dx = box.w / n / 4;
      const dy = box.h / n / 4;
      if (trim.left) { box.x0 += dx; box.w -= dx; }
      if (trim.right) box.w -= dx;
      if (trim.top) { box.y0 += dy; box.h -= dy; }
      if (trim.bottom) box.h -= dy;
    }

    cache.set(cacheKey, on);
    return on;
  }

  // Where Start and Finish go on a fresh grid: far apart inside the shape,
  // measured in steps through the shape. From the square nearest the top
  // left, walk to the square furthest away, then from there to the square
  // furthest from that; the last two are the ends. Start takes the one
  // nearer the top left, so a square grid gets its usual corners.
  function shapeEnds(id, n) {
    const mask = shapeMask(id, n);
    const farthest = (from, better) => {
      const dist = mask.map(row => row.map(() => -1));
      dist[from.r][from.c] = 0;
      const queue = [from];
      let best = from;
      for (let i = 0; i < queue.length; i++) {
        const cur = queue[i];
        const d = dist[cur.r][cur.c];
        const bestD = dist[best.r][best.c];
        if (d > bestD || (d === bestD && better(cur, best))) best = cur;
        for (const [dr, dc] of DIRS) {
          const r = cur.r + dr;
          const c = cur.c + dc;
          if (r < 0 || c < 0 || r >= n || c >= n || !mask[r][c] || dist[r][c] >= 0) continue;
          dist[r][c] = d + 1;
          queue.push({ r, c });
        }
      }
      return best;
    };
    const lower = (a, b) => a.r + a.c > b.r + b.c || (a.r + a.c === b.r + b.c && a.r > b.r);
    const upper = (a, b) => lower(b, a);

    let first = null;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (mask[r][c] && (!first || upper({ r, c }, first))) first = { r, c };
      }
    }
    const b = farthest(first, lower);
    const a = farthest(b, upper);
    return upper(a, b) ? { start: a, end: b } : { start: b, end: a };
  }

  // The picture as SVG markup in a 0 0 100 100 view box, for the shape tiles.
  function shapeSvg(id, { size = 25 } = {}) {
    const shape = byId.get(id) || byId.get('square');
    const parts = partsFor(shape, size);
    const draw = part => {
      const fill = part.cut ? '#000' : '#fff';
      if (part.kind === 'rect') {
        return `<rect x="${part.x}" y="${part.y}" width="${part.w}" height="${part.h}" rx="${part.r}" fill="${fill}"/>`;
      }
      if (part.kind === 'ellipse') {
        return `<ellipse cx="${part.cx}" cy="${part.cy}" rx="${part.rx}" ry="${part.ry}" transform="rotate(${part.rotate} ${part.cx} ${part.cy})" fill="${fill}"/>`;
      }
      return `<polygon points="${part.points.map(p => p.map(v => +v.toFixed(2)).join(',')).join(' ')}" fill="${fill}"/>`;
    };
    // Framed like the mask: the picture stretched to a square.
    const box = extent(parts);
    const maskId = `shape-mask-${id}`;
    return `<svg viewBox="${box.x0} ${box.y0} ${box.w} ${box.h}" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
      `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">${parts.map(draw).join('')}</mask>` +
      `<rect width="100" height="100" fill="currentColor" mask="url(#${maskId})"/></svg>`;
  }

  const api = {
    list: SHAPES.map(({ id, label }) => ({ id, label })),
    minSize: MIN_SIZE,
    has: id => byId.has(id),
    label: id => (byId.get(id) || byId.get('square')).label,
    mask: shapeMask,
    ends: shapeEnds,
    svg: shapeSvg
  };

  root.MazeShapes = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
