import React from "react";
import { Message, WithId } from "@/types/firestore";
import { FormattedMessageText } from "@/components/formatted-message-text";
import { formatTimestamp, truncate, parseAudioMessage, formatDateDivider } from "@/lib/utils";

interface MessageBubbleProps {
  msg: WithId<Message>;
  prevMsg: WithId<Message> | null;
  waId: string;
  displayName: string;
  setLightboxImage: (url: string) => void;
  onForward?: (message: WithId<Message>) => void;
}

export function MessageBubble({
  msg,
  prevMsg,
  waId,
  displayName,
  setLightboxImage,
  onForward,
}: MessageBubbleProps) {
  const isCustomer = msg.userType === "customer";
  const audioInfo = parseAudioMessage(msg);

  const currentDateStr = formatDateDivider(msg.timeMillis);
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
          className={`group max-w-[85%] sm:max-w-[75%] min-w-0 rounded-lg px-3.5 py-2.5 text-xs shadow-2xs break-words [overflow-wrap:anywhere] ${
            isCustomer
              ? "bg-surface text-text-primary border border-border-custom"
              : "bg-accent-active-bg text-text-primary border border-accent-active/20"
          }`}
        >
          {/* Sender label */}
          <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-medium text-text-secondary">
            <span>{isCustomer ? displayName : "Bot / Admin"}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {onForward && (
                <button
                  onClick={() => onForward(msg)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-text-primary"
                  title="Forward message"
                >
                  ↗
                </button>
              )}
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
              <FormattedMessageText text={truncate(msg.messageQuoted, 80)} waId={waId} />
            </div>
          )}

          {/* Audio Message Rendering */}
          {audioInfo.isAudio ? (
            <div className="space-y-1.5 min-w-0">
              {audioInfo.displayText && (
                <FormattedMessageText text={audioInfo.displayText} waId={waId} />
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
            msg.message && <FormattedMessageText text={msg.message} waId={waId} />
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
}
