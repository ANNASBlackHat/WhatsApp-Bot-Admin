/**
 * `@app/schema` — shared Firestore schema for every app in the monorepo.
 *
 * Canonical, framework-free definitions: document types (`firestore.ts`) and
 * collection path builders (`firestore-paths.ts`). No React, no Next.js, no
 * UI — only `firebase/*` types.
 */
export * from "./firestore";
export * from "./firestore-paths";
export * from "./chat-helpers";
