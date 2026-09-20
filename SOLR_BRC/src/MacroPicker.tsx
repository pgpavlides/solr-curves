import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MacroPreset } from "./voice";

/*
  Pick a saved macro for the selected button: the same search box as the sound
  picker, over the presets. Type any part of a name or of its steps ("enter
  x24" finds the long ones), arrows to move, Enter to pick, Esc to close.
*/

interface Props {
  presets: MacroPreset[];
  /** the name on the button now, so the list can mark it */
  value: string;
  color: string;
  onPick: (p: MacroPreset) => void;
  onDelete?: (name: string) => void;
}

const norm = (s: string) => s.toLowerCase().replace(/[_\-.,]+/g, " ");

export default function MacroPicker({ presets, value, color, onPick, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const [at, setAt] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const words = norm(q).split(" ").filter(Boolean);
    return presets.filter((p) => {
      const hay = norm(p.name) + " " + norm(p.steps);
      return words.every((w) => hay.includes(w));
    });
  }, [presets, q]);

  const close = () => { setOpen(false); setQ(""); setAt(null); };
  const pick = (p: MacroPreset) => { onPick(p); close(); };

  useLayoutEffect(() => {
    if (!open || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const width = Math.max(r.width, 380);
    const left = Math.min(r.left, window.innerWidth - width - 8);
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    setAt(below >= 300 || below >= above
      ? { left, top: r.bottom + 4, width, maxHeight: Math.min(420, below) }
      : { left, bottom: window.innerHeight - r.top + 4, width, maxHeight: Math.min(420, above) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHi(Math.max(0, matches.findIndex((p) => p.name === value)));
    input.current?.focus();
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { if (open) setHi(0); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    list.current?.querySelector(".sp-row.hi")?.scrollIntoView({ block: "nearest" });
  }, [hi, open]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(matches.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (matches[hi]) pick(matches[hi]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  };

  return (
    <div className="sp mp" ref={box}>
      <button className="ghost-btn mp-open" onClick={() => (open ? close() : setOpen(true))}
        title="Put a saved macro on this button">
        Saved macros{presets.length ? ` (${presets.length})` : ""}
      </button>
      {open && (
        <div className="sp-pop" style={{ ["--bank" as string]: color, ...(at ?? { opacity: 0 }) }}>
          <div className="sp-search">
            <span className="sp-glass">⌕</span>
            <input ref={input} value={q} placeholder={`Search ${presets.length} saved macros...`} spellCheck={false}
              onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
            {q && <button className="sp-clear" onClick={() => { setQ(""); input.current?.focus(); }} title="Clear">×</button>}
          </div>
          <div className="sp-list" ref={list}>
            {presets.length === 0 && <div className="sp-none">No saved macros yet. Name one and press "Save as preset".</div>}
            {presets.length > 0 && matches.length === 0 && <div className="sp-none">Nothing matches "{q}"</div>}
            {matches.map((p, i) => (
              <div key={p.name} className={`sp-row ${i === hi ? "hi" : ""} ${p.name === value ? "on" : ""}`}
                onMouseEnter={() => setHi(i)} onClick={() => pick(p)}>
                <div className="sp-text">
                  <b>{p.name}</b>
                  <small>{p.steps}</small>
                </div>
                {onDelete && (
                  <button className="sp-clear" title={`Forget "${p.name}"`}
                    onClick={(e) => { e.stopPropagation(); onDelete(p.name); }}>×</button>
                )}
              </div>
            ))}
          </div>
          <div className="sp-foot">↑↓ move · Enter pick · Esc close</div>
        </div>
      )}
    </div>
  );
}
