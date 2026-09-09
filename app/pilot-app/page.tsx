import type { Metadata } from "next";
import Link from "next/link";
import { ogCard } from "@/lib/og";

export const metadata: Metadata = {
  title: "Pilot App — broccolipilot",
  description:
    "A desktop companion for WARDOGS pilots. Under development — there is nothing to download yet.",
  openGraph: ogCard("pilot-app", "The broccolipilot desktop companion"),
  twitter: ogCard("pilot-app", "The broccolipilot desktop companion"),
};

/*
  A holding page, and nothing else.

  This used to describe the app's plan at length. Describing unbuilt software
  at length reads as a product page for something that does not exist, so it
  now says the one true thing. The only other element is the way back — a page
  with no exit is worse than a plain one.

  When there is a build worth handing out, this becomes the download page.
*/
export default function PilotApp() {
  return (
    <main className="soon">
      <p className="soon-word">Under development</p>
      <Link className="soon-back" href="/">
        broccolipilot
      </Link>
    </main>
  );
}
