import assert from "node:assert";
import {
  BUILTIN_FOLDER_KEYS,
  FOLDER_DEFAULTS,
  effectiveFolders,
  matchesTab,
  resolveDisplayName,
  type TabKey,
} from "@/lib/chat-helpers";
import type { Contact, WaAccount } from "@/types/firestore";

// -- matchesTab: status tabs ------------------------------------------------

assert.strictEqual(
  matchesTab({ bot_active: null }, "active", true),
  true,
  "null bot_active + default-on must count as active"
);
assert.strictEqual(
  matchesTab({ bot_active: undefined }, "paused", true),
  false,
  "unset bot_active + default-on must not count as paused"
);

// Unset override → default policy false → paused tab matches
assert.strictEqual(
  matchesTab({}, "paused", false),
  true,
  "unset bot_active + default-off must count as paused"
);

// Explicit override wins over default policy
assert.strictEqual(
  matchesTab({ bot_active: false }, "active", true),
  false,
  "explicit false must not count as active even with default-on"
);
assert.strictEqual(
  matchesTab({ bot_active: true }, "paused", false),
  false,
  "explicit true must not count as paused even with default-off"
);

// Status tabs are folder-independent
assert.strictEqual(
  matchesTab({ bot_active: true, folder: "work" }, "active", false),
  true,
  "active tab ignores folder assignment"
);
assert.strictEqual(
  matchesTab({ bot_active: false, folder: "hidden" }, "paused", true),
  true,
  "paused tab ignores folder assignment"
);

// -- matchesTab: default tab -------------------------------------------------

assert.strictEqual(
  matchesTab({}, "default", true),
  true,
  "no folder must appear in the default view"
);
assert.strictEqual(
  matchesTab({ folder: null }, "default", true),
  true,
  "null folder must appear in the default view"
);
assert.strictEqual(
  matchesTab({ folder: "work" }, "default", true),
  true,
  "work-foldered chats still show in default view (folder tabs are extra)"
);
assert.strictEqual(
  matchesTab({ folder: "hidden" }, "default", true),
  false,
  "hidden chats must be excluded from the default view"
);

// -- matchesTab: folder tabs -------------------------------------------------

for (const key of BUILTIN_FOLDER_KEYS) {
  assert.strictEqual(
    matchesTab({ folder: key as string }, key as TabKey, false),
    true,
    `chats in folder '${key}' must match their own tab`
  );
  assert.strictEqual(
    matchesTab({}, key as TabKey, false),
    false,
    "chats without a folder must not match a folder tab"
  );
  assert.strictEqual(
    matchesTab({ folder: "hidden" }, key as TabKey, false),
    key === "hidden",
    "hidden chat must only match the hidden tab"
  );
}

// Custom folder keys (from WaAccount.folders)
assert.strictEqual(matchesTab({ folder: "vip" }, "vip" as TabKey, false), true);
assert.strictEqual(matchesTab({ folder: "vip" }, "work" as TabKey, false), false);
assert.strictEqual(
  matchesTab({ folder: "work" }, "hidden" as TabKey, false),
  false,
);

// -- resolveDisplayName ------------------------------------------------------

// Minimal shapes are fine — the helper only reads `name`/`display_name`.
const contactLike = (c: Partial<Contact>): Contact =>
  ({ name: "", phone: "", photo: "", timeCreated: 0, timeModified: 0, ...c } as Contact);

assert.strictEqual(
  resolveDisplayName(contactLike({ name: "Jane Doe" }), "62811"),
  "Jane Doe",
  "synced name wins when no display_name"
);
assert.strictEqual(
  resolveDisplayName(
    contactLike({ name: "Jane Doe", display_name: "Jane (Marketing)" }),
    "62811"
  ),
  "Jane (Marketing)",
  "display_name wins over synced name"
);
assert.strictEqual(
  resolveDisplayName(contactLike({ name: "", display_name: "   " }), "62811"),
  "62811",
  "blank display_name falls back to synced name, then phone"
);
assert.strictEqual(resolveDisplayName(null, "62811"), "62811", "no contact → phone");

// -- effectiveFolders ---------------------------------------------------------

const accountLike = (a: Partial<WaAccount>): WaAccount =>
  ({ is_bot_active: true, ...a } as WaAccount);

assert.deepStrictEqual(
  effectiveFolders(null),
  FOLDER_DEFAULTS,
  "no account config → built-in folders with default labels"
);

assert.deepStrictEqual(
  effectiveFolders(accountLike({ folders: [{ key: "work", name: "Work Stuff" }] })),
  [
    { key: "work", name: "Work Stuff" },
    { key: "hidden", name: "Hidden" },
  ],
  "admin label overrides built-in; other built-in keeps default"
);

assert.deepStrictEqual(
  effectiveFolders(
    accountLike({
      folders: [
        { key: "clients", name: "Clients" },
        { key: "work", name: "W" },
      ],
    })
  ),
  [
    { key: "work", name: "W" },
    { key: "hidden", name: "Hidden" },
    { key: "clients", name: "Clients" },
  ],
  "built-ins first, customs appended, built-in labels customizable"
);

console.log("✓ All chat-helpers unit tests passed successfully!");
