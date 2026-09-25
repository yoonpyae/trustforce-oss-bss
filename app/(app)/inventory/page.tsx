import Link from "next/link";
import { getInventoryDashboard } from "@/lib/queries/inventory";
import { InventoryTabs } from "./InventoryTabs";
import { mmk } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InventoryDashboardPage() {
  const d = await getInventoryDashboard();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumb">Inventory / Dashboard</div>
          <h1>Inventory dashboard</h1>
          <p>{d.productCount} products · {d.itemCount} serialized items tracked.</p>
        </div>
      </div>

      <InventoryTabs active="/inventory" />

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="card kpi"><span className="label">Stock value (in-stock units)</span><span className="value num">{mmk(d.stockValue)}</span></div>
        <div className="card kpi"><span className="label">Low stock products</span><span className="value num" style={{ color: d.lowStock.length ? "var(--bad)" : undefined }}>{d.lowStock.length}</span></div>
        <div className="card kpi"><span className="label">Items bound to customers</span><span className="value num">{d.boundItemCount}</span><span className="foot">of {d.itemCount} tracked</span></div>
        <div className="card kpi"><span className="label">Pending supplier invoices</span><span className="value num" style={{ color: d.pendingInvoiceCount ? "var(--warn)" : undefined }}>{d.pendingInvoiceCount}</span><span className="foot">{mmk(d.pendingInvoiceValue)} outstanding</span></div>
      </div>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="card kpi"><span className="label">Assigned</span><span className="value num">{d.totalAssigned}</span></div>
        <div className="card kpi"><span className="label">In transit</span><span className="value num">{d.totalInTransit}</span></div>
        <div className="card kpi"><span className="label">Damaged</span><span className="value num" style={{ color: "var(--bad)" }}>{d.totalDamaged}</span></div>
        <div className="card kpi"><span className="label">Returned (unprocessed)</span><span className="value num" style={{ color: "var(--warn)" }}>{d.totalReturned}</span></div>
      </div>

      {d.lowStock.length > 0 && (
        <div className="card" style={{ marginBottom: 14, borderColor: "var(--warn)" }}>
          <header><h3 style={{ flex: 1 }}>Reorder alerts</h3><Link href="/inventory/products" className="btn sm ghost">Open Products →</Link></header>
          <div className="badge-row">
            {d.lowStock.map((p) => <span key={p.id} className="pill warn">{p.name}: {p.inStock} left (reorder at {p.reorderLevel})</span>)}
          </div>
        </div>
      )}

      <div className="grid g3">
        <Link href="/inventory/products" className="card"><h3>Products →</h3><p className="hint">Catalogue, pricing and stock-state moves.</p></Link>
        <Link href="/inventory/items" className="card"><h3>Items →</h3><p className="hint">Serialized units and customer bindings.</p></Link>
        <Link href="/inventory/supply/invoices" className="card"><h3>Supply →</h3><p className="hint">Suppliers, vendors and invoices.</p></Link>
      </div>
    </>
  );
}
