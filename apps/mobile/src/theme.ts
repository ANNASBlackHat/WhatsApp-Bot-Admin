import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const lightColors = {
  canvas: "#FAFAF8",
  surface: "#FFFFFF",
  surfaceHover: "#F3F2ED",
  textPrimary: "#1C1C1A",
  textSecondary: "#6B6A62",
  textMuted: "#A6A499",
  border: "#E7E5DD",
  active: "#2F7A5C",
  activeBg: "#E7F1EB",
  paused: "#B9722F",
  pausedBg: "#F5EBDF",
  danger: "#B23B31",
  dangerBg: "#F5E4E1",
  white: "#FFFFFF",
} as const;

export const darkColors = {
  canvas: "#141412",
  surface: "#1C1C19",
  surfaceHover: "#262622",
  textPrimary: "#F4F3EE",
  textSecondary: "#A6A499",
  textMuted: "#737168",
  border: "#33322C",
  active: "#3CA87E",
  activeBg: "#1A362B",
  paused: "#E08A38",
  pausedBg: "#3A2616",
  danger: "#E05248",
  dangerBg: "#3D1B19",
  white: "#FFFFFF",
} as const;

export interface ThemeColors {
  readonly canvas: string;
  readonly surface: string;
  readonly surfaceHover: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly border: string;
  readonly active: string;
  readonly activeBg: string;
  readonly paused: string;
  readonly pausedBg: string;
  readonly danger: string;
  readonly dangerBg: string;
  readonly white: string;
}

// Default exported colors (prefer dark mode when no provider or fallback)
export const colors: ThemeColors = darkColors;

export type ThemeMode = "dark" | "light" | "system";

const THEME_STORAGE_KEY = "@wa_admin_theme_mode";

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  isDark: true,
  colors: darkColors,
  setMode: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("dark"); // default to dark mode

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark" || stored === "system") {
          setModeState(stored);
        } else {
          // If no option, prefer dark mode instead
          setModeState("dark");
        }
      })
      .catch((e) => console.error("Error reading theme from storage", e));
  }, []);

  const setMode = async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
    } catch (e) {
      console.error("Error saving theme to storage", e);
    }
  };

  const isDark =
    mode === "dark" || (mode === "system" && systemScheme === "dark") || (mode === "system" && !systemScheme);
  const activeColors = isDark ? darkColors : lightColors;

  return React.createElement(
    ThemeContext.Provider,
    { value: { mode, isDark, colors: activeColors, setMode } },
    children
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

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
