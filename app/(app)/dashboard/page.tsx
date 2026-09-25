import { getDashboardMetrics, getWeakPoints } from "@/lib/queries/dashboard";
import { getLeadsFunnel } from "@/lib/queries/leads";
import { getScheduleStats } from "@/lib/queries/schedule";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { mmk, num } from "@/lib/format";
import { LineChart, Donut } from "@/components/Charts";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [m, weak, leadsFunnel, scheduleStats, lowStockCount] = await Promise.all([
    getDashboardMetrics(),
    getWeakPoints(),
    getLeadsFunnel(),
    getScheduleStats(),
    db.select().from(s.inventoryItems).then((rows) => rows.filter((r) => r.inStock <= r.reorderLevel).length),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>KPI snapshot for TrustForce Myanmar — {m.total.toLocaleString()} subscribers across Hlaing, Kamayut, Insein, Thingangyun, South Okkalapa and Mayangone.</p>
        </div>
      </div>

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <div className="card kpi">
          <span className="label">Active subscribers</span>
          <span className="value num">{num(m.active)}</span>
          <span className="foot">{num(m.total)} total · {num(m.grace)} in grace · {num(m.suspended)} suspended</span>
        </div>
        <div className="card kpi">
          <span className="label">Online now</span>
          <span className="value num">{num(m.online)}</span>
          <span className="foot">{num(m.offline)} offline / {num(m.onuCount)} ONUs</span>
        </div>
        <div className="card kpi">
          <span className="label">MRR (active + grace)</span>
          <span className="value num">{mmk(m.mrr)}</span>
          <span className="foot">Collection rate {m.collectionRate}% (30d)</span>
        </div>
        <div className="card kpi">
          <span className="label">Overdue</span>
          <span className="value num" style={{ color: "var(--bad)" }}>{num(m.overdueCount)}</span>
          <span className="foot">{mmk(m.overdueValue)} outstanding</span>
        </div>
        <div className="card kpi">
          <span className="label">Expiring in 7 days</span>
          <span className="value num" style={{ color: "var(--warn)" }}>{num(m.expiringSoon)}</span>
          <span className="foot">{num(m.criticalAlarms)} critical alarms · {num(m.openTickets)} open tickets</span>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Link href="/leads" className="card kpi" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="label">Leads — open pipeline</span>
          <span className="value num">{num(leadsFunnel.open)}</span>
          <span className="foot">{leadsFunnel.conversionRate}% conversion · {leadsFunnel.byStatus.won} won</span>
        </Link>
        <Link href="/schedule" className="card kpi" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="label">Schedule — today</span>
          <span className="value num">{num(scheduleStats.today)}</span>
          <span className="foot">{scheduleStats.overdue} overdue · {scheduleStats.upcoming} upcoming 7d</span>
        </Link>
        <Link href="/helpdesk" className="card kpi" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="label">Tickets — open</span>
          <span className="value num">{num(m.openTickets)}</span>
          <span className="foot">{num(m.criticalAlarms)} critical alarms live</span>
        </Link>
        <Link href="/inventory" className="card kpi" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="label">Inventory — low stock</span>
          <span className="value num" style={{ color: lowStockCount ? "var(--bad)" : undefined }}>{num(lowStockCount)}</span>
          <span className="foot">SKUs at or below reorder level</span>
        </Link>
      </div>

      <div className="split">
        <div className="card">
          <header>
            <h3>Collections — last 12 cycles</h3>
          </header>
          <LineChart
            series={[{ points: m.revenueSeries.points, color: "var(--cyan)" }]}
            labels={m.revenueSeries.labels}
            fmtY={(v) => (v >= 1000000 ? (v / 1000000).toFixed(1) + "M" : Math.round(v / 1000) + "k")}
          />
        </div>
        <div className="card">
          <header>
            <h3>Session split</h3>
          </header>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Donut
              slices={[
                { value: m.online, color: "var(--good)" },
                { value: m.offline, color: "var(--idle)" },
              ]}
              center={num(m.online)}
              sub="online"
            />
          </div>
          <div className="legend" style={{ justifyContent: "center", marginTop: 8 }}>
            <span><i style={{ background: "var(--good)" }} />Online</span>
            <span><i style={{ background: "var(--idle)" }} />Offline</span>
          </div>
        </div>
      </div>

      <div className="grid g4" style={{ margin: "14px 0" }}>
        <div className="card kpi">
          <span className="label">OLTs</span>
          <span className="value num">{m.oltCount}</span>
        </div>
        <div className="card kpi">
          <span className="label">DNs (1:4)</span>
          <span className="value num">{m.dnCount}</span>
        </div>
        <div className="card kpi">
          <span className="label">SNs (1:16)</span>
          <span className="value num">{m.snCount}</span>
        </div>
        <div className="card kpi">
          <span className="label">ONUs / subscribers</span>
          <span className="value num">{m.onuCount}</span>
        </div>
      </div>

      <div className="card">
        <header>
          <h3>Weak points</h3>
          <Link href="/topology" className="btn sm ghost">Open topology & trace →</Link>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Splitter node</th>
                <th>Zone</th>
                <th>Condition</th>
                <th className="t-right">Active alarms</th>
                <th className="t-right">Customers</th>
                <th className="t-right">Revenue exposed</th>
              </tr>
            </thead>
            <tbody>
              {weak.map((w) => (
                <tr key={w.sn.id} className="clickable">
                  <td className="num">
                    <Link href={`/topology?focus=${w.sn.id}`}>{w.sn.id}</Link> — {w.sn.name}
                  </td>
                  <td>{w.sn.zone}</td>
                  <td><span className={`pill ${w.condition === "attention" ? "warn" : "on"}`}>{w.condition}</span></td>
                  <td className="t-right num">{w.alarmCount}</td>
                  <td className="t-right num">{w.customers}</td>
                  <td className="t-right num">{mmk(w.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
