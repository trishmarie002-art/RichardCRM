"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";
type Line={name:string;unit:string;qty:number;price:number};
type Scenario={materials:Line[];labor:Line[];misc:number;delivery:number;eagleview:number;payout:number;deductible:number;cash:number;discount:number;supplement:number;tax:number};
type Sheet={a:Scenario;b:Scenario;profitSplit:number;notes:string};
type RecordRow={id:string;name:string;property_address:string;lead_id:string|null;worksheet:Sheet;updated_at:string};
type Customer={id:string;name:string;address:string};
const materialData:[string,string,number,number,number,number][]=[
["OSB Board 7/16 4x8","Ea",0,18.5,0,18.5],
["Synthetic underlay 10 sq roll","Roll",3,60,3,60],
["Owens Corning starter strip 100 LF","Bundle",3,35,3,35],
["Dimensional shingles 30yr","Square",0,113.5,28,99],
["Dimensional shingles 30yr","Bundle",0,37.8,0,37.8],
["3-tab composite 25yr","Square",29,75,1,75],
["3-tab composite 25yr","Bundle",0,35,0,35],
["Rizer Ridge","",0,0,0,0],
["Base sheet 2sq roll Ice & water shield","Roll",0,70,0,70],
["Cap sheet peel & stick 1sq roll","Roll",0,0,0,0],
["Modified drip edge gravel guard 10ft","",0,0,0,0],
["Primer spray","",0,0,0,0],
["Drip edge metal 10ft 2x2","",33,9,33,9],
["Ridge vents 4ft each","Ea",16,9,16,9],
["Coil nails","Ea",2,40,2,40],
["Nail plastic caps 1 inch 2M/BX","Box",2,14,2,14],
["Valley metal","",0,50,0,50],
["Flashing galvanized pipe jacks 1–3 inch","Ea",5,10,5,10],
["Flashing pipe jacks 3–5 inch","",0,0,0,0],
["Caulk roof sealant","Ea",2,7,2,7],
["Spray paint","Ea",2,9,2,9],
["Furnace vent rain cap 5 inch","",0,0,0,0],
["Exhaust cap 6–8 inch","",0,0,0,0],
["5 gallon plastic cement","Ea",1,30,1,30],
["Solar vent","Ea",0,400,0,400],
["Delivery charge","Ea",0,150,0,150]
];
const laborData:[string,string,number,number,number,number][]=[
["Shingle 1 story","Squares",29,90,29,90],["Shingle 2 story","Squares",0,100,0,100],
["Load","Ea",0,5,0,5],["Starter","Ea",0,75,0,75],
["Ridge vent","Ea",16,8,16,8],["OSB board","Ea",0,20,0,20],["Other","Ea",0,0,0,0]
];
const makeLines=(data:[string,string,number,number,number,number][],side:"a"|"b")=>data.map(row=>({name:row[0],unit:row[1],qty:0,price:side==="a"?row[3]:row[5]}));
function initialSheet():Sheet{return {a:{materials:makeLines(materialData,"a"),labor:makeLines(laborData,"a"),misc:0,delivery:0,eagleview:0,payout:0,deductible:0,cash:0,discount:0,supplement:0,tax:0},b:{materials:makeLines(materialData,"b"),labor:makeLines(laborData,"b"),misc:0,delivery:0,eagleview:0,payout:0,deductible:0,cash:0,discount:0,supplement:0,tax:0},profitSplit:60,notes:"Reference prices from May 6, 2025. Confirm current supplier pricing, tax, labor and insurance figures before use."};}
const usd=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
const calc=(s:Scenario)=>{const materials=s.materials.reduce((x,row)=>x+row.qty*row.price,0);const labor=s.labor.reduce((x,row)=>x+row.qty*row.price,0);const expenses=materials+labor+s.misc+s.delivery+s.eagleview+s.tax;const revenue=s.payout+s.deductible+s.cash+s.discount+s.supplement;return {materials,labor,expenses,revenue,profit:revenue-expenses,margin:revenue?((revenue-expenses)/revenue)*100:0};};
const valid=(s:Sheet)=>["a","b"].every(side=>{const v=s[side as "a"|"b"];return [...v.materials,...v.labor].every(r=>r.name.trim()&&Number.isFinite(r.qty)&&r.qty>=0&&Number.isFinite(r.price)&&r.price>=0)&&["misc","delivery","eagleview","payout","deductible","cash","discount","supplement","tax"].every(k=>Number.isFinite(v[k as keyof Pick<Scenario,"misc"|"delivery"|"eagleview"|"payout"|"deductible"|"cash"|"discount"|"supplement"|"tax">]));});
export default function RoofEstimateWorksheet({userId,cloudMode,customers,initialCustomerId=""}:{userId:string|null;cloudMode:boolean;customers:Customer[];initialCustomerId?:string}){
 const db=useMemo(()=>createClient(),[]);const [sheet,setSheet]=useState<Sheet>(initialSheet);
 const [name,setName]=useState("Roof Estimate Worksheet");const [property,setProperty]=useState(customers.find(c=>c.id===initialCustomerId)?.address||"");const [customerId,setCustomerId]=useState(initialCustomerId);const [saved,setSaved]=useState<RecordRow[]>([]);const [selected,setSelected]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 const key="richardcrm.roof-worksheet-drafts.v1";
 useEffect(()=>{let active=true;async function load(){try{if(cloudMode){if(!db||!userId)throw Error("Sign in to load worksheets.");const all:RecordRow[]=[];for(let i=0;;i+=1000){const {data,error}=await db.from("roof_estimate_worksheets").select("id,name,property_address,lead_id,worksheet,updated_at").order("updated_at",{ascending:false}).range(i,i+999);if(error)throw error;all.push(...data as RecordRow[]);if(data.length<1000)break;}if(active)setSaved(all);}else{const value=localStorage.getItem(key);if(active)setSaved(value?JSON.parse(value):[]);}}catch(e){if(active)setMessage(e instanceof Error?e.message:"Unable to load saved worksheets.");}}void load();return()=>{active=false;};},[db,cloudMode,userId]);
 function changeLine(side:"a"|"b",group:"materials"|"labor",index:number,field:keyof Line,value:string){setSheet(old=>({...old,[side]:{...old[side],[group]:old[side][group].map((r,i)=>i===index?{...r,[field]:field==="qty"||field==="price"?Number(value):value}:r)}}));}
 function changeNumber(side:"a"|"b",field:keyof Omit<Scenario,"materials"|"labor">,value:string){setSheet(old=>({...old,[side]:{...old[side],[field]:Number(value)}}));}
 function changeCustomer(id:string){setCustomerId(id);const c=customers.find(c=>c.id===id);if(c)setProperty(c.address);}
 function loadRecord(r:RecordRow){setSelected(r.id);setName(r.name);setCustomerId(r.lead_id||"");setProperty(r.property_address);setSheet(r.worksheet);setMessage("Saved worksheet loaded for editing.");}
 function reset(){setSelected("");setSheet(initialSheet());setName("Roof Estimate Worksheet");setProperty(customers.find(c=>c.id===initialCustomerId)?.address||"");setCustomerId(initialCustomerId);setMessage("New editable worksheet started with reference prices.");}
 async function save(){if(!name.trim()||!valid(sheet)){setMessage("Enter a worksheet name, valid line descriptions, nonnegative quantities/prices, and numeric totals.");return;}setBusy(true);setMessage("");try{const data={name:name.trim(),lead_id:customerId||null,property_address:property.trim(),worksheet:sheet,updated_at:new Date().toISOString()};let record:RecordRow;if(cloudMode){if(!db||!userId)throw Error("Sign in to save.");const query=selected?db.from("roof_estimate_worksheets").update(data).eq("id",selected):db.from("roof_estimate_worksheets").insert({...data,user_id:userId});const {data:row,error}=await query.select("id,name,property_address,lead_id,worksheet,updated_at").single();if(error)throw error;record=row as RecordRow;}else{record={...data,id:selected||crypto.randomUUID()};}
 const next=[record,...saved.filter(r=>r.id!==record.id)].sort((a,b)=>b.updated_at.localeCompare(a.updated_at));if(!cloudMode)localStorage.setItem(key,JSON.stringify(next));setSaved(next);setSelected(record.id);setMessage("Worksheet saved. Open it again from Saved worksheets.");}catch(e){setMessage(e instanceof Error?e.message:"Unable to save worksheet.");}finally{setBusy(false);}}
 const first=calc(sheet.a),second=calc(sheet.b);
 function lineEditor(group:"materials"|"labor"){const max=Math.max(sheet.a[group].length,sheet.b[group].length);return <div style={{overflowX:"auto",marginTop:12}}><table className="table" style={{minWidth:980,width:"100%"}}><thead><tr><th rowSpan={2}>Item</th><th rowSpan={2}>Unit</th><th colSpan={3}>3 Tab</th><th colSpan={3}>30 Year Laminate</th></tr><tr><th>Qty</th><th>Unit price</th><th>Extension</th><th>Qty</th><th>Unit price</th><th>Extension</th></tr></thead><tbody>{Array.from({length:max},(_,i)=>{const a=sheet.a[group][i],b=sheet.b[group][i];if(!a||!b)return null;return <tr key={i}><td><input aria-label={group+" item "+i} style={{minWidth:215}} value={a.name} onChange={e=>{changeLine("a",group,i,"name",e.target.value);changeLine("b",group,i,"name",e.target.value);}}/></td><td><input aria-label={group+" unit "+i} style={{width:72}} value={a.unit} onChange={e=>{changeLine("a",group,i,"unit",e.target.value);changeLine("b",group,i,"unit",e.target.value);}}/></td>{(["a","b"] as const).map(side=>{const row=sheet[side][group][i];return <>{(["qty","price"] as const).map(field=><td key={side+field}><input aria-label={side+" "+field+" "+row.name} type="number" min={0} step="any" style={{width:98}} value={row[field]} onChange={e=>changeLine(side,group,i,field,e.target.value)}/></td>)}<td key={side+"total"}><strong>{usd(row.qty*row.price)}</strong></td></>;})}</tr>})}</tbody></table></div>;}
 const summary=[["Material subtotal","materials"],["Labor subtotal","labor"],["Total expenses","expenses"],["Total revenue","revenue"],["Profit","profit"],["Margin","margin"]] as const;
 const adjustments:[keyof Omit<Scenario,"materials"|"labor">,string][]=[["delivery","Delivery (additional)"],["eagleview","EagleView / reports"],["misc","Miscellaneous expenses"],["tax","Material tax / other tax"],["payout","Insurance payout / quoted price"],["deductible","Deductible collected"],["cash","Cash out of pocket"],["discount","Discount (negative amount)"],["supplement","Supplement"]];
 return <div className="card"><h2>Roof Estimate Worksheet</h2><p className="muted">Reusable roof estimate comparison worksheet. Two side-by-side pricing scenarios, editable quantities and rates, live extensions, expenses, profit and margin. Reference costs are from May 6, 2025—not live supplier pricing.</p>
 {message&&<p className="notice" role="status">{message}</p>}
 <div className="formGrid"><div className="field"><label htmlFor="worksheet-name">Worksheet name</label><input id="worksheet-name" value={name} onChange={e=>setName(e.target.value)} maxLength={180}/></div><div className="field"><label htmlFor="worksheet-customer">Customer (optional)</label><select id="worksheet-customer" value={customerId} onChange={e=>changeCustomer(e.target.value)}><option value="">Unassigned template / draft</option>{customers.map(c=><option key={c.id} value={c.id}>{c.address||c.name}</option>)}</select></div><div className="field full"><label htmlFor="worksheet-property">Property address</label><input id="worksheet-property" value={property} onChange={e=>setProperty(e.target.value)} placeholder="Property / job address"/></div></div>
 <div className="roofToolbar"><button className="btn" disabled={busy} onClick={()=>void save()}>{busy?"Saving…":selected?"Save changes to worksheet":"Save worksheet"}</button><button className="mini" type="button" onClick={reset}>New worksheet from template</button><button className="mini" type="button" onClick={()=>window.print()}>Print worksheet</button></div>
 <h3 style={{marginTop:18}}>Saved worksheets</h3><div className="field"><label htmlFor="worksheet-saved">Open saved worksheet</label><select id="worksheet-saved" value={selected} onChange={e=>{const record=saved.find(r=>r.id===e.target.value);if(record)loadRecord(record);else reset();}}><option value="">New worksheet from template</option>{saved.map(r=><option key={r.id} value={r.id}>{r.name}{r.property_address?" — "+r.property_address:""}</option>)}</select></div>
 <h3 style={{marginTop:22}}>Roof materials</h3>{lineEditor("materials")}
 <h3 style={{marginTop:24}}>Installation labor</h3>{lineEditor("labor")}
 <h3 style={{marginTop:24}}>Job expenses and revenue</h3><div style={{overflowX:"auto"}}><table className="table" style={{minWidth:650}}><thead><tr><th>Field</th><th>3 Tab</th><th>30 Year Laminate</th></tr></thead><tbody>{adjustments.map(([field,label])=><tr key={field}><td>{label}</td>{(["a","b"] as const).map(side=><td key={side}><input aria-label={side+" "+label} type="number" step="any" style={{maxWidth:170}} value={sheet[side][field]} onChange={e=>changeNumber(side,field,e.target.value)}/></td>)}</tr>)}</tbody></table></div>
 <h3 style={{marginTop:24}}>Comparison and profit</h3><div style={{overflowX:"auto"}}><table className="table" style={{minWidth:650}}><thead><tr><th>Calculation</th><th>3 Tab</th><th>30 Year Laminate</th></tr></thead><tbody>{summary.map(([label,key])=><tr key={key}><td><strong>{label}</strong></td><td>{key==="margin"?first.margin.toFixed(1)+"%":usd(first[key])}</td><td>{key==="margin"?second.margin.toFixed(1)+"%":usd(second[key])}</td></tr>)}</tbody></table></div>
 <div className="field" style={{marginTop:12,maxWidth:290}}><label htmlFor="profit-split">Profit split — first share (%)</label><input id="profit-split" type="number" min="0" max="100" value={sheet.profitSplit} onChange={e=>setSheet(old=>({...old,profitSplit:Math.max(0,Math.min(100,Number(e.target.value)))}))}/></div><p><strong>3 Tab:</strong> {sheet.profitSplit}% = {usd(first.profit*sheet.profitSplit/100)}; {100-sheet.profitSplit}% = {usd(first.profit*(100-sheet.profitSplit)/100)}</p><p><strong>30 Year Laminate:</strong> {sheet.profitSplit}% = {usd(second.profit*sheet.profitSplit/100)}; {100-sheet.profitSplit}% = {usd(second.profit*(100-sheet.profitSplit)/100)}</p>
 <div className="field" style={{marginTop:14}}><label htmlFor="worksheet-notes">Notes</label><textarea id="worksheet-notes" rows={4} value={sheet.notes} onChange={e=>setSheet(old=>({...old,notes:e.target.value}))}/></div><p className="small muted">Figures do not automatically estimate material quantities or determine insurance coverage. Confirm all line items and prices before using for a proposal.</p></div>;
}
