"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";
type Note={id:string;title:string;details:string;created_at:string};
export default function CustomerNotes({customerId,userId}:{customerId:string;userId:string|null}){
 const db=useMemo(()=>createClient(),[]);
 const [notes,setNotes]=useState<Note[]>([]);
 const [body,setBody]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 useEffect(()=>{let active=true;setNotes([]);setMessage("");if(!db||!userId)return;void db.from("customer_activity").select("id,title,details,created_at").eq("lead_id",customerId).eq("kind","note").order("created_at",{ascending:false}).then(({data,error})=>{if(!active)return;if(error)setMessage(error.message);else setNotes(data as Note[]);});return()=>{active=false};},[db,customerId,userId]);
 async function save(){if(!db||!userId||!body.trim()||busy)return;setBusy(true);setMessage("");try{const {data,error}=await db.from("customer_activity").insert({lead_id:customerId,user_id:userId,kind:"note",title:"Customer note",details:body.trim(),due_at:null,completed:false}).select("id,title,details,created_at").single();if(error)throw error;setNotes(current=>[data as Note,...current]);setBody("");setMessage("Dated note saved.");}catch(e){setMessage(e instanceof Error?e.message:"Could not save note.");}finally{setBusy(false);}}
 return <div className="card"><h2>Customer notes & history</h2><p className="muted">Each note is stamped with the date and time it was added. Earlier notes stay in the history.</p><div className="field"><label htmlFor="customer-new-note">Add note</label><textarea id="customer-new-note" value={body} onChange={e=>setBody(e.target.value)} placeholder="Inspection findings, customer conversations, project updates…" rows={4}/></div><button className="btn" disabled={busy||!body.trim()||!userId} onClick={()=>void save()}>{busy?"Saving…":"Add dated note"}</button>{message&&<p role="status" className="notice">{message}</p>}<h3>Note history</h3>{notes.length===0?<p className="muted">No dated notes yet.</p>:notes.map(note=><div className="activityItem" key={note.id}><strong>{new Date(note.created_at).toLocaleString()}</strong><p style={{whiteSpace:"pre-wrap"}}>{note.details}</p></div>)}</div>;
}
