/*
  The reference library.

  Real rotary-wing manuals, not write-ups. Every field below was read off the
  file itself rather than off its filename: the titles and publishers come from
  page one rendered in a browser, the page counts from pdf.js, the byte counts
  from disk. Two of the files were named after documents they were not.

  The PDFs are 252 MB and are not in this repo. They live in the R2 bucket
  `wardogspilot-books` behind books.broccolipilot.com — Cloudflare Pages refuses
  any asset over 25 MB and the Helicopter Flying Handbook alone is 171 MB.
  Upload with scripts/upload-books.mjs, covers with scripts/make-book-covers.mjs.
  R2 answers range requests, so opening page one of the big handbook does not
  drag the whole file down first.

  `rights` is not decoration. The two FAA handbooks are works of the United
  States government and carry no copyright. The rest are somebody's
  publication, hosted here as a convenience, and the page says so under each
  one. If a publisher would rather they were not, they come out — which is why
  removing one is a single line here and a delete in the bucket.
*/

export const BOOKS_BASE = "https://books.broccolipilot.com";

export interface Book {
  /** the object key in the bucket, and the cover filename, without extension */
  key: string;
  title: string;
  /** the document's own subtitle or designation, when it has one */
  designation?: string;
  publisher: string;
  /** the year printed on the document, when it states one */
  year?: string;
  pages: number;
  bytes: number;
  /** why a WARDOGS pilot would open it */
  blurb: string;
  rights: "public-domain" | "publisher";
}

export const books: Book[] = [
  {
    key: "helicopter-flying-handbook-2019pdf",
    title: "Helicopter Flying Handbook",
    designation: "FAA-H-8083-21B",
    publisher: "Federal Aviation Administration",
    year: "2019",
    pages: 203,
    bytes: 179110571,
    blurb:
      "The book everything else on this site is downstream of. Aerodynamics, the four controls, every basic maneuver and every way they go wrong — written for people who will be held responsible for getting it right.",
    rights: "public-domain",
  },
  {
    key: "faa-rotorcraft-flying-handbook-2000",
    title: "Rotorcraft Flying Handbook",
    publisher: "Federal Aviation Administration",
    year: "2000",
    pages: 207,
    bytes: 17522159,
    blurb:
      "The 2019 handbook's predecessor, and a tenth of the size. It covers gyroplanes as well as helicopters, and its illustrations of the rotor system are the clearest of the two.",
    rights: "public-domain",
  },
  {
    key: "pre-flight-briefing",
    title: "Pre-Flight Briefing (Helicopters)",
    designation: "Student Pilot's Work Book",
    publisher: "Pooleys Air Presentations",
    pages: 116,
    bytes: 58738338,
    blurb:
      "What an instructor says to a student before each lesson, written down: one briefing per exercise, in the order a real syllabus teaches them. The closest thing here to being taught rather than told.",
    rights: "publisher",
  },
  {
    key: "r22-poh-full-book",
    title: "R22 Pilot's Operating Handbook",
    designation: "RTR 061 · FAA-approved Rotorcraft Flight Manual",
    publisher: "Robinson Helicopter Company",
    pages: 200,
    bytes: 1392883,
    blurb:
      "An actual flight manual for an actual aircraft — limits, weight and balance, performance charts, and the emergency procedures in the order you would need them. This is what the numbers look like when they are binding.",
    rights: "publisher",
  },
  {
    key: "r44-1-poh-full-book",
    title: "R44 Pilot's Operating Handbook",
    designation: "RTR 461 · FAA-approved Rotorcraft Flight Manual",
    publisher: "Robinson Helicopter Company",
    pages: 248,
    bytes: 1829645,
    blurb:
      "The same document for the bigger Robinson. Read alongside the R22's and the differences tell you what more power and more mass actually change about flying the thing.",
    rights: "publisher",
  },
  {
    key: "icao-doc-9432-manual-of-radiotelephony-4th-ed-2007",
    title: "Manual of Radiotelephony",
    designation: "Doc 9432 AN/925 · fourth edition",
    publisher: "International Civil Aviation Organization",
    year: "2007",
    pages: 102,
    bytes: 2351350,
    blurb:
      "How aircraft talk on the radio, and why it is phrased that way: standard phraseology, the phonetic alphabet, and the discipline of saying only what is needed. Directly useful to anyone flying with a crew.",
    rights: "publisher",
  },
  {
    key: "fly-neighborly-guide",
    title: "Fly Neighborly Guide",
    publisher: "Helicopter Association International",
    pages: 36,
    bytes: 1375974,
    blurb:
      "A short guide to where a helicopter's noise comes from and how a pilot changes it — blade-vortex interaction, approach angles, and why the sound of an aircraft depends on how it is flown.",
    rights: "publisher",
  },
  {
    key: "r22-external-check-presentation",
    title: "R22 External Check",
    publisher: "Dekelia Aero Club",
    year: "2012",
    pages: 16,
    bytes: 2251420,
    blurb:
      "A photographic walk-around of an R22: every item on the pre-flight inspection, in order, shown on the aircraft rather than described. Sixteen pages, and the fastest of these to read.",
    rights: "publisher",
  },
];

/** The download URL for a book. */
export const bookUrl = (b: Book) => `${BOOKS_BASE}/${b.key}.pdf`;

/** The cover image, a build artifact in public/books/. */
export const coverUrl = (b: Book) => `/books/${b.key}.jpg`;

/** A size a reader can act on — these range from 1 MB to 171 MB. */
export const readableSize = (bytes: number) => {
  const mb = bytes / 1048576;
  return mb >= 100 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
};

export const bookCount = books.length;
export const totalBytes = books.reduce((n, b) => n + b.bytes, 0);
export const totalPages = books.reduce((n, b) => n + b.pages, 0);
