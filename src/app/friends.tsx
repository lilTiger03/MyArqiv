import { Link } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { AccountGate } from '@/components/account-gate';
import { AppShell, Message, SectionTitle, palette, ui } from '@/components/catalogue-ui';
import { useAuth } from '@/context/auth';
import { useAccountResource } from '@/hooks/use-account-resource';
import { acceptFriend, findPeople, relationships, removeFriend, requestFriend, type AccountProfile, type Friend } from '@/lib/community';

function FriendsContent() {
  const me = useAuth().profile!.id;
  const load = useCallback(() => relationships(), []);
  const resource = useAccountResource<Friend[]>(load, []);
  const [query, setQuery] = useState(''); const [people, setPeople] = useState<AccountProfile[]>([]);
  const [searching, setSearching] = useState(false); const [searched, setSearched] = useState(false); const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (query.trim().length < 2) return;
      setSearching(true);
      findPeople(query).then(result => { if (active) { setPeople(result); setSearched(true); } })
        .catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setSearching(false); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);
  async function action(id: string, work: () => Promise<void>) {
    setBusy(id); setError('');
    try { await work(); await resource.reload(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update this friendship.'); }
    finally { setBusy(''); }
  }
  const accepted = resource.data.filter(item => item.relationship.status === 'accepted');
  const incoming = resource.data.filter(item => item.relationship.status === 'pending' && item.relationship.requested_by !== me);
  const outgoing = resource.data.filter(item => item.relationship.status === 'pending' && item.relationship.requested_by === me);
  function person(profile: AccountProfile, controls: ReactNode) {
    return <View key={profile.id} style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: 16, gap: 12 }}>
      <View><Text style={ui.sectionHeading}>{profile.display_name}</Text><Text style={ui.meta}>@{profile.username}</Text></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>{controls}</View>
    </View>;
  }
  function button(label: string, id: string, work: () => Promise<void>) {
    return <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={() => action(id, work)} style={[ui.chip, busy && ui.pressed]}>
      <Text style={[ui.chipText, { color: palette.accent }]}>{busy === id ? 'Updating…' : label}</Text></Pressable>;
  }
  return <>
    <Link href="/recommendations" style={[ui.body, { color: palette.accent, paddingVertical: 16 }]}>Recommendations from friends →</Link>
    <SectionTitle title="Find your people" />
    <View style={ui.searchBox}><TextInput value={query} onChangeText={value => { setQuery(value.toLowerCase()); setPeople([]); setSearching(false); setSearched(false); setError(''); }} accessibilityLabel="Find friends by username"
      placeholder="Search usernames…" placeholderTextColor={palette.muted} autoCapitalize="none" autoCorrect={false} maxLength={24} style={ui.input} /></View>
    <Text style={[ui.meta, { marginBottom: 12 }]}>Enter at least 2 letters. Search uses usernames, never email addresses.</Text>
    {searching && <ActivityIndicator accessibilityLabel="Finding people" color={palette.accent} />}
    {people.map(profile => {
      const existing = resource.data.find(item => item.profile.id === profile.id);
      return person(profile, existing ? <Text style={ui.body}>{existing.relationship.status === 'accepted' ? 'Already friends' : 'Friend request pending'}</Text>
        : button('Add friend', profile.id, () => requestFriend(profile.id)));
    })}
    {query.trim().length >= 2 && searched && !searching && people.length === 0 && <Text style={ui.meta}>No matching usernames shown.</Text>}
    {error ? <Message text={error} /> : null}
    {resource.error ? <Message text={resource.error} retry={() => { void resource.reload(); }} /> : null}
    {resource.loading && <ActivityIndicator accessibilityLabel="Loading friends" color={palette.accent} style={{ marginVertical: 20 }} />}
    {incoming.length > 0 && <View style={{ marginVertical: 20 }}><SectionTitle title="Friend requests" caption={`${incoming.length} incoming`} />
      {incoming.map(({ profile }) => person(profile, <>{button('Accept', profile.id, () => acceptFriend(profile.id))}{button('Decline', profile.id, () => removeFriend(profile.id))}</>))}</View>}
    <View style={{ marginTop: 24 }}><SectionTitle title="My friends" caption={`${accepted.length} friends`} />
      {accepted.length ? accepted.map(({ profile }) => person(profile, <>
        <Link href={{ pathname: '/friend/[id]', params: { id: profile.id } }} style={[ui.body, { color: palette.accent, paddingVertical: 10 }]}>View watched titles →</Link>
        {button('Remove friend', profile.id, () => removeFriend(profile.id))}</>))
        : !resource.loading && <Text style={ui.body}>Find a friend by username and send a request. You’ll connect when they accept.</Text>}
    </View>
    {outgoing.length > 0 && <View style={{ marginTop: 24 }}><SectionTitle title="Requests you sent" />
      {outgoing.map(({ profile }) => person(profile, button('Cancel request', profile.id, () => removeFriend(profile.id))))}</View>}
  </>;
}
export default function FriendsScreen() {
  return <AppShell active="Profile"><Text style={ui.kicker}>BETTER WITH YOUR PEOPLE</Text>
    <Text style={ui.heading}>Good stories.{'\n'}<Text style={ui.editorial}>Good company.</Text></Text>
    <Text style={[ui.body, ui.introduction]}>Connect with friends and find out what they’ve been watching.</Text>
    <AccountGate><FriendsContent /></AccountGate>
  </AppShell>;
}
