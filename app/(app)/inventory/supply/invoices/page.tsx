import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { desc } from "drizzle-orm";
import { InventoryTabs } from "../../InventoryTabs";
import { Pill } from "@/components/Pill";
import { mmk, dateStr } from "@/lib/format";
import { addSupplierInvoice, markInvoicePaid } from "@/lib/actions/inventory";

export const dynamic = "force-dynamic";

export default async function SupplierInvoicesPage() {
  const [invoices, suppliers] = await Promise.all([
    db.select().from(s.supplierInvoices).orderBy(desc(s.supplierInvoices.issuedDate)),
    db.select().from(s.suppliers),
  ]);
  const supplierMap = new Map(suppliers.map((sup) => [sup.id, sup.name]));
  const pending = invoices.filter((i) => i.status === "pending");

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumb">Inventory / Supply / Supplier invoices</div>
          <h1>Supplier invoices</h1>
          <p>{pending.length} pending · {mmk(pending.reduce((a, i) => a + i.amountMmk, 0))} outstanding.</p>
        </div>
      </div>

      <InventoryTabs active="/inventory/supply/invoices" />

      <div className="split">
        <div className="card">
          <header><h3>Invoices</h3></header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Invoice</th><th>Supplier</th><th className="t-right">Amount</th><th>Status</th><th>Issued</th><th></th></tr></thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="num">{i.invoiceNumber}<div className="hint">{i.note}</div></td>
                    <td>{supplierMap.get(i.supplierId) ?? i.supplierId}</td>
                    <td className="t-right num">{mmk(i.amountMmk)}</td>
                    <td><Pill status={i.status === "paid" ? "paid" : "pending"} /></td>
                    <td>{dateStr(i.issuedDate)}</td>
                    <td>
                      {i.status !== "paid" && (
                        <form action={markInvoicePaid}>
                          <input type="hidden" name="id" value={i.id} />
                          <button className="btn sm" type="submit">Mark paid</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan={6} className="empty">No supplier invoices yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <header><h3>Record invoice</h3></header>
          <form action={addSupplierInvoice} className="stack">
            <div className="field">
              <label>Supplier</label>
              <select name="supplierId" required defaultValue="">
                <option value="" disabled>Select…</option>
                {suppliers.map((sup) => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Invoice number</label><input name="invoiceNumber" required /></div>
            <div className="field"><label>Amount (MMK)</label><input name="amountMmk" type="number" min={0} required /></div>
            <div className="field"><label>Note</label><input name="note" placeholder="What was ordered" /></div>
            <button className="btn primary" type="submit">Record</button>
          </form>
        </div>
      </div>
    </>
  );
}
