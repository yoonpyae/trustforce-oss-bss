"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlantMap } from "@/components/PlantMapLoader";

type Olt = { id: string; name: string; lat: number; lng: number; operStatus: string; site: string; vendor: string; model: string };
type Dn = { id: string; name: string; lat: number; lng: number; condition: string; zone: string; oltId: string };
type Sn = { id: string; name: string; lat: number; lng: number; condition: string; zone: string; customers: number; dnId: string };
type Fiber = { id: string; kind: string; route: [number, number][] };

type Layer = "olt" | "dn" | "sn" | "fiber";

const STATUS_DOT: Record<string, string> = { up: "var(--good)", enabled: "var(--good)", good: "var(--good)", degraded: "var(--warn)", attention: "var(--warn)", down: "var(--bad)" };

export function NetworkExplorer({ olts, dns, sns, fibers, initialFocus }: { olts: Olt[]; dns: Dn[]; sns: Sn[]; fibers: Fiber[]; initialFocus?: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(olts.map((o) => o.id)));
  const [visible, setVisible] = useState<Record<Layer, boolean>>({ olt: true, dn: true, sn: true, fiber: true });
  const [focus, setFocus] = useState<string | undefined>(initialFocus);
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const matches = (str: string) => !query || str.toLowerCase().includes(query);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleLayer(layer: Layer) {
    setVisible((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }

  const dnsByOlt = useMemo(() => {
    const m = new Map<string, Dn[]>();
    for (const d of dns) {
      if (!m.has(d.oltId)) m.set(d.oltId, []);
      m.get(d.oltId)!.push(d);
    }
    return m;
  }, [dns]);
  const snsByDn = useMemo(() => {
    const m = new Map<string, Sn[]>();
    for (const sn of sns) {
      if (!m.has(sn.dnId)) m.set(sn.dnId, []);
      m.get(sn.dnId)!.push(sn);
    }
    return m;
  }, [sns]);

  return (
    <div className="grid" style={{ gridTemplateColumns: "300px 1fr", gap: 14, alignItems: "start" }}>
      <div className="card" style={{ maxHeight: 620, overflowY: "auto" }}>
        <header><h3>Plant explorer</h3></header>
        <input className="plain" style={{ width: "100%", marginBottom: 10 }} placeholder="Filter OLT/DN/SN…" value={q} onChange={(e) => setQ(e.target.value)} />

        <div className="legend" style={{ marginBottom: 10, gap: 10 }}>
          {(["olt", "dn", "sn", "fiber"] as Layer[]).map((layer) => (
            <label key={layer} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input type="checkbox" checked={visible[layer]} onChange={() => toggleLayer(layer)} />
              {layer.toUpperCase()}
            </label>
          ))}
        </div>

        <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 13 }}>
          {olts.filter((o) => matches(o.id) || matches(o.name) || (dnsByOlt.get(o.id) ?? []).some((d) => matches(d.id))).map((olt) => (
            <li key={olt.id} style={{ marginBottom: 4 }}>
              <div
                onClick={() => toggleExpand(olt.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 4px", cursor: "pointer", borderRadius: 4 }}
              >
                <span style={{ width: 10, opacity: 0.7 }}>{expanded.has(olt.id) ? "▾" : "▸"}</span>
                <i style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_DOT[olt.operStatus] ?? "var(--cyan)", display: "inline-block" }} />
                <button className="link-btn" onClick={(e) => { e.stopPropagation(); setFocus(olt.id); }}><b>{olt.id}</b></button>
                <span className="hint" style={{ marginLeft: "auto" }}>{olt.site}</span>
              </div>
              {expanded.has(olt.id) && (
                <ul style={{ listStyle: "none", margin: 0, padding: "0 0 0 20px" }}>
                  {(dnsByOlt.get(olt.id) ?? []).filter((d) => matches(d.id) || (snsByDn.get(d.id) ?? []).some((sn) => matches(sn.id))).map((dn) => (
                    <li key={dn.id}>
                      <div onClick={() => toggleExpand(dn.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px", cursor: "pointer" }}>
                        <span style={{ width: 10, opacity: 0.7 }}>{expanded.has(dn.id) ? "▾" : "▸"}</span>
                        <i style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_DOT[dn.condition] ?? "var(--cyan)", display: "inline-block" }} />
                        <button className="link-btn" onClick={(e) => { e.stopPropagation(); setFocus(dn.id); }}>{dn.id}</button>
                      </div>
                      {expanded.has(dn.id) && (
                        <ul style={{ listStyle: "none", margin: 0, padding: "0 0 0 20px" }}>
                          {(snsByDn.get(dn.id) ?? []).filter((sn) => matches(sn.id)).map((sn) => (
                            <li key={sn.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 4px" }}>
                              <i style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_DOT[sn.condition] ?? "var(--violet)", display: "inline-block" }} />
                              <button className="link-btn" onClick={() => setFocus(sn.id)}>{sn.id}</button>
                              <span className="hint" style={{ marginLeft: "auto" }}>{sn.customers}/16</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <PlantMap
          olts={visible.olt ? olts.map((o) => ({ id: o.id, name: o.name, lat: o.lat, lng: o.lng, operStatus: o.operStatus })) : []}
          dns={visible.dn ? dns.map((d) => ({ id: d.id, name: d.name, lat: d.lat, lng: d.lng, condition: d.condition, zone: d.zone })) : []}
          sns={visible.sn ? sns.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, condition: s.condition, zone: s.zone, customers: s.customers })) : []}
          fibers={visible.fiber ? fibers.map((f) => ({ id: f.id, kind: f.kind, route: f.route })) : []}
          focus={focus}
          height={620}
        />
      </div>
    </div>
  );
}
