import { useEffect, useMemo, useRef, useState } from "react";
import {
  type CompileResult, type ScriptFile, type TargetLogLine,
  onEvent, scriptCompile, scriptDelete, scriptRead, scriptWrite, scriptsList, targetLog, targetStart, targetStop,
} from "./bridge";

/*
  Write and run any T.A.R.G.E.T. script, inside the app.

  Scripts are .tmc files next to the curve files. Compile / Run / Stop go to
  Thrustmaster's own service (target.rs), exactly like the Script Editor.
  The service holds ONE script: running one of these replaces the curve
  script until you run that again ("Back to curves"). A Check restores
  whatever was running on its own.

  The curve script itself is built into the app: open it to read, duplicate
  it to change it.
*/

const TEMPLATE = `include "target.tmh"

// Runs in Thrustmaster's service. Everything in target.tmh is available:
// MapAxis, SetSCurve, MapKey, EXEC, CHAIN, LED control, printf ...

int main()
{
\tif(Init(&EventHandle)) return 1;

\tprintf("my script is running\\xa");
}

int EventHandle(int type, alias o, int x)
{
\tDefaultMapping(&o, x);
}
`;

/**
  The service reports "; expected in E:/x.tmc at line 6" (the Interpreter's
  own format is "Compile error: <msg>, in <file>, at line N"). Both -> parts.
*/
function parseError(e: string) {
  const m = e.match(/^(?:compile error:\s*)?(.*?),?\s+in\s+(.+?),?\s+at line\s+(\d+)/i);
  return m ? { msg: m[1].trim() || "error", file: m[2], line: Number(m[3]) } : { msg: e, file: "", line: null as number | null };
}

