"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

async function nextAppointmentId() {
  const [row] = await db.select({ id: s.appointments.id }).from(s.appointments).orderBy(desc(sql`substring(${s.appointments.id} from 5)::int`)).limit(1);
  const seq = row ? parseInt(row.id.replace("APT-", ""), 10) + 1 : 1;
  return "APT-" + String(seq).padStart(4, "0");
}

export async function createAppointment(formData: FormData) {
  const type = String(formData.get("type") || "installation");
  const technician = String(formData.get("technician") || "").trim();
  const scheduledAt = String(formData.get("scheduledAt") || "");
  const customerId = String(formData.get("customerId") || "").trim().toUpperCase();
  const notes = String(formData.get("notes") || "").trim();
  if (!technician || !scheduledAt) return;

  const id = await nextAppointmentId();
  let address: string | null = null;
  if (customerId) {
    const [c] = await db.select({ address: s.customers.address }).from(s.customers).where(eq(s.customers.id, customerId)).limit(1);
    address = c?.address ?? null;
  }

  await db.insert(s.appointments).values({
    id, type, technician, scheduledAt: new Date(scheduledAt),
    customerId: customerId || null, notes: notes || null, address,
  });
  await logAudit("Appointment scheduled", "appointment", id, `${type} · ${technician} · ${scheduledAt}`);

  revalidatePath("/schedule");
  revalidatePath("/dashboard");
}

export async function setAppointmentStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  await db.update(s.appointments).set({ status }).where(eq(s.appointments.id, id));
  await logAudit("Appointment " + status, "appointment", id, "");
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
}
