import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "workly-theme";

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Theme always follows the device setting (phone dark mode on/off).
  const [theme, setTheme] = useState<Theme>(getSystemTheme);

  // Clear any theme saved by the old in-app toggle so it can't override the system.
  useEffect(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable — nothing to clear
    }
  }, []);

  // React instantly when the user switches dark mode on/off on their device.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setTheme(e.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === "dark";
    const themeColor = isDark ? "#010816" : "#f7f9fb";

    root.classList.toggle("dark", isDark);
    root.style.colorScheme = theme;
    root.style.setProperty("--app-shell-bg", themeColor);
    // Paint the root element too: when a dialog/sheet locks scrolling, any area
    // the body does not cover would otherwise fall back to the light colour.
    root.style.backgroundColor = themeColor;
    if (document.body) document.body.style.backgroundColor = themeColor;

    // Keep both theme-color and color-scheme meta tags in sync so mobile
    // browsers match the site to the device theme.
    function upsertMeta(name: string, content: string) {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", name);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    }

    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
    upsertMeta("theme-color", themeColor);
    upsertMeta("color-scheme", theme);
  }, [theme]);

  // No in-app toggle anymore — these are no-ops kept for API compatibility.
  const noop = () => undefined;

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === "dark", setTheme: noop, toggleTheme: noop }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback so components outside the provider never crash
    return {
      theme: "light",
      isDark: false,
      setTheme: () => undefined,
      toggleTheme: () => undefined,
    };
  }
  return ctx;
};
