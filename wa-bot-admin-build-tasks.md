# Build tasks: WhatsApp bot admin web app

A sequenced set of prompts for an AI coding agent (Claude Code or similar). Run them in order — each one builds on the last. Every prompt tells the AI to read the PRD and/or user stories doc first so it stays grounded in the actual spec instead of improvising scope.

Reference docs (keep in the repo or workspace so the AI can read them):
- `wa-bot-admin-prd.md`
- `wa-bot-admin-user-stories.md`

---

## Task 0 — Project setup

```
Read wa-bot-admin-prd.md, specifically sections 6 (current system context) and 9 (architecture).

Set up a new Next.js (App Router) + TypeScript project for the "WhatsApp bot admin web app"
described in the PRD. Requirements:
- Initialize the Next.js project with TypeScript, ESLint, and Tailwind CSS.
- Add the Firebase client SDK and set up a firebase.ts config module that reads project
  credentials from environment variables (do not hardcode any keys).
- Set up a .env.local.example file listing the required Firebase env vars.
- Create a basic folder structure: app/ (routes), components/, lib/ (firebase, types, utils),
  types/ (TypeScript interfaces matching the Firestore schema in PRD section 8 and the
  original README.md schema).
- Do not build any UI yet — this task is scaffolding only.
- Confirm the project builds and runs locally before finishing.
```

---

## Task 1 — Firestore types and security rules

```
Read wa-bot-admin-prd.md section 8 (data model changes) and the original README.md
Firestore schema.

1. Write TypeScript interfaces/types for every collection and document described in both
   documents, including the new fields (default_bot_active_for_new_contacts, bot_active,
   custom_prompt_id, and the new prompts/{promptId} collection). Put these in types/firestore.ts.
2. Write Firestore security rules that:
   - Require authentication for all reads and writes under wa_bot/{waId}.
   - Restrict write access to a specific admin UID or a list of allowed admin UIDs
     (read this from a config, don't hardcode a single UID).
   - Deny all access to anyone not authenticated.
3. Output the rules as a firestore.rules file and explain how to deploy them.
Do not build UI in this task.
```

---

## Task 2 — Auth gate

```
Read wa-bot-admin-prd.md section 7 (Phase 1 scope) and user story US-7.1 in
wa-bot-admin-user-stories.md.

Implement Firebase Authentication (email/password) for the app:
- A login page at /login.
- Middleware or a client-side auth guard that redirects unauthenticated users to /login
  from any other route.
- A logout action available once logged in (simple button in a shared layout/header is fine).
- Persist auth state across page reloads using Firebase's built-in persistence.
Do not build the contacts list or any other feature yet — auth only.
```

---

## Task 3 — Contacts list (core MVP screen)

```
Read wa-bot-admin-prd.md sections 7 and 10, and user stories US-3.1 and US-1.1 in
wa-bot-admin-user-stories.md.

Build the contacts list screen as the app's default authenticated route:
- Query wa_bot/{waId}/chat and list all contacts: name (join with the contact/{sender}
  subcollection if available, fall back to phone number), lastChatMessage, lastChatTime
  (formatted human-readable), and unreadCount.
- Use a real-time Firestore listener (onSnapshot) so the list updates live.
- Sort by lastChatTime descending by default.
- Add an inline toggle switch per row bound to chat/{userPhone}.bot_active. Toggling
  writes directly to Firestore. If bot_active is null/undefined, visually indicate it's
  "using default policy" rather than showing a plain off state.
- Clicking a contact row navigates to a contact detail route (stub the route for now,
  build it in the next task).
Keep the UI clean and functional — this is an internal admin tool, not a polished product,
but it should be usable and not ugly. Use Tailwind.
```

---

## Task 4 — Contact detail: chat viewer + per-contact controls

