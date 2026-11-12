"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {createClient} from "@/lib/supabase/client";
type Lead={user_id?:string;id:string;name:string;address:string};
type Attachment={name:string;id?:string|null;created_at?:string|null;metadata?:{size?:number;mimetype?:string}};
const bucket="customer-files";
const types:Record<string,string>={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",pdf:"application/pdf",mp4:"video/mp4",mov:"video/quicktime",webm:"video/webm",m4v:"video/x-m4v",xls:"application/vnd.ms-excel",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",csv:"text/csv"};
const pageSize=24;
function displayName(name:string){return name.replace(/^[0-9a-f]{8}-[0-9a-f-]{27}-/i,"");}
function category(file:Attachment){const mime=file.metadata?.mimetype||types[file.name.split(".").pop()?.toLowerCase()||""]||"";return mime.startsWith("image/")?"Photos":mime.startsWith("video/")?"Videos":"Documents";}
function ZoomablePhoto({src,alt}:{src:string;alt:string}){
 const [zoom,setZoom]=useState(1);
 const [fullScreen,setFullScreen]=useState(false);
 const [navigatorSize,setNavigatorSize]=useState({width:180,height:110});
 const [viewRect,setViewRect]=useState({x:0,y:0,width:1,height:1});
 const viewport=useRef<HTMLDivElement>(null);
 function syncNavigator(){
  const node=viewport.current;if(!node)return;
  const fullWidth=Math.max(node.scrollWidth,1),fullHeight=Math.max(node.scrollHeight,1);
  setViewRect({x:node.scrollLeft/fullWidth,y:node.scrollTop/fullHeight,width:Math.min(1,node.clientWidth/fullWidth),height:Math.min(1,node.clientHeight/fullHeight)});
 }
 function navigateTo(event:React.PointerEvent<HTMLDivElement>){
  const node=viewport.current;if(!node||zoomRef.current<=1)return;
  const bounds=event.currentTarget.getBoundingClientRect();
  const x=Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width));
  const y=Math.max(0,Math.min(1,(event.clientY-bounds.top)/bounds.height));
  node.scrollLeft=x*node.scrollWidth-node.clientWidth/2;
  node.scrollTop=y*node.scrollHeight-node.clientHeight/2;
  syncNavigator();
 }
 useEffect(()=>{
  const node=viewport.current;if(!node)return;
  const observer=new ResizeObserver(syncNavigator);
  observer.observe(node);
  return()=>observer.disconnect();
 },[]);

 useEffect(()=>{
  if(!fullScreen)return;
  const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setFullScreen(false);};
  window.addEventListener("keydown",close);
  return()=>window.removeEventListener("keydown",close);
 },[fullScreen]);
 useEffect(()=>{requestAnimationFrame(syncNavigator);},[fullScreen]);
 const zoomRef=useRef(1);
 const drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
 const pointers=useRef(new Map<number,{x:number;y:number}>());
 const pinch=useRef<{distance:number;zoom:number}|null>(null);
 const clamp=(v:number)=>Math.max(1,Math.min(8,Math.round(v*100)/100));
 function changeZoom(value:number,clientX?:number,clientY?:number){
  const node=viewport.current;
  const next=clamp(value),previous=zoomRef.current;
  if(next===previous)return;
  const rect=node?.getBoundingClientRect();
  const px=rect?(clientX??rect.left+rect.width/2)-rect.left:0;
  const py=rect?(clientY??rect.top+rect.height/2)-rect.top:0;
  const left=node?.scrollLeft||0,top=node?.scrollTop||0;
  zoomRef.current=next;setZoom(next);
  if(node)requestAnimationFrame(()=>{
   node.scrollLeft=(left+px)*(next/previous)-px;
   node.scrollTop=(top+py)*(next/previous)-py;
   syncNavigator();
  });
 }
 function reset(){
  drag.current=null;pointers.current.clear();pinch.current=null;
  zoomRef.current=1;setZoom(1);
  if(viewport.current){viewport.current.scrollLeft=0;viewport.current.scrollTop=0;}
  requestAnimationFrame(syncNavigator);
 }
 return <div className={fullScreen?"customerPhotoViewer customerPhotoFullscreen":"customerPhotoViewer"} role={fullScreen?"dialog":undefined} aria-modal={fullScreen?true:undefined} aria-label={fullScreen?"Full page photo viewer":undefined}>
  <div className="roofToolbar" style={{margin:"12px 0",alignItems:"center"}}>
   <button type="button" className="mini" onClick={()=>changeZoom(zoomRef.current/1.4)} disabled={zoom<=1} aria-label="Zoom out">− Zoom out</button>
   <strong aria-live="polite">{Math.round(zoom*100)}%</strong>
   <button type="button" className="mini" onClick={()=>changeZoom(zoomRef.current*1.4)} disabled={zoom>=8} aria-label="Zoom in">+ Zoom in</button>
   <button type="button" className="mini" onClick={reset}>Reset</button>
   <button type="button" className="mini" onClick={()=>setFullScreen(current=>!current)}>{fullScreen?"Exit full page":"Full page photo view"}</button>
   <a className="mini" href={src} target="_blank" rel="noreferrer">Original photo</a>
  </div>
  <div className="customerPhotoStage">
  <div ref={viewport} onScroll={syncNavigator} className="customerPhotoViewport" role="region" aria-label={"Zoomable photo: "+alt} tabIndex={0}
   onWheel={event=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||Math.abs(event.deltaY)>0){
     event.preventDefault();
     changeZoom(zoomRef.current*(event.deltaY<0?1.16:1/1.16),event.clientX,event.clientY);
    }
   }}
   onDoubleClick={event=>changeZoom(zoomRef.current>=4?1:zoomRef.current*2,event.clientX,event.clientY)}
   onPointerDown={event=>{
    if(event.pointerType==="mouse"&&event.button!==0)return;
    const node=viewport.current;if(!node)return;
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    node.setPointerCapture(event.pointerId);
    if(pointers.current.size===2){
     const [first,second]=Array.from(pointers.current.values());
     pinch.current={distance:Math.hypot(first.x-second.x,first.y-second.y),zoom:zoomRef.current};
     drag.current=null;
    }else if(zoomRef.current>1){
     drag.current={x:event.clientX,y:event.clientY,left:node.scrollLeft,top:node.scrollTop};
    }
   }}
   onPointerMove={event=>{
    if(!pointers.current.has(event.pointerId))return;
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.current.size===2&&pinch.current){
     const [first,second]=Array.from(pointers.current.values());
     const distance=Math.hypot(first.x-second.x,first.y-second.y);
     const centerX=(first.x+second.x)/2,centerY=(first.y+second.y)/2;
     if(pinch.current.distance>0)changeZoom(pinch.current.zoom*distance/pinch.current.distance,centerX,centerY);
     return;
    }
    if(drag.current&&viewport.current){
     viewport.current.scrollLeft=drag.current.left-(event.clientX-drag.current.x);
     viewport.current.scrollTop=drag.current.top-(event.clientY-drag.current.y);
    }
   }}
   onPointerUp={event=>{pointers.current.delete(event.pointerId);drag.current=null;pinch.current=null;}}
   onPointerCancel={event=>{pointers.current.delete(event.pointerId);drag.current=null;pinch.current=null;}}
   onKeyDown={event=>{
    if(event.key==="+"||event.key==="="){event.preventDefault();changeZoom(zoomRef.current*1.4);}
    if(event.key==="-"){event.preventDefault();changeZoom(zoomRef.current/1.4);}
    if(event.key==="0"){event.preventDefault();reset();}
   }}>
   <img src={src} alt={alt} draggable={false} onLoad={event=>{const image=event.currentTarget;const ratio=image.naturalWidth/Math.max(1,image.naturalHeight);setNavigatorSize({width:Math.min(180,110*ratio),height:Math.min(110,180/ratio)});requestAnimationFrame(syncNavigator);}} style={{display:"block",width:(zoom*100)+"%",maxWidth:"none",height:"auto",objectFit:"contain",userSelect:"none",pointerEvents:"none"}}/>
  </div>
  {zoom>1&&<div className="customerPhotoNavigatorWrap" aria-label="Photo navigation overview">
   <div className="customerPhotoNavigatorTitle">Move around photo</div>
   <div role="slider" aria-label="Move zoomed image using overview" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(viewRect.x*100)} tabIndex={0}
    className="customerPhotoNavigator" style={{width:navigatorSize.width,height:navigatorSize.height}}
    onPointerDown={event=>{if(event.pointerType==="mouse"&&event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId);navigateTo(event);}}
    onPointerMove={event=>{if(event.buttons||event.pointerType==="touch"&&event.currentTarget.hasPointerCapture(event.pointerId))navigateTo(event);}}
    onKeyDown={event=>{const node=viewport.current;if(!node)return;const amount=event.shiftKey?0.3:0.1;if(event.key==="ArrowRight")node.scrollLeft+=node.clientWidth*amount;else if(event.key==="ArrowLeft")node.scrollLeft-=node.clientWidth*amount;else if(event.key==="ArrowDown")node.scrollTop+=node.clientHeight*amount;else if(event.key==="ArrowUp")node.scrollTop-=node.clientHeight*amount;else return;event.preventDefault();syncNavigator();}}>
    <img src={src} alt="" draggable={false} />
    <div className="customerPhotoNavigatorRegion" style={{left:(viewRect.x*100)+"%",top:(viewRect.y*100)+"%",width:(viewRect.width*100)+"%",height:(viewRect.height*100)+"%"}}/>
   </div>
  </div>}
  </div>
  <p className="small muted">Use the mini-map in the lower right to jump to any part of a zoomed photo. Drag the highlighted rectangle, drag the main photo, or use the mouse wheel to zoom. Pinch on touchscreens.</p>
 </div>;
}
type SpreadsheetPreview={file:Attachment;sheets:{name:string;rows:string[][]}[]};
type SheetJs={read:(data:ArrayBuffer,opts:{type:string;cellDates?:boolean})=>{SheetNames:string[];Sheets:Record<string,unknown>};utils:{sheet_to_json:(sheet:unknown,opts:{header:1;defval:string;raw:boolean;blankrows:boolean})=>unknown[][]}};
declare global {interface Window {XLSX?:SheetJs;}}
let sheetJsPromise:Promise<SheetJs>|null=null;
function loadSpreadsheetReader():Promise<SheetJs>{
 if(window.XLSX)return Promise.resolve(window.XLSX);
 if(sheetJsPromise)return sheetJsPromise;
 sheetJsPromise=new Promise<SheetJs>((resolve,reject)=>{
  const src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
  const script=document.createElement("script");script.src=src;script.async=true;script.referrerPolicy="no-referrer";
  script.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error("Spreadsheet reader did not initialize."));
  script.onerror=()=>reject(new Error("Spreadsheet preview library could not load. Check the network connection."));
  document.head.appendChild(script);
 }).catch(error=>{sheetJsPromise=null;throw error;});
 return sheetJsPromise;
}
function SpreadsheetViewer({preview}:{preview:SpreadsheetPreview}){
 const [sheet,setSheet]=useState(0);
 const [more,setMore]=useState(false);
 const selected=preview.sheets[sheet];
 const rows=selected?.rows||[];
 const shown=more?Math.min(rows.length,1000):Math.min(rows.length,100);
 const columns=Math.min(40,Math.max(1,...rows.slice(0,shown).map(row=>row.length)));
 return <div style={{marginTop:14}}>
  <p className="muted">Spreadsheet preview — stored privately in this customer's documents. Click a sheet to change worksheets.</p>
  <div className="roofToolbar" role="group" aria-label="Spreadsheet worksheets">{preview.sheets.map((item,index)=><button key={item.name+index} type="button" className={index===sheet?"btn":"mini"} onClick={()=>{setSheet(index);setMore(false);}}>{item.name}</button>)}</div>
  <div style={{width:"100%",maxHeight:520,overflow:"auto",border:"1px solid #cbd5e1",borderRadius:8,marginTop:12}}>
   <table className="table" style={{width:"max-content",minWidth:"100%",borderCollapse:"collapse"}}>
    <tbody>{rows.slice(0,shown).map((row,i)=><tr key={i}><th scope="row" style={{position:"sticky",left:0,background:"#e2e8f0",padding:"8px 10px",border:"1px solid #cbd5e1",fontSize:12}}>{i+1}</th>{Array.from({length:columns},(_,j)=><td key={j} style={{padding:"7px 10px",border:"1px solid #e2e8f0",fontSize:13,whiteSpace:"pre-wrap",minWidth:90,maxWidth:360,overflowWrap:"anywhere"}}>{row[j]??""}</td>)}</tr>)}</tbody>
   </table>
  </div>
  {rows.length>shown&&<button type="button" className="btn secondary" style={{marginTop:10}} onClick={()=>setMore(true)}>Show more rows (up to 1,000)</button>}
  <p className="small muted">Showing {shown} of {rows.length} rows and up to {columns} columns. The preview displays values, not complete Excel formatting, charts or formulas; use Download if you need the original workbook.</p>
 </div>;
}

