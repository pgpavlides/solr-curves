/*
  The ONE place the design system enters the app.
  globals.css @imports styles/system.css; nothing else imports either file.
*/
import "../styles/globals.css";
import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  metadataBase: new URL("https://wardogspilot.com"),
  title: {
    default: "wardogspilot — WARDOGS helicopter reference",
    template: "%s — wardogspilot",
  },
  description:
    "Every helicopter control, setting, keybind and number in WARDOGS, compiled from the community's own tutorials.",
  openGraph: {
    type: "website",
    siteName: "wardogspilot",
    url: "https://wardogspilot.com",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <div className="page">
          <SiteNav />
          <main id="main">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
