"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { GROUPS, termId, type Group, type Term } from "@/data/glossary";
import type { Control } from "@/data/controls";

/*
  The terminology page, made findable.

  Thirty definitions in a single column is six thousand pixels of scrolling and
  no way to answer the only question anyone brings to a glossary: "what does
  this one word mean?" So the list filters as you type, and every term has its
  own anchor so a word can be linked to directly.

  This is a client component, but it still renders on the server with the full,
  unfiltered list — the definitions are in the HTML for crawlers and for anyone
  who arrives at /terminology/#crab before the JS lands.
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

export default function TermExplorer({
  controls,
  terms,
}: {
  controls: Control[];
  terms: Term[];
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<Group | null>(null);
  const input = useRef<HTMLInputElement>(null);

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

  /*
    Re-run the jump once the webfonts are in. The browser scrolls to the hash
    against fallback-font metrics, and on a narrow screen the reflow when Inter
    and Space Grotesk land moves the target far enough that it ends up off
    screen — measured at 390px wide, /terminology/#crab finished 220px above
    the viewport. scrollIntoView honours the scroll-margin-top set in doc.css,
    so this lands it under the bars rather than behind them.
  */
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const settle = () => document.getElementById(id)?.scrollIntoView();
    document.fonts?.ready.then(settle).catch(() => {});
  }, []);

  // `terms` arrives already deduplicated against the controls — see
  // `listedTerms` in data/glossary.ts for why, and so that the count in the
  // page header and the count in this toolbar are derived from one list.
  const shownTerms = useMemo(
    () =>
      terms.filter(
        (t) =>
          (!group || t.group === group) &&
          matches([t.term, plain(t.def), plain(t.note ?? "")], q)
      ),
    [terms, q, group]
  );

  /*
    The four controls are a group of their own in the filter model even though
    they are rendered long-form rather than as definitions — otherwise typing
    "collective" would hide the fullest explanation of it on the page.
  */
  const controlsMatch = !group || group === "The controls";
  const shownControls = useMemo(
    () =>
      controlsMatch
        ? controls.filter((c) =>
            matches(
              [c.name, c.tag, ...c.real.map(plain), plain(c.inGame)],
              q
            )
          )
        : [],
    [controls, q, controlsMatch]
  );

  const filtering = q.trim() !== "" || group !== null;
  const total = shownControls.length + shownTerms.length;
  const all = controls.length + terms.length;
  const groupsInUse = GROUPS.filter(
    (g) => g === "The controls" || terms.some((t) => t.group === g)
  );

  return (
    <>
      <div className="term-bar">
        <div className="field term-search">
          <div className="input-wrap">
            <span className="term-search-icon" aria-hidden="true">
              <Icon name="search" size={16} />
            </span>
            <input
              ref={input}
              className="input"
              type="search"
              value={q}
              placeholder="Search the terminology…"
              aria-label="Search the terminology"
              onChange={(e) => setQ(e.target.value)}
            />
            <kbd className="term-search-key" aria-hidden="true">
              /
            </kbd>
          </div>
        </div>

        <div className="term-chips" role="group" aria-label="Filter by group">
          <button
            type="button"
            className={`tab${group === null ? " is-active" : ""}`}
            onClick={() => setGroup(null)}
          >
            All
          </button>
          {groupsInUse.map((g) => (
            <button
              key={g}
              type="button"
              className={`tab${group === g ? " is-active" : ""}`}
              aria-pressed={group === g}
              onClick={() => setGroup((cur) => (cur === g ? null : g))}
            >
              {g}
            </button>
          ))}
        </div>

        <p className="term-count" aria-live="polite">
          {filtering ? `${total} of ${all} shown` : `${all} terms`}
        </p>
      </div>

      {total === 0 && (
        <p className="term-empty">
          Nothing matches <strong>{q.trim()}</strong>
          {group ? ` in ${group}` : ""}.{" "}
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              setQ("");
              setGroup(null);
            }}
          >
            Clear the filter
          </button>
        </p>
      )}

      {/* The four controls get the long form; everything else is a definition. */}
      {shownControls.length > 0 && (
        <section className="doc-section" id="controls">
          <h2>The four controls</h2>
          <p className="doc-p">
            A helicopter has one engine driving one rotor, and four ways to
            point the force it makes. Every other word on this page is really a
            statement about one of them.
          </p>
          <dl className="defs controls-list">
            {shownControls.map((c) => (
              <div key={c.name} id={termId(c.name)}>
                <dt>
                  <a className="term-anchor" href={`#${termId(c.name)}`}>
                    {c.name}
                    <span className="term-hash" aria-hidden="true">
                      #
                    </span>
                  </a>
                  <span className="tag">{c.tag}</span>
                </dt>
                <dd>
                  {c.real.map((p, i) => (
                    <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
                  ))}
                  <p className="ingame">
                    <b>In WARDOGS:</b>{" "}
                    <span dangerouslySetInnerHTML={{ __html: c.inGame }} />
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {GROUPS.map((g) => {
        /*
          "The controls" is deliberately skipped here: collective, cyclic and
          yaw are covered at full length in the section above, and printing
          them twice on one page is how a reference stops being trusted.
        */
        if (g === "The controls") return null;
        const inGroup = shownTerms.filter((t) => t.group === g);
        if (!inGroup.length) return null;
        return (
          <section
            key={g}
            className="doc-section"
            id={g.toLowerCase().replace(/\s+/g, "-")}
          >
            <h2>{g}</h2>
            <dl className="term-grid">
              {inGroup.map((t) => (
                <div key={t.term} className="term-item" id={termId(t.term)}>
                  <dt>
                    <a className="term-anchor" href={`#${termId(t.term)}`}>
                      {t.term}
                      <span className="term-hash" aria-hidden="true">
                        #
                      </span>
                    </a>
                  </dt>
                  <dd>
                    <span dangerouslySetInnerHTML={{ __html: t.def }} />
                    {t.note && (
                      <span
                        className="term-note"
                        dangerouslySetInnerHTML={{ __html: t.note }}
                      />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </>
  );
}
