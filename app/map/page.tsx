import type { Metadata } from "next";
import MapRedirect from "@/components/map/MapRedirect";
import { ogCard } from "@/lib/og";

export const metadata: Metadata = {
  title: "Maps — wardogspilot",
  description: "Interactive WARDOGS maps: Ozeti and Bakurani.",
  openGraph: ogCard("maps", "Interactive WARDOGS maps"),
  twitter: ogCard("maps", "Interactive WARDOGS maps"),
};

/*
  `redirect()` is not available under `output: "export"` — there is no server to
  issue a 302. This route is a real static page that bounces on the client and
  still gives a crawler (and anyone without JavaScript) a working link.
*/
export default function MapIndex() {
  return <MapRedirect />;
}
