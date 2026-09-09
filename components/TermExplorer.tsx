"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { usedGroups, type Entry, type Group } from "@/data/glossary";

/*
  The terminology page, on one screen.

  It used to be a single column: every definition end to end, six thousand
  pixels of scrolling, and the answer to "what does this one word mean?"
  somewhere in the middle of it. Now the page never scrolls: cards pick a
  section, a list picks a word, and the definition sits beside it — three panes
  inside one viewport, and only the two inner panes move.

  Two things survive from the old page and are worth keeping in mind before
  changing anything here:

  1. EVERY definition is in the HTML, always. Only the selected one is visible,
     but the rest are rendered and hidden rather than left unmounted, so a
     crawler and anyone landing on /terminology/#crab before the JS runs still
     get the words. Do not swap this for conditional rendering.

  2. Every entry keeps its own anchor. Selecting one rewrites the hash with
     replaceState, so a link to a word can still be copied out of the address
     bar and still lands on it.
*/

/** Definitions carry markup, so match against the text with the tags removed. */
const plain = (html: string) => html.replace(/<[^>]*>/g, " ");

function matches(hay: string[], q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const text = hay.join(" ").toLowerCase();
  // every word must appear somewhere, so "lift vector" and "vector lift" agree
  return needle.split(/\s+/).every((w) => text.includes(w));
}

const haystack = (e: Entry) => [
  e.name,
  e.tag ?? "",
  ...e.body.map(plain),
  plain(e.note ?? ""),
  plain(e.inGame ?? ""),
];

export default function TermExplorer({ entries }: { entries: Entry[] }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<Group>(usedGroups[0]);
  const [id, setId] = useState(entries[0].id);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(
    () => entries.filter((e) => matches(haystack(e), q)),
    [entries, q]
  );

  /*
    A search looks across every section, because the whole point of typing is
    that you do not know which section the word is in. Without a search the
    list is just the selected section.
  */
  const searching = q.trim() !== "";
  const list = useMemo(
    () => (searching ? hits : entries.filter((e) => e.group === group)),
    [searching, hits, entries, group]
  );

  const counts = useMemo(() => {
    const m = new Map<Group, number>();
    for (const g of usedGroups) m.set(g, 0);
    for (const e of hits) m.set(e.group, (m.get(e.group) ?? 0) + 1);
    return m;
  }, [hits]);

  const select = useCallback((next: string) => {
    setId(next);
    // replaceState, not a hash assignment: assigning would scroll the pane
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${next}`);
    }
  }, []);

  const pickGroup = useCallback(
    (g: Group) => {
      setGroup(g);
      setQ("");
      const first = entries.find((e) => e.group === g);
      if (first) select(first.id);
    },
    [entries, select]
  );

  // Keep the selection inside whatever the list currently shows.
  useEffect(() => {
    if (list.length && !list.some((e) => e.id === id)) select(list[0].id);
  }, [list, id, select]);

  /*
    Deep link: /terminology/#crab opens on that word, in its section.

    On `hashchange` as well as on mount. Without the listener the hash only
    worked on a cold load — pasting /terminology/#crab into the bar of a page
    that was already open changed the URL and nothing else, because a hash is a
    same-document navigation and the mount effect never ran again.
  */
  useEffect(() => {
    const fromHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      const hit = entries.find((e) => e.id === hash);
      if (!hit) return;
      setGroup(hit.group);
      setId(hit.id);
      setQ(""); // a linked word must be visible, and a stale search would hide it
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [entries]);

  // "/" jumps to the search the way it does in every other reference tool.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        input.current?.focus();
      } else if (e.key === "Escape" && typing) {
        setQ("");
        input.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Arrow keys walk the list, from the list or from the search box. */
  const step = useCallback(
    (delta: number) => {
      const i = list.findIndex((e) => e.id === id);
      const next = list[Math.min(Math.max(i + delta, 0), list.length - 1)];
      if (next && next.id !== id) {
        select(next.id);
        listRef.current
          ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(next.id)}"]`)
          ?.scrollIntoView({ block: "nearest" });
      }
    },
    [list, id, select]
  );

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      step(e.key === "ArrowDown" ? 1 : -1);
    }
  };

  const active = entries.find((e) => e.id === id) ?? entries[0];

  return (
    <div className="tm-body">
      <div className="tm-top">
        <div className="field tm-search">
          <div className="input-wrap">
            <span className="tm-search-icon" aria-hidden="true">
              <Icon name="search" size={16} />
            </span>
            <input
              ref={input}
              className="input"
              type="search"
              value={q}
              placeholder="Search every word…"
              aria-label="Search the terminology"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onListKey}
            />
            <kbd className="tm-search-key" aria-hidden="true">
              /
            </kbd>
          </div>
        </div>
        <p className="tm-count" aria-live="polite">
          {searching ? `${hits.length} of ${entries.length}` : `${entries.length} terms`}
        </p>
      </div>

      {/* The sections. Small cards, and the whole point of the layout. */}
      <div className="tm-cards" role="tablist" aria-label="Sections">
        {usedGroups.map((g) => {
          const n = counts.get(g) ?? 0;
          return (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={!searching && g === group}
              className={`tm-card${!searching && g === group ? " is-active" : ""}${
                searching && n === 0 ? " is-empty" : ""
              }`}
              onClick={() => pickGroup(g)}
            >
              <span className="tm-card-name">{g}</span>
              <span className="tm-card-n">
                {searching ? `${n} match${n === 1 ? "" : "es"}` : `${entries.filter((e) => e.group === g).length} terms`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="tm-panes">
        <div
          className="tm-list"
          ref={listRef}
          role="listbox"
          tabIndex={0}
          aria-label={searching ? "Search results" : group}
          onKeyDown={onListKey}
        >
          {list.length === 0 && (
            <p className="tm-empty">
              Nothing matches <strong>{q.trim()}</strong>.
            </p>
          )}
          {list.map((e) => (
            <button
              key={e.id}
              type="button"
              role="option"
              data-id={e.id}
              aria-selected={e.id === id}
              className={`tm-item${e.id === id ? " is-active" : ""}`}
              onClick={() => select(e.id)}
            >
              <span className="tm-item-name">{e.name}</span>
              {searching && <span className="tm-item-group">{e.group}</span>}
            </button>
          ))}
        </div>

        {/*
          Every definition is rendered; all but one are hidden. See the note at
          the top of this file — this is what keeps the page readable without
          JavaScript and indexable by anything that does not run it.
        */}
        <div className="tm-detail">
          {entries.map((e) => (
            <article
              key={e.id}
              id={e.id}
              className="tm-def"
              hidden={e.id !== active.id}
            >
              <header className="tm-def-head">
                <span className="tm-def-group">{e.group}</span>
                <h2>{e.name}</h2>
                {e.tag && <span className="tag">{e.tag}</span>}
              </header>
              <div className="tm-def-body">
                {e.body.map((p, i) => (
                  <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
                ))}
                {e.inGame && (
                  <p className="tm-ingame">
                    <b>In WARDOGS:</b>{" "}
                    <span dangerouslySetInnerHTML={{ __html: e.inGame }} />
                  </p>
                )}
                {e.note && (
                  <p
                    className="tm-note"
                    dangerouslySetInnerHTML={{ __html: e.note }}
                  />
                )}
              </div>
              <a className="tm-def-link" href={`#${e.id}`}>
                /terminology/#{e.id}
              </a>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
