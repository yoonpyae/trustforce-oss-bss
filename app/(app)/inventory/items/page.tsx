import Link from "next/link";
import { listItems } from "@/lib/queries/inventory";
import { InventoryTabs } from "../InventoryTabs";
import { Pill } from "@/components/Pill";
import { dateStr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ItemsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const items = await listItems({ status: sp.status, q: sp.q });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumb">Inventory / Items</div>
          <h1>Items</h1>
          <p>{items.length} serialized units — individual physical stock, as opposed to the aggregate Products catalogue.</p>
        </div>
      </div>

      <InventoryTabs active="/inventory/items" />

      <div className="toolbar">
        {(["", "in_stock", "assigned", "damaged", "returned"] as const).map((st) => (
          <Link key={st || "all"} href={st ? `/inventory/items?status=${st}` : "/inventory/items"} className={(sp.status ?? "") === st ? "btn sm primary" : "btn sm ghost"}>
            {st ? st.replace("_", " ") : "all"}
          </Link>
        ))}
        <div className="spacer" />
        <form method="get">
          <input type="hidden" name="status" value={sp.status ?? ""} />
          <input className="plain" type="search" name="q" placeholder="Search serial, MAC, model…" defaultValue={sp.q ?? ""} />
        </form>
      </div>

      <div className="card">
        <div className="table-wrap" style={{ maxHeight: 600, overflowY: "auto" }}>
          <table>
            <thead><tr><th>Serial</th><th>Model</th><th>Product</th><th>Status</th><th>Bound to</th><th>Issued</th></tr></thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="num">{a.serial}<div className="hint num">{a.mac}</div></td>
                  <td>{a.model}</td>
                  <td>{a.productName ?? "—"}</td>
                  <td><Pill status={a.status === "in_stock" ? "instock" : a.status} /></td>
                  <td>{a.boundCustomerId ? <Link href={`/subscribers/${a.boundCustomerId}`}>{a.customerName ?? a.boundCustomerId}</Link> : "—"}</td>
                  <td>{dateStr(a.issuedAt)}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="empty">No items match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
