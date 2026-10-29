import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import express from 'express';
import { isHashedBuildAsset, staticCompression } from '../src/server/static-compression';

/*
 * Static delivery contract: the built client and the HTML shell go out compressed; API,
 * internal, webhook and SSE responses go out exactly as before. The app below mirrors the
 * production order in server.ts (API routes, then compression, then express.static and the
 * SPA fallback). Routes registered *after* the middleware prove that the filter itself
 * refuses them, not only their position.
 */

const JS = Array.from({ length: 3000 }, (_, i) => `export const value${i} = "academicos-${i}";`).join('\n');
const HTML = `<!doctype html><html lang="ar" dir="rtl"><head><title>AcademicOS</title></head><body>${'<div class="shell"></div>'.repeat(400)}</body></html>`;
const PAYLOAD = { items: Array.from({ length: 400 }, (_, i) => ({ id: i, title: `assignment-${i}` })) };
const ASSET = '/assets/index-B9GH2iLX.js';

let dist = '';
let server: http.Server;
let port = 0;

before(async () => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'acos-static-'));
  fs.mkdirSync(path.join(dist, 'assets'));
  fs.writeFileSync(path.join(dist, ASSET), JS);
  fs.writeFileSync(path.join(dist, 'index.html'), HTML);

  const app = express();
  app.get('/api/early', (_req, res) => res.json(PAYLOAD));
  app.use(staticCompression());
  // Express matches routes case-insensitively, so /API/late also lands here.
  app.get('/api/late', (_req, res) => res.json(PAYLOAD));
  app.get('/internal/jobs', (_req, res) => res.json(PAYLOAD));
  app.get('/partner/webhooks/order', (_req, res) => res.json(PAYLOAD));
  app.get('/webhook', (_req, res) => res.json(PAYLOAD));
  app.get('/stream/events', (_req, res) => {
    // No `no-transform` here on purpose: only the Content-Type guard may keep this uncompressed.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();
    res.write(`event: ready\ndata: ${'x'.repeat(4096)}\n\n`);
  });
  app.use(express.static(dist, { maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  port = (server.address() as AddressInfo).port;
});

after(() => {
  server?.closeAllConnections();
  server?.close();
  if (dist) fs.rmSync(dist, { recursive: true, force: true });
});

type Reply = { status: number; headers: http.IncomingHttpHeaders; body: Buffer };

function get(pathname: string, headers: Record<string, string> = {}, method = 'GET'): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

function decoded(reply: Reply): string {
  const encoding = reply.headers['content-encoding'];
  if (encoding === 'br') return zlib.brotliDecompressSync(reply.body).toString('utf8');
  if (encoding === 'gzip') return zlib.gunzipSync(reply.body).toString('utf8');
  return reply.body.toString('utf8');
}

const BOTH = { 'Accept-Encoding': 'br, gzip' };

test('a hashed bundle is compressed when the client accepts br or gzip', async () => {
  const reply = await get(ASSET, BOTH);
  assert.equal(reply.status, 200);
  assert.ok(['br', 'gzip'].includes(String(reply.headers['content-encoding'])), `got ${reply.headers['content-encoding']}`);
  assert.match(String(reply.headers.vary), /Accept-Encoding/i);
  assert.ok(reply.body.length < JS.length / 4, 'the compressed body is much smaller');
  assert.equal(decoded(reply), JS);

  const gzipOnly = await get(ASSET, { 'Accept-Encoding': 'gzip' });
  assert.equal(gzipOnly.headers['content-encoding'], 'gzip');
  assert.equal(decoded(gzipOnly), JS);
});

test('a client that sends no Accept-Encoding gets the identical uncompressed file', async () => {
  const reply = await get(ASSET);
  assert.equal(reply.headers['content-encoding'], undefined);
  assert.equal(reply.body.toString('utf8'), JS);
});

test('the HTML shell is compressed, from express.static and from the SPA fallback', async () => {
  for (const route of ['/', '/projects/abc']) {
    const reply = await get(route, BOTH);
    assert.equal(reply.status, 200);
    assert.ok(['br', 'gzip'].includes(String(reply.headers['content-encoding'])), `${route}: ${reply.headers['content-encoding']}`);
    assert.equal(decoded(reply), HTML);
  }
});

test('HEAD requests are answered without a compressed body', async () => {
  const reply = await get(ASSET, BOTH, 'HEAD');
  assert.equal(reply.headers['content-encoding'], undefined);
});

test('a byte-range request gets exactly the uncompressed bytes it asked for', async () => {
  const reply = await get(ASSET, { ...BOTH, Range: 'bytes=0-2047' });
  assert.equal(reply.status, 206);
  assert.equal(reply.headers['content-encoding'], undefined);
  assert.equal(reply.headers['content-range'], `bytes 0-2047/${Buffer.byteLength(JS)}`);
  assert.equal(reply.body.toString('utf8'), JS.slice(0, 2048));
});

test('API, internal and webhook responses are never compressed', async () => {
  for (const route of ['/api/early', '/api/late', '/API/late', '/internal/jobs', '/partner/webhooks/order', '/webhook']) {
    const reply = await get(route, BOTH);
    assert.equal(reply.status, 200, route);
    assert.equal(reply.headers['content-encoding'], undefined, `${route} must stay uncompressed`);
    assert.doesNotMatch(String(reply.headers.vary ?? ''), /Accept-Encoding/i, `${route} must not gain Vary: Accept-Encoding`);
    assert.deepEqual(JSON.parse(reply.body.toString('utf8')), PAYLOAD);
  }
});

test('an SSE stream is never compressed and its first event arrives while the stream is open', async () => {
  const { headers, first } = await new Promise<{ headers: http.IncomingHttpHeaders; first: string }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no SSE event within 3s: the stream is being buffered')), 3000);
    const req = http.get({ host: '127.0.0.1', port, path: '/stream/events', headers: BOTH }, (res) => {
      res.once('data', (chunk: Buffer) => {
        clearTimeout(timer);
        resolve({ headers: res.headers, first: chunk.toString('utf8') });
        req.destroy();
      });
    });
    req.on('error', () => undefined);
  });
  assert.equal(headers['content-encoding'], undefined);
  assert.match(String(headers['content-type']), /^text\/event-stream/);
  assert.match(first, /^event: ready/);
});

