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

export type MessageToken =
  | { type: "text"; value: string }
  | { type: "url"; value: string; href: string }
  | { type: "phone"; value: string; phone: string }
  | { type: "wa_link"; value: string; phone: string };

/**
 * Normalizes phone numbers to standard format without symbols (e.g. +628123 -> 628123).
 * If it starts with local prefix '0', replaces with country code if given or keeps clean.
 */
export function normalizePhoneNumber(raw: string): string {
  // Strip all non-digits
  const digits = raw.replace(/\D/g, "");
  // If local Indonesian '08xxx', standard WhatsApp phone is '628xxx'
  if (digits.startsWith("08")) {
    return "62" + digits.slice(1);
  }
  return digits;
}

/**
 * Parses message body into text chunks, standard web links, wa.me links, and phone numbers.
 * Allows web and mobile to render interactive in-app routing.
 */
export function parseMessageContent(text: string): MessageToken[] {
  if (!text) return [];

  // Match:
  // 1. Full URLs: https?://...
  // 2. wa.me links: (?:https?:\/\/)?wa\.me\/(?:\+?[0-9]+) or api.whatsapp.com/send\?phone=([0-9]+)
  // 3. International or national phone numbers:
  //    - e.g. +6281234567890, 081234567890, +12345678901
  //    We require at least 9 to 15 digits to avoid misidentifying small numbers, dates or codes.
  const tokenRegex = /(https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&//=]*)|(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?[+]?([0-9]{7,15})|(?:\+?[0-9]{1,3}[-.\s]?)?\(?[0-9]{2,4}\)?[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,6}/g;

  const tokens: MessageToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchText = match[0];
    const matchEnd = matchStart + matchText.length;

    // Any text before match
    if (matchStart > lastIndex) {
      tokens.push({
        type: "text",
        value: text.slice(lastIndex, matchStart),
      });
    }

    // Check if it's a wa.me / api.whatsapp.com link
    const waMeMatch = matchText.match(/(?:https?:\/\/)?(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)\+?([0-9]{7,15})/i);
    if (waMeMatch) {
      const phoneDigits = normalizePhoneNumber(waMeMatch[1]);
      tokens.push({
        type: "wa_link",
        value: matchText,
        phone: phoneDigits,
      });
      lastIndex = matchEnd;
      continue;
    }

    // Check if it's a regular URL
    if (/^https?:\/\//i.test(matchText)) {
      tokens.push({
        type: "url",
        value: matchText,
        href: matchText,
      });
      lastIndex = matchEnd;
      continue;
    }

    // Check if it's a phone number (must have at least 8 digits and not just a plain year/short number)
    const digitsOnly = matchText.replace(/\D/g, "");
    if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
      // Avoid matching simple 4-digit years or time expressions
      tokens.push({
        type: "phone",
        value: matchText,
        phone: normalizePhoneNumber(matchText),
      });
      lastIndex = matchEnd;
      continue;
    }

    // Fallback: treated as plain text
    tokens.push({
      type: "text",
      value: matchText,
    });

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return tokens;
}
