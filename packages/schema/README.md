# `@app/schema`

Shared Firestore schema for every app in the monorepo (Next.js web today,
React Native tomorrow).

## Contents

- `src/firestore.ts` — document interfaces (`WaAccount`, `Chat`, `Contact`,
  `Message`, `Prompt`, …) plus `WithId<T>`.
- `src/firestore-paths.ts` — collection/document path builders. Import these
  instead of hand-writing path strings so web + mobile can never drift.

## Rules

1. Framework-free: only `firebase/*` types may be imported. No React, no
   Next.js, no UI.
2. Additive changes only — never rename/remove a field without checking both
   `firestore.rules` and every consumer.
3. The web app consumes this package through re-export shims
   (`src/types/firestore.ts`, `src/lib/firestore-paths.ts`) until the full
   workspace migration lands.

## Future mobile use

`apps/mobile` will import `@app/schema` directly. Path builders guarantee the
native app reads/writes the exact same documents the web app and the Go
backend use.
