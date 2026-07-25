/**
 * Firestore collection path helpers.
 *
 * Centralizes all Firestore path construction so that typos and
 * inconsistencies are caught in one place rather than scattered
 * across the codebase.
 */

/**
 * The WhatsApp account ID used as the Firestore partition key.
 * Falls back to an empty string so the app can start without
 * crashing — callers should guard against empty before querying.
 */
export const WA_ID = process.env.NEXT_PUBLIC_WA_ID ?? "";

/** Root document for a WhatsApp account. */
export const waAccountDoc = () => `wa_bot/${WA_ID}` as const;

/** Contact document. */
export const contactDoc = (sender: string) =>
  `wa_bot/${WA_ID}/contact/${sender}` as const;

/** Contact collection. */
export const contactCollection = () =>
  `wa_bot/${WA_ID}/contact` as const;

/** Chat metadata document. */
export const chatDoc = (userPhone: string) =>
  `wa_bot/${WA_ID}/chat/${userPhone}` as const;

/** Chat collection. */
export const chatCollection = () =>
  `wa_bot/${WA_ID}/chat` as const;

/** Messages subcollection under a chat. */
export const messagesCollection = (userPhone: string) =>
  `wa_bot/${WA_ID}/chat/${userPhone}/messages` as const;

/** Single message document. */
export const messageDoc = (userPhone: string, messageId: string) =>
  `wa_bot/${WA_ID}/chat/${userPhone}/messages/${messageId}` as const;

/** Status subcollection under a chat. */
export const statusCollection = (userPhone: string) =>
  `wa_bot/${WA_ID}/chat/${userPhone}/status` as const;

/** Prompts collection (new — PRD §8). */
export const promptsCollection = () =>
  `wa_bot/${WA_ID}/prompts` as const;

/** Single prompt document. */
export const promptDoc = (promptId: string) =>
  `wa_bot/${WA_ID}/prompts/${promptId}` as const;

/** Legacy custom-prompt document. */
export const customPromptDoc = (userPhone: string) =>
  `wa_bot/${WA_ID}/custom_prompts/${userPhone}` as const;

/** Custom prompts collection. */
export const customPromptsCollection = () =>
  `wa_bot/${WA_ID}/custom_prompts` as const;

/** Outgoing message queue collection. */
export const outgoingMessageCollection = () =>
  `wa_bot/recent-chat/all` as const;

/** Status feed (flat). */
export const statusFeedCollection = () =>
  `wa_bot/${WA_ID}/status_feed` as const;

/** Daily plans subcollection. */
export const dailyPlansCollection = (userPhone: string) =>
  `wa_bot/${WA_ID}/daily_plans/${userPhone}/plans` as const;
