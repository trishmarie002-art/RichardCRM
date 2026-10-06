"use client";

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

const pitchFactor: Record<number, number> = {
  0: 1,
  1: 1.003,
  2: 1.014,
  3: 1.031,
  4: 1.054,
  5: 1.083,
  6: 1.118,
  7: 1.158,
  8: 1.202,
  9: 1.25,
  10: 1.302,
  11: 1.357,
  12: 1.414
};

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
  const [showForm, setShowForm] = useState(false);
  const [sections, setSections] = useState<RoofSection[]>([
    { id: 1, name: "Main Roof", footprintSqFt: 1800, pitch: 6 }
  ]);
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
      return;
    }

    if (!supabase) return;

    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setUserId(uid);

      if (uid) {
        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data) setLeads(data.map(mapDbLead));
        if (error) setAuthError(error.message);
      }
      setAuthReady(true);
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        setLeads([]);
        return;
      }

      const { data } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) setLeads(data.map(mapDbLead));
    });

    return () => listener.subscription.unsubscribe();
  }, [cloudMode, supabase]);

  useEffect(() => {
    if (!cloudMode) {
      localStorage.setItem("richardcrm.leads", JSON.stringify(leads));
    }
  }, [cloudMode, leads]);

  const openPipeline = leads.filter((l) => l.status !== "Won").reduce((sum, l) => sum + l.value, 0);
  const wonRevenue = leads.filter((l) => l.status === "Won").reduce((sum, l) => sum + l.value, 0);
  const inspectionCount = leads.filter((l) => l.status === "Inspection").length;

  const roofTotals = useMemo(() => {
    const raw = sections.reduce((sum, s) => sum + (Number(s.footprintSqFt) || 0) * (pitchFactor[s.pitch] || 1), 0);
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

  async function signUp(formData: FormData) {
    if (!supabase) return;
    setAuthError("");
    setSyncing(true);

    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthError(error.message);
    else setAuthError("Account created. If email confirmation is enabled, check your inbox before signing in.");

    setSyncing(false);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
  }

  async function addLead(formData: FormData) {
    const draft = {
      name: String(formData.get("name") || ""),
      phone: String(formData.get("phone") || ""),
      email: String(formData.get("email") || ""),
      address: String(formData.get("address") || ""),
      status: "New Lead",
      source: String(formData.get("source") || "Other"),
      potential_value: Number(formData.get("value") || 0),
      notes: String(formData.get("notes") || "")
    };

    if (cloudMode && supabase && userId) {
      setSyncing(true);
      const { data, error } = await supabase
        .from("leads")
        .insert({ ...draft, user_id: userId })
        .select()
        .single();

      if (data) setLeads((current) => [mapDbLead(data), ...current]);
      if (error) setAuthError(error.message);
      setSyncing(false);
    } else {
      const lead: Lead = {
        id: Date.now().toString(),
        name: draft.name,
        phone: draft.phone,
        email: draft.email,
        address: draft.address,
        status: draft.status,
        source: draft.source,
        value: draft.potential_value,
        notes: draft.notes
      };
      setLeads((current) => [lead, ...current]);
    }

    setShowForm(false);
  }

  async function moveLead(id: string, direction: number) {
    const lead = leads.find((item) => item.id === id);
    if (!lead) return;

    const index = statuses.indexOf(lead.status);
    const nextStatus = statuses[Math.max(0, Math.min(statuses.length - 1, index + direction))];

    setLeads((current) => current.map((item) => item.id === id ? { ...item, status: nextStatus } : item));

    if (cloudMode && supabase && userId) {
      const { error } = await supabase
        .from("leads")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) setAuthError(error.message);
    }
  }

  async function deleteLead(id: string) {
    setLeads((current) => current.filter((lead) => lead.id !== id));

    if (cloudMode && supabase && userId) {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) setAuthError(error.message);
    }
  }

  function updateSection(id: number, patch: Partial<RoofSection>) {
    setSections((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function saveMeasurement() {
    if (!cloudMode || !supabase || !userId) {
      setAuthError("Cloud storage is not connected yet. The calculator still works in local mode.");
      return;
    }

    setSyncing(true);
    const footprint = sections.reduce((sum, section) => sum + Number(section.footprintSqFt || 0), 0);

    const { error } = await supabase.from("roof_measurements").insert({
      user_id: userId,
      waste_percent: waste,
      footprint_sqft: footprint,
      roof_surface_sqft: roofTotals.withWaste,
      roofing_squares: roofTotals.squares,
      sections
    });

    setAuthError(error ? error.message : "Roof measurement saved.");
    setSyncing(false);
  }

  if (cloudMode && !authReady) {
    return <div className="empty">Loading secure CRM…</div>;
  }

  if (cloudMode && !userId) {
    return (
      <div className="app" style={{ display: "grid", placeItems: "center", gridTemplateColumns: "1fr", padding: 20 }}>
        <div className="card" style={{ width: "min(480px, 100%)" }}>
          <div className="logo" style={{ marginBottom: 8 }}>Richard <span>Roof CRM</span></div>
          <p className="muted">Private sign-in for your roofing leads and measurements.</p>

          <form action={signIn}>
            <div className="field"><label>Email</label><input name="email" type="email" required /></div>
            <div className="field" style={{ marginTop: 12 }}><label>Password</label><input name="password" type="password" minLength={6} required /></div>
            <div className="actions">
              <button className="btn secondary" formAction={signUp} disabled={syncing}>Create Account</button>
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
        <div className="logo">Richard <span>Roof CRM</span></div>
        <div className="tagline">Private roofing sales + measurement workspace</div>

        <div className="nav">
          {["Dashboard", "Pipeline", "Customers", "Roof Measure"].map((item) => (
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
          <button className="btn" onClick={() => setShowForm(true)}>+ New Lead</button>
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
                <div className="statTitle">Won Revenue</div>
                <div className="statValue">{money(wonRevenue)}</div>
                <div className="statFoot">Closed roofing jobs</div>
              </div>
            </div>

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
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Phone</th><th>Email</th><th>Property</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td><strong>{lead.name}</strong></td>
                      <td>{lead.phone || "—"}</td>
                      <td>{lead.email || "—"}</td>
                      <td>{lead.address || "—"}</td>
                      <td>{lead.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "Roof Measure" && (
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
                This calculator converts horizontal footprint areas into estimated sloped roof area. Satellite tracing will be the next measurement upgrade.
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

              <button className="btn" style={{ width: "100%", marginTop: 14 }} onClick={saveMeasurement} disabled={syncing}>
                {syncing ? "Saving…" : "Save Measurement"}
              </button>
            </div>
          </div>
        )}
      </main>

      {showForm && (
        <div className="modalBack" onClick={() => setShowForm(false)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <div className="sectionTitle"><h2>Add Roofing Lead</h2></div>
            <form action={addLead}>
              <div className="formGrid">
                <div className="field"><label>Customer name</label><input name="name" required /></div>
                <div className="field"><label>Phone</label><input name="phone" /></div>
                <div className="field"><label>Email</label><input name="email" type="email" /></div>
                <div className="field"><label>Lead source</label>
                  <select name="source" defaultValue="Facebook">
                    <option>Facebook</option><option>Google</option><option>Referral</option><option>Door Knock</option><option>Other</option>
                  </select>
                </div>
                <div className="field full"><label>Property address</label><input name="address" /></div>
                <div className="field"><label>Potential job value</label><input name="value" type="number" min="0" /></div>
                <div className="field full"><label>Notes</label><textarea name="notes" /></div>
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
