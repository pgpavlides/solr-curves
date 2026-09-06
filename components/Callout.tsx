export default function Callout({
  label,
  critical = false,
  children,
}: {
  label: string;
  /** Lights the full Lumen horizon — the system's "read this" signal. */
  critical?: boolean;
  children: React.ReactNode;
}) {
  return (
    <aside className={`callout${critical ? " is-critical" : ""}`}>
      <span className="callout-label">{label}</span>
      {children}
    </aside>
  );
}
