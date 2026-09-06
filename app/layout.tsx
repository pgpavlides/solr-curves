/*
  The ONE place the design system enters the app.
  globals.css @imports styles/system.css; nothing else imports either file.
*/
import "../styles/globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://wardogspilot.com"),
  title: "wardogspilot — WARDOGS helicopter flight simulator",
  description:
    "An interactive WARDOGS helicopter guide: seven maneuvers flown in 3D with the pilot's collective, cyclic and pedal inputs shown live, plus the full controls, keybind and logistics reference.",
  openGraph: {
    type: "website",
    siteName: "wardogspilot",
    url: "https://wardogspilot.com",
    title: "wardogspilot — WARDOGS helicopter flight simulator",
    description:
      "Seven WARDOGS helicopter maneuvers flown in 3D with the pilot's inputs shown live.",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#1b1c22",
  width: "device-width",
  initialScale: 1,
  // The HUD sits in the corners; a zoomed viewport would push it off screen.
  maximumScale: 1,
  viewportFit: "cover",
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
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" as="fetch" href="/heli.glb" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
