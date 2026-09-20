import { useEffect, useState } from "react";
import LedMapping from "./LedMapping";
import SoundPicker from "./SoundPicker";
import StickView from "./StickView";
import { type SoundStatus, macroCheck, onEvent, soundFiles, soundReconnect, soundRepairCable, soundStatus, soundStop } from "./bridge";
import type { PadLike } from "./gamepad";
import { PADS, SOLR_LED_MAP, type VoiceConfig, soundLabel } from "./voice";

/*
  One page for the whole stick: the model on the left, what the selected
  button does on the right.

  The knob (buttons 20-23) picks the bank, and a bank is the whole layout -
  every button's sound or macro. Turning the knob swaps all of them at once.
*/

interface Props {
  stick: PadLike | null;
  bank: number | null;
  cfg: VoiceConfig;
  update: (c: VoiceConfig) => void;
  setHold: (h: boolean) => void;
  ledError: string | null;
}

/** Everything this bank has on its buttons, in button order. */
function assignments(cfg: VoiceConfig, bank: number) {
  const b = cfg.banks[bank];
  const out: { button: number; kind: "sound" | "macro"; what: string }[] = [];
  for (const [btn, file] of Object.entries(b?.pads ?? {})) {
    if (file) out.push({ button: Number(btn), kind: "sound", what: soundLabel(file) });
  }
  for (const [btn, m] of Object.entries(b?.macros ?? {})) {
    if (m?.steps) out.push({ button: Number(btn), kind: "macro", what: m.steps });
  }
  return out.sort((a, b2) => a.button - b2.button);
}

