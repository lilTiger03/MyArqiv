import { api, type Title } from './catalogue';
import { accountClient } from './supabase';

export type AccountProfile = { id: string; username: string; display_name: string; share_watched: boolean };
export type Friendship = { user_low: string; user_high: string; requested_by: string; status: 'pending' | 'accepted'; created_at: string };
export type Friend = { profile: AccountProfile; relationship: Friendship };
export type MediaRow = {
  user_id?: string; source_mode: 'demo' | 'tmdb'; media_type: 'movie' | 'tv'; media_id: number;
  title: string; original_language: string; release_year: string; poster_url: string | null; added_at?: string;
};
export type Recommendation = MediaRow & { id: string; sender_id: string; recipient_id: string; note: string; created_at: string; sender?: AccountProfile };
const profileColumns = 'id,username,display_name,share_watched';
const mediaColumns = 'user_id,source_mode,media_type,media_id,title,original_language,release_year,poster_url,added_at';
export function communityError(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (['42P01', 'PGRST205', 'PGRST202'].includes(error.code || '')) throw new Error('Account setup is not ready yet. Please try again later.');
  if (error.code === '23505') throw new Error('That username, friend request or recommendation already exists.');
  throw new Error(error.message || 'Could not update your account.');
}
export async function currentUserId() {
  const { data, error } = await accountClient().auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error('Sign in to continue.');
  return data.session.user.id;
}
export async function getProfile(id: string) {
  const { data, error } = await accountClient().from('profiles').select(profileColumns).eq('id', id).maybeSingle();
  communityError(error); return data as AccountProfile | null;
}
export async function createProfile(username: string, displayName: string, shareWatched: boolean) {
  const id = await currentUserId();
  const { error } = await accountClient().from('profiles').insert({ id, username: username.trim().toLowerCase(), display_name: displayName.trim(), share_watched: shareWatched });
  communityError(error);
}
export async function editProfile(displayName: string, shareWatched: boolean) {
  const id = await currentUserId();
  const { error } = await accountClient().from('profiles').update({ display_name: displayName.trim(), share_watched: shareWatched }).eq('id', id);
  communityError(error);
}
export function titleFromMedia(row: MediaRow): Title {
  return { id: row.media_id, type: row.media_type, title: row.title, originalTitle: row.title,
    overview: '', language: row.original_language, year: row.release_year, poster: row.poster_url,
    rating: null, genres: [], cast: [], demo: row.source_mode === 'demo' };
}
function snapshot(title: Title): MediaRow {
  return { source_mode: title.demo ? 'demo' : 'tmdb', media_type: title.type, media_id: title.id,
    title: title.title.slice(0, 300), original_language: title.language, release_year: title.year,
    poster_url: title.poster };
}
let modeCache: { mode: 'demo' | 'tmdb'; expires: number } | null = null;
let modeRequest: Promise<'demo' | 'tmdb'> | null = null;
async function catalogueMode() {
  if (modeCache && modeCache.expires > Date.now()) return modeCache.mode;
  if (!modeRequest) modeRequest = api<{ mode: 'demo' | 'tmdb' }>('/health').then(data => {
    modeCache = { mode: data.mode, expires: Date.now() + 15_000 }; return data.mode;
  }).finally(() => { modeRequest = null; });
  return modeRequest;
}
export async function collection(kind: 'watchlist' | 'watched', ownerId?: string) {
  const id = ownerId || await currentUserId();
  const mode = await catalogueMode();
  const { data, error } = await accountClient().from('user_media').select(mediaColumns)
    .eq('user_id', id).eq('source_mode', mode).eq('collection', kind).order('added_at', { ascending: false });
  communityError(error); return (data || []) as MediaRow[];
}
export async function saveMedia(title: Title, kind: 'watchlist' | 'watched') {
  const row = snapshot(title);
  const { error } = await accountClient().rpc('save_media', { p_collection: kind, p_source_mode: row.source_mode,
    p_media_type: row.media_type, p_media_id: row.media_id, p_title: row.title, p_original_language: row.original_language,
    p_release_year: row.release_year, p_poster_url: row.poster_url });
  communityError(error);
}
export async function removeMedia(title: Title, kind: 'watchlist' | 'watched') {
  const id = await currentUserId();
  const { error } = await accountClient().from('user_media').delete().eq('user_id', id).eq('collection', kind)
    .eq('source_mode', title.demo ? 'demo' : 'tmdb').eq('media_type', title.type).eq('media_id', title.id);
  communityError(error);
}
export async function titleMembership(title: Title) {
  const id = await currentUserId();
  const { data, error } = await accountClient().from('user_media').select('collection').eq('user_id', id)
    .eq('source_mode', title.demo ? 'demo' : 'tmdb').eq('media_type', title.type).eq('media_id', title.id);
  communityError(error);
  return { saved: data?.some(row => row.collection === 'watchlist') || false, watched: data?.some(row => row.collection === 'watched') || false };
}
export async function relationships(): Promise<Friend[]> {
  const id = await currentUserId();
  const { data, error } = await accountClient().from('friendships').select('*').or(`user_low.eq.${id},user_high.eq.${id}`);
  communityError(error);
  const rows = (data || []) as Friendship[];
  if (!rows.length) return [];
  const ids = rows.map(row => row.user_low === id ? row.user_high : row.user_low);
  const { data: profiles, error: profileError } = await accountClient().from('profiles').select(profileColumns).in('id', ids);
  communityError(profileError);
  return rows.flatMap(relationship => {
    const profile = (profiles as AccountProfile[]).find(item => item.id === (relationship.user_low === id ? relationship.user_high : relationship.user_low));
    return profile ? [{ profile, relationship }] : [];
  });
}
export async function findPeople(query: string) {
  const id = await currentUserId(); const prefix = query.trim().toLowerCase();
  if (!/^[a-z0-9_]{2,24}$/.test(prefix)) return [];
  const { data, error } = await accountClient().from('profiles').select(profileColumns)
    .ilike('username', `${prefix.replace(/_/g, '\\_')}%`).neq('id', id).limit(20);
  communityError(error); return (data || []) as AccountProfile[];
}
export async function requestFriend(other: string) {
  const id = await currentUserId();
  if (other === id) throw new Error('Choose another user.');
  const [user_low, user_high] = [id, other].sort();
  const { error } = await accountClient().from('friendships').insert({ user_low, user_high, requested_by: id });
  communityError(error);
}
export async function acceptFriend(other: string) {
  const { error } = await accountClient().rpc('accept_friend', { other_user: other }); communityError(error);
}
export async function removeFriend(other: string) {
  const id = await currentUserId(); const [low, high] = [id, other].sort();
  const { error } = await accountClient().from('friendships').delete().eq('user_low', low).eq('user_high', high); communityError(error);
}
export async function friendsWhoWatched(title: Title) {
  const id = await currentUserId();
  // RLS returns only the caller's rows and accepted friends who share watched history.
  const { data, error } = await accountClient().from('user_media').select('user_id').eq('collection', 'watched')
    .eq('source_mode', title.demo ? 'demo' : 'tmdb').eq('media_type', title.type).eq('media_id', title.id).neq('user_id', id);
  communityError(error);
  if (!data?.length) return [];
  const { data: profiles, error: profileError } = await accountClient().from('profiles').select(profileColumns).in('id', data.map(row => row.user_id));
  communityError(profileError); return (profiles || []) as AccountProfile[];
}
export async function recommend(title: Title, recipientId: string, note: string) {
  const sender = await currentUserId();
  const { error } = await accountClient().from('recommendations').insert({ ...snapshot(title), sender_id: sender, recipient_id: recipientId, note: note.trim() });
  communityError(error);
}
export async function recommendations() {
  const id = await currentUserId(); const mode = await catalogueMode();
  const { data, error } = await accountClient().from('recommendations').select('*').eq('recipient_id', id).eq('source_mode', mode).order('created_at', { ascending: false }).limit(50);
  communityError(error); const rows = (data || []) as Recommendation[];
  if (!rows.length) return rows;
  const { data: profiles, error: profileError } = await accountClient().from('profiles').select(profileColumns).in('id', [...new Set(rows.map(row => row.sender_id))]);
  communityError(profileError);
  return rows.map(row => ({ ...row, sender: (profiles as AccountProfile[]).find(profile => profile.id === row.sender_id) }));
}
