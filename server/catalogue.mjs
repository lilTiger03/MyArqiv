import { DatabaseSync } from 'node:sqlite';
import { curatedSongs, tmdbVideos, primaryTrailer } from './song-links.mjs';

export const demoTitles = [
  { id: 1, type: 'movie', title: 'Letters from Chennai', language: 'ta', year: '2025', genres: ['Drama'], overview: 'A fictional demo story about two friends reconnecting through letters across a changing city.' },
  { id: 2, type: 'movie', title: 'Seoul After Rain', language: 'ko', year: '2025', genres: ['Mystery'], overview: 'A fictional demo mystery following a photographer through the streets of Seoul.' },
  { id: 3, type: 'movie', title: 'The Last Lighthouse', language: 'en', year: '2024', genres: ['Adventure'], overview: 'A fictional demo adventure about a family and a remote lighthouse.' },
  { id: 1, type: 'tv', title: 'Midnight Platform', language: 'ko', year: '2025', genres: ['Drama'], overview: 'A fictional demo series about the strangers who meet on the last train home.' },
  { id: 2, type: 'tv', title: 'The Music Next Door', language: 'ta', year: '2024', genres: ['Comedy'], overview: 'A fictional demo series about neighbours brought together by music.' },
  { id: 3, type: 'tv', title: 'Across the Fjord', language: 'no', year: '2025', genres: ['Mystery'], overview: 'A fictional demo series about a small coastal town and an unexpected visitor.' },
].map(title => ({ ...title, originalTitle: title.title, poster: null, rating: null, cast: [], demo: true }));

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function createCatalogue({ database = ':memory:', token = '', apiKey = '', fetcher = fetch } = {}) {
  const db = new DatabaseSync(database);
  db.exec(`CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS saved (key TEXT PRIMARY KEY, value TEXT NOT NULL, added INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS watched (key TEXT PRIMARY KEY, value TEXT NOT NULL, added INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK(id = 1), display_name TEXT NOT NULL);
    INSERT OR IGNORE INTO profile VALUES (1, 'Film lover');`);
  const live = Boolean(token || apiKey);
  const mode = live ? 'tmdb' : 'demo';
  const pending = new Map();
  let queue = Promise.resolve();
  let blockedUntil = 0;

  function normalize(item, type) {
    return {
      id: item.id, type, title: item.title || item.name || 'Untitled',
      originalTitle: item.original_title || item.original_name || '',
      overview: item.overview || 'No description available yet.', language: item.original_language || '',
      year: (item.release_date || item.first_air_date || '').slice(0, 4),
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      rating: item.vote_count > 0 ? item.vote_average : null,
      genres: (item.genres || []).map(genre => genre.name),
      cast: (item.credits?.cast || []).slice(0, 12).map(person => ({
        id: person.id, name: person.name, character: person.character,
        image: person.profile_path ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : null,
      })), demo: false,
    };
  }

  async function request(path, params = {}, ttl = 15 * 60_000) {
    const query = new URLSearchParams({ language: 'en-US', ...params });
    const key = `${path}?${query}`;
    const cached = db.prepare('SELECT value FROM cache WHERE key = ? AND expires > ?').get(key, Date.now());
    if (cached) return JSON.parse(cached.value);
    if (pending.has(key)) return pending.get(key);
    // Serialize upstream calls and leave space between them; repeated callers share one request.
    const job = queue.then(async () => {
      if (Date.now() < blockedUntil) throw new ApiError(503, 'The film service is busy. Please try again shortly.');
      const url = new URL(`https://api.themoviedb.org/3/${path}`);
      url.search = query.toString();
      if (apiKey) url.searchParams.set('api_key', apiKey);
      try {
        const response = await fetcher(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: AbortSignal.timeout(10_000),
        });
        if (response.status === 429) {
          const retry = response.headers.get('retry-after');
          const seconds = retry ? Number(retry) : NaN;
          blockedUntil = Number.isFinite(seconds) ? Date.now() + Math.max(seconds, 1) * 1000 : Math.max(Date.parse(retry || '') || 0, Date.now() + 2000);
          throw new ApiError(503, 'The film service is busy. Please try again shortly.');
        }
        if (response.status === 404) throw new ApiError(404, 'This title is no longer available.');
        if (response.status === 401 || response.status === 403) throw new ApiError(503, 'TMDB credentials need checking in the backend configuration.');
        if (!response.ok) throw new ApiError(502, 'The film service is temporarily unavailable.');
        const data = await response.json();
        db.prepare('INSERT OR REPLACE INTO cache VALUES (?, ?, ?)').run(key, JSON.stringify(data), Date.now() + ttl);
        db.prepare('DELETE FROM cache WHERE expires <= ?').run(Date.now());
        return data;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(502, 'Could not reach the film service. Please try again.');
      } finally {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    });
    queue = job.catch(() => {});
    pending.set(key, job);
    try { return await job; } finally { pending.delete(key); }
  }

  return {
    mode,
    async list({ type = 'movie', language = '', query = '', page = 1 } = {}) {
      if (!live) {
        const titles = demoTitles.filter(title => title.type === type && (!language || title.language === language) && title.title.toLowerCase().includes(query.toLowerCase()));
        return { mode, titles, page: 1, pages: 1 };
      }
      const data = await request(query ? `search/${type}` : `discover/${type}`, {
        page: String(page), include_adult: 'false',
        ...(query ? { query } : { sort_by: 'popularity.desc', ...(language ? { with_original_language: language } : {}) }),
      });
      return { mode, titles: data.results.filter(item => !item.adult && (!language || item.original_language === language)).map(item => normalize(item, type)), page: data.page, pages: Math.min(data.total_pages, 500) };
    },
    async detail(type, id) {
      if (!live) {
        const title = demoTitles.find(item => item.type === type && item.id === id);
        if (!title) throw new ApiError(404, 'Title not found.');
        return title;
      }
      const data = await request(`${type}/${id}`, { append_to_response: 'credits' }, 6 * 60 * 60_000);
      if (data.adult) throw new ApiError(404, 'Title not available.');
      return normalize(data, type);
    },
    async videos(type, id) {
      const title = await this.detail(type, id);
      if (!live) return { videos: [], trailerId: null, warning: null };
      const songs = curatedSongs(type, id);
      try {
        const data = await request(`${type}/${id}/videos`, {
          include_video_language: [...new Set([title.language, 'en'].filter(Boolean))].join(','),
        }, 6 * 60 * 60_000);
        const ids = new Set(songs.map(song => song.id));
        const videos = [...songs, ...tmdbVideos(data.results).filter(video => !ids.has(video.id))];
        return { videos, trailerId: primaryTrailer(videos, title.language)?.id || null, warning: null };
      } catch (error) {
        // Editorial songs remain usable when optional TMDB video metadata is unavailable.
        if (songs.length) return { videos: songs, trailerId: null, warning: 'Trailers are temporarily unavailable. Song links are still available.' };
        throw error;
      }
    },
    saved() {
      return db.prepare('SELECT value FROM saved WHERE key LIKE ? ORDER BY added DESC').all(`${mode}:%`).map(row => JSON.parse(row.value));
    },
    async save(type, id) {
      const title = await this.detail(type, id);
      db.prepare('INSERT OR REPLACE INTO saved VALUES (?, ?, ?)').run(`${mode}:${type}:${id}`, JSON.stringify(title), Date.now());
      return title;
    },
    remove(type, id) { db.prepare('DELETE FROM saved WHERE key = ?').run(`${mode}:${type}:${id}`); },
    library() {
      return db.prepare('SELECT value, added FROM watched WHERE key LIKE ? ORDER BY added DESC')
        .all(`${mode}:%`).map(row => ({ ...JSON.parse(row.value), watchedAt: new Date(row.added).toISOString() }));
    },
    async markWatched(type, id) {
      const title = await this.detail(type, id);
      const key = `${mode}:${type}:${id}`;
      db.exec('BEGIN');
      try {
        db.prepare('INSERT INTO watched VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
          .run(key, JSON.stringify(title), Date.now());
        db.prepare('DELETE FROM saved WHERE key = ?').run(key);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return title;
    },
    unwatch(type, id) { db.prepare('DELETE FROM watched WHERE key = ?').run(`${mode}:${type}:${id}`); },
    profile() {
      const titles = this.library();
      return { displayName: db.prepare('SELECT display_name FROM profile WHERE id = 1').get().display_name,
        watched: titles.length, films: titles.filter(title => title.type === 'movie').length,
        series: titles.filter(title => title.type === 'tv').length, watchlist: this.saved().length };
    },
    updateProfile(displayName) {
      db.prepare('UPDATE profile SET display_name = ? WHERE id = 1').run(displayName);
      return this.profile();
    },
    close() { db.close(); },
  };
}
