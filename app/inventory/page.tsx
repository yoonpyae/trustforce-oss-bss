import Link from "next/link";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { mmk, dateStr } from "@/lib/format";
import { issueStock, receiveStock } from "@/lib/actions/inventory";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [items, assets] = await Promise.all([
    db.select().from(s.inventoryItems),
    db.select().from(s.assets).limit(60),
  ]);
  const customers = await db.select({ id: s.customers.id, fullName: s.customers.fullName }).from(s.customers);
  const custMap = new Map(customers.map((c) => [c.id, c.fullName]));
  const lowStock = items.filter((i) => i.onHand <= i.reorderLevel);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inventory</h1>
          <p>{items.length} SKUs · {lowStock.length} at or below reorder level. Issue/receive writes real stock movements.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <header><h3>Warehouse stock</h3></header>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th className="t-right">On hand</th><th className="t-right">Reserved</th><th className="t-right">Reorder at</th><th className="t-right">Unit cost</th><th>Bin</th><th></th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td><b>{i.name}</b><div className="hint num">{i.sku}</div></td>
                  <td className="t-right num" style={{ color: i.onHand <= i.reorderLevel ? "var(--bad)" : undefined }}>{i.onHand}</td>
                  <td className="t-right num">{i.reserved}</td>
                  <td className="t-right num">{i.reorderLevel}</td>
                  <td className="t-right num">{mmk(i.unitCostMmk)}</td>
                  <td>{i.bin}</td>
                  <td>
                    <div className="row">
                      <form action={issueStock} className="row">
                        <input type="hidden" name="itemId" value={i.id} />
                        <input className="plain" name="qty" type="number" min={1} defaultValue={1} style={{ width: 56 }} />
                        <button className="btn sm ghost" type="submit">Issue</button>
                      </form>
                      <form action={receiveStock}>
                        <input type="hidden" name="itemId" value={i.id} />
                        <input type="hidden" name="qty" value={10} />
                        <button className="btn sm" type="submit">+10 receive</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <header><h3>Assets bound to customers</h3></header>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Serial</th><th>Model</th><th>Customer</th><th>Issued</th></tr></thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td className="num">{a.serial}</td>
                  <td>{a.model}</td>
                  <td>{a.boundCustomerId ? <Link href={`/subscribers/${a.boundCustomerId}`}>{custMap.get(a.boundCustomerId) ?? a.boundCustomerId}</Link> : "—"}</td>
                  <td>{dateStr(a.issuedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
