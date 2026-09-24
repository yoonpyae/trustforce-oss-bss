import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { and, gte, lte, eq, sql } from "drizzle-orm";

export async function getActivations(start?: string, end?: string) {
  const conds = [];
  if (start) conds.push(gte(s.customers.installedDate, new Date(start)));
  if (end) conds.push(lte(s.customers.installedDate, new Date(end)));
  const rows = await db.select().from(s.customers).where(conds.length ? and(...conds) : undefined);
  const tariffs = await db.select().from(s.tariffs);
  const tMap = new Map(tariffs.map((t) => [t.id, t]));
  return rows.map((c) => ({ ...c, tariff: c.tariffId ? tMap.get(c.tariffId) : undefined })).sort((a, b) => +new Date(b.installedDate) - +new Date(a.installedDate));
}

export async function getRevenueByMonth(months = 12) {
  const payments = await db.select().from(s.payments);
  const now = Date.now();
  const buckets: { label: string; value: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now - i * 30 * 86400000);
    buckets.push({ label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), value: 0 });
  }
  for (const p of payments) {
    const ageDays = (now - new Date(p.timestamp).getTime()) / 86400000;
    const bucket = months - 1 - Math.floor(ageDays / 30);
    if (bucket >= 0 && bucket < months) buckets[bucket].value += p.amountMmk;
  }
  return buckets;
}

export async function getChurnRetention() {
  const customers = await db.select().from(s.customers);
  const total = customers.length;
  const expired = customers.filter((c) => c.status === "expired").length;
  const suspended = customers.filter((c) => c.status === "suspended").length;
  const in3 = new Date(Date.now() + 3 * 86400000);
  const atRisk = customers.filter((c) => (c.status === "active" || c.status === "grace") && c.expiryDate && new Date(c.expiryDate) <= in3);
  const churnRate = total > 0 ? +(((expired + suspended) / total) * 100).toFixed(1) : 0;
  return { total, expired, suspended, churnRate, atRisk };
}

export async function getMttrByTechnician() {
  const tickets = await db.select().from(s.tickets).where(eq(s.tickets.status, "resolved"));
  const byTech = new Map<string, { count: number; totalHours: number }>();
  for (const t of tickets) {
    if (!t.technician || !t.resolvedAt) continue;
    const hours = (new Date(t.resolvedAt).getTime() - new Date(t.openedAt).getTime()) / 3600000;
    const cur = byTech.get(t.technician) ?? { count: 0, totalHours: 0 };
    cur.count++;
    cur.totalHours += hours;
    byTech.set(t.technician, cur);
  }
  return Array.from(byTech.entries()).map(([technician, v]) => ({ technician, count: v.count, mttrHours: +(v.totalHours / v.count).toFixed(1) }));
}
