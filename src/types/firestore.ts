/**
 * TypeScript interfaces matching the Firestore schema for the WhatsApp Bot system.
 *
 * Sources:
 *   - Original README.md Firestore schema (existing collections)
 *   - wa-bot-admin-prd.md §8 (data model changes for the admin app)
 *
 * Convention: interfaces represent raw Firestore document data (without the
 * document ID). Use `WithId<T>` when you need the ID alongside the data.
 */

import { Timestamp } from "firebase/firestore";

// ---------------------------------------------------------------------------
// Utility: attach a Firestore document ID to any document type
// ---------------------------------------------------------------------------

/** Document data `T` combined with its Firestore document ID. */
export type WithId<T> = T & { id: string };

// ---------------------------------------------------------------------------
// Root document: wa_bot/{waId}
// ---------------------------------------------------------------------------

export interface QuietHours {
  enabled: boolean;
  start_time: string; // 24h format "HH:mm", e.g. "22:00"
  end_time: string;   // 24h format "HH:mm", e.g. "07:00"
  timezone: string;   // Timezone name, e.g. "Asia/Jakarta"
}

/**
 * Root document fields for a WhatsApp account.
 * Path: `wa_bot/{waId}`
 */
export interface WaAccount {
  /** Enables/disables AI auto-reply for this account. */
  is_bot_active: boolean;

  /**
   * Policy applied when a contact has no explicit `bot_active` value.
   * Added by the admin app (PRD §8).
   */
  default_bot_active_for_new_contacts?: boolean;

  /**
   * Scheduled bot pausing ("quiet hours") configuration.
   * Added by Task 15.
   */
  quiet_hours?: QuietHours;

  /** Optional friendly display name for account switcher. */
  display_name?: string;
}


// ---------------------------------------------------------------------------
// Contact: wa_bot/{waId}/contact/{sender}
// ---------------------------------------------------------------------------

/**
 * Address-book entry for a WhatsApp contact.
 * Path: `wa_bot/{waId}/contact/{sender}`
 */
export interface Contact {
  /** Contact display name. */
  name: string;
  /** Phone number. */
  phone: string;
  /** WhatsApp profile picture URL. */
  photo: string;
  /** Timestamp (ms) when first seen. */
  timeCreated: number;
  /** Timestamp (ms) when last updated. */
  timeModified: number;
}

// ---------------------------------------------------------------------------
// Chat metadata: wa_bot/{waId}/chat/{userPhone}
// ---------------------------------------------------------------------------

/**
 * Per-contact chat metadata. Combines the original schema fields with the
 * new fields from PRD §8 (`bot_active`, `custom_prompt_id`).
 * Path: `wa_bot/{waId}/chat/{userPhone}`
 */
export interface Chat {
  /** Timestamp of last message (ms). */
  lastChatTime: number;
  /** Text of last message. */
  lastChatMessage: string;
  /** Participant's phone number. */
  phone: string;
  /** Count of unread messages. */
  unreadCount: number;

  /**
   * Per-contact bot override (PRD §8).
   * - `true`  → bot enabled for this contact
   * - `false` → bot disabled for this contact
   * - `null` / missing → fall back to `WaAccount.default_bot_active_for_new_contacts`
   */
  bot_active?: boolean | null;

  /**
   * References a doc in the `prompts` collection (PRD §8).
   * When set, the bot uses `prompts/{custom_prompt_id}` instead of the default.
   */
  custom_prompt_id?: string;
}

// ---------------------------------------------------------------------------
// Message: wa_bot/{waId}/chat/{userPhone}/messages/{messageId}
// Also used for: wa_bot/{waId}/chat/{userPhone}/status/{messageId}
//                wa_bot/{waId}/status_feed/{messageId}
// ---------------------------------------------------------------------------

/** Sender type: incoming customer or outgoing admin/bot. */
export type UserType = "customer" | "admin";

/**
 * A single chat message (or status/story message).
 * Path: `wa_bot/{waId}/chat/{userPhone}/messages/{messageId}`
 *
 * The same shape is reused for:
 *   - Status subcollection: `wa_bot/{waId}/chat/{userPhone}/status/{messageId}`
 *   - Flat status feed:     `wa_bot/{waId}/status_feed/{messageId}`
 */
