/**
 * Pure helpers over the chat schema — shared by web and mobile.
 *
 * Framework-free: no React, no SDK imports. Everything here is a pure
 * function over `@app/schema` types so both apps filter/display identically
 * with zero extra Firestore queries.
 */

import type { Chat, Contact, WaAccount } from "./firestore";

/** Built-in folder tabs, used when `WaAccount.folders` is unset. */
export const FOLDER_DEFAULTS: { key: string; name: string }[] = [
  { key: "work", name: "Work" },
  { key: "hidden", name: "Hidden" },
];

/** Folder keys that always exist regardless of `WaAccount.folders`. */
export const BUILTIN_FOLDER_KEYS = ["work", "hidden"] as const;

export type FolderKey = (typeof BUILTIN_FOLDER_KEYS)[number] | (string & {});

/**
 * Resolve the label set to show as folder tabs.
 * Built-in keys are always present (admin labels override the default names);
 * custom keys from `WaAccount.folders` are appended.
 */
export function effectiveFolders(account: WaAccount | null | undefined) {
  const custom = account?.folders ?? [];
  const byKey = new Map(custom.map((f) => [f.key, f.name]));
  const builtins = BUILTIN_FOLDER_KEYS.map((key) => ({
    key,
    name: byKey.get(key) ?? FOLDER_DEFAULTS.find((f) => f.key === key)!.name,
  }));
  const customs = custom.filter((f) => !(BUILTIN_FOLDER_KEYS as readonly string[]).includes(f.key));
  return [...builtins, ...customs];
}

/**
 * Merge display names: admin `display_name` wins, then synced `name`,
 * then the raw phone number.
 */
export function resolveDisplayName(
  contact: Contact | null | undefined,
  phone: string
): string {
  return contact?.display_name?.trim() || contact?.name?.trim() || phone;
}

export type TabKey = "default" | "active" | "paused" | FolderKey;

/**
 * Does this chat appear under the given tab?
 *
 * - `default` — chats with no folder, or a folder that is not `hidden`
 *   (the default view intentionally hides "hidden" chats)
 * - `active` / `paused` — today's bot-status logic (folder-independent)
 * - any folder key — `chat.folder === key`
 */
export function matchesTab(
  chat: Pick<Chat, "bot_active" | "folder">,
  tab: TabKey,
  defaultPolicyActive: boolean
): boolean {
  if (tab === "active" || tab === "paused") {
    const isDefault = chat.bot_active == null;
    const effective = isDefault ? defaultPolicyActive : Boolean(chat.bot_active);
    return tab === "active" ? effective : !effective;
  }

  if (tab === "default") {
    return (chat.folder ?? null) !== "hidden";
  }

  return (chat.folder ?? null) === tab;
}
