import Link from "next/link";
import { listInvoices } from "@/lib/queries/billing";
import { getCities } from "@/lib/queries/customers";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { Pill } from "@/components/Pill";
import { mmk, dateStr } from "@/lib/format";
import { BillingTabs } from "@/components/BillingTabs";

export const dynamic = "force-dynamic";

const STATUSES = ["pending", "overdue", "paid"];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; city?: string; tariffId?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const [invoices, cities, tariffs] = await Promise.all([
    listInvoices({ q: sp.q, city: sp.city, tariffId: sp.tariffId, status: sp.status }),
    getCities(),
    db.select().from(s.tariffs),
  ]);

  const anyFilter = sp.q || sp.city || sp.tariffId || sp.status;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumb"><Link href="/billing">Billing &amp; finance</Link> / Invoices</div>
          <h1>Invoices</h1>
          <p>{invoices.length} invoice{invoices.length === 1 ? "" : "s"} shown — the full ledger, filterable by city, plan and status.</p>
        </div>
      </div>

      <BillingTabs active="/billing/invoices" />

      <form className="toolbar" method="get">
        <input className="grow" type="search" name="q" placeholder="Search invoice ID, customer name or ID…" defaultValue={sp.q ?? ""} />
        <select name="city" defaultValue={sp.city ?? ""}>
          <option value="">All cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="tariffId" defaultValue={sp.tariffId ?? ""}>
          <option value="">All plans</option>
          {tariffs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""}>
          <option value="">All statuses</option>
          {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
        <button className="btn primary sm" type="submit">Filter</button>
        {anyFilter && <Link href="/billing/invoices" className="btn sm ghost">Clear</Link>}
      </form>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th><th>Customer</th><th>City</th><th>Plan</th>
                <th className="t-right">Amount</th><th>Status</th><th>Due</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="clickable">
                  <td><Link href={`/billing/invoices/${i.id}`}><b className="num">{i.id}</b></Link></td>
                  <td>
                    {i.customerId ? <Link href={`/subscribers/${i.customerId}`}>{i.customerName}</Link> : "—"}
                    <div className="hint num">{i.customerId ?? "—"}</div>
                  </td>
                  <td>{i.customerCity ?? "—"}</td>
                  <td>{i.tariffName ?? "—"}</td>
                  <td className="t-right num">{mmk(i.amountMmk + i.taxMmk)}</td>
                  <td><Pill status={i.status} /></td>
                  <td>{dateStr(i.dueDate)}</td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan={7} className="empty">No invoices match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