export default function MacrosPage({ stick, bank, cfg, update, setHold, ledError }: Props) {
  const [tab, setTab] = useState<number | null>(null); // null = follow the knob
  const b = tab ?? bank ?? 0;
  const eb = cfg.banks[b];
  const [selected, setSelected] = useState<number | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [status, setStatus] = useState<SoundStatus | null>(null);
  const [steps, setSteps] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [repairing, setRepairing] = useState(false);

  const sound = selected === null ? "" : eb?.pads?.[selected] ?? "";
  const macro = selected === null ? undefined : eb?.macros?.[selected];
  const kind: "none" | "sound" | "macro" = sound ? "sound" : macro?.steps ? "macro" : "none";

  const loadFiles = () => {
    if (!eb?.folder) { setFiles([]); return; }
    soundFiles(eb.folder).then(setFiles).catch(() => setFiles([]));
  };
  useEffect(loadFiles, [eb?.folder]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    soundStatus().then(setStatus).catch(() => {});
    return onEvent<SoundStatus>("solr:sound-status", setStatus);
  }, []);
  useEffect(() => setSteps(macro?.steps ?? ""), [selected, b]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!steps) { setProblem(null); setCount(0); return; }
    macroCheck(steps).then((n) => { setCount(n); setProblem(null); }).catch((e) => setProblem(String(e)));
  }, [steps]);

  const setBank = (patch: Partial<VoiceConfig["banks"][number]>) =>
    update({ ...cfg, banks: cfg.banks.map((x, i) => (i === b ? { ...x, ...patch } : x)) });
  const setSound = (file: string) => {
    if (selected === null) return;
    setBank({ pads: { ...(eb.pads ?? {}), [selected]: file } });
  };
  const setMacro = (text: string, gap = macro?.gap ?? 120) => {
    if (selected === null) return;
    setSteps(text);
    setBank({ macros: { ...(eb.macros ?? {}), [selected]: { steps: text, gap } } });
  };
  const clear = () => {
    if (selected === null) return;
    const pads = { ...(eb.pads ?? {}) };
    const macros = { ...(eb.macros ?? {}) };
    delete pads[selected];
    delete macros[selected];
    setSteps("");
    setBank({ pads, macros });
  };

  const isPad = selected !== null && PADS.includes(selected);
  const list = assignments(cfg, b);

  return (
    <div className="mx-page">
      <div className="mx-left">
        <div className="mx-banks">
          {cfg.banks.map((x, i) => (
            <button key={i} className={`mx-bank ${i === b ? "on" : ""} ${bank === i ? "knob" : ""}`}
              style={{ ["--bank" as string]: x.color }} onClick={() => setTab(i)}
              title={bank === i ? "The knob is on this bank" : `Knob position ${i + 1} (button ${20 + i})`}>
              <span className="mx-dot" />
              {x.name}
              <small>{assignments(cfg, i).length}</small>
            </button>
          ))}
          {tab !== null && tab !== bank && <button className="ghost-btn" onClick={() => setTab(null)}>Follow the knob</button>}
        </div>
        <StickView stick={stick} bank={b} cfg={cfg} selected={selected} onSelect={setSelected} />
      </div>

      <div className="mx-right">
        <section className="vv-panel mx-edit">
          <div className="mx-edit-head">
            <div>
              <h2>{selected === null ? "Pick a button" : `Button ${selected}`}</h2>
              <p className="hint">
                {selected === null
                  ? "Click a button on the stick, or one from the list below."
                  : isPad
                    ? `A pad in ${eb.name} · LED ${cfg.map[selected] ?? SOLR_LED_MAP[selected]}`
                    : `In ${eb.name}`}
              </p>
            </div>
            <input className="vv-name" value={eb?.name ?? ""} maxLength={20} title="This bank's name"
              onChange={(e) => setBank({ name: e.target.value })} />
            <label className="vv-color" title="This bank's colour on the stick">
              <input type="color" value={eb?.color ?? "#39ff6a"} onChange={(e) => setBank({ color: e.target.value })} />
            </label>
          </div>

          {selected !== null && (
            <>
              <div className="mx-kind">
                <button className={kind === "sound" ? "on" : ""} onClick={() => { if (kind !== "sound") setSound(files[0] ?? ""); }}>Sound</button>
                <button className={kind === "macro" ? "on" : ""} onClick={() => { if (kind !== "macro") setMacro(steps || "F"); }}>Macro</button>
                <button className={kind === "none" ? "on" : ""} onClick={clear}>Nothing</button>
              </div>

              {kind === "sound" && (
                <div className="mx-sound">
                  <SoundPicker folder={eb.folder ?? ""} files={files} value={sound} color={eb.color} onPick={setSound} onOpen={loadFiles} />
                  <p className="hint">Plays to the game's mic and to you, with Caps Lock held while it plays.</p>
                </div>
              )}

              {kind === "macro" && (
                <div className="mx-macro">
                  <input className="mc-steps" value={steps} spellCheck={false} placeholder="F, WheelDown, Enter x5, &quot;text&quot;, Esc"
                    onChange={(e) => setMacro(e.target.value)} />
                  <div className="mc-top">
                    <label className="mc-gap" title="Pause between steps - raise it if the game misses some">
                      every <input className="num" type="number" min={10} max={5000} step={10} value={macro?.gap ?? 120}
                        onChange={(e) => setMacro(steps, Number(e.target.value) || 120)} /> ms
                    </label>
                    {problem ? <span className="warn">{problem}</span> : <span className="muted">{count} steps</span>}
                  </div>
                  <p className="hint">
                    Keys (F, Esc, Enter, 1, F5, Up…), <code>WheelDown</code>, <code>Wait 200</code>, <code>"text to type"</code>,{" "}
                    <code>F hold 2s</code>, <code>Enter x24 fast</code>, <code>Esc instant</code>.
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        <section className="vv-panel mx-list">
          <h2>{eb?.name} holds {list.length}</h2>
          <div className="mx-rows">
            {list.length === 0 && <p className="hint">Nothing on this bank's buttons yet.</p>}
            {list.map((a) => (
              <button key={`${a.kind}${a.button}`} className={`mx-row ${selected === a.button ? "on" : ""}`} onClick={() => setSelected(a.button)}>
                <b>{a.button}</b>
                <span className={`tag ${a.kind}`}>{a.kind}</span>
                <span className="mx-what">{a.what}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="vv-panel mx-settings">
          <div className="row">
            <label className="vv-ptt" title="The game only hears you while its push-to-talk key is down">
              <input type="checkbox" checked={cfg.ptt !== false} onChange={(e) => update({ ...cfg, ptt: e.target.checked })} />
              Hold <kbd>Caps Lock</kbd> while a sound plays
            </label>
            <label className="vv-stopbtn" title="This button stops every sound playing (0 = none)">
              Stop button
              <input className="num" type="number" min={0} max={128} value={cfg.stopButton ?? 11}
                onChange={(e) => update({ ...cfg, stopButton: Math.max(0, Math.min(128, Number(e.target.value) || 0)) })} />
            </label>
            <button className="ghost-btn" onClick={() => soundStop()}>Stop all</button>
          </div>
          <p className={`hint ${status && (!status.cable || status.errors.length) ? "warn" : ""}`}>
            {!status ? "Opening the sound devices..." : <>
              Game hears: <b>{status.cable ?? "no cable"}</b> · You hear: <b>{status.monitor ?? "nothing"}</b> · {status.loaded} sounds ready
              {status.errors.map((e) => <span key={e} className="vv-err">{e}</span>)}
            </>}
          </p>
          <div className="row">
            {status?.cable_repairable && (
              <button className="add-btn" disabled={repairing} onClick={() => { setRepairing(true); soundRepairCable().finally(() => { setRepairing(false); setStatus(null); }); }}>
                {repairing ? "Repairing - answer the Windows prompt..." : "Repair VB-CABLE"}
              </button>
            )}
            <button className="ghost-btn" onClick={() => { setStatus(null); soundReconnect(); }}>Reconnect sound devices</button>
          </div>
          {ledError && <p className="hint warn">LEDs: {ledError}</p>}
          <details className="mx-leds">
            <summary>Stick LEDs</summary>
            <LedMapping stick={stick} bank={bank} cfg={cfg} update={update} setHold={setHold} />
          </details>
        </section>
      </div>
    </div>
  );
}
