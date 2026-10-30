import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type Title = {
  id: number; type: 'movie' | 'tv'; title: string; originalTitle: string;
  overview: string; language: string; year: string; poster: string | null;
  rating: number | null; genres: string[]; demo: boolean;
  cast: { id: number; name: string; character: string; image: string | null }[];
};
export type Video = {
  id: string; title: string; kind: 'song' | 'trailer' | 'teaser' | 'video';
  format: string; publisher: string | null; language: string; official: boolean; source: 'curated' | 'tmdb';
};
export type VideoCollection = { mode: 'demo' | 'tmdb'; videos: Video[]; trailerId: string | null; warning: string | null };
export type CataloguePage = { mode: 'demo' | 'tmdb'; titles: Title[]; page: number; pages: number };

function backendUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `http://${window.location.hostname}:4000`;
  return `http://${host || 'localhost'}:4000`;
}

export async function api<T>(path: string, method = 'GET', signal?: AbortSignal, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${backendUrl()}${path}`, { method, signal: signal || AbortSignal.timeout(15_000),
      ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Cannot reach the backend. Start “npm run server” on your computer and use the same Wi-Fi.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load this page.');
  return data;
}
