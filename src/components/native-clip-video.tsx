import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ClipOverlay, type ClipOverlayProps } from '@/components/clip-overlay';
import { clipSeekTime } from '@/lib/native-playback';

export type NativeClipVideoProps = ClipOverlayProps;

export function NativeClipVideo(props: NativeClipVideoProps) {
  const { clip, index, playback } = props;
  const wanted = useRef(false);
  const [status, setStatus] = useState('Loading…');
  const [failed, setFailed] = useState(false);
  const [fill, setFill] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const player = useVideoPlayer({ uri: clip.uri, useCaching: false }, video => {
    video.loop = true;
    video.muted = false;
    video.audioMixingMode = 'doNotMix';
    video.staysActiveInBackground = false;
    video.showNowPlayingNotification = false;
    video.timeUpdateEventInterval = 0.25;
  });
  useEffect(() => playback.register(index, {
    play() { wanted.current = true; player.play(); },
    pause() { wanted.current = false; player.pause(); },
    seek(seconds) { const next = clipSeekTime(seconds, player.duration); player.currentTime = next; setTime(next); },
  }), [index, playback, player]);
  useEffect(() => {
    const statusListener = player.addListener('statusChange', ({ status }) => {
      setFailed(status === 'error');
      if (status === 'readyToPlay') {
        setDuration(player.duration);
        if (wanted.current) player.play();
      }
      setStatus(status === 'error' ? 'Could not load this clip.' : status === 'loading' ? 'Buffering…' : 'Ready');
    });
    const playingListener = player.addListener('playingChange', ({ isPlaying }) => { if (isPlaying) setStatus('Playing'); });
    const sourceListener = player.addListener('sourceLoad', ({ duration }) => setDuration(duration));
    const timeListener = player.addListener('timeUpdate', ({ currentTime }) => { setTime(currentTime); setDuration(player.duration); });
    return () => { statusListener.remove(); playingListener.remove(); sourceListener.remove(); timeListener.remove(); };
  }, [player]);
  async function retry() {
    setFailed(false); setStatus('Loading…');
    try { await player.replaceAsync({ uri: clip.uri, useCaching: false }); }
    catch { setFailed(true); setStatus('Could not load this clip.'); }
  }
  return <View style={{ flex: 1, backgroundColor: '#000' }}>
    <VideoView player={player} nativeControls={false} contentFit={fill ? 'cover' : 'contain'} allowsPictureInPicture={false}
      fullscreenOptions={{ enable: false }} surfaceType="textureView" pointerEvents="none" style={{ flex: 1 }} />
    <ClipOverlay {...props} time={time} duration={duration} status={status} failed={failed} retry={retry} fill={fill} onFit={() => setFill(value => !value)} />
  </View>;
}
