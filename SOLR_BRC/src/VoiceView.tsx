import { useEffect, useRef, useState } from "react";
import { ledSet } from "./bridge";
import type { PadLike } from "./gamepad";
import { KNOB, PADS, type VoiceConfig, hexRgb, padsTo } from "./voice";

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

const MAX_GROUP = 40;

export default function VoiceView({ stick, bank, cfg, update, setHold, ledError }: Props) {
  // ---- mapping tool state
  const [mapping, setMapping] = useState<{ group: number; found: Record<number, number> } | null>(null);
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

  const startMapping = async () => {
    setHold(true);
    setNote(null);
    setMapping({ group: 0, found: {} });
    await lightOnly(0);
  };
  const next = async (found: Record<number, number>, group: number) => {
    if (group >= MAX_GROUP) return finish(found);
    setMapping({ group, found });
    await lightOnly(group);
  };
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
  const test = (color: string) => ledSet(padsTo(cfg, color)).catch((e) => setNote(String(e)));

  const shown = bank !== null ? cfg.banks[bank] : null;

  return (
    <div className="voice-view">
      <section className="vv-panel">
        <div className="vv-head">
          <div>
            <h2>Voice control</h2>
            <p className="hint">The knob on the base (buttons 20–23) picks the bank. The pads light up in its colour. Sounds per bank come next.</p>
          </div>
          <div className={`vv-bank-now ${bank === null ? "none" : ""}`}>
            <span className="muted">Knob</span>
            <b>{bank === null ? "not read" : `${cfg.banks[bank].name}`}</b>
          </div>
        </div>

        <div className="vv-banks">
          {cfg.banks.map((b, i) => (
            <div key={i} className={`vv-bank ${bank === i ? "on" : ""}`} style={{ ["--bank" as string]: b.color }}>
              <div className="vv-bank-top">
                <span className="vv-knob">button {KNOB[i]}</span>
                {bank === i && <span className="tag">active</span>}
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

        <div className="vv-pads-wrap">
          <div className="vv-pads">
            {PADS.map((btn) => {
              const [r, g, b] = hexRgb(shown?.color ?? "#223");
              return (
                <div key={btn} className={`vv-pad ${pressed.has(btn) ? "down" : ""}`}
                  style={{ background: shown ? `rgba(${r},${g},${b},0.22)` : undefined, borderColor: shown?.color, boxShadow: shown ? `0 0 18px rgba(${r},${g},${b},0.45)` : undefined }}>
                  <b>{btn}</b>
                  <span>LED {cfg.map[btn] ?? btn - 1}</span>
                </div>
              );
            })}
          </div>
          <p className="hint">The eight pad buttons on the stick, as they should light now. Pressing one highlights it here.</p>
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
            <p>Press the button that glows.</p>
            <div className="row">
              <button className="ghost-btn" onClick={() => next(mapping.found, mapping.group + 1)}>Nothing lit / not a pad</button>
              <button className="add-btn" onClick={() => finish(mapping.found)}>Done</button>
            </div>
            <div className="vv-found">
              {Object.entries(mapping.found).map(([b, g]) => <span key={b} className="tag">{b} → {g}</span>)}
            </div>
          </div>
        ) : (
          <button className="add-btn" onClick={startMapping}>Map the LEDs</button>
        )}
        <table className="vv-maptable">
          <thead><tr><th>Button</th><th>LED group</th><th /></tr></thead>
          <tbody>
            {PADS.map((btn) => (
              <tr key={btn}>
                <td>{btn}</td>
                <td>
                  <input className="num" type="number" min={0} max={MAX_GROUP} value={cfg.map[btn] ?? btn - 1}
                    onChange={(e) => update({ ...cfg, map: { ...cfg.map, [btn]: Number(e.target.value) } })} />
                </td>
                <td><button className="ghost-btn" onClick={async () => {
                  await ledSet([[cfg.map[btn] ?? btn - 1, 255, 255, 255]]).catch((e) => setNote(String(e)));
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
