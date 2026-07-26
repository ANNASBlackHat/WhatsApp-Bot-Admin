# WhatsApp Bot Admin — User Stories

All stories are written from the perspective of the **admin** (you, or whoever manages the bot). Priority: **P0** = MVP, **P1** = Phase 2, **P2** = later/nice-to-have.

---

## Epic 1: Bot control

**US-1.1** (P0) As an admin, I want to toggle the bot on/off for a specific contact, so that I can hand a conversation to a human without affecting anyone else.
- Toggle is visible in the contacts list and in contact detail
- Change writes to `chat/{userPhone}.bot_active` and takes effect on the next incoming message

**US-1.2** (P0) As an admin, I want a single global switch to disable the bot for the entire account, so that I can pause everything during an incident or maintenance.
- Maps to existing `wa_bot/{waId}.is_bot_active`
- Clearly separated in the UI from per-contact toggles so it's not mistaken for one

**US-1.3** (P0) As an admin, I want to set a default policy (auto-on or auto-off) for brand-new contacts, so that I don't have to manually configure every first-time sender.
- Stored as `wa_bot/{waId}.default_bot_active_for_new_contacts`
- A contact with no explicit `bot_active` value inherits this policy

**US-1.4** (P1) As an admin, I want to bulk-disable the bot for a filtered set of contacts (e.g. inactive 30+ days), so that I can clean up stale auto-replies in one action.
- Filter by last-active date, tag, or search term
- Confirmation step before applying to multiple contacts

---

## Epic 2: Prompt management

**US-2.1** (P0) As an admin, I want to create, edit, and delete prompts stored in Firestore, so that I no longer have to redeploy the Go backend to change bot behavior.
- CRUD against `wa_bot/{waId}/prompts/{promptId}`
- Edits take effect on the next AI call, no backend restart needed

**US-2.2** (P0) As an admin, I want to mark one prompt as the default, so that any contact without a custom prompt uses a sensible fallback.
- Only one prompt can be `is_default: true` at a time; setting a new default unsets the old one

**US-2.3** (P0) As an admin, I want to assign a specific prompt to an individual contact, so that I can give different personas or instructions per conversation.
- Dropdown/selector in contact detail, backed by `custom_prompts/{userPhone}`

**US-2.4** (P1) As an admin, I want to see prompt version history and revert to a previous version, so that I can undo a change that made the bot behave worse.
- Each edit creates a snapshot with timestamp
- One-click revert restores prior content

**US-2.5** (P1) As an admin, I want a sandbox where I can type a test message and see what the AI would reply with a given prompt, so that I can validate changes before they go live.
- No message is sent to WhatsApp; purely a preview against the AI service

---

## Epic 3: Contacts & chat

**US-3.1** (P0) As an admin, I want to see a list of all contacts with last message, timestamp, and unread count, so that I can quickly scan what needs attention.
- Sorted by most recent activity by default
- Real-time updates via Firestore listeners

**US-3.2** (P0) As an admin, I want to open a contact and read the recent message thread, so that I have context before deciding to intervene.
- Loads last 20–50 messages from `chat/{userPhone}/messages`
- Distinguishes customer vs. admin/bot messages visually

**US-3.3** (P1) As an admin, I want to search/filter contacts by name, phone, or message content, so that I can find a specific conversation quickly.

**US-3.4** (P1) As an admin, I want to send a manual reply from the web app, so that I can step in on a conversation without switching to my phone.
- Writes to `wa_bot/recent-chat/all`, same path the bot uses, so it's picked up and sent the same way

**US-3.5** (P1) As an admin, I want images, videos, and files to render inline in the thread, so that I don't have to open raw URLs to see attachments.

**US-3.6** (P2) As an admin, I want quoted/replied messages to show the original text they're replying to, so that conversations with context are easier to follow.

**US-3.7** (P1) As an admin, I want to mark a chat as read, so that the unread count reflects what I've actually reviewed.

---

## Epic 4: Segmentation & organization

**US-4.1** (P2) As an admin, I want to tag contacts (e.g. VIP, spam, needs-human), so that I can organize and filter conversations beyond just recency.

**US-4.2** (P1) As an admin, I want to see contacts grouped or filterable by bot status (active/paused), so that I can audit who currently has the bot on.

---

## Epic 5: Status / story management

**US-5.1** (P2) As an admin, I want to view the status/story feed (`status_feed` and per-contact `status`), so that I have visibility into that content without a separate tool.

---

## Epic 6: Ops & visibility

**US-6.1** (P1) As an admin, I want a simple dashboard showing messages sent today, how many bots are active vs. paused, and most active contacts, so that I can get a health check at a glance.

**US-6.2** (P2) As an admin, I want an audit log of who changed which prompt or toggle and when, so that I can trace unexpected bot behavior back to a specific change.
- Matters most once there's more than one admin

**US-6.3** (P2) As an admin, I want to be notified (e.g. via Telegram) when the bot is toggled off or a contact needs human handoff, so that I don't miss something time-sensitive while away from the dashboard.

---

## Epic 7: Access & later-stage

**US-7.1** (P0) As an admin, I want to log in before accessing any of this, so that bot configuration isn't exposed to anyone with the URL.
- Firebase Auth gate on the whole app

**US-7.2** (P2) As an admin, I want to invite other admins with defined roles, so that I'm not the single point of failure for managing the bot.

**US-7.3** (P2) As an admin, I want to export a contact's chat history (CSV/PDF), so that I can archive or share a conversation outside the app.

---

## Suggested build order (maps to priority)

1. **P0 stories** — Epics 1, 2 (core CRUD), 3.1–3.2, 7.1. This is a usable admin tool.
2. **P1 stories** — search, manual reply, media rendering, prompt versioning/sandbox, bulk actions, dashboard.
3. **P2 stories** — tags, audit log, alerts, status feed, multi-admin, export.
