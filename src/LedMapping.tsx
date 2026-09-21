import { useEffect, useRef, useState } from "react";
import { ledSet } from "./bridge";
import type { PadLike } from "./gamepad";
import { KNOB, PADS, SOLR_LED_MAP, type VoiceConfig, bankLeds } from "./voice";

/*
  The Sol-R numbers its LEDs its own way, so the map is found on the real
  stick: light one LED white, press the button that glows. Automatic mode
  steps through the groups by itself; step by step waits for you.
*/

interface Props {
  stick: PadLike | null;
  bank: number | null;
  cfg: VoiceConfig;
  update: (c: VoiceConfig) => void;
  /** pause the app's own LED painting while this tool drives them */
  setHold: (h: boolean) => void;
}

const MAX_GROUP = 64;
const SCAN_MS = 1500;

export default function LedMapping({ stick, bank, cfg, update, setHold }: Props) {
  const [mapping, setMapping] = useState<{ group: number; found: Record<number, number>; auto: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /*
    The throttle's bank shows on one LED of the stick, blinking. It lights no
    button, so it can't be found by pressing one: step through the LEDs and
    say which one it is.
  */
  const [thrFind, setThrFind] = useState<number | null>(null);
  const pressedBefore = useRef<Set<number>>(new Set());

  const pressed = new Set(
    (stick?.buttons ?? []).flatMap((b, i) => (b.pressed ? [i + 1] : [])).filter((n) => !KNOB.includes(n)),
  );

  const lightOnly = async (group: number | null) => {
    await ledSet(Array.from({ length: MAX_GROUP }, (_, g) => [g, 0, 0, 0] as [number, number, number, number]));
    if (group !== null) await ledSet([[group, 255, 255, 255]]);
  };
  const back = () => {
    if (bank !== null) ledSet(bankLeds(cfg, bank)).catch(() => {});
  };

  const start = async (auto: boolean) => {
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
  const finish = async (found: Record<number, number>) => {
    const pads = PADS.filter((b) => found[b] !== undefined);
    if (pads.length) update({ ...cfg, map: { ...cfg.map, ...found } });
    setNote(pads.length
      ? `Mapped ${pads.length} of ${PADS.length} pads: ${pads.map((b) => `${b}→LED ${found[b]}`).join(", ")}`
      : "Nothing mapped - the map is unchanged.");
    setMapping(null);
    await lightOnly(null);
    setHold(false);
    back();
  };

  const findThrottleLed = async (group: number | null) => {
    if (group === null) {
      setThrFind(null);
      await lightOnly(null);
      setHold(false);
      back();
      return;
    }
    const g = ((group % MAX_GROUP) + MAX_GROUP) % MAX_GROUP;
    setHold(true);
    setThrFind(g);
    await lightOnly(g);
  };
  const firstUnmapped = () => {
    const pads = new Set(PADS.map((b) => cfg.map[b] ?? SOLR_LED_MAP[b]));
    let g = 0;
    while (pads.has(g)) g++;
    return g;
  };

  useEffect(() => {
    if (!mapping?.auto) return;
    const t = setTimeout(() => next(mapping.found, mapping.group + 1), SCAN_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping?.group, mapping?.auto]);

  // the first newly pressed button is the one lit right now
  useEffect(() => {
    if (!mapping) { pressedBefore.current = pressed; return; }
    const fresh = [...pressed].find((b) => !pressedBefore.current.has(b));
    pressedBefore.current = pressed;
    if (fresh === undefined) return;
    next({ ...mapping.found, [fresh]: mapping.group }, mapping.group + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stick]);

  return (
    <div className="led-map">
      <p className="hint">
        If the colours land on the wrong buttons, map them once: each LED lights up white in turn - press the button
        that glows, or skip it.
      </p>
      {mapping ? (
        <div className="vv-mapping">
          <div className="vv-map-now">
            <span className="muted">LED group</span>
            <b>{mapping.group}</b>
            <span className="muted">of {MAX_GROUP - 1} is lit white</span>
          </div>
          <p>{mapping.auto ? "Press the pad that glows - it moves on by itself." : "Press the button that glows."}</p>
          <div className="vv-scanbar"><div style={{ width: `${(mapping.group / (MAX_GROUP - 1)) * 100}%` }} /></div>
          <div className="row">
            {!mapping.auto && <button className="ghost-btn" onClick={() => next(mapping.found, mapping.group + 1)}>Nothing lit</button>}
            <button className="add-btn" onClick={() => finish(mapping.found)}>
              {PADS.every((b) => mapping.found[b] !== undefined) ? "Done - all 8 found" : "Stop and save"}
            </button>
          </div>
          <div className="vv-found">
            {Object.entries(mapping.found).map(([b, g]) => <span key={b} className="tag">{b} → {g}</span>)}
          </div>
        </div>
      ) : (
        <div className="row">
          <button className="add-btn" onClick={() => start(true)} title={`Lights each LED for ${SCAN_MS / 1000} s in turn`}>Scan automatically</button>
          <button className="ghost-btn" onClick={() => start(false)}>Step by step</button>
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
              <td>
                <button className="ghost-btn" onClick={async () => {
                  await ledSet([[cfg.map[btn] ?? SOLR_LED_MAP[btn], 255, 255, 255]]).catch((e) => setNote(String(e)));
                  setTimeout(back, 900);
                }}>Flash white</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="led-thr">
        <h3>Throttle bank LED</h3>
        <p className="hint">
          The throttle has banks of its own (hold its 48 or 49 for 3 seconds to change). One LED on the stick blinks
          in the throttle bank's colour - pick which.
        </p>
        {thrFind !== null ? (
          <div className="vv-mapping">
            <div className="vv-map-now">
              <span className="muted">LED group</span>
              <b>{thrFind}</b>
              <span className="muted">is lit white - is it the one you want blinking?</span>
            </div>
            <div className="row">
              <button className="ghost-btn" onClick={() => findThrottleLed(thrFind - 1)}>Back</button>
              <button className="ghost-btn" onClick={() => findThrottleLed(thrFind + 1)}>Next</button>
              <button className="add-btn" onClick={() => { update({ ...cfg, throttleLed: thrFind }); findThrottleLed(null); setNote(`The throttle bank blinks on LED group ${thrFind}.`); }}>This one</button>
              <button className="ghost-btn" onClick={() => findThrottleLed(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="row">
            <span>LED group</span>
            <input className="num" type="number" min={0} max={MAX_GROUP - 1} value={cfg.throttleLed ?? ""} placeholder="none"
              onChange={(e) => update({ ...cfg, throttleLed: e.target.value === "" ? undefined : Number(e.target.value) })} />
            <button className="add-btn" onClick={() => findThrottleLed(cfg.throttleLed ?? firstUnmapped())}>Find it on the stick</button>
            {cfg.throttleLed !== undefined && (
              <button className="ghost-btn" onClick={() => update({ ...cfg, throttleLed: undefined })}>No LED</button>
            )}
          </div>
        )}
      </div>
      {note && <p className="dv-note">{note}</p>}
    </div>
  );
}
