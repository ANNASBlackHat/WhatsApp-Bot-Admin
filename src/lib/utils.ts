/**
 * General-purpose utility functions.
 */

/**
 * Format a Unix-millisecond timestamp to a locale-aware date/time string.
 */
export function formatTimestamp(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString();
}

/**
 * Format a Unix-millisecond timestamp for chat list (e.g. "2m ago", "14:30", "Yesterday", "Jul 25").
 */
export function formatChatTime(ms: number): string {
  if (!ms) return "";
  const date = new Date(ms);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 60) return "Just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return "Yesterday";
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Truncate a string to `maxLength` characters, appending "…" if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

