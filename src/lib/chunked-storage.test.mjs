import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { chunkedStorage } from './chunked-storage.ts';

function fixture() {
  const values = new Map();
  const store = {
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { assert.ok(Buffer.byteLength(value) <= 1024); values.set(key, value); },
    removeItem: async key => { values.delete(key); },
  };
  return { values, store, storage: chunkedStorage(store) };
}
test('large Unicode sessions survive refresh and logout removes the session', async () => {
  const { values, storage } = fixture();
  const value = JSON.stringify({ access_token: 'a'.repeat(6000), display_name: '🎬தமிழ்'.repeat(100) });
  await storage.setItem('session', value);
  assert.equal(await storage.getItem('session'), value);
  await storage.setItem('session', 'refreshed');
  assert.equal(values.size, 2);
  assert.equal(await storage.getItem('session'), 'refreshed');
  await storage.removeItem('session');
  assert.equal(await storage.getItem('session'), null);
  assert.equal(values.size, 0);
});
test('failed chunk or manifest writes preserve the previous valid session', async () => {
  for (const failManifest of [false, true]) {
    const { store, values, storage } = fixture();
    await storage.setItem('session', 'previous');
    const write = store.setItem;
    store.setItem = async (key, value) => {
      if (failManifest ? key === 'session' : key.endsWith('.1')) throw new Error('storage unavailable');
      await write(key, value);
    };
    await assert.rejects(storage.setItem('session', 'b'.repeat(2000)), /storage unavailable/);
    assert.equal(await storage.getItem('session'), 'previous');
    assert.equal(values.size, 2);
  }
});
test('missing or invalid chunks never produce a partial authenticated session', async () => {
  const { storage, values } = fixture();
  await storage.setItem('session', 'a'.repeat(1000));
  const manifest = JSON.parse(values.get('session'));
  values.delete(`session.${manifest.version}.1`);
  assert.equal(await storage.getItem('session'), null);
  values.set('session', '{bad manifest');
  assert.equal(await storage.getItem('session'), null);
});
test('orphan cleanup failure does not reject a committed session or revive logout', async () => {
  const { store, storage } = fixture();
  await storage.setItem('session', 'previous');
  const remove = store.removeItem;
  store.removeItem = async key => { if (key !== 'session') throw new Error('cleanup failed'); await remove(key); };
  await storage.setItem('session', 'next');
  assert.equal(await storage.getItem('session'), 'next');
  await storage.removeItem('session');
  assert.equal(await storage.getItem('session'), null);
});
