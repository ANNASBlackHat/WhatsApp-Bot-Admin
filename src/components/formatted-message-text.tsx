"use client";

import React from "react";

interface FormattedMessageTextProps {
  text: string;
  className?: string;
}

export function FormattedMessageText({ text, className }: FormattedMessageTextProps) {
  if (!text) return null;

  // Regex matching URLs starting with http:// or https://
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <span className={className || "whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]"}>
      {parts.map((part, index) => {
        if (/^https?:\/\/[^\s]+$/i.test(part)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="underline text-accent-active hover:opacity-80 break-words"
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </span>
  );
}
