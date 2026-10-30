import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { ApiError, createCatalogue } from './catalogue.mjs';

export function createApp(catalogue) {
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    // Local development only: explicitly allow browser previews served by Expo.
    const origin = req.headers.origin;
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    if (req.method === 'OPTIONS') return send(204, null);
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') return send(200, { mode: catalogue.mode });
      if (req.method === 'GET' && url.pathname === '/titles') {
        const type = url.searchParams.get('type') || 'movie';
        const language = url.searchParams.get('language') || '';
        const query = (url.searchParams.get('query') || '').trim();
        const page = Number(url.searchParams.get('page') || 1);
        if (!['movie', 'tv'].includes(type) || !['', 'ta', 'ko', 'en'].includes(language) || query.length > 120 || !Number.isInteger(page) || page < 1 || page > 500) throw new ApiError(400, 'Invalid search options.');
        return send(200, await catalogue.list({ type, language, query, page }));
      }
      if (/^\/(watchlist|library|profile)(?:\/|$)/.test(url.pathname)) {
        return send(410, { error: 'Personal collections now require a signed-in Supabase account.' });
      }
      const videos = url.pathname.match(/^\/titles\/(movie|tv)\/([1-9]\d*)\/videos$/);
      if (videos && req.method === 'GET') {
        const id = Number(videos[2]);
        if (!Number.isSafeInteger(id)) throw new ApiError(400, 'Invalid title ID.');
        return send(200, { mode: catalogue.mode, ...await catalogue.videos(videos[1], id) });
      }
      const match = url.pathname.match(/^\/(titles)\/(movie|tv)\/([1-9]\d*)$/);
      if (match) {
        const [, resource, type, rawId] = match;
        const id = Number(rawId);
        if (!Number.isSafeInteger(id)) throw new ApiError(400, 'Invalid title ID.');
        if (resource === 'titles' && req.method === 'GET') return send(200, { mode: catalogue.mode, title: await catalogue.detail(type, id) });

      }
      send(404, { error: 'Endpoint not found.' });
    } catch (error) {
      send(error instanceof ApiError ? error.status : 500, { error: error instanceof ApiError ? error.message : 'Something went wrong. Please try again.' });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dataDir = new URL('./data/', import.meta.url);
  mkdirSync(dataDir, { recursive: true });
  const catalogue = createCatalogue({ database: fileURLToPath(new URL('catalogue.sqlite', dataDir)), token: process.env.TMDB_READ_ACCESS_TOKEN, apiKey: process.env.TMDB_API_KEY });
  const server = createApp(catalogue);
  server.listen(Number(process.env.PORT || 4000), '0.0.0.0', () => console.log(`myArqiv local backend on port ${process.env.PORT || 4000} (${catalogue.mode} mode).`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => { catalogue.close(); process.exit(0); }));
}
