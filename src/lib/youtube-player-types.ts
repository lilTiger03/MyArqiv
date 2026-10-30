export type PlayerProps = {
  id: string; onReady: () => void; onError: (code: number) => void;
  autoplay?: boolean; muted?: boolean;
  onStateChange?: (state: number) => void;
  onAutoplayBlocked?: () => void;
};
