import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogueFeed } from './catalogue-feed.ts';
const filters = { type: 'movie', language: '', query: '' };
const title = (id, type = 'movie') => ({ id, type, title: `Title ${id}` });
const page = (number, titles, pages = 3) => ({ mode: 'tmdb', page: number, pages, titles });
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('appends successive pages, deduplicates IDs and keeps movie/series IDs distinct', async () => {
  const feed = createCatalogueFeed(async (_, number) => number === 1 ? page(1, [title(1)]) : page(2, [title(1), title(2), title(1, 'tv')]), 0);
  feed.reset(filters); await tick(); feed.loadMore(); await tick();
  assert.deepEqual(feed.getSnapshot().titles.map(t => `${t.type}:${t.id}`), ['movie:1', 'movie:2', 'tv:1']); feed.cancel();
});
test('repeated end-of-list events share one in-flight page request', async () => {
  const next = deferred(); const calls = [];
  const feed = createCatalogueFeed(async (_, number) => { calls.push(number); return number === 1 ? page(1, [title(1)]) : next.promise; }, 0);
  feed.reset(filters); await tick(); feed.loadMore(); feed.loadMore(); feed.loadMore();
  assert.deepEqual(calls, [1, 2]); next.resolve(page(2, [title(2)])); await tick(); feed.cancel();
});
test('filter changes abort and ignore an old response even if transport does not honour abort', async () => {
  const old = deferred(); let oldSignal;
  const feed = createCatalogueFeed(async (f, _, signal) => {
    if (!f.language) { oldSignal = signal; return old.promise; }
    return page(1, [title(9)]);
  }, 0);
  feed.reset(filters); await tick(); feed.reset({ ...filters, language: 'ko' }); await tick();
  assert.equal(oldSignal.aborted, true); old.resolve(page(1, [title(1)])); await tick();
  assert.deepEqual(feed.getSnapshot().titles.map(t => t.id), [9]); feed.cancel();
});
test('failed next page preserves results, stops automatic retries and retries that same page', async () => {
  let fails = true; const calls = [];
  const feed = createCatalogueFeed(async (_, number) => {
    calls.push(number); if (number === 2 && fails) throw new Error('Offline'); return page(number, [title(number)]);
  }, 0);
  feed.reset(filters); await tick(); feed.loadMore(); await tick(); feed.loadMore();
  assert.equal(feed.getSnapshot().titles.length, 1); assert.equal(feed.getSnapshot().status, 'error');
  assert.deepEqual(calls, [1, 2]); fails = false; feed.retry(); await tick();
  assert.deepEqual(calls, [1, 2, 2]); assert.equal(feed.getSnapshot().titles.length, 2); feed.cancel();
});
test('stops at the final page and still advances through an empty filtered page', async () => {
  const calls = [];
  const feed = createCatalogueFeed(async (_, number) => { calls.push(number); return page(number, number === 1 ? [] : [title(2)], 2); }, 0);
  feed.reset(filters); await tick(); feed.loadMore(); await tick(); feed.loadMore();
  assert.deepEqual(calls, [1, 2]); assert.equal(feed.getSnapshot().titles.length, 1); feed.cancel();
});
test('typing cancels requests that have not passed the debounce delay', async () => {
  const calls = [];
  const feed = createCatalogueFeed(async f => { calls.push(f.query); return page(1, []); }, 15);
  feed.reset({ ...filters, query: 'p' }); feed.reset({ ...filters, query: 'parasite' });
  await new Promise(resolve => setTimeout(resolve, 25)); assert.deepEqual(calls, ['parasite']); feed.cancel();
});
