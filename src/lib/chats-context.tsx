"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { db } from "@/lib/firebase";
// Data layer: all Firestore access goes through the shared ChatDataSource
// interface (packages/data). The web app injects the JS-SDK implementation;
// the mobile app will inject the native one. See packages/data/README.md.
import { WebChatDataSource } from "../../packages/data/src/index";
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

const chatSource = new WebChatDataSource(db);

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

  // Refresh exact server-side totals (aggregations — no document downloads).
  const refreshTotals = useCallback(
    async (id: string, signal: { cancelled: boolean }) => {
      try {
        const totals = await chatSource.fetchChatTotals(id);
        if (signal.cancelled) return;
        setTotalChatsCount(totals.totalChats);
        setTotalUnreadCount(totals.unreadTotal);
      } catch (err) {
        console.error("Chats totals aggregation error:", err);
      }
    },
    []
  );

  // Cache-first hydration: render instantly from the persistent local cache
  // (repeat visits have zero spinner), then live subscriptions reconcile below.
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

    chatSource
      .hydrateChatsCacheFirst(waId, CHATS_PAGE_SIZE)
      .then((res) => {
        if (signal.cancelled) return;
        if (res.account) setAccount(res.account);
        setChats(res.chats);
        setContactsMap(res.contacts);
        setHasMoreChats(res.hasMore);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Chats cache hydration error:", err);
        if (!signal.cancelled) setLoading(false);
      });

    void refreshTotals(waId, signal);

    return () => {
      signal.cancelled = true;
    };
  }, [waId, refreshTotals]);

  // Live subscriptions. The chats subscription is bounded by `pageSize` so the
  // initial download stays small; "Load more" widens it.
  useEffect(() => {
    if (!waId) {
      return;
    }

    const signal = { cancelled: false };

    // 1. Account subscription
    const unsubAccount = chatSource.subscribeAccount(
      waId,
      (account) => {
        if (!signal.cancelled) setAccount(account);
      },
      (err) => console.error("Account listener error:", err)
    );

    // 2. Contacts metadata subscription (names, photos)
    const unsubContacts = chatSource.subscribeContacts(
      waId,
      (map) => {
        if (!signal.cancelled) setContactsMap(map);
      },
      (err) => console.error("Contacts listener error:", err)
    );

    // 3. Chats subscription — paged (the single real-time source of truth for
    // the loaded window of chats). Exact totals come from `refreshTotals`.
    const unsubChats = chatSource.subscribeChats(
      waId,
      pageSize,
      ({ chats: list, hasMore }) => {
        if (signal.cancelled) return;
        setChats(list);
        setHasMoreChats(hasMore);
        setLoading(false);
        setLoadingMoreChats(false);
        void refreshTotals(waId, signal);
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
