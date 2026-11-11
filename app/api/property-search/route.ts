import {createClient} from "@supabase/supabase-js";
import project from "@/lib/supabase/project.json";
import {parseCensusResult} from "@/lib/geocoding";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request:Request){
 const auth=request.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer ")||auth.length>16000)return reply({error:"Sign in to search properties."},401);
 try{
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||project.url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||project.publishableKey,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.auth.getUser(auth.slice(7));
  if(error||!data.user)return reply({error:"Sign in to search properties."},401);
  let body:unknown;try{body=await request.json();}catch{return reply({error:"Invalid request."},400);}
  const address=(body as {address?:unknown})?.address;
  if(typeof address!=="string"||address.trim().length<8||address.length>250)return reply({error:"Enter a valid US street address, city and state."},400);
  const url=new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address",address.trim());url.searchParams.set("benchmark","Public_AR_Current");url.searchParams.set("format","json");
  const response=await fetch(url.toString(),{cache:"no-store",signal:AbortSignal.timeout(20000),headers:{Accept:"application/json"}});
  if(!response.ok)return reply({error:"Property lookup temporarily unavailable."},503);
  const location=parseCensusResult(await response.json());
  if(location.status!=="matched")return reply({error:location.status==="ambiguous"?"Multiple address matches. Enter the street, city, state and ZIP.":"No matching property found. Double-check the complete street address."},404);
  return reply({address:location.matched_address,lat:location.lat,lng:location.lng});
 }catch{return reply({error:"Could not locate the property. Try again."},503);}
}
