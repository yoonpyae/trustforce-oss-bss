"use client";

import { useState } from "react";
import Link from "next/link";
import { Pill } from "@/components/Pill";
import { batchReassignPool } from "@/lib/actions/ip-pools";

type Customer = { id: string; fullName: string; phone: string; zone: string; status: string; tariff?: { name: string } | null };
type Pool = { id: string; name: string; vlan: number | null };

export function PoolSubscribersTable({ subscribers, otherPools }: { subscribers: Customer[]; otherPools: Pool[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [poolId, setPoolId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === subscribers.length ? new Set() : new Set(subscribers.map((c) => c.id))));
  }

  const destPool = otherPools.find((p) => p.id === poolId);
  const sample = subscribers.filter((c) => selected.has(c.id)).slice(0, 5);

  async function apply() {
    if (!poolId || selected.size === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      selected.forEach((id) => fd.append("customerIds", id));
      fd.set("poolId", poolId);
      const res = await batchReassignPool(fd);
      setResult(`Moved ${res?.moved ?? 0} of ${res?.total ?? selected.size} subscriber(s) to ${destPool?.name ?? poolId}.`);
      setSelected(new Set());
      setConfirming(false);
      setPoolId("");
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Batch move failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <header><h3>Assigned subscribers ({subscribers.length})</h3></header>

      {selected.size > 0 && (
        <div className="row" style={{ padding: "10px 14px", background: "var(--cyan-wash)", borderBottom: "1px solid var(--line)", gap: 8 }}>
          <b>{selected.size} selected</b>
          <span style={{ flex: 1 }} />
          <select className="plain" value={poolId} onChange={(e) => { setPoolId(e.target.value); setConfirming(false); }}>
            <option value="">Move to pool…</option>
            {otherPools.map((p) => <option key={p.id} value={p.id}>{p.name} (VLAN {p.vlan ?? "—"})</option>)}
          </select>
          {!confirming ? (
            <button className="btn sm primary" disabled={!poolId} onClick={() => setConfirming(true)}>Preview move</button>
          ) : (
            <button className="btn sm primary" disabled={busy} onClick={apply}>{busy ? "Moving…" : `Confirm move of ${selected.size}`}</button>
          )}
          <button className="btn sm ghost" onClick={() => { setSelected(new Set()); setConfirming(false); }}>Clear</button>
        </div>
      )}

      {confirming && destPool && (
        <div className="card" style={{ margin: 12, background: "var(--panel-2)" }}>
          <header><h3>Preview — move {selected.size} subscriber(s) to {destPool.name}</h3></header>
          <p className="hint">New VLAN: {destPool.vlan ?? "—"} (plan/bandwidth untouched). A CoA disconnect/reconnect is
            needed for each to pick up the new address — logged per subscriber.</p>
          <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
            {sample.map((c) => <li key={c.id} className="hint">{c.fullName} ({c.id})</li>)}
            {selected.size > sample.length && <li className="hint">…and {selected.size - sample.length} more</li>}
          </ul>
        </div>
      )}

      {result && <p className="hint" style={{ padding: "6px 14px" }}>{result}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}><input type="checkbox" checked={selected.size > 0 && selected.size === subscribers.length} onChange={toggleAll} /></th>
              <th>Customer</th><th>Zone</th><th>Plan</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((c) => (
              <tr key={c.id}>
                <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                <td><Link href={`/subscribers/${c.id}`}><b>{c.fullName}</b></Link><div className="hint num">{c.id} · {c.phone}</div></td>
                <td>{c.zone}</td>
                <td>{c.tariff?.name ?? "—"}</td>
                <td><Pill status={c.status} /></td>
              </tr>
            ))}
            {subscribers.length === 0 && <tr><td colSpan={5} className="empty">No subscribers assigned to this pool.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
