import assert from "node:assert";

/**
 * Security Rule Simulation Model for wa_bot rules testing
 */
export interface RequestContext {
  auth: { uid: string } | null;
  adminUids: string[];
}

export function isAuthenticated(ctx: RequestContext): boolean {
  return ctx.auth !== null;
}

export function isAdmin(ctx: RequestContext): boolean {
  return (
    isAuthenticated(ctx) &&
    ctx.auth !== null &&
    ctx.adminUids.includes(ctx.auth.uid)
  );
}

export function canAccessPath(
  path: string,
  action: "read" | "write",
  ctx: RequestContext
): boolean {
  const parts = path.split("/").filter(Boolean);

  // Default deny everything
  if (parts.length === 0) return false;

  // app_config/admin_users
  if (parts[0] === "app_config" && parts[1] === "admin_users") {
    if (action === "read") return isAuthenticated(ctx);
    if (action === "write") return isAdmin(ctx);
  }

  // wa_bot/{waId} and all subcollections
  if (parts[0] === "wa_bot") {
    if (parts.length >= 2) {
      // wa_bot/recent-chat/all/{autoId}
      if (parts[1] === "recent-chat" && parts[2] === "all") {
        if (action === "read") return isAuthenticated(ctx);
        if (action === "write") return isAdmin(ctx);
      }

      // wa_bot/{waId}/** - dynamic waId wildcard
      if (action === "read") return isAuthenticated(ctx);
      if (action === "write") return isAdmin(ctx);
    }
  }

  return false;
}

// =====================================================================
// Multi-Account Security Rules Verification Tests
// =====================================================================

const adminCtx: RequestContext = {
  auth: { uid: "admin-uid-123" },
  adminUids: ["admin-uid-123", "admin-uid-456"],
};

const nonAdminCtx: RequestContext = {
  auth: { uid: "regular-user-789" },
  adminUids: ["admin-uid-123", "admin-uid-456"],
};

const unauthCtx: RequestContext = {
  auth: null,
  adminUids: ["admin-uid-123"],
};

// Test 1: Account 1 (62811111111) Access Tests
{
  const path = "wa_bot/62811111111/chat/628999999";
  assert.strictEqual(
    canAccessPath(path, "read", adminCtx),
    true,
    "Admin read Account 1"
  );
  assert.strictEqual(
    canAccessPath(path, "write", adminCtx),
    true,
    "Admin write Account 1"
  );
  assert.strictEqual(
    canAccessPath(path, "write", nonAdminCtx),
    false,
    "Non-admin write Account 1 denied"
  );
  assert.strictEqual(
    canAccessPath(path, "read", unauthCtx),
    false,
    "Unauthenticated read Account 1 denied"
  );
}

// Test 2: Account 2 (62822222222) Access Tests (Generalization check)
{
  const path = "wa_bot/62822222222/prompts/prompt_abc";
  assert.strictEqual(
    canAccessPath(path, "read", adminCtx),
    true,
    "Admin read Account 2"
  );
  assert.strictEqual(
    canAccessPath(path, "write", adminCtx),
    true,
    "Admin write Account 2"
  );
  assert.strictEqual(
    canAccessPath(path, "write", nonAdminCtx),
    false,
    "Non-admin write Account 2 denied"
  );
  assert.strictEqual(
    canAccessPath(path, "read", unauthCtx),
    false,
    "Unauthenticated read Account 2 denied"
  );
}

// Test 3: Account 3 Arbitrary String waId (account_enterprise_prod)
{
  const path = "wa_bot/account_enterprise_prod/settings";
  assert.strictEqual(
    canAccessPath(path, "read", adminCtx),
    true,
    "Admin read Arbitrary waId Account 3"
  );
  assert.strictEqual(
    canAccessPath(path, "write", adminCtx),
    true,
    "Admin write Arbitrary waId Account 3"
  );
  assert.strictEqual(
    canAccessPath(path, "read", unauthCtx),
    false,
    "Unauthenticated read Account 3 denied"
  );
}

console.log(
  "✓ Multi-account security rules simulation verified across multiple waId accounts!"
);
