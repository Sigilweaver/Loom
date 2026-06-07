/**
 * Theme state management using Zustand
 *
 * Provides three coherent appearances for the Hub:
 * - "sigilweaver" - violet-tinted dark theme matching the Studio identity
 * - "dark"        - neutral dark theme
 * - "light"       - the classic light appearance
 *
 * The active theme is applied as a class on the document root and persisted to
 * localStorage. Colors are driven by CSS custom properties (see index.css) that
 * back the Tailwind surface/ink/line tokens, so switching the root class
 * reskins the whole app without per-element variants.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Theme = "sigilweaver" | "dark" | "light";

const THEME_CLASS: Record<Theme, string> = {
  sigilweaver: "theme-sigilweaver",
  dark: "theme-dark",
  light: "theme-light",
};

/**
 * Apply a theme to the document root by swapping the theme class.
 * Safe to call on the server (no-op when document is unavailable).
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("theme-sigilweaver", "theme-dark", "theme-light");
  root.classList.add(THEME_CLASS[theme]);
  root.dataset.theme = theme;
  // Hook for any Tailwind dark: variants that may be added later.
  root.classList.toggle("dark", theme !== "light");
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "sigilweaver",
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: "sigilweaver-loom-hub-theme",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // Re-apply the persisted theme once rehydration completes.
        applyTheme(state?.theme ?? "sigilweaver");
      },
    }
  )
);
