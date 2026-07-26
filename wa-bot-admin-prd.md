# PRD: WhatsApp Bot Admin Web App

**Status:** Draft
**Owner:** Annas
**Last updated:** 2026-07-25

---

## 1. Summary

The WhatsApp bot (Go backend, Firestore-backed) currently runs with no admin surface: bot behavior is toggled account-wide only, prompts are hardcoded in Go, and there's no way to inspect chats or manage individual contacts without touching code or the raw database. This PRD defines a lightweight web app that sits on top of the existing Firestore schema to give an admin direct, per-contact control over the bot — without redeploying the backend for routine changes.

## 2. Problem statement

Three concrete pain points drive this:

1. **No per-contact control.** The bot is either on or off for the whole account. There's no way to pause it for one conversation (e.g. a customer who needs a human) without disabling it everywhere.
2. **Prompts are hardcoded.** Changing bot personality or instructions requires editing Go code and redeploying. This is slow and risky for something that should be a content change, not a code change.
3. **No visibility.** Chats, contacts, and status updates exist only in Firestore's raw structure. There's no way to browse them without a database console.

## 3. Goals

- Let the admin enable/disable the bot per contact, instantly, without a backend deploy.
- Let the admin set a default bot policy (on/off) for new contacts.
- Move prompts out of Go source code and into Firestore, editable from the UI.
- Allow different prompts to be assigned per contact.
- Provide a usable read view of chats and contacts as a byproduct of the above (needed to build the toggle/prompt UI anyway).

## 4. Non-goals (for v1)

- Not a full CRM — no deal pipelines, lead scoring, or sales workflows.
- Not a replacement for WhatsApp itself — no sending of first-contact/template messages, no WhatsApp Business API management.
- Not multi-tenant — designed for a single `waId` account initially, though the schema already supports more.
- No mobile app — responsive web is sufficient; this is used occasionally, not constantly.
- No AI-response quality evaluation tooling beyond the manual test sandbox (Phase 2).

## 5. Target user

Single admin (the account owner/operator) initially. Design should not preclude adding more admins later, but auth/roles beyond a single login are out of scope for v1.

## 6. Current system context

- **Backend:** Go service that syncs WhatsApp messages to Firestore and generates AI auto-replies.
- **Database:** Firestore, structured under `wa_bot/{waId}`, partitioned by WhatsApp account.
- **Existing controls:** `wa_bot/{waId}.is_bot_active` (account-wide only). No per-contact toggle exists today. Prompts live in Go source, keyed implicitly by persona (e.g. "Nindia").
- **Outgoing flow:** AI replies are written to `wa_bot/recent-chat/all/{autoId}`, picked up by a snapshot listener, sent via WhatsApp, then deleted.

This app is a **control surface** on top of that system — it reads and writes Firestore directly (or through Firestore security rules), and does not replace or wrap the Go backend's runtime logic. The one required backend change is described in Section 8.

## 7. Scope: features by phase

### Phase 1 — MVP

| Feature | User story ref |
|---|---|
| Login gate (Firebase Auth) | US-7.1 |
| Contacts list: name, last message, timestamp, unread count | US-3.1 |
| Per-contact bot on/off toggle | US-1.1 |
| Global bot on/off toggle | US-1.2 |
| Default policy for new contacts | US-1.3 |
| Prompt library: create/edit/delete | US-2.1 |
| Mark a prompt as default | US-2.2 |
| Assign a prompt to a specific contact | US-2.3 |
| Chat thread viewer (read-only, last 20–50 messages) | US-3.2 |

**Definition of done for Phase 1:** admin can log in, see all contacts, pause/resume the bot for any one of them, and change what prompt a contact's bot uses — all without touching Go code or a database console.

### Phase 2

| Feature | User story ref |
|---|---|
| Contact search/filter | US-3.3 |
| Manual reply from the web app | US-3.4 |
| Inline media rendering (images/video/files) | US-3.5 |
| Mark chat as read | US-3.7 |
| Prompt version history + revert | US-2.4 |
| Prompt test sandbox (no send) | US-2.5 |
| Bulk bot-disable by filter | US-1.4 |
| Bot-status filter/grouping | US-4.2 |
| Ops dashboard (messages today, active/paused counts, most active contacts) | US-6.1 |

### Phase 3 — later

| Feature | User story ref |
|---|---|
| Contact tagging | US-4.1 |
| Quoted-message rendering | US-3.6 |
| Status/story feed viewer | US-5.1 |
| Audit log of config changes | US-6.2 |
| Alerting (e.g. Telegram) on bot-off/handoff events | US-6.3 |
| Multi-admin with roles | US-7.2 |
| Chat export (CSV/PDF) | US-7.3 |

## 8. Data model changes

All additions are backward-compatible — missing fields fall back to existing behavior.

### `wa_bot/{waId}` (root document) — add field

