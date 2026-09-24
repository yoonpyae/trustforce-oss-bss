import Link from "next/link";
import { getPlantOverview } from "@/lib/queries/odn";
import { PlantMap } from "@/components/PlantMapLoader";
import { Pill } from "@/components/Pill";

export const dynamic = "force-dynamic";

export default async function OdnPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const sp = await searchParams;
  const { olts, dns, sns, fibers } = await getPlantOverview();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ODN plant</h1>
          <p>OLT → PON port → feeder fibre → DN (1:4) → distribution fibre → SN (1:16) → ONU → customer. {olts.length} OLTs, {dns.length} DNs, {sns.length} SNs on the map.</p>
        </div>
      </div>

      <PlantMap
        olts={olts.map((o) => ({ id: o.id, name: o.name, lat: o.lat, lng: o.lng, operStatus: o.operStatus }))}
        dns={dns.map((d) => ({ id: d.id, name: d.name, lat: d.lat, lng: d.lng, condition: d.condition, zone: d.zone }))}
        sns={sns.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, condition: s.condition, zone: s.zone, customers: s.customers }))}
        fibers={fibers.map((f) => ({ id: f.id, kind: f.kind, route: f.route, condition: undefined }))}
        focus={sp.focus}
      />

      <div className="grid g3" style={{ marginTop: 14 }}>
        <div className="card">
          <header><h3>OLTs</h3></header>
          <div className="stack">
            {olts.map((o) => (
              <Link key={o.id} href={`/odn/olt/${o.id}`} className="port" style={{ borderLeftColor: o.operStatus === "up" ? "var(--good)" : "var(--warn)" }}>
                <div className="p-id"><b>{o.id}</b> {o.name}</div>
                <div className="hint">{o.site} · {o.vendor} {o.model}</div>
              </Link>
            ))}
          </div>
        </div>
        <div className="card">
          <header><h3>DNs (1:4)</h3></header>
          <div className="port-grid" style={{ maxHeight: 380, overflowY: "auto" }}>
            {dns.map((d) => (
              <Link key={d.id} href={`/odn/dn/${d.id}`} className={`port ${d.condition === "attention" ? "degraded" : "online"}`}>
                <div className="p-no num">{d.id}</div>
                <div className="p-id">{d.zone}</div>
              </Link>
            ))}
          </div>
        </div>
        <div className="card">
          <header><h3>SNs (1:16)</h3></header>
          <div className="port-grid" style={{ maxHeight: 380, overflowY: "auto" }}>
            {sns.map((s) => (
              <Link key={s.id} href={`/odn/sn/${s.id}`} className={`port ${s.condition === "attention" ? "degraded" : "online"}`}>
                <div className="p-no num">{s.id}</div>
                <div className="p-id">{s.customers}/{s.splitRatio} used</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
