/**
 * Cache-first Firestore read helpers (canonical copy — `@app/data`).
 *
 * The web SDK is initialized with `persistentLocalCache`, so reads can be
 * served instantly from the on-device IndexedDB cache and reconciled with
 * the server afterwards.
 *
 * Pattern: hydrate UI from cache first (no spinner on repeat visits), then
 * attach the regular `onSnapshot` listener which delivers the live server
 * state. These helpers centralize the try-cache-then-server fallback so call
 * sites stay small.
 *
 * NOTE: framework-free apart from the Firebase JS SDK. The native app gets
 * the same semantics via `get({ source: "cache" })` in `native-source.ts`.
 */

import {
  getDocFromCache,
  getDocFromServer,
  getDocsFromCache,
  getDocsFromServer,
  type DocumentReference,
  type Query,
  type QuerySnapshot,
  type DocumentData,
} from "firebase/firestore";
import type { WithId } from "../../schema/src/index";

/** Where a read was served from. */
export type CacheSource = "cache" | "server";

export interface CachedDoc<T> {
  data: T | null;
  exists: boolean;
  source: CacheSource;
}

export interface CachedQuery<T> {
  docs: WithId<T>[];
  size: number;
  empty: boolean;
  source: CacheSource;
}

/** Map a query snapshot to `WithId<T>` rows (same shape used across the app). */
export function snapshotToWithId<T>(snap: QuerySnapshot<DocumentData>): WithId<T>[] {
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
}

/**
 * Read a single document from the local cache first, falling back to the
 * server when it is not cached (e.g. cold start) or the cache read fails.
 */
export async function getDocCacheFirst<T>(
  ref: DocumentReference<DocumentData>
): Promise<CachedDoc<T>> {
  try {
    const snap = await getDocFromCache(ref);
    return {
      data: snap.exists() ? (snap.data() as T) : null,
      exists: snap.exists(),
      source: "cache",
    };
  } catch {
    const snap = await getDocFromServer(ref);
    return {
      data: snap.exists() ? (snap.data() as T) : null,
      exists: snap.exists(),
      source: "server",
    };
  }
}

/**
 * Read a query from the local cache first, falling back to the server when
 * the cache has no coverage for it.
 */
export async function getQueryCacheFirst<T>(
  q: Query<DocumentData>
): Promise<CachedQuery<T>> {
  try {
    const snap = await getDocsFromCache(q);
    return {
      docs: snapshotToWithId<T>(snap),
      size: snap.size,
      empty: snap.empty,
      source: "cache",
    };
  } catch {
    const snap = await getDocsFromServer(q);
    return {
      docs: snapshotToWithId<T>(snap),
      size: snap.size,
      empty: snap.empty,
      source: "server",
    };
  }
}
