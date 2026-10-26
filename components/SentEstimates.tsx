"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";

type Customer={id:string;name:string;email:string;address:string};
type Estimate={id:string;lead_id:string;customer:Customer;items:{description:string;quantity:number;rate:number}[];status?:string;status_updated_at?:string;created_at:string};
const usd=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);

export default function SentEstimates({customers,userId,cloudMode,onOpenCustomer}:{customers:Customer[];userId:string|null;cloudMode:boolean;onOpenCustomer:(id:string)=>void}){
 const supabase=useMemo(()=>createClient(),[]);
 const [records,setRecords]=useState<Estimate[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [search,setSearch]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;
  async function load(){
   setLoading(true);setError("");
   try{
    let all:Estimate[]=[];
    if(cloudMode){
     if(!supabase||!userId)throw new Error("Sign in to see sent estimates.");
     const {data,error}=await supabase.from("estimates").select("id,lead_id,customer,items,status,status_updated_at,created_at").eq("status","Sent").order("status_updated_at",{ascending:false}).limit(1000);
     if(error)throw error;
     all=(data||[]) as Estimate[];
    }else{
     for(const customer of customers){
      const raw=localStorage.getItem("richardcrm.estimates.v1."+customer.id);
      if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed))all.push(...parsed.filter((e:Estimate)=>e.status==="Sent"));}
     }
    }
    if(active)setRecords(all.sort((a,b)=>new Date(b.status_updated_at||b.created_at).getTime()-new Date(a.status_updated_at||a.created_at).getTime()));
   }catch(e){if(active)setError(e instanceof Error?e.message:"Couldn't load estimates.");}
   finally{if(active)setLoading(false);}
  }
  void load();
  return()=>{active=false};
 },[cloudMode,userId,supabase,customers,refresh]);
 const filtered=records.filter(r=>{
  const customer=customers.find(c=>c.id===r.lead_id)||r.customer;
  return [customer?.name,customer?.email,customer?.address,r.id].join(" ").toLowerCase().includes(search.toLowerCase());
 });
 const total=filtered.reduce((sum,r)=>sum+(Array.isArray(r.items)?r.items.reduce((s,i)=>s+Math.round(Number(i.quantity)*Number(i.rate)*100)/100,0):0),0);
 return <div className="card">
  <div className="sectionTitle"><h2>Sent Estimates</h2><button className="mini" disabled={loading} onClick={()=>setRefresh(v=>v+1)}>Refresh</button></div>
  <p className="muted">Saved estimates with status “Sent”. This includes manually marked estimates and does not prove email delivery. For confirmation, check your email provider's delivery logs.</p>
  <div className="field"><label htmlFor="sent-estimate-search">Search by customer, email, address or estimate ID</label><input id="sent-estimate-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search sent estimates" /></div>
  {loading?<p className="muted">Loading estimates…</p>:error?<p className="notice" role="alert">{error}</p>:<>
   <div className="kpi"><span>{filtered.length} sent estimate{filtered.length===1?"":"s"} (matching)</span><strong>{usd(total)}</strong></div>
   <div className="tableWrap"><table className="table"><thead><tr><th>Customer</th><th>Email</th><th>Estimate total</th><th>Marked sent</th><th>Action</th></tr></thead><tbody>
    {filtered.map(r=>{
     const customer=customers.find(c=>c.id===r.lead_id)||r.customer;
     const amount=Array.isArray(r.items)?r.items.reduce((s,i)=>s+Math.round(Number(i.quantity)*Number(i.rate)*100)/100,0):0;
     return <tr key={r.id}><td><strong>{customer?.name||"Unknown"}</strong><div className="small muted">{customer?.address||""}</div></td><td>{customer?.email||"—"}</td><td>{usd(amount)}</td><td>{new Date(r.status_updated_at||r.created_at).toLocaleDateString()}</td><td><button className="mini" onClick={()=>onOpenCustomer(r.lead_id)}>View estimates</button></td></tr>;
    })}
   </tbody></table></div>
   {!filtered.length&&<p className="muted">No matching sent estimates yet.</p>}
  </>}
 </div>;
}
