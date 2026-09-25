import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { getProducts } from "@/lib/queries/inventory";
import { InventoryTabs } from "../InventoryTabs";
import { ProductEditor } from "./ProductEditor";
import { ProductRow } from "./ProductRow";

export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ location?: string; vendor?: string; q?: string }> }) {
  const sp = await searchParams;
  const [products, vendors] = await Promise.all([getProducts(), db.select().from(s.vendors)]);

  const locations = Array.from(new Set(products.map((p) => p.stockLocation).filter((l): l is string => !!l))).sort();
  const filtered = products.filter((p) => {
    if (sp.location && p.stockLocation !== sp.location) return false;
    if (sp.vendor && p.vendorId !== sp.vendor) return false;
    if (sp.q && !`${p.name} ${p.sku}`.toLowerCase().includes(sp.q.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumb">Inventory / Products</div>
          <h1>Products</h1>
          <p>Aggregate stock catalogue — sell/rent pricing plus a full stock-state breakdown per SKU.</p>
        </div>
      </div>

      <InventoryTabs active="/inventory/products" />

      <form className="toolbar" method="get">
        <input className="grow" type="search" name="q" placeholder="Search name or SKU…" defaultValue={sp.q ?? ""} />
        <select name="location" defaultValue={sp.location ?? ""}>
          <option value="">All stock locations</option>
          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select name="vendor" defaultValue={sp.vendor ?? ""}>
          <option value="">All vendors</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <button className="btn sm" type="submit">Filter</button>
        <div className="spacer" />
        <ProductEditor vendors={vendors} />
      </form>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th><th>Name</th><th>Vendor</th><th>Category</th>
                <th className="t-right">Sell price</th><th className="t-right">Rent price</th>
                <th className="t-right">In stock</th><th className="t-right">Internal usage</th>
                <th className="t-right">Rent</th><th className="t-right">Sold</th>
                <th className="t-right">Returned</th><th className="t-right">Assigned</th>
                <th className="t-right">Damaged</th><th className="t-right">In transit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <ProductRow key={p.id} product={p} vendors={vendors} />
              ))}
              {filtered.length === 0 && <tr><td colSpan={14} className="empty">No products match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
