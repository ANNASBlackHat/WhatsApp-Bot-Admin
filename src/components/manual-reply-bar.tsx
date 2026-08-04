"use client";

import React, { useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  chatDoc,
  messagesCollection,
  outgoingMessageCollection,
} from "@/lib/firestore-paths";

interface ManualReplyBarProps {
  waId: string;
  userPhone: string;
  onMessageSent?: () => void;
}

export const ManualReplyBar = React.memo(function ManualReplyBar({
  waId,
  userPhone,
  onMessageSent,
}: ManualReplyBarProps) {
  const [replyMessage, setReplyMessage] = useState<string>("");
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);
  const [replyStatus, setReplyStatus] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevHeightRef = useRef<number>(38);

  // Optimized auto-grow height logic to prevent layout thrashing
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (!replyMessage) {
      textarea.style.height = "38px";
      prevHeightRef.current = 38;
      return;
    }

    // Only recalculate style height if scrollHeight changes beyond single line threshold
    textarea.style.height = "auto";
    const targetHeight = Math.min(textarea.scrollHeight, 144);
    if (targetHeight !== prevHeightRef.current) {
      textarea.style.height = `${targetHeight}px`;
      prevHeightRef.current = targetHeight;
    } else {
      textarea.style.height = `${targetHeight}px`;
    }
  }, [replyMessage]);

  const handleSendManualReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = replyMessage.trim();
    if (!text || isSendingReply) return;

    try {
      setIsSendingReply(true);
      setReplyStatus(null);
      const now = Date.now();

      await addDoc(collection(db, outgoingMessageCollection()), {
        from: waId,
        to: userPhone,
        message: text,
        timestamp: now,
      });

      const msgRef = doc(collection(db, messagesCollection(waId, userPhone)));
      await setDoc(msgRef, {
        message: text,
        sender: waId,
        userType: "admin",
        timeMillis: now,
        status: "pending",
        messageId: msgRef.id,
      });

      const targetChatRef = doc(db, chatDoc(waId, userPhone));
      await updateDoc(targetChatRef, {
        lastChatMessage: text,
        lastChatTime: now,
      }).catch(async () => {
        await setDoc(
          targetChatRef,
          {
            lastChatMessage: text,
            lastChatTime: now,
            phone: userPhone,
          },
          { merge: true }
        );
      });

      setReplyMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "38px";
      }
      setReplyStatus("Manual reply sent & queued with status 'pending'.");
      setTimeout(() => setReplyStatus(null), 3000);
      onMessageSent?.();
    } catch (err) {
      console.error("Failed to send manual reply:", err);
      setReplyStatus("Failed to send reply. Please check your connection.");
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (replyMessage.trim() && !isSendingReply) {
        handleSendManualReply(e);
      }
    }
  };

  return (
    <form
      onSubmit={handleSendManualReply}
      className="border-t border-border-custom bg-surface p-3 sm:px-4 shrink-0"
    >
      {replyStatus && (
        <div className="mb-2 text-[11px] font-medium text-accent-active">
          {replyStatus}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Type a manual reply... (Enter to send, Shift+Enter for new line)"
          value={replyMessage}
          onChange={(e) => setReplyMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 resize-none overflow-y-auto rounded-md border border-border-custom bg-canvas px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:border-text-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-text-primary min-h-[38px] max-h-36 leading-relaxed"
        />
        <button
          type="submit"
          disabled={isSendingReply || !replyMessage.trim()}
          className="inline-flex h-[38px] items-center justify-center rounded-md bg-text-primary px-4 text-xs font-medium text-surface transition-colors hover:bg-text-primary/90 focus:outline-none focus:ring-2 focus:ring-text-primary disabled:opacity-40 shrink-0"
        >
          {isSendingReply ? "Sending..." : "Send"}
        </button>
      </div>
    </form>
  );
});
