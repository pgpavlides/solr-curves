# Sol-R Curves (SOLR_BRC)

Live curve editor for the Thrustmaster Sol-R [R] Flightstick in WARDOGS.

- `start.cmd` (or `npm run dev` inside `SOLR_BRC`) opens the app on http://localhost:5178
- `target/hotas_wardogs_solr.tmc` is the T.A.R.G.E.T. script; the installed copy lives at `E:\hotas_wardogs_solr.tmc`

The app writes `E:\hotas_curves.txt` (3 × 257-sample lookup tables: roll, pitch, yaw).
The script re-reads it every 250 ms and answers in `E:\hotas_curves.ack`, which the
app shows as **Live in T.A.R.G.E.T.** No restart of the script or the game.

Order when playing: T.A.R.G.E.T. script → WARDOGS. The app can be opened any time.

Checks (run a second server so tests never touch the live E: files:
`set SOLR_DIR=.testdata/ && npx vite --port 5179`): `npm run check` (curve maths = T.A.R.G.E.T.'s fcurve),
`node scripts/e2e.mjs` (parses the table exactly like the script does), `node scripts/layout.mjs`
(no page scroll or clipped panel at 1080p, 900p, 768p, 720p).
