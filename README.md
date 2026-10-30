# myArqiv

A student portfolio app for discovering and collecting films and series across languages and borders, including Tamil cinema and Korean films and series.

## Features

- Discovery and search for films and series, with language filters and continuous scrolling.
- Details, posters, original titles, genres, TMDB ratings and cast images when available.
- YouTube playback with Watch here / Open in YouTube, original-language trailers and a starter set of official song links.
- Email/password accounts backed by Supabase Auth, with email confirmation and a unique username.
- A private Watchlist for each account.
- A watched Library: marking a title as watched moves it out of Watchlist. Films and series can be filtered separately.
- A Profile with an editable display name, real collection counts and a watched-history sharing setting.
- Username search, mutual friend requests and friends’ shared watched titles. Watchlists stay private.
- Direct movie/series recommendations to accepted friends, with an optional note and a private inbox.
- A native Clips prototype with swipe playback, pause/seeking, compact controls and openly licensed test trailers.
- About and TMDB attribution are accessible from Profile.
- A local Node backend with SQLite storage, shared expiring TMDB response caching, request deduplication, throttling and sanitised errors.
- Clearly labelled fictional demo titles when no TMDB credential is configured.

## Run locally

Requires Node.js 24 or newer. Open this folder in VS Code and install dependencies:

```sh
npm install
```

Start the backend in one terminal:

```sh
npm run server
```

In another terminal, start Expo:

```sh
npx expo start
```

Keep the phone and computer on the same Wi-Fi. The mobile app normally discovers the backend host from Expo. If needed, copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to your computer's LAN address, for example `http://192.168.1.10:4000`. Restart Expo after changing it. Expo tunnelling only exposes Metro, not this separate backend.

## Connect Supabase accounts

1. Create a Supabase project. Copy `.env.example` to `.env` and set the project URL and **publishable key**. These two values are public client configuration. Never use the database password, secret key or `service_role` key in the app.
2. Run `supabase/migrations/202610290001_accounts_and_friends.sql` once in that project's SQL editor. It creates four tables, access policies and two write functions in one transaction. Do not re-run it on a project where it has already been applied.
3. Keep email/password sign-in and email confirmation enabled in Authentication → Sign In / Providers. The app asks for at least 12 password characters; configure the server-side password minimum too before a public launch.
4. Configure Authentication → URL Configuration with your actual app website when deployed. During local development the confirmation email may redirect to Supabase's default `localhost:3000` after confirming. Return to myArqiv and sign in with your email/password; the app does not depend on that redirect or consume email-link tokens.
5. Restart Expo after changing `.env`. Open Profile → Sign in / Create account, confirm the email, sign in and choose a username.

