# Mobile (Expo, read-first v1)

Native admin app sharing `@app/schema` and `@app/data` with the Next.js web
app. Screens: sign-in → accounts → chats list → thread. Bot controls, prompt
picker, and manual reply are intentionally stubbed (read-first scope).

## Prerequisites

1. **Firebase console (your action):** add an Android app and an iOS app to
   the SAME Firebase project as the web app, both with ID
   `com.annasblackhat.wabotadmin` (must match `android.package` /
   `ios.bundleIdentifier` in `app.json`).
2. Download `google-services.json` → `apps/mobile/google-services.json`
   and `GoogleService-Info.plist` → `apps/mobile/GoogleService-Info.plist`.
   Both are gitignored and must never be committed.
3. The admin UID rules in `firestore.rules` apply unchanged — sign in with
   an admin email.

## Dev build required (NOT Expo Go)

`@react-native-firebase` ships native code, so Expo Go cannot run this app.
Use a development build:

```sh
# from repo root
npx expo prebuild --clean          # one-time native folder generation (folders stay gitignored)
npx expo run:android                # or run:ios (needs Xcode 26.2+ per RNFirebase)
```

Then `npm start --workspace=mobile` (or `npx expo start` in `apps/mobile`)
and open the dev build. JS-only checks: `npx tsc --noEmit -p tsconfig.json`.

## Project map

- `app/` — expo-router routes: `index` (login), `accounts`, `[waId]/chats`
  (search + filter + load more), `[waId]/[userPhone]` (paged thread + mark
  read). `_layout.tsx` holds the auth gate.
- `src/firebase.ts` — native-configured `auth`/`db` singletons (no JS config).
- `src/data.ts` — `NativeChatDataSource` singleton + page sizes.
- `src/hooks.ts` — `useAuthState`, `useAccounts`, `useChatsList`, `useThread`
  (cache-first hydrate, live subscribe while mounted, limit-growth
  pagination — same semantics as web).
- `src/theme.ts` — tokens mirroring the web theme.

## Deferred (out of v1)

FCM push (foreground listeners only; all hooks detach on unmount),
bot toggle / prompt picker / manual reply UI (`NativeChatDataSource` throws
`not wired` for those), `expo start --web` (RNFirebase has no web support —
web stays on the Next.js app).
