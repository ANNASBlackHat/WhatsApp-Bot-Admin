"use client";

import React, { use } from "react";
import { useChats } from "@/lib/chats-context";
import { ContactsListPane } from "@/components/contacts-list-pane";
import { checkQuietHoursActive } from "@/lib/utils";

interface ContactsListPageProps {
  params: Promise<{ waId: string }>;
}

export default function ContactsListPage({ params }: ContactsListPageProps) {
  const resolvedParams = use(params);
  const waId = decodeURIComponent(resolvedParams.waId);

  const { account, chats, contactsMap, loading, error, totalChatsCount, hasMoreChats, loadingMoreChats, loadMoreChats } = useChats();

  const quietStatus = checkQuietHoursActive(account?.quiet_hours);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-canvas">
      {/* Left Column: Contacts List Pane (Always visible on desktop, full width on mobile) */}
      <div className="w-full lg:w-[320px] lg:shrink-0 h-full">
        <ContactsListPane
          waId={waId}
          chats={chats}
          contactsMap={contactsMap}
          account={account}
          loading={loading}
          totalCount={totalChatsCount}
          hasMore={hasMoreChats}
          loadingMore={loadingMoreChats}
          onLoadMore={loadMoreChats}
        />
      </div>

      {/* Right Column: Placeholder state when no contact is selected (Desktop only) */}
      <div className="hidden flex-1 lg:flex flex-col items-center justify-center p-8 text-center bg-canvas">
        <div className="mx-auto max-w-sm space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover mx-auto text-text-secondary border border-border-custom">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>

          {quietStatus.active && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-paused/30 bg-accent-paused-bg px-3 py-1 text-xs text-accent-paused">
              <span>🌙 Quiet Hours active until {quietStatus.untilTime}</span>
            </div>
          )}

          <h2 className="text-sm font-semibold text-text-primary">
            Select a contact to view thread
          </h2>
          <p className="text-xs text-text-secondary leading-relaxed">
            Choose a contact from the list on the left to inspect conversation history, send manual replies, or toggle bot auto-reply policies.
          </p>

          {error && (
            <p className="text-xs text-accent-danger bg-accent-danger-bg p-2.5 rounded border border-accent-danger/20">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
