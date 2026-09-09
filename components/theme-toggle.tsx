"use client";

import { useSyncExternalStore } from "react";

import { Icons } from "./icons";

type Theme = "light" | "dark";

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("entry-console-theme", theme);
  } catch {
    /* private mode */
  }
}

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(
    subscribe,
    () => ((document.documentElement.getAttribute("data-theme") as Theme) ?? "light"),
    () => "light"
  );
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() => apply(next)}
      title={theme === "dark" ? "Гэрэлтэй горим" : "Харанхуй горим"}
      aria-label="Горим солих"
    >
      {theme === "dark" ? <Icons.sun className="h-4 w-4" /> : <Icons.moon className="h-4 w-4" />}
    </button>
  );
}

/** Hydration-ээс ӨМНӨ ажиллах inline script — theme анивчихгүй. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("entry-console-theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;
