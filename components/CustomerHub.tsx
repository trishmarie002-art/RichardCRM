"use client";
import {useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import CustomerOverview from "@/components/CustomerOverview";
import CustomerWorkspace from "@/components/CustomerWorkspace";
import EstimateBuilder from "@/components/EstimateBuilder";
import Jobs from "@/components/Jobs";
import Invoices from "@/components/Invoices";
import LeadFiles from "@/components/LeadFiles";
import CustomerNotes from "@/components/CustomerNotes";

type Customer={id:string;estimate_amount?:number|null;estimate_created_on?:string|null;user_id?:string;name:string;address:string;phone:string;email:string;status:string;source:string;value:number;notes:string;job_type?:string;salesperson?:string;created_at?:string;completed_at?:string|null;additional_contacts?:{name:string;role:string;phone:string;email:string}[]};
type Section="Overview"|"Notes"|"Activity & Appointments"|"Photos"|"Documents"|"Estimates"|"Jobs"|"Invoices & Payments";
const sections:Section[]=["Overview","Notes","Activity & Appointments","Photos","Documents","Estimates","Jobs","Invoices & Payments"];
const usd=(v:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(v||0);
export default function CustomerHub({customer,userId,cloudMode,onBack,onEdit,onMeasure,onEstimateSaved,onLostBid,onRestoreBid}:{customer:Customer;userId:string|null;cloudMode:boolean;onBack:()=>void;onEdit:()=>void;onMeasure:()=>void;onEstimateSaved?:(date:string|null,amount:number|null)=>void;onLostBid?:()=>void;onRestoreBid?:()=>void}){
 const [section,setSection]=useState<Section>("Overview");
 const [showFullDetails,setShowFullDetails]=useState(false);
 const db=useMemo(()=>createClient(),[]);
 const [estimateDate,setEstimateDate]=useState(customer.estimate_created_on||"");
 const [estimateAmount,setEstimateAmount]=useState(customer.estimate_amount==null?"":String(customer.estimate_amount));
 const [estimateSaving,setEstimateSaving]=useState(false);
 const [estimateMessage,setEstimateMessage]=useState("");
 async function saveManualEstimate(){
  const amountText=estimateAmount.trim();
  const amount=amountText===""?null:Number(amountText);
  if(amount!==null&&(!Number.isFinite(amount)||amount<0||amount>9999999999.99||!/^\d+(?:\.\d{1,2})?$/.test(amountText))){
   setEstimateMessage("Enter a valid estimate amount with up to two decimal places.");return;
  }
  if(estimateDate&&!/^\d{4}-\d{2}-\d{2}$/.test(estimateDate)){setEstimateMessage("Choose a valid estimate date.");return;}
  setEstimateSaving(true);setEstimateMessage("");
  try{
   if(cloudMode){
    if(!db||!userId)throw Error("Sign in to save an estimate amount.");
    const {data,error}=await db.from("leads").update({estimate_created_on:estimateDate||null,estimate_amount:amount,updated_at:new Date().toISOString()}).eq("id",customer.id).select("id").single();
    if(error)throw error;
    if(!data)throw Error("Estimate amount was not saved.");
   }
   onEstimateSaved?.(estimateDate||null,amount);
   setEstimateMessage("Estimate details saved. The dashboard Open Pipeline now uses this amount for open leads.");
  }catch(error){setEstimateMessage(error instanceof Error?error.message:"Could not save estimate details.");}
  finally{setEstimateSaving(false);}
 }
 // Passing only the selected customer also restricts the embedded forms to this customer.
 const onlyCustomer=[customer];
 function open(sectionName:string){
  if(sectionName==="Invoices")setSection("Invoices & Payments");
  else if(sectionName==="Estimates"||sectionName==="Jobs")setSection(sectionName);
 }
 return <div>
  <div className="card customerHubSummary" style={{padding:14,marginBottom:12}}>
   <div className="roofToolbar customerHubActions" style={{marginBottom:8,display:"flex",flexWrap:"wrap",gap:8}}><button className="mini" onClick={onBack}>← All customers</button><button className="mini" onClick={onEdit}>Edit customer</button>{customer.status==="Lost"&&!customer.completed_at?<button className="mini" onClick={onRestoreBid}>Restore Bid</button>:!customer.completed_at&&<button className="mini" onClick={onLostBid}>Lost Bids</button>}</div>
   <div className="customerHubHeading">
    <div>
     <h2 className="customerHubName">{customer.name||"Unnamed customer"}</h2>
     <p className="customerHubAddress">{customer.address||"Property address not entered"}</p>
    </div>
    <span className="badge customerHubStatus">{customer.status||"No stage"}{customer.completed_at?" · Completed":""}</span>
   </div>
   <div className="customerHubQuickDetails" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:8}}>
    <div><span>Phone</span><strong>{customer.phone||"Not provided"}</strong></div>
    <div><span>Email</span><strong>{customer.email||"Not provided"}</strong></div>
    <div><span>Job type</span><strong>{customer.job_type||"Not set"}</strong></div>
    <div><span>Salesperson</span><strong>{customer.salesperson||"Unassigned"}</strong></div>
   </div>
   {customer.additional_contacts&&customer.additional_contacts.length>0&&<div style={{marginTop:12}}><strong>Additional contacts</strong><div className="customerHubQuickDetails" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8,marginTop:6}}>{customer.additional_contacts.map((person,index)=><div key={index} style={{padding:"8px 10px",border:"1px solid #dce2eb",borderRadius:8}}><span style={{display:"block",fontSize:12}}>{person.role||"Additional contact"}</span><strong>{person.name||"Name not provided"}</strong><div style={{fontSize:12}}>{person.phone||"No phone"} · {person.email||"No email"}</div></div>)}</div></div>}
    <div className="customerHubBottomActions">
    <div className="roofToolbar">
     {customer.phone&&<a className="btn secondary" href={"tel:"+customer.phone}>Call</a>}
     {customer.email&&<a className="btn secondary" href={"mailto:"+customer.email}>Email</a>}
    </div>
    <button className="mini" type="button" aria-expanded={showFullDetails} onClick={()=>setShowFullDetails(v=>!v)}>{showFullDetails?"Hide extra details ▲":"More customer details ▼"}</button>
   </div>
   {showFullDetails&&<div className="customerHubExpanded">
    <div className="customerHubQuickDetails">
     <div><span>Lead source</span><strong>{customer.source||"Other"}</strong></div>
     <div><span>Lead created</span><strong>{customer.created_at?new Date(customer.created_at).toLocaleDateString():"Not recorded"}</strong></div>
     <div><span>Estimate amount</span><strong>{customer.estimate_amount==null?"Not entered":usd(customer.estimate_amount)}</strong></div>
    </div>
    {customer.notes&&<p style={{whiteSpace:"pre-wrap",marginTop:12}}><strong>Original lead notes:</strong> {customer.notes}</p>}
    
   </div>}
  </div>
  <div className="card" style={{marginBottom:16}}>
   <h3>Estimate created & amount</h3>
   <p className="muted">Manually record when the estimate was created and the quoted amount. This amount counts toward Open Pipeline while the lead is open. It does not generate or send an estimate.</p>
   <div className="formGrid">
    <div className="field"><label htmlFor="customer-actual-estimate-date">Estimate created (date)</label><input id="customer-actual-estimate-date" type="date" value={estimateDate} disabled={estimateSaving} onChange={e=>setEstimateDate(e.target.value)}/></div>
    <div className="field"><label htmlFor="customer-actual-estimate-amount">Estimate amount ($)</label><input id="customer-actual-estimate-amount" type="number" min="0" max="9999999999.99" step="0.01" placeholder="Enter amount" value={estimateAmount} disabled={estimateSaving} onChange={e=>setEstimateAmount(e.target.value)}/></div>
   </div>
   <div className="roofToolbar"><button className="btn" type="button" disabled={estimateSaving} onClick={()=>void saveManualEstimate()}>{estimateSaving?"Saving…":"Save Estimate Details"}</button></div>
   {estimateMessage&&<p className="notice" role="status">{estimateMessage}</p>}
  </div>
  <div className="roofToolbar" role="group" aria-label="Customer page sections" style={{marginBottom:16}}>
   {sections.map(item=><button key={item} type="button" className={section===item?"btn":"btn secondary"} aria-pressed={section===item} onClick={()=>setSection(item)}>{item}</button>)}
   <button type="button" className="btn secondary" onClick={()=>setSection("Jobs")}>Subcontractor / Job Crew</button>
    <button type="button" className="btn secondary" onClick={onMeasure}>Roof Measurements</button>
  </div>
  {section==="Overview"&&<CustomerOverview key={customer.id} customerId={customer.id} userId={userId} onOpen={open}/>}
  {section==="Notes"&&<CustomerNotes key={customer.id} customerId={customer.id} userId={userId}/>}
  {section==="Activity & Appointments"&&<CustomerWorkspace key={customer.id} customers={onlyCustomer} userId={userId} initialCustomerId={customer.id}/>}
  {section==="Photos"&&<LeadFiles key={customer.id+"photos"} leads={onlyCustomer} userId={userId} initialLeadId={customer.id} initialFilter="Photos"/>}
  {section==="Documents"&&<LeadFiles key={customer.id+"documents"} leads={onlyCustomer} userId={userId} initialLeadId={customer.id} initialFilter="Documents"/>}
  {section==="Estimates"&&<EstimateBuilder key={customer.id} customers={onlyCustomer} userId={userId} cloudMode={cloudMode} initialCustomerId={customer.id}/>}
  {section==="Jobs"&&<Jobs key={customer.id} customers={onlyCustomer} userId={userId} cloudMode={cloudMode} initialCustomerId={customer.id}/>}
  {section==="Invoices & Payments"&&<Invoices key={customer.id} customers={onlyCustomer} userId={userId} cloudMode={cloudMode} initialCustomerId={customer.id}/>}
 </div>;
}
