"use client";

import { useState } from "react";
import { savePool, deletePool } from "@/lib/actions/ip-pools";

type Nas = { id: string; name: string };
type Pool = {
  id: string; name: string; rangeCidr: string; routerId: string;
  vlan: number | null; gateway: string | null; dns: string | null; zone: string | null; type: string; status: string;
};

export function PoolEditor({ pool, nasDevices, compact, canDelete }: { pool?: Pool; nasDevices: Nas[]; compact?: boolean; canDelete?: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button className={compact ? "btn sm ghost" : "btn primary"} onClick={() => setOpen(true)}>
        {compact ? "Edit" : "+ New pool"}
      </button>
      {open && (
        <div className="scrim" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3 style={{ flex: 1 }}>{pool ? `Edit ${pool.name}` : "New IP pool"}</h3>
              <button className="btn sm ghost" onClick={() => setOpen(false)}>✕</button>
            </header>
            <form
              action={async (fd) => {
                setError(null);
                try {
                  await savePool(fd);
                  setOpen(false);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Save failed.");
                }
              }}
            >
              <div className="body">
                {error && <p className="hint" style={{ color: "var(--bad)" }}>{error}</p>}
                <input type="hidden" name="id" value={pool?.id ?? ""} />
                <div className="grid g2">
                  <div className="field"><label>Pool name</label><input name="name" defaultValue={pool?.name} required /></div>
                  <div className="field"><label>CIDR range</label><input name="rangeCidr" className="num" defaultValue={pool?.rangeCidr} placeholder="10.20.0.0/21" required /></div>
                </div>
                <div className="grid g2">
                  <div className="field">
                    <label>NAS</label>
                    <select name="routerId" defaultValue={pool?.routerId ?? ""} required>
                      <option value="" disabled>Select…</option>
                      {nasDevices.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>VLAN</label><input name="vlan" type="number" min={1} max={4094} defaultValue={pool?.vlan ?? ""} placeholder="Optional" /></div>
                </div>
                <div className="grid g2">
                  <div className="field"><label>Gateway</label><input name="gateway" className="num" defaultValue={pool?.gateway ?? ""} placeholder="10.20.0.1" /></div>
                  <div className="field"><label>DNS</label><input name="dns" className="num" defaultValue={pool?.dns ?? ""} placeholder="1.1.1.1, 8.8.8.8" /></div>
                </div>
                <div className="grid g3">
                  <div className="field"><label>Zone</label><input name="zone" defaultValue={pool?.zone ?? ""} placeholder="Hlaing" /></div>
                  <div className="field">
                    <label>Type</label>
                    <select name="type" defaultValue={pool?.type ?? "dynamic"}>
                      <option value="dynamic">Dynamic</option>
                      <option value="static">Static</option>
                      <option value="cgnat">CGNAT</option>
                      <option value="public">Public</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Status</label>
                    <select name="status" defaultValue={pool?.status ?? "active"}>
                      <option value="active">Active</option>
                      <option value="retired">Retired</option>
                    </select>
                  </div>
                </div>
              </div>
              <footer>
                {pool && canDelete && (
                  <button
                    type="button"
                    className="btn sm danger"
                    style={{ marginRight: "auto" }}
                    onClick={async () => {
                      if (!confirm(`Delete pool "${pool.name}"? This only works if no subscribers are assigned to it.`)) return;
                      setError(null);
                      const fd = new FormData();
                      fd.set("id", pool.id);
                      try {
                        await deletePool(fd);
                        setOpen(false);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Delete failed.");
                      }
                    }}
                  >
                    Delete
                  </button>
                )}
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save pool</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
