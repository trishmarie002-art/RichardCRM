"use client";
import {useEffect,useRef,useState} from "react";

type Type="Photos"|"Videos"|"Documents";
type Props={url?:string;name:string;type:Type;spreadsheetRows:(url:string)=>Promise<string[][]>};
const pdfModule="https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const pdfWorker="https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
let pdfLoader:Promise<any>|undefined;
function loadPdf(){
 if(!pdfLoader)pdfLoader=import(/* webpackIgnore: true */ pdfModule).then(lib=>{lib.GlobalWorkerOptions.workerSrc=pdfWorker;return lib;}).catch(error=>{pdfLoader=undefined;throw error;});
 return pdfLoader;
}
function PdfPage({url}:{url:string}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  let active=true;
  let task:any=null;
  let rendering:any=null;
  const controller=new AbortController();
  async function load(){
   try{
    const [pdfjs,response]=await Promise.all([loadPdf(),fetch(url,{signal:controller.signal})]);
    if(!response.ok)throw Error("Unable to load PDF thumbnail");
    const data=new Uint8Array(await response.arrayBuffer());
    if(!active)return;
    task=pdfjs.getDocument({data,enableXfa:false,isEvalSupported:false});
    const doc=await task.promise;
    if(!active)return;
    const page=await doc.getPage(1);
    if(!active||!canvas.current)return;
    const base=page.getViewport({scale:1});
    const scale=Math.min(148/base.width,114/base.height)*2;
    const viewport=page.getViewport({scale});
    const node=canvas.current;
    node.width=Math.max(1,Math.ceil(viewport.width));node.height=Math.max(1,Math.ceil(viewport.height));
    const context=node.getContext("2d");
    if(!context)throw Error("Canvas unavailable");
    rendering=page.render({canvasContext:context,viewport});
    await rendering.promise;
    if(active)setFailed(false);
   }catch(error){if(active&&!controller.signal.aborted)setFailed(true);}
  }
  void load();
  return()=>{active=false;controller.abort();try{rendering?.cancel();}catch{}try{task?.destroy();}catch{}};
 },[url]);
 return <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#e7ebf0"}}>
  <div style={{display:"flex",width:"88%",height:"96%",background:"#fff",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 5px #0002",overflow:"hidden"}}>
   {failed?<span style={{fontSize:12,fontWeight:700,color:"#64748b"}}>PDF document</span>:<canvas ref={canvas} aria-label="First page of PDF" style={{maxWidth:"100%",maxHeight:"100%",width:"auto",height:"auto",objectFit:"contain"}}/>}
  </div>
 </div>;
}
function DocumentGrid({url,spreadsheetRows}:{url:string;spreadsheetRows:(url:string)=>Promise<string[][]>}){
 const [rows,setRows]=useState<string[][]>([]);
 const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");
 useEffect(()=>{let active=true;setStatus("loading");spreadsheetRows(url).then(data=>{if(active){setRows(data);setStatus("ready");}}).catch(()=>{if(active)setStatus("error");});return()=>{active=false;};},[url,spreadsheetRows]);
 if(status!=="ready")return <div style={{background:"#eef7f2",width:"100%",height:"100%",display:"grid",placeItems:"center",color:"#166534",fontWeight:700,fontSize:12}}>{status==="loading"?"Loading sheet…":"Spreadsheet"}</div>;
 return <div style={{padding:7,width:"100%",height:"100%",overflow:"hidden",background:"white"}}>
  <div style={{height:4,background:"#16a34a",marginBottom:5}}/>
  <table aria-label="Spreadsheet thumbnail" style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed"}}>
   <tbody>{rows.slice(0,6).map((row,i)=><tr key={i}>{Array.from({length:Math.min(4,Math.max(1,...rows.slice(0,6).map(r=>r.length)))},(_,j)=><td key={j} style={{fontSize:8,whiteSpace:"nowrap",textOverflow:"ellipsis",overflow:"hidden",border:"1px solid #d7e2dc",height:15,color:i===0?"#164e36":"#475569",background:i===0?"#dcfce7":"#fff",padding:"1px 3px"}}>{row[j]??""}</td>)}</tr>)}</tbody>
  </table>
 </div>;
}
export default function FileThumbnail({url,name,type,spreadsheetRows}:Props){
 const root=useRef<HTMLDivElement>(null);
 const [visible,setVisible]=useState(false);
 useEffect(()=>{setVisible(false);const node=root.current;if(!node)return;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:"200px"});observer.observe(node);return()=>observer.disconnect();},[url]);
 const extension=name.split(".").pop()?.toLowerCase()||"";
 return <div ref={root} style={{width:"100%",height:"100%",overflow:"hidden",display:"grid",placeItems:"center",background:"#e7edf4"}}>
  {url&&visible&&type==="Photos"?<img src={url} alt="" loading="lazy" style={{height:"100%",width:"100%",objectFit:"cover"}}/>:
   url&&visible&&type==="Videos"?<div style={{position:"relative",width:"100%",height:"100%"}}><video muted playsInline preload="metadata" src={url+"#t=0.1"} onLoadedMetadata={event=>{const video=event.currentTarget;try{video.currentTime=Math.min(0.15,Math.max(0,(video.duration||0)/2));}catch{}}} style={{width:"100%",height:"100%",objectFit:"cover"}}/><span aria-hidden="true" style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",background:"#0009",color:"white",borderRadius:"50%",width:34,height:34,display:"grid",placeItems:"center",fontSize:17}}>▶</span></div>:
   url&&visible&&extension==="pdf"?<PdfPage url={url}/>:
   url&&visible&&["xls","xlsx","csv"].includes(extension)?<DocumentGrid url={url} spreadsheetRows={spreadsheetRows}/>:
   <div style={{height:"100%",width:"100%",display:"grid",placeItems:"center",background:type==="Photos"?"#edf2f8":type==="Videos"?"#e2e8f0":"#eaf2ef"}}><span style={{fontWeight:800,fontSize:16,color:"#475569"}}>{extension.toUpperCase()||"FILE"}</span></div>}
 </div>;
}