**Email delivery:** Supabase's default sender is limited to project team addresses and has a small sending quota. Configure custom SMTP under Authentication → Emails → SMTP Settings before inviting friends to register. See [Supabase's email delivery guide](https://supabase.com/docs/guides/auth/auth-smtp). Do not disable email confirmation to bypass delivery setup. No email provider or paid plan is configured by this repository.

On native devices, sessions are stored in Expo SecureStore using small encrypted chunks with an atomic manifest. On web they use tab-scoped sessionStorage; closing the tab ends that stored session. The SDK refreshes tokens. The navigator remounts private screens when accounts change so another account does not inherit their state.

`profiles` contains only app identity and the sharing preference; email/password remain in Supabase Auth. Authenticated users can find usernames. Collections are owned by the signed-in user. A pending request grants no watched access; both users must connect first. Only accepted friends can see shared watched entries. Turning sharing off or removing a friend revokes that access at the database, including per-title watched checks. A series is marked as watched as a whole; episode progress is not tracked.

Recommendations are visible to sender and recipient only and can only be sent between accepted friends. Previously delivered recommendations remain in the participants' inboxes after unfriending. Titles store a small metadata snapshot with a constrained TMDB poster URL, not a full catalogue mirror. No public emails or Watchlists are exposed.

The old shared SQLite Watchlist, Library and display name are preserved locally but are **not assigned to any account**. Their old HTTP endpoints return 410; only the public catalogue and video metadata remain on the local backend. A future import must let the user explicitly choose which old shared entries belong to them.

## Enable real TMDB data

Copy `server/.env.example` to `server/.env`. Enter either your TMDB API Read Access Token as `TMDB_READ_ACCESS_TOKEN`, or your v3 API key as `TMDB_API_KEY`. Leave the other field empty. Restart the backend. Do not put credentials in `EXPO_PUBLIC_` variables, source code, screenshots or GitHub.

Without a credential, the backend uses fictional demo records. Demo and TMDB watchlists and libraries are kept separate.

## YouTube playback

No YouTube API key is needed for this first version. Movie and series pages load their associated YouTube videos from TMDB, using the title's original language plus English. The backend shares cached video metadata for six hours; it does not fetch or proxy video/audio files.

TMDB does not provide complete soundtracks. `server/song-links.mjs` contains a small editorial starter collection keyed by TMDB media type and ID: Karnan (2021), with Kandaa Vara Sollunga, and Vikram (2022), with Pathala Pathala. Each link was checked against the official label's YouTube upload. Extend this file with verified links; never guess a video ID or treat an unrelated search result as a soundtrack. Other titles can still show their TMDB trailers and provide Find more songs on YouTube. The main trailer section selects one upload marked official, preferring the title’s original language, then English. Teasers and alternate versions stay under More videos; a mislabeled teaser is never promoted to the main trailer. TMDB song candidates must be marked official, explicitly named as song/lyric/music videos, and exclude covers, promos and making-ofs. These are conservative metadata filters, not verification of a YouTube channel or a complete soundtrack. This is not automatic YouTube song discovery or a complete music catalogue.

Watch here opens the official YouTube IFrame player only after a tap. Closing the player, navigating away or backgrounding the app destroys it. Ads and controls remain YouTube's. Removed, restricted, region-blocked or non-embeddable uploads may need the Open in YouTube fallback. That action attempts the installed YouTube app and falls back to its HTTPS watch page. Premium recognition inside the embedded player is not guaranteed; the app does not access YouTube account credentials.

Native embeds use the installed app's actual application ID (including Expo Go during development) as the HTTPS base URL for YouTube's required referrer identification. Web embeds use the page's origin. Native HTML uses `strict-origin-when-cross-origin`; the web player uses the browser’s default referrer policy, which must not suppress the referrer. `react-native-webview` and `expo-application` are included in Expo Go SDK 58. Test playback on a physical iOS and Android device before release; a bundle export does not verify native playback.

If automatic song lookup is added later, keep its YouTube Data API key on the backend, use a shared bounded cache, account for the separate search quota, and refresh/delete API-derived stored metadata within YouTube's applicable retention period. No additional key is read or required by this implementation.

## Clips playback prototype

**Clips** now opens a native swipe feed powered by Expo Video (included in Expo Go SDK 58). It uses two complete, openly licensed Blender trailers as interaction samples: Sintel and Big Buck Bunny. These are explicitly test footage, not an automated movie-clip catalogue. Full source URLs and credits are in `src/lib/native-clip-samples.ts`. Native autoplay, silent-switch audio, swiping and stop-on-leave were confirmed on the user’s phone on 2026-10-29; the newer pause/seek/crop controls still need a phone check. Both are CC BY 3.0; retain their attribution and credit sequences when sharing. See [Sintel credits/licence](https://durian.blender.org/about/), [Big Buck Bunny credits/licence](https://peach.blender.org/about/) and [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).

On iOS/Android, playback starts unmuted in the feed without opening a modal or website. The feed has no heading or separate title panel. Videos show their complete frame by default to avoid extreme landscape crops on phones. Portrait footage naturally fills a portrait display; these two current fixtures are landscape. While paused, **Fill** opts into a crop and **Fit** restores the original frame. Tap the video or pause control to pause/resume, drag the thin white progress bar at any time, or use the ten-second back/forward controls shown only while paused. Seeking preserves a manual pause and cannot restart a clip after focus loss. Swiping to a different clip starts that clip automatically. The compact movie title opens its explicitly mapped TMDB detail page, and a compact information button opens the creator credit, original trailer, source and CC BY 3.0 licence. About also lists these credits separately from YouTube playback. The large on-video copyright row is removed; attribution remains available for each actual source. The two-player pool preloads the samples and pauses all players before starting a settled page. Scrolling, leaving Clips, losing app focus, opening an external credit page, or pressing Pause revokes playback immediately. Native players release on unmount. Background audio, picture-in-picture and lock-screen playback are disabled. Expo Video uses iOS's media playback audio session, which permits sound while the silent switch is on. Hardware media volume remains under the user's control; the app never changes device volume. Physical-device testing is still required to verify this behavior in Expo Go and release builds. The web preview uses browser video and handles browsers that require an initial gesture for audible autoplay.

The separate `/clips-youtube` comparison route preserves the earlier landscape Wednesday scene and portrait Jailer behind-the-scenes upload. Those official embeds start muted, can need taps, show YouTube controls/ads, and may capture swipes. They cannot provide the same native controls over sound and gestures. No YouTube files are extracted, proxied, downloaded or rehosted. Existing title-page YouTube songs/trailers still use their original click-to-play player.

Native sample streams are played from Blender's official HTTPS servers with no persistent video cache. At most two samples are loaded; a production feed needs a bounded current/next player pool, suitable hosting/CDN and authorization from publishers for its video streams. This prototype makes no TMDB requests per swipe. Likes, comments, direct chats, sharing links, personalised ranking and the Library merge remain outside this test.

## Scope and limitations

This is a development prototype with hosted account storage, not a deployed public service. The local catalogue backend still needs hosting, HTTPS and abuse controls before public deployment. Email delivery, password recovery, account deletion, blocking/reporting and moderation are not implemented as complete public release workflows yet. Use it for development and testing until those are ready.

SQLite caches public catalogue data; Supabase stores accounts and social data. Reviews, comments, actor social profiles, personalised discovery and bulk imports/incremental synchronisation are not implemented yet.

Discover appends the next page near the bottom without replacing existing results. Changing search, language or media type resets the feed and cancels the old request. Search is debounced, duplicate titles are removed, and failed requests require an explicit retry. TMDB limits discovery/search to the first 500 pages; reaching the end shows a message.

The backend currently caches lists for 15 minutes and title details for 6 hours. Expired entries are removed during successful upstream fetches. Watchlist snapshots persist separately; retention and refresh policies must be reconciled with the accepted TMDB terms before public deployment or catalogue-scale imports. No full TMDB mirror or Kaggle dataset is included.

## Checks

```sh
npm run lint
npm run typecheck
npm run test:server
npm run test:feed
npm run test:youtube
npm run test:permissions
npm run test:session
npm run test:clips
npx expo export --platform web
```

Tests cover the preserved SQLite collection archive, closed legacy HTTP endpoints, search filters, upstream cache sharing, credential-safe errors, pagination deduplication, stale responses and retry behavior. The permission suite runs the exact migration in local PostgreSQL via PGlite and checks owner isolation, pending/accepted requests, recipient-only acceptance, Watchlist privacy, sharing changes, unfriending and recommendation ownership. Session tests cover large Unicode values, partial writes, missing chunks, refresh and logout. These tests use local fixtures and do not create hosted accounts or send emails. Live credentials are not needed.

YouTube tests cover safe video IDs, language-aware shared metadata caching, deduplication, source separation, graceful metadata failures, player origin validation and actionable playback errors.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

The bundled TMDB logo is unmodified and sourced from TMDB's official logo asset. It remains subject to TMDB's branding terms. Movie data and images remain subject to the relevant third-party terms; the source code licence does not grant rights to them.

Videos play through YouTube and remain subject to the [YouTube Terms of Service](https://www.youtube.com/t/terms) and [Google Privacy Policy](https://policies.google.com/privacy).

This is an independent project by a B.Sc. Computer Engineering student at USN, not an official university product.
