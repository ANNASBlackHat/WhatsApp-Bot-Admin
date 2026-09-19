"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
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
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getDocCacheFirst } from "@/lib/firestore-cache";
import {
  chatCollection,
  contactDoc,
  waAccountDoc,
} from "@/lib/firestore-paths";
import { Chat, Contact, WaAccount, WithId } from "@/types/firestore";
import { formatChatTime, truncate, checkQuietHoursActive } from "@/lib/utils";

interface PageProps {
  params: Promise<{ waId: string }>;
}

interface DashboardCounts {
  total: number;
  explicitActive: number;
  explicitPaused: number;
  unread: number;
  today: number;
}

/**
 * Server-side metric aggregates. count()/sum() transfer no documents, so the
 * metric cards stay exact regardless of account size.
 */
async function fetchDashboardCounts(waId: string): Promise<DashboardCounts> {
  const chatsCol = collection(db, chatCollection(waId));
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [totalSnap, activeSnap, pausedSnap, unreadSnap, todaySnap] =
    await Promise.all([
      getCountFromServer(chatsCol),
      getCountFromServer(query(chatsCol, where("bot_active", "==", true))),
      getCountFromServer(query(chatsCol, where("bot_active", "==", false))),
      getAggregateFromServer(chatsCol, { total: sum("unreadCount") }),
      getCountFromServer(
        query(chatsCol, where("lastChatTime", ">=", startOfToday.getTime()))
      ),
    ]);
  return {
    total: totalSnap.data().count,
    explicitActive: activeSnap.data().count,
    explicitPaused: pausedSnap.data().count,
    unread: unreadSnap.data().total ?? 0,
    today: todaySnap.data().count,
  };
}