export interface Message {
  /** Message timestamp (ms). */
  timeMillis: number;
  /** Text content. */
  message: string;
  /** Sender phone number. */
  sender: string;
  /** `"customer"` (incoming) or `"admin"` (outgoing/bot). */
  userType: UserType;
  /** Message delivery status (e.g. `"sent"`). */
  status: string;
  /** Message type (e.g. `"audio"`, `"image"`, `"video"`, `"document"`). */
  type?: string;
  /** Unique message ID. */
  messageId: string;

  // --- Optional media fields ---
  /** Image URL. */
  imgUrl?: string;
  /** File/video URL. */
  fileUrl?: string;
  /** Video thumbnail URL. */
  thumb?: string;

  // --- Optional quoted-message fields ---
  /** ID of quoted message. */
  messageQuotedId?: string;
  /** Text of quoted message. */
  messageQuoted?: string;

  // --- Optional story fields ---
  /** Whether this is a status/story post. */
  isStoryPost?: boolean;
  /** Story message ID. */
  storyMessageId?: string;

  /** Raw WhatsApp protobuf JSON (stored for debugging/replay). */
  originalMessageJSON?: string;
}

/**
 * Status/story message — same shape as a regular Message.
 * Paths: `wa_bot/{waId}/chat/{userPhone}/status/{messageId}`
 *        `wa_bot/{waId}/status_feed/{messageId}`
 */
export type StatusMessage = Message;

// ---------------------------------------------------------------------------
// Custom prompt (legacy): wa_bot/{waId}/custom_prompts/{userPhone}
// ---------------------------------------------------------------------------

/**
 * Legacy per-contact custom prompt (stores raw prompt text).
 * Path: `wa_bot/{waId}/custom_prompts/{userPhone}`
 *
 * Kept as-is for backward compatibility. May eventually be migrated to
 * reference `prompts/{promptId}` via `Chat.custom_prompt_id` (PRD §8).
 */
export interface CustomPrompt {
  /** Custom system prompt text for this user (overrides default). */
  prompt: string;
}

// ---------------------------------------------------------------------------
// Prompt library (new): wa_bot/{waId}/prompts/{promptId}
// ---------------------------------------------------------------------------

/**
 * A reusable prompt template in the prompt library (PRD §8, new collection).
 * Path: `wa_bot/{waId}/prompts/{promptId}`
 */
export interface Prompt {
  /** Human-readable label (e.g. "Nindia persona", "Default support"). */
  name: string;
  /** The system prompt text. */
  content: string;
  /** True for the fallback prompt when a contact has no per-contact override. */
  is_default: boolean;
  /** Creation timestamp (ms since epoch). */
  timeCreated: number;
  /** Last-edit timestamp (ms since epoch). */
  timeModified: number;
}

// ---------------------------------------------------------------------------
// Outgoing message queue: wa_bot/recent-chat/all/{autoId}
// ---------------------------------------------------------------------------

/**
 * An outgoing message queued for delivery.
 * Path: `wa_bot/recent-chat/all/{autoId}`
 *
 * AI-generated replies are written here, picked up by a snapshot listener in
 * the Go backend, sent via WhatsApp, then deleted.
 */
export interface OutgoingMessage {
  /** Sender waId (WhatsApp account). */
  from: string;
  /** Recipient phone number. */
  to: string;
  /** Text content. */
  message: string;
  /** Timestamp (ms). */
  timestamp: number;

  // --- Optional fields ---
  /** Image URL. */
  imgUrl?: string;
  /** Quoted message ID. */
  quotedMessageId?: string;
  /** Quoted message sender JID. */
  quotedMessageSender?: string;
  /** Original message JSON. */
  originalMessageJSON?: string;
}

// ---------------------------------------------------------------------------
// Daily plan: wa_bot/{waId}/daily_plans/{userPhone}/plans/{date}
// ---------------------------------------------------------------------------

/**
 * AI-generated daily plan for a contact (used by the Nindia persona).
 * Path: `wa_bot/{waId}/daily_plans/{userPhone}/plans/{date}`
 */
export interface DailyPlan {
  /** Date in `YYYY-MM-DD` format. */
  date: string;
  /** AI-generated daily schedule text. */
  plan: string;
  /** When the plan was generated. */
  timestamp: Timestamp;
}

// ---------------------------------------------------------------------------
// FCM push token: customer_support/{tokenId}
// ---------------------------------------------------------------------------

/**
 * FCM push notification token for customer support staff.
 * Path: `customer_support/{tokenId}`
 *
 * Out of scope for the admin app but included for schema completeness.
 */
export interface CustomerSupportToken {
  /** FCM registration token. */
  token: string;
}
