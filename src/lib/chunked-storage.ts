type Store = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};
type Manifest = { version: string; count: number };
let sequence = 0;
function parse(value: string | null): Manifest | null {
  if (!value) return null;
  try {
    const data = JSON.parse(value);
    return typeof data.version === 'string' && /^[a-z0-9-]+$/.test(data.version)
      && Number.isInteger(data.count) && data.count > 0 && data.count < 200 ? data : null;
  } catch { return null; }
}

/** Commit a manifest last, so an interrupted refresh never replaces a valid session. */
export function chunkedStorage(store: Store) {
  async function discard(key: string, manifest: Manifest | null) {
    if (manifest) await Promise.allSettled(Array.from({ length: manifest.count }, (_, i) => store.removeItem(`${key}.${manifest.version}.${i}`)));
  }
  return {
    async getItem(key: string) {
      const manifest = parse(await store.getItem(key));
      if (!manifest) return null;
      const chunks = await Promise.all(Array.from({ length: manifest.count }, (_, i) => store.getItem(`${key}.${manifest.version}.${i}`)));
      return chunks.some(chunk => chunk === null) ? null : chunks.join('');
    },
    async setItem(key: string, value: string) {
      const old = parse(await store.getItem(key));
      const version = `${Date.now().toString(36)}-${(++sequence).toString(36)}`;
      // Unicode code points keep surrogate pairs intact; each chunk is at most 1 KiB UTF-8.
      const characters = Array.from(value);
      const chunks: string[] = [];
      for (let i = 0; i < characters.length; i += 256) chunks.push(characters.slice(i, i + 256).join(''));
      if (!chunks.length || chunks.length >= 200) throw new Error('Session is too large to store.');
      const next = { version, count: chunks.length };
      try {
        const writes = await Promise.allSettled(chunks.map((chunk, i) => store.setItem(`${key}.${version}.${i}`, chunk)));
        const failure = writes.find(result => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
        await store.setItem(key, JSON.stringify(next));
      } catch (failure) { await discard(key, next); throw failure; }
      // Orphan cleanup must not turn a successful committed refresh into a failed sign-in.
      await discard(key, old);
    },
    async removeItem(key: string) {
      const old = parse(await store.getItem(key));
      await store.removeItem(key);
      await discard(key, old);
    },
  };
}
