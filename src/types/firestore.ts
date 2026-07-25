/**
 * TypeScript interfaces matching the Firestore schema for the WhatsApp Bot system.
 * See: README.md (existing schema) and wa-bot-admin-prd.md §8 (data model changes).
 */

// ---------------------------------------------------------------------------
// Root document: wa_bot/{waId}
// ---------------------------------------------------------------------------

/** Root document fields for a WhatsApp account. */
export interface WaAccount {
  /** Enables/disables AI auto-reply for this account (existing). */
  is_bot_active: boolean;

  /**
   * Policy applied when a contact has no explicit `bot_active` value.
   * Added by the admin app (PRD §8).
   */
  default_bot_active_for_new_contacts?: boolean;
}

// ---------------------------------------------------------------------------
// Contact: wa_bot/{waId}/contact/{sender}
// ---------------------------------------------------------------------------

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
   * Per-contact bot override. `null`/`undefined` = fall back to the default
   * policy on the root document (PRD §8).
   */
  bot_active?: boolean | null;

  /**
   * References a doc in the `prompts` collection (PRD §8).
   * When set, the bot uses this prompt instead of the default.
   */
  custom_prompt_id?: string;
}

// ---------------------------------------------------------------------------
// Message: wa_bot/{waId}/chat/{userPhone}/messages/{messageId}
// ---------------------------------------------------------------------------

export type UserType = "customer" | "admin";

export interface Message {
  /** Message timestamp (ms). */
  timeMillis: number;
  /** Text content. */
  message: string;
  /** Sender phone number. */
  sender: string;
  /** `"customer"` (incoming) or `"admin"` (outgoing/bot). */
  userType: UserType;
  /** Message delivery status. */
  status: string;
  /** Unique message ID. */
  messageId: string;

  // Optional media fields
  /** Image URL. */
  imgUrl?: string;
  /** File/video URL. */
  fileUrl?: string;
  /** Video thumbnail URL. */
  thumb?: string;

  // Optional quoted-message fields
  /** ID of quoted message. */
  messageQuotedId?: string;
  /** Text of quoted message. */
  messageQuoted?: string;

  // Optional story fields
  /** Whether this is a status/story post. */
  isStoryPost?: boolean;
  /** Story message ID. */
  storyMessageId?: string;

  /** Raw WhatsApp protobuf JSON. */
  originalMessageJSON?: string;
}

// ---------------------------------------------------------------------------
// Custom prompt (legacy): wa_bot/{waId}/custom_prompts/{userPhone}
// ---------------------------------------------------------------------------

export interface CustomPrompt {
  /** Custom system prompt for this user (overrides default). */
  prompt: string;
}

// ---------------------------------------------------------------------------
// Prompt library (new): wa_bot/{waId}/prompts/{promptId}
// ---------------------------------------------------------------------------

export interface Prompt {
  /** Human-readable label (e.g. "Nindia persona", "Default support"). */
  name: string;
  /** The system prompt text. */
  content: string;
  /** True for the fallback prompt when a contact has no override. */
  is_default: boolean;
  /** Creation timestamp (ms). */
  timeCreated: number;
  /** Last-edit timestamp (ms). */
  timeModified: number;
}

// ---------------------------------------------------------------------------
// Outgoing message queue: wa_bot/recent-chat/all/{autoId}
// ---------------------------------------------------------------------------

export interface OutgoingMessage {
  /** Sender waId. */
  from: string;
  /** Recipient phone number. */
  to: string;
  /** Text content. */
  message: string;
  /** Timestamp (ms). */
  timestamp: number;

  // Optional fields
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
// Status message: wa_bot/{waId}/chat/{userPhone}/status/{messageId}
//                 wa_bot/{waId}/status_feed
// Same shape as Message.
// ---------------------------------------------------------------------------

export type StatusMessage = Message;

// ---------------------------------------------------------------------------
// Daily plan: wa_bot/{waId}/daily_plans/{userPhone}/plans/{date}
// ---------------------------------------------------------------------------

export interface DailyPlan {
  /** Date in YYYY-MM-DD format. */
  date: string;
  /** AI-generated daily schedule. */
  plan: string;
  /** When generated (Firestore Timestamp). */
  timestamp: unknown; // Firestore Timestamp — kept as `unknown` to avoid coupling to SDK type here
}
