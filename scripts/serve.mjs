#!/usr/bin/env node
// Minimal static file server for local preview of dist/. No dependencies, so
// previewing never requires a network install.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(repoRoot, 'dist');
const port = Number(process.env.PORT) || 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

async function resolveFile(urlPath) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(distDir, safePath);

  try {
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch {
    return null;
  }

  try {
    const body = await readFile(filePath);
    return { body, filePath };
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const resolved = await resolveFile(url.pathname);

  if (!resolved) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  // Use the resolved file's extension (e.g. a directory request resolves to
  // index.html), not the request URL's - a directory URL has no extension.
  const ext = path.extname(resolved.filePath);
  const contentType = ext ? MIME_TYPES[ext] || 'application/octet-stream' : 'text/plain; charset=utf-8';
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(resolved.body);
});

server.listen(port, () => {
  console.log(`Serving ${path.relative(repoRoot, distDir)}/ at http://localhost:${port}/`);
});
