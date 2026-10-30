import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { AppHeader, AppShell, FeaturedTitle, Icon, Message, MovieCard, SectionTitle, palette, ui } from '@/components/catalogue-ui';
import { type Title } from '@/lib/catalogue';
import { useAuth } from '@/context/auth';
import { collection, removeMedia, saveMedia } from '@/lib/community';
import { useCatalogueFeed } from '@/hooks/use-catalogue-feed';

export default function DiscoverScreen() {
  const auth = useAuth();
  const [type, setType] = useState<'movie' | 'tv'>('movie');
  const [language, setLanguage] = useState('');
  const [query, setQuery] = useState('');
  const feed = useCatalogueFeed(type, language, query);
  const list = useRef<FlatList<Title>>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [watchlistReady, setWatchlistReady] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!auth.profile) { setSavedKeys(new Set()); setWatchlistReady(true); return; }
    setWatchlistReady(false);
    collection('watchlist').then(rows => {
      if (active) { setSavedKeys(new Set(rows.map(item => `${item.media_type}:${item.media_id}`))); setWatchlistReady(true); }
    }).catch(failure => { if (active) { setWatchlistReady(false); setSaveError(failure.message); } });
    return () => { active = false; };
  }, [auth.profile]));

  useEffect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [type, language, query]);

  async function saveFeatured(item: Title) {
    if (!auth.profile) { router.push(auth.session ? '/onboarding' : '/auth'); return; }
    const key = `${item.type}:${item.id}`;
    const wasSaved = savedKeys.has(key);
    setSaving(true); setSaveError('');
    try {
      if (wasSaved) await removeMedia(item, 'watchlist'); else await saveMedia(item, 'watchlist');
      setSavedKeys(previous => {
        const next = new Set(previous);
        if (wasSaved) next.delete(key); else next.add(key);
        return next;
      });
    } catch (failure) {
      setSaveError(failure instanceof Error ? failure.message : 'Could not update your watchlist.');
    } finally { setSaving(false); }
  }

  const featured = !query.trim() ? feed.titles[0] : undefined;
  return (
    <AppShell active="Discover" scroll={false}>
      <FlatList ref={list} data={feed.titles} numColumns={3}
        style={{ flex: 1 }} contentContainerStyle={ui.content}
        columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 22 }}
        keyExtractor={item => `${item.type}:${item.id}`}
        renderItem={({ item }) => <MovieCard item={item} />}
        keyboardShouldPersistTaps="handled" onEndReached={feed.loadMore} onEndReachedThreshold={0.5}
        initialNumToRender={9} maxToRenderPerBatch={9} windowSize={7}
        ListHeaderComponent={<>
          <AppHeader />
          <Text style={ui.kicker}>A WORLD OF STORIES</Text>
          <Text style={ui.heading}>Good stories.{'\n'}<Text style={ui.editorial}>Everywhere.</Text></Text>
          <Text style={[ui.body, ui.introduction]}>From Chennai to Seoul. Find something{'\n'}you’ll be glad you discovered.</Text>
          <View style={ui.searchBox}>
            <Icon name="search" size={19} />
            <TextInput value={query} onChangeText={setQuery}
              accessibilityLabel="Search films and series" placeholder="Search films & series…"
              placeholderTextColor="#928B82" style={ui.input} maxLength={120} returnKeyType="search"
              autoCorrect={false} clearButtonMode="while-editing" />
          </View>
          <View style={ui.types}>
            {(['movie', 'tv'] as const).map(option => (
              <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: type === option }}
                onPress={() => setType(option)} style={[ui.typeButton, type === option && ui.typeSelected]}>
                <Text style={[ui.typeText, type === option && { color: palette.text }]}>{option === 'movie' ? 'Films' : 'Series'}</Text>
              </Pressable>
            ))}
          </View>
          <View style={ui.chips}>
            {[['', 'Worldwide'], ['ta', 'Tamil'], ['ko', 'Korean'], ['en', 'English']].map(([code, name]) => (
              <Pressable key={code} accessibilityRole="button" accessibilityState={{ selected: language === code }}
                onPress={() => setLanguage(code)} style={[ui.chip, language === code && ui.chipActive]}>
                <Text style={[ui.chipText, language === code && ui.selectedText]}>{name}</Text>
              </Pressable>
            ))}
          </View>
          {feed.mode === 'demo' && <Text style={ui.notice}>Demo collection · These titles are fictional. Live films appear when the backend is connected to TMDB.</Text>}
          {featured && <FeaturedTitle item={featured} saved={savedKeys.has(`${featured.type}:${featured.id}`)}
            busy={saving || !watchlistReady || !auth.ready} onSave={() => saveFeatured(featured)} />}
          {saveError ? <Message text={saveError} /> : null}
          <SectionTitle title={query.trim() ? 'Search results' : 'Worth a closer look'}
            caption={feed.titles.length ? `${feed.titles.length} ${type === 'movie' ? 'films' : 'series'} loaded` : undefined} />
        </>}
        ListEmptyComponent={feed.status === 'loading'
          ? <ActivityIndicator accessibilityLabel="Loading titles" color={palette.accent} style={{ marginVertical: 40 }} />
          : feed.status === 'error' ? <Message text={feed.error} retry={feed.retry} />
            : <Message text="No titles found. Try another title or language." />}
        ListFooterComponent={<>
          {feed.status === 'more' && <ActivityIndicator accessibilityLabel="Loading more titles" color={palette.accent} style={{ marginVertical: 24 }} />}
          {feed.status === 'error' && feed.titles.length > 0 && <Message text={feed.error} retry={feed.retry} />}
          {feed.status === 'ready' && feed.page >= feed.pages && feed.titles.length > 0 && <Text style={[ui.meta, { textAlign: 'center', paddingVertical: 18 }]}>You’re all caught up. Try another language or search.</Text>}
          <View style={ui.footer}><Icon name="globe" color={palette.accent} size={17} /><Text style={ui.meta}>Great cinema speaks every language.</Text></View>
        </>} />
    </AppShell>
  );
}
