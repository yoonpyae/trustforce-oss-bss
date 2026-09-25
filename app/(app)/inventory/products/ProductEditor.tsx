"use client";

import { useState } from "react";
import { saveProduct } from "@/lib/actions/inventory";

type Vendor = { id: string; name: string };
type Product = {
  id: string; sku: string; name: string; vendorId: string | null; category: string | null;
  sellPriceMmk: number; rentPriceMmk: number; reorderLevel: number; unitCostMmk: number; stockLocation: string | null;
};

const CATEGORIES = ["CPE", "Fibre", "Passive", "Consumable", "Other"];

export function ProductEditor({ product, vendors, compact }: { product?: Product; vendors: Vendor[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button className={compact ? "btn sm ghost" : "btn primary"} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        {product ? "Edit product" : "Add product"}
      </button>
      {open && (
        <div className="scrim" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3 style={{ flex: 1 }}>{product ? `Edit ${product.name}` : "New product"}</h3>
              <button className="btn sm ghost" onClick={() => setOpen(false)}>✕</button>
            </header>
            <form
              action={async (fd) => {
                setError(null);
                try {
                  await saveProduct(fd);
                  setOpen(false);
                } catch (e2) {
                  setError(e2 instanceof Error ? e2.message : "Save failed.");
                }
              }}
            >
              <div className="body">
                {error && <p className="hint" style={{ color: "var(--bad)" }}>{error}</p>}
                <input type="hidden" name="id" value={product?.id ?? ""} />
                <div className="grid g2">
                  <div className="field"><label>Name</label><input name="name" defaultValue={product?.name} required /></div>
                  <div className="field"><label>SKU</label><input name="sku" defaultValue={product?.sku} required /></div>
                </div>
                <div className="grid g2">
                  <div className="field">
                    <label>Vendor</label>
                    <select name="vendorId" defaultValue={product?.vendorId ?? ""}>
                      <option value="">—</option>
                      {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Category</label>
                    <select name="category" defaultValue={product?.category ?? "Other"}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid g2">
                  <div className="field"><label>Sell price (MMK)</label><input name="sellPriceMmk" type="number" min={0} defaultValue={product?.sellPriceMmk ?? 0} /></div>
                  <div className="field"><label>Rent price (MMK)</label><input name="rentPriceMmk" type="number" min={0} defaultValue={product?.rentPriceMmk ?? 0} /></div>
                </div>
                <div className="grid g2">
                  <div className="field"><label>Unit cost (MMK)</label><input name="unitCostMmk" type="number" min={0} defaultValue={product?.unitCostMmk ?? 0} /></div>
                  <div className="field"><label>Reorder level</label><input name="reorderLevel" type="number" min={0} defaultValue={product?.reorderLevel ?? 10} /></div>
                </div>
                <div className="field"><label>Stock location</label><input name="stockLocation" defaultValue={product?.stockLocation ?? ""} placeholder="Hlaing warehouse" /></div>
                {!product && (
                  <div className="field"><label>Initial stock</label><input name="inStock" type="number" min={0} defaultValue={0} /></div>
                )}
              </div>
              <footer>
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn primary">{product ? "Save changes" : "Create product"}</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
