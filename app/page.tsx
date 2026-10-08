"use client";

import LeadFiles from "@/components/LeadFiles";
import DashboardOverview from "@/components/DashboardOverview";
import Calendar from "@/components/Calendar";
import Invoices from "@/components/Invoices";
import Jobs from "@/components/Jobs";
import DailySchedule from "@/components/DailySchedule";
import RoofReport from "@/components/RoofReport";
import { edgeLength, type RoofEdge } from "@/lib/roof";
import CustomerWorkspace from "@/components/CustomerWorkspace";
import EstimateBuilder from "@/components/EstimateBuilder";
import RoofMap, { type RoofPoint } from "@/components/RoofMap";
import { useEffect, useMemo, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  status: string;
  source: string;
  value: number;
  notes: string;
};

type RoofSection = {
  id: number;
  name: string;
  footprintSqFt: number;
  pitch: number;
  points?: RoofPoint[];
};

const statuses = ["New Lead", "Inspection", "Estimate Sent", "Won"];

const starterLeads: Lead[] = [
  {
    id: "demo-1",
    name: "Maria Lopez",
    phone: "210-555-0142",
    email: "maria@example.com",
    address: "4827 Culebra Rd, San Antonio, TX",
    status: "New Lead",
    source: "Facebook",
    value: 14500,
    notes: "Wind damage. Wants inspection."
  },
  {
    id: "demo-2",
    name: "James Carter",
    phone: "210-555-0199",
    email: "james@example.com",
    address: "11803 Potranco Rd, San Antonio, TX",
    status: "Inspection",
    source: "Referral",
    value: 18200,
    notes: "Inspection appointment Thursday."
  },
  {
    id: "demo-3",
    name: "Angela Ruiz",
    phone: "210-555-0114",
    email: "angela@example.com",
    address: "9010 Marbach Rd, San Antonio, TX",
    status: "Estimate Sent",
    source: "Google",
    value: 12950,
    notes: "Waiting on insurance response."
  }
];

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

