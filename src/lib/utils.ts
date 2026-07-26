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

/**
 * Get cookie value by name.
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const val = parts.pop()?.split(";").shift();
    return val ? decodeURIComponent(val) : null;
  }
  return null;
}

/**
 * Set cookie value by name with expiration days.
 */
export function setCookie(name: string, value: string, days = 30): void {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Evaluates whether quiet hours are currently in effect.
 */
export function checkQuietHoursActive(
  config?: { enabled?: boolean; start_time?: string; end_time?: string; timezone?: string },
  now = new Date()
): { active: boolean; untilTime?: string } {
  if (!config || !config.enabled || !config.start_time || !config.end_time) {
    return { active: false };
  }

  const tz = config.timezone || "Asia/Jakarta";

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

    const parts = formatter.formatToParts(now);
    const hourStr = parts.find((p) => p.type === "hour")?.value || "00";
    const minuteStr = parts.find((p) => p.type === "minute")?.value || "00";

    const currentMinutes = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);

    const [startH, startM] = config.start_time.split(":").map((v) => parseInt(v, 10) || 0);
    const [endH, endM] = config.end_time.split(":").map((v) => parseInt(v, 10) || 0);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    let isWithin = false;

    if (startMinutes < endMinutes) {
      isWithin = currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else if (startMinutes > endMinutes) {
      isWithin = currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      isWithin = true;
    }

    if (isWithin) {
      return { active: true, untilTime: config.end_time };
    }
  } catch (err) {
    console.error("Failed to parse quiet hours timezone/format:", err);
  }

  return { active: false };
}



