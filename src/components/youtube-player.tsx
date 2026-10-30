import { applicationId } from 'expo-application';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { playerHtml } from '@/lib/youtube';

import type { PlayerProps } from '@/lib/youtube-player-types';
export default function YouTubePlayer({ id, onReady, onError, autoplay = false, muted = false, onStateChange, onAutoplayBlocked }: PlayerProps) {
  // Use the actual installed app ID, including Expo Go's ID during development.
  const origin = applicationId ? `https://${applicationId.toLowerCase()}` : null;
  const webview = useRef<WebView<unknown>>(null);
  const [initialMuted] = useState(muted);
  useEffect(() => { webview.current?.injectJavaScript(`if(window.myArqivPlayer&&window.myArqivPlayer.mute){window.myArqivPlayer.${muted ? 'mute' : 'unMute'}();}true;`); }, [muted]);
  const source = useMemo(() => origin ? { html: playerHtml(id, origin, { autoplay, muted: initialMuted }), baseUrl: `${origin}/` } : null, [id, origin, autoplay, initialMuted]);
  if (!source) return null;
  return <WebView<unknown> ref={webview} source={source} style={{ flex: 1, backgroundColor: '#151515' }}
    originWhitelist={['*']} allowsInlineMediaPlayback allowsFullscreenVideo
    mediaPlaybackRequiresUserAction={!autoplay} scrollEnabled={false} javaScriptEnabled domStorageEnabled
    allowsBackForwardNavigationGestures={false}
    onMessage={event => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        if (message.source !== 'myarqiv-youtube') return;
        if (message.event === 'ready') {
          webview.current?.injectJavaScript(`if(window.myArqivPlayer){window.myArqivPlayer.${muted ? 'mute' : 'unMute'}();}true;`);
          onReady();
        }
        if (message.event === 'state') onStateChange?.(Number(message.code));
        if (message.event === 'blocked') onAutoplayBlocked?.();
        if (message.event === 'error') onError(Number(message.code));
      } catch { /* Ignore unrelated WebView messages. */ }
    }} onError={() => onError(0)} onHttpError={() => onError(0)}
    onShouldStartLoadWithRequest={request => {
      if (request.isTopFrame === false || request.url === 'about:blank' || request.url.startsWith(`${origin}/`)
        || /^https:\/\/www\.youtube\.com\/embed\//.test(request.url)) return true;
      if (/^https:\/\//.test(request.url)) void Linking.openURL(request.url).catch(() => onError(0));
      return false;
    }}
    onOpenWindow={event => { if (/^https:\/\//.test(event.nativeEvent.targetUrl)) void Linking.openURL(event.nativeEvent.targetUrl).catch(() => onError(0)); }} />;
}
