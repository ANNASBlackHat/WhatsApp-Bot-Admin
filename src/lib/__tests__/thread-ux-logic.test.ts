import { formatDateDivider } from "../utils";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log("Running Thread UX Logic Unit Tests...");

const now = Date.now();

// Test 1: Today date divider
const todayDivider = formatDateDivider(now);
assert(todayDivider === "Today", `Test 1: Today divider should be "Today", got "${todayDivider}"`);

// Test 2: Yesterday date divider
const yesterdayMs = now - 86400000;
const yesterdayDivider = formatDateDivider(yesterdayMs);
assert(yesterdayDivider === "Yesterday", `Test 2: Yesterday divider should be "Yesterday", got "${yesterdayDivider}"`);

// Test 3: Older date divider
const olderMs = new Date("2025-05-15T10:00:00Z").getTime();
const olderDivider = formatDateDivider(olderMs);
assert(olderDivider.includes("2025") || olderDivider.includes("May"), `Test 3: Older divider should format date string, got "${olderDivider}"`);

console.log("✓ All thread UX unit tests passed successfully!");
