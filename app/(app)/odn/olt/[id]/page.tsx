import Link from "next/link";
import { notFound } from "next/navigation";
import { getOltDetail } from "@/lib/queries/odn";
import { setPonPort } from "@/lib/actions/odn";
import { Pill } from "@/components/Pill";
import { dateStr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OltPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getOltDetail(id.toUpperCase());
  if (!detail) notFound();
  const { olt, ports } = detail;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumb"><Link href="/odn">ODN plant</Link> / {olt.id}</div>
          <h1>{olt.name}</h1>
          <p>{olt.vendor} {olt.model} · {olt.site} · <Pill status={olt.operStatus} /></p>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <header><h3>Port management</h3></header>
          <p className="hint">Slot → port drill-down. Each live port shows the DN it feeds and the ONU/customer count downstream.</p>
          <div className="port-grid">
            {ports.map(({ port, dn, onuCount, online, rxGbps, txGbps }) => (
              <div key={port.id} className={`port ${port.operStatus === "up" ? (online < onuCount ? "degraded" : "online") : "free"}`}>
                <div className="p-no num">S{port.slot}/P{port.port}</div>
                <div className="p-id">{dn ? <Link href={`/odn/dn/${dn.id}`}>{dn.id}</Link> : "unassigned"}</div>
                {port.operStatus === "up" ? (
                  <div className="p-rx num">{onuCount} ONU · {online} up · {rxGbps}G/{txGbps}G</div>
                ) : (
                  <div className="p-rx num">disabled</div>
                )}
                <form action={setPonPort} style={{ marginTop: 6 }}>
                  <input type="hidden" name="portId" value={port.id} />
                  <input type="hidden" name="nextState" value={port.operStatus === "up" ? "down" : "up"} />
                  <button className="btn sm ghost" type="submit">{port.operStatus === "up" ? "Disable" : "Enable"}</button>
                </form>
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <header><h3>Basic information</h3></header>
            <dl className="defn">
              <dt>Serial</dt><dd className="num">{olt.serial}</dd>
              <dt>Management IP</dt><dd className="num">{olt.mgmtIp}</dd>
              <dt>Firmware</dt><dd className="num">{olt.firmware}</dd>
              <dt>Installed</dt><dd>{dateStr(olt.installDate)}</dd>
              <dt>Admin status</dt><dd><Pill status={olt.adminStatus} /></dd>
              <dt>Operational</dt><dd><Pill status={olt.operStatus} /></dd>
              <dt>Temperature</dt><dd className="num">{olt.temperatureC}°C</dd>
            </dl>
          </div>
          <div className="card">
            <header><h3>Coverage</h3></header>
            <p className="hint">{ports.filter((p) => p.port.operStatus === "up").length} of {ports.length} PON ports live, feeding {ports.reduce((a, p) => a + p.onuCount, 0)} ONUs.</p>
          </div>
        </div>
      </div>
    </>
  );
}
