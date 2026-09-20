"use client";

import React, { useState } from "react";
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
  folders: { key: string; name: string }[];
  folderBusy: boolean;
  renameBusy: boolean;
  handleToggleBot: () => void;
  handleResetBot: () => void;
  handlePromptChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleFolderChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleRename: (name: string | null) => void;
}

export const ContactControlsPanel = React.memo(function ContactControlsPanel({
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
  folders,
  folderBusy,
  renameBusy,
  handleToggleBot,
  handleResetBot,
  handlePromptChange,
  handleFolderChange,
  handleRename,
}: ContactControlsPanelProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const startRename = () => {
    setNameDraft(contact?.display_name?.trim() || "");
    setEditingName(true);
  };

  const saveRename = () => {
    const trimmed = nameDraft.trim();
    setEditingName(false);
    // Same value (or clear) → no write needed
    if ((trimmed || null) === (contact?.display_name?.trim() || null)) return;
    void handleRename(trimmed || null);
  };
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
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  type="text"
                  value={nameDraft}
                  placeholder={contact?.name || userPhone}
                  disabled={renameBusy}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  className="w-full rounded border border-border-custom bg-canvas px-2 py-1 text-xs text-text-primary focus:border-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={saveRename}
                  disabled={renameBusy}
                  title="Save name"
                  className="shrink-0 rounded border border-border-custom bg-surface px-1.5 py-1 text-[11px] text-accent-active hover:bg-surface-hover disabled:opacity-50"
                >
                  ✓
                </button>
                {contact?.display_name?.trim() && !renameBusy && (
                  <button
                    type="button"
                    onClick={() => setEditingName(false)}
                    title="Clear display name"
                    className="shrink-0 rounded border border-border-custom bg-surface px-1.5 py-1 text-[11px] text-accent-paused hover:bg-surface-hover"
                  >
                    ✕
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="truncate text-xs font-medium text-text-primary">
                  {displayName}
                </p>
                <button
                  type="button"
                  onClick={startRename}
                  title="Rename contact (local display name)"
                  className="shrink-0 rounded border border-border-custom bg-canvas p-0.5 text-[10px] text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.532 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.862 4.487z" />
                  </svg>
                </button>
              </div>
            )}
            {contact?.display_name?.trim() && (
              <p className="text-[10px] text-text-muted">
                Synced name: {contact.name}
              </p>
            )}
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
              className="w-full rounded border border-border-custom bg-canvas py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-hover"
            >
              Reset to default policy
            </button>
          )}
        </div>
      </div>

      {/* SECTION 3: Chat Folder */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary border-b border-border-custom pb-2">
          Chat Folder
        </h3>

        <div className="mt-3 space-y-2">
          <label htmlFor="folder-select" className="text-[11px] font-medium text-text-primary">
            Move to tab
          </label>

          <select
            id="folder-select"
            disabled={folderBusy || loadingChat}
            value={chat?.folder ?? "none"}
            onChange={handleFolderChange}
            className="w-full rounded border border-border-custom bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:border-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary disabled:opacity-50"
          >
            <option value="none">Default view</option>
            {folders.map((f) => (
              <option key={f.key} value={f.key}>
                {f.name}
              </option>
            ))}
          </select>

          <p className="text-[11px] text-text-secondary">
            {chat?.folder ? "Shown under its own tab only." : "Shown in the default view."}
          </p>
        </div>
      </div>

      {/* SECTION 4: Assigned Prompt */}
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
});
