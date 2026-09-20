/**
 * `NativeChatDataSource` — `ChatDataSource` backed by
 * `@react-native-firebase` (native SQLite persistence + FCM-ready).
 *
 * Read paths + `markChatRead` are implemented (mobile v1 is read-first).
 * Bot/prompt/manual-reply writes stay stubbed until the write UI lands.
 *
 * Native differences vs `WebChatDataSource`:
 * - Persistence is automatic (SQLite) — no `persistentLocalCache` setup.
 * - Offline writes queue natively and flush on reconnect.
 * - Listeners MUST be detached when the app backgrounds (no FCM in v1);
 *   screens do this via `useFocusEffect` cleanup or unmount.
 */

import {
  collection,
  doc,
  getAggregateFromServer,
  getCountFromServer,
  getDocFromCache,
  getDocFromServer,
  getDocsFromCache,
  getDocsFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  sum,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
  type Query,
} from "@react-native-firebase/firestore";
import {
  chatCollection,
  chatDoc,
  contactCollection,
  contactDoc,
  messagesCollection,
  waAccountDoc,
  type Chat,
  type Contact,
  type Message,
  type WaAccount,
  type WithId,
} from "../../schema/src/index";
import type {
  ChatBreakdown,
  ChatDataSource,
  ChatTotals,
  DataErrorHandler,
  PagedChats,
  ThreadSnapshot,
  Unsubscribe,
} from "./chat-source";

const report = (onError: DataErrorHandler | undefined, err: unknown) => {
  if (onError) onError(err);
  else console.error(err);
};

async function docCacheFirst<T>(ref: Parameters<typeof getDocFromCache>[0]) {
  try {
    const snap = await getDocFromCache(ref);
    return { data: (snap.exists() ? snap.data() : null) as T | null, exists: snap.exists() };
  } catch {
    const snap = await getDocFromServer(ref);
    return { data: (snap.exists() ? snap.data() : null) as T | null, exists: snap.exists() };
  }
}

async function queryCacheFirst<T>(q: Query<DocumentData>) {
  const toRows = (snap: Awaited<ReturnType<typeof getDocsFromCache>>) =>
    snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }) as WithId<T>);
  try {
    const snap = await getDocsFromCache(q);
    return { docs: toRows(snap), size: snap.size, empty: snap.empty };
  } catch {
    const snap = await getDocsFromServer(q);
    return { docs: toRows(snap), size: snap.size, empty: snap.empty };
  }
}

const byRecency = (a: WithId<Chat>, b: WithId<Chat>) =>
  (b.lastChatTime || 0) - (a.lastChatTime || 0);

function unimplemented(method: string, nativeHint: string): never {
  throw new Error(
    `[NativeChatDataSource] ${method} is not wired yet (mobile v1 is read-first). Native path: ${nativeHint}`
  );
}

export class NativeChatDataSource implements ChatDataSource {
  private readonly db: Firestore;

  constructor(db?: Firestore) {
    // Default instance is configured natively via google-services.json /
    // GoogleService-Info.plist (see apps/mobile/README.md). No JS config.
    this.db = db ?? getFirestore();
  }

  // -- Account --------------------------------------------------------------

  subscribeAccount(
    waId: string,
    onData: (account: WaAccount | null) => void,
    onError?: DataErrorHandler
  ): Unsubscribe {
    return onSnapshot(
      doc(this.db, waAccountDoc(waId)),
      (snap) => onData(snap.exists() ? (snap.data() as WaAccount) : null),
      (err) => report(onError, err)
    );
  }

  // -- Chats list (limit-growth pagination, same as web) ---------------------

  async hydrateChatsCacheFirst(waId: string, pageSize: number) {
    const [accountRes, chatsRes, contactsRes] = await Promise.all([
      docCacheFirst<WaAccount>(doc(this.db, waAccountDoc(waId))),
      queryCacheFirst<Chat>(
        query(
          collection(this.db, chatCollection(waId)),
          orderBy("lastChatTime", "desc"),
          limit(pageSize)
        )
      ),
      queryCacheFirst<Contact>(query(collection(this.db, contactCollection(waId)))),
    ]);
    const contacts: Record<string, Contact> = {};
    for (const c of contactsRes.docs) contacts[c.id] = c;
    return {
      chats: [...chatsRes.docs].sort(byRecency),
      contacts,
      account: accountRes.data,
      hasMore: chatsRes.size >= pageSize,
    };
  }

