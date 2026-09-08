"use client";

/** The key list, opened with ? and closed with ? or Escape. */
const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: "Map",
    keys: [
      ["↑ ↓ ← →", "Pan — hold Shift to go further"],
      ["+ / −", "Zoom in and out"],
      ["0", "Back to the starting view"],
      ["M", "Switch map"],
      ["L", "Layer panel"],
    ],
  },
  {
    title: "Drawing",
    keys: [
      ["D", "Pen on and off"],
      ["P / C / S", "Freehand, circle, square"],
      ["E", "Eraser — click a line to remove it"],
      ["1 … 6", "Colour"],
      ["[ / ]", "Thinner, thicker"],
      ["Ctrl+Z", "Undo"],
      ["Ctrl+Shift+Z", "Redo"],
    ],
  },
  {
    title: "Anywhere",
    keys: [
      ["?", "This list"],
      ["Esc", "Close what is open"],
    ],
  },
];

export default function Shortcuts({ onClose }: { onClose: () => void }) {
  return (
    <div className="wm-keys" role="dialog" aria-label="Keyboard shortcuts">
      <div className="wm-keys-head">
        <span className="wm-panel-title">Keyboard</span>
        <button
          type="button"
          className="wm-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="wm-keys-body">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="wm-group-title">{g.title}</h3>
            <dl className="wm-keys-list">
              {g.keys.map(([k, what]) => (
                <div key={k}>
                  <dt>
                    <kbd>{k}</kbd>
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
