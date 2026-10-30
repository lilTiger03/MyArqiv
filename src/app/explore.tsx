import { Image } from 'expo-image';
import { ClipCreditDetails } from '@/components/clip-credits';
import { nativeClipSamples } from '@/lib/native-clip-samples';
import { Linking, Pressable, Text, View } from 'react-native';
import { AppShell, Icon, SectionTitle, ui, palette } from '@/components/catalogue-ui';

export default function AboutScreen() {
  return (
    <AppShell active="Profile">
      <Text style={ui.kicker}>MADE FOR THE LOVE OF STORIES</Text>
      <Text style={ui.heading}>Your films.{'\n'}<Text style={ui.editorial}>Your world.</Text></Text>
      <Text style={[ui.body, ui.introduction]}>A home for everything you want to watch, wherever it comes from.</Text>
      <Text style={[ui.body, { marginBottom: 30 }]}>Discover films and series, build your watchlist and explore cinema beyond the familiar.</Text>
      <SectionTitle title="Film & television data" />
      <Image source={require('@/assets/images/tmdb-logo.svg')} style={{ width: 145, height: 28, marginVertical: 12 }} contentFit="contain" accessibilityLabel="The Movie Database" />
      <Text style={ui.body}>This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://www.themoviedb.org')}
        style={({ pressed }) => [ui.chip, { alignSelf: 'flex-start', marginTop: 20, flexDirection: 'row', gap: 10, alignItems: 'center' }, pressed && ui.pressed]}>
        <Text style={ui.chipText}>Visit TMDB</Text><Icon name="arrow" size={15} />
      </Pressable>
      <View style={{ marginTop: 30 }}>
        <SectionTitle title="Trailers & songs" caption="YouTube" />
        <Text style={ui.body}>Movie-page trailers and songs play through YouTube. The uploader controls availability, and YouTube may show ads. Open in YouTube to use your account in the YouTube app.</Text>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://www.youtube.com/t/terms')} style={{ paddingVertical: 12, minHeight: 44 }}><Text style={[ui.body, { color: palette.accent }]}>YouTube Terms of Service ↗</Text></Pressable>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://policies.google.com/privacy')} style={{ paddingVertical: 12, minHeight: 44 }}><Text style={[ui.body, { color: palette.accent }]}>Google Privacy Policy ↗</Text></Pressable>
      </View>
      <View style={{ marginTop: 30, gap: 20 }}>
        <SectionTitle title="Clips · sources & rights" caption="Open-film samples" />
        <Text style={ui.body}>The current Clips demo uses Blender’s openly licensed film trailers, streamed directly from the official source. These samples do not play through YouTube. Their creator, source and licence details are also available through each clip’s information button.</Text>
        {nativeClipSamples.map(clip => <ClipCreditDetails key={clip.id} clip={clip} />)}
      </View>
      <View style={{ marginTop: 36 }}>
        <SectionTitle title="An independent student project" />
        <Text style={ui.body}>Built while studying Computer Engineering at USN. This is an independent portfolio project, not an official university product.</Text>
        <Text style={[ui.meta, { marginTop: 20 }]}>Early development · Accounts, friends and direct recommendations are available. Reviews, discussions and personalised discovery are still to come.</Text>
      </View>
      <View style={ui.footer}><Icon name="globe" color={palette.accent} size={17} /><Text style={ui.meta}>Great cinema speaks every language.</Text></View>
    </AppShell>
  );
}
