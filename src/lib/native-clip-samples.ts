// Complete, authorized Blender trailers. Never substitute extracted YouTube streams.
export const nativeClipSamples = [
  {
    id: 'sintel', tmdb: { id: 45745, type: 'movie' }, title: 'Sintel', year: '2010', description: 'A journey to find a friend.',
    uri: 'https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4',
    credit: '© 2010 Blender Foundation · durian.blender.org',
    source: 'https://durian.blender.org/about/',
  },
  {
    id: 'big-buck-bunny', tmdb: { id: 10378, type: 'movie' }, title: 'Big Buck Bunny', year: '2008', description: 'A very big rabbit. A very bad day.',
    uri: 'https://download.blender.org/peach/trailer/trailer_720p.mov',
    credit: '© 2008 Blender Foundation · www.bigbuckbunny.org',
    source: 'https://peach.blender.org/about/',
  },
] as const;
export type NativeClipSample = (typeof nativeClipSamples)[number];
