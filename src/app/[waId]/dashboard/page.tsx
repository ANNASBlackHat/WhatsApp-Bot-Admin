"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  chatCollection,
  contactCollection,
  waAccountDoc,
} from "@/lib/firestore-paths";
import { Chat, Contact, WaAccount, WithId } from "@/types/firestore";
import { formatChatTime, truncate, checkQuietHoursActive } from "@/lib/utils";

interface PageProps {
  params: Promise<{ waId: string }>;
}

export default function DashboardPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const waId = decodeURIComponent(resolvedParams.waId);

  const [account, setAccount] = useState<WaAccount | null>(null);
  const [chats, setChats] = useState<WithId<Chat>[]>([]);
  const [contactsMap, setContactsMap] = useState<Record<string, Contact>>({});
  const [loading, setLoading] = useState<boolean>(Boolean(waId));

  useEffect(() => {
    if (!waId) return;

    // 1. Account doc listener
    const unsubAccount = onSnapshot(doc(db, waAccountDoc(waId)), (snapshot) => {
      if (snapshot.exists()) {
        setAccount(snapshot.data() as WaAccount);
      }
    });

    // 2. Contacts listener (for names & photos)
    const unsubContacts = onSnapshot(
      collection(db, contactCollection(waId)),
      (snapshot) => {
        const map: Record<string, Contact> = {};
        snapshot.docs.forEach((docSnap) => {
          map[docSnap.id] = docSnap.data() as Contact;
        });
        setContactsMap(map);
      }
    );

    // 3. Chats listener
    const unsubChats = onSnapshot(
      collection(db, chatCollection(waId)),
      (snapshot) => {
        const list: WithId<Chat>[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Chat),
        }));

        list.sort((a, b) => (b.lastChatTime || 0) - (a.lastChatTime || 0));
        setChats(list);
        setLoading(false);
      },
      (err) => {
        console.error("Dashboard chats snapshot error:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubAccount();
      unsubContacts();
      unsubChats();
    };
  }, [waId]);

  const defaultPolicyActive = account?.default_bot_active_for_new_contacts ?? false;
  const isGlobalActive = account?.is_bot_active ?? true;
  const quietStatus = checkQuietHoursActive(account?.quiet_hours);


  // Calculate metrics
  let activeBotsCount = 0;
  let pausedBotsCount = 0;
  let totalUnreadCount = 0;
  let chatsTodayCount = 0;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayTimestamp = startOfToday.getTime();

  chats.forEach((chat) => {
    const isDefaultPolicy = chat.bot_active === null || chat.bot_active === undefined;
    const isEffectiveActive = isDefaultPolicy
      ? defaultPolicyActive
      : Boolean(chat.bot_active);

    if (isEffectiveActive && isGlobalActive) {
      activeBotsCount++;
    } else {
      pausedBotsCount++;
    }

    if (chat.unreadCount) {
      totalUnreadCount += chat.unreadCount;
    }

    if (chat.lastChatTime && chat.lastChatTime >= todayTimestamp) {
      chatsTodayCount++;
    }
  });

  const topActiveContacts = chats.slice(0, 5);

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-medium text-[#1C1C1A]">Ops Dashboard</h1>
          <p className="text-xs text-[#6B6A62]">
            Account ID: <code className="font-mono text-[#1C1C1A] font-medium">{waId}</code>
          </p>
        </div>

        {/* Global kill switch status badge */}
        <div
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium ${
            isGlobalActive
              ? "border-[#2F7A5C]/20 bg-[#E7F1EB] text-[#2F7A5C]"
              : "border-[#B23B31]/20 bg-[#F5E4E1] text-[#B23B31]"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isGlobalActive ? "bg-[#2F7A5C]" : "bg-[#B23B31]"
            }`}
          />
        </div>
      </div>

      {quietStatus.active && (
        <div className="flex items-center justify-between rounded-lg border border-[#B9722F]/30 bg-[#F5EBDF] px-4 py-2.5 text-xs text-[#B9722F]">
          <div className="flex items-center gap-2">
            <span className="text-sm">🌙</span>
            <span className="font-medium">
              Scheduled Quiet Hours active (until {quietStatus.untilTime})
            </span>
          </div>
          <span className="hidden sm:inline text-[11px] text-[#6B6A62]">
            AI auto-replies are temporarily paused across all contacts.
          </span>
        </div>
      )}

      {/* Metrics Summary Cards Grid */}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Active Bots Card */}
        <div className="rounded-lg border border-[#E7E5DD] bg-[#FFFFFF] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#6B6A62]">
              Active Bots
            </span>
            <span className="h-2 w-2 rounded-full bg-[#2F7A5C]" />
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[#1C1C1A]">
            {loading ? "..." : activeBotsCount}
          </p>
          <p className="mt-1 text-[11px] text-[#6B6A62]">
            Auto-replying contacts
          </p>
        </div>

        {/* Paused Bots Card */}
        <div className="rounded-lg border border-[#E7E5DD] bg-[#FFFFFF] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#6B6A62]">
              Paused Bots
            </span>
            <span className="h-2 w-2 rounded-full bg-[#B9722F]" />
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[#1C1C1A]">
            {loading ? "..." : pausedBotsCount}
          </p>
          <p className="mt-1 text-[11px] text-[#6B6A62]">
            Manual reply or paused
          </p>
        </div>

        {/* Chats Active Today */}
        <div className="rounded-lg border border-[#E7E5DD] bg-[#FFFFFF] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#6B6A62]">
              Active Today
            </span>
            <svg className="h-4 w-4 text-[#6B6A62]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[#1C1C1A]">
            {loading ? "..." : chatsTodayCount}
          </p>
          <p className="mt-1 text-[11px] text-[#6B6A62]">
            Conversations active today
          </p>
        </div>

        {/* Unread Messages Card */}
        <div className="rounded-lg border border-[#E7E5DD] bg-[#FFFFFF] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#6B6A62]">
              Unread Messages
            </span>
            <span
              className={`h-2 w-2 rounded-full ${
                totalUnreadCount > 0 ? "bg-[#B23B31]" : "bg-[#A6A499]"
              }`}
            />
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[#1C1C1A]">
            {loading ? "..." : totalUnreadCount}
          </p>
          <p className="mt-1 text-[11px] text-[#6B6A62]">
            Pending customer messages
          </p>
        </div>
      </div>

      {/* Most Active Contacts Card */}
      <div className="rounded-lg border border-[#E7E5DD] bg-[#FFFFFF] shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E7E5DD] px-5 py-4">
          <div>
            <h2 className="text-sm font-medium text-[#1C1C1A]">Most Active Contacts</h2>
            <p className="text-xs text-[#6B6A62]">Ranked by latest conversation timestamp</p>
          </div>

          <Link
            href={`/${encodeURIComponent(waId)}`}
            className="text-xs font-medium text-[#2F7A5C] hover:underline"
          >
            View all contacts →
          </Link>
        </div>

        {loading ? (
          <div className="p-6 text-center text-xs text-[#6B6A62]">Loading dashboard...</div>
        ) : topActiveContacts.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#6B6A62]">No active contacts available.</div>
        ) : (
          <div className="divide-y divide-[#E7E5DD]">
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
                  className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-[#F3F2ED]"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    {contact?.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={contact.photo}
                        alt={displayName}
                        className="h-9 w-9 shrink-0 rounded-full object-cover border border-[#E7E5DD]"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F2ED] text-xs font-medium text-[#1C1C1A] border border-[#E7E5DD]">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[#1C1C1A]">{displayName}</p>
                      <p className="truncate text-[11px] text-[#6B6A62]">
                        {truncate(chat.lastChatMessage || "No messages yet", 50)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-[11px] text-[#6B6A62]">
                      {formatChatTime(chat.lastChatTime)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        isEffectiveActive
                          ? "bg-[#E7F1EB] text-[#2F7A5C]"
                          : "bg-[#F5EBDF] text-[#B9722F]"
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
