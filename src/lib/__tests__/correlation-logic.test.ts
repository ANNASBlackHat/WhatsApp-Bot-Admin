import { correlateMessages, MessageItem } from "../utils";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log("Running Message Correlation Unit Tests...");

const now = 1000000;

// Test 1: Optimistic message replaced by real confirmed message from backend
const messages1: MessageItem[] = [
  {
    id: "opt_1",
    message: "Hello world!",
    userType: "admin",
    timeMillis: now - 5000,
    status: "pending",
  },
  {
    id: "real_1",
    message: "Hello world!",
    userType: "admin",
    timeMillis: now - 3000,
    status: "sent",
    messageId: "WA_MSG_123",
  },
];

const result1 = correlateMessages(messages1, now, 60000);
assert(
  result1.pendingDocIdsToDelete.length === 1 && result1.pendingDocIdsToDelete[0] === "opt_1",
  "Test 1: pendingDocIdsToDelete should contain opt_1"
);
assert(
  result1.displayMessages.length === 1 && result1.displayMessages[0].id === "real_1",
  "Test 1: displayMessages should only contain confirmed real_1"
);

// Test 2: Recent pending message awaiting confirmation (age <= 60s)
const messages2: MessageItem[] = [
  {
    id: "opt_2",
    message: "Pending message",
    userType: "admin",
    timeMillis: now - 10000,
    status: "pending",
  },
];

const result2 = correlateMessages(messages2, now, 60000);
assert(result2.pendingDocIdsToDelete.length === 0, "Test 2: pendingDocIdsToDelete should be empty");
assert(
  result2.displayMessages.length === 1 && result2.displayMessages[0].status === "pending",
  "Test 2: pending message should remain pending while under 60s"
);

// Test 3: Unmatched pending message older than 60s (fallback to 'unconfirmed')
const messages3: MessageItem[] = [
  {
    id: "opt_3",
    message: "Old stuck pending message",
    userType: "admin",
    timeMillis: now - 70000, // 70s old
    status: "pending",
  },
];

const result3 = correlateMessages(messages3, now, 60000);
assert(result3.pendingDocIdsToDelete.length === 0, "Test 3: pendingDocIdsToDelete should be empty");
assert(
  result3.displayMessages.length === 1 && result3.displayMessages[0].status === "unconfirmed",
  "Test 3: old pending message should fall back to 'unconfirmed'"
);

console.log("✓ All message correlation unit tests passed successfully!");