| Field | Type | Description |
|---|---|---|
| `default_bot_active_for_new_contacts` | bool | Policy applied when a contact has no explicit `bot_active` value |

### `wa_bot/{waId}/chat/{userPhone}` — add fields

| Field | Type | Description |
|---|---|---|
| `bot_active` | bool \| null | Per-contact override. Null/missing = fall back to the default policy above |
| `custom_prompt_id` | string (optional) | References a doc in the new `prompts` collection |

### New: `wa_bot/{waId}/prompts/{promptId}`

| Field | Type | Description |
|---|---|---|
| `name` | string | Human-readable label (e.g. "Nindia persona", "Default support") |
| `content` | string | The system prompt text |
| `is_default` | bool | True for the fallback prompt when a contact has no override |
| `timeCreated` | int64 | Creation timestamp (ms) |
| `timeModified` | int64 | Last-edit timestamp (ms) |

### Existing: `wa_bot/{waId}/custom_prompts/{userPhone}`

Kept as-is. Can continue storing prompt text directly per contact, or be migrated to reference `prompts/{promptId}` via `custom_prompt_id` — either works for v1; the migration path can be decided during implementation, not blocking design.

### Required backend (Go) change

Before generating a reply, resolution logic must become:

```
bot_active  = chat.bot_active ?? waId.default_bot_active_for_new_contacts
prompt      = custom_prompts[userPhone] ?? prompts[default]
```

This is the only change required in the existing Go service. Everything else in this PRD is additive on the Firestore side and lives entirely in the new web app.

## 9. Architecture

- **Frontend:** Next.js (App Router) + TypeScript — consistent with existing stack (UNIQ, PropAgent).
- **Data access:** Firebase client SDK, using `onSnapshot` listeners for live contact list and unread counts.
- **Auth:** Firebase Auth (email/password or Google sign-in), gating the entire app.
- **Backend:** None required beyond the existing Go service and Firestore security rules — this is a client-only admin panel for v1. A thin API layer can be introduced later if server-side validation, multi-admin roles, or rate limiting become necessary.
- **Hosting:** Vercel (simplest for a Next.js app of this size) or Cloud Run if co-locating with other GCP-hosted services is preferred.
- **Storage:** Existing Firebase Storage bucket (`chat-support-102fc.appspot.com`) for rendering media — no changes needed, read-only access from the web app.

### High-level flow

The Go backend continues writing messages and contacts to Firestore exactly as it does today. The new admin app reads and writes the same Firestore instance — toggles, prompts, and settings changes take effect immediately because the Go backend reads live from Firestore on each incoming message, not from a cached or compiled config.

## 10. Screens (v1)

1. **Contacts list** — primary/default screen. Table of contacts with bot toggle inline.
2. **Contact detail** — chat thread + side panel (bot toggle, prompt selector, contact info).
3. **Settings** — global bot toggle, default policy for new contacts, prompt library CRUD.

## 11. Success metrics

Since this is an internal single-admin tool, success is primarily qualitative and operational rather than growth-metric driven:

- Time to pause the bot for a single contact: from "requires a Go redeploy or manual DB edit" to under 10 seconds in-app.
- Time to change a prompt: from "code change + deploy" to immediate, in-app.
- Zero incidents of the bot replying when it shouldn't have, caused by lack of per-contact control (this is the core motivating failure mode).
- Admin actually uses the tool day-to-day instead of falling back to the Firestore console (usage itself is the signal, given the single-user context).

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Firestore security rules misconfigured, exposing chat data or write access | Auth-gate all reads/writes; scope security rules to authenticated admin UID(s) only |
| Prompt edited to something broken/empty and bot goes live with it | Phase 2 test sandbox before relying on it for production changes; keep `is_default` prompt seeded with a known-good fallback |
| Real-time listeners on large chat collections get expensive/slow as data grows | Paginate message loads (last 20–50, as already scoped); avoid `onSnapshot` on full historical threads |
| Backend and frontend drift on field semantics (e.g. what null `bot_active` means) | This PRD is the single source of truth for the resolution logic in Section 8; keep it updated if it changes |
| Single point of failure — only one admin, one login | Acceptable for v1 given target user; multi-admin is explicitly Phase 3 |

## 13. Open questions

- Should `custom_prompts/{userPhone}` be migrated to reference `prompts/{promptId}`, or left storing raw text? (Doesn't block v1 — can decide during implementation.)
- Does the global `is_bot_active` toggle need a "reason/note" field for audit purposes, or is that covered later by the Phase 3 audit log?
- Any need for role-based read-only access sooner than Phase 3 (e.g. a support staff member who can view but not toggle)?

## 14. Appendix

- Feature list and full user stories: see companion document `wa-bot-admin-user-stories.md`.
- Existing Firestore schema reference: see project `README.md`.
