import Link from "next/link";
import Logo from "./Logo";

/** Chrome for the reading pages: the mark, and a way back to the simulator. */
export default function DocShell({
  children,
  crumb,
  wide = false,
}: {
  children: React.ReactNode;
  crumb?: { href: string; label: string };
  /** Index and gallery pages want the width; prose pages want a reading measure. */
  wide?: boolean;
}) {
  return (
    <div className="doc">
      <header className="doc-bar">
        <Link className="doc-brand" href="/">
          <span className="logo-wrap">
            <Logo />
          </span>
          <span>
            <span className="brand-word">wardogspilot</span>
            <span className="brand-sub">Rotary flight guide</span>
          </span>
        </Link>
        <nav className="doc-bar-links">
          {crumb && (
            <Link className="btn btn-sm btn-ghost" href={crumb.href}>
              {crumb.label}
            </Link>
          )}
          <Link className="btn btn-sm btn-ghost" href="/videos/">
            Videos
          </Link>
          <Link className="btn btn-sm btn-ghost" href="/books/">
            Books
          </Link>
          <Link className="btn btn-sm btn-ghost" href="/map/ozeti/">
            Maps
          </Link>
          <Link className="btn btn-sm btn-ghost" href="/terminology/">
            Terminology
          </Link>
          <Link className="btn btn-sm" href="/simulator/">
            Open the simulator
          </Link>
        </nav>
      </header>
      <main className={`doc-main${wide ? " is-wide" : ""}`}>{children}</main>
      <footer className={`doc-foot${wide ? " is-wide" : ""}`}>
        <p>
          Guides are written up from the work of the creators credited on each
          page. Go and watch the originals — and subscribe to the people who made
          them.
        </p>
        <p>Unofficial. Not affiliated with the developer of WARDOGS.</p>
      </footer>
    </div>
  );
}
