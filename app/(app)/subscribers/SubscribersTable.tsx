"use client";

import { useState } from "react";
import Link from "next/link";
import { Pill } from "@/components/Pill";
import { mmk, dateStr } from "@/lib/format";
import { batchChangePlan, batchChangePlanByFilter } from "@/lib/actions/customers";
import { batchReassignPool } from "@/lib/actions/ip-pools";

type Customer = {
  id: string; fullName: string; phone: string; zone: string; status: string;
  expiryDate: Date | null; balanceMmk: number; tariff?: { name: string } | null;
};
type Tariff = { id: string; name: string; priceMmk: number };
type Pool = { id: string; name: string; vlan: number | null; status: string };
type Filters = { q?: string; status?: string; zone?: string; tariffId?: string; ipPoolId?: string; vlan?: string };

type FilterPreview = { preview: true; count: number; alreadyOnPlan: number; sample: { id: string; fullName: string; fromPlan: string }[]; avgPriceDiffMmk: number; toPlanName: string };
type BatchResult = { succeeded: number; failed: number; skipped: { id: string; reason: string }[]; total: number };

export function SubscribersTable({
  customers, tariffs, ipPools, filters,
}: { customers: Customer[]; tariffs: Tariff[]; ipPools: Pool[]; filters: Filters }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"plan" | "pool">("plan");
  const [tariffId, setTariffId] = useState("");
  const [poolId, setPoolId] = useState("");
  const [proration, setProration] = useState(true);
  const [allMatching, setAllMatching] = useState(false);
  const [preview, setPreview] = useState<FilterPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const hasActiveFilter = !!(filters.q || filters.status || filters.zone || filters.tariffId || filters.ipPoolId || filters.vlan);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === customers.length ? new Set() : new Set(customers.map((c) => c.id))));
  }

  function summarize(res: BatchResult) {
    let msg = `${res.succeeded} succeeded of ${res.total}.`;
    if (res.skipped.length) msg += ` ${res.skipped.length} skipped (e.g. ${res.skipped.slice(0, 3).map((s) => `${s.id}: ${s.reason}`).join("; ")}).`;
    return msg;
  }

  async function applyPlanBatch() {
    if (!tariffId) return;
    setBusy(true);
    setResult(null);
    try {
      if (allMatching) {
        const fd = new FormData();
        fd.set("tariffId", tariffId);
        fd.set("proration", proration ? "on" : "off");
        if (filters.q) fd.set("q", filters.q);
        if (filters.status) fd.set("status", filters.status);
        if (filters.zone) fd.set("zone", filters.zone);
        if (filters.tariffId) fd.set("fromTariffId", filters.tariffId);
        if (filters.ipPoolId) fd.set("fromIpPoolId", filters.ipPoolId);
        if (!preview) {
          const res = (await batchChangePlanByFilter(fd)) as FilterPreview;
          setPreview(res);
          setBusy(false);
          return;
        }
        fd.set("confirmed", "true");
        const res = (await batchChangePlanByFilter(fd)) as BatchResult;
        setResult(summarize(res));
        setPreview(null);
      } else {
        if (selected.size === 0) return;
        const fd = new FormData();
        selected.forEach((id) => fd.append("customerIds", id));
        fd.set("tariffId", tariffId);
        fd.set("proration", proration ? "on" : "off");
        const res = await batchChangePlan(fd);
        setResult(summarize(res));
        setSelected(new Set());
      }
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Batch plan change failed.");
    } finally {
      setBusy(false);
    }
  }

  async function applyPoolBatch() {
    if (!poolId || selected.size === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      selected.forEach((id) => fd.append("customerIds", id));
      fd.set("poolId", poolId);
      const res = await batchReassignPool(fd);
      setResult(`Moved ${res?.moved ?? 0} of ${res?.total ?? selected.size} subscriber(s).`);
      setSelected(new Set());
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Batch pool move failed.");
    } finally {
      setBusy(false);
    }
  }

  const activePools = ipPools.filter((p) => p.status === "active");
  const showBar = selected.size > 0 || allMatching;

  return (
    <div className="card">
      {hasActiveFilter && (
        <div className="row" style={{ padding: "8px 14px", gap: 8 }}>
          <label className="row" style={{ gap: 6, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={allMatching} onChange={(e) => { setAllMatching(e.target.checked); setPreview(null); if (e.target.checked) setSelected(new Set()); }} style={{ width: "auto" }} />
            Target all {customers.length}+ subscribers matching this filter instead of picking rows
          </label>
        </div>
      )}
      {showBar && (
        <div className="stack" style={{ padding: "10px 14px", background: "var(--cyan-wash)", borderBottom: "1px solid var(--line)", gap: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <b>{allMatching ? "All matching filter" : `${selected.size} selected`}</b>
            <span className="row" style={{ gap: 0 }}>
              <button className={`btn sm ${mode === "plan" ? "primary" : "ghost"}`} onClick={() => { setMode("plan"); setPreview(null); }}>Change plan</button>
              <button className={`btn sm ${mode === "pool" ? "primary" : "ghost"}`} onClick={() => setMode("pool")} disabled={allMatching}>Move IP pool</button>
            </span>
            <span style={{ flex: 1 }} />
            {!allMatching && <button className="btn sm ghost" onClick={() => setSelected(new Set())}>Clear selection</button>}
          </div>

          {mode === "plan" && (
            <div className="row" style={{ gap: 8 }}>
              <select className="plain" value={tariffId} onChange={(e) => { setTariffId(e.target.value); setPreview(null); }}>
                <option value="">Change plan to…</option>
                {tariffs.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.priceMmk.toLocaleString()} MMK</option>)}
              </select>
              <label className="row" style={{ gap: 4, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={proration} onChange={(e) => setProration(e.target.checked)} style={{ width: "auto" }} /> Proration
              </label>
              <button className="btn sm primary" disabled={!tariffId || busy || (!allMatching && selected.size === 0)} onClick={applyPlanBatch}>
                {busy ? "Working…" : allMatching ? (preview ? `Confirm move of ${preview.count}` : "Preview") : "Apply to selected"}
              </button>
            </div>
          )}
          {mode === "pool" && !allMatching && (
            <div className="row" style={{ gap: 8 }}>
              <select className="plain" value={poolId} onChange={(e) => setPoolId(e.target.value)}>
                <option value="">Move to pool…</option>
                {activePools.map((p) => <option key={p.id} value={p.id}>{p.name} (VLAN {p.vlan ?? "—"})</option>)}
              </select>
              <button className="btn sm primary" disabled={!poolId || busy || selected.size === 0} onClick={applyPoolBatch}>{busy ? "Moving…" : "Apply to selected"}</button>
            </div>
          )}

          {preview && (
            <div className="card" style={{ background: "var(--panel-2)", padding: 10 }}>
              <b>Preview:</b> {preview.count} subscriber(s) → {preview.toPlanName}
              {preview.alreadyOnPlan > 0 && <span className="hint"> ({preview.alreadyOnPlan} already on this plan, skipped)</span>}
              <div className="hint">Average price change: {preview.avgPriceDiffMmk >= 0 ? "+" : ""}{preview.avgPriceDiffMmk.toLocaleString()} MMK/cycle</div>
              <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                {preview.sample.map((c) => <li key={c.id} className="hint">{c.fullName} ({c.id}) — was {c.fromPlan}</li>)}
                {preview.count > preview.sample.length && <li className="hint">…and {preview.count - preview.sample.length} more</li>}
              </ul>
            </div>
          )}
        </div>
      )}
      {result && <p className="hint" style={{ padding: "6px 14px" }}>{result}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input type="checkbox" checked={selected.size > 0 && selected.size === customers.length} onChange={toggleAll} disabled={allMatching} />
              </th>
              <th>Customer</th>
              <th>Zone</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Expiry</th>
              <th className="t-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="clickable">
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} disabled={allMatching} />
                </td>
                <td>
                  <Link href={`/subscribers/${c.id}`}><b>{c.fullName}</b></Link>
                  <div className="hint num">{c.id} · {c.phone}</div>
                </td>
                <td>{c.zone}</td>
                <td>{c.tariff?.name ?? "—"}</td>
                <td><Pill status={c.status} /></td>
                <td>{dateStr(c.expiryDate)}</td>
                <td className="t-right num">{mmk(c.balanceMmk)}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={7} className="empty">No subscribers match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
