import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createCatalogue } from './catalogue.mjs';
import { createApp } from './index.mjs';

test('watchlist survives restarts and distinguishes movie/TV IDs', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'myarqiv-test-'));
  const database = join(directory, 'test.sqlite');
  let catalogue = createCatalogue({ database });
  try {
    await catalogue.save('movie', 1); await catalogue.save('tv', 1);
    assert.equal(catalogue.saved().length, 2);
    catalogue.close(); catalogue = createCatalogue({ database });
    assert.equal(catalogue.saved().length, 2);
    catalogue.remove('movie', 1);
    assert.equal(catalogue.saved()[0].type, 'tv');
  } finally { catalogue.close(); rmSync(directory, { recursive: true }); }
});

test('demo search applies language and media filters', async () => {
  const catalogue = createCatalogue();
  try {
    const result = await catalogue.list({ type: 'tv', language: 'ko', query: 'midnight' });
    assert.equal(result.titles.length, 1);
    assert.equal(result.titles[0].demo, true);
    await assert.rejects(catalogue.detail('movie', 999), { status: 404 });
  } finally { catalogue.close(); }
});

test('shared upstream cache deduplicates concurrent requests and protects credentials', async () => {
  let calls = 0;
  const catalogue = createCatalogue({ token: 'test-secret', fetcher: async (url, options) => {
    calls++; assert.equal(options.headers.Authorization, 'Bearer test-secret');
    assert.equal(url.searchParams.has('api_key'), false);
    return new Response(JSON.stringify({ results: [{ id: 1, title: 'Example', original_language: 'ta' }], page: 1, total_pages: 1 }));
  } });
  try {
    const [first, second] = await Promise.all([catalogue.list(), catalogue.list()]);
    await catalogue.list();
    assert.equal(calls, 1); assert.deepEqual(first, second);
    assert.equal(JSON.stringify(first).includes('test-secret'), false);
  } finally { catalogue.close(); }
});

test('upstream failures are sanitised and are not cached', async () => {
  let calls = 0;
  const catalogue = createCatalogue({ apiKey: 'private-key', fetcher: async () => { calls++; return new Response('secret upstream text', { status: 401 }); } });
  try {
    for (let i = 0; i < 2; i++) await assert.rejects(catalogue.list(), error => error.status === 503 && !error.message.includes('secret'));
    assert.equal(calls, 2);
  } finally { catalogue.close(); }
});

test('HTTP catalogue remains public while legacy personal endpoints are closed', async () => {
  const catalogue = createCatalogue(); const server = createApp(catalogue);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/titles?type=person`)).status, 400);
    assert.equal((await fetch(`${base}/titles?page=-1`)).status, 400);
    assert.equal((await fetch(`${base}/titles/movie/999`)).status, 404);
    assert.equal((await fetch(`${base}/titles/movie/1`)).status, 200);
    for (const path of ['/watchlist', '/library', '/profile', '/watchlist/movie/1', '/library/movie/1']) {
      assert.equal((await fetch(`${base}${path}`)).status, 410);
      assert.equal((await fetch(`${base}${path}`, { method: 'POST' })).status, 410);
    }
  } finally { await new Promise(resolve => server.close(resolve)); catalogue.close(); }
});

test('upstream Retry-After prevents repeated calls during a rate-limit pause', async () => {
  let calls = 0;
  const catalogue = createCatalogue({ token: 'test-token', fetcher: async () => {
    calls++;
    return new Response('{}', { status: 429, headers: { 'retry-after': '30' } });
  } });
  try {
    await assert.rejects(catalogue.list(), { status: 503 });
    await assert.rejects(catalogue.list({ type: 'tv' }), { status: 503 });
    assert.equal(calls, 1);
  } finally { catalogue.close(); }
});

test('watched history moves watchlist entries, keeps movie/TV IDs distinct and survives restarts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'myarqiv-library-'));
  const database = join(directory, 'test.sqlite');
  let catalogue = createCatalogue({ database });
  try {
    await catalogue.save('movie', 1); await catalogue.save('tv', 1);
    await catalogue.markWatched('movie', 1);
    const watchedAt = catalogue.library()[0].watchedAt;
    await catalogue.markWatched('movie', 1);
    assert.equal(catalogue.library().length, 1);
    assert.equal(catalogue.library()[0].watchedAt, watchedAt);
    assert.equal(catalogue.saved().length, 1);
    assert.equal(catalogue.saved()[0].type, 'tv');
    await catalogue.markWatched('tv', 1);
    catalogue.updateProfile('Mithun 🎬');
    catalogue.close(); catalogue = createCatalogue({ database });
    assert.deepEqual(catalogue.profile(), { displayName: 'Mithun 🎬', watched: 2, films: 1, series: 1, watchlist: 0 });
    catalogue.unwatch('movie', 1);
    assert.equal(catalogue.library()[0].type, 'tv');
    assert.equal(catalogue.saved().length, 0);
    await assert.rejects(catalogue.markWatched('movie', 999), { status: 404 });
    assert.equal(catalogue.library().length, 1);
  } finally { catalogue.close(); rmSync(directory, { recursive: true }); }
});

test('adding library/profile tables preserves an existing watchlist and separates live/demo history', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'myarqiv-migrate-'));
  const database = join(directory, 'test.sqlite');
  const old = new DatabaseSync(database);
  old.exec('CREATE TABLE saved (key TEXT PRIMARY KEY, value TEXT NOT NULL, added INTEGER NOT NULL)');
  old.prepare('INSERT INTO saved VALUES (?, ?, ?)').run('demo:movie:2', JSON.stringify({ id: 2, type: 'movie', title: 'Existing saved title' }), 1);
  old.close();
  let catalogue = createCatalogue({ database });
  try {
    assert.equal(catalogue.saved()[0].title, 'Existing saved title');
    await catalogue.markWatched('movie', 1);
    catalogue.close(); catalogue = createCatalogue({ database, token: 'fake-test-token' });
    assert.equal(catalogue.library().length, 0);
    assert.equal(catalogue.profile().watched, 0);
    assert.equal(catalogue.saved().length, 0);
  } finally { catalogue.close(); rmSync(directory, { recursive: true }); }
});

test('existing local collections are retained internally but are never exposed over HTTP', async () => {
  const catalogue = createCatalogue(); await catalogue.save('movie', 1); await catalogue.markWatched('tv', 1);
  const server = createApp(catalogue);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(catalogue.saved().length, 1); assert.equal(catalogue.library().length, 1);
    for (const path of ['/library', '/watchlist', '/profile']) {
      const response = await fetch(`${base}${path}`); assert.equal(response.status, 410);
      const data = await response.json(); assert.equal('titles' in data, false); assert.equal('profile' in data, false);
    }
  } finally { await new Promise(resolve => server.close(resolve)); catalogue.close(); }
});
