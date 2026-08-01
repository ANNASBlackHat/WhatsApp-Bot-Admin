"use client";

import React, { useEffect, useState } from "react";
import { getCookie, setCookie } from "@/lib/utils";

export type ThemeMode = "light" | "dark" | "system";

export function ThemeToggle() {
  const [theme, setThemeState] = useState<ThemeMode>("system");

  useEffect(() => {
    // Resolve stored theme choice or fallback to system
    const storedTheme = (getCookie("theme") || (typeof localStorage !== "undefined" && localStorage.getItem("theme")) || "system") as ThemeMode;
    setThemeState(storedTheme);
    applyTheme(storedTheme);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      const current = (getCookie("theme") || (typeof localStorage !== "undefined" && localStorage.getItem("theme")) || "system") as ThemeMode;
      if (current === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    const root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
    } else if (mode === "light") {
      root.classList.remove("dark");
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = e.target.value as ThemeMode;
    setThemeState(newTheme);
    setCookie("theme", newTheme, 365);
    try {
      localStorage.setItem("theme", newTheme);
    } catch {
      // Ignore storage error if disabled
    }
    applyTheme(newTheme);
  };

  return (
    <div className="flex items-center gap-1.5 border-l border-border-custom pl-3">
      <span className="text-[11px] font-medium text-text-secondary">Theme:</span>
      <select
        value={theme}
        onChange={handleThemeChange}
        aria-label="Select theme mode"
        className="rounded border border-border-custom bg-canvas px-2.5 py-1 text-xs font-medium text-text-primary transition-colors focus:border-text-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-text-primary"
      >
        <option value="system">Match system</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}
