export type ClipSample = {
  videoId: string; title: string; publisher: string; channelUrl: string;
  orientation: 'portrait' | 'landscape'; format: string; language: string;
  media: { id: number; type: 'movie' | 'tv'; title: string; year: string };
};
// Small editorial playback fixture, not automated clip discovery.
// Checked against the original YouTube uploads and TMDB records on 2026-10-29.
// Keep the complete upload and its original framing; do not download or re-edit videos.
export const clipSamples: readonly ClipSample[] = [
  {
    videoId: 'NakTu_VZxJ0', title: 'Wednesday Addams | Dance Scene | Netflix', publisher: 'Netflix',
    channelUrl: 'https://www.youtube.com/@Netflix', orientation: 'landscape', format: 'Scene', language: 'English',
    media: { id: 119051, type: 'tv', title: 'Wednesday', year: '2022' },
  },
  {
    videoId: '5mQtEBmaqVU', title: 'The Epic Scene from Jailer! #JailerUnlocked', publisher: 'Sun NXT',
    channelUrl: 'https://www.youtube.com/@Sunnxt', orientation: 'portrait', format: 'Behind the scenes', language: 'Tamil',
    media: { id: 937020, type: 'movie', title: 'Jailer', year: '2023' },
  },
];
