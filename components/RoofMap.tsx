"use client";
import { validRoofOutline, edgeLength, type RoofEdge } from "@/lib/roof";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

export type RoofPoint = { lat: number; lng: number };
export type TracedFacet = { id: number; name: string; footprintSqFt: number; pitch: number; points: RoofPoint[] };
// Google Maps is loaded by its hosted script; isolate its runtime interface here.
declare global { interface Window { google?: any; gm_authFailure?: () => void; } }

const edgeColors:Record<RoofEdge["kind"],string>={ridge:"#ef4444",hip:"#f59e0b",valley:"#a855f7",eave:"#22c55e",rake:"#38bdf8"};
const facetColors=["#ffdb58","#ff7b54","#76e4f7","#de83fc","#66e4a3","#ff9cdb"];
export default function RoofMap({ address, onFacet, onEdge, onFacetUpdate, onEdgeUpdate, facets, edges }: { address: string; onFacet: (facet: TracedFacet) => void; onEdge: (edge: RoofEdge) => void; onFacetUpdate:(id:number,points:RoofPoint[],area:number)=>void; onEdgeUpdate:(id:string,points:RoofPoint[],distance:number)=>void; facets: {id:number;name:string;footprintSqFt:number;points?: RoofPoint[] }[]; edges: RoofEdge[] }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const polygon = useRef<any>(null);
  const line = useRef<any>(null);
  const [tool, setTool] = useState<"facet" | RoofEdge["kind"]>("facet");
  const [rise, setRise] = useState(0);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState(address);
  const [points, setPoints] = useState<RoofPoint[]>([]);
  const unfinishedByTool=useRef<Partial<Record<"facet"|RoofEdge["kind"],RoofPoint[]>>>({});
  const lastTool=useRef<"facet"|RoofEdge["kind"]>("facet");
  function switchTool(next:"facet"|RoofEdge["kind"]){
    unfinishedByTool.current[lastTool.current]=points;
    lastTool.current=next;
    setTool(next);
    setPoints(unfinishedByTool.current[next]||[]);
    setRise(0);
    setMessage("Switched to "+next+". Earlier measurements remain visible and you can draw overlapping lines.");
  }
  const [drawing, setDrawing] = useState(false);
  const [pitch, setPitch] = useState<number|null>(null);
  const [mapReady,setMapReady]=useState(false);
  const [mapZoom,setMapZoom]=useState(19);
  function adjustZoom(delta:number){if(!map.current)return;const next=Math.min(25,Math.max(1,(map.current.getZoom()??mapZoom)+delta));map.current.setZoom(next);setMapZoom(next);}
  const [authFailed,setAuthFailed]=useState(false);
  const autoLocated=useRef(false);
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const searchVersion = useRef(0);
  const fittedInitialBounds=useRef(false);
  useEffect(()=>{const previous=window.gm_authFailure;window.gm_authFailure=()=>{setAuthFailed(true);setDrawing(false);setMessage("Google Maps rejected the connection. Check the key, enabled APIs, billing and allowed website.");};return()=>{window.gm_authFailure=previous;searchVersion.current++;};},[]);
  useEffect(() => { autoLocated.current=false;setQuery(address); setPoints([]);unfinishedByTool.current={};lastTool.current="facet";setDrawing(false); searchVersion.current++; }, [address]);

  useEffect(() => {
    if (!ready || !container.current) return;
    const maps = window.google?.maps;
    if(!maps?.Map||!maps?.geometry?.spherical){setMessage("Google Maps did not initialize correctly. Reload the page and check the API setup.");return;}
    map.current = new maps.Map(container.current, { center: { lat: 29.4241, lng: -98.4936 }, zoom: 20, maxZoom: 25, zoomControl:true, zoomControlOptions:{position:maps.ControlPosition.RIGHT_CENTER}, mapTypeId: "satellite", tilt: 0, heading: 0, gestureHandling:"greedy", streetViewControl: false, rotateControl: false });
    polygon.current = new maps.Polygon({ map: map.current, strokeColor: "#ff9f1c", fillColor: "#ff9f1c", fillOpacity: 0.25 });
    line.current = new maps.Polyline({ map:map.current,strokeColor:"#60a5fa",strokeWeight:4 });
    setMapZoom(map.current.getZoom()??20);
    const zoomListener=map.current.addListener("zoom_changed",()=>setMapZoom(map.current?.getZoom()??20));
    setMapReady(true);
    return () => { zoomListener.remove();setMapReady(false);line.current.setMap(null); maps.event.clearInstanceListeners(map.current); polygon.current.setMap(null); map.current = null; };
  }, [ready]);

  useEffect(() => {
    if (!map.current) return;
    polygon.current.setPath(tool === "facet" ? points : []);
    line.current.setPath(tool === "facet" ? [] : points);
    const color=tool==="facet"?facetColors[0]:edgeColors[tool];
    polygon.current.setOptions({strokeColor:color,fillColor:color,clickable:false});
    line.current.setOptions({strokeColor:color,clickable:false});
    map.current.setOptions({ draggableCursor: drawing ? "crosshair" : undefined, disableDoubleClickZoom: drawing });
    if (!drawing) return;
    const listener = map.current.addListener("click", (event: any) => {
      if (event.latLng) setPoints(current => tool === "facet" ? [...current, event.latLng.toJSON()] : current.length < 2 ? [...current, event.latLng.toJSON()] : current);
    });
    return () => listener.remove();
  }, [points, drawing, ready, tool]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const maps=window.google.maps;
    const overlays:any[]=[];
    const listeners:any[]=[];
    const segmentLabel=(from:RoofPoint,to:RoofPoint,feet:number,color:string)=>{
      const position=maps.geometry.spherical.interpolate(from,to,0.5);
      const marker=new maps.Marker({
        map:map.current,position,clickable:false,zIndex:100,
        icon:{path:maps.SymbolPath.CIRCLE,scale:0,fillOpacity:0,strokeOpacity:0},
        label:{text:feet.toFixed(1)+" ft",color:"#ffffff",fontSize:"12px",fontWeight:"700",className:"roof-length-label"}
      });
      overlays.push(marker);
    };
    const savedFacets=facets.filter(f=>f.points && f.points.length>=3);
    savedFacets.forEach((facet,index)=>{
      const color=facetColors[index%facetColors.length];
      const path=facet.points!;
      const polygonOverlay=new maps.Polygon({map:map.current,paths:path,strokeColor:color,fillColor:color,fillOpacity:.12,strokeWeight:3,clickable:false,zIndex:1});
      overlays.push(polygonOverlay);
      path.forEach((point,sideIndex)=>{
        const next=path[(sideIndex+1)%path.length];
        const feet=maps.geometry.spherical.computeDistanceBetween(point,next)*3.280839895;
        if(Number.isFinite(feet)&&feet>0.1)segmentLabel(point,next,feet,color);
      });
      const perimeter=maps.geometry.spherical.computeLength([...path,path[0]])*3.280839895;
      const label=new maps.Marker({map:map.current,position:path[0],label:{text:"F"+(index+1),color:"#111827",fontWeight:"bold"},icon:{path:maps.SymbolPath.CIRCLE,scale:13,fillColor:color,fillOpacity:1,strokeColor:"#111827",strokeWeight:1},title:facet.name+" — outline perimeter "+perimeter.toFixed(1)+" ft"});
      overlays.push(label);
      path.forEach((point,vertexIndex)=>{
        const marker=new maps.Marker({map:map.current,position:point,draggable:!drawing,clickable:!drawing,icon:{path:maps.SymbolPath.CIRCLE,scale:5,fillColor:color,fillOpacity:1,strokeColor:"#fff",strokeWeight:1},title:"Drag roof corner "+(vertexIndex+1)+" to adjust"});
        overlays.push(marker);
        listeners.push(marker.addListener("dragend",()=>{
          const updated=path.map((p,i)=>i===vertexIndex?marker.getPosition().toJSON():p);
          if(!validRoofOutline(updated)){setMessage("The edited roof shape is invalid; the corner was not saved.");marker.setPosition(point);return;}
          const area=maps.geometry.spherical.computeArea(updated)*10.76391041671;
          if(Number.isFinite(area)&&area>1)onFacetUpdate(facet.id,updated,area);
        }));
      });
    });
    edges.filter(e=>e.points?.length===2).forEach((edge,index)=>{
      const color=edgeColors[edge.kind];
      const path=edge.points!;
      const overlay=new maps.Polyline({map:map.current,path,strokeColor:color,strokeWeight:4,clickable:false,zIndex:10});
      overlays.push(overlay);
      segmentLabel(path[0],path[1],edgeLength(edge),color);
      const midpoint={lat:(path[0].lat+path[1].lat)/2,lng:(path[0].lng+path[1].lng)/2};
      overlays.push(new maps.Marker({map:map.current,position:midpoint,label:{text:String(index+1),color:"#fff",fontWeight:"bold"},icon:{path:maps.SymbolPath.CIRCLE,scale:12,fillColor:color,fillOpacity:1,strokeColor:"#fff",strokeWeight:1},title:edge.kind+" "+edgeLength(edge).toFixed(1)+" ft"}));
      path.forEach((point,vertexIndex)=>{
        const marker=new maps.Marker({map:map.current,position:point,draggable:!drawing,icon:{path:maps.SymbolPath.CIRCLE,scale:5,fillColor:color,fillOpacity:1,strokeColor:"#fff",strokeWeight:1},title:"Drag endpoint "+(vertexIndex+1)+" to adjust"});
        overlays.push(marker);
        listeners.push(marker.addListener("dragend",()=>{
          const updated=path.map((p,i)=>i===vertexIndex?marker.getPosition().toJSON():p);
          const distance=maps.geometry.spherical.computeDistanceBetween(updated[0],updated[1])*3.280839895;
          if(Number.isFinite(distance)&&distance>0.1)onEdgeUpdate(edge.id,updated,distance);
          else {setMessage("An edge requires distinct endpoints.");marker.setPosition(point);}
        }));
      });
    });
    if(!fittedInitialBounds.current&&(savedFacets.length||edges.some(e=>e.points?.length))){
      fittedInitialBounds.current=true;
      const bounds=new maps.LatLngBounds();
      savedFacets.forEach(f=>f.points?.forEach(p=>bounds.extend(p)));
      edges.forEach(e=>e.points?.forEach(p=>bounds.extend(p)));
      map.current.fitBounds(bounds,24);
    }
    return()=>{listeners.forEach(listener=>listener.remove());overlays.forEach(overlay=>overlay.setMap(null));};
  },[facets,edges,ready,drawing,onFacetUpdate,onEdgeUpdate]);

  useEffect(()=>{
    if(!ready||!map.current||points.length<2)return;
    const maps=window.google?.maps;
    if(!maps?.geometry?.spherical)return;
    const labels:any[]=[];
    const segments=tool==="facet"&&points.length>=3?points.length:points.length-1;
    for(let i=0;i<segments;i++){
      const start=points[i],end=points[(i+1)%points.length];
      const feet=maps.geometry.spherical.computeDistanceBetween(start,end)*3.280839895;
      if(!Number.isFinite(feet)||feet<0.1)continue;
      labels.push(new maps.Marker({
        map:map.current,position:maps.geometry.spherical.interpolate(start,end,0.5),clickable:false,zIndex:110,
        icon:{path:maps.SymbolPath.CIRCLE,scale:0,fillOpacity:0,strokeOpacity:0},
        label:{text:feet.toFixed(1)+" ft",color:"#fff",fontSize:"12px",fontWeight:"700",className:"roof-length-label"}
      }));
    }
    return()=>labels.forEach(label=>label.setMap(null));
  },[points,tool,ready]);

  useEffect(()=>{if(!mapReady||autoLocated.current||!address.trim())return;autoLocated.current=true;if(!facets.some(f=>f.points?.length)&&!edges.some(e=>e.points?.length))void search(address);},[mapReady,address,facets,edges]);

  async function search(searchAddress=query) {
    if (!searchAddress.trim() || !map.current || authFailed) return;
    const version = ++searchVersion.current;
    setSearching(true); setMessage("");
    try {
      const result = await new window.google.maps.Geocoder().geocode({ address: searchAddress });
      if (version !== searchVersion.current) return;
      const location = result.results[0];
      if (!location) throw new Error("No matching address.");
      if(result.results.length>1){setMessage("Multiple address matches. Enter the full street address, city, state and ZIP before tracing.");return;}
      map.current.setCenter(location.geometry.location); map.current.setZoom(20);
      setPoints([]);unfinishedByTool.current={};setDrawing(false);
      setMessage("Confirm this is the correct roof before tracing. " + location.formatted_address);
    } catch { if (version === searchVersion.current) setMessage("Address search failed. Check the address and Geocoding API setup."); }
    finally { if(version===searchVersion.current)setSearching(false); }
  }

  function finish() {
    if(tool !== "facet") {
      if(points.length !== 2 || !Number.isFinite(rise) || rise < 0) return;
      const distance=window.google.maps.geometry.spherical.computeDistanceBetween(points[0],points[1])*3.280839895;
      if(!Number.isFinite(distance) || distance < .1) {setMessage("Choose two distinct edge endpoints.");return;}
      onEdge({id:crypto.randomUUID(),kind:tool,horizontalFt:distance,riseFt:rise,points});
      setPoints([]);unfinishedByTool.current[tool]=[];setMessage("Edge added. Continue tracing this type, or switch tools to overlay another measurement.");return;
    }
    if (points.length < 3 || pitch===null) {setMessage("Choose the inspected roof pitch before adding a facet.");return;}
    if(!validRoofOutline(points)){setMessage("Trace a valid roof outline: use distinct corners in order, without crossing edges.");return;}
    const area = window.google.maps.geometry.spherical.computeArea(points) * 10.76391041671;
    if (!Number.isFinite(area) || area < 1) { setMessage("Trace a valid facet with at least three corners."); return; }
    onFacet({ id: Date.now(), name: "Traced facet", footprintSqFt: area, pitch, points });
    setPoints([]);unfinishedByTool.current.facet=[];setMessage("Facet added. Add another facet or switch tools to overlay ridge, hip, valley, eave, or rake lines. Avoid double-counting overlapping roof areas.");
  }

  if (!key) return <div className="card"><h2>Satellite roof tracing</h2><p className="notice">Satellite imagery is awaiting the Google Maps connection.</p><p>Once connected, choose a customer to find their roof automatically, trace each roof section, select its inspected pitch, and save the measurement.</p><p className="muted">The manual measurement calculator below is available now.</p></div>;
  return <div className="card" style={{ marginBottom: 16 }}>
    <Script src={"https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(key)+"&libraries=geometry&v=weekly"} id="star-roof-google-maps" onReady={() => setReady(true)} onError={() => setMessage("Satellite map could not load. Check the API key and website restrictions.")} />
    <h2>Satellite roof tracing</h2>
    <p className="muted">Trace multiple measurement types on the same roof. Saved lines and facets stay visible when you change tools, and unfinished traces are restored when you switch back. You can layer ridges, hips, valleys, eaves and rakes over facet outlines without clearing previous measurements.</p>
    <form onSubmit={event => { event.preventDefault(); void search(query); }} className="roofToolbar">
      <div className="field" style={{ flex: 1 }}><label htmlFor="roof-address">Property address</label><input id="roof-address" value={query} onChange={event => setQuery(event.target.value)} required /></div>
      <button className="btn" disabled={!mapReady || authFailed || searching}>{searching ? "Finding…" : "Find roof"}</button>
    </form>
    <div className="roofToolbar" aria-label="Roof measuring line color key" style={{gap:8,alignItems:"center",marginTop:10,marginBottom:6}}><strong style={{fontSize:13,marginRight:4}}>Line colors:</strong>{([{name:"Roof facet",color:facetColors[0]},...(["ridge","hip","valley","eave","rake"] as const).map(kind=>({name:kind[0].toUpperCase()+kind.slice(1),color:edgeColors[kind]}))]).map(item=><span key={item.name} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 9px",border:"1px solid #d8e2ed",borderRadius:8,fontSize:12,background:"#fff",color:"#17283d"}}><span aria-hidden="true" style={{width:13,height:13,background:item.color,borderRadius:3,border:"1px solid #64748b"}}/>{item.name}</span>)}</div>
    <div className="roofToolbar" style={{alignItems:"center",gap:8,margin:"8px 0"}} aria-label="Roof satellite zoom controls">
       <strong style={{fontSize:13}}>Satellite zoom: {mapZoom}</strong>
       <button type="button" className="mini" disabled={!mapReady||mapZoom<=1} onClick={()=>adjustZoom(-1)}>− Zoom out</button>
       <button type="button" className="mini" disabled={!mapReady||mapZoom>=25} onClick={()=>adjustZoom(1)}>+ Zoom in closer</button>
       <span className="small muted">Allows map zoom up to level 25, but the actual detail is limited by Google's satellite imagery for this address. Higher levels may enlarge pixels without revealing more detail.</span>
     </div>
     <div ref={container} className="roofMap" aria-label="Satellite map for roof tracing" />
    <div className="roofToolbar">
      <div className="field"><label htmlFor="roof-tool">Trace tool — colors match the map</label><div style={{display:"flex",alignItems:"center",gap:9}}><span aria-hidden="true" style={{width:17,height:17,flexShrink:0,borderRadius:4,background:tool==="facet"?facetColors[0]:edgeColors[tool],border:"1px solid #64748b"}}/><select id="roof-tool" aria-label="Color-coded roof measurement tool" value={tool} onChange={event=>switchTool(event.target.value as typeof tool)} style={{borderLeft:"6px solid "+(tool==="facet"?facetColors[0]:edgeColors[tool])}}><option value="facet" style={{background:facetColors[0],color:"#111827"}}>🟡 Roof facet</option>{(["ridge","hip","valley","eave","rake"] as const).map(kind=><option key={kind} value={kind} style={{background:edgeColors[kind],color:kind==="eave"||kind==="rake"?"#102437":"#fff"}}>{({ridge:"🔴 Ridge",hip:"🟠 Hip",valley:"🟣 Valley",eave:"🟢 Eave",rake:"🔵 Rake"} as const)[kind]}</option>)}</select></div></div>
      {tool!=="facet" && <div className="field"><label htmlFor="edge-rise">Endpoint height difference (ft)</label><input id="edge-rise" type="number" min="0" step="0.1" value={rise} onChange={event=>setRise(Number(event.target.value))}/></div>}
      <button className="mini" disabled={!mapReady||authFailed||searching} onClick={() => setDrawing(!drawing)}>{drawing ? "Pause tracing" : "Start tracing"}</button>
      <button className="mini" disabled={!points.length} onClick={() => setPoints(current => current.slice(0,-1))}>Undo corner</button>
      <button className="mini" onClick={() => { setPoints([]);unfinishedByTool.current[tool]=[]; }}>Clear current trace</button>
      <div className="field"><label htmlFor="facet-pitch">Facet pitch</label><select id="facet-pitch" value={pitch??""} onChange={event => setPitch(event.target.value===""?null:Number(event.target.value))}><option value="">Choose inspected pitch</option>{Array.from({length:13},(_,i)=><option key={i} value={i}>{i}/12</option>)}</select></div>
      <button className="btn" disabled={!mapReady||authFailed||searching||(tool==="facet"?(points.length<3||pitch===null):points.length!==2)} onClick={finish}>Add {tool} ({points.length} corners)</button>
    </div>
    <p className="small muted" role="status">Active tool: <strong>{tool==="facet"?"Roof facet":tool}</strong>. {points.length?points.length+" point(s) in the current trace.":"No points in the current trace."} Switching tools keeps each tool’s unfinished points. Draw multiple lines of the same type consecutively; use Save Measurement to persist all layers.</p>
    <div className="card" style={{marginTop:12}}><h3>Traced lines and perimeter</h3>
      {facets.map((facet,index)=><div className="kpi" key={facet.id}><span><span style={{display:"inline-block",width:12,height:12,background:facetColors[index%facetColors.length],marginRight:8}}/>Facet {index+1}: {facet.name}</span><strong>{facet.points?.length&&window.google?.maps?.geometry?.spherical?(window.google.maps.geometry.spherical.computeLength([...facet.points,facet.points[0]])*3.280839895).toFixed(1)+" ft perimeter":"Outline not available"}</strong></div>)}
      {edges.map((edge,index)=><div className="kpi" key={edge.id}><span><span style={{display:"inline-block",width:12,height:12,background:edgeColors[edge.kind],marginRight:8}}/>{index+1}. {edge.kind}</span><strong>{edgeLength(edge).toFixed(1)} ft</strong></div>)}
      <p className="small muted">Facet perimeter is each roof outline individually; shared boundaries are counted more than once. This is not the exterior roof perimeter. Measure eaves and rakes to estimate exterior trim.</p>
    </div>
    <p className="small muted">Pause tracing and drag the small colored corner or endpoint handles to adjust existing lines, then click Save Measurement below. Line numbers identify edge measurements; colors distinguish roof features. Satellite measurements must be verified on site.</p>
    {message && <div role="status" className="notice">{message}</div>}
  </div>;
}
