import Link from "next/link";
import { listCollections, getBillingKpis, getPaymentMethodBreakdown } from "@/lib/queries/billing";
import { getRevenueByMonth } from "@/lib/queries/reports";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { Pill } from "@/components/Pill";
import { mmk, dateStr, dateTimeStr } from "@/lib/format";
import { settleInvoice } from "@/lib/actions/billing";
import { BarChart, Donut } from "@/components/Charts";
import { BillingTabs } from "@/components/BillingTabs";

export const dynamic = "force-dynamic";

const METHOD_COLORS: Record<string, string> = {
  kbzpay: "#2fd3e1", wavepay: "#9b8cff", cash: "#34d399", bank: "#f5a524", wallet: "#7c93a3",
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const [collections, kpis, recentInvoices, revenue, methodBreakdown] = await Promise.all([
    listCollections({ q: sp.q }),
    getBillingKpis(),
    db.select().from(s.invoices).orderBy(desc(s.invoices.issuedDate)).limit(8),
    getRevenueByMonth(12),
    getPaymentMethodBreakdown(),
  ]);
  const custNames = new Map((await db.select({ id: s.customers.id, fullName: s.customers.fullName }).from(s.customers)).map((c) => [c.id, c.fullName]));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Finance dashboard</h1>
          <p>Billing, recharge and settlement — 30-day snapshot below, all figures live from Neon.</p>
        </div>
        <div className="spacer" />
        <Link href="/billing/invoices" className="btn ghost">Invoices →</Link>
        <Link href="/billing/vouchers" className="btn ghost">Vouchers →</Link>
        <Link href="/tariffs" className="btn ghost">Plan →</Link>
      </div>

      <BillingTabs active="/billing" />

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="card kpi"><span className="label">Issued (30d)</span><span className="value num">{mmk(kpis.issued)}</span></div>
        <div className="card kpi"><span className="label">Collected (30d)</span><span className="value num">{mmk(kpis.collected)}</span></div>
        <div className="card kpi"><span className="label">Overdue</span><span className="value num" style={{ color: "var(--bad)" }}>{kpis.overdueCount}</span><span className="foot">{mmk(kpis.overdueValue)}</span></div>
        <div className="card kpi"><span className="label">Pending</span><span className="value num" style={{ color: "var(--warn)" }}>{kpis.pendingCount}</span><span className="foot">{mmk(kpis.pendingValue)}</span></div>
      </div>

      <div className="split" style={{ marginBottom: 14 }}>
        <div className="card">
          <header><h3>Revenue — last 12 cycles</h3></header>
          <BarChart items={revenue} fmtY={(v) => (v >= 1000000 ? (v / 1000000).toFixed(1) + "M" : Math.round(v / 1000) + "k")} />
        </div>
        <div className="card">
          <header><h3>Payment methods (30d)</h3></header>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Donut slices={methodBreakdown.map((m) => ({ value: m.value, color: METHOD_COLORS[m.method] ?? "#2fd3e1" }))} center={methodBreakdown.length} sub="methods used" />
          </div>
          <div className="legend" style={{ justifyContent: "center", marginTop: 8 }}>
            {methodBreakdown.map((m) => (
              <span key={m.method}><i style={{ background: METHOD_COLORS[m.method] ?? "#2fd3e1" }} />{m.method} ({mmk(m.value)})</span>
            ))}
          </div>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <header>
            <h3 style={{ flex: 1 }}>Collections — who owes money</h3>
            <form method="get" className="row">
              <input className="plain" type="search" name="q" placeholder="Search…" defaultValue={sp.q ?? ""} />
              <button className="btn sm" type="submit">Search</button>
            </form>
          </header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Customer</th><th>Plan</th><th>Owed</th><th>Due</th><th></th></tr></thead>
              <tbody>
                {collections.map((r) => (
                  <tr key={r.customer.id}>
                    <td><Link href={`/subscribers/${r.customer.id}`}>{r.customer.fullName}</Link><div className="hint num">{r.customer.id}</div></td>
                    <td>{r.tariffName ?? "—"}</td>
                    <td className="num">{mmk(r.owedMmk)}{r.invoiceCount > 1 && <div className="hint">{r.invoiceCount} invoices</div>}</td>
                    <td><Pill status={r.anyOverdue ? "overdue" : "pending"} /> {dateStr(r.earliestDueDate)}</td>
                    <td>
                      <form action={settleInvoice} className="row">
                        <input type="hidden" name="invoiceId" value={r.earliestInvoiceId} />
                        <input type="hidden" name="method" value="cash" />
                        <button className="btn sm primary" type="submit">Settle</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {collections.length === 0 && <tr><td colSpan={5} className="empty">Nothing outstanding — everyone's paid up.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <header><h3 style={{ flex: 1 }}>Recent invoices</h3><Link href="/billing/invoices" className="btn sm ghost">View all →</Link></header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Customer</th><th className="t-right">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {recentInvoices.map((i) => (
                  <tr key={i.id} className="clickable">
                    <td className="num"><Link href={`/billing/invoices/${i.id}`}>{i.id}</Link></td>
                    <td>{custNames.get(i.customerId) ?? i.customerId}</td>
                    <td className="t-right num">{mmk(i.amountMmk + i.taxMmk)}</td>
                    <td><Pill status={i.status} /></td>
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
