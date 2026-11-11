"use client";
import { useRef, useState } from "react";
import { edgeLength, surfaceArea, type RoofEdge } from "@/lib/roof";
type GeoPoint={lat:number;lng:number};
type Section = { id:number; name:string; footprintSqFt:number; pitch:number;points?:GeoPoint[] };
const mapColors=["0xffdb58ff","0xff7b54ff","0x76e4f7ff","0xde83fcff","0x66e4a3ff","0xff9cdbff"];
const edgeColors={ridge:"0xef4444ff",hip:"0xf59e0bff",valley:"0xa855f7ff",eave:"0x22c55eff",rake:"0x38bdf8ff"};
function roofMapImage(sections:Section[],edges:RoofEdge[]){
 const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
 if(!key)return "";
 const paths:string[]=[];
 const located:GeoPoint[]=[];
 sections.forEach((section,index)=>{
  const points=(section.points||[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  if(points.length<3)return;
  const coords=[...points,points[0]].map(p=>p.lat.toFixed(7)+","+p.lng.toFixed(7));
  located.push(...points);
  paths.push("color:"+mapColors[index%mapColors.length]+"|weight:4|"+coords.join("|"));
 });
 edges.forEach(edge=>{
  const points=(edge.points||[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  if(points.length!==2)return;
  located.push(...points);
  paths.push("color:"+edgeColors[edge.kind]+"|weight:5|"+points.map(p=>p.lat.toFixed(7)+","+p.lng.toFixed(7)).join("|"));
 });
 if(!located.length)return "";
 // Center and zoom explicitly on the actual measured roof. Without center/zoom,
 // Static Maps auto-fits a broad area and roof annotations become tiny in the PDF.
 const minLat=Math.min(...located.map(p=>p.lat));
 const maxLat=Math.max(...located.map(p=>p.lat));
 const minLng=Math.min(...located.map(p=>p.lng));
 const maxLng=Math.max(...located.map(p=>p.lng));
 const centerLat=(minLat+maxLat)/2,centerLng=(minLng+maxLng)/2;
 const mercatorY=(lat:number)=>Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,lat))*Math.PI/360));
 const spanX=Math.max((maxLng-minLng)/360,1/10000000);
 const spanY=Math.max((mercatorY(maxLat)-mercatorY(minLat))/(2*Math.PI),1/10000000);
 // Keep all the roof geometry visible with room for the colored tracing lines.
 // 640x480 is the logical Maps API image size; scale=2 yields 1280x960 print pixels.
 const fitX=Math.log2((640*0.72)/(256*spanX));
 const fitY=Math.log2((480*0.72)/(256*spanY));
 const zoom=Math.max(18,Math.min(22,Math.floor(Math.min(fitX,fitY))));
 const url=new URL("https://maps.googleapis.com/maps/api/staticmap");
 url.searchParams.set("size","640x480");
 url.searchParams.set("scale","2");
 url.searchParams.set("center",centerLat.toFixed(7)+","+centerLng.toFixed(7));
 url.searchParams.set("zoom",String(zoom));
 url.searchParams.set("maptype","satellite");
 url.searchParams.set("format","png");
 url.searchParams.set("key",key);
 paths.forEach(path=>url.searchParams.append("path",path));
 return url.toString().length<8000?url.toString():"";
}
// Perspective illustration from traced roof plan coordinates and entered pitch.
// Facet peaks approximate visual roof volume, not surveyed elevations or ridge intersections.
function RoofPerspective({sections,edges}:{sections:Section[];edges:RoofEdge[]}){
 const facets=sections.filter(section=>(section.points||[]).length>=3);
 if(!facets.length)return null;
 const locations=facets.flatMap(section=>section.points||[]);
 const lat0=locations.reduce((sum,p)=>sum+p.lat,0)/locations.length;
 const lng0=locations.reduce((sum,p)=>sum+p.lng,0)/locations.length;
 const cosLat=Math.cos(lat0*Math.PI/180);
 const xy=(p:GeoPoint)=>({x:(p.lng-lng0)*364000*cosLat,y:(lat0-p.lat)*364000});
 const planPoints=locations.map(xy);
 const xmin=Math.min(...planPoints.map(p=>p.x)),xmax=Math.max(...planPoints.map(p=>p.x));
 const ymin=Math.min(...planPoints.map(p=>p.y)),ymax=Math.max(...planPoints.map(p=>p.y));
 const total=Math.max(12,xmax-xmin,ymax-ymin);
 const scale=Math.min(5.5,360/total);
 const project=(x:number,y:number,z:number)=>({x:360+(x-y)*.82*scale,y:226+(x+y)*.39*scale-z*.9*scale});
 const pts=(list:{x:number;y:number}[])=>list.map(p=>p.x.toFixed(1)+","+p.y.toFixed(1)).join(" ");
 const palette=[["#c0cbd6","#aabaca","#8fa4bb"],["#c9baa9","#b6a18f","#a48d79"],["#b6cbc5","#9cbdb2","#80a69a"],["#cec3d9","#b5a2c7","#9c8ab1"],["#dcc6ad","#c7af95","#af957c"]];
 const shapes=facets.map((facet,index)=>{
  const plan=facet.points!.map(xy);
  const mid={x:plan.reduce((sum,p)=>sum+p.x,0)/plan.length,y:plan.reduce((sum,p)=>sum+p.y,0)/plan.length};
  const w=Math.max(...plan.map(p=>p.x))-Math.min(...plan.map(p=>p.x));
  const h=Math.max(...plan.map(p=>p.y))-Math.min(...plan.map(p=>p.y));
  const rise=Math.min(20,Math.max(0,Math.min(w,h)*Math.min(Math.max(facet.pitch,0),12)/24));
  const top=plan.map(p=>project(p.x,p.y,0));
  const walls=plan.map(p=>project(p.x,p.y,-6));
  const peak=project(mid.x,mid.y,rise);
  return {facet,index,plan,mid,rise,top,walls,peak,depth:mid.x+mid.y,colors:palette[index%palette.length]};
 }).sort((a,b)=>a.depth-b.depth);
 const edgeStroke:Record<RoofEdge["kind"],string>={ridge:"#c63536",hip:"#ce8b24",valley:"#9858b9",eave:"#1f9b6a",rake:"#2c8bb7"};
 return <div className="roof3dBlock">
  <h2>3D-style roof illustration</h2>
  <svg className="roof3dPreview" viewBox="0 0 720 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three-quarter perspective illustration of the measured roof outlines and roof edge lines">
   <defs>
    <linearGradient id="roof3d-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f8fafc"/><stop offset="1" stopColor="#dce8f2"/></linearGradient>
    <filter id="roof3d-shadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
   </defs>
   <rect width="720" height="440" rx="12" fill="url(#roof3d-bg)"/>
   <ellipse cx="360" cy="292" rx="225" ry="66" fill="#52687d" opacity=".17" filter="url(#roof3d-shadow)"/>
   {shapes.map(shape=>{
    const n=shape.top.length;
    const walls=shape.top.map((p,i)=>({key:i,poly:[p,shape.top[(i+1)%n],shape.walls[(i+1)%n],shape.walls[i]],depth:shape.plan[i].x+shape.plan[(i+1)%n].x+shape.plan[i].y+shape.plan[(i+1)%n].y})).sort((a,b)=>a.depth-b.depth);
    const planes=shape.top.map((p,i)=>({key:i,poly:[p,shape.top[(i+1)%n],shape.peak],shade:shape.colors[i%3],depth:shape.plan[i].x+shape.plan[i].y+shape.plan[(i+1)%n].x+shape.plan[(i+1)%n].y})).sort((a,b)=>a.depth-b.depth);
    return <g key={shape.facet.id}>
     {walls.map(wall=><polygon key={"wall"+wall.key} points={pts(wall.poly)} fill={wall.key%2?"#b9c6d2":"#d8e1e9"} stroke="#8293a4" strokeWidth="1.1"/>)}
     {planes.map(plane=><polygon key={"plane"+plane.key} points={pts(plane.poly)} fill={plane.shade} stroke="#41566a" strokeWidth="1.7" strokeLinejoin="round"/>)}
     <circle cx={shape.peak.x} cy={shape.peak.y} r="2.5" fill="#334155"/>
     <text x={shape.peak.x} y={shape.peak.y-9} textAnchor="middle" fontSize="12" fontWeight="700" fill="#20364a" stroke="#f8fafc" strokeWidth="3" paintOrder="stroke">F{shape.index+1} · {shape.facet.pitch}/12</text>
    </g>;
   })}
   {edges.filter(edge=>edge.points?.length===2).map(edge=>{
    const a=xy(edge.points![0]),b=xy(edge.points![1]);
    // Edge coordinates are traced plan positions. Heights are intentionally not invented.
    const p=project(a.x,a.y,.7),q=project(b.x,b.y,.7);
    return <g key={edge.id}><line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#fff" strokeWidth="6" strokeLinecap="round"/><line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={edgeStroke[edge.kind]} strokeWidth="3.5" strokeLinecap="round"/></g>;
   })}
   <rect x="18" y="18" width="185" height="25" rx="6" fill="#fff" opacity=".93"/>
   <text x="29" y="35" fontSize="12" fontWeight="700" fill="#334155">ILLUSTRATIVE ROOF VIEW</text>
   <text x="18" y="415" fontSize="12" fill="#475569">Measured plan footprint · illustrative roof peaks and elevation</text>
  </svg>
  <p>Visual roof concept using traced roof boundaries, entered pitch and colored edges. Roof plane heights and ridge intersections are not surveyed; use the satellite map and measurement tables for quantities.</p>
 </div>;
}
export default function RoofReport({customer,sections,edges,waste}:{customer?:{name:string;address:string};sections:Section[];edges:RoofEdge[];waste:number}) {
  const report=useRef<HTMLDivElement>(null);
  const [error,setError]=useState("");
  const area=sections.reduce((sum,section)=>sum+surfaceArea(section.footprintSqFt,section.pitch),0);
  const materials=area*(1+waste/100);
  const kinds=["ridge","hip","valley","eave","rake"] as const;
  const mapImage=roofMapImage(sections,edges);
  const [mapImageFailed,setMapImageFailed]=useState(false);
  const [printing,setPrinting]=useState(false);
  function print() {
    setError("");
    if(!report.current){setError("Roof report is not ready.");return;}
    if(!mapImage){
      setError("No traced roof image is available. Trace and save a roof outline or edge on the satellite map before printing.");
      return;
    }
    const source=report.current.querySelector<HTMLImageElement>(".roofReportMap");
    if(!source||!source.complete||source.naturalWidth===0||mapImageFailed){
      setError("The satellite measurement image has not loaded. Check Google Maps Static API access and try again. The printout will not omit the roof image.");
      return;
    }
    const popup=window.open("","_blank");
    if(!popup){setError("Allow popups to print the roof report.");return;}
    popup.opener=null;
    setPrinting(true);
    popup.document.write("<!doctype html><html><head><title>Roof measurement report</title><style>body{font:15px system-ui;color:#162333;margin:30px}h1{border-bottom:3px solid #df971e;padding-bottom:15px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{text-align:left;border-bottom:1px solid #ccc;padding:9px}p{line-height:1.5}h2{margin-top:30px}.roofReportMap{width:100%;max-width:420px;height:auto;border:1px solid #cbd5e1;display:block;margin:10px auto}.roofReportMapBlock{break-inside:avoid;page-break-inside:avoid}@media print{body{margin:14mm}.roofReportMap{width:110mm;max-width:100%;height:auto;margin:8px auto}.roofReportMapBlock h2{margin-top:18px}.roof3dPreview{display:block;width:110mm;max-width:100%;height:auto;margin:8px auto}.roof3dBlock{break-inside:avoid;page-break-inside:avoid}.roof3dBlock h2{margin-top:18px}}</style></head><body>"+report.current.innerHTML+"</body></html>");
    popup.document.close();
    const image=popup.document.querySelector<HTMLImageElement>(".roofReportMap");
    if(!image){popup.close();setPrinting(false);setError("Roof image was missing from the print page. Nothing printed.");return;}
    const finish=()=>{
      setPrinting(false);
      if(!popup.closed) {popup.focus();popup.print();}
    };
    if(image.complete){
      if(image.naturalWidth>0)finish();
      else{popup.close();setPrinting(false);setError("Roof image failed to load in the PDF/print window. Nothing printed.");}
    }else{
      image.addEventListener("load",finish,{once:true});
      image.addEventListener("error",()=>{popup.close();setPrinting(false);setError("Roof image failed to load in the PDF/print window. Nothing printed.");},{once:true});
    }
  }
  return <div className="card" style={{marginTop:16}}>
    <div ref={report}>
      <h1>Estimated roof measurement report</h1>
      <p><strong>{customer?.name || "Choose a customer"}</strong><br/>{customer?.address}</p>
      <p>This report reflects the current workspace. Save Measurement to store this version with the customer. Manual tracing and entered pitch require field verification.</p>
      <div className="roofReportMapBlock">
        <h2>Satellite roof measurement image</h2>
        {mapImage&&!mapImageFailed?
         <><img className="roofReportMap" src={mapImage} alt="Satellite view of roof showing traced measurement facets and edge lines" onError={()=>setMapImageFailed(true)}/>
           <p>Close-up satellite view centered on this property’s traced roof. Colored lines identify the roof facets and edges; corresponding measurements are listed below.</p></>:
         <p>Map image unavailable. Google Maps Static API must be enabled for the same Maps key, and roof outlines or edges must be traced on the satellite map. Measurement totals remain available below.</p>}
      </div>
      <RoofPerspective sections={sections} edges={edges}/>
      <h2>Roof facets</h2><div className="tableWrap"><table className="table"><thead><tr><th>Facet</th><th>Footprint sq ft</th><th>Pitch</th><th>Surface sq ft</th></tr></thead><tbody>
        {sections.map(section=><tr key={section.id}><td>{section.name}</td><td>{section.footprintSqFt.toFixed(1)}</td><td>{section.pitch}/12</td><td>{surfaceArea(section.footprintSqFt,section.pitch).toFixed(1)}</td></tr>)}
      </tbody></table></div>
      <p><strong>Roof surface:</strong> {area.toFixed(1)} sq ft · <strong>Net roof squares:</strong> {(area/100).toFixed(2)}</p>
      <p><strong>Waste:</strong> {waste}% · <strong>Material area:</strong> {materials.toFixed(1)} sq ft · <strong>Material squares:</strong> {(materials/100).toFixed(2)}</p>
      <h2>Roof edges</h2><div className="tableWrap"><table className="table"><thead><tr><th>Type</th><th>Horizontal ft</th><th>Endpoint rise ft</th><th>Estimated length ft</th></tr></thead><tbody>
        {edges.map(edge=><tr key={edge.id}><td>{edge.kind}</td><td>{edge.horizontalFt.toFixed(1)}</td><td>{edge.riseFt.toFixed(1)}</td><td>{edgeLength(edge).toFixed(1)}</td></tr>)}
      </tbody></table></div>
      <p>{kinds.map(kind=>kind+": "+edges.filter(edge=>edge.kind===kind).reduce((sum,edge)=>sum+edgeLength(edge),0).toFixed(1)+" ft").join(" · ")}</p>
      <p>Edge lengths assume a straight segment between endpoints. A zero height difference produces horizontal distance only; roof pitch alone cannot establish hip or valley length. Height differences must be measured. Do not count shared roof edges twice.</p>
    </div>
    <button className="btn secondary" disabled={!customer || !sections.length || printing} onClick={print}>{printing?"Preparing roof image…":"Print roof report / save PDF"}</button>
    {error && <p role="status" className="notice">{error}</p>}
  </div>;
}
