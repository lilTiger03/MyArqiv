import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogue } from './catalogue.mjs';
import { createApp } from './index.mjs';
import { curatedSongs, tmdbVideos, primaryTrailer } from './song-links.mjs';

const video = (key, name, type = 'Clip', extra = {}) => ({ site: 'YouTube', key, name, type, official: true, iso_639_1: 'ta', ...extra });

test('video metadata accepts only safe YouTube IDs, deduplicates and keeps teasers separate from songs', () => {
  const result = tmdbVideos([
    video('abcdefghijk', 'An official lyric video'), video('abcdefghijk', 'Duplicate'),
    video('12345678901', 'Video song teaser', 'Teaser'), video('ABCDEFGHIJK', 'Trailer', 'Trailer'),
    video('<script>bad', 'Unsafe'), video('aaaaaaaaaaa', 'Wrong provider', 'Clip', { site: 'Vimeo' }),
  ]);
  assert.equal(result.length, 3);
  assert.equal(result[0].kind, 'song');
  assert.equal(result[1].kind, 'teaser');
  assert.equal(result[2].kind, 'trailer');
  assert.equal(curatedSongs('movie', 680652)[0].publisher, 'Think Music India');
  assert.deepEqual(curatedSongs('tv', 680652), []);
});

test('video requests reuse cached details, request original language plus English and deduplicate calls', async () => {
  const paths = [];
  const catalogue = createCatalogue({ token: 'private-token', fetcher: async url => {
    paths.push(url.pathname);
    if (url.pathname.endsWith('/videos')) {
      assert.equal(url.searchParams.get('include_video_language'), 'ta,en');
      return Response.json({ results: [video('ARKpiClpoyU', 'Duplicate song'), video('abcdefghijk', 'Trailer', 'Trailer')] });
    }
    return Response.json({ id: 680652, title: 'Karnan', original_language: 'ta' });
  } });
  try {
    const [a, b] = await Promise.all([catalogue.videos('movie', 680652), catalogue.videos('movie', 680652)]);
    assert.deepEqual(a, b);
    await catalogue.videos('movie', 680652);
    assert.equal(paths.length, 2);
    assert.equal(a.videos.length, 2);
    assert.equal(a.videos[0].source, 'curated');
    assert.equal(a.trailerId, 'abcdefghijk');
    assert.equal(JSON.stringify(a).includes('private-token'), false);
  } finally { catalogue.close(); }
});

test('editorial songs remain usable when optional TMDB video metadata fails', async () => {
  const catalogue = createCatalogue({ token: 'token', fetcher: async url => url.pathname.endsWith('/videos')
    ? new Response('upstream secret', { status: 503 })
    : Response.json({ id: 743563, title: 'Vikram', original_language: 'ta' }) });
  try {
    const result = await catalogue.videos('movie', 743563);
    assert.equal(result.videos[0].id, '1OjZnGZjOA0');
    assert.ok(result.warning);
    assert.equal(JSON.stringify(result).includes('secret'), false);
  } finally { catalogue.close(); }
});

test('no fake song associations in demo mode and invalid title IDs still fail', async () => {
  const catalogue = createCatalogue();
  try {
    assert.deepEqual(await catalogue.videos('movie', 1), { videos: [], trailerId: null, warning: null });
    await assert.rejects(catalogue.videos('movie', 680652), { status: 404 });
  } finally { catalogue.close(); }
});

test('video HTTP endpoint validates IDs and returns an honest empty collection', async () => {
  const catalogue = createCatalogue();
  const server = createApp(catalogue);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${base}/titles/movie/1/videos`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).videos, []);
    assert.equal((await fetch(`${base}/titles/movie/999/videos`)).status, 404);
    assert.equal((await fetch(`${base}/titles/movie/9007199254740993/videos`)).status, 400);
    assert.equal((await fetch(`${base}/titles/person/1/videos`)).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); catalogue.close(); }
});

test('one official trailer prefers the original language and excludes mislabeled teasers', () => {
  const results = tmdbVideos([
    video('aaaaaaaaaaa', 'Official Trailer', 'Trailer', { iso_639_1: 'en' }),
    video('bbbbbbbbbbb', 'Tamil Official Trailer', 'Trailer'),
    video('ccccccccccc', 'Official Teaser', 'Trailer'),
    video('ddddddddddd', 'Trailer reaction', 'Trailer'),
    video('eeeeeeeeeee', 'Fan-made trailer', 'Trailer', { official: false }),
  ]);
  assert.equal(primaryTrailer(results, 'ta').id, 'bbbbbbbbbbb');
  assert.equal(primaryTrailer(results, 'ko').id, 'aaaaaaaaaaa');
  const manyTeasers = Array.from({ length: 30 }, (_, i) => video(String(i).padStart(11, '0'), 'Teaser', 'Teaser'));
  assert.equal(primaryTrailer(tmdbVideos([...manyTeasers, video('zzzzzzzzzzz', 'Official Trailer', 'Trailer')]), 'ta').id, 'zzzzzzzzzzz');
  assert.equal(primaryTrailer(results.filter(v => !['aaaaaaaaaaa', 'bbbbbbbbbbb'].includes(v.id)), 'ta'), null);
});

test('song classification excludes covers, unofficial clips, making-ofs and song teasers', () => {
  const results = tmdbVideos([
    video('aaaaaaaaaaa', 'Naa Ready Song Video'),
    video('bbbbbbbbbbb', 'Naa Ready Song Video Cover'),
    video('ccccccccccc', 'Making of the Song Video', 'Behind the Scenes'),
    video('ddddddddddd', 'Song Video', 'Clip', { official: false }),
    video('eeeeeeeeeee', 'Song Video Teaser', 'Trailer'),
  ]);
  assert.deepEqual(results.filter(v => v.kind === 'song').map(v => v.id), ['aaaaaaaaaaa']);
  assert.equal(results.find(v => v.id === 'aaaaaaaaaaa').format, 'Music video');
});
