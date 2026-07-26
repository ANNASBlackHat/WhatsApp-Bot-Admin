"use client";

import React, { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  WA_ID,
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

import { formatTimestamp, truncate } from "@/lib/utils";

interface PageProps {
  params: Promise<{ userPhone: string }>;
}

export default function ContactDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const userPhone = decodeURIComponent(resolvedParams.userPhone);

  const [chat, setChat] = useState<Chat | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [account, setAccount] = useState<WaAccount | null>(null);
  const [messages, setMessages] = useState<WithId<Message>[]>([]);
  const [prompts, setPrompts] = useState<WithId<Prompt>[]>([]);

  const [loadingChat, setLoadingChat] = useState<boolean>(Boolean(WA_ID && userPhone));
  const [loadingMessages, setLoadingMessages] = useState<boolean>(Boolean(WA_ID && userPhone));
  const [isUpdatingBot, setIsUpdatingBot] = useState<boolean>(false);
  const [isUpdatingPrompt, setIsUpdatingPrompt] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of messages thread
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!WA_ID || !userPhone) {
      return;
    }


    // 1. Account settings snapshot
    const unsubAccount = onSnapshot(doc(db, waAccountDoc()), (snapshot) => {
      if (snapshot.exists()) {
        setAccount(snapshot.data() as WaAccount);
      }
    });

    // 2. Chat doc snapshot
    const unsubChat = onSnapshot(
      doc(db, chatDoc(userPhone)),
      (snapshot) => {
        if (snapshot.exists()) {
          setChat(snapshot.data() as Chat);
        } else {
          setChat(null);
        }
        setLoadingChat(false);
      },
      (err) => {
        console.error("Chat metadata snapshot error:", err);
        setLoadingChat(false);
      }
    );

    // 3. Contact doc snapshot
    const unsubContact = onSnapshot(doc(db, contactDoc(userPhone)), (snapshot) => {
      if (snapshot.exists()) {
        setContact(snapshot.data() as Contact);
      } else {
        setContact(null);
      }
    });

    // 4. Messages snapshot (last 50 messages, ordered desc, reversed to display oldest to newest)
    const messagesQuery = query(
      collection(db, messagesCollection(userPhone)),
      orderBy("timeMillis", "desc"),
      limit(50)
    );

    const unsubMessages = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const list: WithId<Message>[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Message),
        }));

        // Reverse to render oldest to newest
        list.reverse();
        setMessages(list);
        setLoadingMessages(false);
      },
      (err) => {
        console.error("Messages snapshot error:", err);
        setLoadingMessages(false);
      }
    );

    // 5. Prompts library snapshot
    const unsubPrompts = onSnapshot(
      collection(db, promptsCollection()),
      (snapshot) => {
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
      unsubAccount();
      unsubChat();
      unsubContact();
      unsubMessages();
      unsubPrompts();
    };
  }, [userPhone]);

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
      const targetRef = doc(db, chatDoc(userPhone));
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
      const targetRef = doc(db, chatDoc(userPhone));
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
      const targetRef = doc(db, chatDoc(userPhone));
      await updateDoc(targetRef, { custom_prompt_id: promptId }).catch(async () => {
        await setDoc(targetRef, { custom_prompt_id: promptId }, { merge: true });
      });
    } catch (err) {
      console.error("Failed to update custom_prompt_id:", err);
    } finally {
      setIsUpdatingPrompt(false);
    }
  };

  const [replyMessage, setReplyMessage] = useState<string>("");
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);
  const [isMarkingRead, setIsMarkingRead] = useState<boolean>(false);
  const [replyStatus, setReplyStatus] = useState<string | null>(null);

  // Manual Reply handler (writes to wa_bot/recent-chat/all)
  const handleSendManualReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;

    try {
      setIsSendingReply(true);
      setReplyStatus(null);

      await addDoc(collection(db, outgoingMessageCollection()), {
        from: WA_ID,
        to: userPhone,
        message: replyMessage.trim(),
        timestamp: Date.now(),
      });

      setReplyMessage("");
      setReplyStatus("Manual reply queued for sending.");
      setTimeout(() => setReplyStatus(null), 3000);
    } catch (err) {
      console.error("Failed to send manual reply:", err);
      setReplyStatus("Failed to send reply. Please check your connection.");
    } finally {
      setIsSendingReply(false);
    }
  };

  // Mark as Read handler (resets chat/{userPhone}.unreadCount to 0)
  const handleMarkAsRead = async () => {
    try {
      setIsMarkingRead(true);
      const targetRef = doc(db, chatDoc(userPhone));
      await updateDoc(targetRef, { unreadCount: 0 });
    } catch (err) {
      console.error("Failed to mark chat as read:", err);
    } finally {
      setIsMarkingRead(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      {/* Top Breadcrumb Header */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B6A62] transition-colors hover:text-[#1C1C1A]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to contacts
        </Link>
      </div>

      {/* Main Grid: Thread Viewer (left) + Controls Side Panel (right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Chat Thread Viewer */}
        <div className="flex h-[75vh] flex-col overflow-hidden rounded-lg border border-[#E7E5DD] bg-[#FFFFFF] shadow-xs lg:col-span-2">
          {/* Thread Header */}
          <div className="flex items-center justify-between border-b border-[#E7E5DD] bg-[#FAFAF8] px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              {contact?.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contact.photo}
                  alt={displayName}
                  className="h-9 w-9 rounded-full object-cover border border-[#E7E5DD]"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F3F2ED] text-xs font-medium text-[#1C1C1A] border border-[#E7E5DD]">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}

              <div>
                <h2 className="text-sm font-medium text-[#1C1C1A]">{displayName}</h2>
                <p className="text-[11px] font-mono text-[#6B6A62]">{userPhone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Mark as read action */}
              {(chat?.unreadCount ?? 0) > 0 ? (
                <button
                  type="button"
                  disabled={isMarkingRead}
                  onClick={handleMarkAsRead}
                  className="inline-flex items-center gap-1 rounded border border-[#E7E5DD] bg-[#FFFFFF] px-2.5 py-1 text-xs font-medium text-[#1C1C1A] transition-colors hover:bg-[#F3F2ED]"
                >
                  ✓ Mark read ({chat?.unreadCount})
                </button>
              ) : (
                <span className="text-[11px] text-[#A6A499]">Read</span>
              )}

              {/* Current bot status badge in header */}
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  isEffectiveActive
                    ? "bg-[#E7F1EB] text-[#2F7A5C]"
                    : "bg-[#F5EBDF] text-[#B9722F]"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isEffectiveActive ? "bg-[#2F7A5C]" : "bg-[#B9722F]"
                  }`}
                />
                <span>{isEffectiveActive ? "Bot Active" : "Bot Paused"}</span>
              </div>
            </div>
          </div>

          {/* Messages list area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 sm:p-6 bg-[#FAFAF8]">
            {loadingMessages ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1C1C1A] border-t-transparent" />
                  <span className="text-xs text-[#6B6A62]">Loading messages...</span>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <p className="text-xs text-[#6B6A62]">No messages found in this chat thread.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isCustomer = msg.userType === "customer";

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isCustomer ? "items-start" : "items-end"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-lg px-3.5 py-2.5 text-xs shadow-2xs ${
                        isCustomer
                          ? "bg-[#FFFFFF] text-[#1C1C1A] border border-[#E7E5DD]"
                          : "bg-[#E7F1EB] text-[#1C1C1A] border border-[#2F7A5C]/20"
                      }`}
                    >
                      {/* Sender label */}
                      <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-medium text-[#6B6A62]">
                        <span>{isCustomer ? displayName : "Bot / Admin"}</span>
                        <span>{formatTimestamp(msg.timeMillis)}</span>
                      </div>

                      {/* Quoted message placeholder */}
                      {msg.messageQuoted && (
                        <div className="mb-2 rounded border-l-2 border-[#6B6A62] bg-[#F3F2ED] p-1.5 text-[11px] text-[#6B6A62]">
                          {truncate(msg.messageQuoted, 80)}
                        </div>
                      )}

                      {/* Message Text */}
                      {msg.message && (
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {msg.message}
                        </p>
                      )}

                      {/* Inline Media Rendering */}
                      {msg.imgUrl && (
                        <div className="mt-2 overflow-hidden rounded-md border border-[#E7E5DD]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={msg.imgUrl}
                            alt="Attached image"
                            className="max-h-64 w-auto rounded-md object-contain"
                            loading="lazy"
                          />
                        </div>
                      )}

                      {msg.fileUrl && (
                        <div className="mt-2">
                          {msg.fileUrl.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i) ? (
                            <video
                              controls
                              poster={msg.thumb}
                              className="max-h-64 w-full rounded-md border border-[#E7E5DD] bg-[#1C1C1A]"
                            >
                              <source src={msg.fileUrl} />
                              Your browser does not support video playback.
                            </video>
                          ) : (
                            <a
                              href={msg.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded border border-[#E7E5DD] bg-[#FFFFFF] px-2.5 py-1.5 text-[11px] font-medium text-[#2F7A5C] hover:bg-[#F3F2ED]"
                            >
                              📎 Download attachment
                            </a>
                          )}
                        </div>
                      )}

                      {msg.thumb && !msg.imgUrl && !msg.fileUrl && (
                        <div className="mt-2 overflow-hidden rounded-md border border-[#E7E5DD]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={msg.thumb}
                            alt="Thumbnail preview"
                            className="max-h-48 w-auto rounded-md object-contain"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Manual Reply Input Bar (writes to wa_bot/recent-chat/all) */}
          <form
            onSubmit={handleSendManualReply}
            className="border-t border-[#E7E5DD] bg-[#FFFFFF] p-3 sm:px-4"
          >
            {replyStatus && (
              <div className="mb-2 text-[11px] font-medium text-[#2F7A5C]">
                {replyStatus}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Type a manual reply to send via WhatsApp..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                className="flex-1 rounded-md border border-[#E7E5DD] bg-[#FAFAF8] px-3 py-2 text-xs text-[#1C1C1A] placeholder-[#A6A499] focus:border-[#1C1C1A] focus:bg-[#FFFFFF] focus:outline-none focus:ring-1 focus:ring-[#1C1C1A]"
              />
              <button
                type="submit"
                disabled={isSendingReply || !replyMessage.trim()}
                className="inline-flex items-center justify-center rounded-md bg-[#1C1C1A] px-4 py-2 text-xs font-medium text-[#FFFFFF] transition-colors hover:bg-[#333330] focus:outline-none focus:ring-2 focus:ring-[#1C1C1A] disabled:opacity-40"
              >
                {isSendingReply ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </div>


        {/* Right 1 Col: Controls Side Panel */}
        <div className="space-y-6">
          {/* Contact Info Card */}
          <div className="rounded-lg border border-[#E7E5DD] bg-[#FFFFFF] p-5 shadow-xs">
            <h3 className="text-xs font-medium uppercase tracking-wider text-[#6B6A62]">
              Contact Details
            </h3>

            <div className="mt-4 flex items-center gap-3">
              {contact?.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contact.photo}
                  alt={displayName}
                  className="h-12 w-12 rounded-full object-cover border border-[#E7E5DD]"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F2ED] text-sm font-medium text-[#1C1C1A] border border-[#E7E5DD]">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#1C1C1A]">
                  {displayName}
                </p>
                <p className="font-mono text-xs text-[#6B6A62]">{userPhone}</p>
              </div>
            </div>
          </div>

          {/* Bot Control Card */}
          <div className="rounded-lg border border-[#E7E5DD] bg-[#FFFFFF] p-5 shadow-xs">
            <h3 className="text-xs font-medium uppercase tracking-wider text-[#6B6A62]">
              Bot Control
            </h3>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#1C1C1A]">
                    {isEffectiveActive ? "Bot Active" : "Bot Paused"}
                  </p>
                  <p className="text-[11px] text-[#6B6A62]">
                    {isDefaultPolicy
                      ? `Using default policy (${defaultPolicyActive ? "Active" : "Paused"})`
                      : "Explicit per-contact override"}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isUpdatingBot || loadingChat}
                  onClick={handleToggleBot}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1C1C1A] focus:ring-offset-2 disabled:opacity-50 ${
                    chat?.bot_active === true
                      ? "bg-[#2F7A5C]"
                      : chat?.bot_active === false
                      ? "bg-[#B9722F]"
                      : "bg-[#A6A499]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#FFFFFF] shadow-sm transition duration-150 ease-in-out ${
                      chat?.bot_active === true
                        ? "translate-x-5"
                        : chat?.bot_active === false
                        ? "translate-x-0"
                        : "translate-x-2.5"
                    }`}
                  />
                </button>
              </div>

              {!isDefaultPolicy && (
                <button
                  type="button"
                  disabled={isUpdatingBot || loadingChat}
                  onClick={handleResetBot}
                  className="w-full rounded border border-[#E7E5DD] bg-[#FAFAF8] py-1.5 text-xs font-medium text-[#6B6A62] transition-colors hover:bg-[#F3F2ED] hover:text-[#1C1C1A]"
                >
                  Reset to default policy
                </button>
              )}
            </div>
          </div>

          {/* Prompt Selector Card */}
          <div className="rounded-lg border border-[#E7E5DD] bg-[#FFFFFF] p-5 shadow-xs">
            <h3 className="text-xs font-medium uppercase tracking-wider text-[#6B6A62]">
              Assigned Prompt
            </h3>

            <div className="mt-4 space-y-3">
              <label htmlFor="prompt-select" className="text-xs text-[#1C1C1A]">
                Select system prompt template
              </label>

              <select
                id="prompt-select"
                disabled={isUpdatingPrompt || loadingChat}
                value={chat?.custom_prompt_id || "default"}
                onChange={handlePromptChange}
                className="w-full rounded border border-[#E7E5DD] bg-[#FFFFFF] px-3 py-2 text-xs text-[#1C1C1A] focus:border-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#1C1C1A] disabled:opacity-50"
              >
                <option value="default">
                  -- Use Default Prompt --
                </option>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.is_default ? "(Default)" : ""}
                  </option>
                ))}
              </select>

              <p className="text-[11px] text-[#6B6A62]">
                {chat?.custom_prompt_id
                  ? "Using custom assigned prompt for this conversation."
                  : "No custom prompt assigned. Falling back to default system prompt."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
