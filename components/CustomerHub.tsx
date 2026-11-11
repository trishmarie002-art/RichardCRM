"use client";
import {useState} from "react";
import CustomerOverview from "@/components/CustomerOverview";
import CustomerWorkspace from "@/components/CustomerWorkspace";
import EstimateBuilder from "@/components/EstimateBuilder";
import Jobs from "@/components/Jobs";
import Invoices from "@/components/Invoices";
import LeadFiles from "@/components/LeadFiles";
import CustomerNotes from "@/components/CustomerNotes";

type Customer={id:string;user_id?:string;name:string;address:string;phone:string;email:string;status:string;source:string;value:number;notes:string;job_type?:string;salesperson?:string;created_at?:string;completed_at?:string|null;additional_contacts?:{name:string;role:string;phone:string;email:string}[]};
type Section="Overview"|"Notes"|"Activity & Appointments"|"Photos"|"Documents"|"Estimates"|"Jobs"|"Invoices & Payments";
const sections:Section[]=["Overview","Notes","Activity & Appointments","Photos","Documents","Estimates","Jobs","Invoices & Payments"];
const usd=(v:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(v||0);
export default function CustomerHub({customer,userId,cloudMode,onBack,onEdit,onMeasure}:{customer:Customer;userId:string|null;cloudMode:boolean;onBack:()=>void;onEdit:()=>void;onMeasure:()=>void}){
 const [section,setSection]=useState<Section>("Overview");
 // Passing only the selected customer also restricts the embedded forms to this customer.
 const onlyCustomer=[customer];
 function open(sectionName:string){
  if(sectionName==="Invoices")setSection("Invoices & Payments");
  else if(sectionName==="Estimates"||sectionName==="Jobs")setSection(sectionName);
 }
 return <div>
  <div className="card" style={{marginBottom:16}}>
   <div className="roofToolbar"><button className="mini" onClick={onBack}>← All customers</button><button className="mini" onClick={onEdit}>Edit customer</button><button className="mini" onClick={onMeasure}>Roof measurement</button></div>
   <h2 style={{marginBottom:8}}>{customer.address||"Property address not entered"}</h2>
   <p className="muted" style={{marginTop:0}}>{customer.name} · {customer.status||"No stage"}{customer.completed_at?" · Completed":""}</p>
   <div className="roofToolbar">
    {customer.phone&&<a className="btn secondary" href={"tel:"+customer.phone}>Call</a>}
    {customer.email&&<a className="btn secondary" href={"mailto:"+customer.email}>Email</a>}
   </div>
   <div className="grid" style={{marginTop:14}}>
    <div className="kpi"><span>Phone</span><strong>{customer.phone||"Not provided"}</strong></div>
    <div className="kpi"><span>Email</span><strong style={{overflowWrap:"anywhere"}}>{customer.email||"Not provided"}</strong></div>
    <div className="kpi"><span>Job type</span><strong>{customer.job_type||"Not set"}</strong></div><div className="kpi"><span>Salesperson</span><strong>{customer.salesperson||"Unassigned"}</strong></div><div className="kpi"><span>Lead source</span><strong>{customer.source||"Other"}</strong></div><div className="kpi"><span>Lead created</span><strong>{customer.created_at?new Date(customer.created_at).toLocaleDateString():"Not recorded"}</strong></div>
    <div className="kpi"><span>Potential value</span><strong>{usd(customer.value)}</strong></div>
   </div>
   {customer.notes&&<p style={{whiteSpace:"pre-wrap"}}><strong>Original lead notes:</strong> {customer.notes}</p>}
   {!!customer.additional_contacts?.length&&<div><h3>Additional contacts</h3>{customer.additional_contacts.map((person,index)=><div className="kpi" key={index}><span>{person.role||"Additional contact"}: {person.name||"Name not provided"}</span><strong>{person.phone||""} {person.email||""}</strong></div>)}</div>}
  </div>
  <div className="roofToolbar" role="group" aria-label="Customer page sections" style={{marginBottom:16}}>
   {sections.map(item=><button key={item} type="button" className={section===item?"btn":"btn secondary"} aria-pressed={section===item} onClick={()=>setSection(item)}>{item}</button>)}
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
