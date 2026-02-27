"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

function readThemeMode(): ThemeMode {
  if (typeof document === "undefined") {
    return "dark";
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useThemeMode(): ThemeMode {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readThemeMode());

  useEffect(() => {
    const syncTheme = () => setThemeMode(readThemeMode());

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("storage", syncTheme);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  return themeMode;
}
