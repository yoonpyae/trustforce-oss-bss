import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { InventoryTabs } from "../../InventoryTabs";
import { SupplierEditor } from "./SupplierEditor";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const suppliers = await db.select().from(s.suppliers);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumb">Inventory / Supply / Suppliers</div>
          <h1>Suppliers</h1>
          <p>Companies TrustForce buys stock from — linked to supplier invoices.</p>
        </div>
        <div className="spacer" />
        <SupplierEditor />
      </div>

      <InventoryTabs active="/inventory/supply/suppliers" />

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Email</th><th>Address</th><th></th></tr></thead>
            <tbody>
              {suppliers.map((sup) => (
                <tr key={sup.id}>
                  <td><b>{sup.name}</b><div className="hint num">{sup.id}</div></td>
                  <td>{sup.contactName ?? "—"}</td>
                  <td className="num">{sup.phone ?? "—"}</td>
                  <td>{sup.email ?? "—"}</td>
                  <td>{sup.address ?? "—"}</td>
                  <td><SupplierEditor supplier={sup} compact /></td>
                </tr>
              ))}
              {suppliers.length === 0 && <tr><td colSpan={6} className="empty">No suppliers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