```
Read wa-bot-admin-prd.md sections 7, 8, and 10, and user stories US-3.2, US-1.1, and
US-2.3 in wa-bot-admin-user-stories.md.

Build the contact detail screen (route: /contacts/[userPhone]):
- Load and display the last 20-50 messages from
  wa_bot/{waId}/chat/{userPhone}/messages, ordered oldest to newest, scrolled to the
  bottom by default.
- Visually distinguish userType "customer" vs "admin" messages (e.g. alignment or color).
- Render message text; for now, show a simple placeholder/link for imgUrl, fileUrl,
  and thumb fields rather than full inline media (that's a later task).
- Add a side panel with:
  - The per-contact bot_active toggle (same behavior as the list, kept in sync).
  - A prompt selector dropdown, populated from wa_bot/{waId}/prompts, that sets
    chat/{userPhone}.custom_prompt_id when changed. Show which prompt is currently
    the default with a visual marker in the dropdown.
  - Basic contact info (name, phone, photo if available) from the contact subcollection.
This screen depends on the prompts collection existing — if Task 5 hasn't run yet,
build against the types from Task 1 and it will work once prompts exist.
```

---

## Task 5 — Prompt library

```
Read wa-bot-admin-prd.md sections 7, 8, and 10, and user stories US-2.1 and US-2.2 in
wa-bot-admin-user-stories.md.

Build a prompt library screen (route: /settings/prompts):
- List all documents in wa_bot/{waId}/prompts: name, whether it's the default, last
  modified time.
- Create new prompt: form with name + content (multi-line textarea), writes a new doc
  with timeCreated/timeModified set.
- Edit existing prompt: same form, pre-filled, updates timeModified on save.
- Delete a prompt, with a confirmation step. Prevent deleting the prompt currently
  marked is_default without first requiring another prompt be set as default.
- "Set as default" action: sets is_default: true on the chosen prompt and false on
  whichever prompt previously had it (must be atomic — use a Firestore transaction
  or batch write so there is never zero or multiple default prompts at once).
- Seed one prompt document as part of this task using the existing hardcoded Nindia
  persona prompt text as a placeholder default (ask me for the actual text if you don't
  have it, don't invent content).
```

---

## Task 6 — Global settings screen

```
Read wa-bot-admin-prd.md sections 7, 8, and 10, and user stories US-1.2 and US-1.3 in
wa-bot-admin-user-stories.md.

Build a settings screen (route: /settings) covering:
- Global bot on/off toggle bound to wa_bot/{waId}.is_bot_active, with a visible warning
  that this affects every contact on the account (make it visually distinct from
  per-contact toggles, e.g. a different color/section, to avoid mistaken clicks).
- Default policy toggle for new contacts, bound to
  wa_bot/{waId}.default_bot_active_for_new_contacts.
- Link to the prompt library from Task 5.
This is a small screen — keep it simple, don't over-build.
```

---

## Task 7 — Go backend resolution logic update

```
Read wa-bot-admin-prd.md section 8, specifically the "Required backend (Go) change"
subsection.

In the existing Go WhatsApp bot backend, update the logic that runs before generating
an AI reply so that:
1. Bot-active resolution becomes: use chat/{userPhone}.bot_active if it is explicitly
   set (true or false); otherwise fall back to wa_bot/{waId}.default_bot_active_for_new_contacts.
   If neither is set, default to false (safer default — don't auto-reply to unconfigured
   accounts).
2. Prompt resolution becomes: use the per-user prompt from custom_prompts/{userPhone} if
   present; otherwise look up wa_bot/{waId}/prompts for the document where is_default is
   true and use its content field; if no default prompt exists, fail safe (log an error
   and skip auto-reply rather than using an empty prompt).
3. Add logging at both resolution points so it's clear in logs which bot-active source
   and which prompt were used for a given reply — this will help debug behavior once the
   admin web app is live.
Do not change how messages are synced to Firestore or how outgoing replies are queued —
only the resolution logic feeding into reply generation changes.
Write or update tests covering: explicit true, explicit false, and unset bot_active;
custom prompt present vs. falling back to default vs. no default existing.
```

---

## Task 8 — Phase 2: search, manual reply, media, mark as read

