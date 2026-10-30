import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { palette, ui } from '@/components/catalogue-ui';
import type { NativeClipSample } from '@/lib/native-clip-samples';

export function ClipCreditDetails({ clip }: { clip: NativeClipSample }) {
  const [error, setError] = useState('');
  async function open(url: string) {
    try { await Linking.openURL(url); } catch { setError('Could not open this link. Please try again.'); }
  }
  return <View style={{ gap: 8 }}>
    <Text style={[ui.sectionHeading, { fontSize: 18 }]}>{clip.title} · trailer</Text>
    <Text style={ui.body}>{clip.credit}</Text>
    <Text style={ui.meta}>Streamed from Blender’s official servers. The original trailer is unchanged. Fit shows the complete frame; Fill crops the displayed frame. No endorsement is implied.</Text>
    <Pressable accessibilityRole="link" onPress={() => open(clip.source)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[ui.body, { color: palette.accent }]}>Creator & source information ↗</Text></Pressable>
    <Pressable accessibilityRole="link" onPress={() => open(clip.uri)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[ui.body, { color: palette.accent }]}>Original trailer ↗</Text></Pressable>
    <Pressable accessibilityRole="link" onPress={() => open('https://creativecommons.org/licenses/by/3.0/')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[ui.body, { color: palette.accent }]}>Creative Commons Attribution 3.0 ↗</Text></Pressable>
    {!!error && <Text accessibilityRole="alert" style={ui.meta}>{error}</Text>}
  </View>;
}
