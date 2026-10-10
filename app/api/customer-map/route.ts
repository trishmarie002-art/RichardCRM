import {createClient} from "@supabase/supabase-js";
import project from "@/lib/supabase/project.json";
import {parseCensusResult,reusableLocation,type AddressLocation} from "@/lib/geocoding";
export const maxDuration=60;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request:Request){
 const auth=request.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer ")||auth.length>16000)return reply({error:"Sign in to locate customers."},401);
 const token=auth.slice(7);
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||project.url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||project.publishableKey,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 try{
 const {data:user,error:authError}=await db.auth.getUser(token);
 if(authError||!user.user)return reply({error:"Sign in to locate customers."},401);
 let body:unknown;try{body=await request.json();}catch{return reply({error:"Invalid request."},400);}
 const id=(body as {leadId?:unknown})?.leadId;
 if(typeof id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return reply({error:"Invalid customer."},400);
 const {data:lead,error:leadError}=await db.from("leads").select("id,address").eq("id",id).maybeSingle();
 if(leadError)throw leadError;if(!lead)return reply({error:"Customer not found."},404);
 const address=lead.address.trim();if(!address)return reply({error:"Add a street address to this customer."},422);
 if(address.length>500)return reply({error:"The saved address is too long. Update the customer address."},422);
 const {data:cached,error:cacheError}=await db.from("customer_locations").select("lead_id,source_address,matched_address,lat,lng,status,checked_at").eq("lead_id",id).maybeSingle();
 if(cacheError)throw cacheError;
 if(cached&&reusableLocation(cached as AddressLocation,address)&&!(cached.status!=="matched"&&(body as {retryNotFound?:boolean}).retryNotFound===true))return reply({location:cached});
 const url=new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");url.searchParams.set("address",address);url.searchParams.set("benchmark","Public_AR_Current");url.searchParams.set("format","json");
 const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(20000),headers:{Accept:"application/json"}});
 if(!response.ok)return reply({error:"Address lookup is temporarily unavailable. Try again shortly."},503);
 const location:AddressLocation={lead_id:id,source_address:address,...parseCensusResult(await response.json()),checked_at:new Date().toISOString()};
 const {error:saveError}=await db.from("customer_locations").upsert({...location,user_id:user.user.id},{onConflict:"lead_id"});if(saveError)throw saveError;
 return reply({location});
 }catch(error){console.error("Customer address lookup failed",error instanceof Error?error.name:"database or provider error");return reply({error:"Could not locate this address. Try again shortly."},503);}
}
