# Sol-R Curves (SOLR_BRC)

Desktop app (Tauri 2 + Rust + React) for live-tuning the Thrustmaster Sol-R [R]
Flightstick curves in WARDOGS through T.A.R.G.E.T.

## Use

- Install: `src-tauri/target/release/bundle/nsis/Sol-R Curves_1.0.0_x64-setup.exe`,
  or run `start.cmd` (built exe if present, else the dev build).
- Everything lives in `C:\SolR` (curves, presets, styles, voice settings, scripts);
  it moved from `E:\` - on first start the app copies what is there (E:\ is left as is).
- Order when playing: Sol-R Curves -> WARDOGS. That's all: the app compiles and runs the
  T.A.R.G.E.T. script itself (no Script Editor, keep it closed) and stops it when it closes.
  It talks to Thrustmaster's own service through `TmServiceControl.dll`, with the Script
  Editor's call sequence (see `src-tauri/src/target.rs`). The script is built into the app
  and written to `C:\SolR\hotas_wardogs_solr.tmc` if the copy there differs (old one kept as .bak).
  Click the header badge for Start/Stop, auto-start and the script's console.

The app writes `C:\SolR\hotas_curves.txt` (3 x 257-sample lookup tables: roll, pitch, yaw,
plus a dated log line). The script re-reads it every 250 ms, prints the log line in
the Script Editor console and answers in `C:\SolR\hotas_curves.ack`, which the app shows
as **Live in T.A.R.G.E.T.** No restart of the script or the game.
`SOLR_DIR` overrides the folder.

## Develop

- `npm run dev` - Tauri window with hot reload
- `npm run build` - release exe + NSIS installer
- `npm run web` - the same UI in a browser (file writes go through the Vite
  middleware in `vite.config.ts` instead of Rust; `src/bridge.ts` picks)
- `target/` - the T.A.R.G.E.T. scripts (`hotas_wardogs_solr.v1_scurve.tmc` is the
  fixed-curve fallback that needs no app)

## Checks

- `npm run check` - curve maths = T.A.R.G.E.T.'s fcurve; split sides; migration
- `npm run test:rust` - the Rust writer's file parses exactly like the script parses it
- Browser tests, against a second server so they never touch C:\SolR
  (`set SOLR_DIR=.testdata/ && npx vite --port 5179`): `node scripts/e2e.mjs`,
  `node scripts/addpoint.mjs`, `node scripts/layout.mjs`
