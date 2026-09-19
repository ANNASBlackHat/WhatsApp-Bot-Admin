"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  collection,
  doc,
  getAggregateFromServer,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  sum,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getDocCacheFirst, getQueryCacheFirst } from "@/lib/firestore-cache";
import { chatCollection, contactCollection, waAccountDoc } from "@/lib/firestore-paths";
import { Chat, Contact, WaAccount, WithId } from "@/types/firestore";

/**
 * Number of chats loaded per page.
 *
 * The chats list uses limit-growth pagination: the live query starts at one
 * page and `"Load more"` widens the `limit()` instead of cursoring with
 * `startAfter()`. This keeps realtime updates correct (no duplicates, no
 * missed writes) while bounding the initial download on cellular/slow links.
 */
export const CHATS_PAGE_SIZE = 50;

interface ChatsContextType {
  account: WaAccount | null;
  /** Currently loaded page(s) of chats, newest first. */
  chats: WithId<Chat>[];
  contactsMap: Record<string, Contact>;
  /** Exact server-side unread total (aggregation — no document downloads). */
  totalUnreadCount: number;
  /** Exact server-side chat total; `null` until the first count resolves. */
  totalChatsCount: number | null;
  loading: boolean;
  error: string | null;
  /** Pagination state for the chats list. */
  hasMoreChats: boolean;
  loadingMoreChats: boolean;
  loadMoreChats: () => void;
}

const ChatsContext = createContext<ChatsContextType>({
  account: null,
  chats: [],
  contactsMap: {},
  totalUnreadCount: 0,
  totalChatsCount: null,
  loading: true,
  error: null,
  hasMoreChats: true,
  loadingMoreChats: false,
  loadMoreChats: () => {},
});

const chatsCollection = (waId: string) => collection(db, chatCollection(waId));

