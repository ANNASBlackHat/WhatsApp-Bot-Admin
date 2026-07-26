# Design guide: WhatsApp bot admin web app

**Companion to:** `wa-bot-admin-prd.md`, `wa-bot-admin-user-stories.md`
**Direction:** Light, calm, fast to scan. This is a tool you open ten times a day to make a quick decision — pause a bot, swap a prompt — not a product to admire. Every choice below optimizes for "I opened this to do one thing, and I did it in five seconds."

---

## 1. Design principle (the signature)

**The signature: bot state is a color, not a word.** Across every screen — list, detail, dashboard — whether a bot is active or paused is conveyed by a consistent color + icon pairing, never just a gray toggle you have to double-check. A glance down the contacts list should tell you, without reading anything, which conversations currently have a human vs. an AI on them. Everything else in the UI stays quiet so this signal isn't competing for attention.

This matters functionally: the whole reason this app exists is to prevent the bot replying somewhere it shouldn't. The design's one job is to make that state impossible to misread.

---

## 2. Color tokens

Soft, warm neutral base — not stark white, not cold gray. Two semantic accents carry all meaning; nothing else uses saturated color.

| Token | Hex | Use |
|---|---|---|
| `bg-canvas` | `#FAFAF8` | Page background |
| `bg-surface` | `#FFFFFF` | Cards, panels, table rows |
| `bg-surface-hover` | `#F3F2ED` | Row/card hover state |
| `border` | `#E7E5DD` | Hairline dividers, card borders |
| `text-primary` | `#1C1C1A` | Headings, primary content |
| `text-secondary` | `#6B6A62` | Timestamps, metadata, captions |
| `text-muted` | `#A6A499` | Placeholder text, disabled state |
| `accent-active` | `#2F7A5C` | Bot active — dot, toggle-on, badges |
| `accent-active-bg` | `#E7F1EB` | Light fill behind "active" badges |
| `accent-paused` | `#B9722F` | Bot paused — dot, toggle-off, badges |
| `accent-paused-bg` | `#F5EBDF` | Light fill behind "paused" badges |
| `accent-danger` | `#B23B31` | Global kill switch only — reserved, not reused elsewhere |
| `accent-danger-bg` | `#F5E4E1` | Light fill behind danger confirmation UI |

**Rule:** `accent-danger` appears in exactly one place — the global bot toggle and its confirmation dialog. If it starts showing up elsewhere (delete buttons, error toasts), pick a separate neutral treatment for those instead of diluting what "danger red" means in this app. Reserve the color so it keeps its weight.

**Rule:** never rely on color alone for active/paused. Every colored state is paired with a label ("Active" / "Paused") or icon, both for accessibility and because color-only status is exactly the ambiguity this app exists to remove.

---

## 3. Typography

One typeface, used well, beats two typefaces used cautiously in a dense data tool like this.

- **Typeface:** Inter (or system-ui fallback stack) for everything — headings, body, UI labels, data. It's built for UI density and reads clean at small sizes, which matters more here than display personality.
- **Scale:**

| Role | Size | Weight | Use |
|---|---|---|---|
| Page title | 20px | 500 | "Contacts", "Settings" |
| Section header | 15px | 500 | Card/panel headers |
| Body / list primary | 14px | 400 | Contact names, message text |
| Body / list secondary | 13px | 400 | Timestamps, phone numbers, previews |
| Caption / label | 12px | 500 | Form labels, badge text, table headers |
| Data / mono | 13px | 400, monospace | Phone numbers, IDs, timestamps in detail views |

- **No italics.** No decorative weights. Sentence case everywhere, including buttons and headers — matches the plain, direct tone this tool needs ("Save prompt", not "Save Prompt" or "SAVE").
- Line height 1.5 for body text, 1.3 for single-line UI elements (buttons, badges, table cells).

---

## 4. Layout & navigation

**Structure:** persistent left sidebar (icon + label) + main content area. Four destinations only, matching the PRD's screens — resist adding a fifth without a real reason:

```
┌──────────┬─────────────────────────────────┐
│          │                                  │
│ Contacts │                                  │
│ Dashboard│         Main content              │
│ Prompts  │                                  │
│ Settings │                                  │
│          │                                  │
│  [you]   │                                  │
└──────────┴─────────────────────────────────┘
```

- Sidebar is collapsible to icons-only on narrower viewports, never fully hidden behind a hamburger on desktop — this is a tool people alt-tab into, it should orient in under a second.
- Active nav item: left border accent (2px, `text-primary`) + `bg-surface-hover` fill. No pill shapes, no icon color changes — keep it quiet.

**Contacts screen: two-pane, not list-then-navigate.** This is the one deliberate borrowing from WhatsApp Web's own layout, and it's a UX choice, not a style one: contact list on the left (~320px fixed), selected contact's thread + controls on the right. Users already have this exact mental model from WhatsApp itself, so switching between contacts is one click with no page transition, no back button, no lost place in the list.

```
┌──────────────┬───────────────────────────────┐
│ [search]      │  Contact name         [●Active]│
│──────────────│─────────────────────────────────│
│ ● John   2m  │                                  │
│ ● Alice  1h  │      (chat thread)               │
│ ○ Marco  3h  │                                  │
│ ● Sarah  1d  │                                  │
│              │─────────────────────────────────│
│              │  [prompt: Default ▾] [Active ⏻] │
└──────────────┴───────────────────────────────┘
```

- List row height: 64px, enough for name + preview + status dot without feeling cramped, tight enough that 15+ contacts fit without scrolling on a normal screen.
- Selected row gets `bg-surface-hover` and stays visually marked while its thread is open, so switching back after checking another contact doesn't lose your place.