function mapDbLead(row: any): Lead {
  return {
    id: String(row.id),
    name: row.name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    status: row.status ?? "New Lead",
    source: row.source ?? "Other",
    value: Number(row.potential_value ?? 0),
    notes: row.notes ?? ""
  };
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const cloudMode = isSupabaseConfigured();

  const [tab, setTab] = useState("Dashboard");
  const [leads, setLeads] = useState<Lead[]>(cloudMode ? [] : starterLeads);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [search, setSearch] = useState("");
  const [localReady, setLocalReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [sections, setSections] = useState<RoofSection[]>([
    { id: 1, name: "Main Roof", footprintSqFt: 1800, pitch: 6 }
  ]);
  const [calendarDay,setCalendarDay]=useState("");
  const [customerContext,setCustomerContext]=useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [edges, setEdges] = useState<RoofEdge[]>([]);
  const [measurementReady, setMeasurementReady] = useState(false);
  const [waste, setWaste] = useState(10);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(!cloudMode);
  const [authError, setAuthError] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!cloudMode) {
      const saved = localStorage.getItem("richardcrm.leads");
      if (saved) {
        try {
          setLeads(JSON.parse(saved));
        } catch {}
      }
      setLocalReady(true);
      return;
    }

    if (!supabase) return;

    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setUserId(data.user?.id ?? null);
      if (error) setAuthError(error.message);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
      if (!session?.user) { setLeads([]); setSelectedLeadId(""); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [cloudMode, supabase]);

  useEffect(() => {
    if (!cloudMode && localReady) {
      localStorage.setItem("richardcrm.leads", JSON.stringify(leads));
    }
  }, [cloudMode, leads, localReady]);

  useEffect(() => {
    if (!cloudMode || !supabase || !userId) return;
    let active = true;
    supabase.from("leads").select("*").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(error.message);
      else if (data) setLeads(data.map(mapDbLead));
    });
    return () => { active = false; };
  }, [cloudMode, supabase, userId]);

  useEffect(() => {
    let active = true;
    setMeasurementReady(false); setSections([]); setEdges([]); setWaste(10);
    const load = async () => {
      try {
        if (cloudMode && supabase && userId && selectedLeadId) {
          const {data, error} = await supabase.from("roof_measurements").select("sections,waste_percent,edges").eq("lead_id",selectedLeadId).order("created_at",{ascending:false}).limit(1).maybeSingle();
          if (!active) return;
          if (error) throw error;
          if (data) { setSections(data.sections); setEdges(data.edges || []); setWaste(Number(data.waste_percent)); }
        } else if (!cloudMode && selectedLeadId) {
          const saved = localStorage.getItem("richardcrm.measurements.local." + selectedLeadId);
          if (saved) { const record=JSON.parse(saved); setSections(record.sections || []); setEdges(record.edges || []); setWaste(record.waste_percent ?? 10); }
        }
      } catch (error) { if (active) setAuthError(error instanceof Error ? error.message : "Could not load saved measurement."); }
      finally { if (active) setMeasurementReady(true); }
    };
    void load();
    return () => { active = false; };
  }, [selectedLeadId, userId, cloudMode, supabase]);

  const openPipeline = leads.filter((l) => l.status !== "Won" && l.status !== "Lost").reduce((sum, l) => sum + l.value, 0);
  const wonRevenue = leads.filter((l) => l.status === "Won").reduce((sum, l) => sum + l.value, 0);
  const inspectionCount = leads.filter((l) => l.status === "Inspection").length;

  const roofTotals = useMemo(() => {
    const raw = sections.reduce((sum, s) => sum + (Number(s.footprintSqFt) || 0) * Math.sqrt(1 + (s.pitch / 12) ** 2), 0);
    const withWaste = raw * (1 + waste / 100);
    return { raw, withWaste, squares: withWaste / 100 };
  }, [sections, waste]);

  async function signIn(formData: FormData) {
    if (!supabase) return;
    setAuthError("");
    setSyncing(true);

    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setSyncing(false);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
  }

  async function addLead(formData: FormData) {
    const amountText = String(formData.get("value") || "").trim().replace(/^\$\s*/, "");
    if (amountText && !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(amountText)) {
      setAuthError("Enter a valid US dollar amount, such as $10,000 or $10,000.50."); return;
    }
    const jobValue = Number(amountText.replace(/,/g, "") || 0);
    if (!Number.isFinite(jobValue) || jobValue > 9999999999.99) {
      setAuthError("Potential job value must be between $0 and $9,999,999,999.99."); return;
    }
    const draft = {
      name: String(formData.get("name") || ""),
      phone: String(formData.get("phone") || ""),
      email: String(formData.get("email") || ""),
      address: String(formData.get("address") || ""),
      status: editingLead?.status || "New Lead",
      source: String(formData.get("source") || "Other"),
      potential_value: jobValue,
      notes: String(formData.get("notes") || "")
    };

    setSyncing(true);
    try {
      if (cloudMode) {
        if (!supabase || !userId) throw new Error("Sign in before saving a lead.");
        const query = editingLead
          ? supabase.from("leads").update({...draft,updated_at:new Date().toISOString()}).eq("id",editingLead.id)
          : supabase.from("leads").insert({...draft,user_id:userId});
        const {data,error} = await query.select().single();
        if (error) throw error;
        const saved = mapDbLead(data);
        setLeads(current=>editingLead?current.map(item=>item.id===saved.id?saved:item):[saved,...current]);
      } else {
        const saved: Lead = {...draft,id:editingLead?.id || crypto.randomUUID(),value:draft.potential_value};
        setLeads(current=>editingLead?current.map(item=>item.id===saved.id?saved:item):[saved,...current]);
      }
      setShowForm(false); setEditingLead(null); setAuthError("");
    } catch (error) { setAuthError(error instanceof Error?error.message:"Could not save lead."); }
    finally { setSyncing(false); }
  }

  async function moveLead(id: string, direction: number) {
    const lead = leads.find(item=>item.id===id);
    if (!lead || syncing) return;
    const index=statuses.indexOf(lead.status);
    const nextStatus=statuses[Math.max(0,Math.min(statuses.length-1,index+direction))];
    setSyncing(true);
    try {
      if (cloudMode) {
        if (!supabase || !userId) throw new Error("Sign in first.");
        const {error} = await supabase.from("leads").update({status:nextStatus,updated_at:new Date().toISOString()}).eq("id",id).select("id").single();
        if (error) throw error;
      }
      setLeads(current=>current.map(item=>item.id===id?{...item,status:nextStatus}:item));
    } catch(error) { setAuthError(error instanceof Error?error.message:"Could not update stage."); }
    finally { setSyncing(false); }
  }

  async function deleteLead(id: string) {
    if (syncing || !window.confirm("Delete this customer and their measurements, estimates, jobs and activity history? Uploaded files must be removed first.")) return;
    setSyncing(true);
    try {
      if (cloudMode) {
        if (!supabase || !userId) throw new Error("Sign in first.");
        const attachments=await supabase.storage.from("customer-files").list(userId+"/"+id,{limit:1});
        if(attachments.error) throw attachments.error;
        if(attachments.data?.length) throw new Error("Remove this customer's uploaded files in Customer Workspace before deleting the customer.");
        const {error}=await supabase.from("leads").delete().eq("id",id).select("id").single();
        if (error) throw error;
      } else {
        const allJobs = JSON.parse(localStorage.getItem("richardcrm.jobs.v1") || "[]");
        const allInvoices = JSON.parse(localStorage.getItem("richardcrm.invoices.v1") || "[]");
        if(allInvoices.some((invoice: {job_id:string})=>allJobs.some((job:{id:string;lead_id:string})=>job.id===invoice.job_id&&job.lead_id===id))) throw new Error("This customer has invoices. Keep the customer and job to preserve payment records.");
        localStorage.removeItem("richardcrm.measurements.local."+id);
        localStorage.removeItem("richardcrm.estimates.v1."+id);
        const jobs = JSON.parse(localStorage.getItem("richardcrm.jobs.v1") || "[]");
        localStorage.setItem("richardcrm.jobs.v1",JSON.stringify(jobs.filter((job: {lead_id: string})=>job.lead_id!==id)));
      }
      setLeads(current=>current.filter(item=>item.id!==id));
      if(customerContext===id)setCustomerContext("");
      if(selectedLeadId===id) setSelectedLeadId("");
    } catch(error) { setAuthError(error instanceof Error?error.message:"Could not delete lead."); }
    finally { setSyncing(false); }
  }

  function updateSection(id: number, patch: Partial<RoofSection>) {
    setSections((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function saveMeasurement() {
    const lead = leads.find(item => item.id === selectedLeadId);
    if (!lead || !sections.length) {
      setAuthError("Choose a customer and add at least one roof section before saving."); return;
    }
    if (sections.some(section => !Number.isFinite(section.footprintSqFt) || section.footprintSqFt <= 0 || !Number.isFinite(section.pitch) || section.pitch < 0 || section.pitch > 12)) {
      setAuthError("Every roof section needs a positive area and pitch between 0/12 and 12/12."); return;
    }
    if (edges.some(edge=>!Number.isFinite(edge.horizontalFt) || edge.horizontalFt<=0 || !Number.isFinite(edge.riseFt) || edge.riseFt<0)) {
      setAuthError("Roof edges need a positive horizontal length and nonnegative height difference."); return;
    }
    const record = {
      lead_id: lead.id, property_address: lead.address, waste_percent: waste,
      footprint_sqft: sections.reduce((sum, section) => sum + section.footprintSqFt, 0),
      roof_surface_sqft: roofTotals.raw, roofing_squares: roofTotals.squares, sections, edges
    };
    setSyncing(true);
    try {
      if (cloudMode && supabase && userId) {
        const { error } = await supabase.from("roof_measurements").insert({ ...record, user_id: userId });
        if (error) throw error;
      }
      if (!cloudMode) localStorage.setItem("richardcrm.measurements.local." + selectedLeadId, JSON.stringify(record));
      setAuthError(cloudMode ? "Measurement saved to this customer in cloud storage." : "Measurement saved to this customer in this browser.");
    } catch (error) { setAuthError(error instanceof Error ? error.message : "Unable to save measurement."); }
    finally { setSyncing(false); }
  }

  if (cloudMode && !authReady) {
    return <div className="empty">Loading secure CRM…</div>;
  }

  if (cloudMode && !userId) {
    return (
      <div className="app" style={{ display: "grid", placeItems: "center", gridTemplateColumns: "1fr", padding: 20 }}>
        <div className="card" style={{ width: "min(480px, 100%)" }}>
          <div className="logo" style={{ marginBottom: 8 }}>Star Roofing <span>CRM</span></div>
          <p className="muted">Private sign-in for your roofing leads and measurements.</p>

          <form action={signIn}>
            <div className="field"><label>Email</label><input name="email" type="email" required /></div>
            <div className="field" style={{ marginTop: 12 }}><label>Password</label><input name="password" type="password" minLength={6} required /></div>
            <div className="actions">

              <button className="btn" disabled={syncing}>{syncing ? "Working…" : "Sign In"}</button>
            </div>
          </form>

          {authError && <div className="notice" style={{ marginTop: 14 }}>{authError}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">Star Roofing <span>CRM</span></div>
        <div className="tagline">Private roofing sales + measurement workspace</div>

        <div className="nav">
          {["Dashboard", "Pipeline", "Customers", "Roof Measure", "Estimates", "Customer Workspace", "Daily Schedule", "Jobs", "Invoices", "Calendar", "Lead Files"].map((item) => (
            <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
              {item}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="small muted">{cloudMode ? "Cloud database connected" : "Local demo storage"}</div>
          {cloudMode && <button className="mini" style={{ marginTop: 8 }} onClick={signOut}>Sign Out</button>}
        </div>
      </aside>

      <main className="main">
        <div className="header">
          <div>
            <h1>{tab}</h1>
            <div className="muted">Manage roofing leads, customers, estimates and roof measurements.</div>
          </div>
          <button className="btn" onClick={() => { setEditingLead(null); setShowForm(true); }}>+ New Lead</button>
        </div>

        {authError && <div className="notice" style={{ marginBottom: 16 }}>{authError}</div>}

        {tab === "Dashboard" && (
          <>
            <div className="grid stats">
              <div className="card">
                <div className="statTitle">Total Leads</div>
                <div className="statValue">{leads.length}</div>
                <div className="statFoot">All active and closed opportunities</div>
              </div>
              <div className="card">
                <div className="statTitle">Inspections</div>
                <div className="statValue">{inspectionCount}</div>
                <div className="statFoot">Leads currently in inspection stage</div>
              </div>
              <div className="card">
                <div className="statTitle">Open Pipeline</div>
                <div className="statValue">{money(openPipeline)}</div>
                <div className="statFoot">Potential revenue still in progress</div>
              </div>
              <div className="card">
                <div className="statTitle">Won Lead Value</div>
                <div className="statValue">{money(wonRevenue)}</div>
                <div className="statFoot">Potential value of won leads; payments shown below</div>
              </div>
            </div>

            <DashboardOverview customers={leads} userId={userId} cloudMode={cloudMode} onOpen={(target,customer,day)=>{setCustomerContext(customer||"");if(day)setCalendarDay(day);setTab(target);}}/>
            <div className="card" style={{ marginTop: 18 }}>
              <div className="sectionTitle">
                <h2>Recent Leads</h2>
                <button className="btn secondary" onClick={() => setTab("Pipeline")}>View Pipeline</button>
              </div>
              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr><th>Customer</th><th>Address</th><th>Status</th><th>Source</th><th>Potential</th></tr>
                  </thead>
                  <tbody>
                    {leads.slice(0, 8).map((lead) => (
                      <tr key={lead.id}>
                        <td><strong>{lead.name}</strong><div className="small muted">{lead.phone}</div></td>
                        <td>{lead.address}</td>
                        <td><span className="badge">{lead.status}</span></td>
                        <td>{lead.source}</td>
                        <td>{money(lead.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "Pipeline" && (
          <div className="pipeline">
            {statuses.map((status) => {
              const column = leads.filter((lead) => lead.status === status);
              return (
                <div className="pipeCol" key={status}>
                  <div className="pipeHead"><span>{status}</span><span className="badge">{column.length}</span></div>
                  {column.map((lead) => (
                    <div className="lead" key={lead.id}>
                      <strong>{lead.name}</strong>
                      <div className="meta">{lead.address}</div>
                      <div className="meta">{lead.phone}</div>
                      <div style={{ marginTop: 8, fontWeight: 800 }}>{money(lead.value)}</div>
                      <div className="leadActions">
                        {status !== statuses[0] && <button className="mini" onClick={() => moveLead(lead.id, -1)}>← Back</button>}
                        {status !== statuses[statuses.length - 1] && <button className="mini" onClick={() => moveLead(lead.id, 1)}>Next →</button>}
                        <button className="mini" onClick={() => deleteLead(lead.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                  {column.length === 0 && <div className="empty">No leads here yet.</div>}
                </div>
              );
            })}
          </div>
        )}

        {tab === "Customers" && (
          <div className="card">
            <div className="sectionTitle"><h2>Customer & Property Records</h2></div>
            <div className="field"><label htmlFor="customer-search">Search customers</label><input id="customer-search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Name, address, phone or email" /></div>
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Phone</th><th>Email</th><th>Property</th><th>Notes</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {leads.filter(lead=>[lead.name,lead.address,lead.phone,lead.email].join(" ").toLowerCase().includes(search.toLowerCase())).map((lead) => (
                    <tr key={lead.id}>
                      <td><strong>{lead.name}</strong></td>
                      <td>{lead.phone || "—"}</td>
                      <td>{lead.email || "—"}</td>
                      <td>{lead.address || "—"}</td>
                      <td>{lead.notes || "—"}</td>
                      <td><button className="mini" onClick={()=>{setEditingLead(lead);setShowForm(true);}}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "Lead Files" && <LeadFiles leads={leads} userId={userId} initialLeadId={customerContext} onSelect={setCustomerContext}/>}
        {tab === "Calendar" && <Calendar customers={leads} userId={userId} cloudMode={cloudMode} onOpen={(target,customer,day)=>{if(customer)setCustomerContext(customer);if(day)setCalendarDay(day);setTab(target);}}/>}
        {tab === "Invoices" && <Invoices customers={leads} userId={userId} cloudMode={cloudMode} initialCustomerId={customerContext} />}
        {tab === "Jobs" && <Jobs customers={leads} userId={userId} cloudMode={cloudMode} initialCustomerId={customerContext} />}
        {tab === "Daily Schedule" && <DailySchedule userId={userId} cloudMode={cloudMode} initialDay={calendarDay} />}
        {tab === "Customer Workspace" && <CustomerWorkspace customers={leads} userId={userId} initialCustomerId={customerContext} onSelect={setCustomerContext} onOpen={setTab} />}
        {tab === "Estimates" && <EstimateBuilder customers={leads} userId={userId} cloudMode={cloudMode} initialCustomerId={customerContext} />}
        {tab === "Roof Measure" && (
          <>
          <div className="card" style={{marginBottom:16}}>
            <div className="field"><label htmlFor="measurement-customer">Customer / property</label>
              <select id="measurement-customer" value={selectedLeadId} onChange={event => setSelectedLeadId(event.target.value)}>
                <option value="">Choose a customer</option>
                {leads.map(lead => <option key={lead.id} value={lead.id}>{lead.name} — {lead.address}</option>)}
              </select>
            </div>
          </div>
          <RoofMap facets={sections} edges={edges} onEdge={edge=>setEdges(current=>[...current,edge])} key={selectedLeadId} address={leads.find(lead => lead.id === selectedLeadId)?.address || ""} onFacet={facet => setSections(current => [...current, {...facet, name: "Facet " + (current.length+1)}])} />
          <div className="measureLayout">
            <div className="card">
              <div className="sectionTitle">
                <div>
                  <h2>Roof Measurement Calculator</h2>
                  <div className="small muted">Enter footprint areas by roof section and select pitch.</div>
                </div>
                <button
                  className="btn secondary"
                  onClick={() =>
                    setSections((s) => [...s, { id: Date.now(), name: `Section ${s.length + 1}`, footprintSqFt: 0, pitch: 6 }])
                  }
                >
                  + Add Section
                </button>
              </div>

              <div className="notice" style={{ marginBottom: 14 }}>
                This calculator converts horizontal footprint areas into estimated sloped roof area. Use manually measured footprints or add facets from the satellite workspace above. Waste applies to material quantities, not roof surface area.
              </div>

              <div className="measureRows">
                {sections.map((section) => (
                  <div className="measureRow" key={section.id}>
                    <div className="field">
                      <label>Roof section</label>
                      <input value={section.name} onChange={(e) => updateSection(section.id, { name: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>Footprint sq ft</label>
                      <input type="number" min="0" value={section.footprintSqFt} onChange={(e) => updateSection(section.id, { footprintSqFt: Number(e.target.value) })} />
                    </div>
                    <div className="field">
                      <label>Pitch</label>
                      <select value={section.pitch} onChange={(e) => updateSection(section.id, { pitch: Number(e.target.value) })}>
                        {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{i}/12</option>)}
                      </select>
                    </div>
                    <button className="mini remove" onClick={() => setSections((s) => s.filter((x) => x.id !== section.id))}>Remove</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="resultHero">
                <div className="small muted">Estimated roofing squares</div>
                <div className="big">{roofTotals.squares.toFixed(2)}</div>
                <div className="small muted">1 square = 100 sq ft</div>
              </div>

              <div className="field" style={{ marginBottom: 12 }}>
                <label>Waste factor</label>
                <select value={waste} onChange={(e) => setWaste(Number(e.target.value))}>
                  {[0, 5, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{n}%</option>)}
                </select>
              </div>

              <div className="kpi"><span>Roof surface</span><strong>{Math.round(roofTotals.raw).toLocaleString()} sq ft</strong></div>
              <div className="kpi"><span>With waste</span><strong>{Math.round(roofTotals.withWaste).toLocaleString()} sq ft</strong></div>
              <div className="kpi"><span>Squares</span><strong>{roofTotals.squares.toFixed(2)}</strong></div>
              <div className="kpi"><span>Bundles @ 3/square</span><strong>{Math.ceil(roofTotals.squares * 3)}</strong></div>

              <button className="btn" style={{ width: "100%", marginTop: 14 }} onClick={saveMeasurement} disabled={syncing || !measurementReady || !selectedLeadId || sections.length === 0}>
                {syncing ? "Saving…" : "Save Measurement"}
              </button>
            </div>
          </div>
          <div className="card" style={{marginTop:16}}>
            <div className="sectionTitle"><h2>Ridge, hip, valley, eave & rake lengths</h2><button className="btn secondary" disabled={!selectedLeadId || !measurementReady} onClick={()=>setEdges(current=>[...current,{id:crypto.randomUUID(),kind:"eave",horizontalFt:0,riseFt:0}])}>Add manual edge</button></div>
            <p className="small muted">Trace two endpoints on the satellite map or enter measured horizontal distance. Supply endpoint height difference for sloped lengths.</p>
            {edges.map(edge=><div className="measureRow" key={edge.id}>
              <div className="field"><label htmlFor={"edge-kind-"+edge.id}>Edge type</label><select id={"edge-kind-"+edge.id} value={edge.kind} onChange={event=>setEdges(current=>current.map(item=>item.id===edge.id?{...item,kind:event.target.value as RoofEdge["kind"]}:item))}>{["ridge","hip","valley","eave","rake"].map(kind=><option key={kind}>{kind}</option>)}</select></div>
              <div className="field"><label htmlFor={"edge-horizontal-"+edge.id}>Horizontal ft</label><input id={"edge-horizontal-"+edge.id} type="number" min="0" step="0.1" value={edge.horizontalFt} onChange={event=>setEdges(current=>current.map(item=>item.id===edge.id?{...item,horizontalFt:Number(event.target.value),points:undefined}:item))}/></div>
              <div className="field"><label htmlFor={"edge-height-"+edge.id}>Height difference ft</label><input id={"edge-height-"+edge.id} type="number" min="0" step="0.1" value={edge.riseFt} onChange={event=>setEdges(current=>current.map(item=>item.id===edge.id?{...item,riseFt:Number(event.target.value)}:item))}/></div>
              <div><strong>{edgeLength(edge).toFixed(1)} ft</strong><br/><button className="mini" onClick={()=>setEdges(current=>current.filter(item=>item.id!==edge.id))}>Remove</button></div>
            </div>)}
            {!edges.length && <p className="muted">No roof edges measured yet.</p>}
          </div>
          <RoofReport customer={leads.find(lead=>lead.id===selectedLeadId)} sections={sections} edges={edges} waste={waste}/>
          </>
        )}
      </main>

      {showForm && (
        <div className="modalBack" onClick={() => setShowForm(false)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <div className="sectionTitle"><h2>{editingLead ? "Edit Customer" : "Add Roofing Lead"}</h2></div>
            <form action={addLead} key={editingLead?.id || "new"}>
              <div className="formGrid">
                <div className="field"><label>Customer name</label><input name="name" defaultValue={editingLead?.name ?? ""} required /></div>
                <div className="field"><label>Phone</label><input name="phone" defaultValue={editingLead?.phone ?? ""} /></div>
                <div className="field"><label>Email</label><input name="email" defaultValue={editingLead?.email ?? ""} type="email" /></div>
                <div className="field"><label>Lead source</label>
                  <select name="source" defaultValue={editingLead?.source || "Facebook"}>
                    <option>Facebook</option><option>Google</option><option>Referral</option><option>Door Knock</option><option>Other</option>
                  </select>
                </div>
                <div className="field full"><label>Property address</label><input name="address" defaultValue={editingLead?.address ?? ""} /></div>
                <div className="field"><label htmlFor="potential-job-value">Potential job value (USD)</label><div style={{display:"flex",alignItems:"center",gap:8}}><span aria-hidden="true">$</span><input id="potential-job-value" name="value" type="text" inputMode="decimal" placeholder="10,000.00" defaultValue={editingLead ? editingLead.value.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}) : ""} onBlur={event=>{const raw=event.currentTarget.value.trim().replace(/^\$\s*/,"");if(raw&&/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)){const value=Number(raw.replace(/,/g,""));if(Number.isFinite(value)&&value<=9999999999.99)event.currentTarget.value=value.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});}}} style={{flex:1,minWidth:0}}/></div></div>
                <div className="field full"><label>Notes</label><textarea name="notes" defaultValue={editingLead?.notes || ""} /></div>
              </div>
              <div className="actions">
                <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn" type="submit" disabled={syncing}>{syncing ? "Saving…" : "Save Lead"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
