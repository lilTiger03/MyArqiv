import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AccountGate } from '@/components/account-gate';
import { AppShell, Message, openTitle, palette, ui } from '@/components/catalogue-ui';
import { useAccountResource } from '@/hooks/use-account-resource';
import { recommendations, saveMedia, titleFromMedia, type Recommendation } from '@/lib/community';

function Inbox() {
  const load = useCallback(() => recommendations(), []);
  const resource = useAccountResource<Recommendation[]>(load, []);
  const [saved, setSaved] = useState<Set<string>>(new Set()); const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  async function save(row: Recommendation) {
    setBusy(row.id); setError('');
    try { await saveMedia(titleFromMedia(row), 'watchlist'); setSaved(previous => new Set([...previous, row.id])); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save this title.'); }
    finally { setBusy(''); }
  }
  return <>
    {resource.loading ? <ActivityIndicator color={palette.accent} accessibilityLabel="Loading recommendations" style={{ marginVertical: 30 }} />
      : resource.error ? <Message text={resource.error} retry={() => { void resource.reload(); }} />
        : resource.data.length ? resource.data.map(row => <View key={row.id} style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 18, marginBottom: 16, gap: 12 }}>
          <Text style={ui.meta}>From {row.sender?.display_name || 'a friend'} · @{row.sender?.username || 'friend'}</Text>
          <Text style={ui.sectionHeading}>{row.title}</Text><Text style={ui.meta}>{row.release_year} · {row.media_type === 'movie' ? 'Film' : 'Series'}</Text>
          {row.note ? <Text style={ui.body}>“{row.note}”</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <Pressable accessibilityRole="button" onPress={() => openTitle(titleFromMedia(row))} style={ui.button}><Text style={ui.buttonText}>View title</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={Boolean(busy) || saved.has(row.id)} onPress={() => save(row)} style={{ minHeight: 46, justifyContent: 'center' }}><Text style={[ui.body, { color: palette.accent }]}>{busy === row.id ? 'Saving…' : saved.has(row.id) ? '✓ In watchlist' : '+ Add to watchlist'}</Text></Pressable>
          </View>
        </View>) : <Message text="A good recommendation starts with a friend. Yours will appear here when friends send you films or series." />}
    {error ? <Message text={error} /> : null}
  </>;
}
export default function RecommendationsScreen() {
  return <AppShell active="Profile"><Link href="/friends" replace style={[ui.body, { color: palette.accent, paddingVertical: 16 }]}>← Friends</Link>
    <Text style={ui.kicker}>A STORY WITH YOUR NAME ON IT</Text><Text style={ui.heading}>Your friends’{'\n'}<Text style={ui.editorial}>good taste.</Text></Text>
    <Text style={[ui.body, ui.introduction]}>Films and series your friends think you’ll love.</Text>
    <AccountGate><Inbox /></AccountGate></AppShell>;
}
