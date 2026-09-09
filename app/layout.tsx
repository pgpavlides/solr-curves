/*
  The ONE place the design system enters the app.
  globals.css @imports styles/system.css; nothing else imports either file.
*/
import "../styles/globals.css";
import type { Metadata, Viewport } from "next";
import { ogCard } from "@/lib/og";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = {
  metadataBase: new URL("https://broccolipilot.com"),
  title: "broccolipilot — the WARDOGS helicopter reference",
  description:
    "Everything for flying helicopters in WARDOGS: a 3D maneuver simulator, guides written up from the community's own videos, the creators behind them, and the terminology.",
  openGraph: {
    type: "website",
    siteName: "broccolipilot",
    url: "https://broccolipilot.com",
    title: "broccolipilot — the WARDOGS helicopter reference",
    description:
      "A 3D maneuver simulator, community guides with every author credited, and the terminology.",
    ...ogCard("default", "broccolipilot — the WARDOGS helicopter reference"),
  },
  twitter: {
    card: "summary_large_image",
    ...ogCard("default", "broccolipilot — the WARDOGS helicopter reference"),
  },
  icons: { icon: "/favicon.png" },
};

export const viewport: Viewport = {
  themeColor: "#f2efe6",
  width: "device-width",
  initialScale: 1,
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
      </head>
      <body>
        {/*
          Runs before anything paints. Without it a forest visitor gets one
          full frame of cream while the JS loads, which is the flash every
          theme toggle on the web is remembered for. It is inline and tiny for
          the same reason: a separate file would be another round trip.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('broccolipilot:theme');" +
              "if(t==='forest'||t==='paper')document.documentElement.dataset.theme=t;}catch(e){}",
          }}
        />
        {children}
        {/* sits above everything, inert until a navigation starts */}
        <PageTransition />
      </body>
    </html>
  );
}
