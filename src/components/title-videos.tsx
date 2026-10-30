import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type Title, type Video, type VideoCollection } from '@/lib/catalogue';
import { playerError, youtubeUrl } from '@/lib/youtube';
import { Message, palette, SectionTitle, ui } from './catalogue-ui';
import YouTubePlayer from './youtube-player';

function VideoPlayer({ video, onClose, onExternal }: { video: Video; onClose: () => void; onExternal: (id: string) => void }) {
  const { width } = useWindowDimensions();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const onReady = useCallback(() => { setReady(true); setError(''); }, []);
  const onError = useCallback((code: number) => { setReady(true); setError(playerError(code)); }, []);
  useEffect(() => {
    const timer = setTimeout(() => onError(0), 20_000);
    if (ready) clearTimeout(timer);
    return () => clearTimeout(timer);
  }, [ready, onError]);
  return <Modal visible animationType="slide" onRequestClose={onClose} backdropColor={palette.bg}>
    <SafeAreaView style={ui.screen}>
      <View style={[ui.content, { flex: 1 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close video player" onPress={onClose} style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-end' }}>
          <Text style={[ui.body, { color: palette.accent }]}>Close ✕</Text>
        </Pressable>
        <Text style={ui.kicker}>WATCH ON YOUTUBE</Text>
        <Text style={[ui.sectionHeading, { marginBottom: 8 }]} numberOfLines={2}>{video.title}</Text>
        <Text style={[ui.meta, { marginBottom: 16 }]}>{video.publisher || 'Listed on TMDB'} · {video.format}</Text>
        <View style={{ width: '100%', height: Math.max(200, Math.min(405, (width - 44) * 9 / 16)), minWidth: 200, backgroundColor: palette.panel }}>
          <YouTubePlayer id={video.id} onReady={onReady} onError={onError} />
        </View>
        {!ready && <ActivityIndicator accessibilityLabel="Loading YouTube player" color={palette.accent} style={{ marginTop: 12 }} />}
        <Text style={[ui.meta, { marginVertical: 12 }]} accessibilityLiveRegion="polite">{error || 'Press play in the YouTube player. YouTube may show ads.'}</Text>
        <Pressable accessibilityRole="link" onPress={() => onExternal(video.id)} style={ui.button}>
          <Text style={ui.buttonText}>Open in YouTube ↗</Text>
        </Pressable>
        <Text style={[ui.meta, { marginTop: 12 }]}>Opens the YouTube app when available. Your Premium benefits depend on your signed-in YouTube account.</Text>
      </View>
    </SafeAreaView>
  </Modal>;
}

export function TitleVideos({ title }: { title: Title }) {
  const [data, setData] = useState<VideoCollection | null>(null);
  const [error, setError] = useState('');
  const [linkError, setLinkError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Video | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api<VideoCollection>(`/titles/${title.type}/${title.id}/videos?retry=${attempt}`, 'GET', controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [title.type, title.id, attempt]);
  useFocusEffect(useCallback(() => () => setSelected(null), []));
  useEffect(() => {
    // Destroy the player on backgrounding: no hidden/background audio.
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') setSelected(null); });
    return () => subscription.remove();
  }, []);

  async function openExternal(id: string) {
    setSelected(null); setLinkError('');
    try {
      if (Platform.OS !== 'web') {
        try { await Linking.openURL(Platform.OS === 'ios' ? `youtube://www.youtube.com/watch?v=${id}` : `vnd.youtube:${id}`); return; }
        catch { /* Fall back to the public watch URL if the app is not installed. */ }
      }
      await Linking.openURL(youtubeUrl(id));
    } catch { setLinkError('Could not open YouTube. Please try again.'); }
  }
  async function findSongs() {
    try {
      setLinkError('');
      const query = [title.title, title.year, title.language, 'official video songs'].filter(Boolean).join(' ');
      await Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
    } catch { setLinkError('Could not open YouTube. Please try again.'); }
  }
  function renderVideo(video: Video) {
    return <View key={video.id} style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Play ${video.title}`} onPress={() => setSelected(video)}>
          <Image source={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} cachePolicy="memory" contentFit="cover"
            style={{ width: 96, height: 64, borderRadius: 6, backgroundColor: palette.panel }} accessibilityLabel={`${video.title} video thumbnail`} />
        </Pressable>
        <View style={{ flex: 1 }}><Text style={ui.cardTitle} numberOfLines={3}>{video.title}</Text>
          <Text style={ui.meta}>{video.publisher || (video.official ? 'TMDB · Marked official' : 'Listed on TMDB')} · {video.format}</Text></View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Watch ${video.title} here`} onPress={() => { setLinkError(''); setSelected(video); }} style={ui.button}>
          <Text style={ui.buttonText}>▶ Watch here</Text></Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel={`Open ${video.title} in YouTube`} onPress={() => openExternal(video.id)} style={{ minHeight: 46, justifyContent: 'center' }}>
          <Text style={[ui.body, { color: palette.accent }]}>Open in YouTube ↗</Text></Pressable>
      </View>
    </View>;
  }
  const songs = data?.videos.filter(video => video.kind === 'song') || [];
  const trailer = data?.videos.find(video => video.id === data.trailerId);
  const extras = data?.videos.filter(video => video.kind !== 'song' && video.id !== data.trailerId) || [];
  return <View style={{ marginTop: 30 }}>
    <SectionTitle title="Songs & music videos" caption="YouTube" />
    {error ? <Message text={error} retry={() => { setData(null); setError(''); setAttempt(value => value + 1); }} />
      : !data ? <ActivityIndicator accessibilityLabel="Loading videos" color={palette.accent} style={{ marginVertical: 20 }} /> : <>
        {songs.length ? songs.map(renderVideo) : <Text style={[ui.body, { marginBottom: 12 }]}>{title.demo ? 'Videos are available for real films and series.' : 'No song videos have been linked to this title yet.'}</Text>}
        {data.warning ? <Text style={ui.notice}>{data.warning}</Text> : null}
        {!title.demo && <View style={{ marginTop: 20 }}>
          <SectionTitle title="Official trailer" />
          {trailer ? renderVideo(trailer) : <Text style={[ui.body, { marginBottom: 12 }]}>No official full trailer is linked yet. Available teasers are under More videos.</Text>}
        </View>}
        {extras.length > 0 && <View style={{ marginTop: 12 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showExtras }} onPress={() => setShowExtras(value => !value)}
            style={[ui.chip, { marginBottom: 12, alignSelf: 'flex-start' }]}>
            <Text style={ui.chipText}>{showExtras ? 'Hide other videos' : `More videos (${extras.length})`}</Text>
          </Pressable>
          {showExtras && extras.map(renderVideo)}
        </View>}
      </>}
    {!title.demo && <Pressable accessibilityRole="link" onPress={findSongs} style={{ minHeight: 48, justifyContent: 'center', marginVertical: 8 }}>
      <Text style={[ui.body, { color: palette.accent }]}>Find more songs on YouTube ↗</Text></Pressable>}
    <Text style={ui.meta}>Videos play through YouTube. Availability and ads are controlled by YouTube and the uploader.</Text>
    {linkError ? <Message text={linkError} /> : null}
    {selected && <VideoPlayer key={selected.id} video={selected} onClose={() => setSelected(null)} onExternal={openExternal} />}
  </View>;
}
