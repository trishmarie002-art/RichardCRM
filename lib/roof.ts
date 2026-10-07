export type RoofEdge = {
  id: string;
  kind: "ridge" | "hip" | "valley" | "eave" | "rake";
  horizontalFt: number;
  riseFt: number;
  points?: { lat: number; lng: number }[];
};
export function edgeLength(edge: RoofEdge) {
  return Math.hypot(edge.horizontalFt, edge.riseFt);
}
export function surfaceArea(footprint: number, pitch: number) {
  return footprint * Math.hypot(1, pitch / 12);
}
