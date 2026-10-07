import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { WorkspaceService } from './application/workspace.js';
import { ValidationError } from './domain/model.js';
import { parseCsv } from './infrastructure/csv.js';

const MAX_BODY = 1024 * 1024;
async function body(request: http.IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > MAX_BODY)
      throw new ValidationError('Request exceeds the 1 MB limit.');
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new ValidationError('Request body must be valid JSON.');
  }
}
export function createAppServer(
  service: WorkspaceService,
  uiDirectory?: string,
) {
  const sessionToken = randomBytes(32).toString('hex');
  return http.createServer(async (request, response) => {
    const json = (status: number, value: unknown) => {
      response.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(JSON.stringify(value));
    };
    try {
      const port =
        (request.socket.localAddress && request.socket.localPort) || 4317;
      const host = request.headers.host;
      const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!host || !allowedHosts.includes(host)) {
        json(403, { error: 'Host is not allowed.' });
        return;
      }
      const allowedOrigins = [
        ...allowedHosts.map((value) => `http://${value}`),
        'http://127.0.0.1:5173',
      ];
      if (
        request.headers.origin &&
        !allowedOrigins.includes(request.headers.origin)
      ) {
        json(403, { error: 'Origin is not allowed.' });
        return;
      }
      const url = new URL(request.url || '/', `http://${host}`);
      if (url.pathname.startsWith('/api/')) {
        if (request.method !== 'GET') {
          const token = request.headers['x-tradepilot-token'];
          if (
            typeof token !== 'string' ||
            !/^[a-f0-9]{64}$/.test(token) ||
            !timingSafeEqual(Buffer.from(token), Buffer.from(sessionToken))
          ) {
            json(403, {
              error: 'Refresh the application before changing data.',
            });
            return;
          }
        }
        if (url.pathname === '/api/bootstrap' && request.method === 'GET') {
          json(200, { token: sessionToken, snapshot: service.snapshot() });
          return;
        }
        if (url.pathname === '/api/settings' && request.method === 'PUT') {
          json(200, service.updateSettings(await body(request)));
          return;
        }
        if (url.pathname === '/api/stocks' && request.method === 'POST') {
          json(201, service.addStock(await body(request)));
          return;
        }
        if (url.pathname === '/api/import' && request.method === 'POST') {
          const input = await body(request);
          if (!input || typeof input !== 'object')
            throw new ValidationError('Import request must be an object.');
          const value = input as Record<string, unknown>;
          if (
            typeof value.csv !== 'string' ||
            typeof value.filename !== 'string' ||
            value.filename.length > 200
          )
            throw new ValidationError(
              'Provide CSV text and a filename (maximum 200 characters).',
            );
          json(201, service.importRows(parseCsv(value.csv), value.filename));
          return;
        }
        const notification = /^\/api\/notifications\/([a-f0-9-]+)\/read$/.exec(
          url.pathname,
        );
        if (notification && request.method === 'POST') {
          const found = service.markRead(notification[1]!);
          json(
            found ? 200 : 404,
            found ? { ok: true } : { error: 'Notification not found.' },
          );
          return;
        }
        json(404, { error: 'Endpoint not found.' });
        return;
      }
      if (request.method !== 'GET' || !uiDirectory) {
        json(404, { error: 'Page not found.' });
        return;
      }
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      let filename = path.resolve(uiDirectory, relative || 'index.html');
      const resolved = path.relative(uiDirectory, filename);
      if (resolved.startsWith('..') || path.isAbsolute(resolved)) {
        json(403, { error: 'Invalid file path.' });
        return;
      }
      try {
        if (!(await fs.stat(filename)).isFile())
          filename = path.join(uiDirectory, 'index.html');
      } catch {
        filename = path.join(uiDirectory, 'index.html');
      }
      const content = await fs.readFile(filename);
      const types: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
      };
      response.writeHead(200, {
        'Content-Type':
          types[path.extname(filename)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",
      });
      response.end(content);
    } catch (error) {
      if (error instanceof ValidationError) json(400, { error: error.message });
      else {
        console.error(
          'Local request failed:',
          error instanceof Error ? error.message : 'Unknown failure',
        );
        json(500, {
          error: 'The local application could not complete this request.',
        });
      }
    }
  });
}
