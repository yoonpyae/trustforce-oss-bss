import Link from "next/link";
import { getActivations, getRevenueByMonth, getChurnRetention, getMttrByTechnician } from "@/lib/queries/reports";
import { BarChart } from "@/components/Charts";
import { Pill } from "@/components/Pill";
import { mmk, dateStr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ start?: string; end?: string }> }) {
  const sp = await searchParams;
  const [activations, revenue, churn, mttr] = await Promise.all([
    getActivations(sp.start, sp.end),
    getRevenueByMonth(12),
    getChurnRetention(),
    getMttrByTechnician(),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>
            Revenue, activations (free date range — deliberately no 30-day cap, unlike the reviewed system's report UI),
            churn/retention and field MTTR. Every table below exports as CSV.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <header><h3>Revenue — last 12 cycles</h3></header>
        <BarChart items={revenue} fmtY={(v) => (v >= 1000000 ? (v / 1000000).toFixed(1) + "M" : Math.round(v / 1000) + "k")} />
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <div className="card kpi"><span className="label">Churn rate</span><span className="value num" style={{ color: "var(--bad)" }}>{churn.churnRate}%</span><span className="foot">{churn.expired} expired · {churn.suspended} suspended of {churn.total}</span></div>
        <div className="card kpi"><span className="label">At-risk (expiring ≤3d)</span><span className="value num" style={{ color: "var(--warn)" }}>{churn.atRisk.length}</span></div>
        <div className="card kpi"><span className="label">Resolved tickets w/ MTTR</span><span className="value num">{mttr.reduce((a, m) => a + m.count, 0)}</span></div>
      </div>

      <div className="split" style={{ marginBottom: 14 }}>
        <div className="card">
          <header><h3 style={{ flex: 1 }}>At-risk subscribers</h3><a className="btn sm ghost" href="/api/reports/at-risk">Export CSV</a></header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Customer</th><th>Zone</th><th>Expiry</th></tr></thead>
              <tbody>
                {churn.atRisk.slice(0, 12).map((c) => (
                  <tr key={c.id}><td><Link href={`/subscribers/${c.id}`}>{c.fullName}</Link></td><td>{c.zone}</td><td>{dateStr(c.expiryDate)}</td></tr>
                ))}
                {churn.atRisk.length === 0 && <tr><td colSpan={3} className="empty">Nobody at risk right now.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <header><h3 style={{ flex: 1 }}>Field MTTR by technician</h3><a className="btn sm ghost" href="/api/reports/mttr">Export CSV</a></header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Technician</th><th className="t-right">Resolved</th><th className="t-right">Avg MTTR</th></tr></thead>
              <tbody>
                {mttr.map((m) => (
                  <tr key={m.technician}><td>{m.technician}</td><td className="t-right num">{m.count}</td><td className="t-right num">{m.mttrHours}h</td></tr>
                ))}
                {mttr.length === 0 && <tr><td colSpan={3} className="empty">No resolved tickets yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <header>
          <h3 style={{ flex: 1 }}>Activations</h3>
          <form method="get" className="row">
            <input type="date" name="start" defaultValue={sp.start} />
            <input type="date" name="end" defaultValue={sp.end} />
            <button className="btn sm" type="submit">Filter</button>
          </form>
          <a className="btn sm ghost" href={`/api/reports/activations?start=${sp.start ?? ""}&end=${sp.end ?? ""}`}>Export CSV</a>
        </header>
        <div className="table-wrap" style={{ maxHeight: 420, overflowY: "auto" }}>
          <table>
            <thead><tr><th>Customer</th><th>Plan</th><th>Installed</th><th>Status</th></tr></thead>
            <tbody>
              {activations.slice(0, 200).map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/subscribers/${c.id}`}>{c.fullName}</Link></td>
                  <td>{c.tariff?.name ?? "—"}</td>
                  <td>{dateStr(c.installedDate)}</td>
                  <td><Pill status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
