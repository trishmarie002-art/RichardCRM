import {createClient} from "@supabase/supabase-js";
import project from "@/lib/supabase/project.json";

export const runtime = "nodejs";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const money=(amount:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(amount);
const esc=(value:unknown)=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
type Item={description:string;quantity:number;rate:number};

export async function POST(request:Request){
  const auth=request.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer ")||auth.length>16000)return reply({error:"Sign in to send an estimate."},401);
  const token=auth.slice(7);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||project.url;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||project.publishableKey;
  const db=createClient(url,key,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const {data:identity,error:authError}=await db.auth.getUser(token);
    if(authError||!identity.user)return reply({error:"Your sign-in expired. Sign in again."},401);
    const payload=await request.json().catch(()=>null);
    const id=payload?.estimateId;
    if(typeof id!=="string"||!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id))return reply({error:"Invalid estimate ID."},400);
    const {data:estimate,error:fetchError}=await db.from("estimates").select("id,lead_id,items,notes,proposal,created_at").eq("id",id).single();
    if(fetchError||!estimate)return reply({error:"Estimate not found or access denied."},404);
    const {data:lead,error:leadError}=await db.from("leads").select("id,name,email,address").eq("id",estimate.lead_id).single();
    if(leadError||!lead)return reply({error:"Customer not found or access denied."},404);
    const email=String(lead.email||"").trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return reply({error:"Add a valid email address to this customer first."},422);
    const items=estimate.items as Item[];
    if(!Array.isArray(items)||items.length===0||items.length>100||items.some(i=>!i||typeof i.description!=="string"||!Number.isFinite(Number(i.quantity))||Number(i.quantity)<=0||!Number.isFinite(Number(i.rate))||Number(i.rate)<0))return reply({error:"This saved estimate has invalid line items."},422);
    const total=items.reduce((sum,i)=>sum+Math.round(Number(i.quantity)*Number(i.rate)*100)/100,0);
    const p=estimate.proposal||{};
    const company=String(p.company||"Star Roofing LLC");
    const rows=items.map(i=>`<tr><td style="padding:9px;border-bottom:1px solid #ddd">${esc(i.description)}</td><td style="padding:9px;border-bottom:1px solid #ddd">${esc(i.quantity)}</td><td style="padding:9px;border-bottom:1px solid #ddd">${money(Number(i.rate))}</td><td style="padding:9px;border-bottom:1px solid #ddd">${money(Math.round(Number(i.quantity)*Number(i.rate)*100)/100)}</td></tr>`).join("");
    const section=(label:string,value:unknown)=>value?`<h3>${esc(label)}</h3><p style="white-space:pre-wrap">${esc(value)}</p>`:"";
    const html=`<div style="font:15px Arial,sans-serif;max-width:720px;margin:auto;color:#192333"><h1>${esc(company)} — Roofing Estimate</h1><p>Hello ${esc(lead.name)},</p><p>Thank you for the opportunity to provide an estimate for your property at ${esc(lead.address)}.</p><p>Estimate date: ${esc(new Date(estimate.created_at).toLocaleDateString("en-US",{timeZone:"UTC"}))}</p><table style="width:100%;border-collapse:collapse"><thead><tr><th align="left">Description</th><th align="left">Qty</th><th align="left">Unit price</th><th align="left">Amount</th></tr></thead><tbody>${rows}</tbody></table><p style="text-align:right;font-size:22px"><strong>Estimated total: ${money(total)}</strong></p>${section("Scope of work",estimate.notes)}${section("Warranty",p.warranty)}${section("Exclusions",p.exclusions)}${section("Payment terms",p.paymentTerms)}<p>Estimate only. Final scope and pricing require confirmation.</p><p>${esc(company)}<br>${esc(p.phone||"(210) 264-5707")}<br>${esc(p.email||"starroofing10@gmail.com")}</p></div>`;
    const apiKey=process.env.RESEND_API_KEY;
    const sender=process.env.ESTIMATE_FROM_EMAIL;
    if(!apiKey||!sender)return reply({error:"Email delivery isn't configured yet. Add RESEND_API_KEY and ESTIMATE_FROM_EMAIL in Vercel settings."},503);
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:sender,to:[email],subject:`${company} estimate — ${money(total)}`,html}),signal:AbortSignal.timeout(15000)});
    if(!response.ok){console.error("Estimate email provider rejected request",response.status);return reply({error:"Email could not be sent. Check the verified sender address and email service configuration."},502);}
    // Sending is completed before attempting to record the new status.
    const {error:statusError}=await db.from("estimates").update({status:"Sent",status_updated_at:new Date().toISOString()}).eq("id",id);
    return reply({sent:true,to:email,statusUpdated:!statusError});
  }catch(error){console.error("Estimate send failed",error instanceof Error?error.name:"unknown");return reply({error:"Could not send the estimate. Try again."},500);}
}
