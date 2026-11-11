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
    popup.document.write("<!doctype html><html><head><title>Roof measurement report</title><style>body{font:15px system-ui;color:#162333;margin:30px}h1{border-bottom:3px solid #df971e;padding-bottom:15px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{text-align:left;border-bottom:1px solid #ccc;padding:9px}p{line-height:1.5}h2{margin-top:30px}.roofReportMap{width:100%;max-width:680px;height:auto;border:1px solid #cbd5e1;display:block}.roofReportMapBlock{break-inside:avoid;page-break-inside:avoid}@media print{body{margin:14mm}.roofReportMap{max-width:100%}}</style></head><body>"+report.current.innerHTML+"</body></html>");
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
