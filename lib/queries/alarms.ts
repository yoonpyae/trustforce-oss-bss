import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { and, desc, eq } from "drizzle-orm";

export async function listAlarms(opts: { state?: string; severity?: string }) {
  const conds = [];
  if (opts.state) conds.push(eq(s.alarms.state, opts.state));
  if (opts.severity) conds.push(eq(s.alarms.severity, opts.severity));
  const rows = await db.select().from(s.alarms).where(conds.length ? and(...conds) : undefined).orderBy(desc(s.alarms.raisedAt)).limit(200);

  const onus = await db.select().from(s.onus);
  const onuMap = new Map(onus.map((o) => [o.id, o]));
  const customers = await db.select({ id: s.customers.id, fullName: s.customers.fullName }).from(s.customers);
  const custMap = new Map(customers.map((c) => [c.id, c.fullName]));

  return rows.map((a) => {
    const onu = a.objectType === "onu" ? onuMap.get(a.objectId) : undefined;
    const customerName = onu?.customerId ? custMap.get(onu.customerId) : undefined;
    return { ...a, customerId: onu?.customerId, customerName };
  });
}
