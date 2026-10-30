import Slider from '@react-native-community/slider';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, ui } from '@/components/catalogue-ui';
import { ClipCreditDetails } from '@/components/clip-credits';
import type { NativeClipSample } from '@/lib/native-clip-samples';
import { clipSeekTime, clipTime, type NativePlayback } from '@/lib/native-playback';

export type ClipOverlayProps = {
  clip: NativeClipSample; index: number; playback: NativePlayback; active: boolean;
  onScrubbingChange: (value: boolean) => void; openMovie: () => void;
};
export function ClipOverlay({ clip, index, playback, active, onScrubbingChange, openMovie, time, duration, status, failed, blocked = false, retry, fill, onFit }: ClipOverlayProps & {
  time: number; duration: number; status: string; failed: boolean; blocked?: boolean;
  retry: () => void; fill: boolean; onFit: () => void;
}) {
  const intent = useSyncExternalStore(playback.subscribe, playback.snapshot, playback.snapshot);
  const [draft, setDraft] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  useFocusEffect(useCallback(() => () => setInfoOpen(false), []));
  const dragging = useRef(false);
  const paused = intent.index === index && intent.paused;
  const scrubbing = intent.index === index && intent.scrubbing;
  const interactive = active || (intent.owner === null && intent.index === index);
  // Focus loss must unlock paging and cannot leave a stale slider gesture owning playback.
  useEffect(() => {
    if (!active) { dragging.current = false; onScrubbingChange(false); }
    return () => { if (dragging.current) onScrubbingChange(false); };
  }, [active, onScrubbingChange]);
  function begin(value: number) {
    if (!active) return;
    dragging.current = true; setDraft(value); playback.scrub(index, true); onScrubbingChange(true);
  }
  function finish(value: number) {
    if (active) playback.seek(index, clipSeekTime(value, duration));
    dragging.current = false; playback.scrub(index, false); onScrubbingChange(false);
  }
  function toggle() { if (active) playback.toggle(index); }
  function credits() {
    if (!active) return;
    if (!paused) playback.toggle(index);
    setInfoOpen(true);
  }
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <Pressable accessibilityRole="button" accessibilityLabel={paused ? 'Play clip' : 'Pause clip'} disabled={!active}
      onPress={toggle} style={StyleSheet.absoluteFill}>
      {paused && <View style={styles.center}><Text style={styles.play}>▶</Text></View>}
    </Pressable>
    {interactive && <>
      {(failed || blocked || status === 'Buffering…' || status === 'Loading…') && <View style={styles.notice}>
        <Text accessibilityLiveRegion="polite" style={styles.small}>{blocked ? 'Tap to start sound in this browser' : status}</Text>
        {(failed || blocked) && <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}><Text style={styles.text}>{failed ? 'Retry' : 'Start preview'}</Text></Pressable>}
      </View>}
      <View style={styles.bottom}>
        {paused && <View style={[styles.row, styles.expanded]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Rewind 10 seconds" disabled={!active || duration <= 0} onPress={() => playback.seek(index, clipSeekTime(time - 10, duration))} style={styles.control}><Text style={styles.text}>↶ 10s</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Resume clip" disabled={!active} onPress={toggle} style={styles.control}><Text style={styles.text}>▶</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Forward 10 seconds" disabled={!active || duration <= 0} onPress={() => playback.seek(index, clipSeekTime(time + 10, duration))} style={styles.control}><Text style={styles.text}>10s ↷</Text></Pressable>
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" accessibilityLabel={fill ? 'Fit full video frame' : 'Fill vertical screen'} onPress={onFit} style={styles.control}><Text style={styles.text}>{fill ? 'Fit ↔' : 'Fill ↕'}</Text></Pressable>
        </View>}
        {(paused || scrubbing) && <View pointerEvents="none" style={styles.times}><Text style={styles.small}>{clipTime(scrubbing ? draft : time)}</Text><Text style={styles.small}>{clipTime(duration)}</Text></View>}
        <View style={styles.titleRow}>
          <Pressable accessibilityRole="link" accessibilityLabel={`View ${clip.title} movie details`} onPress={openMovie} style={styles.titleLink}>
            <Text numberOfLines={1} style={styles.title}>{clip.title} <Text style={styles.year}>›</Text></Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Clip information and credits for ${clip.title}`} onPress={credits} style={styles.info}><Text style={styles.infoGlyph}>ⓘ</Text></Pressable>
        </View>
        <View style={{ height: 24 }}>
          {!paused && !scrubbing && <View pointerEvents="none" style={styles.progressTrack}><View style={[styles.progressFill, { width: `${duration > 0 ? Math.min(100, Math.max(0, time / duration * 100)) : 0}%` }]} /></View>}
        <Slider accessibilityLabel={`Seek ${clip.title}`} accessibilityValue={{ min: 0, max: Math.floor(duration), now: Math.floor(scrubbing ? draft : time), text: `${clipTime(scrubbing ? draft : time)} of ${clipTime(duration)}` }}
          style={{ height: 24, width: '100%' }} minimumValue={0} maximumValue={duration || 1} disabled={!active || duration <= 0}
          value={clipSeekTime(scrubbing ? draft : time, duration)} minimumTrackTintColor={paused || scrubbing ? '#FFFFFF' : 'transparent'} maximumTrackTintColor={paused || scrubbing ? '#FFFFFF40' : 'transparent'} thumbTintColor={paused || scrubbing ? '#FFFFFF' : 'transparent'}
          onSlidingStart={begin} onValueChange={setDraft} onSlidingComplete={finish} tapToSeek />
        </View>
      </View>
      <Modal transparent visible={infoOpen && interactive} animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <View style={styles.backdrop}>
          <View accessibilityViewIsModal style={styles.sheet}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}><Text style={[ui.sectionHeading, { fontSize: 20 }]}>Clip information</Text><Pressable accessibilityRole="button" accessibilityLabel="Close clip information" onPress={() => setInfoOpen(false)} style={styles.control}><Text style={styles.text}>✕</Text></Pressable></View>
            <ScrollView style={{ flexShrink: 1 }}><ClipCreditDetails clip={clip} /></ScrollView>
          </View>
        </View>
      </Modal>
    </>}
  </View>;
}
const styles = StyleSheet.create({
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingBottom: 0 },
  progressTrack: { position: 'absolute', left: 0, right: 0, top: 11, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF40', overflow: 'hidden' }, progressFill: { height: 3, backgroundColor: '#FFFFFF' },
  titleRow: { flexDirection: 'row', alignItems: 'center' }, titleLink: { flex: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  title: { color: '#FFF9F0', fontSize: 15, fontWeight: '600', textShadowColor: '#000', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } }, year: { color: '#DDD5CC', fontSize: 16 },
  info: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }, infoGlyph: { color: '#FFFFFFCC', fontSize: 19, textShadowColor: '#000', textShadowRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 }, control: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  expanded: { backgroundColor: '#000000A8', borderRadius: 12, paddingHorizontal: 4, marginBottom: 4 },
  times: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 4 },
  text: { color: '#FFF9F0', fontSize: 14, fontWeight: '600' }, small: { color: '#E2DAD1', fontSize: 11, textShadowColor: '#000', textShadowRadius: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, play: { color: '#FFF', fontSize: 40, backgroundColor: '#00000080', width: 84, height: 84, textAlign: 'center', lineHeight: 84, borderRadius: 42, overflow: 'hidden' },
  notice: { position: 'absolute', top: 16, alignSelf: 'center', alignItems: 'center', backgroundColor: '#000000B8', padding: 12, borderRadius: 12, gap: 8 }, retry: { minHeight: 44, paddingHorizontal: 20, justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 460, maxHeight: '85%', backgroundColor: palette.panel, borderColor: palette.border, borderWidth: 1, borderRadius: 20, padding: 20, gap: 18 },
});
