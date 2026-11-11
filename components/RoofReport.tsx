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
// Project the measured plan into a consistent isometric view.
// Each polygon is shown as a single roof plane rather than inventing a pyramidal apex.
// True ridge elevations cannot be reconstructed from 2D tracing and pitch alone.
function RoofPerspective({sections,edges}:{sections:Section[];edges:RoofEdge[]}){
 const facets=sections.filter(section=>(section.points||[]).length>=3&&section.points!.every(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)));
 if(!facets.length)return null;
 type P={x:number;y:number};type P3=P&{z:number};
 const points=facets.flatMap(section=>section.points!);
 const lat0=points.reduce((sum,p)=>sum+p.lat,0)/points.length;
 const lng0=points.reduce((sum,p)=>sum+p.lng,0)/points.length;
 const cosLat=Math.cos(lat0*Math.PI/180);
 const local=(p:GeoPoint):P=>({x:(p.lng-lng0)*364000*cosLat,y:(lat0-p.lat)*364000});
 const all=points.map(local);
 const minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x));
 const minY=Math.min(...all.map(p=>p.y)),maxY=Math.max(...all.map(p=>p.y));
 const span=Math.max(12,maxX-minX,maxY-minY);
 const ridgeEdges=edges.filter(e=>e.kind==="ridge"&&e.points?.length===2).map(e=>({a:local(e.points![0]),b:local(e.points![1])}));
 const roofFaces=facets.map((section,index)=>{
  const plan=section.points!.map(local);
  const cx=plan.reduce((sum,p)=>sum+p.x,0)/plan.length;
  const cy=plan.reduce((sum,p)=>sum+p.y,0)/plan.length;
  const longest=plan.reduce((best,p,i)=>{
   const q=plan[(i+1)%plan.length],len=Math.hypot(q.x-p.x,q.y-p.y);
   return len>best.len?{len,dx:q.x-p.x,dy:q.y-p.y}:best;
  },{len:0,dx:1,dy:0});
  // Prefer the closest user-traced ridge as a direction guide, never infer a new ridge.
  const nearest=ridgeEdges.map(edge=>{
   const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,len=Math.max(0.01,Math.hypot(dx,dy));
   const dist=Math.abs((cx-edge.a.x)*dy-(cy-edge.a.y)*dx)/len;
   return {...edge,dx,dy,len,dist};
  }).sort((u,v)=>u.dist-v.dist)[0];
  const along=nearest&&nearest.dist<span*.28?{x:nearest.dx,y:nearest.dy}:{x:longest.dx,y:longest.dy};
  const length=Math.max(.01,Math.hypot(along.x,along.y));
  const nx=-along.y/length,ny=along.x/length;
  const values=plan.map(p=>p.x*nx+p.y*ny);
  const lo=Math.min(...values),hi=Math.max(...values),run=Math.max(1,hi-lo);
  const pitch=Math.max(0,Math.min(12,section.pitch));
  const rise=Math.min(11,run*pitch/12);
  // Height is schematic. Facets keep planar surfaces rather than converging to fake peaks.
  const vertices:P3[]=plan.map((p,i)=>({...p,z:6+rise*(values[i]-lo)/run}));
  return {section,index,vertices,depth:cx+cy,pitch,center:{x:cx,y:cy},rise};
 }).sort((u,v)=>u.depth-v.depth);
 const iso=(p:P3)=>({x:380+(p.x-p.y)*.84,y:230+(p.x+p.y)*.42-p.z*1.35});
 const projected=roofFaces.flatMap(f=>[...f.vertices,...f.vertices.map(v=>({...v,z:-2}))].map(iso));
 const pxMin=Math.min(...projected.map(p=>p.x)),pxMax=Math.max(...projected.map(p=>p.x));
 const pyMin=Math.min(...projected.map(p=>p.y)),pyMax=Math.max(...projected.map(p=>p.y));
 // Scale to fit the available illustration area. The old 1.9 cap made real roofs microscopic.
 const factor=Math.min(600/Math.max(1,pxMax-pxMin),258/Math.max(1,pyMax-pyMin));
 const offsetX=360-factor*(pxMin+pxMax)/2,offsetY=196-factor*(pyMin+pyMax)/2;
 const screen=(p:P3)=>{const q=iso(p);return {x:q.x*factor+offsetX,y:q.y*factor+offsetY};};
 const poly=(arr:P3[])=>arr.map(p=>{const q=screen(p);return q.x.toFixed(1)+","+q.y.toFixed(1);}).join(" ");
 const roofColors=["#859cad","#9caeac","#c6a892","#a6a3b9","#a4b2a3","#bbadb0"];
 const edgeColors:Record<RoofEdge["kind"],string>={ridge:"#c23939",hip:"#d28d22",valley:"#8b55b0",eave:"#278d60",rake:"#2185ac"};
 const featureEdges=edges.filter(e=>e.points?.length===2&&e.points.every(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)));
 return <div className="roof3dBlock">
  <h2>Roof perspective — traced geometry</h2>
  <svg className="roof3dPreview" viewBox="0 0 720 430" role="img" aria-label="Isometric roof-plane visualization using traced roof facets and labeled edges" xmlns="http://www.w3.org/2000/svg">
   <defs>
    <linearGradient id="roof-report-sky" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stopColor="#f8fafc"/><stop offset="1" stopColor="#e7eef5"/></linearGradient>
    <pattern id="roof-report-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M 22 0 L 0 0 0 22" fill="none" stroke="#b6c6d4" strokeWidth=".55" opacity=".44"/></pattern>
    <filter id="roof-report-shadow"><feGaussianBlur stdDeviation="8"/></filter>
   </defs>
   <rect width="720" height="430" rx="12" fill="url(#roof-report-sky)"/>
   <rect x="10" y="12" width="700" height="352" rx="8" fill="url(#roof-report-grid)" opacity=".35"/>
   <ellipse cx="360" cy="307" rx="232" ry="38" fill="#53677d" opacity=".10" filter="url(#roof-report-shadow)"/>
   {roofFaces.map(face=>{
    const n=face.vertices.length;
    const walls=face.vertices.map((v,i)=>{
     const next=face.vertices[(i+1)%n];
     return {i,depth:v.x+v.y+next.x+next.y,quad:[v,next,{...next,z:-2},{...v,z:-2}]};
    }).sort((x,y)=>x.depth-y.depth);
    const textPosition=screen({...face.center,z:6+face.rise*.5});
    return <g key={face.section.id}>
     {walls.map(w=><polygon key={w.i} points={poly(w.quad)} fill={w.i%2===0?"#d0d9e3":"#aab8c7"} stroke="#66788b" strokeWidth="1.1" strokeLinejoin="round"/>)}
     <polygon points={poly(face.vertices)} fill={roofColors[face.index%roofColors.length]} stroke="#30485f" strokeWidth="2.3" strokeLinejoin="round"/>
     <polygon points={poly(face.vertices)} fill="#fff" fillOpacity=".13" stroke="none"/>
     <circle cx={textPosition.x} cy={textPosition.y} r="10" fill="#fff" fillOpacity=".95" stroke="#334155" strokeWidth=".8"/>
     <text x={textPosition.x} y={textPosition.y+3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#1d3b52">{face.index+1}</text>
    </g>;
   })}
   {featureEdges.map(edge=>{
    const a=local(edge.points![0]),b=local(edge.points![1]);
    const q1=screen({...a,z:7}),q2=screen({...b,z:7});
    return <g key={edge.id}><line x1={q1.x} y1={q1.y} x2={q2.x} y2={q2.y} stroke="#f8fafc" strokeWidth="4" strokeLinecap="round"/><line x1={q1.x} y1={q1.y} x2={q2.x} y2={q2.y} stroke={edgeColors[edge.kind]} strokeWidth="2.4" strokeLinecap="round"/></g>;
   })}
   <rect x="18" y="17" width="236" height="37" rx="7" fill="#fff" fillOpacity=".96" stroke="#d5dfe8"/>
   <text x="31" y="33" fontSize="12" fontWeight="700" fill="#21394d">ROOF GEOMETRY PREVIEW</text>
   <text x="31" y="46" fontSize="10" fill="#687f94">Traced sections · not survey-grade 3D</text>
   <g transform="translate(650 30)"><circle r="23" fill="#fff" stroke="#becbd8"/><path d="M0 15 V-13 M-5 -3 L0 -13 L5 -3" stroke="#456079" strokeWidth="2" fill="none"/><text y="-17" textAnchor="middle" fontSize="10" fontWeight="700" fill="#334155">N</text></g>
   <rect x="18" y="366" width="684" height="47" rx="7" fill="#fff" fillOpacity=".95" stroke="#d6e0e9"/>
   {(["ridge","hip","valley","eave","rake"] as const).map((kind,i)=><g key={kind} transform={`translate(${30+i*132} 385)`}><line x1="0" y1="0" x2="21" y2="0" stroke={edgeColors[kind]} strokeWidth="4" strokeLinecap="round"/><text x="28" y="4" fontSize="12" fill="#34465a">{kind.charAt(0).toUpperCase()+kind.slice(1)}</text></g>)}
   <text x="30" y="402" fontSize="10.5" fill="#64748b">Facet numbers correspond to the measurement table below · elevations conceptual</text>
  </svg>
  <p>Enlarged isometric roof plan showing traced boundaries and conceptual slopes based on entered pitch. Roof elevation, ridge connections and wall heights are not measured. Use the satellite image and measurement tables for estimating.</p>
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
