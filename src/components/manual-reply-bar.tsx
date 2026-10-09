"use client";

import React, { useEffect, useRef, useState } from "react";
import { WebChatDataSource } from "@app/data/web";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

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
  
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevHeightRef = useRef<number>(38);

  const chatSource = useRef(new WebChatDataSource(db)).current;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (!replyMessage && !file) {
      textarea.style.height = "38px";
      prevHeightRef.current = 38;
      return;
    }

    textarea.style.height = "auto";
    const targetHeight = Math.min(textarea.scrollHeight, 144);
    if (targetHeight !== prevHeightRef.current) {
      textarea.style.height = `${targetHeight}px`;
      prevHeightRef.current = targetHeight;
    } else {
      textarea.style.height = `${targetHeight}px`;
    }
  }, [replyMessage, file]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendManualReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = replyMessage.trim();
    if ((!text && !file) || isSendingReply) return;

    try {
      setIsSendingReply(true);
      setReplyStatus(null);
      
      if (file) {
        const isImage = file.type.startsWith("image/");
        const storageRef = ref(storage, `attachments/${waId}/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              reject(error);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await chatSource.sendMediaReply(waId, userPhone, {
                  url: downloadURL,
                  type: isImage ? 'image' : 'document',
                  caption: text,
                  fileName: file.name
                });
                resolve();
              } catch (err) {
                reject(err);
              }
            }
          );
        });
      } else {
        await chatSource.sendManualReply(waId, userPhone, text);
      }

      setReplyMessage("");
      setFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (textareaRef.current) {
        textareaRef.current.style.height = "38px";
      }
      setReplyStatus("Manual reply sent successfully.");
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
      if ((replyMessage.trim() || file) && !isSendingReply) {
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
      
      {file && (
        <div className="mb-2 flex items-center justify-between rounded bg-surface-hover p-2 border border-border-custom text-xs">
          <div className="flex items-center gap-2 truncate">
            <span>{file.type.startsWith("image/") ? "📷" : "📎"}</span>
            <span className="truncate max-w-[200px] text-text-primary font-medium">{file.name}</span>
            <span className="text-text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <span className="text-accent-active ml-2">{Math.round(uploadProgress)}%</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleRemoveFile}
            className="text-text-muted hover:text-text-primary ml-4"
            disabled={isSendingReply}
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*, .pdf, .doc, .docx, .xls, .xlsx, .txt"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSendingReply}
          className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-md border border-border-custom bg-canvas text-text-secondary hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-text-primary disabled:opacity-40 shrink-0"
          title="Attach file"
        >
          📎
        </button>
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
          disabled={isSendingReply || (!replyMessage.trim() && !file)}
          className="inline-flex h-[38px] items-center justify-center rounded-md bg-text-primary px-4 text-xs font-medium text-surface transition-colors hover:bg-text-primary/90 focus:outline-none focus:ring-2 focus:ring-text-primary disabled:opacity-40 shrink-0"
        >
          {isSendingReply ? "Sending..." : "Send"}
        </button>
      </div>
    </form>
  );
});
