import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { InventoryTabs } from "../../InventoryTabs";
import { addVendor } from "@/lib/actions/inventory";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const [vendors, products] = await Promise.all([
    db.select().from(s.vendors),
    db.select({ vendorId: s.inventoryItems.vendorId }).from(s.inventoryItems),
  ]);
  const productCount = new Map<string, number>();
  for (const p of products) if (p.vendorId) productCount.set(p.vendorId, (productCount.get(p.vendorId) ?? 0) + 1);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumb">Inventory / Supply / Vendors</div>
          <h1>Vendors</h1>
          <p>Hardware brands available when adding or editing a product.</p>
        </div>
      </div>

      <InventoryTabs active="/inventory/supply/vendors" />

      <div className="split">
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Vendor</th><th className="t-right">Products</th></tr></thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id}><td>{v.name}</td><td className="t-right num">{productCount.get(v.id) ?? 0}</td></tr>
                ))}
                {vendors.length === 0 && <tr><td colSpan={2} className="empty">No vendors yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <header><h3>Add vendor</h3></header>
          <form action={addVendor} className="row">
            <input className="grow" name="name" placeholder="Vendor name" required />
            <button className="btn primary sm" type="submit">Add</button>
          </form>
        </div>
      </div>
    </>
  );
}
