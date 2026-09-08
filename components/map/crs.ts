import L from "leaflet";
import type { Bounds } from "./types";

/*
  The coordinate system is not geographic. It is a flat game-unit grid where
  `lat` is Y and `lng` is X, already in Leaflet's [lat, lng] order.

  Leaflet's CRS.Simple scales by 2^z, and the tile pyramid is 2^z x 2^z tiles
  of 256px, so at z=0 the whole world is one 256px tile. The transformation
  therefore has to map the world square onto 0..256 CRS units:

      x = (lng - minX) * k              0..256, left to right
      y = (minY + span - lat) * k       0..256, top to bottom

  The negative Y scale is what makes north up: game Y increases upward, screen
  Y increases downward. Flip the sign of the third argument and the map renders
  vertically mirrored.
*/
export function makeCRS(bounds: Bounds) {
  const { minX, minY, span } = bounds;
  const k = 256 / span;
  return L.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(k, -minX * k, -k, (minY + span) * k),
  });
}

/** The world square, for maxBounds and fitBounds. */
export function worldBounds(bounds: Bounds): L.LatLngBoundsExpression {
  const { minX, minY, span } = bounds;
  return L.latLngBounds(
    L.latLng(minY, minX),
    L.latLng(minY + span, minX + span)
  );
}
