export const isYouTubeId = (value: string) => /^[A-Za-z0-9_-]{11}$/.test(value);
export function youtubeUrl(id: string) {
  if (!isYouTubeId(id)) throw new Error('Invalid YouTube video.');
  return `https://www.youtube.com/watch?v=${id}`;
}
export function playerError(code: number) {
  if (code === 100) return 'This video has been removed or made private. Try another video.';
  if (code === 101 || code === 150) return 'The owner does not allow this video to play here. Open it in YouTube instead.';
  if (code === 153) return 'YouTube could not identify the embedded player. Open this video in YouTube instead.';
  return 'The YouTube player could not load this video. Try opening it in YouTube.';
}

/** Same official player on web and native. No video/audio is downloaded or proxied by our backend. */
export function playerHtml(id: string, origin: string, options: { autoplay?: boolean; muted?: boolean } = {}) {
  youtubeUrl(id);
  const parsed = new URL(origin);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) throw new Error('Invalid player origin.');
  const safeOrigin = JSON.stringify(origin).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><style>html,body,#player{width:100%;height:100%;margin:0;background:#151515;overflow:hidden}</style></head><body><div id="player"></div><script>
  function report(event, code) {
    var message = {source:'myarqiv-youtube', event:event, code:code};
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
    else window.parent.postMessage(message, ${safeOrigin});
  }
  function onYouTubeIframeAPIReady() {
    window.myArqivPlayer = new YT.Player('player', {width:'100%', height:'100%', videoId:'${id}',
      playerVars:{playsinline:1,autoplay:0,origin:${safeOrigin}},
      events:{onReady:function(e){${options.muted ? 'e.target.mute();' : ''}${options.autoplay ? 'e.target.playVideo();' : ''}report('ready',0)},onError:function(e){report('error',e.data)},onAutoplayBlocked:function(){report('blocked',0)},onStateChange:function(e){report('state',e.data)}}});
  }
  document.addEventListener('visibilitychange',function(){if(document.hidden&&window.myArqivPlayer)window.myArqivPlayer.pauseVideo()});
  window.addEventListener('pagehide',function(){if(window.myArqivPlayer)window.myArqivPlayer.destroy()});
  var script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
  script.onerror=function(){report('error',0)};document.head.appendChild(script);
</script></body></html>`;
}
