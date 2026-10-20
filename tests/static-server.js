// Tiny static file server for local testing. It serves the repository root
// under /maze-builder/ so tests run against the same path shape as
// https://thecitizensnips.github.io/maze-builder/ and catch absolute paths.
const http = require('http');
const fs = require('fs');
const path = require('path');

// STATIC_ROOT lets a test serve another copy of the app, such as an old release.
const ROOT = path.resolve(process.env.STATIC_ROOT || path.join(__dirname, '..'));
const BASE = '/maze-builder/';
const PORT = Number(process.env.PORT || 4173);
let requestCount = 0;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/' || url.pathname === '/maze-builder') {
    res.writeHead(301, { Location: BASE });
    res.end();
    return;
  }

  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(404);
    res.end('Not found (the app lives under /maze-builder/)');
    return;
  }

  let rel = decodeURIComponent(url.pathname.slice(BASE.length));
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';

  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || rel.split('/').some(part => part.startsWith('.') || part === 'node_modules')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      // Lets the PWA tests tell a fresh network response from a cached one.
      'X-Test-Request': String(++requestCount)
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Maze Builder running at http://localhost:${PORT}${BASE}`);
});
