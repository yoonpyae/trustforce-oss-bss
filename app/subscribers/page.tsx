import Link from "next/link";
import { listCustomers, getZones } from "@/lib/queries/customers";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { Pill } from "@/components/Pill";
import { mmk, dateStr } from "@/lib/format";
import { AddCustomerForm } from "./AddCustomerForm";

export const dynamic = "force-dynamic";

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; zone?: string }> }) {
  const sp = await searchParams;
  const [customers, zones, tariffs] = await Promise.all([
    listCustomers({ q: sp.q, status: sp.status, zone: sp.zone, limit: 300 }),
    getZones(),
    db.select().from(s.tariffs),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Subscribers</h1>
          <p>{customers.length} accounts shown. Filterable list backed by Neon Postgres — every action here writes a real row and an audit entry.</p>
        </div>
        <div className="spacer" />
        <a href="/api/reports/customers" className="btn ghost">Export CSV</a>
        <AddCustomerForm zones={zones} tariffs={tariffs} />
      </div>

      <form className="toolbar" method="get">
        <input className="grow" type="search" name="q" placeholder="Search name, ID, phone, username…" defaultValue={sp.q ?? ""} />
        <select name="status" defaultValue={sp.status ?? ""}>
          <option value="">All statuses</option>
          {["active", "grace", "suspended", "expired", "banned", "disabled"].map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
        <select name="zone" defaultValue={sp.zone ?? ""}>
          <option value="">All zones</option>
          {zones.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
        <button className="btn primary sm" type="submit">Filter</button>
        {(sp.q || sp.status || sp.zone) && <Link href="/subscribers" className="btn sm ghost">Clear</Link>}
      </form>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Zone</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Expiry</th>
                <th className="t-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="clickable">
                  <td>
                    <Link href={`/subscribers/${c.id}`}><b>{c.fullName}</b></Link>
                    <div className="hint num">{c.id} · {c.phone}</div>
                  </td>
                  <td>{c.zone}</td>
                  <td>{c.tariff?.name ?? "—"}</td>
                  <td><Pill status={c.status} /></td>
                  <td>{dateStr(c.expiryDate)}</td>
                  <td className="t-right num">{mmk(c.balanceMmk)}</td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={6} className="empty">No subscribers match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
