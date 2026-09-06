import App from "@/components/App";
import { maneuvers } from "@/data/maneuvers";
import { glossary } from "@/data/glossary";

/*
  The page is the application. The only server-rendered markup is the <noscript>
  block below: the experience is WebGL/WebGPU and cannot be prerendered, so
  crawlers and anyone without scripts get the substance as plain text rather
  than an empty shell.
*/
export default function Page() {
  return (
    <>
      <App />
      <noscript>
        <div style={{ padding: "32px 24px", maxWidth: 760, margin: "0 auto" }}>
          <h1>wardogspilot — WARDOGS helicopter reference</h1>
          <p>
            The interactive simulator needs JavaScript and WebGL. The reference
            material it contains is summarised here.
          </p>
          <h2>Maneuvers</h2>
          <ul>
            {maneuvers.map((m) => (
              <li key={m.id}>
                <b>{m.name}</b> — {m.blurb}
              </li>
            ))}
          </ul>
          <h2>Terminology</h2>
          <dl>
            {glossary.map((g) => (
              <div key={g.term}>
                <dt>
                  <b>{g.term}</b>
                </dt>
                <dd dangerouslySetInnerHTML={{ __html: g.def }} />
              </div>
            ))}
          </dl>
        </div>
      </noscript>
    </>
  );
}
