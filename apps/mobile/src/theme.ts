/**
 * Minimal design tokens for the mobile app, mirroring the web theme
 * (`bg-canvas`, `bg-surface`, text/border/accent roles).
 *
 * v1 uses plain StyleSheet. If Tailwind-style authoring is wanted later,
 * evaluate NativeWind then — not now.
 */
export const colors = {
  canvas: "#F7F7F5",
  surface: "#FFFFFF",
  surfaceHover: "#F0EFED",
  textPrimary: "#1C1B1A",
  textSecondary: "#6B6966",
  textMuted: "#A3A09B",
  border: "#E5E3DF",
  active: "#1A7F4B",
  activeBg: "#E5F4EC",
  paused: "#B7791F",
  pausedBg: "#FaF0DC",
  danger: "#C43D2B",
  dangerBg: "#FBEAE6",
  white: "#FFFFFF",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
} as const;
