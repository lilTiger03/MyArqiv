import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Linking, Pressable, Text, View } from 'react-native';
import { AppShell, Icon, palette, ui } from '@/components/catalogue-ui';
import { ClipVideo } from '@/components/clip-video';
import { fitClipPlayer } from '@/lib/clip-playback';
import { useClipPlayback } from '@/hooks/use-clip-playback';
import { clipSamples, type ClipSample } from '@/lib/clip-samples';
import { api } from '@/lib/catalogue';
import { youtubeUrl } from '@/lib/youtube';

function ClipCard({ clip, index, height, active, enabled, muted, liveCatalogue, leave }: {
  clip: ClipSample; index: number; height: number; active: boolean; enabled: boolean; muted: boolean; liveCatalogue: boolean; leave: () => void;
}) {
  const [space, setSpace] = useState({ width: 0, height: 0 });
  const [linkError, setLinkError] = useState('');
  const compact = height < 500;
  const player = fitClipPlayer(space.width, space.height, clip.orientation);
  const playerWidth = player?.width || 0; const playerHeight = player?.height || 0;
  async function external() {
    leave();
    try { await Linking.openURL(youtubeUrl(clip.videoId)); }
    catch { setLinkError('Could not open YouTube. Please try again.'); }
  }
  return <View accessibilityLabel={`Clip ${index + 1}: ${clip.media.title}`} style={{ height, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, width: '100%' }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      <Text style={[ui.kicker, { marginBottom: 0 }]}>{clip.format.toUpperCase()}</Text><Text style={ui.meta}>{index + 1} / {clipSamples.length} · {clip.orientation === 'portrait' ? 'Portrait' : 'Landscape'}</Text>
    </View>
    <View onLayout={event => {
      const { width, height: available } = event.nativeEvent.layout;
      setSpace(previous => previous.width === width && previous.height === available - 35 ? previous : { width, height: Math.max(0, available - 35) });
    }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0, marginVertical: 6 }}>
      {player ? active ? <ClipVideo key={clip.videoId} id={clip.videoId} muted={muted} width={playerWidth} height={playerHeight} /> : <>
        <Image source={`https://i.ytimg.com/vi/${clip.videoId}/hqdefault.jpg`} contentFit="contain" cachePolicy="memory" style={{ width: playerWidth, height: playerHeight, backgroundColor: '#080808' }} accessibilityLabel={`${clip.media.title} clip preview`} />
        <Text style={[ui.meta, { marginTop: 8 }]}>{enabled ? 'Settle on this clip to play' : 'Feed paused · press Resume above'}</Text>
      </> : <Text style={ui.meta}>{space.height ? 'More space needed for the player. Open in YouTube below.' : 'Preparing player…'}</Text>}
    </View>
    <Text style={[ui.sectionHeading, { fontSize: 22 }]} numberOfLines={1}>{clip.media.title}</Text>
    <Text style={ui.meta}>{clip.media.year} · {clip.language}{compact ? ` · YouTube: ${clip.publisher}` : ` · ${clip.media.type === 'movie' ? 'Film' : 'Series'}`}</Text>
    {!compact && <><Text style={[ui.body, { fontSize: 12, lineHeight: 18, marginTop: 5 }]} numberOfLines={1}>{clip.title}</Text>
      <Text style={ui.meta}>YouTube · {clip.publisher} · May contain spoilers</Text></>}
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
      <Pressable accessibilityRole="button" disabled={!liveCatalogue} onPress={() => { leave(); router.push({ pathname: '/title/[type]/[id]', params: { type: clip.media.type, id: clip.media.id } }); }}
        style={[ui.button, { flex: 1, paddingHorizontal: 10 }, !liveCatalogue && ui.pressed]}>
        <Text style={ui.buttonText}>{liveCatalogue ? `View ${clip.media.type === 'movie' ? 'film' : 'series'} →` : 'Live catalogue needed'}</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={external} style={{ minHeight: 46, justifyContent: 'center', paddingHorizontal: 6 }}><Text style={[ui.body, { color: palette.accent, fontSize: 12 }]}>Open YouTube ↗</Text></Pressable>
    </View>
    {linkError ? <Text accessibilityRole="alert" style={ui.meta}>{linkError}</Text> : null}
  </View>;
}