export default function ScriptView({ curveScript }: { curveScript: string }) {
  const [files, setFiles] = useState<ScriptFile[]>([]);
  const [name, setName] = useState<string>(() => { try { return localStorage.getItem("solr:script") ?? curveScript; } catch { return curveScript; } });
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");
  const [result, setResult] = useState<CompileResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newName, setNewName] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [symTab, setSymTab] = useState<"functions" | "variables" | "defines">("functions");
  const [symFilter, setSymFilter] = useState("");
  const [log, setLog] = useState<TargetLogLine[]>([]);
  const area = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const logEnd = useRef<HTMLDivElement>(null);

  const file = files.find((f) => f.name === name);
  const builtin = !!file?.builtin || name === curveScript;
  const dirty = text !== saved;

  const refresh = () => scriptsList().then(setFiles).catch((e) => setMsg(String(e)));
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    try { localStorage.setItem("solr:script", name); } catch { /* not remembered */ }
    scriptRead(name).then((t) => { setText(t); setSaved(t); setResult(null); }).catch(() => { setName(curveScript); });
  }, [name]);

  useEffect(() => {
    targetLog().then(setLog).catch(() => {});
    return onEvent<TargetLogLine>("solr:target-log", (l) => setLog((x) => [...x.slice(-599), l]));
  }, []);
  useEffect(() => { logEnd.current?.scrollIntoView({ block: "end" }); }, [log.length]);

  const errors = useMemo(() => (result?.errors ?? []).map(parseError), [result]);
  const errLines = new Set(errors.filter((e) => e.line && (!e.file || e.file.toLowerCase().endsWith(name.toLowerCase()))).map((e) => e.line));
  const lineCount = text.split("\n").length;

  const save = async () => {
    if (builtin) return;
    await scriptWrite(name, text);
    setSaved(text);
    refresh();
  };
  const compile = async (run: boolean) => {
    setBusy(run ? "Running…" : "Checking…");
    setMsg(null);
    try {
      if (dirty && !builtin) await save();
      const r = await scriptCompile(name, run);
      setResult(r);
      setMsg(r.ok ? (run ? `Running ${name}` : "Compiles cleanly") : `${r.errors.length} error${r.errors.length > 1 ? "s" : ""}`);
      if (!r.ok) setTimeout(() => jumpTo(parseError(r.errors[0] ?? "").line), 0);
    } catch (e) {
      setMsg(String(e));
    }
    setBusy(null);
  };
  const stop = async () => { setBusy("Stopping…"); try { await targetStop(); setMsg("Stopped"); } catch (e) { setMsg(String(e)); } setBusy(null); };
  const backToCurves = async () => { setBusy("Starting curves…"); try { await targetStart(); setMsg("Curve script running"); } catch (e) { setMsg(String(e)); } setBusy(null); };

  const jumpTo = (line: number | null) => {
    const a = area.current;
    if (!a || !line) return;
    const lines = a.value.split("\n");
    const start = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
    a.focus();
    a.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
    const lh = parseFloat(getComputedStyle(a).lineHeight) || 18;
    a.scrollTop = Math.max(0, (line - 5) * lh);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); return; }
    if (e.key === "Tab" && !builtin) {
      e.preventDefault();
      const a = e.currentTarget, s = a.selectionStart, en = a.selectionEnd;
      const next = text.slice(0, s) + "\t" + text.slice(en);
      setText(next);
      requestAnimationFrame(() => a.setSelectionRange(s + 1, s + 1));
    }
  };

  const create = async (base: string, content: string) => {
    let n = base.trim().replace(/[^\w\- .]/g, "_");
    if (!n) return;
    if (!/\.(tmc|tmh)$/i.test(n)) n += ".tmc";
    if (files.some((f) => f.name.toLowerCase() === n.toLowerCase())) { setMsg(`${n} already exists`); return; }
    await scriptWrite(n, content);
    await refresh();
    setName(n);
    setNewName(null);
  };
  const duplicate = () => create(name.replace(/\.(tmc|tmh)$/i, "") + "_copy", text);
  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); return; }
    await scriptDelete(name);
    setConfirmDel(false);
    await refresh();
    setName(curveScript);
  };

  const symbols = (result?.[symTab] ?? []).filter((s) => s.toLowerCase().includes(symFilter.toLowerCase()));

  return (
    <div className="script-view">
      <aside className="sv-side">
        <div className="sv-head">
          <h2>Scripts</h2>
          <button className="add-btn" onClick={() => setNewName("")}>+ New</button>
        </div>
        {newName !== null && (
          <div className="sv-new">
            <input autoFocus placeholder="name.tmc" value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") create(newName, TEMPLATE); if (e.key === "Escape") setNewName(null); }} />
            <button className="ghost-btn" onClick={() => create(newName, TEMPLATE)}>Create</button>
          </div>
        )}
        <div className="sv-files">
          {files.map((f) => (
            <button key={f.name} className={`sv-file ${f.name === name ? "on" : ""}`}
              onClick={() => { if (!dirty || confirm("Discard unsaved changes?")) setName(f.name); }}>
              <span>{f.name}</span>
              {f.builtin && <em>curves · built-in</em>}
            </button>
          ))}
        </div>

        <div className="sv-sym">
          <div className="sv-symtabs">
            {(["functions", "variables", "defines"] as const).map((t) => (
              <button key={t} className={symTab === t ? "on" : ""} onClick={() => setSymTab(t)}>
                {t} {result ? <small>{result[t].length}</small> : null}
              </button>
            ))}
          </div>
          <input placeholder={result ? "filter…" : "Check the script to list its symbols"} value={symFilter} onChange={(e) => setSymFilter(e.target.value)} disabled={!result} />
          <div className="sv-symlist">
            {symbols.slice(0, 400).map((s) => <div key={s}>{s}</div>)}
          </div>
        </div>
      </aside>

      <section className="sv-main">
        <div className="sv-toolbar">
          <div className="sv-title">
            <b>{name}</b>{dirty && <i className="dirty" title="unsaved">●</i>}
            {builtin && <span className="tag">read-only · built into the app</span>}
          </div>
          <div className="sv-actions">
            {builtin ? <button className="ghost-btn" onClick={duplicate}>Duplicate to edit</button> : (
              <>
                <button className="ghost-btn" onClick={save} disabled={!dirty}>Save <kbd>Ctrl S</kbd></button>
                <button className="ghost-btn" onClick={duplicate}>Duplicate</button>
                <button className={`ghost-btn ${confirmDel ? "danger" : ""}`} onClick={remove}>{confirmDel ? "Delete?" : "Delete"}</button>
              </>
            )}
            <span className="sep" />
            <button className="ghost-btn" onClick={() => compile(false)} disabled={!!busy} title="Compile only. The script that was running is restarted afterwards">Check</button>
            <button className="add-btn" onClick={() => compile(true)} disabled={!!busy}
              title={builtin ? "Run the curve script" : "Runs this script INSTEAD of the curve script"}>Run</button>
            <button className="stop-btn" onClick={stop} disabled={!!busy}>Stop</button>
            {!builtin && <button className="ghost-btn" onClick={backToCurves} disabled={!!busy} title="Run the built-in curve script again">Back to curves</button>}
          </div>
        </div>
        {(busy || msg) && <div className={`sv-msg ${result && !result.ok ? "bad" : ""}`}>{busy ?? msg}</div>}
        {errors.length > 0 && (
          <div className="sv-errors">
            {errors.map((e, i) => (
              <button key={i} onClick={() => jumpTo(e.line)} disabled={!e.line}>
                {e.line ? <b>line {e.line}</b> : null} {e.msg}{e.file && !e.file.toLowerCase().endsWith(name.toLowerCase()) ? ` (in ${e.file})` : ""}
              </button>
            ))}
          </div>
        )}
        <div className="sv-editor">
          <div className="sv-gutter" ref={gutter} aria-hidden="true">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className={errLines.has(i + 1) ? "err" : ""}>{i + 1}</div>
            ))}
          </div>
          <textarea
            ref={area}
            value={text}
            readOnly={builtin}
            spellCheck={false}
            wrap="off"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; }}
          />
        </div>
        <div className="sv-console">
          {log.slice(-300).map((l, i) => <div key={i} className={`log-${l.kind}`}>{l.text}</div>)}
          <div ref={logEnd} />
        </div>
      </section>
    </div>
  );
}
