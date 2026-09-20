/**
 * Data hooks for the mobile app — same semantics as the web app:
 * cache-first hydration (instant paint on repeat visits), live subscriptions
 * while the screen is focused, limit-growth pagination.
 *
 * IMPORTANT (no FCM in v1): every hook detaches its listeners on unmount.
 * Screens subscribe in `useFocusEffect` semantics via mount/unmount, so
 * leaving a screen stops its Firestore listeners and saves battery/data.
 */
import { useCallback, useEffect, useState } from "react";
import { collection, getDocs } from "@react-native-firebase/firestore";
import { onAuthStateChanged, type User } from "@react-native-firebase/auth";
import type {
  Chat,
  Contact,
  WaAccount,
  WithId,
} from "@app/schema";
import type { ThreadSnapshot } from "@app/data";
import { auth, db } from "./firebase";
import { CHATS_PAGE_SIZE, MESSAGE_PAGE_SIZE, chatSource } from "./data";

// -- Auth -------------------------------------------------------------------

export function useAuthState(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(
      auth,
      (u) => {
        setUser(u);
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, []);

  return { user, loading };
}

// -- Accounts (tiny `wa_bot` collection — one-shot, no listener) -------------

export interface AccountOption {
  waId: string;
  displayName: string;
}

export function useAccounts(): { accounts: AccountOption[]; loading: boolean } {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDocs(collection(db, "wa_bot"))
      .then((snap) => {
        if (cancelled) return;
        setAccounts(
          snap.docs.map((d) => {
            const data = d.data() as { display_name?: string };
            return { waId: d.id, displayName: data.display_name ?? d.id };
          })
        );
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load accounts:", err);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { accounts, loading };
}

// -- Chats list ---------------------------------------------------------------

export function useChatsList(waId: string) {
  const [account, setAccount] = useState<WaAccount | null>(null);
  const [chats, setChats] = useState<WithId<Chat>[]>([]);
  const [contactsMap, setContactsMap] = useState<Record<string, Contact>>({});
  const [totalChats, setTotalChats] = useState<number | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [pageSize, setPageSize] = useState(CHATS_PAGE_SIZE);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState(waId);

  // Render-phase reset (official derived-state pattern): clears stale data
  // synchronously on account switch without an effect cascade.
  if (scope !== waId) {
    setScope(waId);
    setAccount(null);
    setChats([]);
    setContactsMap({});
    setTotalChats(null);
    setUnreadTotal(0);
    setPageSize(CHATS_PAGE_SIZE);
    setHasMore(true);
    setLoadingMore(false);
    setError(null);
    setLoading(true);
  }

  // Cache-first hydration (one page).
  useEffect(() => {
    if (!waId) {
      return;
    }
    let cancelled = false;

    chatSource
      .hydrateChatsCacheFirst(waId, CHATS_PAGE_SIZE)
      .then((res) => {
        if (cancelled) return;
        if (res.account) setAccount(res.account);
        setChats(res.chats);
        setContactsMap(res.contacts);
        setHasMore(res.hasMore);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Chats cache hydration error:", err);
        if (!cancelled) setLoading(false);
      });

    chatSource
      .fetchChatTotals(waId)
      .then((t) => {
        if (cancelled) return;
        setTotalChats(t.totalChats);
        setUnreadTotal(t.unreadTotal);
      })
      .catch((err) => console.error("Chats totals error:", err));

    return () => {
      cancelled = true;
    };
  }, [waId]);

  // Live subscriptions (bounded by pageSize).
  useEffect(() => {
    if (!waId) return;
    let cancelled = false;

    const unsubs = [
      chatSource.subscribeAccount(
        waId,
        (a) => {
          if (!cancelled) setAccount(a);
        },
        (e) => console.error("Account listener error:", e)
      ),
      chatSource.subscribeContacts(
        waId,
        (map) => {
          if (!cancelled) setContactsMap(map);
        },
        (e) => console.error("Contacts listener error:", e)
      ),
      chatSource.subscribeChats(
        waId,
        pageSize,
        ({ chats: list, hasMore: more }) => {
          if (cancelled) return;
          setChats(list);
          setHasMore(more);
          setLoading(false);
          setLoadingMore(false);
          chatSource
            .fetchChatTotals(waId)
            .then((t) => {
              if (cancelled) return;
              setTotalChats(t.totalChats);
              setUnreadTotal(t.unreadTotal);
            })
            .catch((err) => console.error("Chats totals error:", err));
        },
        (err) => {
          console.error("Chats listener error:", err);
          if (cancelled) return;
          setError("Failed to load contacts list.");
          setLoading(false);
          setLoadingMore(false);
        }
      ),
    ];
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [waId, pageSize]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setPageSize((p) => p + CHATS_PAGE_SIZE);
  }, [hasMore, loadingMore]);

  return {
    account,
    chats,
    contactsMap,
    totalChats,
    unreadTotal,
    hasMore,
    loadingMore,
    loading,
    error,
    loadMore,
  };
}

// -- Thread ---------------------------------------------------------------------

export function useThread(waId: string, userPhone: string) {
  const threadKey = `${waId}::${userPhone}`;
  const [limits, setLimits] = useState<Record<string, number>>({});
  const messageLimit = limits[threadKey] ?? MESSAGE_PAGE_SIZE;
  const [snapshot, setSnapshot] = useState<ThreadSnapshot>({
    chat: null,
    contact: null,
    account: null,
    messages: [],
    hasMoreMessages: false,
  });
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [scope, setScope] = useState(threadKey);

  // Render-phase reset (official derived-state pattern): clears the previous
  // thread synchronously on navigation without an effect cascade.
  if (scope !== threadKey) {
    setScope(threadKey);
    setSnapshot({
      chat: null,
      contact: null,
      account: null,
      messages: [],
      hasMoreMessages: false,
    });
    setLoading(true);
    setLoadingOlder(false);
  }

  useEffect(() => {
    if (!waId || !userPhone) {
      return;
    }
    let cancelled = false;

    chatSource
      .hydrateThreadCacheFirst(waId, userPhone, messageLimit)
      .then((snap) => {
        if (cancelled) return;
        setSnapshot(snap);
        setLoading(false);
        setLoadingOlder(false);
      })
      .catch((err) => {
        console.error("Thread cache hydration error:", err);
        if (!cancelled) {
          setLoading(false);
          setLoadingOlder(false);
        }
      });

    const unsub = chatSource.subscribeThread(
      waId,
      userPhone,
      messageLimit,
      (snap) => {
        if (cancelled) return;
        setSnapshot(snap);
        setLoading(false);
        setLoadingOlder(false);
      },
      (err) => {
        console.error("Thread listener error:", err);
        if (!cancelled) {
          setLoading(false);
          setLoadingOlder(false);
        }
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [waId, userPhone, messageLimit]);

  const loadOlder = useCallback(() => {
    if (!snapshot.hasMoreMessages || loadingOlder) return;
    setLoadingOlder(true);
    setLimits((prev) => ({
      ...prev,
      [threadKey]: (prev[threadKey] ?? MESSAGE_PAGE_SIZE) + MESSAGE_PAGE_SIZE,
    }));
  }, [snapshot.hasMoreMessages, loadingOlder, threadKey]);

  const markRead = useCallback(async () => {
    if (markingRead) return;
    setMarkingRead(true);
    try {
      await chatSource.markChatRead(waId, userPhone);
    } catch (err) {
      console.error("Failed to mark chat as read:", err);
    } finally {
      setMarkingRead(false);
    }
  }, [waId, userPhone, markingRead]);

  return { snapshot, loading, loadingOlder, loadOlder, markingRead, markRead };
}
