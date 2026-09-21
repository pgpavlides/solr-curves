import { useEffect, useState } from "react";
import { type Device, deviceSetDeadzone, deviceSetHidEnabled, deviceSetLed, devicesList, targetStatus } from "./bridge";

/*
  Every Thrustmaster USB device, as T.A.R.G.E.T.'s service sees it, and the
  hardware switches it exposes. Reading is free; anything that changes the
  device happens only on a click here, and "Hide from games" asks twice.

  Functions a device doesn't support come back as errors from the DLL, and
  show as "not supported" instead of a control. (The Sol-R has no LED or
  hardware-deadzone functions here; its LEDs are driven from scripts.)
*/

export default function DevicesView() {
  const [devs, setDevs] = useState<Device[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // while a script runs, T.A.R.G.E.T. itself hides the device it scripts from
  // Windows (disabled, code 22) - the DLL's "HID enabled" flag doesn't show that
  const [scriptRunning, setScriptRunning] = useState(false);
  useEffect(() => { targetStatus().then((s) => setScriptRunning(!!s?.running)).catch(() => {}); }, []);

  const load = () => devicesList().then((d) => { setDevs(d); setErr(null); }).catch((e) => setErr(String(e)));
  useEffect(() => { load(); }, []);

  // f may return its own message (e.g. "restart needed"), which wins over `done`
  const act = async (f: () => Promise<string | void>, done: string) => {
    try { setNote((await f()) || done); } catch (e) { setNote(String(e)); }
    setConfirm(null);
    load();
  };

  return (
    <div className="devices-view">
      <div className="dv-head">
        <div>
          <h2>Devices</h2>
          <p className="hint">Thrustmaster USB devices, read through T.A.R.G.E.T.'s service. Changes happen only when you click.</p>
        </div>
        <button className="ghost-btn" onClick={load}>Refresh</button>
      </div>
      {err && <p className="hint warn">{err}</p>}
      {note && <p className="dv-note">{note}</p>}
      <div className="dv-grid">
        {devs?.map((d) => {
          // the flightstick and the Sol-R 6 Throttle both go through the curve
          // script; hiding anything else takes it out of games completely
          const scripted = /PID_(0422|0447)/i.test(d.hardware_id ?? "");
          const what = /PID_0447/i.test(d.hardware_id ?? "") ? "the throttle" : "the stick";
          // a picture of it, rendered from T.A.R.G.E.T.'s own model (.testdata/snapdevices.mjs)
          const pic = /PID_0447/i.test(d.hardware_id ?? "") ? "/devices/solr_throttle.png" : /PID_0422/i.test(d.hardware_id ?? "") ? "/devices/solr_stick.png" : null;
          const byScript = scripted && scriptRunning;
          const hidden = d.hid_enabled === false || byScript;
          return (
            <div key={d.serial} className="dv-card">
              <div className="dv-title">
                <b>{d.oem_name ?? d.name ?? `Device ${d.serial}`}</b>
                <span className={`tag ${hidden && !byScript ? "warn" : ""}`}>{byScript ? "✓ working through the script" : hidden ? "hidden from games" : "visible to games"}</span>
              </div>
              {pic && <div className="dv-pic"><img src={pic} alt="" draggable={false} /></div>}
              <dl>
                <dt>Hardware ID</dt><dd>{d.hardware_id ?? "—"}</dd>
                <dt>Instance</dt><dd>{d.instance_id ?? "—"}</dd>
                <dt>Service serial</dt><dd>{d.serial}</dd>
                <dt>Firmware</dt><dd>{d.firmware_version ? `${d.firmware_version}${d.firmware_serial ? ` · ${d.firmware_serial}` : ""}` : <em>not reported</em>}</dd>
                <dt>T.A.R.G.E.T. filter</dt><dd>{d.filtered === null ? "—" : d.filtered ? "installed (scriptable)" : "not installed"}</dd>
                <dt>LEDs</dt>
                <dd>
                  {d.led_intensity === null ? <em>not supported by this device</em> : (
                    <span className="dv-inline">
                      <input type="range" min={0} max={5} step={1} defaultValue={d.led_intensity}
                        onPointerUp={(e) => act(() => deviceSetLed(d.serial, d.led_flags ?? 0, Number((e.target as HTMLInputElement).value)), "LED brightness set")} />
                      {d.led_intensity}
                    </span>
                  )}
                </dd>
                <dt>Hardware deadzone</dt>
                <dd>
                  {d.deadzone_on === null ? <em>not supported by this device</em> : (
                    <label className="check">
                      <input type="checkbox" checked={d.deadzone_on}
                        onChange={(e) => act(() => deviceSetDeadzone(d.serial, e.target.checked), `Hardware deadzone ${e.target.checked ? "on" : "off"}`)} />
                      {d.deadzone_on ? "on" : "off"}
                    </label>
                  )}
                </dd>
              </dl>

              {byScript ? (
                <div className="dv-hide">
                  <div>
                    <b>Working: the game gets {what} through your curves</b>
                    <p className="hint">
                      While the script runs, T.A.R.G.E.T. passes {what} to the game as Thrustmaster Combined, with your curves
                      on it. That's why the game doesn't list the {what === "the throttle" ? "throttle" : "stick"} by its own name any more -
                      bind everything to Thrustmaster Combined. It shows up under its own name again when the script stops.
                    </p>
                  </div>
                </div>
              ) : (
              <div className="dv-hide">
                <div>
                  <b>{hidden ? "Hidden from games" : "Visible to games"}</b>
                  {!scripted && !hidden && (
                    <p className="hint warn">
                      Not handled by the curve script: hiding this one removes it from games entirely (T.A.R.G.E.T. can't pass it through).
                    </p>
                  )}
                  <p className="hint">
                    {hidden
                      ? "Games can't see this device directly; T.A.R.G.E.T. still reads it and games get Thrustmaster Combined."
                      : "Games can bind this device directly, which bypasses your curves. Hiding it leaves only Thrustmaster Combined."}
                    {" "}Reversible here. Windows may ask for a restart.
                  </p>
                </div>
                {confirm === d.serial ? (
                  <div className="dv-confirm">
                    <button className="stop-btn" onClick={() => act(async () => {
                      const reboot = await deviceSetHidEnabled(d.serial, hidden);
                      if (reboot) return "Done - Windows needs a restart for this to take effect.";
                    }, hidden ? "Visible to games again" : "Hidden from games")}>
                      {hidden ? "Yes, show it" : "Yes, hide it"}
                    </button>
                    <button className="ghost-btn" onClick={() => setConfirm(null)}>Cancel</button>
                  </div>
                ) : (
                  <button className="ghost-btn" onClick={() => setConfirm(d.serial)} disabled={d.hid_enabled === null}>
                    {hidden ? "Show to games" : "Hide from games"}
                  </button>
                )}
              </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
