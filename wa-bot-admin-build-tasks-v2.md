# Build tasks, round 2: multi-account support + quiet hours

Continues from `wa-bot-admin-build-tasks.md` (all 11 MVP tasks complete). Same format —
hand each prompt to the AI coding agent in order.

Reference docs:
- `wa-bot-admin-prd.md`
- `wa-bot-admin-user-stories.md`
- `wa-bot-admin-design-guide.md`
- `wa-bot-admin-build-tasks.md` (for context on what already exists — don't re-scaffold)

---

## Task 12 — Multi-account routing restructure

```
Read wa-bot-admin-build-tasks.md to understand the current app structure, and note that
the app currently reads a single account ID from the NEXT_PUBLIC_WA_ID environment
variable.

Restructure the app to support multiple WhatsApp accounts (waIds) via the URL, instead of
a single build-time environment variable:

1. Move every existing authenticated route under a dynamic [waId] segment, e.g.
   app/[waId]/contacts, app/[waId]/contacts/[userPhone], app/[waId]/dashboard,
   app/[waId]/settings, app/[waId]/settings/prompts.
2. Find every place in the codebase currently reading process.env.NEXT_PUBLIC_WA_ID
   for Firestore queries or writes, and replace it with the waId route param instead.
3. Remove NEXT_PUBLIC_WA_ID from env usage entirely once nothing references it — leave
   it out of .env.local.example too, since the account is now chosen at runtime, not
   build time.
4. Do not build the account switcher UI or the redirect-on-root logic yet — that's the
   next task. This task is the routing/data-layer change only. It's fine if visiting
   the app root currently 404s or shows nothing after this task; that gets fixed next.
5. Verify every existing screen (contacts list, contact detail, dashboard, settings,
   prompts) still works correctly when visited with an explicit waId in the URL.
```

---

## Task 13 — Account switcher and last-used redirect

```
Read wa-bot-admin-design-guide.md sections 4 (layout & navigation) before building this,
so the switcher matches the existing sidebar/header style rather than introducing a new
visual pattern.

1. Build an account switcher component, placed once in the shared authenticated layout
   (visible on every screen, near the top — same idea as Firebase Console's project
   picker). It should:
   - List available accounts by reading the root-level documents under the wa_bot
     collection (each document ID is a waId).
   - Display a friendly label per account: use wa_bot/{waId}.display_name if present,
     otherwise fall back to showing the raw waId.
   - On selection, navigate to the same screen the admin is currently on, under the
     newly selected waId (e.g. switching from /628.../dashboard to /629.../dashboard,
     not back to a home screen).
2. Handle the app root route (/):
   - If a waId was previously selected, read it from a cookie and redirect straight to
     /{waId}/contacts.
   - If no cookie is set (first visit), query the wa_bot collection, take the first
     account found, set the cookie, and redirect to /{waId}/contacts.
   - Every time an account is selected via the switcher, update the same cookie so the
     next visit remembers it.
3. Do not build a dedicated "choose an account" screen — per the above, root should
   always resolve directly into an account rather than showing a picker page.
```

---

## Task 14 — Firestore security rules: generalize for multi-account

```
Read wa-bot-admin-prd.md section 8 and the firestore.rules file created in the original
Task 1.

The current security rules were written assuming a single waId. Now that the app
supports multiple accounts via the URL, review and fix the rules so that:

1. Any authenticated admin (per the existing allowlist/UID check from Task 1) can read
   and write under wa_bot/{waId}/** for ANY waId, not just one hardcoded value — access
   control should be based on "is this an authenticated admin," not on which account
   they're looking at, since all admins currently manage all accounts.
2. If the current rules reference a specific waId anywhere, generalize that with a
   wildcard match instead.
3. Re-verify: an authenticated admin can access every account's data, and an
   unauthenticated request is denied everywhere, same as before.
4. Test against at least two different waId values to confirm the fix actually works
   for accounts beyond the original one — don't just confirm it still works for the
   original account.
Flag clearly in your output whether the original rules had this single-account
assumption baked in, and what exactly you changed, so it's easy to review.
```

---

## Task 15 — Quiet hours: scheduled bot state

```
Read wa-bot-admin-prd.md sections 7 and 8, and wa-bot-admin-design-guide.md section 5
(component patterns) for how toggles/status should look and behave.

Add scheduled bot pausing ("quiet hours") as an account-level setting:

1. Data model: add a quiet_hours field to wa_bot/{waId}, structured as an object with
   enabled (bool), start_time and end_time (24h "HH:mm" strings), and timezone (string,
   e.g. "Asia/Jakarta" — default to the account's existing timezone assumption if one
   exists in the codebase, otherwise default to Asia/Jakarta per this project's context).
2. Settings UI: add a "Quiet hours" card on the settings screen (same account as the
   global toggle from the original Task 6) letting the admin enable/disable quiet hours
   and set the start/end time. Follow the design guide's pattern of keeping this
   visually distinct from routine per-contact controls, similar to how the global
   toggle is treated, since it also affects every contact at once.
3. Resolution logic (Go backend): before generating an AI reply, in addition to the
   existing bot_active resolution from the earlier backend task, check whether the
   current time (in the account's configured timezone) falls within quiet_hours. If
   quiet hours are enabled and the current time is within the window, treat the bot as
   inactive regardless of bot_active's value — do not modify bot_active itself, this is
   a runtime check layered on top, so toggles keep their normal meaning outside the
   quiet-hours window.
4. Admin web app visibility: on the contacts list and dashboard, if quiet hours are
   currently in effect, show a small persistent indicator (e.g. in the header) stating
   quiet hours are active and until when — so it's clear at a glance why the bot might
   look "paused" everywhere even though individual contacts show as active.
5. Add tests for the time-window logic covering: a window that doesn't cross midnight
   (e.g. 23:00-07:00 wrapping past midnight must still work correctly), quiet hours
   disabled, and quiet hours enabled but current time outside the window.
```

---

## Notes

- Tasks 12 → 13 → 14 are sequential and should not be reordered — 13 depends on the
  routes from 12, and 14 is a correctness fix that only matters once 12/13 make
  multi-account access a real code path.
- Task 15 is independent of 12-14 and can be done before, after, or in parallel — it
  doesn't touch routing or account switching.
- After Task 14, do a manual pass switching between at least two accounts in the running
  app to confirm the whole multi-account flow (switch → data changes → refresh → same
  account persists) actually works end to end, not just at the unit/rule level.
