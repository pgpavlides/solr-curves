import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import MapApp from "@/components/map/MapApp";
import { ogCard } from "@/lib/og";
import { MAP_IDS, type MapData, type MapId } from "@/components/map/types";

/*
  markers.json lives in public/ rather than being imported as a module: it is
  151 KB, and importing it would bake all of it into this route's JavaScript.
  Fetched at runtime it stays out of the bundle and gets cached by the browser
  like any other static asset.

  It is still read here at BUILD time, off the filesystem, so the static params
  and the page titles come from the same file the client will fetch. That read
  happens in Node during `next build` and ships nothing to the browser.
*/
function readData(): MapData {
  return JSON.parse(
    readFileSync(join(process.cwd(), "public", "markers.json"), "utf8")
  ) as MapData;
}

export function generateStaticParams() {
  return MAP_IDS.map((mapId) => ({ mapId }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mapId: string }>;
}): Promise<Metadata> {
  const { mapId } = await params;
  if (!(MAP_IDS as string[]).includes(mapId)) return { title: "Map — broccolipilot" };
  const data = readData();
  const game = data.maps[mapId as MapId];
  const alt = `Interactive WARDOGS map of ${game.displayName}`;
  return {
    title: `${game.displayName} map — broccolipilot`,
    description: `Interactive WARDOGS map of ${game.displayName}: ${game.zones.length} zones and ${game.markers.length} markers, with filterable layers and shareable views.`,
    openGraph: ogCard("maps", alt),
    twitter: ogCard("maps", alt),
  };
}

export default async function MapPage({
  params,
}: {
  params: Promise<{ mapId: string }>;
}) {
  const { mapId } = await params;
  if (!(MAP_IDS as string[]).includes(mapId)) notFound();
  return <MapApp mapId={mapId as MapId} />;
}
