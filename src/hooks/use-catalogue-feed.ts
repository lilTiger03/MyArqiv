import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { api, type CataloguePage } from '@/lib/catalogue';
import { createCatalogueFeed, filterKey, type FeedFilters } from '@/lib/catalogue-feed';

export function useCatalogueFeed(type: FeedFilters['type'], language: string, query: string) {
  const feed = useMemo(() => createCatalogueFeed((filters, page, signal) => {
    const params = new URLSearchParams({ ...filters, page: String(page) });
    return api<CataloguePage>(`/titles?${params}`, 'GET', signal);
  }), []);
  const trimmed = query.trim();
  const key = filterKey({ type, language, query: trimmed });
  useEffect(() => {
    feed.reset({ type, language, query: trimmed });
    return () => feed.cancel();
  }, [feed, type, language, trimmed]);
  const snapshot = useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot);
  const state = snapshot.key === key ? snapshot : { ...snapshot, key, titles: [], page: 0, pages: 1, status: 'loading' as const, error: '' };
  return { ...state, loadMore: feed.loadMore, retry: feed.retry };
}
