import { listAppointments, getScheduleStats } from "@/lib/queries/schedule";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { Pill } from "@/components/Pill";
import { dateTimeStr } from "@/lib/format";
import { setAppointmentStatus } from "@/lib/actions/schedule";
import { AppointmentForm } from "./AppointmentForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const [appointments, stats, customers] = await Promise.all([
    listAppointments({ status: sp.status }),
    getScheduleStats(),
    db.select({ id: s.customers.id, fullName: s.customers.fullName }).from(s.customers).limit(500),
  ]);

  const groups = new Map<string, typeof appointments>();
  for (const a of appointments) {
    const key = new Date(a.scheduledAt).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Schedule</h1>
          <p>Field visit calendar — installations, repairs, maintenance and surveys, assignable to a technician and linkable to a customer or ticket.</p>
        </div>
        <div className="spacer" />
        <AppointmentForm customers={customers} />
      </div>

      <div className="grid g5" style={{ marginBottom: 14 }}>
        <div className="card kpi"><span className="label">Today</span><span className="value num">{stats.today}</span></div>
        <div className="card kpi"><span className="label">Upcoming 7d</span><span className="value num">{stats.upcoming}</span></div>
        <div className="card kpi"><span className="label">Overdue</span><span className="value num" style={{ color: "var(--bad)" }}>{stats.overdue}</span></div>
        <div className="card kpi"><span className="label">Completed</span><span className="value num" style={{ color: "var(--good)" }}>{stats.completed}</span></div>
        <div className="card kpi"><span className="label">Total booked</span><span className="value num">{stats.total}</span></div>
      </div>

      {stats.byTech.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <header><h3>Technician load (pending + in-progress)</h3></header>
          <div className="row" style={{ gap: 18, flexWrap: "wrap" }}>
            {stats.byTech.map(([tech, n]) => (
              <div className="kpi" key={tech}><span className="label">{tech}</span><span className="value num" style={{ fontSize: 20 }}>{n}</span></div>
            ))}
          </div>
        </div>
      )}

      <div className="toolbar">
        {(["", "pending", "in-progress", "completed", "cancelled"] as const).map((st) => (
          <a key={st || "all"} href={st ? `/schedule?status=${st}` : "/schedule"} className={(sp.status ?? "") === st ? "btn sm primary" : "btn sm ghost"}>{st || "all"}</a>
        ))}
      </div>

      <div className="stack">
        {Array.from(groups.entries()).map(([day, items]) => (
          <div className="card" key={day}>
            <header><h3>{day}</h3></header>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Time</th><th>Type</th><th>Subject</th><th>Technician</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id}>
                      <td className="num">{new Date(a.scheduledAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td style={{ textTransform: "capitalize" }}>{a.type}</td>
                      <td>{a.customerId ? <Link href={`/subscribers/${a.customerId}`}>{a.subjectName}</Link> : a.subjectName}<div className="hint">{a.address}</div></td>
                      <td>{a.technician}</td>
                      <td><Pill status={a.status === "completed" ? "resolved" : a.status === "cancelled" ? "expired" : a.status} /></td>
                      <td>
                        {a.status === "pending" && (
                          <div className="row">
                            <form action={setAppointmentStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="in-progress" /><button className="btn sm ghost" type="submit">Start</button></form>
                            <form action={setAppointmentStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="cancelled" /><button className="btn sm ghost" type="submit">Cancel</button></form>
                          </div>
                        )}
                        {a.status === "in-progress" && (
                          <form action={setAppointmentStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="completed" /><button className="btn sm primary" type="submit">Complete</button></form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {appointments.length === 0 && <div className="card empty">No appointments match this filter.</div>}
      </div>
    </>
  );
}
