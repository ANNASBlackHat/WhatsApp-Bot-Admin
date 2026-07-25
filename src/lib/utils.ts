/**
 * General-purpose utility functions.
 */

/**
 * Format a Unix-millisecond timestamp to a locale-aware date/time string.
 */
export function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}

/**
 * Truncate a string to `maxLength` characters, appending "…" if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}
