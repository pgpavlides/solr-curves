import type { Metadata } from "next";
import DocShell from "@/components/DocShell";
import { ogCard } from "@/lib/og";
import {
  books,
  bookCount,
  bookUrl,
  coverUrl,
  readableSize,
  totalPages,
} from "@/data/books";

export const metadata: Metadata = {
  title: "Books — broccolipilot",
  description:
    "The rotary-wing library: the FAA Helicopter Flying Handbook, the Robinson R22 and R44 flight manuals, ICAO radiotelephony and more — the real manuals, free to read.",
  openGraph: ogCard("guides", "The broccolipilot reference library"),
  twitter: ogCard("guides", "The broccolipilot reference library"),
};

/*
  The library.

  Covers are real first pages, rendered by scripts/make-book-covers.mjs, not
  stock imagery — a shelf of actual documents. Each one links straight to the
  PDF on books.wardogspilot.com; they are far too large to be site assets.

  The size is printed next to every link on purpose. One of these is 171 MB,
  and a reader on a phone deserves to know that before tapping it.
*/
export default function Books() {
  return (
    <DocShell wide crumb={{ href: "/", label: "Home" }}>
      <header className="doc-head">
        <span className="doc-eyebrow">Books</span>
        <h1>The real manuals.</h1>
        <p className="doc-lede">
          WARDOGS models a helicopter, and helicopters have a century of
          literature behind them. These are the actual documents — the FAA
          handbook the whole subject rests on, two flight manuals for aircraft
          you could go and fly tomorrow, and the radio discipline that goes with
          them. None of it mentions the game. All of it explains it.
        </p>
        <p className="doc-count">
          {bookCount} books · {totalPages.toLocaleString()} pages · free to read
        </p>
      </header>

      <ul className="book-grid">
        {books.map((b, i) => (
          <li key={b.key} className="book-item">
            <a className="book-card" href={bookUrl(b)} target="_blank" rel="noopener">
              <span className="book-cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl(b)}
                  alt={`Cover of ${b.title}`}
                  loading={i < 4 ? "eager" : "lazy"}
                  width={620}
                  height={800}
                />
              </span>
              <span className="book-body">
                <span className="book-pub">{b.publisher}</span>
                <span className="book-title">{b.title}</span>
                {b.designation && (
                  <span className="book-desig">{b.designation}</span>
                )}
                <span className="book-sum">{b.blurb}</span>
                <span className="book-foot">
                  <span className="chip">{b.pages} pages</span>
                  <span className="chip">{readableSize(b.bytes)}</span>
                  {b.year && <span className="chip">{b.year}</span>}
                  {b.rights === "public-domain" && (
                    <span className="chip is-open">Public domain</span>
                  )}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <aside className="callout spaced">
        <span className="callout-label">Where these come from</span>
        <p>
          The two FAA handbooks are works of the United States government and
          carry no copyright — they are yours already. The rest remain the
          property of the people who published them and are mirrored here so a
          pilot can find them in one place. If you are one of those publishers
          and would rather they were not, say so and they come down the same
          day.
        </p>
      </aside>
    </DocShell>
  );
}
