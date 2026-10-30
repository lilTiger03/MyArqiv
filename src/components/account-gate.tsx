import { Link } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/auth';
import { Message, palette, ui } from './catalogue-ui';

export function AccountGate({ children, reason = 'Keep your stories, find friends and share what you love.' }: { children: ReactNode; reason?: string }) {
  const auth = useAuth();
  if (!auth.ready) return <ActivityIndicator color={palette.accent} accessibilityLabel="Loading account" style={{ marginVertical: 30 }} />;
  if (!auth.configured) return <Message text="Accounts are not connected yet. You can still explore films and series in Discover." />;
  if (!auth.session) return <View style={{ gap: 16, marginVertical: 24 }}>
    <Text style={ui.body}>{reason}</Text>
    <Link href="/auth" style={[ui.button, ui.buttonText, { textAlign: 'center' }]}>Sign in or create an account</Link>
  </View>;
  if (auth.error) return <Message text={auth.error} retry={() => { void auth.refreshProfile(); }} />;
  if (!auth.profile) return <View style={{ gap: 16, marginVertical: 24 }}><Text style={ui.body}>You’re signed in. Choose a username to finish your profile so friends can find you.</Text>
    <Link href="/onboarding" style={[ui.button, ui.buttonText, { textAlign: 'center' }]}>Set up your profile</Link></View>;
  return <>{children}</>;
}
