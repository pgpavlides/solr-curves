import { useEffect, useMemo, useRef, useState } from "react";
import {
  type HornInfo, type HornNote, type HornSong,
  hornHear, hornInfo, hornLoadFile, hornMidi, hornPlay, hornRecord, hornRender, hornRestore, hornSetBase, onEvent, soundStop,
} from "./bridge";
import { HORN_SONGS, builtinSong } from "./hornSongs";

/*
  Horn Music: any MIDI file, played on the helicopter's horn into voice chat.

  1. The instrument: a set of honks, short to long - the real WARDOGS horn is
     built in. Record your own off the PC's sound (honk a few times) or pick a
     file; it is split into honks and its pitch found, so songs play in tune.
     Each note uses the honk closest to its length.
  2. The song: a MIDI file, its tracks (drums left out), transpose and speed.
  3. Play: rendered to one clip, then out through VB-CABLE with the talk key
     held for the whole song, like a soundboard pad - or to you only.
*/

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (n: number) => `${NAMES[((Math.round(n) % 12) + 12) % 12]}${Math.floor(Math.round(n) / 12) - 1}`;
const withCents = (n: number) => {
  const c = Math.round((n - Math.round(n)) * 100);
  return `${noteName(n)}${c ? ` ${c > 0 ? "+" : ""}${c}¢` : ""}`;
};
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const TRACK_COLOURS = ["#39ff6a", "#2f9bff", "#ffb020", "#ff5fb4", "#b36bff", "#00e5ff", "#ff6b6b", "#c5f26e"];

