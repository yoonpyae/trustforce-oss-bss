"use client";

import { useState } from "react";
import { saveTariff } from "@/lib/actions/tariffs";

type BW = { id: string; name: string; downKbps: number; upKbps: number };
type Pool = { id: string; name: string };
type Nas = { id: string; name: string };
type Tariff = {
  id: string; name: string; status: string; billingType: string; accountType: string;
  priceMmk: number; validityDays: number; bandwidthProfileId: string; ipPoolId: string | null; expiredBehavior: string;
  allowedNasIds?: string[];
};

export function TariffEditor({
  tariff, bandwidthProfiles, ipPools, nasDevices, compact,
}: { tariff?: Tariff; bandwidthProfiles: BW[]; ipPools: Pool[]; nasDevices: Nas[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button className={compact ? "btn sm ghost" : "btn primary"} onClick={() => setOpen(true)}>
        {compact ? "Edit" : "+ New plan"}
      </button>
      {open && (
        <div className="scrim" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3 style={{ flex: 1 }}>{tariff ? `Edit ${tariff.name}` : "New plan"}</h3>
              <button className="btn sm ghost" onClick={() => setOpen(false)}>✕</button>
            </header>
            <form
              action={async (fd) => {
                setError(null);
                try {
                  await saveTariff(fd);
                  setOpen(false);
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Save failed");
                }
              }}
            >
              <div className="body">
                {error && <p className="hint" style={{ color: "var(--bad)" }}>{error}</p>}
                <input type="hidden" name="id" value={tariff?.id ?? ""} />
                <div className="field">
                  <label>Plan name</label>
                  <input name="name" defaultValue={tariff?.name} required />
                </div>
                <div className="grid g2">
                  <div className="field">
                    <label>Billing</label>
                    <select name="billingType" defaultValue={tariff?.billingType ?? "prepaid"}>
                      <option value="prepaid">Prepaid</option>
                      <option value="postpaid">Postpaid</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Segment</label>
                    <select name="accountType" defaultValue={tariff?.accountType ?? "personal"}>
                      <option value="personal">Personal</option>
                      <option value="business">Business</option>
                    </select>
                  </div>
                </div>
                <div className="grid g2">
                  <div className="field">
                    <label>Price (MMK)</label>
                    <input name="priceMmk" type="number" min={0} defaultValue={tariff?.priceMmk} required />
                  </div>
                  <div className="field">
                    <label>Validity (days)</label>
                    <input name="validityDays" type="number" min={1} defaultValue={tariff?.validityDays ?? 30} required />
                  </div>
                </div>
                <div className="field">
                  <label>Bandwidth profile</label>
                  <select name="bandwidthProfileId" defaultValue={tariff?.bandwidthProfileId ?? ""} required>
                    <option value="" disabled>Select…</option>
                    {bandwidthProfiles.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.downKbps / 1000}M/{b.upKbps / 1000}M)</option>)}
                  </select>
                </div>
                <div className="grid g2">
                  <div className="field">
                    <label>Default IP pool</label>
                    <select name="ipPoolId" defaultValue={tariff?.ipPoolId ?? ""}>
                      <option value="">None — pick a pool per subscriber</option>
                      {ipPools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <span className="hint">A suggestion offered at onboarding only — not binding. Pools are assigned
                      per subscriber and never change on a plan change.</span>
                  </div>
                  <div className="field">
                    <label>Allowed NAS</label>
                    <div className="stack" style={{ gap: 4, maxHeight: 110, overflow: "auto", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: 8 }}>
                      {nasDevices.map((n) => (
                        <label key={n.id} className="row" style={{ gap: 6, cursor: "pointer", fontSize: 13 }}>
                          <input type="checkbox" name="allowedNasIds" value={n.id} defaultChecked={tariff?.allowedNasIds?.includes(n.id)} style={{ width: "auto" }} />
                          {n.name}
                        </label>
                      ))}
                    </div>
                    <span className="hint">None checked = allowed on any NAS. A subscriber&rsquo;s actual NAS always comes from their IP pool.</span>
                  </div>
                </div>
                <div className="grid g2">
                  <div className="field">
                    <label>Expiry behaviour</label>
                    <select name="expiredBehavior" defaultValue={tariff?.expiredBehavior ?? "suspend"}>
                      <option value="suspend">Suspend</option>
                      <option value="disable">Disable</option>
                      <option value="grace">Auto grace</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Status</label>
                    <select name="status" defaultValue={tariff?.status ?? "active"}>
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                      <option value="retired">Retired</option>
                    </select>
                  </div>
                </div>
              </div>
              <footer>
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save plan</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
