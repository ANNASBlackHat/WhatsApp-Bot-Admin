"use client";

import React, { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
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
import { WebChatDataSource } from "@app/data/web";
import {
  effectiveFolders,
  resolveDisplayName,
} from "@/lib/chat-helpers";
import { ContactsListPane } from "@/components/contacts-list-pane";
import { ContactControlsPanel } from "@/components/contact-controls-panel";
import { ImageLightbox } from "@/components/image-lightbox";
import { FormattedMessageText } from "@/components/formatted-message-text";
import { ManualReplyBar } from "@/components/manual-reply-bar";
import { ThreadHeader } from "@/components/chat/thread-header";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ForwardMessageModal } from "@/components/chat/forward-message-modal";


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

  const chatSource = new WebChatDataSource(db);
  const [folderBusy, setFolderBusy] = useState(false);
  const [renameBusy, setRenameBusy] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<WithId<Message> | null>(null);

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
  // Fallback account source: the shared context account wins when present;
  // the cache hydration below can still write to it when the context has
  // not resolved yet.
  const [localAccount, setAccount] = useState<WaAccount | null>(sharedAccount);
  const [messages, setMessages] = useState<WithId<Message>[]>([]);
  const [prompts, setPrompts] = useState<WithId<Prompt>[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [loadingChat, setLoadingChat] = useState<boolean>(Boolean(waId && userPhone));
  const [loadingMessages, setLoadingMessages] = useState<boolean>(Boolean(waId && userPhone));
  const [isUpdatingBot, setIsUpdatingBot] = useState<boolean>(false);
  const [isUpdatingPrompt, setIsUpdatingPrompt] = useState<boolean>(false);

  const [isMarkingRead, setIsMarkingRead] = useState<boolean>(false);
  const [showNewMessageBtn, setShowNewMessageBtn] = useState<boolean>(false);

  // Left contacts pane & Right controls panel persistence across chats
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState<boolean>(true);
  const [isControlsOpen, setIsControlsOpen] = useState<boolean>(true);

  // Initialize panel preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedLeft = localStorage.getItem("chat_left_panel_open");
      if (savedLeft !== null) {
        setIsLeftPanelOpen(savedLeft === "true");
      }
      const savedControls = localStorage.getItem("chat_controls_panel_open");
      if (savedControls !== null) {
        setIsControlsOpen(savedControls === "true");
      }
    } catch (e) {
      console.error("Failed to read panel preferences from localStorage:", e);
    }
  }, []);

  const toggleLeftPanel = () => {
    setIsLeftPanelOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("chat_left_panel_open", String(next));
      } catch (e) {
        console.error("Failed to save left panel preference:", e);
      }
      return next;
    });
  };

  const toggleControlsPanel = () => {
    setIsControlsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("chat_controls_panel_open", String(next));
      } catch (e) {
        console.error("Failed to save controls panel preference:", e);
      }
      return next;
    });
  };

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

  // Sync shared account (from the chats context) into local state — a pure
  // derived value, safe to compute without an effect.
  const account = sharedAccount ?? localAccount;

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

  const folders = useMemo(() => effectiveFolders(account), [account]);
  const displayName = resolveDisplayName(
    contact,
    chat?.phone || userPhone
  );

  // Move chat to a folder tab (null = back to default view)
  const handleFolderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const folderKey = e.target.value === "none" ? null : e.target.value;
    try {
      setFolderBusy(true);
      await chatSource.setChatFolder(waId, userPhone, folderKey);
    } catch (err) {
      console.error("Failed to update chat folder:", err);
    } finally {
      setFolderBusy(false);
    }
  };

  // Save local display name (empty = clear, falls back to synced name)
  const handleRename = async (name: string | null) => {
    try {
      setRenameBusy(true);
      await chatSource.setContactDisplayName(waId, userPhone, name);
    } catch (err) {
      console.error("Failed to save display name:", err);
    } finally {
      setRenameBusy(false);
    }
  };

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
      <div
        className={`hidden lg:block shrink-0 h-full border-r border-border-custom transition-[width,opacity] duration-200 ease-in-out ${
          isLeftPanelOpen ? "w-[320px] opacity-100" : "w-0 overflow-hidden border-r-0 opacity-0 pointer-events-none"
        }`}
      >
        <div className="w-[320px] h-full">
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
      </div>

      {/* Middle & Right Container (Desktop: side-by-side, Mobile: stacked) */}
      <div className="flex-1 h-full flex flex-col lg:flex-row min-w-0 overflow-hidden">
        {/* Middle Column: Chat Thread Viewer */}
        <div className="flex-1 h-full flex flex-col min-w-0 bg-surface border-b lg:border-b-0 lg:border-r border-border-custom">
          {/* Thread Header */}
          <ThreadHeader
            waId={waId}
            userPhone={userPhone}
            contact={contact}
            displayName={displayName}
            chat={chat}
            isEffectiveActive={isEffectiveActive}
            isMarkingRead={isMarkingRead}
            handleMarkAsRead={handleMarkAsRead}
            isLeftPanelOpen={isLeftPanelOpen}
            toggleLeftPanel={toggleLeftPanel}
            isControlsOpen={isControlsOpen}
            toggleControlsPanel={toggleControlsPanel}
          />

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
                const prevMsg = index > 0 ? messages[index - 1] : null;
                return (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    prevMsg={prevMsg}
                    waId={waId}
                    displayName={displayName}
                    setLightboxImage={setLightboxImage}
                    onForward={(msg) => setForwardingMessage(msg)}
                  />
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
              folders={folders}
              folderBusy={folderBusy}
              renameBusy={renameBusy}
              handleToggleBot={handleToggleBot}
              handleResetBot={handleResetBot}
              handlePromptChange={handlePromptChange}
              handleFolderChange={handleFolderChange}
              handleRename={handleRename}
            />
          </div>
        </div>
      </div>

      {/* Image Lightbox Overlay Modal */}
      <ImageLightbox
        src={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />

      <ForwardMessageModal
        isOpen={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        waId={waId}
        messageToForward={forwardingMessage}
        chats={chats}
        contactsMap={contactsMap}
        onForward={async (targetPhone, msg) => {
          await chatSource.forwardMessage(waId, targetPhone, msg);
        }}
      />
    </div>
  );
}