export default function HornPage() {
  const [horn, setHorn] = useState<HornInfo | null>(null);
  const [secs, setSecs] = useState(10);
  const [recording, setRecording] = useState<number | null>(null); // seconds left
  const [msg, setMsg] = useState<string | null>(null);

  const [song, setSong] = useState<HornSong | null>(null);
  const [songName, setSongName] = useState("");
  const [on, setOn] = useState<Set<number>>(new Set());
  const [transpose, setTranspose] = useState(0);
  const [speed, setSpeed] = useState(100);
  // every song opens with an ordinary honk, so nobody sees it coming
  const [intro, setIntro] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ from: number; secs: number } | null>(null);
  const [now, setNow] = useState(0);
  const rendered = useRef<string>("");

  useEffect(() => { hornInfo().then(setHorn).catch(() => {}); }, []);
  useEffect(() => onEvent<string | null>("solr:horn-playing", (e) => { if (e) { setMsg(e); setPlaying(null); } }), []);

  // ---- 1. the instrument
  const record = async () => {
    setMsg(null);
    const until = Date.now() + secs * 1000;
    setRecording(secs);
    const tick = setInterval(() => setRecording(Math.max(0, Math.ceil((until - Date.now()) / 1000))), 200);
    try {
      setHorn(await hornRecord(secs));
      rendered.current = "";
    } catch (e) { setMsg(String(e)); }
    clearInterval(tick);
    setRecording(null);
  };
  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null);
    try {
      setHorn(await hornLoadFile(new Uint8Array(await f.arrayBuffer()), f.name.split(".").pop() ?? "wav"));
      rendered.current = "";
    } catch (e) { setMsg(String(e)); }
  };
  const tune = async (base: number) => { setHorn(await hornSetBase(base)); rendered.current = ""; };
  const restore = async () => {
    setMsg(null);
    try { setHorn(await hornRestore()); rendered.current = ""; } catch (e) { setMsg(String(e)); }
  };

  // ---- 2. the song
  const openMidi = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null);
    try {
      const s = await hornMidi(new Uint8Array(await f.arrayBuffer()));
      setSong(s);
      setSongName(f.name.replace(/\.midi?$/i, ""));
      setOn(new Set(s.tracks.filter((t) => !t.drums).map((t) => t.index)));
      setTranspose(0);
      setSpeed(100);
      rendered.current = "";
    } catch (e) { setMsg(String(e)); }
  };
  const pickBuiltin = (i: number) => {
    const s = HORN_SONGS[i];
    setMsg(null);
    setSong(builtinSong(s));
    setSongName(s.name);
    setOn(new Set([0]));
    setTranspose(0);
    setSpeed(100);
    rendered.current = "";
  };
  const notes: HornNote[] = useMemo(() => (song?.notes ?? []).filter((n) => on.has(n.track)), [song, on]);
  const toggle = (i: number) => setOn((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  // ---- 3. play
  const play = async (game: boolean) => {
    if (!horn?.has || !notes.length) return;
    setMsg(null);
    const key = JSON.stringify([songName, [...on].sort(), transpose, speed, intro, horn.base, horn.custom, horn.honks.map((h) => h.seconds)]);
    try {
      let length = playing?.secs ?? 0;
      if (rendered.current !== key) {
        setBusy("Tuning the horn…");
        const r = await hornRender(notes, transpose, speed / 100, intro);
        rendered.current = key;
        length = r.seconds;
      }
      setBusy(null);
      await hornPlay(game);
      setPlaying({ from: performance.now() + (game ? 120 : 0), secs: length });
    } catch (e) { setMsg(String(e)); setBusy(null); }
  };
  const stop = () => { soundStop().catch(() => {}); setPlaying(null); };
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const step = () => {
      const t = (performance.now() - playing.from) / 1000;
      if (t > playing.secs) { setPlaying(null); return; }
      setNow(Math.max(0, t));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const range = useMemo(() => {
    if (!notes.length) return null;
    let lo = 127, hi = 0;
    for (const n of notes) { lo = Math.min(lo, n.key); hi = Math.max(hi, n.key); }
    return { lo: lo + transpose, hi: hi + transpose };
  }, [notes, transpose]);
  const shiftFromHorn = horn?.has && range ? (range.lo + range.hi) / 2 - horn.base : 0;

  return (
    <div className="horn">
      <div className="horn-head">
        <h1>Horn Music</h1>
        <p>Any MIDI song, played on the helicopter's horn - into voice chat, like a soundboard pad.</p>
      </div>

      <div className="horn-grid">
        <section className="vv-panel horn-inst">
          <h2><span className="horn-step">1</span> The horn</h2>
          {horn?.has && (
            <p className="horn-which">
              {horn.custom ? "Your own recording" : "The WARDOGS heli horn, built in"} · {horn.honks.length} honk{horn.honks.length === 1 ? "" : "s"}
              {horn.custom && <button className="ghost-btn" onClick={restore}>Back to the built-in horn</button>}
            </p>
          )}
          <div className="horn-honks">
            {horn?.has ? horn.honks.map((h, i) => (
              <button key={i} className="horn-honk" title="Hear this honk" onClick={() => hornHear(i).catch((e) => setMsg(String(e)))}>
                <span className="horn-honk-wave">{h.peaks.map((p, j) => <i key={j} style={{ height: `${Math.max(3, p * 100)}%` }} />)}</span>
                <small>{h.seconds.toFixed(2)} s</small>
              </button>
            )) : <em>No horn yet</em>}
          </div>
          <p className="hint">Each note uses the honk closest to its length; click one to hear it.</p>
          {horn?.has && (
            <div className="horn-row">
              <span className="horn-pitch" title="The note the horn sounds at: songs are shifted from here">
                Horn sounds at <b>{withCents(horn.base)}</b>
                {horn.detected !== null && Math.abs(horn.detected - horn.base) > 0.01 && <small> (heard {withCents(horn.detected)})</small>}
              </span>
              <button className="ghost-btn" onClick={() => tune(horn.base - 1)} title="If songs come out a semitone sharp">−1</button>
              <button className="ghost-btn" onClick={() => tune(horn.base + 1)} title="If songs come out a semitone flat">+1</button>
              {horn.detected !== null && Math.abs(horn.detected - horn.base) > 0.01 && (
                <button className="ghost-btn" onClick={() => tune(horn.detected!)}>Reset</button>
              )}
            </div>
          )}
          <details className="horn-own">
            <summary>Record your own horn</summary>
            <p className="hint">
              In a helicopter, press Record and honk several times, short to long, with a pause between. It records what
              your PC plays, so keep music and voice chat quiet. Or pick a recording - a video works too (its sound).
            </p>
            <div className="horn-row">
              <button className={`horn-rec ${recording !== null ? "on" : ""}`} disabled={recording !== null} onClick={record}>
                <i />{recording !== null ? (recording > 0 ? `Honk now! ${recording}` : "Finishing…") : "Record"}
              </button>
              <select value={secs} onChange={(e) => setSecs(Number(e.target.value))} disabled={recording !== null}>
                {[5, 10, 15, 20].map((s) => <option key={s} value={s}>{s} seconds</option>)}
              </select>
              <label className="ghost-btn horn-file">
                Use a file…
                <input type="file" accept="audio/*,video/mp4,.wav,.mp3,.ogg,.flac,.m4a,.mp4" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </div>
          </details>
        </section>

        <section className="vv-panel horn-song">
          <h2><span className="horn-step">2</span> The song</h2>
          <div className="horn-row horn-songs">
            {HORN_SONGS.map((s, i) => (
              <button key={s.name} className={`horn-songbtn ${songName === s.name ? "on" : ""}`} onClick={() => pickBuiltin(i)}>
                <b>{s.name}</b><small>{s.from}</small>
              </button>
            ))}
          </div>
          <div className="horn-row">
            <label className="add-btn horn-file big">
              Import MIDI…
              <input type="file" accept=".mid,.midi,audio/midi" onChange={(e) => { openMidi(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {song && <b className="horn-title">{songName}</b>}
            {song && <span className="muted">{clock(song.seconds)} · {song.notes.length} notes</span>}
          </div>
          {song && (
            <>
              <div className="horn-tracks">
                {song.tracks.map((t, i) => (
                  <label key={t.index} className={`horn-track ${on.has(t.index) ? "on" : ""}`} style={{ ["--c" as string]: TRACK_COLOURS[i % TRACK_COLOURS.length] }}>
                    <input type="checkbox" checked={on.has(t.index)} onChange={() => toggle(t.index)} />
                    <i />
                    <span className="horn-track-name">{t.name}</span>
                    <small>{t.drums ? "drums" : `${noteName(t.low)}–${noteName(t.high)}`} · {t.notes}</small>
                  </label>
                ))}
              </div>
              <div className="horn-row">
                <span>Transpose</span>
                <button className="ghost-btn" onClick={() => setTranspose((t) => t - 12)}>−8ve</button>
                <button className="ghost-btn" onClick={() => setTranspose((t) => t - 1)}>−1</button>
                <b className="horn-num">{transpose > 0 ? `+${transpose}` : transpose}</b>
                <button className="ghost-btn" onClick={() => setTranspose((t) => t + 1)}>+1</button>
                <button className="ghost-btn" onClick={() => setTranspose((t) => t + 12)}>+8ve</button>
                <span className="horn-gap" />
                <span>Speed</span>
                <input type="range" min={50} max={200} step={5} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
                <b className="horn-num">{speed}%</b>
              </div>
              {range && horn?.has && Math.abs(shiftFromHorn) > 18 && (
                <p className="hint warn">
                  This part sits {Math.round(Math.abs(shiftFromHorn))} semitones {shiftFromHorn > 0 ? "above" : "below"} the horn - it'll sound
                  {shiftFromHorn > 0 ? " like a chipmunk" : " like a tanker"}. Try {shiftFromHorn > 0 ? "−8ve" : "+8ve"}.
                </p>
              )}
            </>
          )}
          <PianoRoll notes={notes} song={song} transpose={transpose} speed={speed / 100} now={playing ? now : null} />
        </section>

        <section className="vv-panel horn-play">
          <h2><span className="horn-step">3</span> Play it</h2>
          <div className="horn-row">
            <button className="horn-go" disabled={!horn?.has || !notes.length || !!busy} onClick={() => play(true)}>
              ▶ Play into the game
            </button>
            <button className="ghost-btn" disabled={!horn?.has || !notes.length || !!busy} onClick={() => play(false)}>🎧 Only me</button>
            <button className="ghost-btn" onClick={stop}>■ Stop</button>
            <label className="check" title="One ordinary honk and a pause first, so it starts out sounding like someone just honking">
              <input type="checkbox" checked={intro} onChange={(e) => setIntro(e.target.checked)} /> Start with a normal honk
            </label>
            {busy && <span className="muted">{busy}</span>}
            {playing && <span className="horn-now">{clock(now)} / {clock(playing.secs)}</span>}
          </div>
          <p className="hint">
            Into the game it holds your push-to-talk (Caps Lock) for the whole song, through VB-CABLE - the same way as
            the soundboard. The stop button on the stick stops it too.
            {!horn?.has && " There is no horn yet."}
            {horn?.has && !song && " Now import a MIDI file."}
          </p>
          {msg && <p className="hint warn">{msg}</p>}
        </section>
      </div>
    </div>
  );
}

/** The selected notes over time, a colour per track, with the playhead. */
function PianoRoll({ notes, song, transpose, speed, now }: { notes: HornNote[]; song: HornSong | null; transpose: number; speed: number; now: number | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const w = (c.width = c.clientWidth * devicePixelRatio);
    const h = (c.height = c.clientHeight * devicePixelRatio);
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, w, h);
    if (!notes.length || !song) return;
    let lo = 127, hi = 0;
    for (const n of notes) { lo = Math.min(lo, n.key); hi = Math.max(hi, n.key); }
    lo -= 2; hi += 2;
    const total = song.seconds / speed;
    const x = (t: number) => (t / speed / total) * w;
    const rowH = h / (hi - lo + 1);
    // octave lines at every C
    g.strokeStyle = "#ffffff12";
    for (let k = lo; k <= hi; k++) {
      if (((k + transpose) % 12 + 12) % 12 === 0) {
        const y = h - (k - lo + 1) * rowH;
        g.beginPath(); g.moveTo(0, y + rowH); g.lineTo(w, y + rowH); g.stroke();
      }
    }
    const index = new Map(song.tracks.map((t, i) => [t.index, i]));
    for (const n of notes) {
      g.fillStyle = TRACK_COLOURS[(index.get(n.track) ?? 0) % TRACK_COLOURS.length];
      g.globalAlpha = 0.45 + 0.55 * (n.vel / 127);
      g.fillRect(x(n.t), h - (n.key - lo + 1) * rowH, Math.max(1.5, x(n.t + n.d) - x(n.t) - 1), Math.max(1.5, rowH - 1));
    }
    g.globalAlpha = 1;
    if (now !== null) {
      const px = (now / total) * w;
      g.fillStyle = "#ffffff";
      g.fillRect(px, 0, 2 * devicePixelRatio, h);
    }
  }, [notes, song, transpose, speed, now]);
  return (
    <div className="horn-roll">
      <canvas ref={ref} />
      {!notes.length && <em>{song ? "No tracks picked" : "The song shows here"}</em>}
    </div>
  );
}
