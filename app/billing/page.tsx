import Link from "next/link";
import { listBillingClients, getBillingKpis } from "@/lib/queries/billing";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { Pill } from "@/components/Pill";
import { mmk, dateStr, dateTimeStr } from "@/lib/format";
import { settleInvoice } from "@/lib/actions/billing";
import { recharge } from "@/lib/actions/customers";

export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: "active" | "expired" | "all" }> }) {
  const sp = await searchParams;
  const filter = sp.filter ?? "active";
  const [{ rows, tariffs }, kpis, recentInvoices] = await Promise.all([
    listBillingClients({ q: sp.q, filter }),
    getBillingKpis(),
    db.select().from(s.invoices).orderBy(desc(s.invoices.issuedDate)).limit(20),
  ]);
  const custNames = new Map((await db.select({ id: s.customers.id, fullName: s.customers.fullName }).from(s.customers)).map((c) => [c.id, c.fullName]));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Billing &amp; finance</h1>
          <p>Invoices, recharge and settlement — 30-day snapshot below, all figures from Neon.</p>
        </div>
        <div className="spacer" />
        <Link href="/billing/vouchers" className="btn ghost">Vouchers →</Link>
        <Link href="/tariffs" className="btn ghost">Tariffs →</Link>
      </div>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="card kpi"><span className="label">Issued (30d)</span><span className="value num">{mmk(kpis.issued)}</span></div>
        <div className="card kpi"><span className="label">Collected (30d)</span><span className="value num">{mmk(kpis.collected)}</span></div>
        <div className="card kpi"><span className="label">Overdue</span><span className="value num" style={{ color: "var(--bad)" }}>{kpis.overdueCount}</span><span className="foot">{mmk(kpis.overdueValue)}</span></div>
        <div className="card kpi"><span className="label">Pending</span><span className="value num" style={{ color: "var(--warn)" }}>{kpis.pendingCount}</span><span className="foot">{mmk(kpis.pendingValue)}</span></div>
      </div>

      <div className="split">
        <div className="card">
          <header>
            <h3 style={{ flex: 1 }}>Clients</h3>
            <form method="get" className="row">
              <input type="hidden" name="filter" value={filter} />
              <input className="plain" type="search" name="q" placeholder="Search…" defaultValue={sp.q ?? ""} />
              <button className="btn sm" type="submit">Search</button>
            </form>
          </header>
          <div className="tabs">
            {(["active", "expired", "all"] as const).map((f) => (
              <Link key={f} href={`/billing?filter=${f}`} className={filter === f ? "on" : undefined} style={{ padding: "8px 12px", fontSize: 13 }}>
                {f === "active" ? "Active" : f === "expired" ? "Expired / suspended" : "All"}
              </Link>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>Expiry</th><th></th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/subscribers/${c.id}`}>{c.fullName}</Link><div className="hint num">{c.id}</div></td>
                    <td>{c.tariff?.name ?? "—"}</td>
                    <td><Pill status={c.status} /></td>
                    <td>{dateStr(c.expiryDate)}</td>
                    <td>
                      <form action={recharge} className="row">
                        <input type="hidden" name="customerId" value={c.id} />
                        <input type="hidden" name="method" value="cash" />
                        <button className="btn sm primary" type="submit" disabled={!c.tariff}>Recharge</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="empty">No clients match.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <header><h3>Recent invoices</h3></header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Customer</th><th className="t-right">Amount</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {recentInvoices.map((i) => (
                  <tr key={i.id}>
                    <td className="num">{i.id}</td>
                    <td>{custNames.get(i.customerId) ?? i.customerId}</td>
                    <td className="t-right num">{mmk(i.amountMmk + i.taxMmk)}</td>
                    <td><Pill status={i.status} /></td>
                    <td>
                      {i.status !== "paid" && (
                        <form action={settleInvoice} className="row">
                          <input type="hidden" name="invoiceId" value={i.id} />
                          <input type="hidden" name="method" value="kbzpay" />
                          <button className="btn sm" type="submit">Settle</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
