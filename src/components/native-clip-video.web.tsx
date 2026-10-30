import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ClipOverlay } from '@/components/clip-overlay';
import { clipSeekTime } from '@/lib/native-playback';
import type { NativeClipVideoProps } from './native-clip-video';

// Browsers may require one gesture for audible autoplay; native playback uses Expo Video.
export function NativeClipVideo(props: NativeClipVideoProps) {
  const { clip, index, playback, active } = props;
  const video = useRef<HTMLVideoElement>(null);
  const wanted = useRef(false);
  const attempt = useRef(0);
  const [status, setStatus] = useState('Loading…');
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fill, setFill] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    return playback.register(index, {
      pause() { wanted.current = false; attempt.current++; element.pause(); },
      play() {
        wanted.current = true;
        const version = ++attempt.current;
        void element.play().then(() => {
          if (!wanted.current) element.pause();
          else if (version === attempt.current) setBlocked(false);
        }).catch(error => {
          if (!wanted.current || version !== attempt.current) return;
          if (error.name === 'NotAllowedError') { setBlocked(true); setStatus('Browser needs a tap to start sound'); }
          else if (error.name !== 'AbortError') { setFailed(true); setStatus('Could not play this clip.'); }
        });
      },
      seek(seconds) { element.currentTime = clipSeekTime(seconds, element.duration); setTime(element.currentTime); },
    });
  }, [index, playback]);
  function retry() {
    const element = video.current;
    if (!element || !active) return;
    setFailed(false); setBlocked(false);
    if (element.error) element.load();
    if (playback.snapshot().paused) playback.toggle(index);
    void element.play().catch(() => { setBlocked(true); setStatus('Please try Start preview again.'); });
  }
  return <View style={{ flex: 1, backgroundColor: '#000' }}>
    <video ref={video} src={clip.uri} playsInline loop preload="auto" controls={false}
      style={{ width: '100%', height: '100%', objectFit: fill ? 'cover' : 'contain', pointerEvents: 'none', position: 'absolute' }}
      onPlaying={() => { if (!wanted.current) video.current?.pause(); else { setStatus('Playing'); setBlocked(false); } }}
      onWaiting={() => setStatus('Buffering…')} onLoadedData={() => setStatus('Ready')}
      onDurationChange={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
      onError={() => { setFailed(true); setStatus('Could not load this clip.'); }} />
    <ClipOverlay {...props} time={time} duration={duration} status={status} failed={failed} blocked={blocked} retry={retry} fill={fill} onFit={() => setFill(value => !value)} />
  </View>;
}
