import { useEffect, useRef, useState } from "react";
import { type SoundFired, type SoundStatus, ledSet, onEvent, soundFiles, soundPreview, soundReconnect, soundRepairCable, soundStatus, soundStop } from "./bridge";
import type { PadLike } from "./gamepad";
import SoundPicker from "./SoundPicker";
import { KNOB, PADS, SOLR_LED_MAP, type VoiceConfig, allTo, hexRgb, soundLabel } from "./voice";

/*
  Voice control page. Part 1: the knob is the bank, the pads light up in the
  bank's colour. Later: each bank = a set of sounds on the pads.

  The LED mapping tool: it lights one LED group at a time in white and waits
  for you to press the button that glows (read through T.A.R.G.E.T., so it
  works while the stick is hidden from Windows). "Nothing lit" skips a group.
*/

interface Props {
  stick: PadLike | null;
  bank: number | null;
  cfg: VoiceConfig;
  update: (c: VoiceConfig) => void;
  setHold: (h: boolean) => void;
  ledError: string | null;
}

const MAX_GROUP = 64;
const SCAN_MS = 1500; // how long each LED stays lit in an automatic scan

export default function VoiceView({ stick, bank, cfg, update, setHold, ledError }: Props) {
  // ---- mapping tool state
  const [mapping, setMapping] = useState<{ group: number; found: Record<number, number>; auto: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const pressedBefore = useRef<Set<number>>(new Set());

  const pressed = new Set(
    (stick?.buttons ?? []).flatMap((b, i) => (b.pressed ? [i + 1] : [])).filter((n) => !KNOB.includes(n)),
  );

  const lightOnly = async (group: number | null) => {
    const off: [number, number, number, number][] = [];
    for (let g = 0; g < MAX_GROUP; g++) off.push([g, 0, 0, 0]);
    await ledSet(off);
    if (group !== null) await ledSet([[group, 255, 255, 255]]);
  };

  const startMapping = async (auto: boolean) => {
    setHold(true);
    setNote(null);
    setMapping({ group: 0, found: {}, auto });
    await lightOnly(0);
  };
  const next = async (found: Record<number, number>, group: number) => {
    if (group >= MAX_GROUP) return finish(found);
    setMapping((m) => ({ group, found, auto: m?.auto ?? false }));
    await lightOnly(group);
  };
  // automatic scan: each LED stays lit SCAN_MS, then the next one - you only
  // press a button when it glows (a press is credited to the LED lit then)
  useEffect(() => {
    if (!mapping?.auto) return;
    const t = setTimeout(() => next(mapping.found, mapping.group + 1), SCAN_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping?.group, mapping?.auto]);
  const finish = async (found: Record<number, number>) => {
    const pads = PADS.filter((b) => found[b] !== undefined);
    if (pads.length) update({ ...cfg, map: { ...cfg.map, ...found } });
    setNote(pads.length
      ? `Mapped ${pads.length} of ${PADS.length} pad buttons: ${pads.map((b) => `${b}→LED ${found[b]}`).join(", ")}`
      : "Nothing mapped - the map is unchanged.");
    setMapping(null);
    await lightOnly(null);
    setHold(false); // the bank colours come back
  };

  // while mapping: the first newly pressed button is the one that glows
  useEffect(() => {
    if (!mapping) { pressedBefore.current = pressed; return; }
    const fresh = [...pressed].find((b) => !pressedBefore.current.has(b));
    pressedBefore.current = pressed;
    if (fresh === undefined) return;
    const found = { ...mapping.found, [fresh]: mapping.group };
    next(found, mapping.group + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stick]);

  const setColor = (i: number, color: string) => update({ ...cfg, banks: cfg.banks.map((b, j) => (j === i ? { ...b, color } : b)) });
  const test = (color: string) => ledSet(allTo(color)).catch((e) => setNote(String(e)));

  const shown = bank !== null ? cfg.banks[bank] : null;

  // ---- sounds: which bank is being edited (follows the knob until you click a bank)
  const [picked, setPicked] = useState<number | null>(null);
  const edit = picked ?? bank ?? 0;
  const eb = cfg.banks[edit];
  const [files, setFiles] = useState<string[]>([]);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [status, setStatus] = useState<SoundStatus | null>(null);
  const [fired, setFired] = useState<(SoundFired & { at: number }) | null>(null);
  const [talking, setTalking] = useState(false);
  const [repair, setRepair] = useState<{ busy: boolean; error?: string } | null>(null);
  const repairCable = async () => {
    setRepair({ busy: true });
    try { await soundRepairCable(); setRepair(null); setStatus(null); }
    catch (e) { setRepair({ busy: false, error: String(e) }); }
  };
  // read the folder again whenever a picker opens: clips get added while the app runs
  const loadFiles = () => {
    if (!eb.folder) { setFiles([]); setFilesError(null); return; }
    soundFiles(eb.folder).then((f) => { setFiles(f); setFilesError(null); }).catch((e) => { setFiles([]); setFilesError(String(e)); });
  };
  useEffect(loadFiles, [eb.folder]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    soundStatus().then(setStatus).catch(() => {});
    const a = onEvent<SoundStatus>("solr:sound-status", setStatus);
    const b = onEvent<SoundFired>("solr:sound", (f) => setFired({ ...f, at: Date.now() }));
    const c = onEvent<boolean>("solr:ptt", setTalking);
    return () => { a(); b(); c(); };
  }, []);
  const setBank = (i: number, patch: Partial<VoiceConfig["banks"][number]>) =>
    update({ ...cfg, banks: cfg.banks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const setPad = (btn: number, file: string) => setBank(edit, { pads: { ...(eb.pads ?? {}), [btn]: file } });
  const justFired = (btn: number) => fired && fired.button === btn && fired.bank === edit && Date.now() - fired.at < 1500;
  const [, tick] = useState(0);
  useEffect(() => { if (!fired) return; const t = setTimeout(() => tick((n) => n + 1), 1600); return () => clearTimeout(t); }, [fired]);

  return (
    <div className="voice-view">
      <section className="vv-panel">
        <div className="vv-head">
          <div>
            <h2>Voice control</h2>
            <p className="hint">The knob on the base (buttons 20–23) picks the bank. The whole stick lights up in its colour, and the pads play that bank's sounds. Click a bank to edit its sounds.</p>
          </div>
          <div className={`vv-bank-now ${bank === null ? "none" : ""}`}>
            <span className="muted">Knob</span>
            <b>{bank === null ? "not read" : `${cfg.banks[bank].name}`}</b>
          </div>
        </div>

        <div className="vv-banks">
          {cfg.banks.map((b, i) => (
            <div key={i} className={`vv-bank ${bank === i ? "on" : ""} ${edit === i ? "editing" : ""}`} style={{ ["--bank" as string]: b.color }}
              onClick={(e) => { if (!(e.target as HTMLElement).closest("input,button,label")) setPicked(i); }}>
              <div className="vv-bank-top">
                <span className="vv-knob">button {KNOB[i]}</span>
                {bank === i && <span className="tag">active</span>}
                <span className="muted vv-count">{Object.values(b.pads ?? {}).filter(Boolean).length} sounds</span>
              </div>
              <input className="vv-name" value={b.name} maxLength={20}
                onChange={(e) => update({ ...cfg, banks: cfg.banks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <label className="vv-color">
                <input type="color" value={b.color} onChange={(e) => setColor(i, e.target.value)} />
                <code>{b.color}</code>
              </label>
              <button className="ghost-btn" onClick={() => test(b.color)} title="Light the pads in this colour now">Show on stick</button>
            </div>
          ))}
        </div>

        <div className="vv-sounds">
          <div className="vv-sounds-head">
            <h3 style={{ color: eb.color }}>{eb.name} sounds</h3>
            {picked !== null && picked !== bank && <button className="ghost-btn" onClick={() => setPicked(null)}>Follow the knob</button>}
            <label className="vv-folder">
              <span className="muted">Folder</span>
              <input value={eb.folder ?? ""} placeholder="e.g. E:/WARDOGS_SOUNDBOARD" spellCheck={false}
                onChange={(e) => setBank(edit, { folder: e.target.value })} />
            </label>
            <label className="vv-ptt" title="The game only hears you while its push-to-talk key is down: Caps Lock is held from just before a sound starts until it ends">
              <input type="checkbox" checked={cfg.ptt !== false} onChange={(e) => update({ ...cfg, ptt: e.target.checked })} />
              Hold <kbd>Caps Lock</kbd> while playing
              <span className={`vv-talk ${talking ? "on" : ""}`}>{talking ? "TALKING" : "idle"}</span>
            </label>
            <button className="ghost-btn" onClick={() => soundStop()} title="Stop everything playing (and let go of Caps Lock)">Stop all</button>
          </div>
          {filesError && <p className="hint warn">{filesError}</p>}
          <div className="vv-pads">
            {PADS.map((btn) => {
              const [r, g, b] = hexRgb(eb.color);
              const file = eb.pads?.[btn] ?? "";
              return (
                <div key={btn} className={`vv-pad ${pressed.has(btn) && edit === bank ? "down" : ""} ${justFired(btn) ? "fired" : ""}`}
                  style={{ background: `rgba(${r},${g},${b},0.16)`, borderColor: eb.color, boxShadow: `0 0 16px rgba(${r},${g},${b},0.35)` }}>
                  <div className="vv-pad-top">
                    <b>{btn}</b>
                    <span>LED {cfg.map[btn] ?? SOLR_LED_MAP[btn]}</span>
                    <button className="vv-play" disabled={!file || !eb.folder} title="Hear it (your monitor only - not sent to the game)"
                      onClick={() => eb.folder && soundPreview(eb.folder, file)}>▶</button>
                  </div>
                  <SoundPicker folder={eb.folder ?? ""} files={files} value={file} color={eb.color} onPick={(f) => setPad(btn, f)} onOpen={loadFiles} />
                </div>
              );
            })}
          </div>
          <p className="hint">
            Turn the knob to {eb.name} and press a pad: the sound goes to the game's mic and to you.
            {fired && Date.now() - fired.at < 1500 && (fired.error
              ? <b className="warn"> {fired.file}: {fired.error}</b>
              : <b> Played {fired.file && soundLabel(fired.file)}.</b>)}
          </p>
          <p className={`hint ${status && (!status.cable || status.errors.length) ? "warn" : ""}`}>
            {!status ? "Opening the sound devices..." : <>
              Game hears: <b>{status.cable ?? "no cable open"}</b> · You hear: <b>{status.monitor ?? "nothing (no monitor)"}</b> · {status.loaded} sounds ready
              {status.errors.map((e) => <span key={e} className="vv-err">{e}</span>)}
            </>}
          </p>
          <div className="row">
            {status?.cable_repairable && (
              <button className="add-btn" disabled={repair?.busy} onClick={repairCable}
                title="Puts the VB-CABLE device back from the driver Windows still has. Windows asks for admin rights once.">
                {repair?.busy ? "Repairing - answer the Windows prompt..." : "Repair VB-CABLE"}
              </button>
            )}
            <button className="ghost-btn" onClick={() => { setStatus(null); soundReconnect(); }} title="Open the sound devices again - after installing VB-CABLE or replugging the Focusrite">Reconnect sound devices</button>
          </div>
          {repair?.error && <p className="hint warn">Repair: {repair.error}</p>}
        </div>
        {ledError && <p className="hint warn">LEDs: {ledError}</p>}
      </section>

      <section className="vv-panel vv-map">
        <h2>LED mapping</h2>
        <p className="hint">
          The Sol-R numbers its LEDs its own way. If the colours land on the wrong buttons, map them once: each LED
          lights up white in turn - press the button that glows, or "Nothing lit" to skip.
        </p>
        {mapping ? (
          <div className="vv-mapping">
            <div className="vv-map-now">
              <span className="muted">LED group</span>
              <b>{mapping.group}</b>
              <span className="muted">of {MAX_GROUP - 1} is lit white</span>
            </div>
            <p>{mapping.auto ? "Watch the pads - press the one that glows white. It moves on by itself." : "Press the button that glows."}</p>
            <div className="vv-scanbar"><div style={{ width: `${(mapping.group / (MAX_GROUP - 1)) * 100}%` }} /></div>
            <div className="row">
              {!mapping.auto && <button className="ghost-btn" onClick={() => next(mapping.found, mapping.group + 1)}>Nothing lit / not a pad</button>}
              <button className="add-btn" onClick={() => finish(mapping.found)}>{PADS.every((b) => mapping.found[b] !== undefined) ? "Done - all 8 found" : "Stop and save"}</button>
            </div>
            <div className="vv-found">
              {Object.entries(mapping.found).map(([b, g]) => <span key={b} className="tag">{b} → {g}</span>)}
            </div>
          </div>
        ) : (
          <div className="row">
            <button className="add-btn" onClick={() => startMapping(true)} title={`Lights each LED for ${SCAN_MS / 1000} s in turn`}>Scan automatically</button>
            <button className="ghost-btn" onClick={() => startMapping(false)}>Step by step</button>
          </div>
        )}
        <table className="vv-maptable">
          <thead><tr><th>Button</th><th>LED group</th><th /></tr></thead>
          <tbody>
            {PADS.map((btn) => (
              <tr key={btn}>
                <td>{btn}</td>
                <td>
                  <input className="num" type="number" min={0} max={MAX_GROUP} value={cfg.map[btn] ?? SOLR_LED_MAP[btn]}
                    onChange={(e) => update({ ...cfg, map: { ...cfg.map, [btn]: Number(e.target.value) } })} />
                </td>
                <td><button className="ghost-btn" onClick={async () => {
                  await ledSet([[cfg.map[btn] ?? SOLR_LED_MAP[btn], 255, 255, 255]]).catch((e) => setNote(String(e)));
                  setTimeout(() => { if (shown) test(shown.color); }, 900);
                }}>Flash white</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {note && <p className="dv-note">{note}</p>}
      </section>
    </div>
  );
}