**Dashboard, Prompts, Settings:** single-column card layout, `bg-surface` cards with `border`, generous padding (24px), max content width ~880px so text/data doesn't stretch uncomfortably wide on large monitors.

---

## 5. Component patterns

### Status dot + badge
The core recurring element. Small filled circle (8px) in `accent-active` or `accent-paused`, always next to a text label. Used in the contacts list, contact detail header, and dashboard counts. Never shown without its label on first render — icon-only is fine once a user has learned the pattern, but don't make them learn it from a cold start.

### Toggle switch
Standard sliding toggle, but the track color itself uses `accent-active`/`accent-paused` (not a generic gray-to-blue default) so the toggle's color always matches the dot/badge language elsewhere. Label text sits to the left, stating the current state plainly: "Bot active" / "Bot paused" — not just an unlabeled switch.

### Global toggle (distinct treatment)
The account-wide kill switch on Settings gets a visually separate card with an `accent-danger-bg` background tint and a border — deliberately heavier than every other control on the page, because it's the one action that affects everyone at once. Toggling it off triggers a confirmation dialog: "Pause the bot for all contacts?" with a short line stating how many contacts are currently active. This is the only confirmation dialog in the per-contact flows; per-contact toggles are reversible in one click and shouldn't be gated behind a modal, or the tool becomes annoying to use for its main job.

### Prompt dropdown
Selected value shows the prompt name, with the currently-default prompt marked with a small "Default" tag in the list so it's clear what an unset contact would fall back to. Changing it takes effect immediately on selection — no separate save step, consistent with every other control in this app being a direct-action toggle rather than a form to submit.

### Tables (dashboard, bulk actions)
Hairline row dividers (`border`), no zebra striping (adds visual noise at this density), row hover state `bg-surface-hover`. Checkboxes for bulk-select appear on hover/focus and once any row is selected, not visible by default — keeps the default view uncluttered for the common case of managing one contact at a time.

### Empty states
Plain, direct, one action offered. Examples in this app's voice:
- No contacts yet: "No conversations yet. They'll show up here once someone messages your WhatsApp number."
- No prompts created: "No prompts yet. Create one to control what the bot says." + a "New prompt" button in the empty state itself.

### Errors
Stated plainly, no apology, always with the next step. "Couldn't save this prompt — check your connection and try again." Never a raw error code or stack trace in the main UI; log the detail, show the plain-language version.

---

## 6. Motion

The brief for this app is "lighter, not louder." Motion here should feel like the interface is responsive, not like it's performing. Every animation below has a functional reason — if you're ever adding one that's purely decorative, cut it.

| Interaction | Animation | Duration | Notes |
|---|---|---|---|
| Toggle flip (bot active/paused) | Track color cross-fade + knob slide | 150ms ease-out | Immediate feedback that the click registered |
| Contact list row appears (new message) | Fade + 4px slide up | 120ms ease-out | Subtle enough not to be distracting on a live list |
| Selecting a contact (pane switch) | Cross-fade of thread content only | 100ms | No slide/push transition — panel position doesn't move, only content |
| Dropdown/menu open | Fade + 4px scale from anchor | 100ms ease-out | Standard, don't reinvent |
| Confirmation modal (global toggle) | Backdrop fade 150ms, modal fade + 8px scale 150ms | Slightly slower than micro-interactions since this is a "stop and read" moment | |
| Toast notification (e.g. "Prompt saved") | Slide in from top-right, auto-dismiss fade after 3s | 150ms in, 200ms out | Confirms silent actions like the prompt dropdown's immediate-save behavior |
| Loading states | Skeleton placeholders (shimmer, subtle) instead of spinners | — | Spinners read as "waiting," skeletons read as "almost there" — matches the lighter feel |

**Hard rule:** respect `prefers-reduced-motion` — all of the above collapse to instant state changes with no transition when it's set. **Hard rule:** nothing animates on every render — only on state change triggered by a real user action or a genuinely new event (new message arriving). A list that re-animates every time Firestore's listener fires, even with no visible change, will feel jittery instead of light.

---

## 7. Accessibility & quality floor

- Every interactive element has a visible keyboard focus ring (`2px solid text-primary`, offset 2px) — this is an internal tool likely to be used with a keyboard as much as a mouse.
- Color contrast: `text-primary` on `bg-canvas`/`bg-surface` and both accent colors on their light-bg pairs all meet WCAG AA at their respective text sizes.
- Toggles and status dots always have an accessible label ("Bot active for John Doe"), not just a visual color — screen reader users get the same information sighted users get from the color signature.
- Responsive down to a single-column, list-then-detail-navigation layout below ~768px (the two-pane contacts view collapses to full-width list, tapping a contact pushes to a full-width detail view with a back button — this is the one place a page-level transition is appropriate, since panes no longer fit side by side).

---

## 8. What to avoid

- No gradients, no drop shadows beyond a barely-there 1px card shadow if needed for separation on white-on-white layouts — flat surfaces, distinguished by `border` and background shade, not depth effects.
- No onboarding tours, confetti, or celebratory animations on routine actions (saving a prompt is not an achievement).
- No dashboard chart-junk — the dashboard in Phase 2 should favor plain numbers and short lists over decorative gauges or 3D-styled charts. A number in large type with a label beneath it says "12 active bots" faster than a gauge does.
- Don't let the prompt library's textarea become a tiny cramped box — prompt content is the actual product configuration here, give it room (minimum 12 visible rows, resizable).

---

## 9. Quick reference for implementation

When building any screen, check it against these three questions before calling it done:
1. **Can I tell bot status at a glance, without reading?** (color + label present, consistent placement)
2. **Is the destructive/global action visually heavier than the routine per-contact ones?** (danger accent reserved, confirmation only where it matters)
3. **Does anything animate that isn't responding to a real action or event?** (if yes, cut it)
