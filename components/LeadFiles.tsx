"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {createClient} from "@/lib/supabase/client";
type Lead={user_id?:string;id:string;name:string;address:string};
type Attachment={name:string;id?:string|null;created_at?:string|null;metadata?:{size?:number;mimetype?:string}};
const bucket="customer-files";
const types:Record<string,string>={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",pdf:"application/pdf",mp4:"video/mp4",mov:"video/quicktime",webm:"video/webm",m4v:"video/x-m4v"};
const pageSize=50;
function displayName(name:string){return name.replace(/^[0-9a-f]{8}-[0-9a-f-]{27}-/i,"");}
function category(file:Attachment){const mime=file.metadata?.mimetype||types[file.name.split(".").pop()?.toLowerCase()||""]||"";return mime.startsWith("image/")?"Photos":mime.startsWith("video/")?"Videos":"Documents";}
function ZoomablePhoto({src,alt}:{src:string;alt:string}){
 const [zoom,setZoom]=useState(1);
 const viewport=useRef<HTMLDivElement>(null);
 const drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
 function setScale(next:number){
  setZoom(Math.min(5,Math.max(1,Math.round(next*100)/100)));
 }
 return <div className="customerPhotoViewer">
  <div className="roofToolbar" style={{margin:"12px 0"}}>
   <button type="button" className="mini" onClick={()=>setScale(zoom-0.5)} disabled={zoom<=1} aria-label="Zoom out">− Zoom out</button>
   <strong aria-live="polite">{Math.round(zoom*100)}%</strong>
   <button type="button" className="mini" onClick={()=>setScale(zoom+0.5)} disabled={zoom>=5} aria-label="Zoom in">+ Zoom in</button>
   <button type="button" className="mini" onClick={()=>{setZoom(1);if(viewport.current){viewport.current.scrollTop=0;viewport.current.scrollLeft=0;}}}>Reset</button>
   <a className="mini" href={src} target="_blank" rel="noreferrer">Open full size</a>
  </div>
  <div ref={viewport} className="customerPhotoViewport" onPointerDown={event=>{
   if(zoom===1||!viewport.current||event.pointerType==="touch")return;
   drag.current={x:event.clientX,y:event.clientY,left:viewport.current.scrollLeft,top:viewport.current.scrollTop};
   event.currentTarget.setPointerCapture(event.pointerId);
  }} onPointerMove={event=>{
   if(!drag.current||!viewport.current)return;
   viewport.current.scrollLeft=drag.current.left-(event.clientX-drag.current.x);
   viewport.current.scrollTop=drag.current.top-(event.clientY-drag.current.y);
  }} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
   <img src={src} alt={alt} draggable={false} style={{display:"block",width:zoom===1?"100%":(zoom*100)+"%",maxWidth:"none",height:"auto",objectFit:"contain",userSelect:"none"}}/>
  </div>
  <p className="small muted">Use Zoom in / Zoom out to inspect details. Drag the enlarged photo to move around it, or scroll within the viewer.</p>
 </div>;
}
export default function LeadFiles({leads,userId,initialLeadId="",initialFilter="All",onSelect}:{leads:Lead[];userId:string|null;initialLeadId?:string;initialFilter?:"All"|"Photos"|"Videos"|"Documents";onSelect?:(id:string)=>void}){
 const db=useMemo(()=>createClient(),[]);const [leadId,setLeadId]=useState(initialLeadId);const [files,setFiles]=useState<Attachment[]>([]);const [loading,setLoading]=useState(false);const [ready,setReady]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [filter,setFilter]=useState(initialFilter);const [more,setMore]=useState(false);const [refresh,setRefresh]=useState(0);const [preview,setPreview]=useState<{file:Attachment;url:string}|null>(null);const [thumbnails,setThumbnails]=useState<Record<string,string>>({});
 const lead=leads.find(item=>item.id===leadId);const prefix=(lead?.user_id||userId)+"/"+leadId;
 useEffect(()=>{let active=true;setFiles([]);setPreview(null);setReady(false);setMessage("");setFilter(initialFilter);setMore(false);if(!leadId||!userId||!db){setLoading(false);return;}setLoading(true);db.storage.from(bucket).list(prefix,{limit:pageSize,sortBy:{column:"created_at",order:"desc"}}).then(({data,error})=>{if(!active)return;if(error)throw error;setFiles((data||[]).filter(file=>file.id) as Attachment[]);setMore(data.length===pageSize);setReady(true);}).catch(error=>{if(active)setMessage(error.message||"Could not load files.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[leadId,userId,db,prefix,refresh,initialFilter]);
 useEffect(()=>{
  let active=true;
  setThumbnails({});
  if(!db||!userId||!leadId||files.length===0)return()=>{active=false;};
  const paths=files.map(file=>prefix+"/"+file.name);
  // Signed, time-limited URLs keep private customer photos and documents off public storage.
  db.storage.from(bucket).createSignedUrls(paths,3600).then(({data,error})=>{
   if(!active)return;
   if(error){setMessage("Could not load file thumbnails: "+error.message);return;}
   const urls:Record<string,string>={};
   (data||[]).forEach((entry,index)=>{
    if(entry.signedUrl && !entry.error)urls[files[index].name]=entry.signedUrl;
   });
   setThumbnails(urls);
  }).catch(error=>{if(active)setMessage(error instanceof Error?error.message:"Could not load thumbnails.");});
  return()=>{active=false;};
 },[db,userId,leadId,prefix,files]);
 async function loadMore(){if(!db||busy)return;setBusy(true);try{const {data,error}=await db.storage.from(bucket).list(prefix,{limit:pageSize,offset:files.length,sortBy:{column:"created_at",order:"desc"}});if(error)throw error;setFiles(current=>[...current,...data.filter(file=>file.id)] as Attachment[]);setMore(data.length===pageSize);}catch(error){setMessage(error instanceof Error?error.message:"Could not load more files.");}finally{setBusy(false);}}
 async function upload(selected:File[]){if(!db||!userId||!lead||!selected.length||busy)return;setBusy(true);setPreview(null);let uploaded=0;const failures:string[]=[];for(let index=0;index<selected.length;index++){const file=selected[index];setMessage(`Uploading ${index+1} of ${selected.length}: ${file.name}`);const extension=file.name.split(".").pop()?.toLowerCase()||"";const mime=types[extension];if(!mime||file.size>50*1024*1024||file.size===0){failures.push(`${file.name}: unsupported format, empty file, or larger than 50 MB`);continue;}try{const filename=crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");const {error}=await db.storage.from(bucket).upload(prefix+"/"+filename,file,{contentType:mime,upsert:false});if(error)throw error;uploaded++;}catch(error){failures.push(file.name+": "+(error instanceof Error?error.message:"upload failed"));}}
 try{const {data,error}=await db.storage.from(bucket).list(prefix,{limit:pageSize,sortBy:{column:"created_at",order:"desc"}});if(error)throw error;setFiles(data.filter(file=>file.id) as Attachment[]);setMore(data.length===pageSize);}catch(error){failures.push("Refresh the list: "+(error instanceof Error?error.message:"could not reload"));}setMessage(`${uploaded} file${uploaded===1?"":"s"} uploaded to ${lead.name}.${failures.length?"\n"+failures.join("\n"):""}`);setBusy(false);}
 async function view(file:Attachment){if(!db||busy)return;setBusy(true);try{const {data,error}=await db.storage.from(bucket).createSignedUrl(prefix+"/"+file.name,3600);if(error)throw error;setPreview({file,url:data.signedUrl});}catch(error){setMessage(error instanceof Error?error.message:"Could not open file.");}finally{setBusy(false);}}
 async function download(file:Attachment){if(!db||busy)return;const popup=window.open("about:blank","_blank");if(!popup){setMessage("Allow popups to download files.");return;}popup.opener=null;setBusy(true);try{const {data,error}=await db.storage.from(bucket).createSignedUrl(prefix+"/"+file.name,60,{download:displayName(file.name)});if(error)throw error;popup.location.href=data.signedUrl;}catch(error){popup.close();setMessage(error instanceof Error?error.message:"Could not download file.");}finally{setBusy(false);}}
 async function remove(file:Attachment){if(!db||busy||!window.confirm(`Permanently delete ${displayName(file.name)} from this lead’s files?`))return;setBusy(true);try{const {error}=await db.storage.from(bucket).remove([prefix+"/"+file.name]);if(error)throw error;setFiles(current=>current.filter(item=>item.name!==file.name));if(preview?.file.name===file.name)setPreview(null);setMessage("File deleted.");}catch(error){setMessage(error instanceof Error?error.message:"Could not delete file.");}finally{setBusy(false);}}
 const visible=files.filter(file=>filter==="All"||category(file)===filter);
 return <div className="card"><h2>Lead files & uploads</h2><p className="muted">Keep each lead’s roof photos, inspection videos and documents together. Existing Customer Workspace uploads appear here too.</p><div className="field"><label htmlFor="files-lead">Lead / property</label><select id="files-lead" value={leadId} disabled={busy} onChange={event=>{setLeadId(event.target.value);onSelect?.(event.target.value);}}><option value="">Choose a lead</option>{leads.map(item=><option key={item.id} value={item.id}>{item.name} — {item.address}</option>)}</select></div>{lead&&<><div className="field" style={{marginTop:16}}><label htmlFor="lead-upload">Upload photos, videos or PDFs · up to 50 MB per file</label><input id="lead-upload" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.mov,.webm,.m4v" disabled={busy||loading||!ready} onChange={event=>{const selected=Array.from(event.target.files||[]);event.target.value="";void upload(selected);}}/></div><p className="small muted">JPG, PNG, WebP, PDF, MP4, MOV, WebM and M4V. You can select multiple files. Video playback depends on your browser’s codec support.</p><div className="roofToolbar"><div className="field"><label htmlFor="file-filter">Show</label><select id="file-filter" value={filter} onChange={event=>setFilter(event.target.value as "All"|"Photos"|"Videos"|"Documents")}>{["All","Photos","Videos","Documents"].map(kind=><option key={kind}>{kind}</option>)}</select></div><button className="mini" disabled={busy||loading} onClick={()=>setRefresh(value=>value+1)}>Refresh files</button></div></>}{message&&<p className="notice" role="status" style={{whiteSpace:"pre-wrap"}}>{message}</p>}{loading&&<p role="status">Loading this lead’s files…</p>}{preview&&<div className="card" style={{marginTop:16}}><h3>{displayName(preview.file.name)}</h3><button className="mini" onClick={()=>setPreview(null)}>Close preview</button>{category(preview.file)==="Photos"?<ZoomablePhoto key={preview.url} src={preview.url} alt={displayName(preview.file.name)}/>:category(preview.file)==="Videos"?<video key={preview.url} controls preload="metadata" src={preview.url} style={{width:"100%",maxHeight:600,marginTop:16}}/>:<a href={preview.url} target="_blank" rel="noreferrer" className="btn secondary">Open PDF</a>}<p className="small muted">Preview access expires after one hour. Click View again to renew it.</p></div>}{lead&&ready&&!loading&&(visible.length?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginTop:16}}>{visible.map(file=><div className="card" key={file.name} style={{padding:10,minWidth:0}}>
 <button type="button" disabled={busy} aria-label={"Preview "+displayName(file.name)} title={"Open "+displayName(file.name)} onClick={()=>void view(file)} style={{display:"block",width:"100%",height:118,padding:0,border:"1px solid #d1d5db",borderRadius:10,overflow:"hidden",cursor:"pointer",background:"#f3f4f6",position:"relative",marginBottom:12}}>
  {thumbnails[file.name]&&category(file)==="Photos"?<img src={thumbnails[file.name]} alt={displayName(file.name)} loading="lazy" style={{height:"100%",width:"100%",objectFit:"cover"}}/>:
   thumbnails[file.name]&&category(file)==="Videos"?<video src={thumbnails[file.name]} muted playsInline preload="metadata" style={{height:"100%",width:"100%",objectFit:"cover",pointerEvents:"none"}}/>:
   thumbnails[file.name]&&file.name.toLowerCase().endsWith(".pdf")?<iframe src={thumbnails[file.name]+"#page=1&toolbar=0&navpanes=0"} title={"PDF preview: "+displayName(file.name)} loading="lazy" tabIndex={-1} aria-hidden="true" style={{width:"100%",height:"100%",border:0,pointerEvents:"none"}}/>:
   <span style={{display:"flex",height:"100%",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:"#475569"}}>{category(file)==="Photos"?"PHOTO":category(file)==="Videos"?"VIDEO":"FILE"}</span>}
  <span style={{position:"absolute",bottom:8,right:8,background:"rgba(0,0,0,.75)",color:"#fff",padding:"5px 9px",borderRadius:6,fontSize:12}}>{category(file)==="Videos"?"Play video":"Click to view"}</span>
 </button>
 <strong style={{overflowWrap:"anywhere"}}>{displayName(file.name)}</strong><p className="small muted">{category(file)} · {file.metadata?.size!==undefined?(file.metadata.size/1024/1024).toFixed(2)+" MB":"Size unavailable"}<br/>{file.created_at?new Date(file.created_at).toLocaleString():""}</p><div className="roofToolbar"><button className="mini" disabled={busy} onClick={()=>void view(file)}>View</button><button className="mini" disabled={busy} onClick={()=>void download(file)}>Download</button><button className="mini" disabled={busy} onClick={()=>void remove(file)}>Delete</button></div></div>)}</div>:<p className="muted">No {filter==="All"?"files":filter.toLowerCase()} in the loaded list for this lead.</p>)}{more&&<button className="btn secondary" disabled={busy||loading} onClick={()=>void loadMore()}>Load more files</button>}<p className="small muted">Files are private to approved Star Roofing CRM accounts. Remove a lead’s files before deleting that lead.</p></div>;
}
