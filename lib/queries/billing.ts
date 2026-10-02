import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { and, desc, eq, gte, ilike, or, sql } from "drizzle-orm";

// Collections: who currently owes money, not a status-tabbed customer roster.
// Aggregates every unpaid invoice (pending or overdue, including a lead's very
// first invoice before they're activated) per customer, oldest due date first.
export async function listCollections(opts: { q?: string }) {
  const unpaid = await db
    .select({
      id: s.invoices.id, customerId: s.invoices.customerId, tariffId: s.invoices.tariffId,
      amountMmk: s.invoices.amountMmk, taxMmk: s.invoices.taxMmk,
      dueDate: s.invoices.dueDate, status: s.invoices.status,
    })
    .from(s.invoices)
    .where(sql`${s.invoices.status} != 'paid'`);

  const customers = await db.select().from(s.customers);
  const cMap = new Map(customers.map((c) => [c.id, c]));
  const tariffs = await db.select().from(s.tariffs);
  const tMap = new Map(tariffs.map((t) => [t.id, t]));

  type Row = {
    customer: (typeof customers)[number]; tariffName?: string;
    owedMmk: number; invoiceCount: number; earliestDueDate: Date; earliestInvoiceId: string; anyOverdue: boolean;
  };
  const byCustomer = new Map<string, Row>();
  for (const inv of unpaid) {
    const customer = cMap.get(inv.customerId);
    // Once a customer is marked inactive (suspended past the configured
    // threshold), stop chasing what they owed — they drop off collections.
    if (!customer || customer.status === "inactive") continue;
    const existing = byCustomer.get(inv.customerId);
    const owed = inv.amountMmk + inv.taxMmk;
    if (!existing) {
      byCustomer.set(inv.customerId, {
        customer, tariffName: inv.tariffId ? tMap.get(inv.tariffId)?.name : undefined,
        owedMmk: owed, invoiceCount: 1, earliestDueDate: inv.dueDate, earliestInvoiceId: inv.id,
        anyOverdue: inv.status === "overdue",
      });
    } else {
      existing.owedMmk += owed;
      existing.invoiceCount += 1;
      existing.anyOverdue = existing.anyOverdue || inv.status === "overdue";
      if (new Date(inv.dueDate) < new Date(existing.earliestDueDate)) {
        existing.earliestDueDate = inv.dueDate;
        existing.earliestInvoiceId = inv.id;
      }
    }
  }

  let list = Array.from(byCustomer.values());
  if (opts.q) {
    const q = opts.q.toLowerCase();
    list = list.filter((r) => r.customer.fullName.toLowerCase().includes(q) || r.customer.id.toLowerCase().includes(q) || r.customer.username.toLowerCase().includes(q));
  }
  list.sort((a, b) => new Date(a.earliestDueDate).getTime() - new Date(b.earliestDueDate).getTime());
  return list.slice(0, 300);
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

export async function getPaymentMethodBreakdown() {
  const ago30 = new Date(Date.now() - 30 * 86400000);
  const payments = await db.select().from(s.payments).where(gte(s.payments.timestamp, ago30));
  const byMethod = new Map<string, number>();
  for (const p of payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountMmk);
  return Array.from(byMethod.entries()).map(([method, value]) => ({ method, value }));
}

// Invoices sub-module: the full ledger, filterable by city/plan/status, each
// row linking to an extensive detail view — separate from the Billing
// dashboard's KPIs and the Collections (who-owes-money) widget.
export async function listInvoices(opts: { q?: string; city?: string; tariffId?: string; status?: string; limit?: number }) {
  const conds = [];
  if (opts.status) conds.push(eq(s.invoices.status, opts.status));
  if (opts.tariffId) conds.push(eq(s.invoices.tariffId, opts.tariffId));
  if (opts.city) conds.push(eq(s.customers.city, opts.city));
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(s.customers.fullName, like), ilike(s.invoices.id, like), ilike(s.customers.id, like)));
  }

  const rows = await db
    .select({
      id: s.invoices.id, amountMmk: s.invoices.amountMmk, taxMmk: s.invoices.taxMmk,
      issuedDate: s.invoices.issuedDate, dueDate: s.invoices.dueDate, status: s.invoices.status, method: s.invoices.method,
      customerId: s.customers.id, customerName: s.customers.fullName, customerCity: s.customers.city, customerZone: s.customers.zone,
      tariffName: s.tariffs.name,
    })
    .from(s.invoices)
    .leftJoin(s.customers, eq(s.invoices.customerId, s.customers.id))
    .leftJoin(s.tariffs, eq(s.invoices.tariffId, s.tariffs.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(s.invoices.issuedDate))
    .limit(opts.limit ?? 300);

  return rows;
}

export async function getInvoiceDetail(id: string) {
  const [invoice] = await db.select().from(s.invoices).where(eq(s.invoices.id, id)).limit(1);
  if (!invoice) return null;

  const [customer, tariff, paymentsRows] = await Promise.all([
    db.select().from(s.customers).where(eq(s.customers.id, invoice.customerId)).limit(1).then((r) => r[0] ?? null),
    invoice.tariffId ? db.select().from(s.tariffs).where(eq(s.tariffs.id, invoice.tariffId)).limit(1).then((r) => r[0] ?? null) : null,
    db.select().from(s.payments).where(eq(s.payments.invoiceId, id)).orderBy(desc(s.payments.timestamp)),
  ]);

  return { invoice, customer, tariff, payments: paymentsRows };
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
