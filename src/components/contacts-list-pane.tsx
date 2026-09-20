"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Chat, Contact, WaAccount, WithId } from "@/types/firestore";
import {
  effectiveFolders,
  matchesTab,
  resolveDisplayName,
  type TabKey,
} from "@/lib/chat-helpers";

interface ContactsListPaneProps {
  waId: string;
  chats: WithId<Chat>[];
  contactsMap: Record<string, Contact>;
  account: WaAccount | null;
  loading: boolean;
  selectedUserPhone?: string | null;
  /** Exact server-side total; when set and larger than `chats.length`, more pages exist. */
  totalCount?: number | null;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

export const ContactsListPane = React.memo(function ContactsListPane({
  waId,
  chats,
  contactsMap,
  account,
  loading,
  selectedUserPhone,
  totalCount,
  hasMore,
  loadingMore,
  onLoadMore,
}: ContactsListPaneProps) {
  const [filter, setFilter] = useState<TabKey>("default");
  const [searchQuery, setSearchQuery] = useState("");

  const defaultPolicyActive = account?.default_bot_active_for_new_contacts ?? false;
  const folders = useMemo(() => effectiveFolders(account), [account]);

  const filteredChats = useMemo(() => {
    return chats.filter((chat) => {
      const phone = chat.phone || chat.id;
      const contact = contactsMap[phone] || contactsMap[chat.id];
      const displayName = resolveDisplayName(contact, phone);

      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = displayName.toLowerCase().includes(q);
        const matchesPhone = phone.toLowerCase().includes(q);
        const matchesMsg = (chat.lastChatMessage || "").toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesMsg) {
          return false;
        }
      }

      // 2. Tab filter (status tabs or folder tabs — pure client-side pass)
      if (!matchesTab(chat, filter, defaultPolicyActive)) return false;

      return true;
    });
  }, [chats, contactsMap, searchQuery, filter, defaultPolicyActive]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of chats) {
      for (const key of ["default", "active", "paused", ...folders.map((f) => f.key)]) {
        if (matchesTab(c, key as TabKey, defaultPolicyActive)) {
          counts[key] = (counts[key] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [chats, defaultPolicyActive, folders]);

  return (
    <div className="flex flex-col h-full bg-surface border-b lg:border-b-0 lg:border-r border-border-custom">
      {/* Search & Filter Header */}
      <div className="p-4 border-b border-border-custom space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-text-primary">Contacts</h1>
            <p className="text-[11px] text-text-secondary">
              {totalCount != null && totalCount > chats.length
                ? `Showing ${chats.length} of ${totalCount} conversations`
                : `${totalCount ?? chats.length} conversation${(totalCount ?? chats.length) === 1 ? "" : "s"}`}
            </p>
          </div>
          <span className="text-[11px] font-mono text-text-muted">{waId}</span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search by name, phone, or message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-border-custom bg-canvas px-3 py-1.5 pl-8 text-xs text-text-primary placeholder-text-muted focus:border-text-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-text-primary"
          />
          <svg
            className="absolute left-2.5 top-2 h-3.5 w-3.5 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 pt-1 flex-wrap">
          <button
            type="button"
            onClick={() => setFilter("default")}
            className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              filter === "default"
                ? "bg-text-primary text-surface"
                : "bg-canvas text-text-secondary hover:bg-surface-hover"
            }`}
          >
            Default ({tabCounts["default"] ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              filter === "active"
                ? "bg-accent-active-bg text-accent-active border border-accent-active/20"
                : "bg-canvas text-text-secondary hover:bg-surface-hover"
            }`}
          >
            Active ({tabCounts["active"] ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setFilter("paused")}
            className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              filter === "paused"
                ? "bg-accent-paused-bg text-accent-paused border border-accent-paused/20"
                : "bg-canvas text-text-secondary hover:bg-surface-hover"
            }`}
          >
            Paused ({tabCounts["paused"] ?? 0})
          </button>
          {folders.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                filter === f.key
                  ? f.key === "hidden"
                    ? "bg-accent-paused-bg text-accent-paused border border-accent-paused/20"
                    : "bg-accent-active-bg text-accent-active border border-accent-active/20"
                  : "bg-canvas text-text-secondary hover:bg-surface-hover"
              }`}
            >
              {f.name} ({tabCounts[f.key] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {/* Contacts List Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-border-custom">
        {loading ? (
          <div className="p-6 text-center text-xs text-text-secondary">
            Loading contacts...
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-secondary space-y-1">
            <p className="font-medium text-text-primary">No contacts found</p>
            <p className="text-[11px] text-text-muted">
              {searchQuery ? "Try adjusting your search query." : filter === "default" ? "No conversations in the default view." : "No conversations in this tab."}
            </p>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const phone = chat.phone || chat.id;
            const contact = contactsMap[phone] || contactsMap[chat.id];
            const displayName = resolveDisplayName(contact, phone);

            const isSelected = selectedUserPhone === phone;
            const unread = chat.unreadCount ?? 0;

            const isDefaultPolicy =
              chat.bot_active === null || chat.bot_active === undefined;
            const isEffectiveActive = isDefaultPolicy
              ? defaultPolicyActive
              : Boolean(chat.bot_active);

            return (
              <Link
                key={chat.id}
                href={`/${encodeURIComponent(waId)}/contacts/${encodeURIComponent(phone)}`}
                className={`flex items-start gap-3 p-3.5 transition-colors ${
                  isSelected
                    ? "bg-surface-hover border-l-2 border-text-primary"
                    : "hover:bg-surface-hover"
                }`}
              >
                {/* Contact Avatar */}
                {contact?.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={contact.photo}
                    alt={displayName}
                    className="h-9 w-9 shrink-0 rounded-full object-cover border border-border-custom"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-medium text-text-primary border border-border-custom">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Name & Preview */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {displayName}
                    </p>
                    <span className="shrink-0 text-[10px] text-text-muted font-mono">
                      {formatTime(chat.lastChatTime)}
                    </span>
                  </div>

                  <p className="truncate text-[11px] text-text-secondary mt-0.5">
                    {chat.lastChatMessage || "No messages yet"}
                  </p>
                </div>

                {/* Status dot & unread badge */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isEffectiveActive ? "bg-accent-active" : "bg-accent-paused"
                    }`}
                    title={isEffectiveActive ? "Bot Active" : "Bot Paused"}
                  />

                  {unread > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-danger px-1 text-[10px] font-bold text-white leading-none">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Pagination footer — limit-growth: widens the live query, stays realtime */}
      {hasMore && onLoadMore && !loading && (
        <div className="border-t border-border-custom p-3">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="w-full rounded border border-border-custom bg-canvas py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
          >
            {loadingMore
              ? "Loading more..."
              : totalCount != null
                ? `Load more (${chats.length} of ${totalCount})`
                : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
});

function formatTime(timestamp?: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
