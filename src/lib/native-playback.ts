export type FeedPlayer = { play: () => void; pause: () => void; seek?: (seconds: number) => void };
type PlaybackIntent = { owner: number | null; index: number | null; paused: boolean; scrubbing: boolean };

/** One audible player; manual pause and scrubbing never override screen ownership. */
export function createNativePlayback() {
  const players = new Map<number, FeedPlayer>();
  const listeners = new Set<() => void>();
  let state: PlaybackIntent = { owner: null, index: null, paused: false, scrubbing: false };
  function publish(next: PlaybackIntent) {
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    listeners.forEach(listener => listener());
  }
  function startOwner() {
    if (state.owner !== null && !state.paused && !state.scrubbing) players.get(state.owner)?.play();
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    select(index: number | null) {
      for (const player of players.values()) player.pause();
      const newPage = index !== null && index !== state.index;
      publish({ owner: index, index: index ?? state.index, paused: newPage ? false : state.paused, scrubbing: false });
      startOwner();
    },
    toggle(index: number) {
      if (state.owner !== index || state.scrubbing) return;
      publish({ ...state, paused: !state.paused });
      if (state.paused) players.get(index)?.pause(); else startOwner();
    },
    scrub(index: number, value: boolean) {
      if (value && state.owner !== index) return;
      if (!value && state.index !== index) return;
      publish({ ...state, scrubbing: value });
      if (value) players.get(index)?.pause(); else startOwner();
    },
    seek(index: number, seconds: number) {
      if (state.owner === index && Number.isFinite(seconds)) players.get(index)?.seek?.(seconds);
    },
    register(index: number, player: FeedPlayer) {
      players.get(index)?.pause(); player.pause(); players.set(index, player);
      if (state.owner === index && !state.paused && !state.scrubbing) player.play();
      return () => { player.pause(); if (players.get(index) === player) players.delete(index); };
    },
  };
}
export type NativePlayback = ReturnType<typeof createNativePlayback>;

export function clipSeekTime(seconds: number, duration: number) {
  return Number.isFinite(duration) && duration > 0 && Number.isFinite(seconds) ? Math.max(0, Math.min(seconds, duration)) : 0;
}
export function clipTime(seconds: number) {
  const value = Math.floor(Number.isFinite(seconds) ? Math.max(0, seconds) : 0);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
