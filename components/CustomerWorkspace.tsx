"use client";
import CustomerOverview from "@/components/CustomerOverview";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Customer = { id:string; name:string; address:string; phone:string };
type Entry = { id:string; lead_id:string; kind:"appointment"|"task"|"note"; title:string; details:string; due_at:string|null; completed:boolean; created_at:string };
type Attachment = { name:string; id?:string|null; created_at?:string|null };
const bucket = "customer-files";
const allowedTypes = ["image/jpeg","image/png","image/webp","application/pdf"];
const localDateValue = (date: Date) => {
  const pad=(n:number)=>String(n).padStart(2,"0");
  return date.getFullYear()+"-"+pad(date.getMonth()+1)+"-"+pad(date.getDate())+"T"+pad(date.getHours())+":"+pad(date.getMinutes());
};

export default function CustomerWorkspace({customers,userId,initialCustomerId="",onSelect,onOpen}:{customers:Customer[];userId:string|null;initialCustomerId?:string;onSelect?:(id:string)=>void;onOpen?:(tab:string)=>void}) {
  const supabase=useMemo(()=>createClient(),[]);
  const [customerId,setCustomerId]=useState(initialCustomerId);
  const [entries,setEntries]=useState<Entry[]>([]);
  const [files,setFiles]=useState<Attachment[]>([]);
  const [kind,setKind]=useState<Entry["kind"]>("task");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [view,setView]=useState("Upcoming");
  const prefix=userId+"/"+customerId;
  const customer=customers.find(item=>item.id===customerId);
  const rawPhone=customer?.phone.trim() || "";
  const phoneDigits=rawPhone.replace(/[^0-9]/g,"");
  const plainPhone=/^\+?[0-9\s().-]+$/.test(rawPhone);
  const contactNumber=plainPhone ? (phoneDigits.length===10 ? "+1"+phoneDigits : phoneDigits.length===11&&phoneDigits.startsWith("1") ? "+"+phoneDigits : rawPhone.startsWith("+")&&/^[1-9]\d{7,14}$/.test(phoneDigits) ? "+"+phoneDigits : null) : null;

  useEffect(()=>{
    let active=true;
    setEntries([]);setFiles([]);setMessage("");
    if(!supabase || !userId || !customerId) return;
    setLoading(true);
    Promise.all([
      supabase.from("customer_activity").select("*").eq("lead_id",customerId).order("created_at",{ascending:false}),
      supabase.storage.from(bucket).list(userId+"/"+customerId,{limit:100,sortBy:{column:"created_at",order:"desc"}})
    ]).then(([activity,attachments])=>{
      if(!active)return;
      if(activity.error || attachments.error) throw activity.error || attachments.error;
      setEntries(activity.data as Entry[]);setFiles(attachments.data || []);
    }).catch(error=>{if(active)setMessage(error.message || "Unable to load customer workspace.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[customerId,userId,supabase]);

  async function addEntry(form:FormData) {
    if(!supabase || !userId || !customer)return;
    const due=String(form.get("due") || "");
    const title=String(form.get("title") || "").trim();
    if(!title || (kind!=="note" && !due)) {setMessage("Add a title and date/time for appointments or follow-ups.");return;}
    const date=due?new Date(due):null;
    if(date && !Number.isFinite(date.getTime())) {setMessage("Enter a valid date and time.");return;}
    setBusy(true);
    try {
      const {data,error}=await supabase.from("customer_activity").insert({
        user_id:userId,lead_id:customer.id,kind,title,details:String(form.get("details")||""),
        due_at:kind==="note"?null:date?.toISOString(),completed:false
      }).select().single();
      if(error)throw error;
      setEntries(current=>[data as Entry,...current]);
      setMessage("Saved to this customer's activity history.");
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to save activity.");}
    finally{setBusy(false);}
  }

  async function toggleEntry(entry:Entry) {
    if(!supabase)return;
    setBusy(true);
    try {
      const {error}=await supabase.from("customer_activity").update({completed:!entry.completed}).eq("id",entry.id).select("id").single();
      if(error)throw error;
      setEntries(current=>current.map(item=>item.id===entry.id?{...item,completed:!item.completed}:item));
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to update activity.");}
    finally{setBusy(false);}
  }

  async function upload(file:File|undefined) {
    if(!file || !supabase || !customer || !userId)return;
    if(!allowedTypes.includes(file.type) || file.size>10*1024*1024) {setMessage("Choose JPG, PNG, WebP or PDF files up to 10 MB.");return;}
    setBusy(true);
    const filename=crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
    try {
      const {error}=await supabase.storage.from(bucket).upload(prefix+"/"+filename,file,{contentType:file.type,upsert:false});
      if(error)throw error;
      setFiles(current=>[{name:filename,created_at:new Date().toISOString()},...current]);
      setMessage("Private customer file uploaded.");
    }catch(error){setMessage(error instanceof Error?error.message:"Upload failed.");}
    finally{setBusy(false);}
  }

  async function openFile(file:Attachment) {
    if(!supabase)return;
    // Reserve the window during the user gesture to avoid popup blocking after the request.
    const popup=window.open("about:blank","_blank");
    if(!popup){setMessage("Allow popups to open customer files.");return;}
    popup.opener=null;
    const {data,error}=await supabase.storage.from(bucket).createSignedUrl(prefix+"/"+file.name,60);
    if(error || !data){popup.close();setMessage(error?.message || "Could not open file.");return;}
    popup.location.href=data.signedUrl;
  }

  async function deleteFile(file:Attachment) {
    if(!supabase || !window.confirm("Permanently delete this uploaded customer file?"))return;
    setBusy(true);
    const {error}=await supabase.storage.from(bucket).remove([prefix+"/"+file.name]);
    if(error)setMessage(error.message);
    else {setFiles(current=>current.filter(item=>item.name!==file.name));setMessage("File deleted.");}
    setBusy(false);
  }

  function calendarFile(entry:Entry) {
    if(!entry.due_at || !customer)return;
    const stamp=(date:Date)=>date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
    const escape=(value:string)=>value.replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
    const start=new Date(entry.due_at),end=new Date(start.getTime()+60*60*1000);
    const content=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//RichardCRM//Appointments//EN","BEGIN:VEVENT",
      "UID:"+entry.id+"@richardcrm","DTSTAMP:"+stamp(new Date()),"DTSTART:"+stamp(start),"DTEND:"+stamp(end),
      "SUMMARY:"+escape(entry.title),"LOCATION:"+escape(customer.address),"DESCRIPTION:"+escape(entry.details),
      "END:VEVENT","END:VCALENDAR"].join("\r\n");
    const url=URL.createObjectURL(new Blob([content],{type:"text/calendar"}));
    const link=document.createElement("a");link.href=url;link.download="inspection.ics";link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  const visible=entries.filter(entry=>view==="History" || (!entry.completed && entry.kind!=="note"))
    .sort((a,b)=>view==="History"?b.created_at.localeCompare(a.created_at):(a.due_at||"").localeCompare(b.due_at||""));
  return <div className="grid">
    <div className="card"><h2>Appointments, follow-ups & customer files</h2>
      <div className="field"><label htmlFor="workspace-customer">Customer / property</label><select id="workspace-customer" disabled={busy} value={customerId} onChange={event=>{setCustomerId(event.target.value);onSelect?.(event.target.value);}}><option value="">Choose a customer</option>{customers.map(item=><option key={item.id} value={item.id}>{item.name} — {item.address}</option>)}</select></div>
      {customer && <div style={{marginTop:16}}><p><strong>{customer.name}</strong><br/>{rawPhone || "No phone number saved"}</p>{contactNumber ? <><div className="roofToolbar"><a className="btn" href={"tel:"+contactNumber} aria-label={"Call "+customer.name}>Call customer</a><a className="btn secondary" href={"sms:"+contactNumber} aria-label={"Text "+customer.name}>Text customer</a></div><p className="small muted">Opens your device’s calling or messaging app. Calls and texts are not sent or logged automatically; desktop support depends on your installed apps.</p></> : <p className="muted">Add a valid phone number in Customers to enable Call and Text. Use a 10-digit US number or an international number beginning with +.</p>}</div>}
      {message && <p className="notice" role="status" style={{marginTop:16}}>{message}</p>}
      {loading && <p role="status">Loading customer activity…</p>}
    </div>
    {customer && onOpen && <CustomerOverview customerId={customer.id} userId={userId} onOpen={onOpen}/>}
    {customer && <><div className="card"><h3>Add to customer history</h3>
      <form action={addEntry} key={customerId+"-"+kind}>
        <div className="formGrid">
          <div className="field"><label htmlFor="activity-kind">Type</label><select id="activity-kind" value={kind} onChange={event=>setKind(event.target.value as Entry["kind"])}><option value="task">Follow-up task</option><option value="appointment">Inspection appointment</option><option value="note">Activity note</option></select></div>
          <div className="field"><label htmlFor="activity-title">Title</label><input id="activity-title" name="title" required maxLength={200} placeholder={kind==="appointment"?"Roof inspection":"Call about estimate"}/></div>
          {kind!=="note" && <div className="field"><label htmlFor="activity-due">Date & time (your device's time zone)</label><input id="activity-due" name="due" type="datetime-local" required defaultValue={localDateValue(new Date())}/></div>}
          <div className="field full"><label htmlFor="activity-details">Details</label><textarea id="activity-details" name="details"/></div>
        </div><div className="actions"><button className="btn" disabled={busy || loading}>Save {kind==="task"?"follow-up":kind}</button></div>
      </form>
    </div>
    <div className="card"><div className="sectionTitle"><h3 style={{margin:0}}>{view==="History"?"Customer activity history":"Upcoming & overdue"}</h3><button className="mini" onClick={()=>setView(view==="History"?"Upcoming":"History")}>{view==="History"?"Show upcoming":"Show history"}</button></div>
      <p className="small muted">Follow-ups appear here when you open the CRM. No automatic emails, texts or push notifications are sent.</p>
      {visible.map(entry=><div className="activityItem" key={entry.id}>
        <div><span className="badge">{entry.kind}</span> <strong>{entry.title}</strong>
          <div className="small muted">{entry.due_at?new Date(entry.due_at).toLocaleString():"Added "+new Date(entry.created_at).toLocaleString()}{entry.completed?" · Completed":entry.due_at && new Date(entry.due_at)<new Date()?" · Overdue":""}</div>
          <p style={{whiteSpace:"pre-wrap",margin:"8px 0"}}>{entry.details}</p></div>
        <div className="leadActions">{entry.kind!=="note" && <button className="mini" disabled={busy} onClick={()=>toggleEntry(entry)}>{entry.completed?"Reopen":"Mark complete"}</button>}{entry.kind==="appointment" && <button className="mini" onClick={()=>calendarFile(entry)}>Add to calendar</button>}</div>
      </div>)}
      {!visible.length && <p className="muted">No activity in this view.</p>}
    </div>
    <div className="card"><h3>Private photos & documents</h3>
      <div className="field"><label htmlFor="customer-upload">Upload JPG, PNG, WebP or PDF · max 10 MB</label><input id="customer-upload" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" disabled={busy || loading} onChange={event=>{void upload(event.target.files?.[0]);event.target.value="";}}/></div>
      {files.map(file=><div className="kpi" key={file.name}><span style={{overflowWrap:"anywhere"}}>{file.name.slice(37)}</span><div className="leadActions"><button className="mini" onClick={()=>openFile(file)}>Open</button><button className="mini" disabled={busy} onClick={()=>deleteFile(file)}>Delete</button></div></div>)}
      {!files.length && <p className="muted" style={{marginTop:16}}>No customer files uploaded.</p>}
      {files.length>=100 && <p className="notice">Showing the latest 100 files.</p>}
    </div></>}
  </div>;
}
