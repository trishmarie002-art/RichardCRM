"use client";

import { useEffect, useMemo, useState } from "react";

type Lead = {
  id: number;
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
    id: 1,
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
    id: 2,
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
    id: 3,
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

export default function Home() {
  const [tab, setTab] = useState("Dashboard");
  const [leads, setLeads] = useState<Lead[]>(starterLeads);
  const [showForm, setShowForm] = useState(false);
  const [sections, setSections] = useState<RoofSection[]>([
    { id: 1, name: "Main Roof", footprintSqFt: 1800, pitch: 6 }
  ]);
  const [waste, setWaste] = useState(10);

  useEffect(() => {
    const saved = localStorage.getItem("richardcrm.leads");
    if (saved) {
      try {
        setLeads(JSON.parse(saved));
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("richardcrm.leads", JSON.stringify(leads));
  }, [leads]);

  const openPipeline = leads.filter((l) => l.status !== "Won").reduce((sum, l) => sum + l.value, 0);
  const wonRevenue = leads.filter((l) => l.status === "Won").reduce((sum, l) => sum + l.value, 0);
  const inspectionCount = leads.filter((l) => l.status === "Inspection").length;

  const roofTotals = useMemo(() => {
    const raw = sections.reduce((sum, s) => sum + (Number(s.footprintSqFt) || 0) * (pitchFactor[s.pitch] || 1), 0);
    const withWaste = raw * (1 + waste / 100);
    return {
      raw,
      withWaste,
      squares: withWaste / 100
    };
  }, [sections, waste]);

  function addLead(formData: FormData) {
    const lead: Lead = {
      id: Date.now(),
      name: String(formData.get("name") || ""),
      phone: String(formData.get("phone") || ""),
      email: String(formData.get("email") || ""),
      address: String(formData.get("address") || ""),
      status: "New Lead",
      source: String(formData.get("source") || "Other"),
      value: Number(formData.get("value") || 0),
      notes: String(formData.get("notes") || "")
    };
    setLeads((current) => [lead, ...current]);
    setShowForm(false);
  }

  function moveLead(id: number, direction: number) {
    setLeads((current) =>
      current.map((lead) => {
        if (lead.id !== id) return lead;
        const index = statuses.indexOf(lead.status);
        const next = Math.max(0, Math.min(statuses.length - 1, index + direction));
        return { ...lead, status: statuses[next] };
      })
    );
  }

  function deleteLead(id: number) {
    setLeads((current) => current.filter((lead) => lead.id !== id));
  }

  function updateSection(id: number, patch: Partial<RoofSection>) {
    setSections((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
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
      </aside>

      <main className="main">
        <div className="header">
          <div>
            <h1>{tab}</h1>
            <div className="muted">Manage roofing leads, customers, estimates and roof measurements.</div>
          </div>
          <button className="btn" onClick={() => setShowForm(true)}>+ New Lead</button>
        </div>

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
                This first version calculates roof surface area from measured footprint area and pitch. Satellite tracing and address-based aerial imagery can be plugged in next; this calculator does not pretend an address alone can produce an accurate roof measurement.
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
                <button className="btn" type="submit">Save Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
