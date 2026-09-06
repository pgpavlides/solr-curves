"use client";

/*
  Chrome around a canvas: the system's card anatomy — panel surface, inset rim,
  card shadow, and a lit Lumen horizon at the base. The canvas itself is the
  only thing that changes between scenes.
*/
export default function Viewport({
  label,
  hint,
  height = 420,
  children,
  controls,
}: {
  label: string;
  hint?: string;
  height?: number;
  children: React.ReactNode;
  controls?: React.ReactNode;
}) {
  return (
    <div className="viewport">
      <span className="viewport-label">{label}</span>
      {hint && <span className="viewport-hint">{hint}</span>}
      <div style={{ height }}>{children}</div>
      {controls && <div className="viewport-controls">{controls}</div>}
    </div>
  );
}