  subscribeChats(
    waId: string,
    pageSize: number,
    onData: (page: PagedChats) => void,
    onError?: DataErrorHandler
  ): Unsubscribe {
    return onSnapshot(
      query(
        collection(this.db, chatCollection(waId)),
        orderBy("lastChatTime", "desc"),
        limit(pageSize)
      ),
      (snap) => {
        const chats = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Chat) }) as WithId<Chat>
        );
        chats.sort(byRecency);
        onData({ chats, hasMore: snap.size >= pageSize });
      },
      (err) => report(onError, err)
    );
  }

  subscribeContacts(
    waId: string,
    onData: (contacts: Record<string, Contact>) => void,
    onError?: DataErrorHandler
  ): Unsubscribe {
    return onSnapshot(
      collection(this.db, contactCollection(waId)),
      (snap) => {
        const map: Record<string, Contact> = {};
        snap.docs.forEach((d) => {
          map[d.id] = d.data() as Contact;
        });
        onData(map);
      },
      (err) => report(onError, err)
    );
  }

  async fetchChatTotals(waId: string): Promise<ChatTotals> {
    const col = collection(this.db, chatCollection(waId));
    const [countSnap, unreadSnap] = await Promise.all([
      getCountFromServer(col),
      getAggregateFromServer(col, { total: sum("unreadCount") }),
    ]);
    return {
      totalChats: countSnap.data().count,
      unreadTotal: unreadSnap.data().total ?? 0,
    };
  }

  async fetchChatBreakdown(waId: string): Promise<ChatBreakdown> {
    const col = collection(this.db, chatCollection(waId));
    const [totals, activeSnap, pausedSnap] = await Promise.all([
      this.fetchChatTotals(waId),
      getCountFromServer(query(col, where("bot_active", "==", true))),
      getCountFromServer(query(col, where("bot_active", "==", false))),
    ]);
    return {
      ...totals,
      explicitActive: activeSnap.data().count,
      explicitPaused: pausedSnap.data().count,
    };
  }

  async fetchTodayCount(waId: string): Promise<number> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const snap = await getCountFromServer(
      query(
        collection(this.db, chatCollection(waId)),
        where("lastChatTime", ">=", startOfToday.getTime())
      )
    );
    return snap.data().count;
  }

  // -- Thread ---------------------------------------------------------------

  async hydrateThreadCacheFirst(
    waId: string,
    userPhone: string,
    messageLimit: number
  ): Promise<ThreadSnapshot> {
    const [chatRes, contactRes, accountRes, messagesRes] = await Promise.all([
      docCacheFirst<Chat>(doc(this.db, chatDoc(waId, userPhone))),
      docCacheFirst<Contact>(doc(this.db, contactDoc(waId, userPhone))),
      docCacheFirst<WaAccount>(doc(this.db, waAccountDoc(waId))),
      queryCacheFirst<Message>(
        query(
          collection(this.db, messagesCollection(waId, userPhone)),
          orderBy("timeMillis", "desc"),
          limit(messageLimit)
        )
      ),
    ]);
    return {
      chat: chatRes.data,
      contact: contactRes.data,
      account: accountRes.data,
      messages: [...messagesRes.docs].reverse(),
      hasMoreMessages: messagesRes.size >= messageLimit,
    };
  }

  subscribeThread(
    waId: string,
    userPhone: string,
    messageLimit: number,
    onData: (snap: ThreadSnapshot) => void,
    onError?: DataErrorHandler
  ): Unsubscribe {
    const state: ThreadSnapshot = {
      chat: null,
      contact: null,
      account: null,
      messages: [],
      hasMoreMessages: false,
    };
    const emit = () => onData({ ...state });

    const unsubs = [
      onSnapshot(
        doc(this.db, waAccountDoc(waId)),
        (s) => {
          state.account = s.exists() ? (s.data() as WaAccount) : null;
          emit();
        },
        (e) => report(onError, e)
      ),
      onSnapshot(
        doc(this.db, chatDoc(waId, userPhone)),
        (s) => {
          state.chat = s.exists() ? (s.data() as Chat) : null;
          emit();
        },
        (e) => report(onError, e)
      ),
      onSnapshot(
        doc(this.db, contactDoc(waId, userPhone)),
        (s) => {
          state.contact = s.exists() ? (s.data() as Contact) : null;
          emit();
        },
        (e) => report(onError, e)
      ),
      onSnapshot(
        query(
          collection(this.db, messagesCollection(waId, userPhone)),
          orderBy("timeMillis", "desc"),
          limit(messageLimit)
        ),
        (snap) => {
          state.messages = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Message) }) as WithId<Message>)
            .reverse();
          state.hasMoreMessages = snap.size >= messageLimit;
          emit();
        },
        (e) => report(onError, e)
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }

  // -- Writes -----------------------------------------------------------------

  async markChatRead(waId: string, userPhone: string): Promise<void> {
    await updateDoc(doc(this.db, chatDoc(waId, userPhone)), { unreadCount: 0 });
  }

  setBotActive(): Promise<never> {
    return unimplemented(
      "setBotActive",
      "firestore().doc(chatDoc(waId, userPhone)).update({ bot_active: next })"
    );
  }

  setCustomPrompt(): Promise<never> {
    return unimplemented(
      "setCustomPrompt",
      "firestore().doc(chatDoc(waId, userPhone)).update({ custom_prompt_id: promptId })"
    );
  }

  sendManualReply(): Promise<never> {
    // Note: no manual `pending` bookkeeping needed — the native SDK queues
    // offline writes and flushes on reconnect automatically.
    return unimplemented(
      "sendManualReply",
      "add to wa_bot/recent-chat/all via firestore().collection(...).add(...) then write the local message doc"
    );
  }
}
