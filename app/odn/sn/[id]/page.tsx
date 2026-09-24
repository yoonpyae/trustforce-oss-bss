import Link from "next/link";
import { notFound } from "next/navigation";
import { getSnDetail } from "@/lib/queries/odn";
import { Pill } from "@/components/Pill";
import { dateStr } from "@/lib/format";
import { rebootOnu } from "@/lib/actions/odn";

export const dynamic = "force-dynamic";

export default async function SnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getSnDetail(id.toUpperCase());
  if (!detail) notFound();
  const { sn, dn, distributionFiber, ports } = detail;
  const used = ports.filter((p) => p.state === "used").length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumb"><Link href="/odn">ODN plant</Link> / {sn.id}</div>
          <h1>{sn.name}</h1>
          <p>1:{sn.splitRatio} splitter · {sn.zone} · <Pill status={sn.condition} /> · {used}/{sn.splitRatio} ports used</p>
        </div>
      </div>

      <div className="trace" style={{ marginBottom: 14 }}>
        {dn && (
          <>
            <Link href={`/odn/dn/${dn.id}`} className="trace-node"><small>DN</small><b>{dn.id}</b><em>1:{dn.splitRatio}</em></Link>
            <div className="trace-link" />
          </>
        )}
        <div className="trace-node hot"><small>FIBER</small><b>{distributionFiber?.id ?? "—"}</b><em>distribution</em></div>
        <div className="trace-link" />
        <div className="trace-node hot"><small>SN</small><b>{sn.id}</b><em>1:{sn.splitRatio}</em></div>
      </div>

      <div className="card">
        <header><h3>16-port customer view</h3></header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Port</th><th>Customer</th><th>ONU</th><th className="t-right">Optical RX</th><th className="t-right">Signal (TX)</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {ports.map((p) => (
                <tr key={p.port}>
                  <td className="num">{p.port}</td>
                  {p.state === "used" ? (
                    <>
                      <td>{p.customer ? <Link href={`/subscribers/${p.customer.id}`}>{p.customer.fullName}</Link> : "—"}<div className="hint num">{p.customer?.id}</div></td>
                      <td className="num">{p.onu.id}</td>
                      <td className="t-right num">{p.optical.rx ?? "—"} dBm</td>
                      <td className="t-right num">{p.optical.tx ?? "—"} dBm</td>
                      <td><Pill status={p.optical.online ? "online" : "offline"} /></td>
                      <td>
                        <form action={rebootOnu}>
                          <input type="hidden" name="onuId" value={p.onu.id} />
                          <button className="btn sm ghost" type="submit">Reboot</button>
                        </form>
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} className="hint">free</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card">
          <header><h3>SN detail</h3></header>
          <dl className="defn">
            <dt>Zone</dt><dd>{sn.zone}</dd>
            <dt>GPS</dt><dd className="num">{sn.lat.toFixed(5)}, {sn.lng.toFixed(5)}</dd>
            <dt>Installed</dt><dd>{dateStr(sn.installDate)}</dd>
            <dt>Condition</dt><dd><Pill status={sn.condition} /></dd>
          </dl>
        </div>
        <div className="card">
          <header><h3>Capacity</h3></header>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(used / sn.splitRatio) * 100}%` }} /></div>
          <p className="hint">{used} used · {sn.splitRatio - used} free of {sn.splitRatio}</p>
        </div>
      </div>
    </>
  );
}
