import Link from "next/link";
import { listAlarms } from "@/lib/queries/alarms";
import { Pill } from "@/components/Pill";
import { relTime } from "@/lib/format";
import { ackAlarm, clearAlarm, alarmToTicket } from "@/lib/actions/alarms";

export const dynamic = "force-dynamic";

export default async function AlarmsPage({ searchParams }: { searchParams: Promise<{ state?: string; severity?: string }> }) {
  const sp = await searchParams;
  const state = sp.state ?? "current";
  const alarms = await listAlarms({ state: state === "all" ? undefined : state, severity: sp.severity });
  const critical = alarms.filter((a) => a.severity === "critical" && a.state !== "cleared").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Alarms</h1>
          <p>{alarms.length} shown · {critical} critical unresolved. LOS, dying gasp, optical low/high, temperature, reboot and link-down events across the plant.</p>
        </div>
      </div>

      <div className="toolbar">
        {(["current", "acknowledged", "cleared", "all"] as const).map((st) => (
          <Link key={st} href={`/alarms?state=${st}`} className={state === st ? "btn sm primary" : "btn sm ghost"}>{st}</Link>
        ))}
        <span style={{ flex: 1 }} />
        <form method="get" className="row">
          <input type="hidden" name="state" value={state} />
          <select name="severity" className="plain" defaultValue={sp.severity ?? ""}>
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
          </select>
          <button className="btn sm" type="submit">Apply</button>
        </form>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Alarm</th><th>Severity</th><th>Object</th><th>Customer</th><th>Raised</th><th>State</th><th></th></tr>
            </thead>
            <tbody>
              {alarms.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.code}</b><div className="hint">{a.note}</div></td>
                  <td><Pill status={a.severity} /></td>
                  <td className="num">{a.objectId}<div className="hint">{a.path}</div></td>
                  <td>{a.customerName ? <Link href={`/subscribers/${a.customerId}`}>{a.customerName}</Link> : "—"}</td>
                  <td>{relTime(a.raisedAt)}</td>
                  <td><Pill status={a.state} /></td>
                  <td>
                    <div className="row">
                      {a.state === "current" && (
                        <form action={ackAlarm}><input type="hidden" name="alarmId" value={a.id} /><button className="btn sm ghost" type="submit">Ack</button></form>
                      )}
                      {a.state !== "cleared" && (
                        <form action={clearAlarm}><input type="hidden" name="alarmId" value={a.id} /><button className="btn sm ghost" type="submit">Clear</button></form>
                      )}
                      {a.state !== "cleared" && (
                        <form action={alarmToTicket}><input type="hidden" name="alarmId" value={a.id} /><button className="btn sm" type="submit">Raise ticket</button></form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {alarms.length === 0 && <tr><td colSpan={7} className="empty">No alarms match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
