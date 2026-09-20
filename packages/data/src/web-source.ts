/**
 * `WebChatDataSource` — `ChatDataSource` backed by the Firebase JS SDK.
 *
 * Mirrors the patterns already proven in the Next.js app:
 * `src/lib/chats-context.tsx` (paged chats + aggregations),
 * `src/app/[waId]/contacts/[userPhone]/page.tsx` (thread),
 * `src/components/manual-reply-bar.tsx` (outbox write).
 *
 * Construct with the app's Firestore instance (which should use
 * `persistentLocalCache`, see `src/lib/firebase.ts`).
 */

import {
  addDoc,
  collection,
  doc,
  getAggregateFromServer,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  sum,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { getDocCacheFirst, getQueryCacheFirst } from "./cache";
import {
  chatCollection,
  chatDoc,
  contactCollection,
  contactDoc,
  messagesCollection,
  outgoingMessageCollection,
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

const byRecency = (a: WithId<Chat>, b: WithId<Chat>) =>
  (b.lastChatTime || 0) - (a.lastChatTime || 0);

export class WebChatDataSource implements ChatDataSource {
  constructor(private readonly db: Firestore) {}

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

  // -- Chats list -----------------------------------------------------------

  async hydrateChatsCacheFirst(waId: string, pageSize: number) {
    const [accountRes, chatsRes, contactsRes] = await Promise.all([
      getDocCacheFirst<WaAccount>(doc(this.db, waAccountDoc(waId))),
      getQueryCacheFirst<Chat>(
        query(
          collection(this.db, chatCollection(waId)),
          orderBy("lastChatTime", "desc"),
          limit(pageSize)
        )
      ),
      getQueryCacheFirst<Contact>(query(collection(this.db, contactCollection(waId)))),
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
    const q = query(
      collection(this.db, chatCollection(waId)),
      orderBy("lastChatTime", "desc"),
      limit(pageSize)
    );
    return onSnapshot(
      q,
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
      getDocCacheFirst<Chat>(doc(this.db, chatDoc(waId, userPhone))),
      getDocCacheFirst<Contact>(doc(this.db, contactDoc(waId, userPhone))),
      getDocCacheFirst<WaAccount>(doc(this.db, waAccountDoc(waId))),
      getQueryCacheFirst<Message>(
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

  async setBotActive(
    waId: string,
    userPhone: string,
    next: boolean | null
  ): Promise<void> {
    const ref = doc(this.db, chatDoc(waId, userPhone));
    await updateDoc(ref, { bot_active: next }).catch(async () => {
      await setDoc(ref, { bot_active: next }, { merge: true });
    });
  }

  async setCustomPrompt(
    waId: string,
    userPhone: string,
    promptId: string | null
  ): Promise<void> {
    const ref = doc(this.db, chatDoc(waId, userPhone));
    await updateDoc(ref, { custom_prompt_id: promptId }).catch(async () => {
      await setDoc(ref, { custom_prompt_id: promptId }, { merge: true });
    });
  }

  async markChatRead(waId: string, userPhone: string): Promise<void> {
    await updateDoc(doc(this.db, chatDoc(waId, userPhone)), { unreadCount: 0 });
  }

  async setChatFolder(
    waId: string,
    userPhone: string,
    folderKey: string | null
  ): Promise<void> {
    const ref = doc(this.db, chatDoc(waId, userPhone));
    await updateDoc(ref, { folder: folderKey }).catch(async () => {
      await setDoc(ref, { folder: folderKey, phone: userPhone }, { merge: true });
    });
  }

  async setContactDisplayName(
    waId: string,
    userPhone: string,
    name: string | null
  ): Promise<void> {
    const ref = doc(this.db, contactDoc(waId, userPhone));
    // `null` clears the field so the display falls back to the synced name.
    await updateDoc(ref, { display_name: name }).catch(async () => {
      await setDoc(ref, { display_name: name, phone: userPhone }, { merge: true });
    });
  }

  async sendManualReply(waId: string, userPhone: string, text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = Date.now();

    // 1. Outbox queue consumed by the Go backend.
    await addDoc(collection(this.db, outgoingMessageCollection()), {
      from: waId,
      to: userPhone,
      message: trimmed,
      timestamp: now,
    });

    // 2. Optimistic local message (correlated/deleted once confirmed).
    const msgRef = doc(collection(this.db, messagesCollection(waId, userPhone)));
    await setDoc(msgRef, {
      message: trimmed,
      sender: waId,
      userType: "admin",
      timeMillis: now,
      status: "pending",
      messageId: msgRef.id,
    });

    // 3. Keep the list preview in sync.
    const chatRef = doc(this.db, chatDoc(waId, userPhone));
    await updateDoc(chatRef, {
      lastChatMessage: trimmed,
      lastChatTime: now,
    }).catch(async () => {
      await setDoc(
        chatRef,
        { lastChatMessage: trimmed, lastChatTime: now, phone: userPhone },
        { merge: true }
      );
    });
  }
}