test('only Vite-hashed files in dist/assets are classified as immutable', () => {
  for (const file of [
    'assets/index-B9GH2iLX.js',
    'assets/firebase-D-x_9aZk.js',
    'assets/index-Cq3ab_1-.css',
    'assets/react-AbCdEfGh.js',
    'assets\\icons-AbCdEfGh.js',
  ]) {
    assert.equal(isHashedBuildAsset(file), true, `${file} is a hashed build asset`);
  }
  for (const file of [
    'index.html',
    'sw.js',
    'env-config.js',
    'manifest.webmanifest',
    'assets/academicos-project-journey.png',
    'assets/index.js',
    'fonts/plex-ar-arabic-400.woff2',
    'launch/launch-1170x2532.png',
    'icon-512.png',
  ]) {
    assert.equal(isHashedBuildAsset(file), false, `${file} must keep its short cache`);
  }
});

test('files copied verbatim from public/assets are never cached as immutable', () => {
  const publicAssets = path.join(process.cwd(), 'public', 'assets');
  const files = fs.existsSync(publicAssets) ? fs.readdirSync(publicAssets) : [];
  for (const file of files) {
    assert.equal(isHashedBuildAsset(`assets/${file}`), false, `public/assets/${file} has no content hash and must not be cached for a year`);
  }
});

test('every Vite output in dist/assets is classified as hashed (after a build)', (t) => {
  const builtAssets = path.join(process.cwd(), 'dist', 'assets');
  if (!fs.existsSync(builtAssets)) return t.skip('dist/assets not built');
  const publicAssets = path.join(process.cwd(), 'public', 'assets');
  const copied = new Set(fs.existsSync(publicAssets) ? fs.readdirSync(publicAssets) : []);
  const built = fs.readdirSync(builtAssets).filter((file) => !copied.has(file));
  assert.ok(built.some((file) => file.endsWith('.js')), 'the build emits JS bundles');
  for (const file of built) {
    assert.equal(isHashedBuildAsset(`assets/${file}`), true, `dist/assets/${file} should be cached as immutable`);
  }
});

test('server.ts mounts compression after every API route and directly before the built client', async () => {
  const server = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
  const apiNotFound = server.indexOf('app.use("/api", (_req, res) =>');
  const mount = server.indexOf('app.use(staticCompression());');
  const staticClient = server.indexOf('express.static(distPath');
  assert.ok(apiNotFound > 0, 'the /api 404 handler exists');
  assert.ok(mount > apiNotFound, 'compression is mounted after the last API handler');
  assert.ok(staticClient > mount, 'compression is mounted before express.static');
  assert.doesNotMatch(server.slice(mount, staticClient), /app\.(get|post|put|patch|delete|all)\(/, 'no route sits between them');
  assert.equal(server.split('staticCompression()').length - 1, 1, 'compression is mounted exactly once');
  assert.match(
    server,
    /isHashedBuildAsset\(path\.relative\(distPath, file\)\)\)\s*res\.setHeader\(\s*"Cache-Control",\s*"public, max-age=31536000, immutable",?\s*\)/,
    'hashed build assets are served with the immutable one-year policy',
  );
});
