"use client";

import React, { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getDocCacheFirst, getQueryCacheFirst } from "@/lib/firestore-cache";
import {
  chatDoc,
  contactDoc,
  messagesCollection,
  outgoingMessageCollection,
  promptsCollection,
  waAccountDoc,
} from "@/lib/firestore-paths";
import {
  Chat,
  Contact,
  Message,
  Prompt,
  WaAccount,
  WithId,
} from "@/types/firestore";
import {
  formatTimestamp,
  truncate,
  parseAudioMessage,
  correlateMessages,
  formatDateDivider,
} from "@/lib/utils";
import { useChats } from "@/lib/chats-context";
import { ContactsListPane } from "@/components/contacts-list-pane";
import { ContactControlsPanel } from "@/components/contact-controls-panel";
import { ImageLightbox } from "@/components/image-lightbox";
import { FormattedMessageText } from "@/components/formatted-message-text";
import { ManualReplyBar } from "@/components/manual-reply-bar";

interface PageProps {
  params: Promise<{ waId: string; userPhone: string }>;
}

/**
 * Messages loaded per page in a thread. Same limit-growth pattern as the
 * chats list: "Load older messages" widens the `limit()` so realtime stays
 * correct while the initial download stays small.
 */
const MESSAGE_PAGE_SIZE = 50;

