import Link from "next/link";
import { notFound } from "next/navigation";
import { getDnDetail } from "@/lib/queries/odn";
import { Pill } from "@/components/Pill";
import { dateStr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getDnDetail(id.toUpperCase());
  if (!detail) notFound();
  const { dn, ponPort, feederFiber, olt, outputs } = detail;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumb"><Link href="/odn">ODN plant</Link> / {dn.id}</div>
          <h1>{dn.name}</h1>
          <p>1:{dn.splitRatio} splitter · {dn.zone} · <Pill status={dn.condition} /></p>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <header><h3>Outputs — input 1 → output 1..{dn.splitRatio}</h3></header>
          <div className="trace" style={{ marginBottom: 14 }}>
            {olt && (
              <>
                <Link href={`/odn/olt/${olt.id}`} className="trace-node"><small>OLT</small><b>{olt.id}</b><em>{ponPort?.id}</em></Link>
                <div className="trace-link" />
              </>
            )}
            <div className="trace-node hot"><small>FIBER</small><b>{feederFiber?.id ?? "—"}</b><em>feeder</em></div>
            <div className="trace-link" />
            <div className="trace-node hot"><small>DN</small><b>{dn.id}</b><em>1:{dn.splitRatio}</em></div>
          </div>
          <div className="port-grid">
            {outputs.map((o) => (
              <div key={o.port} className={`port ${o.state === "used" ? "online" : "free"}`}>
                <div className="p-no num">Output {o.port}</div>
                {o.sn ? (
                  <>
                    <div className="p-id"><Link href={`/odn/sn/${o.sn.id}`}>{o.sn.id}</Link></div>
                    <div className="p-rx num">{o.customers}/{o.sn.splitRatio} customers</div>
                  </>
                ) : (
                  <div className="p-id">free</div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <header><h3>DN detail</h3></header>
            <dl className="defn">
              <dt>Zone</dt><dd>{dn.zone}</dd>
              <dt>GPS</dt><dd className="num">{dn.lat.toFixed(5)}, {dn.lng.toFixed(5)}</dd>
              <dt>Installed</dt><dd>{dateStr(dn.installDate)}</dd>
              <dt>Condition</dt><dd><Pill status={dn.condition} /></dd>
              <dt>Feeder fibre</dt><dd className="num">{feederFiber?.id} · {feederFiber?.lengthM}m</dd>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
