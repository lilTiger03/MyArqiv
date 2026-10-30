import { Link, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AccountGate } from '@/components/account-gate';
import { AppShell, Icon, Message, SectionTitle, palette, ui } from '@/components/catalogue-ui';
import { useAuth } from '@/context/auth';
import { useAccountResource } from '@/hooks/use-account-resource';
import { collection, editProfile, relationships } from '@/lib/community';
import { accountClient } from '@/lib/supabase';

function PersonalProfile() {
  const auth = useAuth(); const profile = auth.profile!;
  const [name, setName] = useState(profile.display_name); const [share, setShare] = useState(profile.share_watched);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    const [watched, watchlist, friends] = await Promise.all([collection('watched'), collection('watchlist'), relationships()]);
    return { watched: watched.length, films: watched.filter(row => row.media_type === 'movie').length,
      series: watched.filter(row => row.media_type === 'tv').length, watchlist: watchlist.length,
      friends: friends.filter(row => row.relationship.status === 'accepted').length };
  }, []);
  const resource = useAccountResource(load, { watched: 0, films: 0, series: 0, watchlist: 0, friends: 0 });
  async function save() {
    setBusy(true); setError(''); setSaved(false);
    try { await editProfile(name, share); await auth.refreshProfile(); setSaved(true); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save profile.'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError('');
    try { const { error: failure } = await accountClient().auth.signOut({ scope: 'local' }); if (failure) throw failure; router.replace('/'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not sign out.'); }
    finally { setBusy(false); }
  }
  const changed = name.trim() !== profile.display_name || share !== profile.share_watched;
  return <>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28 }}>
      <View style={[ui.brandMark, { width: 56, height: 56, borderRadius: 28 }]}><Icon name="profile" size={30} color={palette.accent} /></View>
      <View><Text style={ui.sectionHeading}>{profile.display_name}</Text><Text style={ui.meta}>@{profile.username}</Text></View>
    </View>
    {resource.loading ? <ActivityIndicator color={palette.accent} accessibilityLabel="Loading collection totals" /> : resource.error ? <Message text={resource.error} retry={() => { void resource.reload(); }} /> : <>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        <Link href="/library" replace asChild><Pressable accessibilityRole="link" style={StyleSheet.flatten([ui.message, { flex: 1, backgroundColor: palette.panel, borderRadius: 12, padding: 18 }])}>
          <Text style={[ui.heading, { marginBottom: 0 }]}>{resource.data.watched}</Text><Text style={ui.body}>Watched</Text><Text style={ui.meta}>{resource.data.films} films · {resource.data.series} series</Text>
        </Pressable></Link>
        <Link href="/watchlist" replace asChild><Pressable accessibilityRole="link" style={StyleSheet.flatten([ui.message, { flex: 1, backgroundColor: palette.panel, borderRadius: 12, padding: 18 }])}>
          <Text style={[ui.heading, { marginBottom: 0 }]}>{resource.data.watchlist}</Text><Text style={ui.body}>In watchlist</Text><Text style={ui.meta}>For another night</Text>
        </Pressable></Link>
      </View>
      <Link href="/friends" style={[ui.body, { color: palette.accent, paddingVertical: 16 }]}>{resource.data.friends} friends · Find your people →</Link>
    </>}
    <Link href="/recommendations" style={[ui.body, { color: palette.accent, paddingVertical: 12, marginBottom: 20 }]}>Recommendations from friends →</Link>
    <SectionTitle title="Make it yours" />
    <Text style={[ui.body, { marginBottom: 8 }]}>Display name</Text>
    <View style={ui.searchBox}><TextInput value={name} onChangeText={value => { setName(value); setSaved(false); }} accessibilityLabel="Display name" style={ui.input} editable={!busy} maxLength={80} autoCorrect={false} /></View>
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 16 }}><Text style={[ui.body, { flex: 1 }]}>Share watched titles with accepted friends</Text>
      <Switch value={share} onValueChange={value => { setShare(value); setSaved(false); }} disabled={busy} accessibilityLabel="Share watched history with friends" trackColor={{ true: palette.accent }} /></View>
    <Text style={[ui.meta, { marginBottom: 20 }]}>Your Watchlist always stays private. Turning this off hides your watched history and per-title watched status from friends.</Text>
    <Pressable accessibilityRole="button" disabled={busy || !name.trim() || !changed} onPress={save} style={[ui.button, (busy || !name.trim() || !changed) && ui.pressed]}><Text style={ui.buttonText}>{busy ? 'One moment…' : 'Save profile'}</Text></Pressable>
    {saved ? <Text style={[ui.meta, { color: palette.accent, marginTop: 12 }]} accessibilityLiveRegion="polite">Profile saved.</Text> : null}
    {error ? <Message text={error} /> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={signOut} style={{ minHeight: 48, justifyContent: 'center', marginTop: 24 }}><Text style={[ui.body, { color: palette.accent }]}>Sign out of this device</Text></Pressable>
  </>;
}
export default function ProfileScreen() {
  return <AppShell active="Profile"><Text style={ui.kicker}>YOUR LIFE IN STORIES</Text>
    <Text style={ui.heading}>A world of cinema.{'\n'}<Text style={ui.editorial}>Your own corner.</Text></Text>
    <Text style={[ui.body, ui.introduction]}>Your collection, your people and stories worth sharing.</Text>
    <AccountGate><PersonalProfile /></AccountGate>
    <Link href="/explore" style={[ui.body, { color: palette.accent, paddingVertical: 20, marginTop: 12 }]}>About myArqiv →</Link>
  </AppShell>;
}
