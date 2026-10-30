import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AccountGate } from '@/components/account-gate';
import { AppShell, Message, MovieCard, SectionTitle, palette, ui } from '@/components/catalogue-ui';
import { useAccountResource } from '@/hooks/use-account-resource';
import { collection, relationships, titleFromMedia, type AccountProfile, type MediaRow } from '@/lib/community';

function FriendLibrary({ id }: { id: string }) {
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const load = useCallback(async () => {
    const friend = (await relationships()).find(row => row.profile.id === id && row.relationship.status === 'accepted');
    if (!friend) throw new Error('Watched history is available only after you both accept a friend request.');
    return { profile: friend.profile, rows: await collection('watched', id) };
  }, [id]);
  const resource = useAccountResource<{ profile: AccountProfile | null; rows: MediaRow[] }>(load, { profile: null, rows: [] });
  const visible = resource.data.rows.filter(row => filter === 'all' || row.media_type === filter);
  if (resource.loading) return <ActivityIndicator color={palette.accent} accessibilityLabel="Loading friend’s library" style={{ marginVertical: 30 }} />;
  if (resource.error) return <Message text={resource.error} retry={() => { void resource.reload(); }} />;
  return <><Text style={ui.heading}>{resource.data.profile?.display_name}</Text><Text style={[ui.body, ui.introduction]}>@{resource.data.profile?.username}</Text>
    <SectionTitle title="Marked as watched" caption={resource.data.profile?.share_watched ? `${visible.length} titles` : undefined} />
    {!resource.data.profile?.share_watched ? <Message text="Your friend is keeping watched history private." /> : <>
      <View style={ui.chips}>{(['all', 'movie', 'tv'] as const).map(option => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: filter === option }} onPress={() => setFilter(option)} style={[ui.chip, filter === option && ui.chipActive]}>
        <Text style={[ui.chipText, filter === option && ui.selectedText]}>{option === 'all' ? 'All stories' : option === 'movie' ? 'Films' : 'Series'}</Text></Pressable>)}</View>
      {visible.length ? <View style={ui.grid}>{visible.map(row => <MovieCard key={`${row.source_mode}:${row.media_type}:${row.media_id}`} item={titleFromMedia(row)} />)}</View>
        : <Text style={ui.body}>No watched titles shared in this category yet.</Text>}
    </>}
  </>;
}
export default function FriendScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AppShell active="Profile"><Link href="/friends" replace style={[ui.body, { color: palette.accent, paddingVertical: 16 }]}>← Friends</Link>
    <AccountGate><FriendLibrary id={id} /></AccountGate></AppShell>;
}
