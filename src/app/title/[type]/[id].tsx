import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, languages, Message, palette, Poster, SectionTitle, ui } from '@/components/catalogue-ui';
import { api, type Title } from '@/lib/catalogue';
import { useAuth } from '@/context/auth';
import { removeMedia, saveMedia, titleMembership } from '@/lib/community';
import { TitleCommunity } from '@/components/title-community';
import { TitleVideos } from '@/components/title-videos';

export default function TitleScreen() {
  const auth = useAuth();
  const [membershipReady, setMembershipReady] = useState(false);
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const [title, setTitle] = useState<Title | null>(null);
  const [saved, setSaved] = useState(false);
  const [watched, setWatched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setTitle(null); setError(''); setSaveError(''); setSaved(false); setWatched(false);
      if (!['movie', 'tv'].includes(type) || !/^[1-9]\d*$/.test(id)) {
        setError('Invalid title link.'); return;
      }
      api<{ title: Title }>(`/titles/${type}/${id}`, 'GET', controller.signal)
        .then(detail => { if (!controller.signal.aborted) setTitle(detail.title); })
        .catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [type, id, attempt]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setMembershipReady(false); setSaved(false); setWatched(false);
    if (!title || !auth.profile) return;
    titleMembership(title).then(result => {
      if (active) { setSaved(result.saved); setWatched(result.watched); setMembershipReady(true); }
    }).catch(failure => { if (active) setSaveError(failure.message); });
    return () => { active = false; };
  }, [title, auth.profile]));

  async function toggleSaved() {
    if (!title) return;
    if (!auth.profile) { router.push(auth.session ? '/onboarding' : '/auth'); return; }
    setBusy(true); setSaveError('');
    try { if (saved) await removeMedia(title, 'watchlist'); else await saveMedia(title, 'watchlist'); setSaved(!saved); }
    catch (failure) { setSaveError(failure instanceof Error ? failure.message : 'Could not update watchlist.'); }
    finally { setBusy(false); }
  }

  async function toggleWatched() {
    if (!title) return;
    if (!auth.profile) { router.push(auth.session ? '/onboarding' : '/auth'); return; }
    setBusy(true); setSaveError('');
    try {
      if (watched) await removeMedia(title, 'watched'); else await saveMedia(title, 'watched');
      setWatched(!watched);
      if (!watched) setSaved(false);
    } catch (failure) { setSaveError(failure instanceof Error ? failure.message : 'Could not update library.'); }
    finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
          style={({ pressed }) => [{ flexDirection: 'row', gap: 9, minHeight: 48, alignItems: 'center', marginBottom: 22 }, pressed && ui.pressed]}>
          <Icon name="back" size={18} /><Text style={ui.body}>Back to collection</Text>
        </Pressable>
        {error ? <Message text={error} retry={() => setAttempt(value => value + 1)} />
          : !title ? <ActivityIndicator color={palette.accent} accessibilityLabel="Loading title" /> : (
            <>
              <View style={[ui.poster, { width: '54%', maxWidth: 210, alignSelf: 'center', marginBottom: 28 }]}>
                <Poster item={title} key={`${title.type}:${title.id}`} />
              </View>
              <Text style={ui.kicker}>{title.type === 'movie' ? 'FILM' : 'SERIES'}{title.genres[0] ? ` · ${title.genres[0].toUpperCase()}` : ''}</Text>
              <Text style={[ui.heading, { fontSize: 31, lineHeight: 37 }]}>{title.title}</Text>
              {title.originalTitle && title.originalTitle !== title.title && <Text style={[ui.body, { marginBottom: 9 }]}>{title.originalTitle}</Text>}
              <Text style={[ui.body, { marginBottom: 22 }]}>{title.year || 'TBA'} · {languages[title.language] || title.language.toUpperCase()}
                {title.rating !== null ? ` · ★ ${title.rating.toFixed(1)} / 10 on TMDB` : ''}</Text>
              {title.demo && <Text style={ui.notice}>Fictional demo title · Not a real TMDB listing.</Text>}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || Boolean(auth.profile && !membershipReady), selected: saved }}
                disabled={busy || Boolean(auth.profile && !membershipReady)} onPress={toggleSaved} style={({ pressed }) => [ui.button, (pressed || busy) && ui.pressed]}>
                <Text style={ui.buttonText}>{busy ? 'Updating…' : !auth.profile ? 'Sign in to save to watchlist' : saved ? '✓ In your watchlist · tap to remove' : '+ Add to watchlist'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || Boolean(auth.profile && !membershipReady), selected: watched }}
                disabled={busy || Boolean(auth.profile && !membershipReady)} onPress={toggleWatched}
                style={({ pressed }) => [ui.button, { marginTop: 12, backgroundColor: palette.panel, borderWidth: 1, borderColor: watched ? palette.accent : palette.border }, (pressed || busy) && ui.pressed]}>
                <Text style={[ui.buttonText, { color: watched ? palette.accent : palette.text }]}>{!auth.profile ? 'Sign in to mark as watched' : watched ? '✓ Watched · remove from Library' : 'Mark as watched'}</Text>
              </Pressable>
              {saveError ? <Message text={saveError} /> : null}
              <View style={{ marginTop: 30 }}>
                <SectionTitle title="The story" />
                <Text style={[ui.body, { marginBottom: 24 }]}>{title.overview}</Text>
                <View style={ui.chips}>{title.genres.map(genre => <Text key={genre} style={[ui.chip, ui.chipText]}>{genre}</Text>)}</View>
              </View>
              <TitleCommunity key={`friends:${title.type}:${title.id}`} title={title} />
              <TitleVideos key={`${title.type}:${title.id}`} title={title} />
              <View style={{ marginTop: 30 }} />
              <SectionTitle title="The people behind it" caption="Cast" />
              {title.cast.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 20 }}>
                  {title.cast.map(person => (
                    <View key={person.id} style={{ width: 95 }}>
                      <View style={{ height: 125, borderRadius: 10, overflow: 'hidden', backgroundColor: palette.panel }}>
                        <View style={ui.placeholder}><Text style={[ui.monogram, { fontSize: 26 }]}>{person.name[0]}</Text></View>
                        {person.image && <Image source={person.image} style={{ position: 'absolute', inset: 0 }} contentFit="cover" cachePolicy="memory-disk" accessibilityLabel={person.name} />}
                      </View>
                      <Text style={ui.cardTitle}>{person.name}</Text><Text style={ui.meta}>{person.character}</Text>
                    </View>
                  ))}
                </ScrollView>
              ) : <Text style={ui.body}>Cast information is not available for this title.</Text>}
            </>
          )}
      </ScrollView>
    </SafeAreaView>
  );
}
