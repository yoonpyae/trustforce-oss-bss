"use client";

import { useState } from "react";
import Link from "next/link";
import { Pill } from "@/components/Pill";
import { mmk, dateStr } from "@/lib/format";
import { batchChangePlan } from "@/lib/actions/customers";

type Customer = {
  id: string; fullName: string; phone: string; zone: string; status: string;
  expiryDate: Date | null; balanceMmk: number; tariff?: { name: string } | null;
};
type Tariff = { id: string; name: string; priceMmk: number };

export function SubscribersTable({ customers, tariffs }: { customers: Customer[]; tariffs: Tariff[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tariffId, setTariffId] = useState("");
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
    setSelected((prev) => (prev.size === customers.length ? new Set() : new Set(customers.map((c) => c.id))));
  }

  async function applyBatch() {
    if (!tariffId || selected.size === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      selected.forEach((id) => fd.append("customerIds", id));
      fd.set("tariffId", tariffId);
      const res = await batchChangePlan(fd);
      setResult(`Changed ${res?.changed ?? 0} of ${res?.total ?? selected.size} subscriber(s).`);
      setSelected(new Set());
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Batch change failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      {selected.size > 0 && (
        <div className="row" style={{ padding: "10px 14px", background: "var(--cyan-wash)", borderBottom: "1px solid var(--line)", gap: 8 }}>
          <b>{selected.size} selected</b>
          <span className="hint">Batch Traffic Plan change — IP pool/VLAN are untouched.</span>
          <span style={{ flex: 1 }} />
          <select className="plain" value={tariffId} onChange={(e) => setTariffId(e.target.value)}>
            <option value="">Change plan to…</option>
            {tariffs.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.priceMmk.toLocaleString()} MMK</option>)}
          </select>
          <button className="btn sm primary" disabled={!tariffId || busy} onClick={applyBatch}>{busy ? "Applying…" : "Apply to selected"}</button>
          <button className="btn sm ghost" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}
      {result && <p className="hint" style={{ padding: "6px 14px" }}>{result}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input type="checkbox" checked={selected.size > 0 && selected.size === customers.length} onChange={toggleAll} />
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
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
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
