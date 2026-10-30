import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { collection, titleFromMedia, type MediaRow } from '@/lib/community';
import { useAccountResource } from '@/hooks/use-account-resource';
import { AccountGate } from './account-gate';
import { AppShell, Message, MovieCard, SectionTitle, palette, ui } from './catalogue-ui';

function CollectionContent({ kind }: { kind: 'watchlist' | 'watched' }) {
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const load = useCallback(() => collection(kind), [kind]);
  const resource = useAccountResource<MediaRow[]>(load, []);
  const visible = resource.data.filter(row => filter === 'all' || row.media_type === filter);
  return <>
    {kind === 'watched' && <View style={ui.chips}>{(['all', 'movie', 'tv'] as const).map(option => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: filter === option }} onPress={() => setFilter(option)} style={[ui.chip, filter === option && ui.chipActive]}>
      <Text style={[ui.chipText, filter === option && ui.selectedText]}>{option === 'all' ? 'All stories' : option === 'movie' ? 'Films' : 'Series'}</Text></Pressable>)}</View>}
    <SectionTitle title={kind === 'watched' ? 'My library' : 'My watchlist'} caption={resource.loading ? undefined : `${visible.length} ${kind === 'watched' ? 'watched' : 'saved'}`} />
    {resource.loading ? <ActivityIndicator color={palette.accent} accessibilityLabel="Loading collection" style={{ marginVertical: 30 }} />
      : resource.error ? <Message text={resource.error} retry={() => { void resource.reload(); }} />
        : visible.length ? <View style={ui.grid}>{visible.map(row => <MovieCard key={`${row.source_mode}:${row.media_type}:${row.media_id}`} item={titleFromMedia(row)} />)}</View>
          : <><Message text={kind === 'watched' ? 'Open a film or series and mark it as watched to keep it here.' : 'Find a film or series you’d love to watch and save it here.'} />
            <Link href="/" replace style={[ui.buttonText, { color: palette.accent, paddingVertical: 14 }]}>Discover a story →</Link></>}
    <Text style={[ui.meta, { marginTop: 20 }]}>{kind === 'watchlist' ? 'Your Watchlist is private to your account.' : 'Only accepted friends can see shared watched titles. Manage sharing in Profile.'}</Text>
  </>;
}
export function CollectionScreen({ kind }: { kind: 'watchlist' | 'watched' }) {
  const watched = kind === 'watched';
  return <AppShell active={watched ? 'Library' : 'Watchlist'}>
    <Text style={ui.kicker}>{watched ? 'STORIES THAT STAY WITH YOU' : 'SAVED FOR ANOTHER NIGHT'}</Text>
    <Text style={ui.heading}>{watched ? 'Seen it.' : 'Your next'}{'\n'}<Text style={ui.editorial}>{watched ? 'Kept it.' : 'great watch.'}</Text></Text>
    <Text style={[ui.body, ui.introduction]}>{watched ? 'Your watched films and series, all in one place.' : 'A little less searching. A lot more looking forward.'}</Text>
    <AccountGate><CollectionContent kind={kind} /></AccountGate>
  </AppShell>;
}