export default function LeadFiles({leads,userId,initialLeadId="",initialFilter="All",onSelect}:{leads:Lead[];userId:string|null;initialLeadId?:string;initialFilter?:"All"|"Photos"|"Videos"|"Documents";onSelect?:(id:string)=>void}){
 const db=useMemo(()=>createClient(),[]);const [leadId,setLeadId]=useState(initialLeadId);const [files,setFiles]=useState<Attachment[]>([]);const [loading,setLoading]=useState(false);const [ready,setReady]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [filter,setFilter]=useState(initialFilter);const [more,setMore]=useState(false);const [refresh,setRefresh]=useState(0);const [preview,setPreview]=useState<{file:Attachment;url:string}|null>(null);const [spreadsheet,setSpreadsheet]=useState<SpreadsheetPreview|null>(null);const previewTop=useRef<HTMLDivElement>(null);const [thumbnails,setThumbnails]=useState<Record<string,string>>({});const signedAt=useRef(0);
 const lead=leads.find(item=>item.id===leadId);const prefix=(lead?.user_id||userId)+"/"+leadId;
 useEffect(()=>{let active=true;setFiles([]);setPreview(null);setSpreadsheet(null);setReady(false);setMessage("");setFilter(initialFilter);setMore(false);if(!leadId||!userId||!db){setLoading(false);return;}setLoading(true);db.storage.from(bucket).list(prefix,{limit:pageSize,sortBy:{column:"created_at",order:"desc"}}).then(({data,error})=>{if(!active)return;if(error)throw error;setFiles((data||[]).filter(file=>file.id) as Attachment[]);setMore(data.length===pageSize);setReady(true);}).catch(error=>{if(active)setMessage(error.message||"Could not load files.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[leadId,userId,db,prefix,refresh,initialFilter]);
 useEffect(()=>{
  let active=true;
  setThumbnails({});signedAt.current=0;
  if(!db||!userId||!leadId||files.length===0)return()=>{active=false;};
  // Sign photo and PDF files for thumbnails; PDFs load only when scrolled into view.
  const previews=files.filter(file=>category(file)==="Photos"||file.name.toLowerCase().endsWith(".pdf"));
  if(!previews.length)return()=>{active=false;};
  const paths=previews.map(file=>prefix+"/"+file.name);
  db.storage.from(bucket).createSignedUrls(paths,3600).then(({data,error})=>{
   if(!active)return;
   if(error){setMessage("Could not load photo thumbnails: "+error.message);return;}
   const urls:Record<string,string>={};
   (data||[]).forEach((entry,index)=>{
    if(entry.signedUrl&&!entry.error)urls[previews[index].name]=entry.signedUrl;
   });
   signedAt.current=Date.now();setThumbnails(urls);
  }).catch(error=>{if(active)setMessage(error instanceof Error?error.message:"Could not load thumbnails.");});
  return()=>{active=false;};
 },[db,userId,leadId,prefix,files]);

 async function loadMore(){if(!db||busy)return;setBusy(true);try{const {data,error}=await db.storage.from(bucket).list(prefix,{limit:pageSize,offset:files.length,sortBy:{column:"created_at",order:"desc"}});if(error)throw error;setFiles(current=>[...current,...data.filter(file=>file.id)] as Attachment[]);setMore(data.length===pageSize);}catch(error){setMessage(error instanceof Error?error.message:"Could not load more files.");}finally{setBusy(false);}}
 async function upload(selected:File[]){if(!db||!userId||!lead||!selected.length||busy)return;setBusy(true);setPreview(null);setSpreadsheet(null);let uploaded=0;const failures:string[]=[];for(let index=0;index<selected.length;index++){const file=selected[index];setMessage(`Uploading ${index+1} of ${selected.length}: ${file.name}`);const extension=file.name.split(".").pop()?.toLowerCase()||"";const mime=types[extension];if(!mime||file.size>50*1024*1024||file.size===0){failures.push(`${file.name}: unsupported format, empty file, or larger than 50 MB`);continue;}try{const filename=crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");const {error}=await db.storage.from(bucket).upload(prefix+"/"+filename,file,{contentType:mime,upsert:false});if(error)throw error;uploaded++;}catch(error){failures.push(file.name+": "+(error instanceof Error?error.message:"upload failed"));}}
 try{const {data,error}=await db.storage.from(bucket).list(prefix,{limit:pageSize,sortBy:{column:"created_at",order:"desc"}});if(error)throw error;setFiles(data.filter(file=>file.id) as Attachment[]);setMore(data.length===pageSize);}catch(error){failures.push("Refresh the list: "+(error instanceof Error?error.message:"could not reload"));}setMessage(`${uploaded} file${uploaded===1?"":"s"} uploaded to ${lead.name}.${failures.length?"\n"+failures.join("\n"):""}`);setBusy(false);}
 async function view(file:Attachment){
  if(!db||busy)return;
  setMessage("");setSpreadsheet(null);setPreview(null);
  const extension=file.name.split(".").pop()?.toLowerCase();
  if(extension==="xlsx"||extension==="xls"||extension==="csv"){
   setBusy(true);
   try{
    // Supabase authenticates this download. The document is parsed in browser memory, never sent to a document viewer.
    const [{data,error},XLSX]=await Promise.all([db.storage.from(bucket).download(prefix+"/"+file.name),loadSpreadsheetReader()]);
    if(error)throw error;
    if(!data)throw new Error("Could not load the spreadsheet.");
    const buffer=await data.arrayBuffer();
    const book=XLSX.read(buffer,{type:"array",cellDates:true});
    if(!book.SheetNames.length)throw new Error("Spreadsheet contains no worksheets.");
    const sheets=book.SheetNames.map(name=>{
      const raw=XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:"",raw:false,blankrows:false});
      return {name,rows:raw.map(row=>row.map(cell=>String(cell??"")))};
    });
    setSpreadsheet({file,sheets});
    requestAnimationFrame(()=>previewTop.current?.scrollIntoView({behavior:"smooth",block:"start"}));
   }catch(error){setMessage(error instanceof Error?error.message:"Unable to preview this document.");}
   finally{setBusy(false);}
   return;
  }
const cached=thumbnails[file.name];if((category(file)==="Photos"||file.name.toLowerCase().endsWith(".pdf"))&&cached&&Date.now()-signedAt.current<50*60*1000){setPreview({file,url:cached});requestAnimationFrame(()=>previewTop.current?.scrollIntoView({behavior:"smooth",block:"start"}));return;}setBusy(true);try{const {data,error}=await db.storage.from(bucket).createSignedUrl(prefix+"/"+file.name,3600);if(error)throw error;setPreview({file,url:data.signedUrl});requestAnimationFrame(()=>previewTop.current?.scrollIntoView({behavior:"smooth",block:"start"}));}catch(error){setMessage(error instanceof Error?error.message:"Could not open file.");}finally{setBusy(false);}}
 async function download(file:Attachment){if(!db||busy)return;const popup=window.open("about:blank","_blank");if(!popup){setMessage("Allow popups to download files.");return;}popup.opener=null;setBusy(true);try{const {data,error}=await db.storage.from(bucket).createSignedUrl(prefix+"/"+file.name,60,{download:displayName(file.name)});if(error)throw error;popup.location.href=data.signedUrl;}catch(error){popup.close();setMessage(error instanceof Error?error.message:"Could not download file.");}finally{setBusy(false);}}
 async function remove(file:Attachment){if(!db||busy||!window.confirm(`Permanently delete ${displayName(file.name)} from this lead’s files?`))return;setBusy(true);try{const {error}=await db.storage.from(bucket).remove([prefix+"/"+file.name]);if(error)throw error;setFiles(current=>current.filter(item=>item.name!==file.name));if(preview?.file.name===file.name)setPreview(null);if(spreadsheet?.file.name===file.name)setSpreadsheet(null);setMessage("File deleted.");}catch(error){setMessage(error instanceof Error?error.message:"Could not delete file.");}finally{setBusy(false);}}
 const visible=files.filter(file=>filter==="All"||category(file)===filter);
 return <div className="card"><h2>Lead files & uploads</h2><p className="muted">Keep each lead’s roof photos, inspection videos and documents together. Existing Customer Workspace uploads appear here too.</p><div className="field"><label htmlFor="files-lead">Lead / property</label><select id="files-lead" value={leadId} disabled={busy} onChange={event=>{setLeadId(event.target.value);onSelect?.(event.target.value);}}><option value="">Choose a lead</option>{leads.map(item=><option key={item.id} value={item.id}>{item.name} — {item.address}</option>)}</select></div>{lead&&<><div className="field" style={{marginTop:16}}><label htmlFor="lead-upload">Upload photos, videos, PDFs or Excel files · up to 50 MB per file</label><input id="lead-upload" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.mov,.webm,.m4v,.xls,.xlsx,.csv" disabled={busy||loading||!ready} onChange={event=>{const selected=Array.from(event.target.files||[]);event.target.value="";void upload(selected);}}/></div><p className="small muted">JPG, PNG, WebP, PDF, Excel (XLS/XLSX), CSV, MP4, MOV, WebM and M4V. You can select multiple files. Video playback depends on your browser’s codec support.</p><div className="roofToolbar"><div className="field"><label htmlFor="file-filter">Show</label><select id="file-filter" value={filter} onChange={event=>setFilter(event.target.value as "All"|"Photos"|"Videos"|"Documents")}>{["All","Photos","Videos","Documents"].map(kind=><option key={kind}>{kind}</option>)}</select></div><button className="mini" disabled={busy||loading} onClick={()=>setRefresh(value=>value+1)}>Refresh files</button></div></>}{message&&<p className="notice" role="status" style={{whiteSpace:"pre-wrap"}}>{message}</p>}{loading&&<p role="status">Loading this lead’s files…</p>}{(preview||spreadsheet)&&<div ref={previewTop} className="card" style={{marginTop:16,scrollMarginTop:16}}><h3>{displayName((preview?.file||spreadsheet!.file).name)}</h3><button className="mini" onClick={()=>{setPreview(null);setSpreadsheet(null);}}>Close preview</button>{spreadsheet?<SpreadsheetViewer key={spreadsheet.file.name} preview={spreadsheet}/>:preview&&category(preview.file)==="Photos"?<ZoomablePhoto key={preview.url} src={preview.url} alt={displayName(preview.file.name)}/>:category(preview.file)==="Videos"?<video key={preview.url} controls preload="metadata" src={preview.url} style={{width:"100%",maxHeight:600,marginTop:16}}/>:preview.file.name.toLowerCase().endsWith(".pdf")?<><iframe title={"PDF preview: "+displayName(preview.file.name)} src={preview.url+"#toolbar=1"} style={{width:"100%",height:540,border:"1px solid #cbd5e1",marginTop:12}}/><p><a href={preview.url} target="_blank" rel="noreferrer" className="btn secondary">Open PDF in new tab</a></p></>:<a href={preview.url} target="_blank" rel="noreferrer" className="btn secondary">Open document</a>}<p className="small muted">Preview access expires after one hour. Click the file thumbnail again to renew it. Files open here without saving them to your device.</p></div>}{lead&&ready&&!loading&&(visible.length?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginTop:16}}>{visible.map(file=><div className="card" key={file.name} style={{padding:10,minWidth:0}}>
 <button type="button" disabled={busy} aria-label={"Preview "+displayName(file.name)} title={"Open "+displayName(file.name)} onClick={()=>void view(file)} style={{display:"block",width:"100%",height:118,padding:0,border:"1px solid #d1d5db",borderRadius:10,overflow:"hidden",cursor:"pointer",background:"#f3f4f6",position:"relative",marginBottom:12}}>
  {thumbnails[file.name]&&category(file)==="Photos"?<img src={thumbnails[file.name]} alt={displayName(file.name)} loading="lazy" decoding="async" style={{height:"100%",width:"100%",objectFit:"cover"}}/>:thumbnails[file.name]&&file.name.toLowerCase().endsWith(".pdf")?<iframe loading="lazy" tabIndex={-1} aria-hidden="true" title="" src={thumbnails[file.name]+"#toolbar=0&navpanes=0&scrollbar=0"} style={{width:"100%",height:"160%",border:0,pointerEvents:"none",transform:"scale(.82)",transformOrigin:"top center"}}/>:
   
   <span style={{display:"flex",height:"100%",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:"#475569"}}>{category(file)==="Photos"?"PHOTO":category(file)==="Videos"?"VIDEO":"FILE"}</span>}
  
 </button>
 <strong style={{overflowWrap:"anywhere"}}>{displayName(file.name)}</strong><p className="small muted">{category(file)} · {file.metadata?.size!==undefined?(file.metadata.size/1024/1024).toFixed(2)+" MB":"Size unavailable"}<br/>{file.created_at?new Date(file.created_at).toLocaleString():""}</p><div className="roofToolbar"><button className="mini" disabled={busy} onClick={()=>void download(file)}>Download</button><button className="mini" disabled={busy} onClick={()=>void remove(file)}>Delete</button></div></div>)}</div>:<p className="muted">No {filter==="All"?"files":filter.toLowerCase()} in the loaded list for this lead.</p>)}{more&&<button className="btn secondary" disabled={busy||loading} onClick={()=>void loadMore()}>Load more files</button>}<p className="small muted">Files are private to approved Star Roofing CRM accounts. Remove a lead’s files before deleting that lead.</p></div>;
}
