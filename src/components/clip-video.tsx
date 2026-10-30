import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { playerError } from '@/lib/youtube';
import { palette, ui } from './catalogue-ui';
import YouTubePlayer from './youtube-player';

export function ClipVideo({ id, muted, width, height }: { id: string; muted: boolean; width: number; height: number }) {
  const [status, setStatus] = useState('Loading player…');
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  const onReady = useCallback(() => { setReady(true); setStatus(previous => previous === 'Loading player…' ? 'Ready · tap play if needed' : previous); }, []);
  const onError = useCallback((code: number) => { setReady(true); setError(playerError(code)); }, []);
  const onState = useCallback((state: number) => {
    if (state === 1) setStatus('Playing');
    else if (state === 2) setStatus('Paused in YouTube');
    else if (state === 3) setStatus('Buffering…');
    else if (state === 0) setStatus('Finished · swipe for the next clip');
  }, []);
  const onBlocked = useCallback(() => { setReady(true); setStatus('Autoplay blocked · tap play in the video'); }, []);
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => onError(0), 20_000);
    return () => clearTimeout(timer);
  }, [ready, onError, attempt]);
  return <>
    <View style={{ width, height, backgroundColor: '#080808' }}>
      {!error && <YouTubePlayer key={`${id}:${attempt}`} id={id} autoplay muted={muted} onReady={onReady} onError={onError} onStateChange={onState} onAutoplayBlocked={onBlocked} />}
      {error ? <View style={{ flex: 1, justifyContent: 'center', padding: 18, gap: 12 }}>
        <Text accessibilityRole="alert" style={ui.body}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => { setError(''); setReady(false); setStatus('Loading player…'); setAttempt(value => value + 1); }} style={ui.button}><Text style={ui.buttonText}>Retry player</Text></Pressable>
      </View> : null}
    </View>
    <View style={{ minHeight: 25, marginTop: 6, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      {!ready && <ActivityIndicator color={palette.accent} size="small" accessibilityLabel="Loading YouTube" />}
      <Text accessibilityLiveRegion="polite" style={[ui.meta, { textAlign: 'center' }]}>{error ? 'Try another clip or open YouTube below.' : status}</Text>
    </View>
  </>;
}
