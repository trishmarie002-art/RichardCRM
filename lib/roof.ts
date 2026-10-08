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

// Roof footprints are small enough to validate edge crossings in a local lat/lng plane.
export function validRoofOutline(points: {lat:number;lng:number}[]) {
 if(points.length<3||points.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||Math.abs(p.lat)>90||Math.abs(p.lng)>180))return false;
 if(new Set(points.map(p=>p.lat+","+p.lng)).size!==points.length)return false;
 const turn=(a:typeof points[number],b:typeof a,c:typeof a)=>(b.lng-a.lng)*(c.lat-a.lat)-(b.lat-a.lat)*(c.lng-a.lng);
 const onSegment=(a:typeof points[number],b:typeof a,c:typeof a)=>turn(a,b,c)===0&&c.lng>=Math.min(a.lng,b.lng)&&c.lng<=Math.max(a.lng,b.lng)&&c.lat>=Math.min(a.lat,b.lat)&&c.lat<=Math.max(a.lat,b.lat);
 const crosses=(a:typeof points[number],b:typeof a,c:typeof a,d:typeof a)=>turn(a,b,c)*turn(a,b,d)<0&&turn(c,d,a)*turn(c,d,b)<0||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){if(j===i+1||(i===0&&j===points.length-1))continue;if(crosses(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return false;}
 const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+(p.lng-points[0].lng)*(q.lat-points[0].lat)-(q.lng-points[0].lng)*(p.lat-points[0].lat);},0);
 return Math.abs(area)>1e-14;
}
