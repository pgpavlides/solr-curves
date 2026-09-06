import type { Block } from "@/data/guides";

/** Renders a guide's content blocks with the design system's own pieces. */
export default function GuideBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "p":
            return (
              <p key={i} className="doc-p" dangerouslySetInnerHTML={{ __html: b.html }} />
            );
          case "list":
            return (
              <ul key={i} className="doc-list">
                {b.items.map((it, j) => (
                  <li key={j} dangerouslySetInnerHTML={{ __html: it }} />
                ))}
              </ul>
            );
          case "steps":
            return (
              <ol key={i} className="steps">
                {b.items.map((s) => (
                  <li key={s.title}>
                    <div>
                      <b>{s.title}</b>
                      <span>{s.detail}</span>
                    </div>
                  </li>
                ))}
              </ol>
            );
          case "callout":
            return (
              <aside key={i} className={`callout${b.critical ? " is-critical" : ""}`}>
                <span className="callout-label">{b.label}</span>
                <p dangerouslySetInnerHTML={{ __html: b.html }} />
              </aside>
            );
          case "table":
            return (
              <div key={i} className="table-wrap">
                {b.caption && <span className="table-caption">{b.caption}</span>}
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {b.head.map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {b.rows.map((r, j) => (
                        <tr key={j}>
                          {r.map((c, k) => (
                            <td key={k} dangerouslySetInnerHTML={{ __html: c }} />
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
        }
      })}
    </>
  );
}
