import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { and, desc, eq, gte, ilike, or, sql } from "drizzle-orm";

export async function listBillingClients(opts: { q?: string; filter?: "active" | "expired" | "all" }) {
  const conds = [];
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(s.customers.fullName, like), ilike(s.customers.id, like), ilike(s.customers.username, like)));
  }
  if (opts.filter === "active") conds.push(sql`${s.customers.status} in ('active','grace')`);
  if (opts.filter === "expired") conds.push(sql`${s.customers.status} in ('expired','suspended')`);

  const rows = await db
    .select()
    .from(s.customers)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(s.customers.expiryDate))
    .limit(300);

  const tariffs = await db.select().from(s.tariffs);
  const tMap = new Map(tariffs.map((t) => [t.id, t]));
  return { rows: rows.map((c) => ({ ...c, tariff: c.tariffId ? tMap.get(c.tariffId) : undefined })), tariffs };
}

export async function getBillingKpis() {
  const ago30 = new Date(Date.now() - 30 * 86400000);
  const [invoices, payments] = await Promise.all([
    db.select().from(s.invoices).where(gte(s.invoices.issuedDate, ago30)),
    db.select().from(s.payments).where(gte(s.payments.timestamp, ago30)),
  ]);
  const issued = invoices.reduce((a, i) => a + i.amountMmk + i.taxMmk, 0);
  const collected = payments.reduce((a, p) => a + p.amountMmk, 0);
  const overdue = invoices.filter((i) => i.status === "overdue");
  const pending = invoices.filter((i) => i.status === "pending");
  return {
    issued, collected,
    overdueCount: overdue.length, overdueValue: overdue.reduce((a, i) => a + i.amountMmk + i.taxMmk, 0),
    pendingCount: pending.length, pendingValue: pending.reduce((a, i) => a + i.amountMmk + i.taxMmk, 0),
  };
}

export async function listVouchers(opts: { status?: string }) {
  const conds = [];
  if (opts.status) conds.push(eq(s.vouchers.status, opts.status));
  const rows = await db.select().from(s.vouchers).where(conds.length ? and(...conds) : undefined).orderBy(desc(s.vouchers.createdAt)).limit(300);
  const customers = await db.select({ id: s.customers.id, fullName: s.customers.fullName }).from(s.customers);
  const cMap = new Map(customers.map((c) => [c.id, c.fullName]));
  const tariffs = await db.select().from(s.tariffs);
  const tMap = new Map(tariffs.map((t) => [t.id, t]));
  return rows.map((v) => ({ ...v, redeemedByName: v.redeemedByCustomerId ? cMap.get(v.redeemedByCustomerId) : undefined, tariff: tMap.get(v.tariffId) }));
}
