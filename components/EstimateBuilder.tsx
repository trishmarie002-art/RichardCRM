"use client";
import MaterialTemplates from "@/components/MaterialTemplates";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Customer = { id: string; name: string; address: string; email: string; phone: string };
type Item = { id: string; description: string; quantity: number; rate: number };
const estimateStatuses = ["Draft", "Sent", "Accepted", "Declined"] as const;
type EstimateStatus = typeof estimateStatuses[number];
type Proposal = {company:string;phone:string;email:string;website:string;serviceArea:string;logo:string;warranty:string;exclusions:string;paymentTerms:string};
const brand = {company:"Star Roofing LLC",phone:"(210) 264-5707",email:"starroofing10@gmail.com",website:"https://starroofingtx.com",serviceArea:"San Antonio, Texas & surrounding areas",logo:"https://starroofingtx.com/wp-content/uploads/2024/09/2021-01-29__1_-removebg-preview.png"};
type Estimate = { proposal?: Proposal; status?: EstimateStatus; status_updated_at?: string; id: string; lead_id: string; customer: Customer; items: Item[]; notes: string; created_at: string };
const currency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const initialItem = (): Item => ({ id: crypto.randomUUID(), description: "Roof replacement — per square", quantity: 0, rate: 0 });

export default function EstimateBuilder({ customers, userId, cloudMode }: { customers: Customer[]; userId: string | null; cloudMode: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [notes, setNotes] = useState("");
  const [warranty,setWarranty]=useState("");
  const [exclusions,setExclusions]=useState("");
  const [paymentTerms,setPaymentTerms]=useState("");
  const [history, setHistory] = useState<Estimate[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const customer = customers.find(item => item.id === customerId);
  const total = items.reduce((sum, item) => sum + Math.round(item.quantity * item.rate * 100) / 100, 0);

  useEffect(() => {
    let active = true;
    setHistory([]); setItems([]); setNotes(""); setWarranty("");setExclusions("");setPaymentTerms(""); setReady(false); setMessage("");
    async function load() {
      try {
        if (!customerId) return;
        if (cloudMode) {
          if (!supabase || !userId) throw new Error("Sign in before opening estimates.");
          const { data, error } = await supabase.from("estimates").select("*").eq("lead_id",customerId).order("created_at",{ascending:false});
          if (error) throw error;
          if (active) setHistory(data as Estimate[]);
        } else {
          const stored = localStorage.getItem("richardcrm.estimates.v1." + customerId);
          if (active && stored) setHistory(JSON.parse(stored));
        }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "Could not load estimates."); }
      finally { if (active) setReady(true); }
    }
    void load();
    return () => { active = false; };
  }, [customerId, cloudMode, supabase, userId]);

  async function useMeasurement() {
    if (!customer) return;
    setBusy(true);
    try {
      let squares = 0;
      if (cloudMode && supabase) {
        const { data, error } = await supabase.from("roof_measurements").select("roofing_squares").eq("lead_id",customerId).order("created_at",{ascending:false}).limit(1).maybeSingle();
        if (error) throw error;
        squares = Number(data?.roofing_squares || 0);
      } else {
        const stored = localStorage.getItem("richardcrm.measurements.local." + customerId);
        squares = stored ? Number(JSON.parse(stored).roofing_squares) : 0;
      }
      if (!Number.isFinite(squares) || squares <= 0) throw new Error("Save a roof measurement for this customer first.");
      setItems(current => [...current, {...initialItem(), quantity: Math.round(squares*100)/100}]);
      setMessage("Saved measurement added, including its waste allowance. Enter your price per square.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load roof quantity."); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!customer || !items.length || items.some(item => !item.description.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.rate) || item.rate < 0)) {
      setMessage("Choose a customer and add items with descriptions, positive quantities and nonnegative prices."); return;
    }
    setBusy(true);
    const record: Estimate = { id: crypto.randomUUID(), lead_id:customer.id, customer:{...customer}, items, notes, proposal:{...brand,warranty,exclusions,paymentTerms}, status:"Draft", created_at:new Date().toISOString() };
    try {
      if (cloudMode) {
        if (!supabase || !userId) throw new Error("Sign in before saving.");
        const {error} = await supabase.from("estimates").insert({...record,user_id:userId});
        if (error) throw error;
      } else localStorage.setItem("richardcrm.estimates.v1."+customer.id,JSON.stringify([record,...history]));
      setHistory(current => [record,...current]);
      setMessage("Estimate saved. Printing does not email it or change the pipeline stage.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save estimate."); }
    finally { setBusy(false); }
  }

  async function updateStatus(record: Estimate, status: EstimateStatus) {
    if (busy || !estimateStatuses.includes(status) || !window.confirm(`Record this estimate as ${status}? This records your decision only; it does not contact the customer or change the lead pipeline.`)) return;
    setBusy(true);
    try {
      const change = {status, status_updated_at:new Date().toISOString()};
      if (cloudMode) {
        if (!supabase || !userId) throw new Error("Sign in before updating an estimate.");
        const {error} = await supabase.from("estimates").update(change).eq("id",record.id).select("id").single();
        if (error) throw error;
      }
      const updated = history.map(item=>item.id===record.id?{...item,...change}:item);
      if (!cloudMode) localStorage.setItem("richardcrm.estimates.v1."+record.lead_id,JSON.stringify(updated));
      setHistory(updated);
      setMessage(`Estimate marked ${status}. Update the lead pipeline separately when appropriate.`);
    } catch (error) { setMessage(error instanceof Error?error.message:"Could not update estimate status."); }
    finally { setBusy(false); }
  }

  function revise(record: Estimate) {
    setItems(record.items.map(item=>({...item,id:crypto.randomUUID()})));
    setNotes(record.notes);
    setWarranty(record.proposal?.warranty||"");setExclusions(record.proposal?.exclusions||"");setPaymentTerms(record.proposal?.paymentTerms||"");
    setMessage("Saved estimate copied into the builder. Make your changes and Save estimate to create a new Draft; the original quote stays unchanged.");
  }

  function printEstimate(record: Estimate) {
    const popup = window.open("", "_blank");
    if (!popup) { setMessage("Allow popups to print the estimate."); return; }
    // User content is escaped before being included in the printable document.
    const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[char]!));
    const proposal=record.proposal || {...brand,warranty:"",exclusions:"",paymentTerms:""};
    const amount = record.items.reduce((sum,item)=>sum+Math.round(item.quantity*item.rate*100)/100,0);
    popup.document.write("<!doctype html><html><head><title>Star Roofing proposal</title><style>body{font:16px system-ui;margin:48px;color:#172334}h1{border-bottom:3px solid #b22222;padding-bottom:16px}header{display:flex;gap:24px;align-items:center}header img{max-width:170px;max-height:120px;object-fit:contain}h2{font-size:18px;margin-top:28px}tr{break-inside:avoid}@media print{body{margin:24px}}table{width:100%;border-collapse:collapse;margin:28px 0}td,th{text-align:left;padding:12px 6px;border-bottom:1px solid #ccc}p{white-space:pre-wrap}.total{text-align:right;font-size:24px}</style></head><body><header><img alt=\"Star Roofing logo\" src=\""+esc(proposal.logo)+"\"><div><h1>"+esc(proposal.company)+" — Proposal</h1><p>"+esc(proposal.phone)+"<br>"+esc(proposal.email)+"<br>"+esc(proposal.website)+"<br>"+esc(proposal.serviceArea)+"</p></div></header><h2>Prepared for</h2><p>"+esc(record.customer.name)+"\n"+esc(record.customer.address)+"\n"+esc(record.customer.phone)+"\n"+esc(record.customer.email)+"</p><p>Date: "+esc(new Date(record.created_at).toLocaleDateString())+"</p><table><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>"+record.items.map(item=>"<tr><td>"+esc(item.description)+"</td><td>"+item.quantity+"</td><td>"+currency(item.rate)+"</td><td>"+currency(Math.round(item.quantity*item.rate*100)/100)+"</td></tr>").join("")+"</tbody></table><p class=total>Total: "+currency(amount)+"</p><h2>Scope of work</h2><p>"+esc(record.notes||"Scope to be confirmed.")+"</p><h2>Warranty</h2><p>"+esc(proposal.warranty||"Warranty terms have not been specified.")+"</p><h2>Exclusions</h2><p>"+esc(proposal.exclusions||"Exclusions have not been specified.")+"</p><h2>Payment terms</h2><p>"+esc(proposal.paymentTerms||"Payment terms have not been specified.")+"</p><p>Estimate only. Final scope and pricing require confirmation.</p></body></html>");
    popup.document.close();
    const logo=popup.document.querySelector("img");
    let printed=false;
    const finish=()=>{if(printed||popup.closed)return;printed=true;popup.focus();popup.print();};
    if(logo&&!logo.complete){logo.onload=finish;logo.onerror=()=>{logo.remove();finish();};setTimeout(finish,4000);}else{if(logo&&logo.naturalWidth===0)logo.remove();finish();}
  }

  return <div className="card">
    <h2>Roofing estimate builder</h2>
    <div className="field"><label htmlFor="estimate-customer">Customer / property</label><select id="estimate-customer" disabled={busy} value={customerId} onChange={event=>setCustomerId(event.target.value)}><option value="">Choose a customer</option>{customers.map(item=><option key={item.id} value={item.id}>{item.name} — {item.address}</option>)}</select></div>
    <div className="roofToolbar"><button className="btn secondary" disabled={!customer || !ready || busy} onClick={()=>setItems(current=>[...current,initialItem()])}>Add line item</button><button className="btn secondary" disabled={!customer || !ready || busy} onClick={useMeasurement}>Use saved roof squares</button></div>
    <MaterialTemplates userId={userId} cloudMode={cloudMode} items={items} disabled={busy || !ready || !customer} onApply={added=>setItems(current=>[...current,...added])}/>
    {items.map((item,index)=><div className="measureRow" key={item.id}>
      <div className="field"><label htmlFor={"desc-"+item.id}>Description</label><input id={"desc-"+item.id} value={item.description} onChange={event=>setItems(current=>current.map(row=>row.id===item.id?{...row,description:event.target.value}:row))}/></div>
      <div className="field"><label htmlFor={"qty-"+item.id}>Quantity</label><input id={"qty-"+item.id} type="number" min="0" step="0.01" value={item.quantity} onChange={event=>setItems(current=>current.map(row=>row.id===item.id?{...row,quantity:Number(event.target.value)}:row))}/></div>
      <div className="field"><label htmlFor={"rate-"+item.id}>Unit price ($)</label><input id={"rate-"+item.id} type="number" min="0" step="0.01" value={item.rate} onChange={event=>setItems(current=>current.map(row=>row.id===item.id?{...row,rate:Number(event.target.value)}:row))}/></div>
      <button className="mini" aria-label={"Remove line item "+(index+1)} onClick={()=>setItems(current=>current.filter(row=>row.id!==item.id))}>Remove</button>
    </div>)}
    <div className="field" style={{marginTop:16}}><label htmlFor="estimate-notes">Scope of work</label><textarea id="estimate-notes" value={notes} onChange={event=>setNotes(event.target.value)}/></div>
    <p className="muted">Proposals use Star Roofing LLC’s website contact details. Enter the terms agreed for this specific job.</p>
    {[{key:"warranty",label:"Warranty",value:warranty,set:setWarranty},{key:"exclusions",label:"Exclusions",value:exclusions,set:setExclusions},{key:"payment",label:"Payment terms",value:paymentTerms,set:setPaymentTerms}].map(field=><div className="field" key={field.key}><label htmlFor={"proposal-"+field.key}>{field.label}</label><textarea id={"proposal-"+field.key} value={field.value} disabled={busy} onChange={event=>field.set(event.target.value)}/></div>)}
    <div className="kpi"><span>Estimate total</span><strong>{currency(total)}</strong></div>
    <button className="btn" disabled={busy || !ready || !customer || !items.length} onClick={save}>{busy?"Working…":"Save estimate"}</button>
    {message && <p className="notice" role="status" style={{marginTop:16}}>{message}</p>}
    <h3 style={{marginTop:24}}>Saved estimates</h3><p className="muted">Record customer decisions here after confirming them. Status changes do not send messages, collect signatures, or update the lead pipeline.</p>
    {history.map(record=><div className="card" key={record.id} style={{marginTop:12}}>
      <div className="kpi"><span>{new Date(record.created_at).toLocaleDateString()} — {currency(record.items.reduce((sum,item)=>sum+Math.round(item.quantity*item.rate*100)/100,0))}</span><strong>{record.status || "Draft"}</strong></div>
      <div className="field"><label htmlFor={"status-"+record.id}>Estimate status</label><select id={"status-"+record.id} disabled={busy} value={record.status || "Draft"} onChange={event=>void updateStatus(record,event.target.value as EstimateStatus)}>{estimateStatuses.map(status=><option key={status}>{status}</option>)}</select></div>
      {record.status_updated_at && <p className="small muted">Last status update: {new Date(record.status_updated_at).toLocaleString()}</p>}
      <div className="roofToolbar"><button className="mini" disabled={busy} onClick={()=>revise(record)}>Create revision</button><button className="mini" onClick={()=>printEstimate(record)}>Print / save PDF</button></div>
    </div>)}
    {!history.length && <p className="muted">No saved estimates for this customer.</p>}
  </div>;
}