export default function ContactDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const waId = decodeURIComponent(resolvedParams.waId);
  const userPhone = decodeURIComponent(resolvedParams.userPhone);

  const {
    chats,
    contactsMap,
    account: sharedAccount,
    loading: loadingSharedChats,
    totalChatsCount,
    hasMoreChats,
    loadingMoreChats,
    loadMoreChats,
  } = useChats();

  const [chat, setChat] = useState<Chat | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [account, setAccount] = useState<WaAccount | null>(sharedAccount);
  const [messages, setMessages] = useState<WithId<Message>[]>([]);
  const [prompts, setPrompts] = useState<WithId<Prompt>[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [loadingChat, setLoadingChat] = useState<boolean>(Boolean(waId && userPhone));
  const [loadingMessages, setLoadingMessages] = useState<boolean>(Boolean(waId && userPhone));
  const [isUpdatingBot, setIsUpdatingBot] = useState<boolean>(false);
  const [isUpdatingPrompt, setIsUpdatingPrompt] = useState<boolean>(false);

  const [isMarkingRead, setIsMarkingRead] = useState<boolean>(false);
  const [showNewMessageBtn, setShowNewMessageBtn] = useState<boolean>(false);
  const [isControlsOpen, setIsControlsOpen] = useState<boolean>(true);

  // Per-thread message page size (resets naturally per contact, no reset
  // effect needed since the key includes userPhone).
  const threadKey = `${waId}::${userPhone}`;
  const [messageLimitByThread, setMessageLimitByThread] = useState<Record<string, number>>({});
  const messageLimit = messageLimitByThread[threadKey] ?? MESSAGE_PAGE_SIZE;
  const [messagesHasMore, setMessagesHasMore] = useState<boolean>(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState<boolean>(false);

  const handleLoadOlderMessages = () => {
    if (!messagesHasMore || loadingMoreMessages) return;
    setLoadingMoreMessages(true);
    setMessageLimitByThread((prev) => ({
      ...prev,
      [threadKey]: (prev[threadKey] ?? MESSAGE_PAGE_SIZE) + MESSAGE_PAGE_SIZE,
    }));
  };

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const prevMessageCountRef = useRef<number>(0);

  // Scroll container scroll listener to detect if admin is near bottom
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNear = distanceToBottom < 120;
    isNearBottomRef.current = isNear;
    if (isNear) {
      setShowNewMessageBtn(false);
    }
  };

  // Auto-scroll to bottom of messages thread
  const scrollToBottom = (smooth = false) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  };

  // Smart auto-scroll effect on new messages
  useEffect(() => {
    const isNewMessage = messages.length > prevMessageCountRef.current;
    const isInitial = prevMessageCountRef.current === 0;
    prevMessageCountRef.current = messages.length;

    if (isInitial || isNearBottomRef.current) {
      scrollToBottom();
      setShowNewMessageBtn(false);
    } else if (isNewMessage) {
      setShowNewMessageBtn(true);
    }
  }, [messages]);

  useEffect(() => {
    if (sharedAccount) {
      setAccount(sharedAccount);
    }
  }, [sharedAccount]);

  useEffect(() => {
    if (!waId || !userPhone) {
      return;
    }

    const signal = { cancelled: false };

    // Shared message-list mapping (cache snapshot and live snapshot agree).
    const applyRawMessages = (rawList: WithId<Message>[]) => {
      const { displayMessages, pendingDocIdsToDelete } = correlateMessages(rawList);

      if (pendingDocIdsToDelete.length > 0) {
        pendingDocIdsToDelete.forEach((docId) => {
          deleteDoc(doc(db, messagesCollection(waId, userPhone), docId)).catch(
            (err) => console.error("Failed to delete correlated pending doc:", err)
          );
        });
      }

      setMessages(displayMessages);
      setLoadingMessages(false);
      setLoadingMoreMessages(false);
    };

    // 0. Cache-first hydration: paint instantly from the persistent local
    // cache (no spinner on repeat visits), live listeners reconcile below.
    (async () => {
      try {
        const [chatRes, contactRes, accountRes, messagesRes] = await Promise.all([
          getDocCacheFirst<Chat>(doc(db, chatDoc(waId, userPhone))),
          getDocCacheFirst<Contact>(doc(db, contactDoc(waId, userPhone))),
          getDocCacheFirst<WaAccount>(doc(db, waAccountDoc(waId))),
          getQueryCacheFirst<Message>(
            query(
              collection(db, messagesCollection(waId, userPhone)),
              orderBy("timeMillis", "desc"),
              limit(messageLimit)
            )
          ),
        ]);
        if (signal.cancelled) return;
        if (chatRes.exists) {
          setChat(chatRes.data);
          setLoadingChat(false);
        }
        if (contactRes.exists) setContact(contactRes.data);
        if (accountRes.data) setAccount(accountRes.data);
        if (!messagesRes.empty) {
          const cached = [...messagesRes.docs].reverse();
          applyRawMessages(cached);
          setMessagesHasMore(messagesRes.size >= messageLimit);
        }
      } catch (err) {
        console.error("Thread cache hydration error:", err);
      }
    })();

    // 1. Account settings snapshot (fallback if not in context)
    const unsubAccount = onSnapshot(doc(db, waAccountDoc(waId)), (snapshot) => {
      if (signal.cancelled) return;
      if (snapshot.exists()) {
        setAccount(snapshot.data() as WaAccount);
      }
    });

    // 2. Chat doc snapshot
    const unsubChat = onSnapshot(
      doc(db, chatDoc(waId, userPhone)),
      (snapshot) => {
        if (signal.cancelled) return;
        if (snapshot.exists()) {
          setChat(snapshot.data() as Chat);
        } else {
          setChat(null);
        }
        setLoadingChat(false);
      },
      (err) => {
        console.error("Chat metadata snapshot error:", err);
        if (signal.cancelled) return;
        setLoadingChat(false);
      }
    );

    // 3. Contact doc snapshot
    const unsubContact = onSnapshot(doc(db, contactDoc(waId, userPhone)), (snapshot) => {
      if (signal.cancelled) return;
      if (snapshot.exists()) {
        setContact(snapshot.data() as Contact);
      } else {
        setContact(null);
      }
    });

    // 4. Messages snapshot — paged (newest `messageLimit`); "Load older"
    // widens the limit instead of cursoring, so realtime stays correct.
    const messagesQuery = query(
      collection(db, messagesCollection(waId, userPhone)),
      orderBy("timeMillis", "desc"),
      limit(messageLimit)
    );

    const unsubMessages = onSnapshot(
      messagesQuery,
      (snapshot) => {
        if (signal.cancelled) return;
        const rawList: WithId<Message>[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Message),
        }));

        rawList.reverse();
        applyRawMessages(rawList);
        setMessagesHasMore(snapshot.size >= messageLimit);
      },
      (err) => {
        console.error("Messages snapshot error:", err);
        if (signal.cancelled) return;
        setLoadingMessages(false);
        setLoadingMoreMessages(false);
      }
    );

    // 5. Prompts library snapshot
    const unsubPrompts = onSnapshot(
      collection(db, promptsCollection(waId)),
      (snapshot) => {
        if (signal.cancelled) return;
        const promptList: WithId<Prompt>[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Prompt),
        }));
        setPrompts(promptList);
      },
      (err) => {
        console.error("Prompts collection snapshot error:", err);
      }
    );

    return () => {
      signal.cancelled = true;
      unsubAccount();
      unsubChat();
      unsubContact();
      unsubMessages();
      unsubPrompts();
    };
  }, [waId, userPhone, messageLimit]);

  const defaultPolicyActive = account?.default_bot_active_for_new_contacts ?? false;
  const isDefaultPolicy = chat?.bot_active === null || chat?.bot_active === undefined;
  const isEffectiveActive = isDefaultPolicy
    ? defaultPolicyActive
    : Boolean(chat?.bot_active);

  const displayName = contact?.name || chat?.phone || userPhone;

  // Toggle per-contact bot_active
  const handleToggleBot = async () => {
    try {
      setIsUpdatingBot(true);
      const targetRef = doc(db, chatDoc(waId, userPhone));
      let nextState: boolean;

      if (chat?.bot_active === true) {
        nextState = false;
      } else if (chat?.bot_active === false) {
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
      setIsUpdatingBot(false);
    }
  };

  // Reset to default policy
  const handleResetBot = async () => {
    try {
      setIsUpdatingBot(true);
      const targetRef = doc(db, chatDoc(waId, userPhone));
      await updateDoc(targetRef, { bot_active: null }).catch(async () => {
        await setDoc(targetRef, { bot_active: null }, { merge: true });
      });
    } catch (err) {
      console.error("Failed to reset bot_active:", err);
    } finally {
      setIsUpdatingBot(false);
    }
  };

  // Change custom prompt ID
  const handlePromptChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    const promptId = selectedValue === "default" ? null : selectedValue;

    try {
      setIsUpdatingPrompt(true);
      const targetRef = doc(db, chatDoc(waId, userPhone));
      await updateDoc(targetRef, { custom_prompt_id: promptId }).catch(async () => {
        await setDoc(targetRef, { custom_prompt_id: promptId }, { merge: true });
      });
    } catch (err) {
      console.error("Failed to update custom_prompt_id:", err);
    } finally {
      setIsUpdatingPrompt(false);
    }
  };

  // Mark as Read handler
  const handleMarkAsRead = async () => {
    try {
      setIsMarkingRead(true);
      const targetRef = doc(db, chatDoc(waId, userPhone));
      await updateDoc(targetRef, { unreadCount: 0 });
    } catch (err) {
      console.error("Failed to mark chat as read:", err);
    } finally {
      setIsMarkingRead(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-canvas">
      {/* Left Pane: Contacts List (Desktop only, hidden on mobile) */}
      <div className="hidden lg:block w-[320px] shrink-0 h-full border-r border-border-custom">
        <ContactsListPane
          waId={waId}
          chats={chats}
          contactsMap={contactsMap}
          account={account}
          loading={loadingSharedChats}
          selectedUserPhone={userPhone}
          totalCount={totalChatsCount}
          hasMore={hasMoreChats}
          loadingMore={loadingMoreChats}
          onLoadMore={loadMoreChats}
        />
      </div>

      {/* Middle & Right Container (Desktop: side-by-side, Mobile: stacked) */}
      <div className="flex-1 h-full flex flex-col lg:flex-row min-w-0 overflow-hidden">
        {/* Middle Column: Chat Thread Viewer */}
        <div className="flex-1 h-full flex flex-col min-w-0 bg-surface border-b lg:border-b-0 lg:border-r border-border-custom">
          {/* Thread Header */}
          <div className="flex items-center justify-between border-b border-border-custom bg-canvas px-4 py-3 sm:px-6 shrink-0">
            <div className="flex items-center gap-3">
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
                onClick={() => setIsControlsOpen((v) => !v)}
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

          {/* Messages list area */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="relative flex-1 overflow-y-auto p-4 space-y-3 sm:p-6 bg-canvas"
          >
            {loadingMessages ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-text-primary border-t-transparent" />
                  <span className="text-xs text-text-secondary">Loading messages...</span>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <p className="text-xs text-text-secondary">No messages found in this chat thread.</p>
              </div>
            ) : (
              <>
                {/* Older-messages pagination — widens the live query limit */}
                {messagesHasMore && (
                  <div className="flex justify-center pb-1">
                    <button
                      type="button"
                      onClick={handleLoadOlderMessages}
                      disabled={loadingMoreMessages}
                      className="rounded-full border border-border-custom bg-surface px-3.5 py-1 text-[11px] font-medium text-text-secondary shadow-2xs transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
                    >
                      {loadingMoreMessages ? "Loading..." : "↑ Load older messages"}
                    </button>
                  </div>
                )}
                {messages.map((msg, index) => {
                const isCustomer = msg.userType === "customer";
                const audioInfo = parseAudioMessage(msg);

                const currentDateStr = formatDateDivider(msg.timeMillis);
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const prevDateStr = prevMsg ? formatDateDivider(prevMsg.timeMillis) : null;
                const showDateDivider = Boolean(currentDateStr && currentDateStr !== prevDateStr);

                // Media unavailable fallbacks
                const isImageExpected = msg.type === "image";
                const isVideoExpected = msg.type === "video";
                const isDocumentExpected = msg.type === "document";
                const isThumbExpected = msg.type === "thumbnail";

                const isImageUnavailable = isImageExpected && !msg.imgUrl;
                const isVideoOrDocUnavailable = (isVideoExpected || isDocumentExpected) && !msg.fileUrl;
                const isThumbUnavailable = isThumbExpected && !msg.thumb;

                return (
                  <React.Fragment key={msg.id}>
                    {showDateDivider && (
                      <div className="my-3 flex items-center justify-center">
                        <span className="rounded-full bg-surface-hover px-3 py-1 text-[10px] font-medium text-text-secondary border border-border-custom shadow-2xs">
                          {currentDateStr}
                        </span>
                      </div>
                    )}

                    <div
                      className={`flex flex-col ${
                        isCustomer ? "items-start" : "items-end"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] min-w-0 rounded-lg px-3.5 py-2.5 text-xs shadow-2xs break-words [overflow-wrap:anywhere] ${
                          isCustomer
                            ? "bg-surface text-text-primary border border-border-custom"
                            : "bg-accent-active-bg text-text-primary border border-accent-active/20"
                        }`}
                      >
                        {/* Sender label */}
                        <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-medium text-text-secondary">
                          <span>{isCustomer ? displayName : "Bot / Admin"}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {msg.status === "pending" && (
                              <span className="font-sans text-[9px] text-accent-paused">
                                ⏳ Pending
                              </span>
                            )}
                            {msg.status === "unconfirmed" && (
                              <span
                                className="font-sans text-[9px] text-accent-danger"
                                title="Delivery confirmation not received from server within 60s"
                              >
                                ⚠️ Not confirmed
                              </span>
                            )}
                            <span>{formatTimestamp(msg.timeMillis)}</span>
                          </div>
                        </div>

                        {/* Quoted message placeholder */}
                        {msg.messageQuoted && (
                          <div className="mb-2 rounded border-l-2 border-text-secondary bg-surface-hover p-1.5 text-[11px] text-text-secondary break-words [overflow-wrap:anywhere]">
                            <FormattedMessageText text={truncate(msg.messageQuoted, 80)} />
                          </div>
                        )}

                        {/* Audio Message Rendering */}
                        {audioInfo.isAudio ? (
                          <div className="space-y-1.5 min-w-0">
                            {audioInfo.displayText && (
                              <FormattedMessageText text={audioInfo.displayText} />
                            )}
                            {audioInfo.audioUrl ? (
                              <div className="mt-1.5 max-w-full">
                                <audio
                                  controls
                                  src={audioInfo.audioUrl}
                                  className="w-full min-w-[200px] max-w-xs rounded border border-border-custom bg-canvas text-text-primary"
                                >
                                  Your browser does not support audio playback.
                                </audio>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 rounded border border-border-custom bg-canvas px-3 py-1.5 text-[11px] text-text-muted">
                                <span>🎵</span>
                                <span>Media unavailable</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Text Message */
                          msg.message && <FormattedMessageText text={msg.message} />
                        )}

                        {/* Inline Image Media Rendering (if not audio) */}
                        {!audioInfo.isAudio && (
                          <>
                            {msg.imgUrl ? (
                              <div
                                onClick={() => setLightboxImage(msg.imgUrl!)}
                                title="Click to view larger image"
                                className="mt-2 overflow-hidden rounded-md border border-border-custom cursor-pointer group"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={msg.imgUrl}
                                  alt="Attached image"
                                  className="max-h-64 w-auto rounded-md object-contain group-hover:opacity-90 transition-opacity"
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              isImageUnavailable && (
                                <div className="mt-2 inline-flex items-center gap-1.5 rounded border border-border-custom bg-canvas px-3 py-1.5 text-[11px] text-text-muted">
                                  <span>📷</span>
                                  <span>Media unavailable</span>
                                </div>
                              )
                            )}
                          </>
                        )}

                        {/* Video or Document File Rendering (if not audio) */}
                        {!audioInfo.isAudio && (
                          <>
                            {msg.fileUrl ? (
                              <div className="mt-2">
                                {msg.fileUrl.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i) ? (
                                  <video
                                    controls
                                    poster={msg.thumb}
                                    className="max-h-64 w-full rounded-md border border-border-custom bg-text-primary"
                                  >
                                    <source src={msg.fileUrl} />
                                    Your browser does not support video playback.
                                  </video>
                                ) : (
                                  <a
                                    href={msg.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded border border-border-custom bg-surface px-2.5 py-1.5 text-[11px] font-medium text-accent-active hover:bg-surface-hover"
                                  >
                                    📎 Download attachment
                                  </a>
                                )}
                              </div>
                            ) : (
                              isVideoOrDocUnavailable && (
                                <div className="mt-2 inline-flex items-center gap-1.5 rounded border border-border-custom bg-canvas px-3 py-1.5 text-[11px] text-text-muted">
                                  <span>📎</span>
                                  <span>Media unavailable</span>
                                </div>
                              )
                            )}
                          </>
                        )}

                        {!audioInfo.isAudio && (
                          <>
                            {msg.thumb && !msg.imgUrl && !msg.fileUrl ? (
                              <div
                                onClick={() => setLightboxImage(msg.thumb!)}
                                title="Click to view larger image"
                                className="mt-2 overflow-hidden rounded-md border border-border-custom cursor-pointer group"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={msg.thumb}
                                  alt="Thumbnail preview"
                                  className="max-h-48 w-auto rounded-md object-contain group-hover:opacity-90 transition-opacity"
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              isThumbUnavailable && (
                                <div className="mt-2 inline-flex items-center gap-1.5 rounded border border-border-custom bg-canvas px-3 py-1.5 text-[11px] text-text-muted">
                                  <span>🖼️</span>
                                  <span>Media unavailable</span>
                                </div>
                              )
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              </>
            )}

            {/* Jump to bottom new message indicator button */}
            {showNewMessageBtn && (
              <div className="sticky bottom-2 flex justify-center z-20 pointer-events-none">
                <button
                  type="button"
                  onClick={() => {
                    scrollToBottom(true);
                    setShowNewMessageBtn(false);
                  }}
                  className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-text-primary px-3.5 py-1.5 text-[11px] font-medium text-surface shadow-md hover:bg-text-primary/90 transition-all duration-150 ease-out motion-reduce:transition-none"
                >
                  <span>↓</span>
                  <span>New messages</span>
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Manual Reply Input Bar (isolated component to prevent keystroke re-renders) */}
          <ManualReplyBar waId={waId} userPhone={userPhone} />
        </div>

        {/* Right Column: Consolidated Controls Side Panel */}
        <div
          className={`overflow-hidden bg-canvas transition-all duration-200 ease-in-out ${
            isControlsOpen
              ? "w-full p-4 lg:w-72 lg:shrink-0 overflow-y-auto opacity-100"
              : "hidden lg:block lg:w-0 lg:shrink-0 lg:p-0 lg:border-0 opacity-0 pointer-events-none"
          }`}
        >
          <div className="w-full lg:w-64">
            <ContactControlsPanel
              contact={contact}
              chat={chat}
              displayName={displayName}
              userPhone={userPhone}
              isEffectiveActive={isEffectiveActive}
              isDefaultPolicy={isDefaultPolicy}
              defaultPolicyActive={defaultPolicyActive}
              isUpdatingBot={isUpdatingBot}
              loadingChat={loadingChat}
              isUpdatingPrompt={isUpdatingPrompt}
              prompts={prompts}
              handleToggleBot={handleToggleBot}
              handleResetBot={handleResetBot}
              handlePromptChange={handlePromptChange}
            />
          </div>
        </div>
      </div>

      {/* Image Lightbox Overlay Modal */}
      <ImageLightbox
        src={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}



