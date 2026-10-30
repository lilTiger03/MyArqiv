export type ClipPlaybackState = { index: number; owner: number | null; height: number; enabled: boolean };
type Scheduler = { later: (work: () => void) => unknown; cancel: (handle: unknown) => void };

/** One playback owner. Scroll activity revokes its lease before a settled page can acquire it. */
export function createClipPlayback(count: number, changed: (state: ClipPlaybackState) => void, scheduler?: Scheduler) {
  const clock = scheduler || { later: (work: () => void) => setTimeout(work, 140), cancel: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>) };
  let index = 0; let height = 0; let offset = 0;
  let focused = false; let foreground = false; let scrolling = false; let enabled = true; let disposed = false;
  let timer: unknown; let generation = 0;
  let previous = '';
  function cancel() { generation++; if (timer !== undefined) clock.cancel(timer); timer = undefined; }
  function snapshot(): ClipPlaybackState {
    const onPage = height >= 200 && Math.abs(offset - index * height) <= 2;
    return { index, height, enabled, owner: count > 0 && onPage && focused && foreground && !scrolling && enabled && !disposed ? index : null };
  }
  function publish() {
    if (disposed) return;
    const next = snapshot(); const signature = JSON.stringify(next);
    if (signature !== previous) { previous = signature; changed(next); }
  }
  function settle(y: number) {
    if (!Number.isFinite(y) || height <= 0) return;
    offset = Math.max(0, Math.min(y, Math.max(0, count - 1) * height));
    index = Math.max(0, Math.min(count - 1, Math.round(offset / height)));
    scrolling = false; publish();
  }
  return {
    get state() { return snapshot(); },
    viewport(next: number) {
      if (!Number.isFinite(next) || next <= 0 || Math.abs(next - height) < 1) return;
      cancel(); height = next; offset = index * height; scrolling = false; publish();
    },
    focus(value: boolean) { focused = value; if (!value) cancel(); publish(); },
    foreground(value: boolean) { foreground = value; if (!value) cancel(); publish(); },
    enable(value: boolean) { enabled = value; publish(); },
    begin() { cancel(); scrolling = true; publish(); },
    scroll(y: number) {
      if (disposed || !Number.isFinite(y)) return;
      cancel(); offset = y; scrolling = true; publish();
      const revision = generation;
      timer = clock.later(() => { if (!disposed && revision === generation) { timer = undefined; settle(y); } });
    },
    settle(y: number) { cancel(); settle(y); },
    dispose() { cancel(); disposed = true; },
  };
}

/** Keep the upload uncropped inside YouTube's minimum 200 × 200 player viewport. */
export function fitClipPlayer(width: number, height: number, orientation: 'portrait' | 'landscape') {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 200 || height < 200) return null;
  const ratio = orientation === 'portrait' ? 9 / 16 : 16 / 9;
  const naturalWidth = Math.min(width, height * ratio);
  return { width: Math.max(200, naturalWidth), height: Math.max(200, naturalWidth / ratio) };
}
