# `@app/data`

Shared data-access layer. UI code (web or mobile) programs against the
`ChatDataSource` interface in `src/chat-source.ts` and never imports a
Firebase SDK directly.

## Contents

- `src/chat-source.ts` — the contract: paged chats, thread snapshots,
  server-side totals, and the write queue (`setBotActive`, `setCustomPrompt`,
  `markChatRead`, `sendManualReply`, `setChatFolder`, `setContactDisplayName`).
- `src/web-source.ts` — real implementation on the Firebase JS SDK
  (IndexedDB persistent cache). Mirrors `src/lib/chats-context.tsx`,
  the contact thread page, and `src/components/manual-reply-bar.tsx`.
- `src/native-source.ts` — `@react-native-firebase` implementation for
  `apps/mobile`: reads, `markChatRead`, and `sendManualReply` are wired;
  bot/prompt/folder/rename writes stay stubbed (each names the native
  mapping to implement).

## Web vs native

| Concern | Web (`WebChatDataSource`) | Mobile (future) |
|---|---|---|
| SDK | `firebase` (JS) | `@react-native-firebase/*` |
| Offline cache | IndexedDB `persistentLocalCache` | SQLite (native, faster cold start) |
| Cache-first | `getDocsFromCache` → server fallback | `get({ source: "cache" })` → server fallback |
| Realtime | always-on `onSnapshot` | subscribe on foreground, detach on background, FCM wakes the app |
| Totals | `getCountFromServer` / `sum()` | RNFirebase aggregation parity is limited — prefer Cloud Function counters |
| Offline writes | manual `pending` correlation | native queue flushes automatically |
| Auth token | web storage | Keychain / Keystore |

## Migration path for the web app

- [x] `src/lib/firestore-cache.ts` moved here as `src/cache.ts` (web consumes
  via re-export shim).
- [x] `ChatsProvider` reimplemented on `WebChatDataSource`
  (`hydrateChatsCacheFirst` + `subscribeChats`/`subscribeContacts`/`subscribeAccount`
  + `fetchChatTotals`). Public `useChats()` shape unchanged.
- [x] `apps/mobile` (Expo) implements the read-first screens on
  `NativeChatDataSource` reusing `@app/schema` paths, plus the thread
  composer (`sendManualReply` is now wired natively).

Remaining:

3. Thread page uses `hydrateThreadCacheFirst` + `subscribeThread` (web still
   wires its five listeners directly — behavior identical, migration optional).
4. Bot/prompt/folder/rename UI on mobile (stubs throw `not wired` today;
   folder tabs render read-only over the same loaded window, rename UI is
   web-only).
