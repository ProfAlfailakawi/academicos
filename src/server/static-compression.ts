import compression from 'compression';
import type { Request, RequestHandler, Response } from 'express';

/*
 * Gzip/brotli for the built client only: the JS and CSS bundles, fonts, and the HTML shell.
 *
 * server.ts mounts this directly before express.static, after every API, webhook and health
 * route, so those responses never pass through it. The filter is a second guard, so that a
 * route added later, or an /api path that falls through to the SPA fallback, is still sent
 * exactly as before:
 *  - /api/** — includes the billing webhooks (/api/billing/webhook/*), the WhatsApp webhook
 *    (/api/whatsapp/webhook) and LTI (/api/lti/*);
 *  - any /internal/** path, and any path with a /webhook or /webhooks segment;
 *  - any text/event-stream response (the SSE hub in realtime.ts): a gzip buffer would hold
 *    events back instead of letting each frame reach the client as it is written.
 * Everything else defers to compression's own filter (compressible Content-Type only).
 * compression itself also skips HEAD requests, bodies under 1 KB and Cache-Control: no-transform.
 */
const NEVER_COMPRESS_PATH = /^\/(?:api|internal)(?:\/|$)|\/webhooks?(?:\/|$)/i;
const EVENT_STREAM = /^\s*text\/event-stream\b/i;

export function shouldCompress(req: Request, res: Response): boolean {
  if (NEVER_COMPRESS_PATH.test(req.path)) return false;
  if (EVENT_STREAM.test(String(res.getHeader('Content-Type') ?? ''))) return false;
  return compression.filter(req, res);
}

export function staticCompression(): RequestHandler {
  return compression({ filter: shouldCompress });
}

/*
 * Vite writes every bundle and imported asset to dist/assets as `<name>-<hash>.<ext>`, where
 * the hash is Rollup's 8-character content hash (letters, digits, `_` and `-`). Only those
 * files may be cached for a year: their name changes whenever their bytes do. Files copied
 * verbatim from public/assets keep their plain names and must not match; the test checks every
 * file in public/assets against this pattern.
 */
const HASHED_BUILD_ASSET = /^assets\/[^/]+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/;

/** `relativePath` is relative to dist, e.g. `assets/index-B9GH2iLX.js`. */
export function isHashedBuildAsset(relativePath: string): boolean {
  return HASHED_BUILD_ASSET.test(relativePath.replace(/\\/g, '/'));
}
