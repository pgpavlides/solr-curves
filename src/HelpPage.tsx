import { useEffect, useState } from "react";
import { type GameBindings, type SoundStatus, type TargetStatus, fixGameBindings, gameBindings, openUrl, soundStatus, targetStatus } from "./bridge";
import type { Pads } from "./gamepad";
import type { Sync } from "./TargetPanel";
import type { VoiceConfig } from "./voice";

/*
  Help: how to set WARDOGS up so it reads the curves and the macros - the stick
  and the throttle both go through the T.A.R.G.E.T. script, which hands the
  game ONE device, "Thrustmaster Combined". A live check at the top says what
  is right on this machine right now.
*/

interface Props {
  sync: Sync;
  pads: Pads;
  cfg: VoiceConfig;
}

const AXES_TABLE: [string, string, string, string][] = [
  ["Roll", "Stick left / right", "X", "0"],
  ["Pitch", "Stick forward / back", "Y", "1"],
  ["Throttle", "Throttle lever", "Z", "2"],
  ["Look left / right", "Stick mini-stick left / right", "X rotation", "3"],
  ["Look up / down", "Stick mini-stick up / down", "Y rotation", "4"],
  ["Yaw", "Stick twist", "Z rotation", "5"],
  ["(free)", "Throttle thumbwheel", "Throttle", "6"],
  ["(free)", "Throttle twist", "Slider", "7"],
];

const BUTTONS_TABLE: [string, string][] = [
  ["Stick buttons", "1 - 44"],
  ["Stick hat", "POV"],
  ["Throttle buttons 1 - 6", "45 - 50"],
  ["Throttle hat 1 (up, right, down, left)", "51 - 54"],
  ["Throttle hat 2 (up, right, down, left)", "55 - 58"],
  ["Throttle 8-way hat (up, right, down, left)", "59 - 62"],
];

/*
  Everything the app needs, with where to get it. Checked on the official
  pages in September 2026 - the Thrustmaster pages always carry the newest
  drivers and T.A.R.G.E.T., so they are linked rather than one .exe.
*/
interface Need {
  name: string;
  what: string;
  version?: string;
  links: [string, string][];
  /** true / false when the app can tell, null when it can't */
  have: boolean | null;
  haveText?: string;
}

const SOLR_STICK_PAGE = "https://support.thrustmaster.com/en/product/sol-r-1-flightstick-en/";
const SOLR_THROTTLE_PAGE = "https://support.thrustmaster.com/en/product/sol-r-6-throttle-en/";

function Install({ n }: { n: Need }) {
  return (
    <div className={`hp-need ${n.have === null ? "" : n.have ? "ok" : "bad"}`}>
      <i />
      <div className="hp-need-body">
        <b>{n.name}{n.version && <small>{n.version}</small>}</b>
        <span>{n.what}</span>
        {n.haveText && <em>{n.haveText}</em>}
      </div>
      <div className="hp-need-links">
        {n.links.map(([label, url]) => (
          <button key={url} className={n.have === false ? "add-btn" : "ghost-btn"} title={url} onClick={() => openUrl(url).catch(() => {})}>
            {label} ↗
          </button>
        ))}
      </div>
    </div>
  );
}

function Check({ ok, label, detail, children }: { ok: boolean | null; label: string; detail: string; children?: React.ReactNode }) {
  return (
    <div className={`hp-check ${ok === null ? "" : ok ? "ok" : "bad"}`}>
      <i />
      <div>
        <b>{label}</b>
        <span>{detail}</span>
        {children}
      </div>
    </div>
  );
}

