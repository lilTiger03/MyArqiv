// Editorial links, keyed by TMDB media type and ID. These are not a complete soundtrack database.
// Verified against YouTube oEmbed on 2026-10-28; never download or proxy the audiovisual content.
export const songLinks = {
  'movie:680652': [
    { id: 'ARKpiClpoyU', title: 'Kandaa Vara Sollunga', publisher: 'Think Music India', format: 'Music video', language: 'ta' },
  ],
  'movie:743563': [
    { id: '1OjZnGZjOA0', title: 'Pathala Pathala', publisher: 'Sony Music South', format: 'Music video', language: 'ta' },
  ],
};

export const validVideoId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value);

export function curatedSongs(type, id) {
  return (songLinks[`${type}:${id}`] || []).filter(song => validVideoId(song.id))
    .map(song => ({ ...song, kind: 'song', source: 'curated', official: true }));
}

export function tmdbVideos(results) {
  const unique = new Map();
  for (const video of results || []) {
    if (video.site !== 'YouTube' || !validVideoId(video.key)) continue;
    const name = String(video.name || '');
    const music = video.official === true && ['Clip', 'Music Video'].includes(video.type)
      && /\b(video song|song video|lyric(?:s)?(?: video)?|music video)\b/i.test(name)
      && !/\b(teaser|promo|trailer|making|behind|reaction|review|cover|karaoke|remix|mashup|jukebox)\b/i.test(name);
    const kind = video.type === 'Trailer' ? 'trailer' : video.type === 'Teaser' ? 'teaser' : music ? 'song' : 'video';
    if (!unique.has(video.key)) unique.set(video.key, {
      id: video.key, title: String(video.name || 'Video').slice(0, 300), kind, format: music ? (/\blyric/i.test(name) ? 'Lyric video' : 'Music video') : video.type || 'Video',
      publisher: null, language: video.iso_639_1 || '', official: video.official === true, source: 'tmdb',
    });
  }
  return [...unique.values()].sort((a, b) => Number(b.official) - Number(a.official));
}

/** Select one full trailer. A teaser must never be presented as the official trailer. */
export function primaryTrailer(videos, language) {
  const candidates = videos.filter(video => video.kind === 'trailer' && video.official
    && !/\b(teaser|announcement|glimpse|promo|fan[ -]?made|concept|reaction|review|song|lyric|behind)\b/i.test(video.title));
  const rank = video => (video.language === language ? 100 : video.language === 'en' ? 50 : 0)
    + (/^official trailer$/i.test(video.title.trim()) ? 10 : /\bofficial\b/i.test(video.title) ? 5 : 0)
    + (/\b(final|international|dubbed|trailer\s*#?\s*[2-9])\b/i.test(video.title) ? 0 : 2);
  return candidates.sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id))[0] || null;
}
