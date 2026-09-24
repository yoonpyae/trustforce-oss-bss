"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { or, ilike, eq } from "drizzle-orm";

export type SearchHit = { type: string; id: string; label: string; sub: string; href: string };

export async function globalSearch(qRaw: string): Promise<SearchHit[]> {
  const q = qRaw.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const hits: SearchHit[] = [];

  const custs = await db
    .select()
    .from(s.customers)
    .where(or(ilike(s.customers.id, like), ilike(s.customers.fullName, like), ilike(s.customers.phone, like), ilike(s.customers.username, like)))
    .limit(6);
  for (const c of custs) hits.push({ type: "Customer", id: c.id, label: c.fullName, sub: `${c.id} · ${c.phone}`, href: `/subscribers/${c.id}` });

  const onus = await db
    .select()
    .from(s.onus)
    .where(or(eq(s.onus.id, q.toUpperCase()), ilike(s.onus.serial, like), ilike(s.onus.mac, like)))
    .limit(6);
  for (const o of onus) hits.push({ type: "ONU", id: o.id, label: `${o.vendor} ${o.model}`, sub: `${o.id} · ${o.serial}`, href: o.customerId ? `/subscribers/${o.customerId}` : `/odn` });

  if (/^OLT-/i.test(q)) {
    const rows = await db.select().from(s.olts).where(eq(s.olts.id, q.toUpperCase())).limit(3);
    for (const r of rows) hits.push({ type: "OLT", id: r.id, label: r.name, sub: r.site, href: `/odn?focus=${r.id}` });
  }
  if (/^DN-/i.test(q)) {
    const rows = await db.select().from(s.distributionNodes).where(eq(s.distributionNodes.id, q.toUpperCase())).limit(3);
    for (const r of rows) hits.push({ type: "DN", id: r.id, label: r.name, sub: r.zone, href: `/topology?focus=${r.id}` });
  }
  if (/^SN-/i.test(q)) {
    const rows = await db.select().from(s.splitterNodes).where(eq(s.splitterNodes.id, q.toUpperCase())).limit(3);
    for (const r of rows) hits.push({ type: "SN", id: r.id, label: r.name, sub: r.zone, href: `/topology?focus=${r.id}` });
  }
  if (/^F-/i.test(q)) {
    const rows = await db.select().from(s.fibers).where(eq(s.fibers.id, q.toUpperCase())).limit(3);
    for (const r of rows) hits.push({ type: "Fiber", id: r.id, label: `${r.kind} fibre`, sub: `${r.fromId} → ${r.toId}`, href: `/topology?focus=${r.id}` });
  }
  if (/^INV-/i.test(q)) {
    const rows = await db.select().from(s.invoices).where(eq(s.invoices.id, q.toUpperCase())).limit(3);
    for (const r of rows) hits.push({ type: "Invoice", id: r.id, label: `${r.amountMmk.toLocaleString()} MMK`, sub: r.status ?? "", href: `/subscribers/${r.customerId}` });
  }
  if (/^TKT-/i.test(q)) {
    const rows = await db.select().from(s.tickets).where(eq(s.tickets.id, q.toUpperCase())).limit(3);
    for (const r of rows) hits.push({ type: "Ticket", id: r.id, label: r.category, sub: r.status ?? "", href: `/helpdesk?focus=${r.id}` });
  }

  const vouchers = await db.select().from(s.vouchers).where(ilike(s.vouchers.code, like)).limit(4);
  for (const v of vouchers) hits.push({ type: "Voucher", id: v.id, label: v.code, sub: v.status ?? "", href: `/billing/vouchers?focus=${v.id}` });

  return hits.slice(0, 14);
}
