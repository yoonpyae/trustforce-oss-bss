import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { desc } from "drizzle-orm";
import { Pill } from "@/components/Pill";
import { dateTimeStr } from "@/lib/format";
import { addStaff, toggleStaffActive } from "@/lib/actions/settings";

export const dynamic = "force-dynamic";

const ROLES = [
  { id: "sales", name: "Sales & CS", modules: "Subscribers, tickets, messaging", danger: "No" },
  { id: "cashier", name: "Cashier / billing", modules: "Invoices, payments, vouchers, subscriber read", danger: "No" },
  { id: "network_ops", name: "Network operations", modules: "ODN, alarms, sessions, NAS, tariff read-only", danger: "Control actions" },
  { id: "sysadmin", name: "System administrator", modules: "All modules, settings, integrations, audit", danger: "Yes" },
  { id: "management", name: "Management / finance", modules: "Dashboards, reports, exports", danger: "No" },
];

const INTEGRATIONS = [
  { name: "FreeRADIUS", status: "not connected", note: "Live network module runs on simulated session data — see README." },
  { name: "MikroTik / NAS API", status: "not connected", note: "PON port and CoA actions here update Neon only, not real hardware." },
  { name: "GenieACS (TR-069)", status: "not connected", note: "ONU Wi-Fi/PPPoE provisioning is out of scope for this build." },
  { name: "KBZPay / WavePay gateway", status: "not connected", note: "Recharge/settle actions record the payment method chosen; no gateway callback exists." },
  { name: "SMS / WhatsApp gateway", status: "not connected", note: "Messaging campaigns are logged, not dispatched." },
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const [staff, auditRows] = await Promise.all([
    db.select().from(s.staff),
    db.select().from(s.auditLog).orderBy(desc(s.auditLog.timestamp)).limit(120),
  ]);
  const filteredAudit = sp.q
    ? auditRows.filter((r) => [r.actor, r.action, r.objectId, r.detail].join(" ").toLowerCase().includes(sp.q!.toLowerCase()))
    : auditRows;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Least-privilege permission matrix, staff accounts, integration status and the searchable audit trail — theme toggle lives in the top bar.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <header><h3>Permission matrix</h3></header>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Role</th><th>Modules</th><th>Destructive actions</th></tr></thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.id}><td><b>{r.name}</b></td><td>{r.modules}</td><td><Pill status={r.danger === "Yes" ? "critical" : r.danger === "No" ? "on" : "warn"}>{r.danger}</Pill></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          Sales agents cannot see router secrets, network engineers cannot post payment corrections, cashiers cannot clean logs —
          matching the least-privilege recommendation from the NationNet review.
        </p>
      </div>

      <div className="split" style={{ marginBottom: 14 }}>
        <div className="card">
          <header><h3>Staff accounts</h3></header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {staff.map((u) => (
                  <tr key={u.id}>
                    <td><b>{u.name}</b><div className="hint">{u.email}</div></td>
                    <td>{u.role}</td>
                    <td><Pill status={u.active ? "active" : "disabled"} /></td>
                    <td>
                      <form action={toggleStaffActive}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="active" value={String(u.active)} />
                        <button className="btn sm ghost" type="submit">{u.active ? "Deactivate" : "Reactivate"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <header><h3>Add staff account</h3></header>
          <form action={addStaff} className="stack">
            <div className="field"><label>Name</label><input name="name" required /></div>
            <div className="field"><label>Email</label><input name="email" type="email" required /></div>
            <div className="field">
              <label>Role</label>
              <select name="role" defaultValue="sales">
                {ROLES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <button className="btn primary" type="submit">Create account</button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <header><h3>Integrations</h3></header>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Integration</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>
              {INTEGRATIONS.map((i) => (
                <tr key={i.name}><td><b>{i.name}</b></td><td><Pill status="idle">{i.status}</Pill></td><td className="hint">{i.note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <header>
          <h3 style={{ flex: 1 }}>Audit trail</h3>
          <form method="get" className="row">
            <input className="plain" type="search" name="q" placeholder="Search actor, action, object…" defaultValue={sp.q ?? ""} />
            <button className="btn sm" type="submit">Search</button>
          </form>
          <a className="btn sm ghost" href="/api/reports/audit-log">Export CSV</a>
        </header>
        <div className="table-wrap" style={{ maxHeight: 420, overflowY: "auto" }}>
          <table>
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Object</th><th>Detail</th></tr></thead>
            <tbody>
              {filteredAudit.map((r) => (
                <tr key={r.id}>
                  <td className="num">{dateTimeStr(r.timestamp)}</td>
                  <td>{r.actor}</td>
                  <td>{r.action}</td>
                  <td className="num">{r.objectId}</td>
                  <td className="hint">{r.detail}</td>
                </tr>
              ))}
              {filteredAudit.length === 0 && <tr><td colSpan={5} className="empty">No matching audit rows.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          There is no destructive &quot;clean logs&quot; action in this build — the NationNet review flagged unrestricted log
          cleanup as a high-priority risk, so it was deliberately left out rather than reproduced.
        </p>
      </div>
    </>
  );
}
