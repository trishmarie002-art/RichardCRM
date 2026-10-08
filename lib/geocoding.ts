export type AddressLocation={lead_id:string;source_address:string;matched_address:string;lat:number|null;lng:number|null;status:"matched"|"not_found"|"ambiguous";checked_at:string};
export function addressKey(address:string){return address.trim().replace(/\s+/g," ").toLowerCase();}
export function reusableLocation(location:AddressLocation,address:string,now=Date.now()){
 return addressKey(location.source_address)===addressKey(address)&&(location.status==="matched"||now-new Date(location.checked_at).getTime()<86400000);
}
export function parseCensusResult(value:unknown):Pick<AddressLocation,"matched_address"|"lat"|"lng"|"status">{
 const empty={matched_address:"",lat:null,lng:null};
 if(!value||typeof value!=="object"||!("result" in value))throw Error("Invalid geocoder response.");
 const result=(value as {result?:{addressMatches?:unknown}}).result;
 if(!Array.isArray(result?.addressMatches))throw Error("Invalid geocoder response.");
 const matches=result.addressMatches;
 if(!matches.length)return {...empty,status:"not_found"};
 if(matches.length!==1)return {...empty,status:"ambiguous"};
 const match=matches[0] as {matchedAddress?:unknown;coordinates?:{x?:unknown;y?:unknown}};
 const lat=match.coordinates?.y,lng=match.coordinates?.x;
 if(typeof lat!=="number"||typeof lng!=="number"||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw Error("Invalid geocoder coordinates.");
 return {lat,lng,matched_address:typeof match.matchedAddress==="string"?match.matchedAddress:"",status:"matched"};
}
