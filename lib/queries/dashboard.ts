import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, gte, lte, and, sql } from "drizzle-orm";

export async function getDashboardMetrics() {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000);
  const ago30 = new Date(now.getTime() - 30 * 86400000);

  const [
    customers,
    onus,
    invoicesRecent,
    alarmsCurrent,
    ticketsOpen,
    oltCount,
    dnCount,
    snCount,
    paymentsRecent,
  ] = await Promise.all([
    db.select({ status: s.customers.status, expiryDate: s.customers.expiryDate, balanceMmk: s.customers.balanceMmk, tariffId: s.customers.tariffId }).from(s.customers),
    db.select({ status: s.onus.status }).from(s.onus),
    db.select().from(s.invoices).where(gte(s.invoices.issuedDate, ago30)),
    db.select().from(s.alarms).where(eq(s.alarms.state, "current")),
    db.select({ id: s.tickets.id }).from(s.tickets).where(sql`${s.tickets.status} != 'resolved'`),
    db.select({ c: sql<number>`count(*)` }).from(s.olts),
    db.select({ c: sql<number>`count(*)` }).from(s.distributionNodes),
    db.select({ c: sql<number>`count(*)` }).from(s.splitterNodes),
    db.select().from(s.payments).where(gte(s.payments.timestamp, ago30)),
  ]);

  const tariffs = await db.select().from(s.tariffs);
  const tariffPrice = new Map(tariffs.map((t) => [t.id, t.priceMmk]));

  const total = customers.length;
  const active = customers.filter((c) => c.status === "active").length;
  const grace = customers.filter((c) => c.status === "grace").length;
  const suspended = customers.filter((c) => c.status === "suspended").length;
  const expired = customers.filter((c) => c.status === "expired").length;
  const expiringSoon = customers.filter((c) => c.status !== "expired" && c.expiryDate && new Date(c.expiryDate) <= in7 && new Date(c.expiryDate) >= now).length;

  const online = onus.filter((o) => o.status === "online").length;
  const offline = onus.length - online;

  const overdue = invoicesRecent.filter((i) => i.status === "overdue");
  const overdueValue = overdue.reduce((a, i) => a + i.amountMmk + i.taxMmk, 0);

  const issuedValue = invoicesRecent.reduce((a, i) => a + i.amountMmk + i.taxMmk, 0);
  const paidValue = paymentsRecent.reduce((a, p) => a + p.amountMmk, 0);
  const collectionRate = issuedValue > 0 ? Math.min(100, Math.round((paidValue / issuedValue) * 100)) : 100;

  const mrr = customers
    .filter((c) => c.status === "active" || c.status === "grace")
    .reduce((a, c) => a + (c.tariffId ? tariffPrice.get(c.tariffId) ?? 0 : 0), 0);

  const criticalAlarms = alarmsCurrent.filter((a) => a.severity === "critical").length;

  // 12-cycle revenue series from payments, bucketed by ~30-day cycles back from now
  const allPayments = await db.select().from(s.payments);
  const cycles: number[] = new Array(12).fill(0);
  const labels: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const end = now.getTime() - i * 30 * 86400000;
    labels.push(new Date(end).toLocaleDateString("en-GB", { month: "short" }));
  }
  for (const p of allPayments) {
    const ageDays = (now.getTime() - new Date(p.timestamp).getTime()) / 86400000;
    const bucket = 11 - Math.floor(ageDays / 30);
    if (bucket >= 0 && bucket < 12) cycles[bucket] += p.amountMmk;
  }

  return {
    total, active, grace, suspended, expired, expiringSoon,
    online, offline,
    overdueCount: overdue.length, overdueValue,
    collectionRate, mrr,
    criticalAlarms, openTickets: ticketsOpen.length,
    oltCount: oltCount[0]?.c ?? 0, dnCount: dnCount[0]?.c ?? 0, snCount: snCount[0]?.c ?? 0, onuCount: onus.length,
    revenueSeries: { points: cycles, labels },
  };
}

export async function getWeakPoints(limit = 6) {
  const [sns, alarms, customers] = await Promise.all([
    db.select().from(s.splitterNodes),
    db.select().from(s.alarms).where(eq(s.alarms.state, "current")),
    db.select({ id: s.customers.id, snId: s.customers.snId, tariffId: s.customers.tariffId, status: s.customers.status }).from(s.customers),
  ]);
  const tariffs = await db.select().from(s.tariffs);
  const price = new Map(tariffs.map((t) => [t.id, t.priceMmk]));
  const onus = await db.select().from(s.onus);

  const rows = sns.map((sn) => {
    const custs = customers.filter((c) => c.snId === sn.id);
    const onusOnSn = onus.filter((o) => o.snId === sn.id);
    const alarmCount = alarms.filter((a) => onusOnSn.some((o) => o.id === a.objectId)).length;
    const revenue = custs.reduce((a, c) => a + (c.tariffId ? price.get(c.tariffId) ?? 0 : 0), 0);
    const score = alarmCount * 3 + (sn.condition === "attention" ? 2 : 0) + custs.length * 0.05;
    return { sn, customers: custs.length, alarmCount, revenue, condition: sn.condition, score };
  });
  return rows.sort((a, b) => b.score - a.score).slice(0, limit);
}
