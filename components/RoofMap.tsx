"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

export type RoofPoint = { lat: number; lng: number };
export type TracedFacet = { id: number; name: string; footprintSqFt: number; pitch: number; points: RoofPoint[] };
// Google Maps is loaded by its hosted script; isolate its runtime interface here.
declare global { interface Window { google?: any; } }

export default function RoofMap({ address, onFacet }: { address: string; onFacet: (facet: TracedFacet) => void }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const polygon = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState(address);
  const [points, setPoints] = useState<RoofPoint[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [pitch, setPitch] = useState(6);
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const searchVersion = useRef(0);
  useEffect(() => { setQuery(address); setPoints([]); setDrawing(false); searchVersion.current++; }, [address]);

  useEffect(() => {
    if (!ready || !container.current) return;
    const maps = window.google.maps;
    map.current = new maps.Map(container.current, { center: { lat: 29.4241, lng: -98.4936 }, zoom: 19, mapTypeId: "satellite", tilt: 0, heading: 0, streetViewControl: false, rotateControl: false });
    polygon.current = new maps.Polygon({ map: map.current, strokeColor: "#ff9f1c", fillColor: "#ff9f1c", fillOpacity: 0.25 });
    return () => { maps.event.clearInstanceListeners(map.current); polygon.current.setMap(null); map.current = null; };
  }, [ready]);

  useEffect(() => {
    if (!map.current) return;
    polygon.current.setPath(points);
    map.current.setOptions({ draggableCursor: drawing ? "crosshair" : undefined, disableDoubleClickZoom: drawing });
    if (!drawing) return;
    const listener = map.current.addListener("click", (event: any) => {
      if (event.latLng) setPoints(current => [...current, event.latLng.toJSON()]);
    });
    return () => listener.remove();
  }, [points, drawing, ready]);

  async function search() {
    if (!query.trim() || !map.current) return;
    const version = ++searchVersion.current;
    setSearching(true); setMessage("");
    try {
      const result = await new window.google.maps.Geocoder().geocode({ address: query });
      if (version !== searchVersion.current) return;
      const location = result.results[0];
      if (!location) throw new Error("No matching address.");
      map.current.setCenter(location.geometry.location); map.current.setZoom(20);
      setPoints([]); setDrawing(false);
      setMessage("Confirm this is the correct roof before tracing. " + location.formatted_address);
    } catch { if (version === searchVersion.current) setMessage("Address search failed. Check the address and Geocoding API setup."); }
    finally { setSearching(false); }
  }

  function finish() {
    if (points.length < 3) return;
    const area = window.google.maps.geometry.spherical.computeArea(points) * 10.76391041671;
    if (!Number.isFinite(area) || area < 1) { setMessage("Trace a valid facet with at least three corners."); return; }
    // Reject crossing edges in this small roof footprint using longitude/latitude as a local plane.
    const orientation = (a: RoofPoint,b: RoofPoint,c: RoofPoint) => (b.lng-a.lng)*(c.lat-a.lat)-(b.lat-a.lat)*(c.lng-a.lng);
    for (let i=0;i<points.length;i++) for (let j=i+2;j<points.length;j++) {
      if (i===0 && j===points.length-1) continue;
      const a=points[i], b=points[(i+1)%points.length], c=points[j], d=points[(j+1)%points.length];
      if (orientation(a,b,c)*orientation(a,b,d)<0 && orientation(c,d,a)*orientation(c,d,b)<0) { setMessage("Edges cross. Undo corners and trace around the facet in order."); return; }
    }
    onFacet({ id: Date.now(), name: "Traced facet", footprintSqFt: area, pitch, points });
    setPoints([]); setDrawing(false); setMessage("Facet added to the calculator. Trace the next facet without overlapping.");
  }

  if (!key) return <div className="notice">Satellite tracing needs a Google Maps API key. The manual calculator works now. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY with Maps JavaScript and Geocoding enabled to activate this workspace.</div>;
  return <div className="card" style={{ marginBottom: 16 }}>
    <Script src={"https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(key)+"&libraries=geometry&v=weekly"} onReady={() => setReady(true)} onError={() => setMessage("Satellite map could not load. Check the API key and website restrictions.")} />
    <h2>Satellite roof tracing</h2>
    <form onSubmit={event => { event.preventDefault(); void search(); }} className="roofToolbar">
      <div className="field" style={{ flex: 1 }}><label htmlFor="roof-address">Property address</label><input id="roof-address" value={query} onChange={event => setQuery(event.target.value)} required /></div>
      <button className="btn" disabled={!ready || searching}>{searching ? "Finding…" : "Find roof"}</button>
    </form>
    <div ref={container} className="roofMap" aria-label="Satellite map for roof tracing" />
    <div className="roofToolbar">
      <button className="mini" disabled={!ready} onClick={() => setDrawing(!drawing)}>{drawing ? "Pause tracing" : "Trace facet"}</button>
      <button className="mini" disabled={!points.length} onClick={() => setPoints(current => current.slice(0,-1))}>Undo corner</button>
      <button className="mini" onClick={() => { setPoints([]); setDrawing(false); }}>Clear</button>
      <div className="field"><label htmlFor="facet-pitch">Facet pitch</label><select id="facet-pitch" value={pitch} onChange={event => setPitch(Number(event.target.value))}>{Array.from({length:13},(_,i)=><option key={i} value={i}>{i}/12</option>)}</select></div>
      <button className="btn" disabled={points.length<3} onClick={finish}>Add facet ({points.length} corners)</button>
    </div>
    <p className="small muted">Click corners around one roof facet in order, then Add facet. Trace each facet once. Pitch must be supplied from inspection; imagery does not determine pitch. Aerial results are estimates and need field verification.</p>
    {message && <div role="status" className="notice">{message}</div>}
  </div>;
}
