import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";

export async function listAppointments(opts: { from?: Date; to?: Date; technician?: string; status?: string }) {
  const conds = [];
  if (opts.from) conds.push(gte(s.appointments.scheduledAt, opts.from));
  if (opts.to) conds.push(lte(s.appointments.scheduledAt, opts.to));
  if (opts.technician) conds.push(eq(s.appointments.technician, opts.technician));
  if (opts.status) conds.push(eq(s.appointments.status, opts.status));

  const rows = await db.select().from(s.appointments).where(conds.length ? and(...conds) : undefined).orderBy(asc(s.appointments.scheduledAt)).limit(300);
  const customers = await db.select({ id: s.customers.id, fullName: s.customers.fullName }).from(s.customers);
  const cMap = new Map(customers.map((c) => [c.id, c.fullName]));
  const leads = await db.select({ id: s.leads.id, fullName: s.leads.fullName }).from(s.leads);
  const lMap = new Map(leads.map((l) => [l.id, l.fullName]));

  return rows.map((a) => ({
    ...a,
    subjectName: (a.customerId && cMap.get(a.customerId)) || (a.leadId && lMap.get(a.leadId)) || "—",
  }));
}

export async function getScheduleStats() {
  const now = new Date();
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
  const in7 = new Date(now.getTime() + 7 * 86400000);

  const all = await db.select().from(s.appointments);
  const today = all.filter((a) => a.scheduledAt >= startToday && a.scheduledAt <= endToday && a.status !== "cancelled");
  const upcoming = all.filter((a) => a.scheduledAt > endToday && a.scheduledAt <= in7 && a.status === "pending");
  const overdue = all.filter((a) => a.scheduledAt < startToday && a.status === "pending");
  const completed = all.filter((a) => a.status === "completed");

  const byTech = new Map<string, number>();
  for (const a of all.filter((x) => x.status === "pending" || x.status === "in-progress")) {
    byTech.set(a.technician, (byTech.get(a.technician) ?? 0) + 1);
  }

  return { total: all.length, today: today.length, upcoming: upcoming.length, overdue: overdue.length, completed: completed.length, byTech: Array.from(byTech.entries()) };
}
