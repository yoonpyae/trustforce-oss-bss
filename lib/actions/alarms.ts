"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function ackAlarm(formData: FormData) {
  const id = String(formData.get("alarmId"));
  await db.update(s.alarms).set({ state: "acknowledged" }).where(eq(s.alarms.id, id));
  await logAudit("Alarm acknowledged", "alarm", id, "");
  revalidatePath("/alarms");
}

export async function clearAlarm(formData: FormData) {
  const id = String(formData.get("alarmId"));
  await db.update(s.alarms).set({ state: "cleared", clearedAt: new Date() }).where(eq(s.alarms.id, id));
  await logAudit("Alarm cleared", "alarm", id, "");
  revalidatePath("/alarms");
}

export async function alarmToTicket(formData: FormData) {
  const alarmId = String(formData.get("alarmId"));
  const [alarm] = await db.select().from(s.alarms).where(eq(s.alarms.id, alarmId)).limit(1);
  if (!alarm) return;

  let customerId: string | null = null;
  if (alarm.objectType === "onu") {
    const [onu] = await db.select().from(s.onus).where(eq(s.onus.id, alarm.objectId)).limit(1);
    customerId = onu?.customerId ?? null;
  }
  if (!customerId) {
    const [anyCustomer] = await db.select({ id: s.customers.id }).from(s.customers).limit(1);
    customerId = anyCustomer?.id ?? null;
  }
  if (!customerId) return;

  const [row] = await db.select({ id: s.tickets.id }).from(s.tickets).orderBy(desc(sql`substring(${s.tickets.id} from 5)::int`)).limit(1);
  const seq = row ? parseInt(row.id.replace("TKT-", ""), 10) + 1 : 3200;
  const ticketId = "TKT-" + seq;

  await db.insert(s.tickets).values({
    id: ticketId, customerId, category: "Fault", priority: alarm.severity === "critical" ? "critical" : "high",
    status: "open", notes: `Raised from alarm ${alarm.id} (${alarm.code}): ${alarm.note ?? ""}`,
    slaDueAt: new Date(Date.now() + 8 * 3600000),
  });
  await logAudit("Alarm escalated to ticket", "alarm", alarmId, `Created ${ticketId}`);

  revalidatePath("/alarms");
  revalidatePath("/helpdesk");
}
