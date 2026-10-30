import test from 'node:test';
import assert from 'node:assert/strict';
import { createClipPlayback, fitClipPlayer } from './clip-playback.ts';
function fixture() {
  const pending = []; const changes = [];
  const controller = createClipPlayback(3, state => changes.push(state), {
    later: work => { const task = { work, cancelled: false }; pending.push(task); return task; },
    cancel: task => { task.cancelled = true; },
  });
  controller.viewport(600); controller.focus(true); controller.foreground(true);
  return { controller, changes, pending, finish: () => pending.filter(task => !task.cancelled).forEach(task => task.work()) };
}
test('scroll revokes playback immediately and only a settled full page acquires it', () => {
  const { controller, finish } = fixture();
  assert.equal(controller.state.owner, 0);
  controller.begin(); assert.equal(controller.state.owner, null);
  controller.scroll(320); finish(); assert.equal(controller.state.owner, null);
  controller.scroll(600); finish(); assert.equal(controller.state.owner, 1);
  controller.scroll(1200); finish(); assert.equal(controller.state.owner, 2);
});
test('late scroll callbacks cannot revive an old page, background playback or a disposed screen', () => {
  const { controller, pending } = fixture();
  controller.scroll(600); const stale = pending.at(-1);
  controller.scroll(1200); stale.work(); assert.equal(controller.state.owner, null);
  pending.at(-1).work(); assert.equal(controller.state.owner, 2);
  controller.scroll(600); const delayed = pending.at(-1);
  controller.focus(false); delayed.work(); assert.equal(controller.state.owner, null);
  controller.focus(true); controller.settle(600); assert.equal(controller.state.owner, 1);
  controller.foreground(false); assert.equal(controller.state.owner, null);
  controller.foreground(true); assert.equal(controller.state.owner, 1);
  controller.scroll(1200); const afterUnmount = pending.at(-1);
  controller.dispose(); afterUnmount.work(); assert.equal(controller.state.owner, null);
});
test('pause, resume, resizing, overscroll and invalid offsets preserve a valid single owner', () => {
  const { controller } = fixture();
  controller.settle(600); controller.enable(false); assert.equal(controller.state.owner, null);
  controller.enable(true); assert.equal(controller.state.owner, 1);
  controller.viewport(480); assert.equal(controller.state.index, 1); assert.equal(controller.state.owner, 1);
  controller.settle(-60); assert.equal(controller.state.owner, 0);
  controller.settle(5000); assert.equal(controller.state.owner, 2);
  controller.scroll(NaN); assert.equal(controller.state.owner, 2);
  const empty = createClipPlayback(0, () => {});
  empty.viewport(600); empty.focus(true); empty.foreground(true); assert.equal(empty.state.owner, null);
});


test('compact portrait and landscape players fit a narrow phone without violating the minimum viewport', () => {
  for (const orientation of ['portrait', 'landscape']) {
    for (const [width, height] of [[288, 205], [328, 270], [358, 400], [728, 600]]) {
      const player = fitClipPlayer(width, height, orientation);
      assert.ok(player.width >= 200 && player.height >= 200);
      assert.ok(player.width <= width && player.height <= height);
    }
  }
  assert.equal(fitClipPlayer(180, 400, 'portrait'), null);
  assert.equal(fitClipPlayer(400, 180, 'landscape'), null);
  assert.deepEqual(fitClipPlayer(288, 205, 'landscape'), { width: 288, height: 200 });
});
