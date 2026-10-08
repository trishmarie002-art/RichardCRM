"use client";
import { validRoofOutline, type RoofEdge } from "@/lib/roof";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

export type RoofPoint = { lat: number; lng: number };
export type TracedFacet = { id: number; name: string; footprintSqFt: number; pitch: number; points: RoofPoint[] };
// Google Maps is loaded by its hosted script; isolate its runtime interface here.
declare global { interface Window { google?: any; gm_authFailure?: () => void; } }

export default function RoofMap({ address, onFacet, onEdge, facets, edges }: { address: string; onFacet: (facet: TracedFacet) => void; onEdge: (edge: RoofEdge) => void; facets: { points?: RoofPoint[] }[]; edges: RoofEdge[] }) {
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
  const [drawing, setDrawing] = useState(false);
  const [pitch, setPitch] = useState<number|null>(null);
  const [mapReady,setMapReady]=useState(false);
  const [authFailed,setAuthFailed]=useState(false);
  const autoLocated=useRef(false);
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const searchVersion = useRef(0);
  useEffect(()=>{const previous=window.gm_authFailure;window.gm_authFailure=()=>{setAuthFailed(true);setDrawing(false);setMessage("Google Maps rejected the connection. Check the key, enabled APIs, billing and allowed website.");};return()=>{window.gm_authFailure=previous;searchVersion.current++;};},[]);
  useEffect(() => { autoLocated.current=false;setQuery(address); setPoints([]); setDrawing(false); searchVersion.current++; }, [address]);

  useEffect(() => {
    if (!ready || !container.current) return;
    const maps = window.google?.maps;
    if(!maps?.Map||!maps?.geometry?.spherical){setMessage("Google Maps did not initialize correctly. Reload the page and check the API setup.");return;}
    map.current = new maps.Map(container.current, { center: { lat: 29.4241, lng: -98.4936 }, zoom: 19, mapTypeId: "satellite", tilt: 0, heading: 0, gestureHandling:"greedy", streetViewControl: false, rotateControl: false });
    polygon.current = new maps.Polygon({ map: map.current, strokeColor: "#ff9f1c", fillColor: "#ff9f1c", fillOpacity: 0.25 });
    line.current = new maps.Polyline({ map:map.current,strokeColor:"#60a5fa",strokeWeight:4 });
    setMapReady(true);
    return () => { setMapReady(false);line.current.setMap(null); maps.event.clearInstanceListeners(map.current); polygon.current.setMap(null); map.current = null; };
  }, [ready]);

  useEffect(() => {
    if (!map.current) return;
    polygon.current.setPath(tool === "facet" ? points : []);
    line.current.setPath(tool === "facet" ? [] : points);
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
    const overlays=[
      ...facets.filter(facet=>facet.points?.length).map(facet=>new maps.Polygon({map:map.current,paths:facet.points,strokeColor:"#34d399",fillColor:"#34d399",fillOpacity:.12})),
      ...edges.filter(edge=>edge.points?.length).map(edge=>new maps.Polyline({map:map.current,path:edge.points,strokeColor:"#60a5fa",strokeWeight:3}))
    ];
    if(facets.some(facet=>facet.points?.length) || edges.some(edge=>edge.points?.length)) {
      const bounds=new maps.LatLngBounds();
      facets.forEach(facet=>facet.points?.forEach(point=>bounds.extend(point)));
      edges.forEach(edge=>edge.points?.forEach(point=>bounds.extend(point)));
      map.current.fitBounds(bounds,24);
    }
    return()=>overlays.forEach(overlay=>overlay.setMap(null));
  },[facets,edges,ready]);

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
      setPoints([]); setDrawing(false);
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
      setPoints([]);setDrawing(false);setMessage("Edge added. Enter endpoint height difference from inspection for sloped lengths.");return;
    }
    if (points.length < 3 || pitch===null) {setMessage("Choose the inspected roof pitch before adding a facet.");return;}
    if(!validRoofOutline(points)){setMessage("Trace a valid roof outline: use distinct corners in order, without crossing edges.");return;}
    const area = window.google.maps.geometry.spherical.computeArea(points) * 10.76391041671;
    if (!Number.isFinite(area) || area < 1) { setMessage("Trace a valid facet with at least three corners."); return; }
    onFacet({ id: Date.now(), name: "Traced facet", footprintSqFt: area, pitch, points });
    setPoints([]); setDrawing(false); setMessage("Facet added to the calculator. Trace the next facet without overlapping.");
  }

  if (!key) return <div className="card"><h2>Satellite roof tracing</h2><p className="notice">Satellite imagery is awaiting the Google Maps connection.</p><p>Once connected, choose a customer to find their roof automatically, trace each roof section, select its inspected pitch, and save the measurement.</p><p className="muted">The manual measurement calculator below is available now.</p></div>;
  return <div className="card" style={{ marginBottom: 16 }}>
    <Script src={"https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(key)+"&libraries=geometry&v=weekly"} id="star-roof-google-maps" onReady={() => setReady(true)} onError={() => setMessage("Satellite map could not load. Check the API key and website restrictions.")} />
    <h2>Satellite roof tracing</h2>
    <p className="muted">Choose the customer above. Their address opens automatically; verify the roof, then trace each section once. Saved outlines reload with their measurement.</p>
    <form onSubmit={event => { event.preventDefault(); void search(query); }} className="roofToolbar">
      <div className="field" style={{ flex: 1 }}><label htmlFor="roof-address">Property address</label><input id="roof-address" value={query} onChange={event => setQuery(event.target.value)} required /></div>
      <button className="btn" disabled={!mapReady || authFailed || searching}>{searching ? "Finding…" : "Find roof"}</button>
    </form>
    <div ref={container} className="roofMap" aria-label="Satellite map for roof tracing" />
    <div className="roofToolbar">
      <div className="field"><label htmlFor="roof-tool">Trace tool</label><select id="roof-tool" value={tool} onChange={event=>{setTool(event.target.value as typeof tool);setPoints([]);setDrawing(false);setRise(0);}}><option value="facet">Roof facet</option>{["ridge","hip","valley","eave","rake"].map(kind=><option key={kind} value={kind}>{kind}</option>)}</select></div>
      {tool!=="facet" && <div className="field"><label htmlFor="edge-rise">Endpoint height difference (ft)</label><input id="edge-rise" type="number" min="0" step="0.1" value={rise} onChange={event=>setRise(Number(event.target.value))}/></div>}
      <button className="mini" disabled={!mapReady||authFailed||searching} onClick={() => setDrawing(!drawing)}>{drawing ? "Pause tracing" : "Start tracing"}</button>
      <button className="mini" disabled={!points.length} onClick={() => setPoints(current => current.slice(0,-1))}>Undo corner</button>
      <button className="mini" onClick={() => { setPoints([]); setDrawing(false); }}>Clear</button>
      <div className="field"><label htmlFor="facet-pitch">Facet pitch</label><select id="facet-pitch" value={pitch??""} onChange={event => setPitch(event.target.value===""?null:Number(event.target.value))}><option value="">Choose inspected pitch</option>{Array.from({length:13},(_,i)=><option key={i} value={i}>{i}/12</option>)}</select></div>
      <button className="btn" disabled={!mapReady||authFailed||searching||(tool==="facet"?(points.length<3||pitch===null):points.length!==2)} onClick={finish}>Add {tool} ({points.length} corners)</button>
    </div>
    <p className="small muted">For facets, trace corners in order. For edges, click two endpoints. Zero height difference gives horizontal length only. Trace each facet once. Pitch must be supplied from inspection; imagery does not determine pitch. Aerial results are estimates and need field verification.</p>
    {message && <div role="status" className="notice">{message}</div>}
  </div>;
}
