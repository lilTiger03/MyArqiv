import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { playerHtml, youtubeUrl, playerError } from './youtube.ts';

test('player rejects malformed video IDs and unsafe origins', () => {
  for (const id of ['bad', "x';alert(1)", '../abcdefghijk']) {
    assert.throws(() => youtubeUrl(id));
    assert.throws(() => playerHtml(id, 'https://host.exp.exponent'));
  }
  for (const origin of ['javascript:alert(1)', 'https://app.example/path', 'https://app.example/<script>']) {
    assert.throws(() => playerHtml('abcdefghijk', origin));
  }
});

test('player uses official embed API, app origin, visible controls and click-to-play', () => {
  const html = playerHtml('abcdefghijk', 'https://host.exp.exponent');
  assert.ok(html.includes('https://www.youtube.com/iframe_api'));
  assert.ok(html.includes('strict-origin-when-cross-origin'));
  assert.ok(html.includes('origin:"https://host.exp.exponent"'));
  assert.ok(html.includes('autoplay:0'));
  assert.ok(html.includes('onError:'));
  assert.equal(html.includes('controls:0'), false);
  assert.equal(youtubeUrl('abcdefghijk'), 'https://www.youtube.com/watch?v=abcdefghijk');
});

test('blocked, removed and unidentified players give actionable fallback messages', () => {
  assert.ok(playerError(101).includes('owner'));
  assert.equal(playerError(150), playerError(101));
  assert.ok(playerError(100).includes('removed'));
  assert.ok(playerError(153).includes('identify'));
  assert.ok(playerError(0).includes('YouTube'));
});


test('native autoplay mutes before playing and forwards blocked/state events; hidden pages pause', () => {
  const messages = []; const calls = []; const listeners = new Map(); let options;
  const player = { mute: () => calls.push('mute'), playVideo: () => calls.push('play'), pauseVideo: () => calls.push('pause'), destroy: () => calls.push('destroy') };
  const window = { ReactNativeWebView: { postMessage: data => messages.push(JSON.parse(data)) }, addEventListener: (name, callback) => listeners.set(name, callback) };
  const document = { hidden: false, createElement: () => ({}), head: { appendChild: () => {} }, addEventListener: (name, callback) => listeners.set(name, callback) };
  const sandbox = { window, document, YT: { Player: class { constructor(_id, config) { options = config; return player; } } } };
  const html = playerHtml('abcdefghijk', 'https://host.exp.exponent', { autoplay: true, muted: true });
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], sandbox);
  sandbox.onYouTubeIframeAPIReady(); options.events.onReady({ target: player });
  assert.deepEqual(calls, ['mute', 'play']);
  assert.equal(options.playerVars.autoplay, 0);
  options.events.onAutoplayBlocked(); options.events.onStateChange({ data: 1 });
  assert.deepEqual(messages.map(message => message.event), ['ready', 'blocked', 'state']);
  document.hidden = true; listeners.get('visibilitychange')(); listeners.get('pagehide')();
  assert.deepEqual(calls, ['mute', 'play', 'pause', 'destroy']);
});
