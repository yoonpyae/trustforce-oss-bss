import Link from "next/link";
import { resolveIdentifier, computeImpact } from "@/lib/queries/topology";
import { getPlantOverview } from "@/lib/queries/odn";
import { PlantMap } from "@/components/PlantMapLoader";
import { notifyAffected } from "@/lib/actions/topology";
import { mmk } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TopologyPage({ searchParams }: { searchParams: Promise<{ focus?: string; impact?: string; impactType?: string }> }) {
  const sp = await searchParams;
  const [{ olts, dns, sns, fibers }, resolved] = await Promise.all([
    getPlantOverview(),
    sp.focus ? resolveIdentifier(sp.focus) : Promise.resolve(null),
  ]);

  const impactType = (sp.impactType as "olt" | "dn" | "sn") || "sn";
  const impact = sp.impact ? await computeImpact(impactType, sp.impact) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Topology &amp; trace</h1>
          <p>Resolve any identifier — customer ID, phone, ONU serial/MAC, OLT/DN/SN/fibre ID — to its full physical path, or run fault-impact analysis on a plant object.</p>
        </div>
        <div className="spacer" />
        <a href="/api/kml" className="btn ghost">Export plant KML</a>
      </div>

      <div className="split">
        <div className="card">
          <header><h3>Resolve &amp; trace</h3></header>
          <form method="get" className="row">
            <input className="grow" name="focus" placeholder="CUS-0012, ONU-0117, SN-004, DN-002, 09xxxxxxxxx…" defaultValue={sp.focus ?? ""} />
            <button className="btn primary sm" type="submit">Trace</button>
          </form>
          {sp.focus && !resolved && <p className="hint" style={{ marginTop: 10 }}>No match for “{sp.focus}”.</p>}
          {resolved && (
            <div className="trace" style={{ marginTop: 12 }}>
              {resolved.path.map((n, i) => (
                <div key={i} style={{ display: "flex" }}>
                  {i > 0 && <div className="trace-link" />}
                  <Link href={n.href} className="trace-node hot">
                    <small>{n.kind}</small>
                    <b>{n.id}</b>
                    <em>{n.label}</em>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <header><h3>Fault impact analysis</h3></header>
          <form method="get" className="row">
            <select name="impactType" className="plain" defaultValue={impactType}>
              <option value="sn">SN</option>
              <option value="dn">DN</option>
              <option value="olt">OLT</option>
            </select>
            <input className="grow" name="impact" placeholder="e.g. DN-005" defaultValue={sp.impact ?? ""} />
            <button className="btn sm" type="submit">Analyse</button>
          </form>
          {impact && (
            <div style={{ marginTop: 12 }}>
              <p>
                <b>{sp.impact}</b> failure → <b>{impact.affectedSns.length}</b> SNs affected → <b>{impact.customers.length}</b> customers
                {impact.businessCount > 0 && <> ({impact.businessCount} business)</>} → <b>{mmk(impact.revenue)}</b> exposed.
              </p>
              <form action={notifyAffected}>
                <input type="hidden" name="objectType" value={impactType} />
                <input type="hidden" name="objectId" value={sp.impact} />
                <button className="btn danger sm" type="submit" disabled={impact.customers.length === 0}>Notify affected customers</button>
              </form>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <PlantMap
          olts={olts.map((o) => ({ id: o.id, name: o.name, lat: o.lat, lng: o.lng, operStatus: o.operStatus }))}
          dns={dns.map((d) => ({ id: d.id, name: d.name, lat: d.lat, lng: d.lng, condition: d.condition, zone: d.zone }))}
          sns={sns.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, condition: s.condition, zone: s.zone, customers: s.customers }))}
          fibers={fibers.map((f) => ({ id: f.id, kind: f.kind, route: f.route }))}
          focus={resolved?.path.find((n) => ["OLT", "DN", "SN"].includes(n.kind))?.id ?? sp.impact}
        />
      </div>
    </>
  );
}