export default function DashboardPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const waId = decodeURIComponent(resolvedParams.waId);

  const [account, setAccount] = useState<WaAccount | null>(null);
  const [topChats, setTopChats] = useState<WithId<Chat>[]>([]);
  const [contactsMap, setContactsMap] = useState<Record<string, Contact>>({});
  const [loading, setLoading] = useState<boolean>(Boolean(waId));

  // Server-side aggregates (no document downloads) for the metric cards.
  const [totalCount, setTotalCount] = useState<number>(0);
  const [explicitActiveCount, setExplicitActiveCount] = useState<number>(0);
  const [explicitPausedCount, setExplicitPausedCount] = useState<number>(0);
  const [totalUnreadCount, setTotalUnreadCount] = useState<number>(0);
  const [todayCount, setTodayCount] = useState<number>(0);

  useEffect(() => {
    if (!waId) return;

    const signal = { cancelled: false };

    // Metric aggregates via promise chains (same pattern as settings page).
    const applyCounts = () => {
      fetchDashboardCounts(waId)
        .then((c) => {
          if (signal.cancelled) return;
          setTotalCount(c.total);
          setExplicitActiveCount(c.explicitActive);
          setExplicitPausedCount(c.explicitPaused);
          setTotalUnreadCount(c.unread);
          setTodayCount(c.today);
        })
        .catch((err) => console.error("Dashboard counts aggregation error:", err));
    };

    // 1. Account doc listener (tiny single doc)
    const unsubAccount = onSnapshot(doc(db, waAccountDoc(waId)), (snapshot) => {
      if (signal.cancelled) return;
      if (snapshot.exists()) {
        setAccount(snapshot.data() as WaAccount);
      }
    });

    // 2. Metric aggregates (one-shot + refreshed on list updates below)
    applyCounts();

    // 3. Top-5 live query — only 5 chat docs + their 5 contact docs are ever
    // downloaded, regardless of account size.
    const topQuery = query(
      collection(db, chatCollection(waId)),
      orderBy("lastChatTime", "desc"),
      limit(5)
    );
    let contactSeq = 0;
    const unsubTop = onSnapshot(
      topQuery,
      (snapshot) => {
        if (signal.cancelled) return;
        const list: WithId<Chat>[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Chat),
        }));

        list.sort((a, b) => (b.lastChatTime || 0) - (a.lastChatTime || 0));
        setTopChats(list);
        setLoading(false);

        // Names/photos for just these 5, cache-first.
        const seq = ++contactSeq;
        void (async () => {
          try {
            const results = await Promise.all(
              list.map(async (chat) => {
                const phone = chat.phone || chat.id;
                // Prefer the shared contacts cache; fall back to a cached doc read.
                const cached = await getDocCacheFirst<Contact>(
                  doc(db, contactDoc(waId, phone))
                ).catch(() => null);
                return { phone, id: chat.id, contact: cached?.data ?? null };
              })
            );
            if (signal.cancelled || seq !== contactSeq) return;
            const map: Record<string, Contact> = {};
            for (const r of results) {
              if (r.contact) {
                map[r.phone] = r.contact;
                map[r.id] = r.contact;
              }
            }
            // Merge (don't clobber): the full contacts listener is gone.
            setContactsMap((prev) => ({ ...prev, ...map }));
          } catch (err) {
            console.error("Dashboard contacts hydration error:", err);
          }
        })();

        // Keep metric cards near-live without full-collection listeners.
        if (snapshot.docChanges().length > 0) {
          applyCounts();
        }
      },
      (err) => {
        console.error("Dashboard top-chats snapshot error:", err);
        if (signal.cancelled) return;
        setLoading(false);
      }
    );

    return () => {
      signal.cancelled = true;
      unsubAccount();
      unsubTop();
    };
  }, [waId]);

  const defaultPolicyActive = account?.default_bot_active_for_new_contacts ?? false;
  const isGlobalActive = account?.is_bot_active ?? true;
  const quietStatus = checkQuietHoursActive(account?.quiet_hours);

  // Derive effective counts: explicit true + default-policy fallback.
  // Docs with bot_active unset match neither == true nor == false, so
  // defaultCount = total - explicitTrue - explicitFalse.
  // The global kill switch pauses everything when OFF (same as before).
  const defaultCount = Math.max(0, totalCount - explicitActiveCount - explicitPausedCount);
  const effectiveActive =
    explicitActiveCount + (defaultPolicyActive ? defaultCount : 0);
  const activeBotsCount = isGlobalActive ? effectiveActive : 0;
  const pausedBotsCount = totalCount - activeBotsCount;
  const chatsTodayCount = todayCount;

  const topActiveContacts = topChats;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-medium text-text-primary">Ops Dashboard</h1>
          <p className="text-xs text-text-secondary">
            Account ID: <code className="font-mono text-text-primary font-medium">{waId}</code>
          </p>
        </div>

        {/* Global kill switch status badge */}
        <div
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium ${
            isGlobalActive
              ? "border-accent-active/20 bg-accent-active-bg text-accent-active"
              : "border-accent-danger/20 bg-accent-danger-bg text-accent-danger"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isGlobalActive ? "bg-accent-active" : "bg-accent-danger"
            }`}
          />
        </div>
      </div>

      {quietStatus.active && (
        <div className="flex items-center justify-between rounded-lg border border-accent-paused/30 bg-accent-paused-bg px-4 py-2.5 text-xs text-accent-paused">
          <div className="flex items-center gap-2">
            <span className="text-sm">🌙</span>
            <span className="font-medium">
              Scheduled Quiet Hours active (until {quietStatus.untilTime})
            </span>
          </div>
          <span className="hidden sm:inline text-[11px] text-text-secondary">
            AI auto-replies are temporarily paused across all contacts.
          </span>
        </div>
      )}

      {/* Metrics Summary Cards Grid */}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Active Bots Card */}
        <div className="rounded-lg border border-border-custom bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              Active Bots
            </span>
            <span className="h-2 w-2 rounded-full bg-accent-active" />
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
            {loading ? "..." : activeBotsCount}
          </p>
          <p className="mt-1 text-[11px] text-text-secondary">
            Auto-replying contacts
          </p>
        </div>

        {/* Paused Bots Card */}
        <div className="rounded-lg border border-border-custom bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              Paused Bots
            </span>
            <span className="h-2 w-2 rounded-full bg-accent-paused" />
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
            {loading ? "..." : pausedBotsCount}
          </p>
          <p className="mt-1 text-[11px] text-text-secondary">
            Manual reply or paused
          </p>
        </div>

        {/* Chats Active Today */}
        <div className="rounded-lg border border-border-custom bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              Active Today
            </span>
            <svg className="h-4 w-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
            {loading ? "..." : chatsTodayCount}
          </p>
          <p className="mt-1 text-[11px] text-text-secondary">
            Conversations active today
          </p>
        </div>

        {/* Unread Messages Card */}
        <div className="rounded-lg border border-border-custom bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              Unread Messages
            </span>
            <span
              className={`h-2 w-2 rounded-full ${
                totalUnreadCount > 0 ? "bg-accent-danger" : "bg-text-muted"
              }`}
            />
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
            {loading ? "..." : totalUnreadCount}
          </p>
          <p className="mt-1 text-[11px] text-text-secondary">
            Pending customer messages
          </p>
        </div>
      </div>

      {/* Most Active Contacts Card */}
      <div className="rounded-lg border border-border-custom bg-surface shadow-xs">
        <div className="flex items-center justify-between border-b border-border-custom px-5 py-4">
          <div>
            <h2 className="text-sm font-medium text-text-primary">Most Active Contacts</h2>
            <p className="text-xs text-text-secondary">Ranked by latest conversation timestamp</p>
          </div>

          <Link
            href={`/${encodeURIComponent(waId)}`}
            className="text-xs font-medium text-accent-active hover:underline"
          >
            View all contacts →
          </Link>
        </div>

        {loading ? (
          <div className="p-6 text-center text-xs text-text-secondary">Loading dashboard...</div>
        ) : topActiveContacts.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-secondary">No active contacts available.</div>
        ) : (
          <div className="divide-y divide-border-custom">
            {topActiveContacts.map((chat) => {
              const phone = chat.phone || chat.id;
              const contact = contactsMap[phone] || contactsMap[chat.id];
              const displayName = contact?.name || phone;
              const isDefaultPolicy =
                chat.bot_active === null || chat.bot_active === undefined;
              const isEffectiveActive = isDefaultPolicy
                ? defaultPolicyActive
                : Boolean(chat.bot_active);

              return (
                <Link
                  key={chat.id}
                  href={`/${encodeURIComponent(waId)}/contacts/${encodeURIComponent(phone)}`}
                  className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-surface-hover"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    {contact?.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={contact.photo}
                        alt={displayName}
                        className="h-9 w-9 shrink-0 rounded-full object-cover border border-border-custom"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-hover text-xs font-medium text-text-primary border border-border-custom">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-text-primary">{displayName}</p>
                      <p className="truncate text-[11px] text-text-secondary">
                        {truncate(chat.lastChatMessage || "No messages yet", 50)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-[11px] text-text-secondary">
                      {formatChatTime(chat.lastChatTime)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        isEffectiveActive
                          ? "bg-accent-active-bg text-accent-active"
                          : "bg-accent-paused-bg text-accent-paused"
                      }`}
                    >
                      {isEffectiveActive ? "Active" : "Paused"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

