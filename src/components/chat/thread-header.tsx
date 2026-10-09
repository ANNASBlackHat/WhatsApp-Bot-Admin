import React from "react";
import Link from "next/link";
import { Chat, Contact } from "@/types/firestore";

interface ThreadHeaderProps {
  waId: string;
  userPhone: string;
  contact: Contact | null;
  displayName: string;
  chat: Chat | null;
  isEffectiveActive: boolean;
  isMarkingRead: boolean;
  handleMarkAsRead: () => void;
  isLeftPanelOpen: boolean;
  toggleLeftPanel: () => void;
  isControlsOpen: boolean;
  toggleControlsPanel: () => void;
}

export function ThreadHeader({
  waId,
  userPhone,
  contact,
  displayName,
  chat,
  isEffectiveActive,
  isMarkingRead,
  handleMarkAsRead,
  isLeftPanelOpen,
  toggleLeftPanel,
  isControlsOpen,
  toggleControlsPanel,
}: ThreadHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border-custom bg-canvas px-4 py-3 sm:px-6 shrink-0">
      <div className="flex items-center gap-3">
        {/* Desktop Left Panel Toggle Button */}
        <button
          type="button"
          onClick={toggleLeftPanel}
          title={isLeftPanelOpen ? "Hide contacts list" : "Show contacts list"}
          aria-expanded={isLeftPanelOpen}
          className="hidden lg:inline-flex items-center justify-center rounded border border-border-custom bg-surface px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary mr-0.5"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Mobile Back Button (hidden on desktop) */}
        <Link
          href={`/${encodeURIComponent(waId)}`}
          className="lg:hidden inline-flex items-center text-xs font-medium text-text-secondary hover:text-text-primary mr-1"
          title="Back to contacts"
        >
          <svg
            className="h-4 w-4 mr-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        {contact?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contact.photo}
            alt={displayName}
            className="h-9 w-9 rounded-full object-cover border border-border-custom"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-hover text-xs font-medium text-text-primary border border-border-custom">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <div>
          <h2 className="text-sm font-medium text-text-primary">{displayName}</h2>
          <p className="text-[11px] font-mono text-text-secondary">{userPhone}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Mark as read action */}
        {(chat?.unreadCount ?? 0) > 0 ? (
          <button
            type="button"
            disabled={isMarkingRead}
            onClick={handleMarkAsRead}
            className="inline-flex items-center gap-1 rounded border border-border-custom bg-surface px-2.5 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover"
          >
            ✓ Mark read ({chat?.unreadCount})
          </button>
        ) : (
          <span className="text-[11px] text-text-muted">Read</span>
        )}

        {/* Current bot status badge in header */}
        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            isEffectiveActive
              ? "bg-accent-active-bg text-accent-active"
              : "bg-accent-paused-bg text-accent-paused"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isEffectiveActive ? "bg-accent-active" : "bg-accent-paused"
            }`}
          />
          <span>{isEffectiveActive ? "Bot Active" : "Bot Paused"}</span>
        </div>

        {/* Right panel toggle */}
        <button
          type="button"
          onClick={toggleControlsPanel}
          title={isControlsOpen ? "Hide details panel" : "Show details panel"}
          aria-expanded={isControlsOpen}
          className="inline-flex items-center justify-center rounded border border-border-custom bg-surface px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              isControlsOpen ? "rotate-0" : "rotate-180"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
