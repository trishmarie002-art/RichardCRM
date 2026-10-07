"use client";
import { useRef, useState } from "react";
import { edgeLength, surfaceArea, type RoofEdge } from "@/lib/roof";
type Section = { id:number; name:string; footprintSqFt:number; pitch:number };
export default function RoofReport({customer,sections,edges,waste}:{customer?:{name:string;address:string};sections:Section[];edges:RoofEdge[];waste:number}) {
  const report=useRef<HTMLDivElement>(null);
  const [error,setError]=useState("");
  const area=sections.reduce((sum,section)=>sum+surfaceArea(section.footprintSqFt,section.pitch),0);
  const materials=area*(1+waste/100);
  const kinds=["ridge","hip","valley","eave","rake"] as const;
  function print() {
    const popup=window.open("","_blank");
    if(!popup || !report.current){setError("Allow popups to print the roof report.");return;}
    popup.opener=null;
    popup.document.write("<!doctype html><html><head><title>Roof measurement report</title><style>body{font:15px system-ui;color:#162333;margin:40px}h1{border-bottom:3px solid #df971e;padding-bottom:15px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{text-align:left;border-bottom:1px solid #ccc;padding:9px}p{line-height:1.5}h2{margin-top:30px}</style></head><body>"+report.current.innerHTML+"</body></html>");
    popup.document.close();popup.focus();popup.print();
  }
  return <div className="card" style={{marginTop:16}}>
    <div ref={report}>
      <h1>Estimated roof measurement report</h1>
      <p><strong>{customer?.name || "Choose a customer"}</strong><br/>{customer?.address}</p>
      <p>This report reflects the current workspace. Save Measurement to store this version with the customer. Manual tracing and entered pitch require field verification.</p>
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
    <button className="btn secondary" disabled={!customer || !sections.length} onClick={print}>Print roof report / save PDF</button>
    {error && <p role="status" className="notice">{error}</p>}
  </div>;
}
