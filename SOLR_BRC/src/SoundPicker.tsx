import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { soundPreview } from "./bridge";
import { soundLabel } from "./voice";

/*
  The pad's sound chooser: click the pad's sound and a search box opens over
  the folder's files. Type any part of the name (words in any order: "hear
  can" finds "Can You Hear Me"), arrows to move, Enter to pick, Esc to close.
  ▶ on a row plays it on your monitor only.
*/

interface Props {
  folder: string;
  files: string[];
  value: string;
  color: string;
  onPick: (file: string) => void;
  /** the list is about to show: re-read the folder */
  onOpen?: () => void;
}

/** heli_can_you_hear_me.mp3 -> "heli" (the prefix groups the list) */
const groupOf = (f: string) => {
  const stem = f.replace(/\.[^.]+$/, "");
  return stem.includes("_") ? stem.split("_")[0] : "other";
};

const norm = (s: string) => s.toLowerCase().replace(/[_\-.]+/g, " ");

export default function SoundPicker({ folder, files, value, color, onPick, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const [at, setAt] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  // "" = silent, always first; then the matches
  const matches = useMemo(() => {
    const words = norm(q).split(" ").filter(Boolean);
    const hit = files.filter((f) => {
      const hay = norm(f) + " " + norm(soundLabel(f));
      return words.every((w) => hay.includes(w));
    });
    return words.length ? hit : ["", ...hit];
  }, [files, q]);

  const close = () => { setOpen(false); setQ(""); setAt(null); };
  const pick = (f: string) => { onPick(f); close(); };

  // fixed on screen (the pads' panel scrolls and would clip it): below the
  // pad, or above when there's more room there
  useLayoutEffect(() => {
    if (!open || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const width = Math.max(r.width, 340);
    const left = Math.min(r.left, window.innerWidth - width - 8);
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    setAt(below >= 320 || below >= above
      ? { left, top: r.bottom + 4, width, maxHeight: Math.min(460, below) }
      : { left, bottom: window.innerHeight - r.top + 4, width, maxHeight: Math.min(460, above) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHi(Math.max(0, matches.indexOf(value)));
    // opacity, not visibility, while it's placed: a hidden input can't take focus
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
    else if (e.key === "Enter") { e.preventDefault(); if (matches[hi] !== undefined) pick(matches[hi]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === " " && e.ctrlKey && matches[hi]) { e.preventDefault(); soundPreview(folder, matches[hi]); }
  };

  const missing = !!value && files.length > 0 && !files.includes(value);
  let lastGroup = "";

  return (
    <div className="sp" ref={box}>
      <button className={`sp-current ${missing ? "warn" : ""} ${value ? "" : "silent"}`} onClick={() => { if (open) close(); else { onOpen?.(); setOpen(true); } }}
        title={value ? `${value} - click to change` : "Click to choose a sound"}>
        <span className="sp-label">{value ? soundLabel(value) : "silent"}</span>
        <span className="sp-file">{value ? (missing ? `${value} (missing)` : value) : "choose a sound..."}</span>
      </button>
      {open && (
        <div className="sp-pop" style={{ ["--bank" as string]: color, ...(at ?? { opacity: 0 }) }}>
          <div className="sp-search">
            <span className="sp-glass">⌕</span>
            <input ref={input} value={q} placeholder={`Search ${files.length} sounds...`} spellCheck={false}
              onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
            {q && <button className="sp-clear" onClick={() => { setQ(""); input.current?.focus(); }} title="Clear">×</button>}
          </div>
          <div className="sp-list" ref={list}>
            {matches.length === 0 && <div className="sp-none">No sound matches "{q}"</div>}
            {matches.map((f, i) => {
              const g = f ? groupOf(f) : "";
              const head = f && g !== lastGroup ? g : null;
              if (f) lastGroup = g;
              return (
                <div key={f || "(silent)"}>
                  {head && <div className="sp-group">{head}</div>}
                  <div className={`sp-row ${i === hi ? "hi" : ""} ${f === value ? "on" : ""}`}
                    onMouseEnter={() => setHi(i)} onClick={() => pick(f)}>
                    <div className="sp-text">
                      <b>{f ? soundLabel(f) : "Silent"}</b>
                      <small>{f || "this pad plays nothing"}</small>
                    </div>
                    {f && (
                      <button className="vv-play" title="Hear it (your monitor only)"
                        onClick={(e) => { e.stopPropagation(); soundPreview(folder, f); }}>▶</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sp-foot">↑↓ move · Enter pick · Ctrl+Space hear · Esc close</div>
        </div>
      )}
    </div>
  );
}
