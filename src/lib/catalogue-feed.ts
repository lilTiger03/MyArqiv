import type { CataloguePage, Title } from './catalogue';

export type FeedFilters = { type: 'movie' | 'tv'; language: string; query: string };
export type FeedState = {
  key: string; titles: Title[]; page: number; pages: number;
  mode: 'demo' | 'tmdb' | null; status: 'loading' | 'ready' | 'more' | 'error'; error: string;
};
type FetchPage = (filters: FeedFilters, page: number, signal: AbortSignal) => Promise<CataloguePage>;
export const filterKey = (filters: FeedFilters) => JSON.stringify(filters);

/** One request at a time; a new filter generation cannot accept an old response. */
export function createCatalogueFeed(fetchPage: FetchPage, delay = 400) {
  let state: FeedState = { key: '', titles: [], page: 0, pages: 1, mode: null, status: 'loading', error: '' };
  let generation = 0;
  let busy = false;
  let filters: FeedFilters = { type: 'movie', language: '', query: '' };
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: FeedState) => { state = next; listeners.forEach(listener => listener()); };

  async function request(page: number) {
    if (busy) return;
    busy = true;
    const current = generation;
    controller = new AbortController();
    const signal = controller.signal;
    publish({ ...state, status: page === 1 ? 'loading' : 'more', error: '' });
    try {
      const result = await fetchPage(filters, page, signal);
      if (current !== generation || signal.aborted) return;
      if (result.page !== page) throw new Error('The film service returned an unexpected page. Please try again.');
      const unique = new Map<string, Title>();
      for (const title of [...state.titles, ...result.titles]) unique.set(`${title.type}:${title.id}`, title);
      publish({ ...state, titles: [...unique.values()], mode: result.mode, page,
        pages: Math.min(result.pages, 500), status: 'ready', error: '' });
    } catch (error) {
      if (current !== generation || signal.aborted) return;
      publish({ ...state, status: 'error', error: error instanceof Error ? error.message : 'Could not load more titles.' });
    } finally { if (current === generation) busy = false; }
  }

  function cancel() {
    generation++; clearTimeout(timer); controller?.abort(); busy = false;
  }
  function reset(next: FeedFilters) {
    cancel(); filters = next;
    publish({ key: filterKey(next), titles: [], page: 0, pages: 1, mode: null, status: 'loading', error: '' });
    timer = setTimeout(() => { void request(1); }, delay);
  }
  function loadMore() {
    if (!busy && state.status === 'ready' && state.page > 0 && state.page < state.pages) void request(state.page + 1);
  }
  function retry() {
    if (!busy && state.status === 'error') void request(state.page + 1);
  }
  return { reset, cancel, loadMore, retry, getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}
