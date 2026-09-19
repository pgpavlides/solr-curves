import { useEffect, useState } from "react";
import { macroCheck } from "./bridge";
import type { PadLike } from "./gamepad";
import type { Macro, MacroSet, VoiceConfig } from "./voice";

/*
  Button macros: a stick button types a sequence into the game - keys and
  mouse-wheel steps, e.g. button 1 = F, WheelDown, WheelDown, F, Esc. The app
  sends them (macros.rs); T.A.R.G.E.T. has no mouse wheel.
*/

interface Props {
  stick: PadLike | null;
  cfg: VoiceConfig;
  update: (c: VoiceConfig) => void;
}

/** The steps as chips, quoted text kept whole and shown without its quotes. */
function chipsOf(steps: string): string[] {
  return (steps.match(/"[^"]*"?|[^"]+/g) ?? []).flatMap((part) =>
    part.startsWith('"') ? [`type: ${part.replace(/"/g, "")}`] : part.replace(/-->|->|>| - /g, ",").split(/[,;]/).map((s) => s.trim()).filter(Boolean));
}

function MacroRow({ button, m, onChange, onDelete, down }: { button: number; m: Macro; onChange: (m: Macro) => void; onDelete: () => void; down: boolean }) {
  const [problem, setProblem] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  useEffect(() => {
    macroCheck(m.steps).then((n) => { setCount(n); setProblem(null); }).catch((e) => setProblem(String(e)));
  }, [m.steps]);
  const chips = chipsOf(m.steps);
  return (
    <div className={`mc-row ${down ? "down" : ""}`}>
      <div className="mc-top">
        <span className="mc-btn">button <b>{button}</b></span>
        <label className="mc-gap" title="Pause between steps - raise it if the game misses some">
          every <input className="num" type="number" min={10} max={5000} step={10} value={m.gap}
            onChange={(e) => onChange({ ...m, gap: Number(e.target.value) || 120 })} /> ms
        </label>
        <button className="ghost-btn" onClick={onDelete} title="Remove this macro">Remove</button>
      </div>
      <input className="mc-steps" value={m.steps} spellCheck={false} placeholder="F, WheelDown, WheelDown, F, Esc"
        onChange={(e) => onChange({ ...m, steps: e.target.value })} />
      <div className="mc-chips">
        {chips.map((c, i) => <span key={i} className="mc-chip">{c}</span>)}
        {!problem && <span className="muted mc-count">{count} steps</span>}
      </div>
      {problem && <p className="hint warn">{problem}</p>}
    </div>
  );
}

/** The Macros page: every button macro, big enough to read and edit. */
export default function MacrosPanel({ stick, cfg, update }: Props) {
  const pressed = new Set((stick?.buttons ?? []).flatMap((b, i) => (b.pressed ? [i + 1] : [])));
  const sets: Record<string, MacroSet> = cfg.macroSets ?? { Helicopter: cfg.macros ?? {} };
  const names = Object.keys(sets);
  const active = cfg.macroSet && sets[cfg.macroSet] ? cfg.macroSet : names[0];
  const macros = sets[active] ?? {};
  const putSets = (next: Record<string, MacroSet>, pick = active) => update({ ...cfg, macroSets: next, macroSet: pick });
  const addSet = () => {
    let n = 1;
    while (sets[`Set ${n}`]) n++;
    putSets({ ...sets, [`Set ${n}`]: {} }, `Set ${n}`);
  };
  const renameSet = (from: string, to: string) => {
    const clean = to.trim();
    if (!clean || (sets[clean] && clean !== from)) return;
    putSets(Object.fromEntries(names.map((n) => [n === from ? clean : n, sets[n]])), clean);
  };
  const removeSet = (name: string) => {
    if (names.length < 2) return;
    const next = { ...sets };
    delete next[name];
    putSets(next, Object.keys(next)[0]);
  };
  const [adding, setAdding] = useState("");
  const set = (next: MacroSet) => putSets({ ...sets, [active]: next });
  const add = () => {
    const b = Number(adding);
    if (!b || b < 1 || b > 128 || macros[b]) return;
    set({ ...macros, [b]: { steps: "", gap: 120 } });
    setAdding("");
  };
  return (
    <div className="mc-page">
    <section className="vv-panel mc-panel">
      <h2>Button macros</h2>
      <div className="mc-sets">
        {names.map((n) => (
          <button key={n} className={n === active ? "on" : ""} onClick={() => update({ ...cfg, macroSet: n })}>
            {n}
            <small>{Object.keys(sets[n]).length}</small>
          </button>
        ))}
        <button className="mc-addset" onClick={addSet} title="A new, empty set of macros">+ set</button>
      </div>
      <div className="mc-setbar">
        <label>
          <span className="muted">Set name</span>
          <input className="mc-setname" value={active} onChange={(e) => renameSet(active, e.target.value)} maxLength={24} />
        </label>
        <span className="muted">The buttons run <b>{active}</b> right now.</span>
        {names.length > 1 && <button className="ghost-btn" onClick={() => removeSet(active)}>Delete set</button>}
      </div>
      <p className="hint">
        A stick button types a sequence into the game. Keys (F, Esc, Enter, Space, 1, F5, Up...), <code>WheelDown</code> /{" "}
        <code>WheelUp</code> and <code>Wait 200</code>, separated by commas, dashes or arrows. Text to type goes in quotes - the quotes themselves aren't typed: <code>Enter, "Hello!", Enter</code>. Hold a key with <code>F hold 2s</code>; <code>Esc instant</code> skips the pause before a step. Repeat a step with{" "}
        <code>Enter x24</code>, and add <code>fast</code> to rush the repeats. Works in any bank.
      </p>
      {Object.entries(macros).map(([b, m]) => (
        <MacroRow key={b} button={Number(b)} m={m} down={pressed.has(Number(b))}
          onChange={(nm) => set({ ...macros, [b]: nm })}
          onDelete={() => { const n = { ...macros }; delete n[Number(b)]; set(n); }} />
      ))}
      <div className="row">
        <input className="num" type="number" min={1} max={128} placeholder="button" value={adding}
          onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="ghost-btn" onClick={add}>Add macro</button>
      </div>
    </section>
    </div>
  );
}
