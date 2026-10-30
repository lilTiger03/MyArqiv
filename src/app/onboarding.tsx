import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { AppShell, Message, palette, ui } from '@/components/catalogue-ui';
import { useAuth } from '@/context/auth';
import { createProfile } from '@/lib/community';

export default function OnboardingScreen() {
  const auth = useAuth(); const [username, setUsername] = useState(''); const [name, setName] = useState('');
  const [share, setShare] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit() {
    setError(''); setBusy(true);
    try {
      if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new Error('Use 3–24 lowercase letters, numbers or underscores for your username.');
      if (!name.trim() || [...name.trim()].length > 40) throw new Error('Choose a display name with 1–40 characters.');
      await createProfile(username, name, share); await auth.refreshProfile(); router.replace('/profile');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not create your profile.'); }
    finally { setBusy(false); }
  }
  return <AppShell active="Profile"><Text style={ui.kicker}>MAKE YOURSELF AT HOME</Text>
    <Text style={[ui.meta, { color: palette.accent, marginBottom: 12 }]}>You’re signed in · finish your profile below</Text>
    <Text style={ui.heading}>Your own{'\n'}<Text style={ui.editorial}>corner.</Text></Text>
    {!auth.session ? <Message text="Sign in before setting up your profile." /> : auth.profile ? <Message text="Your profile is already set up. Open Profile to edit it." /> : <>
      <Text style={[ui.body, { marginBottom: 8 }]}>Username · friends use this to find you</Text>
      <View style={ui.searchBox}><TextInput value={username} onChangeText={value => setUsername(value.toLowerCase())} accessibilityLabel="Username" autoCapitalize="none" autoCorrect={false} maxLength={24} editable={!busy} style={ui.input} placeholder="your_username" placeholderTextColor={palette.muted} /></View>
      <Text style={[ui.body, { marginBottom: 8 }]}>Display name</Text>
      <View style={ui.searchBox}><TextInput value={name} onChangeText={setName} accessibilityLabel="Display name" maxLength={80} editable={!busy} style={ui.input} placeholder="What should we call you?" placeholderTextColor={palette.muted} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 }}><Text style={[ui.body, { flex: 1 }]}>Let accepted friends see titles I mark as watched</Text><Switch value={share} onValueChange={setShare} disabled={busy} accessibilityLabel="Share watched history with friends" trackColor={{ true: palette.accent }} /></View>
      <Text style={[ui.meta, { marginBottom: 24 }]}>Your Watchlist stays private. You can change watched-history sharing in Profile.</Text>
      <Pressable accessibilityRole="button" disabled={busy || !username || !name.trim()} onPress={submit} style={[ui.button, busy && ui.pressed]}><Text style={ui.buttonText}>{busy ? 'Saving…' : 'Create my profile'}</Text></Pressable>
      {error ? <Message text={error} /> : null}
    </>}
  </AppShell>;
}
