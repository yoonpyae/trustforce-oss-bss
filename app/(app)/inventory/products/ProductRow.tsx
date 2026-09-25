"use client";

import { useState } from "react";
import { mmk } from "@/lib/format";
import { receiveStock, moveStock, returnStock, restockReturn } from "@/lib/actions/inventory";
import { ProductEditor } from "./ProductEditor";

type Product = {
  id: string; sku: string; name: string; vendorId: string | null; vendorName: string; category: string | null;
  sellPriceMmk: number; rentPriceMmk: number; inStock: number; internalUsage: number; rentCount: number;
  sold: number; returned: number; assigned: number; damaged: number; inTransit: number;
  reorderLevel: number; unitCostMmk: number; stockLocation: string | null;
};
type Vendor = { id: string; name: string };

const MOVE_BUCKETS = [
  { key: "internalUsage", label: "Internal usage" },
  { key: "rentCount", label: "Rent" },
  { key: "sold", label: "Sold" },
  { key: "assigned", label: "Assigned" },
  { key: "damaged", label: "Damaged" },
  { key: "inTransit", label: "In transit" },
];

export function ProductRow({ product: p, vendors }: { product: Product; vendors: Vendor[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: (fd: FormData) => Promise<void>, fd: FormData) {
    setError(null);
    try {
      await action(fd);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    }
  }

  const low = p.inStock <= p.reorderLevel;

  return (
    <>
      <tr className="clickable" onClick={() => setOpen((o) => !o)}>
        <td style={{ width: 20, color: "var(--text-mute)" }}>{open ? "▾" : "▸"}</td>
        <td><b>{p.name}</b><div className="hint num">{p.sku}</div></td>
        <td>{p.vendorName}</td>
        <td>{p.category ?? "—"}</td>
        <td className="t-right num">{mmk(p.sellPriceMmk)}</td>
        <td className="t-right num">{p.rentPriceMmk ? mmk(p.rentPriceMmk) : "—"}</td>
        <td className="t-right num" style={{ color: low ? "var(--bad)" : undefined }}>{p.inStock}</td>
        <td className="t-right num">{p.internalUsage}</td>
        <td className="t-right num">{p.rentCount}</td>
        <td className="t-right num">{p.sold}</td>
        <td className="t-right num">{p.returned}</td>
        <td className="t-right num">{p.assigned}</td>
        <td className="t-right num">{p.damaged}</td>
        <td className="t-right num">{p.inTransit}</td>
      </tr>
      {open && (
        <tr>
          <td></td>
          <td colSpan={13}>
            <div className="grid g4" style={{ padding: "10px 0" }}>
              {error && <p className="hint" style={{ color: "var(--bad)", gridColumn: "1 / -1" }}>{error}</p>}

              <form className="row" onSubmit={(e) => { e.preventDefault(); run(receiveStock, new FormData(e.currentTarget)); }}>
                <input type="hidden" name="productId" value={p.id} />
                <input className="plain" name="qty" type="number" min={1} defaultValue={10} style={{ width: 64 }} />
                <button className="btn sm primary" type="submit">Receive</button>
              </form>

              <form className="row" onSubmit={(e) => { e.preventDefault(); run(moveStock, new FormData(e.currentTarget)); }}>
                <input type="hidden" name="productId" value={p.id} />
                <input className="plain" name="qty" type="number" min={1} defaultValue={1} style={{ width: 56 }} />
                <select className="plain" name="to" defaultValue="assigned">
                  {MOVE_BUCKETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                </select>
                <button className="btn sm" type="submit">Move from stock</button>
              </form>

              <form className="row" onSubmit={(e) => { e.preventDefault(); run(returnStock, new FormData(e.currentTarget)); }}>
                <input type="hidden" name="productId" value={p.id} />
                <input className="plain" name="qty" type="number" min={1} defaultValue={1} style={{ width: 56 }} />
                <select className="plain" name="from" defaultValue="assigned">
                  {MOVE_BUCKETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                </select>
                <button className="btn sm" type="submit">Return</button>
              </form>

              <form className="row" onSubmit={(e) => { e.preventDefault(); run(restockReturn, new FormData(e.currentTarget)); }}>
                <input type="hidden" name="productId" value={p.id} />
                <input className="plain" name="qty" type="number" min={1} defaultValue={1} style={{ width: 56 }} />
                <button className="btn sm ghost" type="submit" disabled={p.returned === 0}>Restock returned</button>
              </form>

              <div className="row" style={{ gridColumn: "1 / -1", marginTop: 4 }}>
                <span className="hint">{p.stockLocation ?? "No stock location set"} · reorder at {p.reorderLevel} · cost {mmk(p.unitCostMmk)}</span>
                <div className="spacer" />
                <ProductEditor product={p} vendors={vendors} compact />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
