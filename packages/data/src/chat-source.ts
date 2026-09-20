/**
 * `@app/data` — data-access contract shared by every app in the monorepo.
 *
 * UI code (web or mobile) programs against `ChatDataSource`, never against a
 * Firebase SDK directly. Each platform provides its own implementation:
 *
 * - `WebChatDataSource` (`./web-source`) — Firebase JS SDK, IndexedDB
 *   persistent cache. Powers the Next.js app.
 * - `NativeChatDataSource` (`./native-source`) — stub. Wire it to
 *   `@react-native-firebase/*` (SQLite persistence + FCM) for `apps/mobile`.
 *
 * Framework-free contract: only `@app/schema` types cross this boundary.
 */

import type {
  Chat,
  Contact,
  Message,
  WaAccount,
  WithId,
} from "../../schema/src/index";

/** Cancels a live subscription. Call on unmount / app background. */
export type Unsubscribe = () => void;

export type DataErrorHandler = (err: unknown) => void;

/** One window of the chats list (limit-growth pagination). */
export interface PagedChats {
  chats: WithId<Chat>[];
  /** True when another page probably exists (`snapshot.size >= pageSize`). */
  hasMore: boolean;
}

/** Exact server-side totals (aggregations — no document downloads). */
export interface ChatTotals {
  totalChats: number;
  unreadTotal: number;
}

/** Totals plus the explicit-override split for bot-status math. */
export interface ChatBreakdown extends ChatTotals {
  /** Docs with `bot_active == true`. */
  explicitActive: number;
  /** Docs with `bot_active == false`. */
  explicitPaused: number;
  /**
   * Docs with `bot_active` unset = `total - explicitActive - explicitPaused`.
   * Derived client-side so callers can apply the default-policy fallback:
   * `active = explicitActive + (defaultPolicyActive ? defaultCount : 0)`.
   */
}

/** Everything a thread screen needs in one snapshot. */
export interface ThreadSnapshot {
  chat: Chat | null;
  contact: Contact | null;
  account: WaAccount | null;
  messages: WithId<Message>[];
  hasMoreMessages: boolean;
}

export interface ChatDataSource {
  // -- Account --------------------------------------------------------------
  /** Live account doc (bot policies). Single tiny doc; safe to keep live. */
  subscribeAccount(
    waId: string,
    onData: (account: WaAccount | null) => void,
    onError?: DataErrorHandler
  ): Unsubscribe;

  // -- Chats list -----------------------------------------------------------
  /** Instant paint from the offline cache, then live listeners reconcile. */
  hydrateChatsCacheFirst(
    waId: string,
    pageSize: number
  ): Promise<{
    chats: WithId<Chat>[];
    contacts: Record<string, Contact>;
    account: WaAccount | null;
    hasMore: boolean;
  }>;
  /** Live, paged chats subscription (newest first). */
  subscribeChats(
    waId: string,
    pageSize: number,
    onData: (page: PagedChats) => void,
    onError?: DataErrorHandler
  ): Unsubscribe;
  /** Live contacts map (names, photos) for the loaded chats. */
  subscribeContacts(
    waId: string,
    onData: (contacts: Record<string, Contact>) => void,
    onError?: DataErrorHandler
  ): Unsubscribe;
  fetchChatTotals(waId: string): Promise<ChatTotals>;
  fetchChatBreakdown(waId: string): Promise<ChatBreakdown>;
  fetchTodayCount(waId: string): Promise<number>;

  // -- Thread ---------------------------------------------------------------
  hydrateThreadCacheFirst(
    waId: string,
    userPhone: string,
    messageLimit: number
  ): Promise<ThreadSnapshot>;
  subscribeThread(
    waId: string,
    userPhone: string,
    messageLimit: number,
    onData: (snap: ThreadSnapshot) => void,
    onError?: DataErrorHandler
  ): Unsubscribe;

  // -- Writes (same queue contract the Go backend consumes) -----------------
  /** `null` resets to the account default policy. */
  setBotActive(
    waId: string,
    userPhone: string,
    next: boolean | null
  ): Promise<void>;
  /** `null` clears the override (falls back to the default prompt). */
  setCustomPrompt(
    waId: string,
    userPhone: string,
    promptId: string | null
  ): Promise<void>;
  markChatRead(waId: string, userPhone: string): Promise<void>;
  /** Assigns a folder tab; `null` clears it (back to the default view). */
  setChatFolder(
    waId: string,
    userPhone: string,
    folderKey: string | null
  ): Promise<void>;
  /** Local display name; `null` clears it (falls back to synced name). */
  setContactDisplayName(
    waId: string,
    userPhone: string,
    name: string | null
  ): Promise<void>;
  /** Queues to `wa_bot/recent-chat/all` + writes a local `pending` message. */
  sendManualReply(waId: string, userPhone: string, text: string): Promise<void>;
}