```
Read wa-bot-admin-prd.md section 7 (Phase 2 scope) and user stories US-3.3, US-3.4,
US-3.5, and US-3.7 in wa-bot-admin-user-stories.md.

Extend the app with these Phase 2 features:
1. Search/filter on the contacts list by name, phone, or lastChatMessage text
   (client-side filtering is fine at this data scale).
2. Manual reply: a message input on the contact detail screen that writes a new
   document to wa_bot/recent-chat/all with the fields described in the README.md
   schema (from, to, message, timestamp). Do not write directly to the messages
   subcollection — the existing Go backend owns that write path once it sends the
   message.
3. Inline media rendering: display images from imgUrl directly, video from fileUrl
   with a native video player, and thumbnails from thumb where present, replacing
   the placeholder links from Task 4.
4. Mark as read: a button/action on contact detail that resets chat/{userPhone}.unreadCount
   to 0.
```

---

## Task 9 — Phase 2: prompt versioning and test sandbox

```
Read wa-bot-admin-prd.md section 7 (Phase 2 scope) and user stories US-2.4 and US-2.5
in wa-bot-admin-user-stories.md.

1. Prompt version history: when a prompt in wa_bot/{waId}/prompts is edited, store the
   previous version in a prompt_versions subcollection before overwriting, with a
   timestamp. Add a "history" view on the prompt edit screen listing past versions with
   a "revert to this version" action.
2. Prompt test sandbox: a screen or panel where the admin can select a prompt, type a
   test user message, and see what the AI would respond — without sending anything to
   WhatsApp or writing to Firestore. This requires calling whatever AI service the Go
   backend uses (check the backend code for which provider/model/endpoint is used and
   replicate the call, or expose a small internal API endpoint from the Go backend that
   the web app can call for this purpose — prefer the endpoint approach so prompt logic
   stays in one place).
```

---

## Task 10 — Phase 2: bulk actions and dashboard

```
Read wa-bot-admin-prd.md section 7 (Phase 2 scope) and user stories US-1.4, US-4.2,
and US-6.1 in wa-bot-admin-user-stories.md.

1. Bulk bot-disable: on the contacts list, add multi-select (checkboxes) and a bulk
   action to set bot_active: false for all selected contacts, with a confirmation step
   showing the count of contacts affected.
2. Bot-status filter: add a filter control on the contacts list to show only
   active-bot, only paused-bot, or all contacts.
3. Dashboard: a new screen (route: /dashboard) showing messages sent today (count
   documents in relevant message subcollections by timeMillis), count of contacts with
   bot active vs. paused, and a simple "most active contacts" list ranked by message
   count or recency. Keep queries efficient — do not do full collection scans across
   all contacts' message subcollections if it can be avoided; consider maintaining
   aggregate counters if this becomes slow, but don't over-engineer for v1 — a basic
   client-side aggregation is fine to start.
```

---

## Task 11 — Testing and deploy

```
Read wa-bot-admin-prd.md sections 11 (success metrics) and 12 (risks).

1. Add basic test coverage for the core write paths built in Tasks 3-6 (bot toggles,
   prompt CRUD, default-prompt uniqueness) — these are the highest-risk actions since
   they directly change live bot behavior.
2. Review the Firestore security rules from Task 1 against everything built since, and
   confirm no route or action bypasses auth.
3. Set up deployment (Vercel, per PRD section 9) with environment variables configured
   for the Firebase project, and document the deploy steps in a DEPLOYMENT.md file.
4. Do a final pass against wa-bot-admin-user-stories.md and mark which stories are
   done vs. outstanding, so we have a clear picture of what shipped in this round.
```

---

## Notes on using these prompts

- Run tasks 0-7 in order — they build the MVP (PRD Phase 1) plus the one required
  backend change, and each depends on state from the previous task.
- Tasks 8-10 (Phase 2) can be done in any order relative to each other once 0-7 are
  complete, but each should still be its own prompt/session so the AI stays scoped.
- Task 11 should run last, after whichever set of Phase 1/2 tasks you've completed.
- If the AI's output for any task drifts from the PRD (adds unscoped features, skips
  a requirement), point it back at the specific PRD section or user story ID rather
  than re-explaining from scratch — that's what the doc references in each prompt
  are for.