export default function HelpPage({ sync, pads, cfg }: Props) {
  const [game, setGame] = useState<GameBindings | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  const [target, setTarget] = useState<TargetStatus | null>(null);
  const [sound, setSound] = useState<SoundStatus | null>(null);
  useEffect(() => {
    targetStatus().then(setTarget).catch(() => {});
    soundStatus().then(setSound).catch(() => {});
  }, []);
  const load = () => gameBindings().then(setGame).catch(() => setGame(null));
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const live = sync === "live";
  const onPhysical = game?.physical ?? [];

  const needs: Need[] = [
    {
      name: "Thrustmaster drivers", version: "package 2026_TFHT_2",
      what: "The Sol-R's own drivers and firmware. Install first, with the stick and throttle plugged in; it also updates their firmware.",
      links: [["Sol-R 1 Flightstick", SOLR_STICK_PAGE], ["Sol-R 6 Throttle", SOLR_THROTTLE_PAGE]],
      have: pads.stick || pads.throttle ? true : null,
      haveText: pads.stick || pads.throttle ? "Installed - the devices answer" : undefined,
    },
    {
      name: "T.A.R.G.E.T.", version: "3.0.26.303 (3.0.25.603 or later for the throttle)",
      what: "Thrustmaster's scripting software: it runs the curve script and makes Thrustmaster Combined. Under Software on the same Thrustmaster pages.",
      links: [["Download page", SOLR_STICK_PAGE]],
      have: target ? target.available : null,
      haveText: target ? (target.available ? "Installed" : "Not installed") : undefined,
    },
    {
      name: "VB-CABLE Virtual Audio Device", version: "free",
      what: "The virtual microphone the sounds play into. Unzip, run VBCABLE_Setup_x64.exe as administrator, then restart Windows.",
      links: [["vb-audio.com", "https://vb-audio.com/Cable/"]],
      have: sound ? !!sound.cable : null,
      haveText: sound ? (sound.cable ? `Installed - ${sound.cable}` : "Not found") : undefined,
    },
    {
      name: "Microsoft Edge WebView2 Runtime",
      what: "Draws this window. Windows 11 already has it - only needed on a Windows 10 PC where the app won't open.",
      links: [["Microsoft", "https://developer.microsoft.com/en-us/microsoft-edge/webview2"]],
      have: true, haveText: "Installed - you're looking at it",
    },
    {
      name: "WARDOGS",
      what: "The game, on Steam.",
      links: [["Steam", "https://store.steampowered.com/app/1867240/WARDOGS/"]],
      have: game ? game.found : null,
      haveText: game ? (game.found ? "Installed - its settings were found" : "Settings not found - start it once") : undefined,
    },
  ];

  return (
    <div className="help">
      <div className="help-inner">
        <h1>Setting up WARDOGS</h1>
        <p className="lead">
          Sol-R Curves runs a T.A.R.G.E.T. script that takes over both the stick and the throttle, shapes them with your
          curves, and hands the game <b>one device: Thrustmaster Combined</b>. Everything in WARDOGS has to be bound to
          that device - never to "Sol-R [R] Flightstick" or "Sol-R 6 Throttle".
        </p>

        <section className="help-card">
          <h2>What to install</h2>
          <p className="hint" style={{ marginTop: 0 }}>In this order. The buttons open the official download pages in your browser.</p>
          {needs.map((n) => <Install key={n.name} n={n} />)}
        </section>

        <section className="help-card">
          <h2>Your setup right now</h2>
          <Check ok={live} label="The T.A.R.G.E.T. script" detail={live ? "Running - the curves are live" : "Not running - start it from the badge at the top right (or the Script page)"} />
          <Check ok={!!pads.stick} label="Sol-R [R] Flightstick" detail={pads.stick ? "Connected" : "Not found - check its USB cable"} />
          <Check ok={!!pads.throttle} label="Sol-R 6 Throttle" detail={pads.throttle ? "Connected" : "Not found - check its USB cable, then Restart from the tray"} />
          <Check ok={!!pads.combined} label="Thrustmaster Combined" detail={pads.combined ? "The game can see it" : "Missing - it only exists while the script runs"} />
          <Check
            ok={game ? onPhysical.length === 0 : null}
            label="WARDOGS bindings"
            detail={
              !game ? "Checking..." : !game.found ? "WARDOGS settings not found - start the game once" :
              onPhysical.length === 0 ? "All on Thrustmaster Combined" :
              `${onPhysical.length} bound to the physical devices, so they skip the script: ${onPhysical.join(", ")}`
            }
          >
            {game && onPhysical.length > 0 && (
              <button className="add-btn" disabled={game.running || fixing === "busy"}
                onClick={() => { setFixing("busy"); fixGameBindings().then((n) => setFixing(`Moved ${n} to Thrustmaster Combined (backup kept)`)).catch((e) => setFixing(String(e))).finally(load); }}>
                {game.running ? "Close WARDOGS to fix" : "Move them to Thrustmaster Combined"}
              </button>
            )}
            {fixing && fixing !== "busy" && <em>{fixing}</em>}
          </Check>
        </section>

        <section className="help-card">
          <h2>1 · Start in the right order</h2>
          <ol>
            <li><b>Plug in the stick and the throttle</b> before starting the app.</li>
            <li><b>Start Sol-R Curves.</b> It starts the T.A.R.G.E.T. script itself - no T.A.R.G.E.T. window needed.</li>
            <li><b>Then start WARDOGS.</b> The game has to find Thrustmaster Combined already there.</li>
            <li>Closing the app's window only puts it in the tray - the stick keeps working. Quit from the tray when you're done.</li>
          </ol>
        </section>

        <section className="help-card">
          <h2>2 · Bind the axes</h2>
          <p>In WARDOGS: <b>Settings → Controls</b>. Click an action, then move the control. The game should name <b>Thrustmaster Combined</b>.</p>
          <table className="help-table">
            <thead><tr><th>WARDOGS action</th><th>What you move</th><th>Combined axis</th><th>#</th></tr></thead>
            <tbody>
              {AXES_TABLE.map(([a, m, x, n]) => <tr key={a + m}><td>{a}</td><td>{m}</td><td>{x}</td><td>{n}</td></tr>)}
            </tbody>
          </table>
          <p className="hint">
            The throttle usually needs <b>Invert</b> ticked in the game (full forward = full power). The curves themselves are set in this app, on the Curves page - leave the game's own
            sensitivity and deadzone at their defaults.
          </p>
        </section>

        <section className="help-card">
          <h2>3 · Bind the buttons</h2>
          <p>Same way: click an action, press the button. These are the numbers Thrustmaster Combined gives each one:</p>
          <table className="help-table">
            <thead><tr><th>Button</th><th>Combined number</th></tr></thead>
            <tbody>
              {BUTTONS_TABLE.map(([b, n]) => <tr key={b}><td>{b}</td><td>{n}</td></tr>)}
            </tbody>
          </table>
          <p className="hint">The Devices page shows each stick button's number as you press it. WARDOGS counts from 0 in its settings file, so button 45 is stored as 44 - just press the button while binding and the game gets it right.</p>
        </section>

        <section className="help-card">
          <h2>Throttle banks</h2>
          <ul>
            <li>The throttle has <b>its own banks</b>, separate from the stick's knob. Its buttons (45 and up) do what the throttle bank says; the stick's buttons follow the knob.</li>
            <li><b>Hold throttle button 48 for 3 seconds</b> for the previous bank, <b>49</b> for the next. A short press is still an ordinary button - bind it in the game or give it a macro (the macro goes off when you let go).</li>
            <li>One LED on the stick <b>blinks in the throttle bank's colour</b>. Pick which on the Macros page, under Sound and stick settings → LED mapping.</li>
            <li>On the Macros page, switch to <b>Throttle</b>: its tabs are the throttle's banks, and clicking one puts the throttle on it.</li>
          </ul>
        </section>

        <section className="help-card">
          <h2>4 · Voice and push-to-talk</h2>
          <ul>
            <li>In WARDOGS, set voice chat to <b>push-to-talk on Caps Lock</b> and the microphone to <b>CABLE Output (VB-Audio Virtual Cable)</b>.</li>
            <li>Sounds on the Macros page hold Caps Lock for you while they play, so the game transmits them.</li>
            <li>{cfg.stopButton ? <>Stick button {cfg.stopButton} stops whatever is playing (change it on the Macros page).</> : <>No stop button is set - pick one on the Macros page.</>}</li>
            <li>Stick buttons {cfg.wheelUp ?? 37} and {cfg.wheelDown ?? 38} are the mouse wheel, up and down, in every bank - hold one to keep scrolling (change them on the Macros page).</li>
            <li>Stick buttons {cfg.arrowUp ?? 32}, {cfg.arrowRight ?? 33}, {cfg.arrowDown ?? 34} and {cfg.arrowLeft ?? 31} are the arrow keys - up, right, down, left - in every bank, held for as long as you hold the button.</li>
            <li>Throttle buttons {cfg.throttleArrowUp ?? 51}, {cfg.throttleArrowRight ?? 52}, {cfg.throttleArrowDown ?? 53} and {cfg.throttleArrowLeft ?? 54} are the arrow keys too - up, right, down, left - in every throttle bank.</li>
          </ul>
        </section>

        <section className="help-card">
          <h2>If something isn't working</h2>
          <dl className="help-faq">
            <dt>A control does nothing in the game, or ignores the curves</dt>
            <dd>It's bound to a physical device. The check at the top shows which, and moves them for you (close WARDOGS first).</dd>
            <dt>"Thrustmaster service stopped"</dt>
            <dd>Click the red badge at the top right, start the service and approve the Windows prompt. The script starts again by itself.</dd>
            <dt>The throttle isn't found</dt>
            <dd>Unplug it and plug it back in, then Restart from the tray. T.A.R.G.E.T. needs version 3.0.25.603 or later for the Sol-R 6 Throttle.</dd>
            <dt>The in-game overlay doesn't show</dt>
            <dd>Run WARDOGS in windowed fullscreen (borderless); exclusive fullscreen hides every other window.</dd>
            <dt>Keys from a macro go to the wrong window</dt>
            <dd>Macros type into whatever window is in front - click into the game first.</dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
