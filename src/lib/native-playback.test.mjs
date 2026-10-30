import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNativePlayback, clipSeekTime, clipTime } from './native-playback.ts';

test('all previous players pause before the next selected clip starts, including late registration', () => {
  const playback = createNativePlayback();
  const events = [];
  const player = name => ({ play: () => events.push(`${name}:play`), pause: () => events.push(`${name}:pause`) });
  const removeA = playback.register(0, player('a'));
  playback.select(0);
  playback.register(1, player('b'));
  events.length = 0;
  playback.select(1);
  assert.deepEqual(events, ['a:pause', 'b:pause', 'b:play']);
  events.length = 0;
  playback.select(null);
  assert.deepEqual(events, ['a:pause', 'b:pause']);
  removeA();
  events.length = 0;
  playback.select(0);
  assert.deepEqual(events, ['b:pause']);
  playback.register(0, player('c'));
  assert.deepEqual(events.slice(-2), ['c:pause', 'c:play']);
});

test('unregistering a replaced view cannot remove its replacement or leave it playing', () => {
  const playback = createNativePlayback();
  const events = [];
  const old = { play: () => events.push('old play'), pause: () => events.push('old pause') };
  const replacement = { play: () => events.push('new play'), pause: () => events.push('new pause') };
  const remove = playback.register(0, old);
  playback.select(0);
  playback.register(0, replacement);
  remove();
  events.length = 0;
  playback.select(0);
  assert.deepEqual(events, ['new pause', 'new play']);
});


test('manual pause survives focus loss and seeking; a different page autoplays', () => {
  const playback = createNativePlayback();
  const events = [];
  for (let index = 0; index < 2; index++) playback.register(index, {
    play: () => events.push(`${index}:play`), pause: () => events.push(`${index}:pause`), seek: time => events.push(`${index}:seek:${time}`),
  });
  playback.select(0); playback.toggle(0);
  assert.equal(playback.snapshot().paused, true);
  events.length = 0;
  playback.seek(0, 25);
  assert.deepEqual(events, ['0:seek:25']);
  playback.select(null); playback.select(0);
  assert.equal(playback.snapshot().paused, true);
  assert.equal(events.some(event => event.endsWith(':play')), false);
  events.length = 0;
  playback.select(1);
  assert.equal(playback.snapshot().paused, false);
  assert.deepEqual(events, ['0:pause', '1:pause', '1:play']);
});

test('scrubbing pauses playback, preserves manual pause and cannot restart a hidden page', () => {
  const playback = createNativePlayback(); const events = [];
  playback.register(0, { play: () => events.push('play'), pause: () => events.push('pause'), seek: time => events.push(`seek:${time}`) });
  playback.select(0); events.length = 0;
  playback.scrub(0, true); playback.seek(0, 35); playback.scrub(0, false);
  assert.deepEqual(events, ['pause', 'seek:35', 'play']);
  playback.toggle(0); events.length = 0;
  playback.scrub(0, true); playback.seek(0, 5); playback.scrub(0, false);
  assert.deepEqual(events, ['pause', 'seek:5']);
  playback.toggle(0); playback.scrub(0, true); playback.select(null); events.length = 0;
  playback.seek(0, 20); playback.scrub(0, false); playback.toggle(0);
  assert.deepEqual(events, []);
  assert.equal(playback.snapshot().scrubbing, false);
});

test('seeking clamps to the video and invalid metadata cannot produce a broken scrubber', () => {
  assert.equal(clipSeekTime(-10, 60), 0);
  assert.equal(clipSeekTime(100, 60), 60);
  assert.equal(clipSeekTime(12.5, 60), 12.5);
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.equal(clipSeekTime(value, 60), 0);
    assert.equal(clipSeekTime(10, value), 0);
  }
  assert.equal(clipTime(65.8), '1:05');
  assert.equal(clipTime(NaN), '0:00');
  assert.equal(clipTime(-5), '0:00');
});
