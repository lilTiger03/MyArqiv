import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { AppShell, Message, palette, ui } from '@/components/catalogue-ui';
import { accountClient } from '@/lib/supabase';
import { useAuth } from '@/context/auth';
import { getProfile } from '@/lib/community';

export default function AuthScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  async function submit() {
    setBusy(true); setError(''); setNotice('');
    try {
      const client = accountClient();
      if (mode === 'signup') {
        if (password.length < 12) throw new Error('Choose a password with at least 12 characters.');
        const { data, error: failure } = await client.auth.signUp({ email: email.trim(), password });
        if (failure) throw failure;
        setPassword('');
        if (data.session) router.replace('/onboarding');
        else { setNotice('Check your email to confirm your account, then return here to sign in.'); setMode('signin'); }
      } else {
        const { data, error: failure } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (failure) throw failure;
        setPassword('');
        const profile = await getProfile(data.user.id);
        router.replace(profile ? '/profile' : '/onboarding');
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not sign in.'); }
    finally { setBusy(false); }
  }
  return <AppShell active="Profile">
    <Text style={ui.kicker}>A LITTLE MORE PERSONAL</Text>
    <Text style={ui.heading}>{mode === 'signin' ? 'Welcome' : 'Find your'}{'\n'}<Text style={ui.editorial}>{mode === 'signin' ? 'back.' : 'people.'}</Text></Text>
    <Text style={[ui.body, ui.introduction]}>Your watchlist. Your friends. Your next great story.</Text>
    {auth.session ? <><Text style={ui.body}>You’re already signed in.</Text><Link href="/profile" replace style={[ui.body, { color: palette.accent, paddingVertical: 20 }]}>Go to your profile →</Link></> : <>
      <View style={ui.chips}>{(['signin', 'signup'] as const).map(option => <Pressable key={option} accessibilityRole="button"
        accessibilityState={{ selected: mode === option, disabled: busy }} disabled={busy} onPress={() => { setMode(option); setError(''); setNotice(''); setPassword(''); }} style={[ui.chip, mode === option && ui.chipActive]}>
        <Text style={[ui.chipText, mode === option && ui.selectedText]}>{option === 'signin' ? 'Sign in' : 'Create account'}</Text></Pressable>)}</View>
      <Text style={[ui.body, { marginBottom: 8 }]}>Email</Text>
      <View style={ui.searchBox}><TextInput value={email} onChangeText={setEmail} accessibilityLabel="Email" placeholder="you@example.com" placeholderTextColor={palette.muted}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!busy} maxLength={254} style={ui.input} /></View>
      <Text style={[ui.body, { marginBottom: 8 }]}>Password{mode === 'signup' ? ' · at least 12 characters' : ''}</Text>
      <View style={ui.searchBox}><TextInput value={password} onChangeText={setPassword} accessibilityLabel="Password" secureTextEntry autoCapitalize="none" autoCorrect={false}
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} editable={!busy} maxLength={128} style={ui.input} onSubmitEditing={() => { if (!busy && email && password) void submit(); }} /></View>
      <Pressable accessibilityRole="button" disabled={busy || !email.trim() || !password || !auth.configured} onPress={submit} style={[ui.button, (busy || !email.trim() || !password || !auth.configured) && ui.pressed]}>
        <Text style={ui.buttonText}>{busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}</Text></Pressable>
      {notice ? <Text accessibilityLiveRegion="polite" style={[ui.notice, { marginTop: 20 }]}>{notice}</Text> : null}
      {error ? <Message text={error} /> : null}
      {!auth.configured && <Message text="Accounts are not connected yet. Please try again later." />}
      <Text style={[ui.meta, { marginTop: 24 }]}>Your email stays private. Friends will find you by your username.</Text>
    </>}
  </AppShell>;
}
