import React from "react";
import Link from "next/link";
import { parseMessageContent } from "@/lib/chat-helpers";

interface FormattedMessageTextProps {
  text: string;
  className?: string;
  waId?: string;
}

export function FormattedMessageText({ text, className, waId }: FormattedMessageTextProps) {
  if (!text) return null;

  const tokens = parseMessageContent(text);

  return (
    <span className={className || "whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]"}>
      {tokens.map((token, index) => {
        if (token.type === "url") {
          return (
            <a
              key={index}
              href={token.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="underline text-accent-active hover:opacity-80 break-words"
            >
              {token.value}
            </a>
          );
        }

        if (token.type === "wa_link" || token.type === "phone") {
          if (waId && token.phone) {
            return (
              <Link
                key={index}
                href={`/${encodeURIComponent(waId)}/contacts/${encodeURIComponent(token.phone)}`}
                onClick={(e) => e.stopPropagation()}
                title={`Open chat with ${token.phone}`}
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 bg-accent-active/10 text-accent-active hover:bg-accent-active/20 font-mono text-[11px] underline break-words"
              >
                <span>💬</span>
                <span>{token.value}</span>
              </Link>
            );
          }
          return (
            <span key={index} className="font-mono text-accent-active">
              {token.value}
            </span>
          );
        }

        return <React.Fragment key={index}>{token.value}</React.Fragment>;
      })}
    </span>
  );
}
