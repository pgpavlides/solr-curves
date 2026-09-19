# Sol-R Curves (SOLR_BRC)

Desktop app (Tauri 2 + Rust + React) for live-tuning the Thrustmaster Sol-R [R]
Flightstick curves in WARDOGS through T.A.R.G.E.T.

## Use

- Install: `src-tauri/target/release/bundle/nsis/Sol-R Curves_1.0.0_x64-setup.exe`,
  or run `start.cmd` (built exe if present, else the dev build).
- Order when playing: T.A.R.G.E.T. script `E:\hotas_wardogs_solr.tmc` -> WARDOGS.
  The app can be opened and closed at any time.

The app writes `E:\hotas_curves.txt` (3 x 257-sample lookup tables: roll, pitch, yaw,
plus a dated log line). The script re-reads it every 250 ms, prints the log line in
the Script Editor console and answers in `E:\hotas_curves.ack`, which the app shows
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
- Browser tests, against a second server so they never touch E:\
  (`set SOLR_DIR=.testdata/ && npx vite --port 5179`): `node scripts/e2e.mjs`,
  `node scripts/addpoint.mjs`, `node scripts/layout.mjs`
