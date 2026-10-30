import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { palette } from '@/components/catalogue-ui';
import { AuthProvider, useAuth } from '@/context/auth';

function Navigation() {
  const { session } = useAuth();
  return (
    <>
      <StatusBar style="light" />
      <Stack key={session?.user.id || 'guest'} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="clips" />
        <Stack.Screen name="clips-youtube" />
        <Stack.Screen name="watchlist" />
        <Stack.Screen name="library" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="friend/[id]" />
        <Stack.Screen name="recommendations" />
        <Stack.Screen name="title/[type]/[id]" />
        <Stack.Screen name="explore" />
      </Stack>
    </>
  );
}

export default function RootLayout() { return <AuthProvider><Navigation /></AuthProvider>; }