export function ChatsProvider({
  waId,
  children,
}: {
  waId?: string;
  children: React.ReactNode;
}) {
  const [account, setAccount] = useState<WaAccount | null>(null);
  const [chats, setChats] = useState<WithId<Chat>[]>([]);
  const [contactsMap, setContactsMap] = useState<Record<string, Contact>>({});
  const [loading, setLoading] = useState<boolean>(Boolean(waId));
  const [error, setError] = useState<string | null>(null);
  const [totalChatsCount, setTotalChatsCount] = useState<number | null>(null);
  const [totalUnreadCount, setTotalUnreadCount] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(CHATS_PAGE_SIZE);
  const [hasMoreChats, setHasMoreChats] = useState<boolean>(true);
  const [loadingMoreChats, setLoadingMoreChats] = useState<boolean>(false);

  // Exact server-side totals via aggregations (no document downloads).
  const refreshTotals = useCallback(
    async (id: string, signal: { cancelled: boolean }) => {
      try {
        const [countSnap, unreadSnap] = await Promise.all([
          getCountFromServer(chatsCollection(id)),
          getAggregateFromServer(chatsCollection(id), {
            total: sum("unreadCount"),
          }),
        ]);
        if (signal.cancelled) return;
        setTotalChatsCount(countSnap.data().count);
        setTotalUnreadCount(unreadSnap.data().total ?? 0);
      } catch (err) {
        console.error("Chats totals aggregation error:", err);
      }
    },
    []
  );

  // Cache-first hydration: render instantly from the persistent local cache
  // (repeat visits have zero spinner), then live listeners reconcile below.
  useEffect(() => {
    if (!waId) {
      setChats([]);
      setAccount(null);
      setContactsMap({});
      setTotalChatsCount(null);
      setTotalUnreadCount(0);
      setPageSize(CHATS_PAGE_SIZE);
      setHasMoreChats(true);
      setLoadingMoreChats(false);
      setLoading(false);
      return;
    }

    const signal = { cancelled: false };
    setError(null);
    setLoading(true);
    setPageSize(CHATS_PAGE_SIZE);
    setHasMoreChats(true);

    (async () => {
      try {
        const [accountRes, chatsRes, contactsRes] = await Promise.all([
          getDocCacheFirst<WaAccount>(doc(db, waAccountDoc(waId))),
          getQueryCacheFirst<Chat>(
            query(
              chatsCollection(waId),
              orderBy("lastChatTime", "desc"),
              limit(CHATS_PAGE_SIZE)
            )
          ),
          getQueryCacheFirst<Contact>(
            query(collection(db, contactCollection(waId)))
          ),
        ]);
        if (signal.cancelled) return;
        if (accountRes.data) setAccount(accountRes.data);
        const sorted = [...chatsRes.docs].sort(
          (a, b) => (b.lastChatTime || 0) - (a.lastChatTime || 0)
        );
        setChats(sorted);
        const map: Record<string, Contact> = {};
        for (const c of contactsRes.docs) map[c.id] = c;
        setContactsMap(map);
        setHasMoreChats(chatsRes.size >= CHATS_PAGE_SIZE);
        setLoading(false);
      } catch (err) {
        console.error("Chats cache hydration error:", err);
        if (!signal.cancelled) setLoading(false);
      }
    })();

    void refreshTotals(waId, signal);

    return () => {
      signal.cancelled = true;
    };
  }, [waId, refreshTotals]);

  // Live subscriptions. The chats query is bounded by `pageSize` so the
  // initial download stays small; "Load more" widens it.
  useEffect(() => {
    if (!waId) {
      return;
    }

    const signal = { cancelled: false };

    // 1. Account listener
    const unsubAccount = onSnapshot(
      doc(db, waAccountDoc(waId)),
      (snapshot) => {
        if (signal.cancelled) return;
        if (snapshot.exists()) {
          setAccount(snapshot.data() as WaAccount);
        } else {
          setAccount(null);
        }
      },
      (err) => console.error("Account listener error:", err)
    );

    // 2. Contacts metadata listener (names, photos)
    const unsubContacts = onSnapshot(
      collection(db, contactCollection(waId)),
      (snapshot) => {
        if (signal.cancelled) return;
        const map: Record<string, Contact> = {};
        snapshot.docs.forEach((docSnap) => {
          map[docSnap.id] = docSnap.data() as Contact;
        });
        setContactsMap(map);
      },
      (err) => console.error("Contacts listener error:", err)
    );

    // 3. Chats listener — paged (the single real-time source of truth for the
    // loaded window of chats). Exact totals come from `refreshTotals`.
    const pagedChatsQuery = query(
      chatsCollection(waId),
      orderBy("lastChatTime", "desc"),
      limit(pageSize)
    );
    const unsubChats = onSnapshot(
      pagedChatsQuery,
      (snapshot) => {
        if (signal.cancelled) return;
        const list: WithId<Chat>[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Chat),
        }));

        list.sort((a, b) => (b.lastChatTime || 0) - (a.lastChatTime || 0));

        setChats(list);
        setHasMoreChats(snapshot.size >= pageSize);
        setLoading(false);
        setLoadingMoreChats(false);
        if (snapshot.docChanges().length > 0) {
          void refreshTotals(waId, signal);
        }
      },
      (err) => {
        console.error("Chats listener error in ChatsProvider:", err);
        if (signal.cancelled) return;
        setError("Failed to load contacts list.");
        setLoading(false);
        setLoadingMoreChats(false);
      }
    );

    return () => {
      signal.cancelled = true;
      unsubAccount();
      unsubContacts();
      unsubChats();
    };
  }, [waId, pageSize, refreshTotals]);

  const loadMoreChats = useCallback(() => {
    if (!hasMoreChats || loadingMoreChats) return;
    setLoadingMoreChats(true);
    setPageSize((p) => p + CHATS_PAGE_SIZE);
  }, [hasMoreChats, loadingMoreChats]);

  return (
    <ChatsContext.Provider
      value={{
        account,
        chats,
        contactsMap,
        totalUnreadCount,
        totalChatsCount,
        loading,
        error,
        hasMoreChats,
        loadingMoreChats,
        loadMoreChats,
      }}
    >
      {children}
    </ChatsContext.Provider>
  );
}

export function useChats() {
  return useContext(ChatsContext);
}
