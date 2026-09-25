"use client";

import { useState } from "react";
import { saveSupplier } from "@/lib/actions/inventory";

type Supplier = { id: string; name: string; contactName: string | null; phone: string | null; email: string | null; address: string | null };

export function SupplierEditor({ supplier, compact }: { supplier?: Supplier; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button className={compact ? "btn sm ghost" : "btn primary"} onClick={() => setOpen(true)}>
        {supplier ? "Edit" : "+ New supplier"}
      </button>
      {open && (
        <div className="scrim" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3 style={{ flex: 1 }}>{supplier ? `Edit ${supplier.name}` : "New supplier"}</h3>
              <button className="btn sm ghost" onClick={() => setOpen(false)}>✕</button>
            </header>
            <form
              action={async (fd) => {
                setError(null);
                try {
                  await saveSupplier(fd);
                  setOpen(false);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Save failed.");
                }
              }}
            >
              <div className="body">
                {error && <p className="hint" style={{ color: "var(--bad)" }}>{error}</p>}
                <input type="hidden" name="id" value={supplier?.id ?? ""} />
                <div className="field"><label>Name</label><input name="name" defaultValue={supplier?.name} required /></div>
                <div className="grid g2">
                  <div className="field"><label>Contact name</label><input name="contactName" defaultValue={supplier?.contactName ?? ""} /></div>
                  <div className="field"><label>Phone</label><input name="phone" defaultValue={supplier?.phone ?? ""} /></div>
                </div>
                <div className="field"><label>Email</label><input name="email" type="email" defaultValue={supplier?.email ?? ""} /></div>
                <div className="field"><label>Address</label><input name="address" defaultValue={supplier?.address ?? ""} /></div>
              </div>
              <footer>
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn primary">{supplier ? "Save changes" : "Create supplier"}</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
