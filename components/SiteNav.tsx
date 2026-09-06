"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

const links = [
  { href: "/controls/", label: "Controls" },
  { href: "/settings/", label: "Settings" },
  { href: "/keybinds/", label: "Keybinds" },
  { href: "/flying/", label: "Flying" },
  { href: "/logistics/", label: "Logistics" },
  { href: "/fleet/", label: "Fleet" },
  { href: "/glossary/", label: "Glossary" },
  { href: "/videos/", label: "Videos" },
];

export default function SiteNav() {
  const path = usePathname();

  return (
    <nav className="nav" aria-label="Primary">
      <Link className="brand" href="/">
        <span className="brand-mark">
          <Icon name="helicopter" size={14} />
        </span>
        wardogspilot
      </Link>

      <div className="nav-links">
        {links.map((l) => (
          <Link
            key={l.href}
            className="nav-link"
            href={l.href}
            aria-current={path === l.href ? "page" : undefined}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