export default function ClipsScreen() {
  const [muted, setMuted] = useState(true);
  const [liveCatalogue, setLiveCatalogue] = useState(false);
  const { state, controller } = useClipPlayback(clipSamples.length);
  const list = useRef<FlatList<ClipSample>>(null);
  useEffect(() => {
    const request = new AbortController();
    void api<{ mode: string }>('/health', 'GET', request.signal).then(result => { if (!request.signal.aborted) setLiveCatalogue(result.mode === 'tmdb'); }).catch(() => {});
    return () => request.abort();
  }, []);
  return <AppShell active="Clips" scroll={false}>
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View><Text style={[ui.heading, { fontSize: 28, lineHeight: 32, marginBottom: 0 }]}>Clips<Text style={{ color: palette.accent }}>.</Text></Text><Text style={ui.meta}>Playback prototype · 2 samples</Text></View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Turn sound on' : 'Mute clips'} accessibilityState={{ selected: !muted }} onPress={() => setMuted(value => !value)} style={ui.chip}><Text style={[ui.chipText, { color: palette.accent }]}>{muted ? 'Sound off' : 'Sound on'}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={state.enabled ? 'Pause clip feed' : 'Resume clip feed'} onPress={() => controller.enable(!state.enabled)} style={ui.chip}><Text style={ui.chipText}>{state.enabled ? 'Pause' : 'Resume'}</Text></Pressable>
        </View>
      </View>
      <Text style={ui.meta}>Swipe up around the video · YouTube may show ads</Text>
    </View>
    <View style={{ flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' }} onLayout={event => {
      const nextHeight = event.nativeEvent.layout.height;
      if (Math.abs(nextHeight - state.height) >= 1) {
        controller.viewport(nextHeight);
        requestAnimationFrame(() => list.current?.scrollToOffset({ offset: controller.state.index * nextHeight, animated: false }));
      }
    }}>
      {state.height > 0 && <FlatList ref={list} data={clipSamples} extraData={{ owner: state.owner, muted, enabled: state.enabled, liveCatalogue }}
        style={{ flex: 1 }} keyExtractor={clip => clip.videoId} pagingEnabled snapToInterval={state.height} snapToAlignment="start" decelerationRate="fast" disableIntervalMomentum
        showsVerticalScrollIndicator={false} bounces={false} scrollEventThrottle={16} initialNumToRender={2} maxToRenderPerBatch={2} windowSize={3} removeClippedSubviews={false}
        getItemLayout={(_data, index) => ({ length: state.height, offset: state.height * index, index })}
        onScrollBeginDrag={() => controller.begin()} onScroll={event => controller.scroll(event.nativeEvent.contentOffset.y)}
        onMomentumScrollEnd={event => controller.settle(event.nativeEvent.contentOffset.y)}
        renderItem={({ item, index }) => <ClipCard clip={item} index={index} height={state.height} active={state.owner === index} enabled={state.enabled} muted={muted} liveCatalogue={liveCatalogue} leave={() => controller.enable(false)} />}
      />}
    </View>
    <View style={{ minHeight: 32, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 760, alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>{clipSamples.map((clip, index) => <View key={clip.videoId} style={{ width: state.index === index ? 20 : 6, height: 4, borderRadius: 2, backgroundColor: state.index === index ? palette.accent : palette.border }} />)}</View>
      <Text accessibilityLiveRegion="polite" style={ui.meta}>{state.index === clipSamples.length - 1 ? 'End of preview · swipe down to revisit' : 'Swipe up for the next clip'}</Text>
      <Icon name="clips" color={palette.accent} size={15} />
    </View>
  </AppShell>;
}
