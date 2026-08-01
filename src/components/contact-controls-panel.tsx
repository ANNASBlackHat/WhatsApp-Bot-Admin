"use client";

import React from "react";
import { Chat, Contact, Prompt, WithId } from "@/types/firestore";

interface ContactControlsPanelProps {
  contact: Contact | null;
  chat: Chat | null;
  displayName: string;
  userPhone: string;
  isEffectiveActive: boolean;
  isDefaultPolicy: boolean;
  defaultPolicyActive: boolean;
  isUpdatingBot: boolean;
  loadingChat: boolean;
  isUpdatingPrompt: boolean;
  prompts: WithId<Prompt>[];
  handleToggleBot: () => void;
  handleResetBot: () => void;
  handlePromptChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

export function ContactControlsPanel({
  contact,
  chat,
  displayName,
  userPhone,
  isEffectiveActive,
  isDefaultPolicy,
  defaultPolicyActive,
  isUpdatingBot,
  loadingChat,
  isUpdatingPrompt,
  prompts,
  handleToggleBot,
  handleResetBot,
  handlePromptChange,
}: ContactControlsPanelProps) {
  return (
    <div className="rounded-lg border border-border-custom bg-surface p-4 shadow-xs space-y-5">
      {/* SECTION 1: Contact Details */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary border-b border-border-custom pb-2">
          Contact Details
        </h3>

        <div className="mt-3 flex items-center gap-3">
          {contact?.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={contact.photo}
              alt={displayName}
              className="h-10 w-10 rounded-full object-cover border border-border-custom"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-hover text-xs font-medium text-text-primary border border-border-custom">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-text-primary">
              {displayName}
            </p>
            <p className="font-mono text-[11px] text-text-secondary">{userPhone}</p>
          </div>
        </div>
      </div>

      {/* SECTION 2: Bot Control */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary border-b border-border-custom pb-2">
          Bot Control
        </h3>

        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-primary">
                {isEffectiveActive ? "Bot Active" : "Bot Paused"}
              </p>
              <p className="text-[11px] text-text-secondary">
                {isDefaultPolicy
                  ? `Default (${defaultPolicyActive ? "Active" : "Paused"})`
                  : "Explicit override"}
              </p>
            </div>

            <button
              type="button"
              disabled={isUpdatingBot || loadingChat}
              onClick={handleToggleBot}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-text-primary focus:ring-offset-2 disabled:opacity-50 ${
                chat?.bot_active === true
                  ? "bg-accent-active"
                  : chat?.bot_active === false
                  ? "bg-accent-paused"
                  : "bg-text-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm transition duration-150 ease-in-out ${
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
              className="w-full rounded border border-border-custom bg-canvas py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              Reset to default policy
            </button>
          )}
        </div>
      </div>

      {/* SECTION 3: Assigned Prompt */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary border-b border-border-custom pb-2">
          Assigned Prompt
        </h3>

        <div className="mt-3 space-y-2">
          <label htmlFor="prompt-select" className="text-[11px] font-medium text-text-primary">
            Select system prompt template
          </label>

          <select
            id="prompt-select"
            disabled={isUpdatingPrompt || loadingChat}
            value={chat?.custom_prompt_id || "default"}
            onChange={handlePromptChange}
            className="w-full rounded border border-border-custom bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:border-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary disabled:opacity-50"
          >
            <option value="default">-- Use Default Prompt --</option>
            {prompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.is_default ? "(Default)" : ""}
              </option>
            ))}
          </select>

          <p className="text-[11px] text-text-secondary">
            {chat?.custom_prompt_id
              ? "Custom assigned prompt."
              : "Using default system prompt."}
          </p>
        </div>
      </div>
    </div>
  );
}
