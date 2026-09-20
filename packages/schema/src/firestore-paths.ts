/**
 * Firestore collection path helpers.
 *
 * Centralizes all Firestore path construction so that typos and
 * inconsistencies are caught in one place rather than scattered
 * across the codebase.
 *
 * NOTE: canonical copy shared by every app in the monorepo (web today,
 * React Native tomorrow). Framework-free — no React/Next imports.
 */

/** Root document for a WhatsApp account. */
export const waAccountDoc = (waId: string) => `wa_bot/${waId}` as const;

/** Contact document. */
export const contactDoc = (waId: string, sender: string) =>
  `wa_bot/${waId}/contact/${sender}` as const;

/** Contact collection. */
export const contactCollection = (waId: string) =>
  `wa_bot/${waId}/contact` as const;

/** Chat metadata document. */
export const chatDoc = (waId: string, userPhone: string) =>
  `wa_bot/${waId}/chat/${userPhone}` as const;

/** Chat collection. */
export const chatCollection = (waId: string) =>
  `wa_bot/${waId}/chat` as const;

/** Messages subcollection under a chat. */
export const messagesCollection = (waId: string, userPhone: string) =>
  `wa_bot/${waId}/chat/${userPhone}/messages` as const;

/** Single message document. */
export const messageDoc = (waId: string, userPhone: string, messageId: string) =>
  `wa_bot/${waId}/chat/${userPhone}/messages/${messageId}` as const;

/** Status subcollection under a chat. */
export const statusCollection = (waId: string, userPhone: string) =>
  `wa_bot/${waId}/chat/${userPhone}/status` as const;

/** Prompts collection (PRD §8). */
export const promptsCollection = (waId: string) =>
  `wa_bot/${waId}/prompts` as const;

/** Single prompt document. */
export const promptDoc = (waId: string, promptId: string) =>
  `wa_bot/${waId}/prompts/${promptId}` as const;

/** Legacy custom-prompt document. */
export const customPromptDoc = (waId: string, userPhone: string) =>
  `wa_bot/${waId}/custom_prompts/${userPhone}` as const;

/** Custom prompts collection. */
export const customPromptsCollection = (waId: string) =>
  `wa_bot/${waId}/custom_prompts` as const;

/** Outgoing message queue collection. */
export const outgoingMessageCollection = () =>
  `wa_bot/recent-chat/all` as const;

/** Status feed (flat). */
export const statusFeedCollection = (waId: string) =>
  `wa_bot/${waId}/status_feed` as const;

/** Daily plans subcollection. */
export const dailyPlansCollection = (waId: string, userPhone: string) =>
  `wa_bot/${waId}/daily_plans/${userPhone}/plans` as const;
