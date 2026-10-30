import { useEffect, useRef } from 'react';
import { isYouTubeId } from '@/lib/youtube';
import type { PlayerProps } from '@/lib/youtube-player-types';

type Player = { destroy: () => void; mute: () => void; unMute: () => void; playVideo: () => void };
type YouTubeAPI = { Player: new (element: HTMLElement, options: {
  videoId: string; width: string; height: string;
  playerVars: { origin: string; playsinline: number; autoplay: number };
  events: { onReady: () => void; onError: (event: { data: number }) => void;
    onStateChange: (event: { data: number }) => void; onAutoplayBlocked: () => void };
}) => Player };
declare global { interface Window { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void } }
let apiPromise: Promise<YouTubeAPI> | undefined;
function loadAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YouTubeAPI>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const script = document.createElement('script');
    const timer = window.setTimeout(fail, 15_000);
    function fail() { window.clearTimeout(timer); apiPromise = undefined; script.remove(); reject(new Error('Could not load YouTube.')); }
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timer); previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else fail();
    };
    script.src = 'https://www.youtube.com/iframe_api'; script.async = true;
    script.onerror = fail; document.head.appendChild(script);
  });
  return apiPromise;
}
export default function YouTubePlayer({ id, onReady, onError, autoplay = false, muted = false, onStateChange, onAutoplayBlocked }: PlayerProps) {
  const container = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | undefined>(undefined);
  const sound = useRef(muted);
  useEffect(() => {
    sound.current = muted;
    const player = playerRef.current;
    if (player?.mute) { if (muted) player.mute(); else player.unMute(); }
  }, [muted]);
  useEffect(() => {
    let cancelled = false;
    let player: Player | undefined;
    if (!isYouTubeId(id)) { onError(2); return; }
    void loadAPI().then(api => {
      if (cancelled || !container.current) return;
      const element = document.createElement('div'); container.current.appendChild(element);
      player = new api.Player(element, {
        width: '100%', height: '100%', videoId: id,
        // Apply mute before requesting playback, including on browsers that block audible autoplay.
        playerVars: { origin: window.location.origin, playsinline: 1, autoplay: 0 },
        events: {
          onReady: () => {
            if (cancelled || !player) return;
            playerRef.current = player;
            if (sound.current) player.mute(); else player.unMute();
            if (autoplay) player.playVideo();
            onReady();
          },
          onError: event => { if (!cancelled) onError(event.data); },
          onStateChange: event => { if (!cancelled) onStateChange?.(event.data); },
          onAutoplayBlocked: () => { if (!cancelled) onAutoplayBlocked?.(); },
        },
      });
    }).catch(() => { if (!cancelled) onError(0); });
    return () => { cancelled = true; playerRef.current = undefined; player?.destroy(); };
  }, [id, onReady, onError, autoplay, onStateChange, onAutoplayBlocked]);
  return <div ref={container} aria-label="YouTube video player" style={{ width: '100%', height: '100%' }} />;
}
