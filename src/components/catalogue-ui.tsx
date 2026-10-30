import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Title } from '@/lib/catalogue';
import { useAuth } from '@/context/auth';

export const palette = {
  bg: '#151515', panel: '#22211F', text: '#F5EFE4', muted: '#B9B1A5',
  accent: '#FF834D', border: '#38332D', onAccent: '#25170E',
};
export const languages: Record<string, string> = {
  ta: 'Tamil', ko: 'Korean', en: 'English', no: 'Norwegian', hi: 'Hindi',
  ja: 'Japanese', fr: 'French', es: 'Spanish', te: 'Telugu', ml: 'Malayalam',
};
const serif = Platform.OS === 'android' ? 'serif' : 'Georgia';
const symbols = {
  discover: { ios: 'safari', android: 'explore', web: 'explore' },
  clips: { ios: 'play.rectangle', android: 'smart_display', web: 'smart_display' },
  bookmark: { ios: 'bookmark', android: 'bookmark', web: 'bookmark' },
  saved: { ios: 'bookmark.fill', android: 'bookmark_added', web: 'bookmark_added' },
  about: { ios: 'info.circle', android: 'info', web: 'info' },
  library: { ios: 'books.vertical', android: 'video_library', web: 'video_library' },
  profile: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  arrow: { ios: 'arrow.up.right', android: 'north_east', web: 'north_east' },
  back: { ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' },
  globe: { ios: 'globe', android: 'public', web: 'public' },
} as const;

export function Icon({ name, color = palette.muted, size = 20 }: {
  name: keyof typeof symbols; color?: string; size?: number;
}) {
  return <SymbolView name={symbols[name]} tintColor={color} size={size} accessible={false} />;
}

export function AppHeader() {
  const auth = useAuth();
  return (
    <View style={ui.topbar}>
      <Text style={ui.brand}>myArqiv<Text style={{ color: palette.accent }}>.</Text></Text>
      <Link href={auth.session ? (auth.profile ? '/profile' : '/onboarding') : '/auth'} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel={!auth.ready ? 'Loading account' : auth.session ? 'Signed in · open your profile' : 'Sign in to myArqiv'}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, flexShrink: 1, marginLeft: 16 }}>
          <Icon name="profile" size={20} color={auth.session ? palette.accent : palette.muted} />
          <Text numberOfLines={1} style={[ui.meta, { maxWidth: 140, color: auth.session ? palette.accent : palette.muted }]}>{!auth.ready ? 'Loading account…' : auth.profile ? `@${auth.profile.username}` : auth.session ? 'Signed in' : 'Sign in'}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

export function AppShell({ active, children, scroll = true }: {
  active: 'Discover' | 'Clips' | 'Watchlist' | 'Library' | 'Profile'; children: ReactNode; scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const items = [
    { label: 'Discover', href: '/' as const, icon: 'discover' as const },
    { label: 'Clips', href: '/clips' as const, icon: 'clips' as const },
    { label: 'Watchlist', href: '/watchlist' as const, icon: 'bookmark' as const },
    { label: 'Library', href: '/library' as const, icon: 'library' as const },
    { label: 'Profile', href: '/profile' as const, icon: 'profile' as const },
  ];
  return (
    <SafeAreaView style={ui.screen} edges={['top', 'left', 'right']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
        <AppHeader />
        {children}
      </ScrollView> : children}
      <View style={[ui.navigation, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={ui.navigationInner}>
          {items.map(item => (
            <Link key={item.label} href={item.href} replace asChild>
              <Pressable accessibilityRole="link" accessibilityState={{ selected: active === item.label }}
                style={({ pressed }) => [ui.navItem, pressed && ui.pressed]}>
                <Icon name={item.icon} color={active === item.label ? palette.accent : palette.muted} />
                <Text style={[ui.navLabel, active === item.label && { color: palette.accent }]}>{item.label}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

export function Poster({ item, featured = false }: { item: Title; featured?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.panel }]}>
      <View style={ui.placeholder} accessibilityElementsHidden={Boolean(item.poster && !failed)}
        importantForAccessibility={item.poster && !failed ? 'no-hide-descendants' : 'auto'}>
        <Text style={ui.monogram}>{item.title[0]}</Text>
        <Text style={ui.meta}>{item.demo ? 'Demo title' : 'Poster unavailable'}</Text>
      </View>
      {item.poster && !failed && (
        <Image source={item.poster} style={StyleSheet.absoluteFill} contentFit="cover"
          contentPosition={featured ? { top: '35%', left: '50%' } : 'center'}
          cachePolicy="memory-disk" transition={150} onError={() => setFailed(true)}
          accessibilityLabel={`${item.title} poster`} />
      )}
    </View>
  );
}

export function openTitle(item: Title) {
  router.push({ pathname: '/title/[type]/[id]', params: { type: item.type, id: item.id } });
}

export function MovieCard({ item }: { item: Title }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.title}`}
      onPress={() => openTitle(item)} style={({ pressed }) => [ui.card, pressed && ui.pressed]}>
      <View style={ui.poster}><Poster key={`${item.type}:${item.id}`} item={item} /></View>
      <Text style={ui.cardTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={ui.meta}>{item.year || 'TBA'} · {languages[item.language] || item.language.toUpperCase()}</Text>
    </Pressable>
  );
}

export function FeaturedTitle({ item, saved, busy, onSave }: {
  item: Title; saved: boolean; busy: boolean; onSave: () => void;
}) {
  return (
    <View style={ui.feature}>
      <Poster key={`${item.type}:${item.id}`} item={item} featured />
      <View style={ui.featureShade} />
      <Text style={ui.featureTag}>IN THE SPOTLIGHT</Text>
      <View style={ui.featureContent}>
        <Text style={ui.featureTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={ui.featureMeta}>{item.year || 'TBA'} · {languages[item.language] || item.language.toUpperCase()} · {item.type === 'movie' ? 'Film' : 'Series'}</Text>
        <View style={ui.featureActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Explore ${item.title}`} onPress={() => openTitle(item)}
            style={({ pressed }) => [ui.button, ui.featureButton, pressed && ui.pressed]}>
            <Text style={ui.buttonText}>Explore {item.type === 'movie' ? 'film' : 'series'}</Text>
            <Icon name="arrow" color={palette.onAccent} size={17} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Remove from watchlist' : 'Add to watchlist'}
            accessibilityState={{ selected: saved, disabled: busy }} disabled={busy} onPress={onSave}
            style={({ pressed }) => [ui.saveIcon, (pressed || busy) && ui.pressed]}>
            <Icon name={saved ? 'saved' : 'bookmark'} color={saved ? palette.accent : palette.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function SectionTitle({ title, caption }: { title: string; caption?: string }) {
  return <View style={ui.sectionTitle}><Text style={ui.sectionHeading}>{title}</Text>{caption && <Text style={ui.meta}>{caption}</Text>}</View>;
}

export function Message({ text, retry }: { text: string; retry?: () => void }) {
  return <View style={ui.message}><Text style={ui.body} accessibilityRole="alert">{text}</Text>
    {retry && <Pressable accessibilityRole="button" onPress={retry} style={ui.button}><Text style={ui.buttonText}>Try again</Text></Pressable>}
  </View>;
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 30, width: '100%', maxWidth: 760, alignSelf: 'center', flexGrow: 1 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 5, paddingBottom: 25 },
  brand: { color: palette.text, fontSize: 24, fontWeight: '800', letterSpacing: -1 },
  brandMark: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#343029', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#51463B' },
  kicker: { color: palette.accent, fontSize: 11, letterSpacing: 2, fontWeight: '600', marginBottom: 12 },
  heading: { color: palette.text, fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -1.3, marginBottom: 12 },
  editorial: { color: palette.accent, fontFamily: serif, fontStyle: 'italic', fontWeight: '400', letterSpacing: -1 },
  body: { color: palette.muted, fontSize: 14, lineHeight: 23 },
  introduction: { marginBottom: 20, maxWidth: 380 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: '#1D1C1B', borderRadius: 12, marginBottom: 19, minHeight: 50 },
  input: { flex: 1, minWidth: 0, color: palette.text, fontSize: 16, paddingVertical: 14 },
  types: { flexDirection: 'row', gap: 26, borderBottomWidth: 1, borderBottomColor: palette.border, marginBottom: 14 },
  typeButton: { minHeight: 44, paddingBottom: 12, paddingTop: 3, borderBottomWidth: 2, borderBottomColor: 'transparent', justifyContent: 'center' },
  typeSelected: { borderBottomColor: palette.accent },
  typeText: { color: palette.muted, fontSize: 14, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { borderRadius: 24, paddingHorizontal: 14, paddingVertical: 11, minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: palette.border },
  chipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  chipText: { color: palette.muted, fontWeight: '500', fontSize: 12 },
  selectedText: { color: palette.onAccent },
  feature: { minHeight: 250, borderRadius: 16, overflow: 'hidden', backgroundColor: palette.panel, justifyContent: 'flex-end', marginBottom: 26 },
  featureShade: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, backgroundColor: '#00000038' },
  featureTag: { position: 'absolute', top: 16, left: 16, backgroundColor: '#151515B8', color: palette.text, fontSize: 10, fontWeight: '600', letterSpacing: 1.5, padding: 8, borderRadius: 5 },
  featureContent: { padding: 20, paddingTop: 14, marginTop: 85, backgroundColor: '#151515AD' },
  featureTitle: { color: palette.text, fontFamily: serif, fontSize: 29, lineHeight: 33, marginBottom: 8 },
  featureMeta: { color: '#E0D7CA', fontSize: 12, marginBottom: 16 },
  featureActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  featureButton: { flexDirection: 'row', gap: 10, alignSelf: 'flex-start' },
  saveIcon: { borderWidth: 1, borderColor: '#F5EFE44A', borderRadius: 9, width: 46, height: 46, backgroundColor: '#F5EFE41A', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 15 },
  sectionHeading: { color: palette.text, fontSize: 18, fontWeight: '600', letterSpacing: -0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 22, marginBottom: 20 },
  card: { width: '30.8%', maxWidth: 215 },
  poster: { aspectRatio: 2 / 3, backgroundColor: palette.panel, borderRadius: 10, overflow: 'hidden' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 10 },
  monogram: { fontFamily: serif, color: palette.accent, fontSize: 40 },
  cardTitle: { color: palette.text, fontSize: 13, fontWeight: '600', marginTop: 9, lineHeight: 18 },
  meta: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  notice: { color: palette.muted, backgroundColor: palette.panel, padding: 14, borderRadius: 10, fontSize: 12, lineHeight: 20, marginBottom: 20 },
  message: { paddingVertical: 28, gap: 16 },
  button: { backgroundColor: palette.accent, minHeight: 46, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: palette.onAccent, fontWeight: '700', fontSize: 13 },
  navigation: { borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: '#1B1A18', paddingTop: 8 },
  navigationInner: { flexDirection: 'row', width: '100%', maxWidth: 760, alignSelf: 'center', justifyContent: 'space-around' },
  navItem: { flex: 1, minWidth: 0, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 5 },
  navLabel: { color: palette.muted, fontSize: 11 },
  footer: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 22, marginTop: 8, gap: 9, flexDirection: 'row', alignItems: 'center' },
  pressed: { opacity: 0.65 },
});
