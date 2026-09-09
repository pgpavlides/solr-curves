"use client";

import { useEffect, useState } from "react";

/*
  Paper or forest.

  The whole design system is tokens, so a theme is a second set of values for
  the same names — see the [data-theme="forest"] block in styles/system.css.
  Nothing else in the project knows there is more than one theme.

  The choice is written to <html> and to localStorage. It is ALSO applied by an
  inline script in app/layout.tsx that runs before first paint: without that,
  a forest visitor gets a full frame of cream before the JS lands, which is
  the flash every theme toggle on the web is remembered for.
*/

export type Theme = "paper" | "forest";
export const THEME_KEY = "broccolipilot:theme";

/** The one place that knows how a theme is applied. Shared with the layout. */
export const applyTheme = (t: Theme) => {
  document.documentElement.dataset.theme = t;
};

export default function ThemeToggle({ className = "" }: { className?: string }) {
  // Start from whatever the pre-paint script already decided, so this never
  // renders a state that contradicts what is on screen.
  const [theme, setTheme] = useState<Theme>("paper");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme) || "paper";
    setTheme(current);
    setReady(true);
  }, []);

  const flip = () => {
    const next: Theme = theme === "paper" ? "forest" : "paper";
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // private mode or blocked storage: the choice just will not persist
    }
  };

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={flip}
      // before the effect runs we do not know which way round it is, and
      // announcing the wrong one is worse than announcing nothing
      aria-label={ready ? (theme === "paper" ? "Switch to dark green" : "Switch to paper") : "Switch theme"}
      title={ready ? (theme === "paper" ? "Dark green" : "Paper") : "Theme"}
    >
      <span className="theme-toggle-dot" aria-hidden="true" />
      <span className="theme-toggle-label">{theme === "paper" ? "Dark" : "Paper"}</span>
    </button>
  );
}
