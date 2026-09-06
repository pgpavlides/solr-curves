"use client";

import React from "react";

/**
 * A blank rectangle is the worst possible failure for a 3D panel — nobody can
 * tell a broken renderer from a slow one. This turns any scene crash into a
 * readable message inside the same viewport chrome.
 */
export default class SceneBoundary extends React.Component<
  { children: React.ReactNode; height: number },
  { msg: string | null }
> {
  state = { msg: null as string | null };

  static getDerivedStateFromError(err: unknown) {
    return { msg: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: unknown) {
    console.error("[wardogspilot] scene failed:", err);
  }

  render() {
    if (this.state.msg) {
      return (
        <div
          className="viewport-fallback"
          style={{ height: this.props.height, flexDirection: "column", gap: 8, padding: 24, textAlign: "center" }}
          role="alert"
        >
          <span>3D view unavailable on this device</span>
          <span style={{ opacity: 0.6, fontSize: 11 }}>{this.state.msg}</span>
        </div>
      );
    }
    return this.props.children;
  }
}
