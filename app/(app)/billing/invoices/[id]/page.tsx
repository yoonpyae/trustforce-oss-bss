import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoiceDetail } from "@/lib/queries/billing";
import { settleInvoice } from "@/lib/actions/billing";
import { Pill } from "@/components/Pill";
import { mmk, dateStr, dateTimeStr } from "@/lib/format";
import { BillingTabs } from "@/components/BillingTabs";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getInvoiceDetail(id.toUpperCase());
  if (!detail) notFound();
  const { invoice, customer, tariff, payments } = detail;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumb"><Link href="/billing">Billing &amp; finance</Link> / <Link href="/billing/invoices">Invoices</Link> / {invoice.id}</div>
          <h1 className="num">{invoice.id}</h1>
          <p><Pill status={invoice.status} /> &nbsp;{mmk(invoice.amountMmk + invoice.taxMmk)} total</p>
        </div>
        <div className="spacer" />
        {invoice.status !== "paid" && (
          <form action={settleInvoice} className="row">
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <select name="method" className="plain" defaultValue="kbzpay">
              <option value="kbzpay">KBZPay</option>
              <option value="wavepay">WavePay</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank transfer</option>
              <option value="wallet">Wallet balance</option>
            </select>
            <button className="btn primary" type="submit">Settle</button>
          </form>
        )}
      </div>

      <BillingTabs active="/billing/invoices" />

      <div className="split">
        <div className="stack">
          <div className="card">
            <header><h3>Invoice</h3></header>
            <dl className="defn">
              <dt>Amount</dt><dd className="num">{mmk(invoice.amountMmk)}</dd>
              <dt>Tax</dt><dd className="num">{mmk(invoice.taxMmk)}</dd>
              <dt>Total</dt><dd className="num"><b>{mmk(invoice.amountMmk + invoice.taxMmk)}</b></dd>
              <dt>Status</dt><dd><Pill status={invoice.status} /></dd>
              <dt>Method</dt><dd>{invoice.method ?? "—"}</dd>
              <dt>Issued</dt><dd>{dateStr(invoice.issuedDate)}</dd>
              <dt>Due</dt><dd>{dateStr(invoice.dueDate)}</dd>
              <dt>Period</dt><dd>{dateStr(invoice.periodStart)} → {dateStr(invoice.periodEnd)}</dd>
              <dt>Plan</dt><dd>{tariff?.name ?? "—"}</dd>
            </dl>
          </div>

          <div className="card">
            <header><h3>Payments</h3></header>
            <div className="table-wrap">
              <table>
                <thead><tr><th>ID</th><th className="t-right">Amount</th><th>Method</th><th>When</th><th>Reconciled</th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="num">{p.id}</td>
                      <td className="t-right num">{mmk(p.amountMmk)}</td>
                      <td>{p.method}</td>
                      <td>{dateTimeStr(p.timestamp)}</td>
                      <td>{p.reconciled ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                  {payments.length === 0 && <tr><td colSpan={5} className="empty">No payments recorded against this invoice yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <header><h3>Customer</h3></header>
          {customer ? (
            <dl className="defn">
              <dt>Name</dt><dd><Link href={`/subscribers/${customer.id}`}>{customer.fullName}</Link></dd>
              <dt>ID</dt><dd className="num">{customer.id}</dd>
              <dt>Phone</dt><dd className="num">{customer.phone}</dd>
              <dt>City</dt><dd>{customer.city ?? "—"}</dd>
              <dt>Zone</dt><dd>{customer.zone}</dd>
              <dt>Address</dt><dd>{customer.address}</dd>
              <dt>Status</dt><dd><Pill status={customer.status} /></dd>
            </dl>
          ) : (
            <p className="hint">Customer record not found (may have been removed).</p>
          )}
        </div>
      </div>
    </>
  );
}
