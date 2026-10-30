import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import type { Title } from '@/lib/catalogue';
import { friendsWhoWatched, recommend, relationships, type AccountProfile, type Friend } from '@/lib/community';
import { useAccountResource } from '@/hooks/use-account-resource';
import { useAuth } from '@/context/auth';
import { Message, SectionTitle, palette, ui } from './catalogue-ui';

function FriendsForTitle({ title }: { title: Title }) {
  const load = useCallback(async () => {
    const [friends, watched] = await Promise.all([relationships(), friendsWhoWatched(title)]);
    return { friends: friends.filter(row => row.relationship.status === 'accepted'), watched };
  }, [title]);
  const resource = useAccountResource<{ friends: Friend[]; watched: AccountProfile[] }>(load, { friends: [], watched: [] });
  const [picker, setPicker] = useState(false); const [recipient, setRecipient] = useState(''); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  async function send() {
    setBusy(true); setError(''); setNotice('');
    try {
      await recommend(title, recipient, note);
      setNotice(`Recommended to ${resource.data.friends.find(row => row.profile.id === recipient)?.profile.display_name || 'your friend'}.`);
      setPicker(false); setRecipient(''); setNote('');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not send recommendation.'); }
    finally { setBusy(false); }
  }
  return <View style={{ marginTop: 28 }}><SectionTitle title="With your people" />
    {resource.loading ? <ActivityIndicator color={palette.accent} accessibilityLabel="Loading friends’ watched status" />
      : resource.error ? <Message text={resource.error} retry={() => { void resource.reload(); }} /> : <>
        {resource.data.watched.length ? <View style={{ gap: 8, marginBottom: 16 }}>{resource.data.watched.map(friend => <Link key={friend.id} href={{ pathname: '/friend/[id]', params: { id: friend.id } }} style={[ui.body, { color: palette.accent }]}>{friend.display_name} marked this as watched →</Link>)}</View>
          : <Text style={[ui.body, { marginBottom: 16 }]}>No friends have shared a watched status for this title yet.</Text>}
        {resource.data.friends.length ? <Pressable accessibilityRole="button" onPress={() => { setPicker(value => !value); setNotice(''); }} style={[ui.chip, { alignSelf: 'flex-start' }]}><Text style={[ui.chipText, { color: palette.accent }]}>{picker ? 'Cancel recommendation' : 'Recommend to a friend'}</Text></Pressable>
          : <Link href="/friends" style={[ui.body, { color: palette.accent, paddingVertical: 12 }]}>Add friends to share recommendations →</Link>}
        {picker && <View style={{ gap: 12, marginTop: 16 }}>
          <Text style={ui.body}>Choose a friend</Text>
          <View style={ui.chips}>{resource.data.friends.map(({ profile }) => <Pressable key={profile.id} accessibilityRole="button" accessibilityState={{ selected: recipient === profile.id }} disabled={busy}
            onPress={() => setRecipient(profile.id)} style={[ui.chip, recipient === profile.id && ui.chipActive]}><Text style={[ui.chipText, recipient === profile.id && ui.selectedText]}>{profile.display_name}</Text></Pressable>)}</View>
          <View style={ui.searchBox}><TextInput value={note} onChangeText={setNote} maxLength={280} multiline editable={!busy} accessibilityLabel="Recommendation note" placeholder="Why do you think they’ll like it? (optional)" placeholderTextColor={palette.muted} style={ui.input} /></View>
          <Pressable accessibilityRole="button" disabled={!recipient || busy} onPress={send} style={[ui.button, (!recipient || busy) && ui.pressed]}><Text style={ui.buttonText}>{busy ? 'Sending…' : 'Send recommendation'}</Text></Pressable>
        </View>}
      </>}
    {notice ? <Text style={[ui.notice, { marginTop: 16 }]} accessibilityLiveRegion="polite">{notice}</Text> : null}
    {error ? <Message text={error} /> : null}
  </View>;
}
export function TitleCommunity({ title }: { title: Title }) {
  const auth = useAuth();
  if (!auth.profile) return <Link href={auth.session ? '/onboarding' : '/auth'} style={[ui.body, { color: palette.accent, paddingVertical: 20 }]}>Sign in to recommend this to friends →</Link>;
  return <FriendsForTitle title={title} />;
}
