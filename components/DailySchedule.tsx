"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Task = {id:string; title:string; notes:string; task_date:string; task_time:string|null; completed:boolean};
function today() { const date=new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
export default function DailySchedule({userId,cloudMode}:{userId:string|null;cloudMode:boolean}) {
  const supabase=useMemo(()=>createClient(),[]);
  const [day,setDay]=useState(today);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [editing,setEditing]=useState<Task|null>(null);
  const [formOpen,setFormOpen]=useState(false);
  useEffect(()=>{
    let active=true; setTasks([]);setLoading(true);setMessage("");setFormOpen(false);setEditing(null);
    async function load() {try {
      if(cloudMode) {
        if(!supabase || !userId) throw new Error("Sign in to view your personal schedule.");
        const {data,error}=await supabase.from("personal_tasks").select("id,title,notes,task_date,task_time,completed").eq("task_date",day).order("task_time",{ascending:true,nullsFirst:false}).order("created_at");
        if(error) throw error; if(active) setTasks(data as Task[]);
      } else { const stored=localStorage.getItem("richardcrm.personal-tasks.v1"); if(active) setTasks((stored?JSON.parse(stored):[]).filter((task:Task)=>task.task_date===day)); }
    }catch(error){if(active)setMessage(error instanceof Error?error.message:"Could not load tasks.");}finally{if(active)setLoading(false);}}
    void load();return()=>{active=false;};
  },[day,cloudMode,supabase,userId]);
  function storeLocal(task:Task,remove=false) {
    const stored=localStorage.getItem("richardcrm.personal-tasks.v1");const all:Task[]=stored?JSON.parse(stored):[];
    const updated=all.filter(item=>item.id!==task.id);if(!remove)updated.push(task);
    localStorage.setItem("richardcrm.personal-tasks.v1",JSON.stringify(updated));
  }
  async function save(form:FormData) {
    const title=String(form.get("title")||"").trim();if(!title){setMessage("Enter a task name.");return;}
    const record:Task={id:editing?.id||crypto.randomUUID(),title,notes:String(form.get("notes")||""),task_date:String(form.get("date")||day),task_time:String(form.get("time")||"")||null,completed:editing?.completed||false};
    setBusy(true);setMessage("");try {
      if(cloudMode){if(!supabase||!userId)throw new Error("Sign in before saving.");
        const query=editing?supabase.from("personal_tasks").update({...record,updated_at:new Date().toISOString()}).eq("id",record.id):supabase.from("personal_tasks").insert({...record,user_id:userId});
        const {error}=await query.select("id").single();if(error)throw error;
      }else storeLocal(record);
      setTasks(current=>[...current.filter(item=>item.id!==record.id),...(record.task_date===day?[record]:[])]);
      setFormOpen(false);setEditing(null);setMessage("Personal task saved.");
    }catch(error){setMessage(error instanceof Error?error.message:"Could not save task.");}finally{setBusy(false);}
  }
  async function change(task:Task,remove=false) {
    if(busy || (remove&&!window.confirm(`Delete personal task “${task.title}”?`)))return;
    setBusy(true);setMessage("");try {
      const updated={...task,completed:!task.completed};
      if(cloudMode){if(!supabase||!userId)throw new Error("Sign in before changing tasks.");
        const query=remove?supabase.from("personal_tasks").delete().eq("id",task.id):supabase.from("personal_tasks").update({completed:updated.completed,updated_at:new Date().toISOString()}).eq("id",task.id);
        const {error}=await query.select("id").single();if(error)throw error;
      }else storeLocal(updated,remove);
      setTasks(current=>remove?current.filter(item=>item.id!==task.id):current.map(item=>item.id===task.id?updated:item));
      if(editing?.id===task.id){setFormOpen(false);setEditing(null);}
    }catch(error){setMessage(error instanceof Error?error.message:"Could not change task.");}finally{setBusy(false);}
  }
  const sorted=[...tasks].sort((a,b)=>(a.task_time||"99").localeCompare(b.task_time||"99"));
  return <div className="card"><h2>Daily Schedule</h2><p className="muted">Your personal tasks, separate from customers and roofing jobs. Times are local wall-clock times; no notifications are sent.</p>
    <div className="roofToolbar"><div className="field"><label htmlFor="schedule-day">Day</label><input id="schedule-day" type="date" value={day} disabled={busy} onChange={event=>{if(event.target.value)setDay(event.target.value);}}/></div><button className="btn secondary" disabled={busy} onClick={()=>setDay(today())}>Today</button><button className="btn" disabled={busy||loading} onClick={()=>{setEditing(null);setFormOpen(true);}}>Add personal task</button></div>
    {message&&<p className="notice" role="status">{message}</p>}
    {formOpen&&<form key={editing?.id||"new"} action={save} style={{marginTop:20}}><div className="field"><label htmlFor="personal-title">Task</label><input id="personal-title" name="title" required maxLength={200} defaultValue={editing?.title||""} disabled={busy}/></div><div className="roofToolbar"><div className="field"><label htmlFor="personal-date">Date</label><input id="personal-date" name="date" type="date" required defaultValue={editing?.task_date||day} disabled={busy}/></div><div className="field"><label htmlFor="personal-time">Time (optional)</label><input id="personal-time" name="time" type="time" defaultValue={editing?.task_time?.slice(0,5)||""} disabled={busy}/></div></div><div className="field"><label htmlFor="personal-notes">Notes</label><textarea id="personal-notes" name="notes" defaultValue={editing?.notes||""} disabled={busy}/></div><div className="roofToolbar"><button className="btn" disabled={busy}>{busy?"Saving…":editing?"Update task":"Save task"}</button><button type="button" className="btn secondary" disabled={busy} onClick={()=>{setFormOpen(false);setEditing(null);}}>Cancel</button></div></form>}
    <p className="muted">{tasks.filter(task=>task.completed).length} of {tasks.length} complete</p>
    {loading?<p role="status">Loading your schedule…</p>:sorted.length?sorted.map(task=><div className="card" key={task.id} style={{marginTop:12}}><div style={{display:"flex",gap:12,alignItems:"center"}}><button type="button" role="checkbox" aria-checked={task.completed} aria-label={`${task.completed?"Reopen":"Complete"} ${task.title}`} disabled={busy} onClick={()=>void change(task)} style={{borderRadius:"50%",width:32,height:32,minWidth:32,border:"2px solid #d98b13",background:task.completed?"#d98b13":"transparent",color:task.completed?"#172334":"inherit",cursor:"pointer"}}>{task.completed?"✓":""}</button><div style={{flex:1,minWidth:0}}><strong style={{textDecoration:task.completed?"line-through":"none",overflowWrap:"anywhere"}}>{task.title}</strong><div className="small muted">{task.task_time?task.task_time.slice(0,5):"Any time"}{task.completed?" · Complete":""}</div>{task.notes&&<p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{task.notes}</p>}</div></div><div className="roofToolbar"><button className="mini" disabled={busy} onClick={()=>{setEditing(task);setFormOpen(true);}}>Edit</button><button className="mini" disabled={busy} onClick={()=>void change(task,true)}>Delete</button></div></div>):<p className="muted">No personal tasks for this day. Add one above.</p>}
  </div>;
}
