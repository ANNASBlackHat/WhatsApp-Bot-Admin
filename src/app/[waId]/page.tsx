"use client";

import React, { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  waAccountDoc,
  chatCollection,
  contactCollection,
  chatDoc,
} from "@/lib/firestore-paths";
import { Chat, Contact, WaAccount, WithId } from "@/types/firestore";
import { formatChatTime, truncate, checkQuietHoursActive } from "@/lib/utils";

interface ContactsListPageProps {
  params: Promise<{ waId: string }>;
}

export default function ContactsListPage({ params }: ContactsListPageProps) {

  const resolvedParams = use(params);
  const waId = decodeURIComponent(resolvedParams.waId);
  const router = useRouter();

  const [account, setAccount] = useState<WaAccount | null>(null);
  const [chats, setChats] = useState<WithId<Chat>[]>([]);
  const [contactsMap, setContactsMap] = useState<Record<string, Contact>>({});
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [showBulkDisableModal, setShowBulkDisableModal] = useState<boolean>(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(Boolean(waId));
  const [togglingPhone, setTogglingPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!waId) {
      return;
    }

    // 1. Listen to account settings
    const unsubAccount = onSnapshot(
      doc(db, waAccountDoc(waId)),
      (snapshot) => {
        if (snapshot.exists()) {
          setAccount(snapshot.data() as WaAccount);
        } else {
          setAccount(null);
        }
      },
      (err) => {
        console.error("Account listener error:", err);
      }
    );

    // 2. Listen to contact profiles for joining display names
    const unsubContacts = onSnapshot(
      collection(db, contactCollection(waId)),
      (snapshot) => {
        const map: Record<string, Contact> = {};
        snapshot.docs.forEach((docSnap) => {
          map[docSnap.id] = docSnap.data() as Contact;
        });
        setContactsMap(map);
      },
      (err) => {
        console.error("Contacts listener error:", err);
      }
    );

    // 3. Listen to chats metadata
    const unsubChats = onSnapshot(
      collection(db, chatCollection(waId)),
      (snapshot) => {
        const chatList: WithId<Chat>[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Chat),
        }));

        // Sort descending by lastChatTime
        chatList.sort((a, b) => (b.lastChatTime || 0) - (a.lastChatTime || 0));

        setChats(chatList);
        setLoading(false);
      },
      (err) => {
        console.error("Chats listener error:", err);
        setError("Failed to load contacts list. Please check Firestore permissions.");
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
  const quietStatus = checkQuietHoursActive(account?.quiet_hours);


  // Search and status filter
  const filteredChats = chats.filter((chat) => {
    // 1. Text search
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const phone = (chat.phone || chat.id).toLowerCase();
      const contact = contactsMap[phone] || contactsMap[chat.id];
      const name = (contact?.name || "").toLowerCase();
      const lastMsg = (chat.lastChatMessage || "").toLowerCase();

      if (!name.includes(term) && !phone.includes(term) && !lastMsg.includes(term)) {
        return false;
      }
    }

    // 2. Bot status filter (active vs paused vs all)
    const isDefaultPolicy = chat.bot_active === null || chat.bot_active === undefined;
    const isEffectiveActive = isDefaultPolicy
      ? defaultPolicyActive
      : Boolean(chat.bot_active);

    if (statusFilter === "active" && !isEffectiveActive) return false;
    if (statusFilter === "paused" && isEffectiveActive) return false;

    return true;
  });

  const handleSelectRow = (phone: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    setSelectedPhones((prev) =>
      prev.includes(phone) ? prev.filter((p) => p !== phone) : [...prev, phone]
    );
  };

  const handleSelectAll = () => {
    if (selectedPhones.length === filteredChats.length && filteredChats.length > 0) {
      setSelectedPhones([]);
    } else {
      setSelectedPhones(filteredChats.map((c) => c.phone || c.id));
    }
  };

  const handleBulkDisable = async () => {
    if (selectedPhones.length === 0) return;

    try {
      setIsBulkUpdating(true);
      const batch = writeBatch(db);

      selectedPhones.forEach((phone) => {
        const targetRef = doc(db, chatDoc(waId, phone));
        batch.update(targetRef, { bot_active: false });
      });

      await batch.commit();
      setSelectedPhones([]);
      setShowBulkDisableModal(false);
    } catch (err) {
      console.error("Failed to bulk disable bot:", err);
      setError("Failed to disable bot for selected contacts.");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleToggleBot = async (
    e: React.MouseEvent,
    userPhone: string,
    currentBotActive: boolean | null | undefined
  ) => {
    e.stopPropagation(); // Prevent row click navigation

    try {
      setTogglingPhone(userPhone);
      const targetRef = doc(db, chatDoc(waId, userPhone));

      let nextState: boolean;
      if (currentBotActive === true) {
        nextState = false;
      } else if (currentBotActive === false) {
        nextState = true;
      } else {
        nextState = !defaultPolicyActive;
      }

      await updateDoc(targetRef, { bot_active: nextState }).catch(async () => {
        await setDoc(targetRef, { bot_active: nextState }, { merge: true });
      });
    } catch (err) {
      console.error("Failed to update bot_active:", err);
    } finally {
      setTogglingPhone(null);
    }
  };

  const handleResetToDefault = async (e: React.MouseEvent, userPhone: string) => {
    e.stopPropagation(); // Prevent row click navigation

    try {
      setTogglingPhone(userPhone);
      const targetRef = doc(db, chatDoc(waId, userPhone));
      await updateDoc(targetRef, { bot_active: null }).catch(async () => {
        await setDoc(targetRef, { bot_active: null }, { merge: true });
      });
    } catch (err) {
      console.error("Failed to reset bot_active to default:", err);
    } finally {
      setTogglingPhone(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      {/* Header section */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-medium text-text-primary">Contacts</h1>
          <p className="text-xs text-text-secondary">
            Account ID: <code className="font-mono text-text-primary font-medium">{waId}</code>
          </p>
        </div>

        {/* Global default policy info badge */}
        <div className="inline-flex items-center gap-2 rounded-md border border-border-custom bg-surface px-3 py-1.5 text-xs text-text-secondary">
          <span>Default policy for new contacts:</span>
          <span
            className={`font-medium ${
              defaultPolicyActive ? "text-accent-active" : "text-accent-paused"
            }`}
          >
            {defaultPolicyActive ? "Auto-ON" : "Auto-OFF"}
          </span>
        </div>
      </div>

      {quietStatus.active && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-accent-paused/30 bg-accent-paused-bg px-4 py-2.5 text-xs text-accent-paused">
          <div className="flex items-center gap-2">
            <span className="text-sm">🌙</span>
            <span className="font-medium">
              Scheduled Quiet Hours active (until {quietStatus.untilTime})
            </span>
          </div>
          <span className="hidden sm:inline text-[11px] text-text-secondary">
            AI auto-replies temporarily paused across all contacts.
          </span>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-border-custom bg-canvas p-4 text-xs text-accent-danger">
          {error}
        </div>
      )}


      {/* Search Bar & Status Filter Row */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search contacts by name, phone, or message content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-border-custom bg-surface py-2 pl-9 pr-9 text-xs text-text-primary placeholder-text-muted focus:border-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-text-secondary hover:text-text-primary"
            >
              Clear
            </button>
          )}
        </div>

        {/* Bot-Status Filter Tabs (US-4.2) */}
        <div className="inline-flex rounded-lg border border-border-custom bg-surface p-1 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-md px-3 py-1 font-medium transition-colors ${
              statusFilter === "all"
                ? "bg-surface-hover text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`rounded-md px-3 py-1 font-medium transition-colors ${
              statusFilter === "active"
                ? "bg-accent-active-bg text-accent-active"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Bot active
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("paused")}
            className={`rounded-md px-3 py-1 font-medium transition-colors ${
              statusFilter === "paused"
                ? "bg-accent-paused-bg text-accent-paused"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Bot paused
          </button>
        </div>
      </div>

      {/* Bulk Selection Action Bar (US-1.4) */}
      {selectedPhones.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-border-custom bg-surface px-4 py-2.5 shadow-xs">
          <div className="flex items-center gap-3 text-xs text-text-primary">
            <span className="font-medium">
              {selectedPhones.length} contact{selectedPhones.length > 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-text-secondary underline hover:text-text-primary"
            >
              {selectedPhones.length === filteredChats.length
                ? "Deselect all"
                : "Select all matching"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowBulkDisableModal(true)}
            className="rounded border border-border-custom bg-canvas px-3 py-1.5 text-xs font-medium text-accent-paused transition-colors hover:bg-accent-paused-bg"
          >
            Pause bot for selected ({selectedPhones.length})
          </button>
        </div>
      )}

      {/* Contacts List Container */}
      <div className="overflow-hidden rounded-lg border border-border-custom bg-surface shadow-xs">
        {loading ? (
          <div className="divide-y divide-border-custom">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex h-16 items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-surface-hover" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-32 animate-pulse rounded bg-surface-hover" />
                    <div className="h-3 w-48 animate-pulse rounded bg-surface-hover" />
                  </div>
                </div>
                <div className="h-6 w-20 animate-pulse rounded bg-surface-hover" />
              </div>
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-text-primary">
              {searchTerm || statusFilter !== "all"
                ? "No matching contacts found"
                : "No conversations yet"}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your search query or status filter."
                : "They'll show up here once someone messages your WhatsApp number."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-custom">
            {filteredChats.map((chat) => {
              const phone = chat.phone || chat.id;
              const contact = contactsMap[phone] || contactsMap[chat.id];
              const displayName = contact?.name || phone;
              const isDefaultPolicy =
                chat.bot_active === null || chat.bot_active === undefined;
              const isEffectiveActive = isDefaultPolicy
                ? defaultPolicyActive
                : Boolean(chat.bot_active);

              const isUpdating = togglingPhone === phone;
              const isSelected = selectedPhones.includes(phone);

              return (
                <div
                  key={chat.id}
                  onClick={() => router.push(`/${encodeURIComponent(waId)}/contacts/${encodeURIComponent(phone)}`)}
                  className={`group flex h-16 cursor-pointer items-center justify-between px-4 transition-colors hover:bg-surface-hover sm:px-6 ${
                    isSelected ? "bg-surface-hover/60" : ""
                  }`}
                >
                  {/* Left: Checkbox + Avatar + Name + Message preview */}
                  <div className="flex min-w-0 items-center gap-3 pr-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleSelectRow(phone, e)}
                      className="h-4 w-4 rounded border-border-custom text-text-primary focus:ring-text-primary"
                    />

                    {/* Avatar */}
                    {contact?.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={contact.photo}
                        alt={displayName}
                        className="h-10 w-10 shrink-0 rounded-full object-cover border border-border-custom"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-hover text-xs font-medium text-text-primary border border-border-custom">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Contact Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-text-primary">
                          {displayName}
                        </span>
                        {chat.unreadCount > 0 && (
                          <span className="inline-flex h-4 items-center justify-center rounded-full bg-accent-active px-1.5 text-[10px] font-medium text-white">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-text-secondary">
                        {truncate(chat.lastChatMessage || "No messages yet", 45)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Timestamp + Bot Status Badge + Inline Toggle */}
                  <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                    {/* Timestamp */}
                    <span className="hidden text-xs text-text-secondary sm:inline">
                      {formatChatTime(chat.lastChatTime)}
                    </span>

                    {/* Status Badge */}
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
                      <span>
                        {isDefaultPolicy
                          ? `Default (${isEffectiveActive ? "Active" : "Paused"})`
                          : isEffectiveActive
                          ? "Active"
                          : "Paused"}
                      </span>
                    </div>

                    {/* Inline Toggle Control */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={(e) => handleToggleBot(e, phone, chat.bot_active)}
                        title={
                          chat.bot_active === true
                            ? "Click to pause bot for this contact"
                            : chat.bot_active === false
                            ? "Click to activate bot for this contact"
                            : `Using default policy (${
                                defaultPolicyActive ? "Active" : "Paused"
                              }). Click to override.`
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-text-primary focus:ring-offset-2 disabled:opacity-50 ${
                          chat.bot_active === true
                            ? "bg-accent-active"
                            : chat.bot_active === false
                            ? "bg-accent-paused"
                            : "bg-text-muted"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm transition duration-150 ease-in-out ${
                            chat.bot_active === true
                              ? "translate-x-5"
                              : chat.bot_active === false
                              ? "translate-x-0"
                              : "translate-x-2.5"
                          }`}
                        />
                      </button>

                      {/* Clear override to return to default policy */}
                      {!isDefaultPolicy && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={(e) => handleResetToDefault(e, phone)}
                          title="Reset to default policy"
                          className="rounded p-1 text-text-muted transition-colors hover:bg-border-custom hover:text-text-primary"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk Disable Confirmation Modal (US-1.4) */}
      {showBulkDisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-border-custom bg-surface p-6 shadow-lg">
            <h3 className="text-base font-medium text-text-primary">
              Pause Bot for Selected Contacts?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              Are you sure you want to set <code className="font-mono text-text-primary">bot_active: false</code> for{" "}
              <span className="font-medium text-text-primary">
                {selectedPhones.length} contact{selectedPhones.length > 1 ? "s" : ""}
              </span>
              ? The AI bot will stop auto-replying to messages from these contacts.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isBulkUpdating}
                onClick={() => setShowBulkDisableModal(false)}
                className="rounded border border-border-custom bg-canvas px-4 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkUpdating}
                onClick={handleBulkDisable}
                className="rounded bg-accent-paused px-4 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
              >
                {isBulkUpdating ? "Pausing..." : `Pause Bot (${selectedPhones.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

