"use client";

import { useEffect, useState } from "react";
import Logo from "./Logo";

/**
 * Holds the screen until the airframe and the renderer are both up, then
 * fades. `done` is driven by the app rather than by load progress alone —
 * WebGPU initialisation finishes after the last byte arrives, and dropping the
 * curtain early shows an empty scene.
 */
export default function Loader({
  progress,
  done,
  note,
}: {
  progress: number;
  done: boolean;
  note: string;
}) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setGone(true), 700);
    return () => window.clearTimeout(t);
  }, [done]);

  if (gone) return null;

  return (
    <div className={`loader${done ? " is-done" : ""}`} role="status" aria-live="polite">
      <div className="loader-inner">
        <div className="logo-wrap">
          <Logo />
        </div>
        <span className="loader-word">wardogspilot</span>
        <div className="loader-bar">
          <span style={{ width: `${Math.max(4, Math.min(100, progress))}%` }} />
        </div>
        <span className="loader-note">{done ? "ready" : note}</span>
      </div>
    </div>
  );
}
