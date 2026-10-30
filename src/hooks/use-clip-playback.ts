import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { createClipPlayback, type ClipPlaybackState } from '@/lib/clip-playback';

export function useClipPlayback(count: number, ownershipChanged?: (owner: number | null) => void) {
  const [state, setState] = useState<ClipPlaybackState>({ index: 0, owner: null, height: 0, enabled: true });
  const [controller] = useState(() => createClipPlayback(count, next => { ownershipChanged?.(next.owner); setState(next); }));
  useFocusEffect(useCallback(() => { controller.focus(true); return () => controller.focus(false); }, [controller]));
  useEffect(() => {
    const update = () => controller.foreground(AppState.currentState !== 'background' && AppState.currentState !== 'inactive'
      && (Platform.OS !== 'web' || !document.hidden));
    update();
    const change = AppState.addEventListener('change', update);
    const blur = Platform.OS === 'android' ? AppState.addEventListener('blur', () => controller.foreground(false)) : null;
    const focus = Platform.OS === 'android' ? AppState.addEventListener('focus', update) : null;
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', update);
    return () => {
      controller.foreground(false); change.remove(); blur?.remove(); focus?.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', update);
    };
  }, [controller]);
  return { state, controller };
}
