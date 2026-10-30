import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { AppShell } from '@/components/catalogue-ui';
import { NativeClipVideo } from '@/components/native-clip-video';
import { useClipPlayback } from '@/hooks/use-clip-playback';
import { nativeClipSamples, type NativeClipSample } from '@/lib/native-clip-samples';
import { createNativePlayback } from '@/lib/native-playback';

export default function ClipsScreen() {
  const [playback] = useState(createNativePlayback);
  const { state, controller } = useClipPlayback(nativeClipSamples.length, playback.select);
  const [scrubbing, setScrubbing] = useState(false);
  const list = useRef<FlatList<NativeClipSample>>(null);
  function openMovie(clip: NativeClipSample) {
    playback.select(null);
    router.push({ pathname: '/title/[type]/[id]', params: { type: clip.tmdb.type, id: clip.tmdb.id } });
  }
  return <AppShell active="Clips" scroll={false}>
    <View style={{ flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', minHeight: 0, backgroundColor: '#000' }} onLayout={event => {
      const height = event.nativeEvent.layout.height;
      if (Math.abs(height - state.height) >= 1) {
        controller.viewport(height);
        requestAnimationFrame(() => list.current?.scrollToOffset({ offset: controller.state.index * height, animated: false }));
      }
    }}>
      {state.height > 0 && <FlatList ref={list} data={nativeClipSamples} extraData={{ owner: state.owner, enabled: state.enabled }} scrollEnabled={!scrubbing}
        style={{ flex: 1 }} keyExtractor={clip => clip.id} pagingEnabled snapToInterval={state.height} snapToAlignment="start" decelerationRate="fast" disableIntervalMomentum
        showsVerticalScrollIndicator={false} bounces={false} scrollEventThrottle={16} initialNumToRender={2} maxToRenderPerBatch={2} windowSize={3} removeClippedSubviews={false}
        getItemLayout={(_data, index) => ({ length: state.height, offset: state.height * index, index })}
        onScrollBeginDrag={() => controller.begin()} onScroll={event => controller.scroll(event.nativeEvent.contentOffset.y)}
        onMomentumScrollEnd={event => controller.settle(event.nativeEvent.contentOffset.y)}
        renderItem={({ item, index }) => <View accessibilityLabel={`Clip ${index + 1}: ${item.title}`} style={{ height: state.height, width: '100%', backgroundColor: '#000' }}>
          <NativeClipVideo clip={item} index={index} playback={playback} active={state.owner === index}
            onScrubbingChange={setScrubbing} openMovie={() => openMovie(item)} />
        </View>} />}
    </View>
  </AppShell>;
}
