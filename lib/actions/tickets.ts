"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

const TECHS = ["Ko Myo (Van 1)", "U Thura (Van 2)", "Ko Hein (Van 3)", "Daw Su (Indoor)"];
const SLA_HOURS: Record<string, number> = { critical: 4, high: 8, normal: 24, low: 48 };

export async function createTicket(formData: FormData) {
  const customerId = String(formData.get("customerId") || "").trim().toUpperCase();
  const category = String(formData.get("category") || "").trim();
  const priority = String(formData.get("priority") || "normal");
  const notes = String(formData.get("notes") || "").trim();
  if (!customerId || !category) throw new Error("Customer and category are required.");

  const [customer] = await db.select({ id: s.customers.id }).from(s.customers).where(eq(s.customers.id, customerId)).limit(1);
  if (!customer) throw new Error(`No customer with ID ${customerId}.`);

  const [row] = await db.select({ id: s.tickets.id }).from(s.tickets).orderBy(desc(sql`substring(${s.tickets.id} from 5)::int`)).limit(1);
  const seq = row ? parseInt(row.id.replace("TKT-", ""), 10) + 1 : 3200;
  const id = "TKT-" + seq;

  await db.insert(s.tickets).values({
    id, customerId, category, priority, status: "open", notes: notes || null,
    slaDueAt: new Date(Date.now() + (SLA_HOURS[priority] ?? 24) * 3600000),
  });
  await logAudit("Ticket created", "ticket", id, `${category} for ${customerId}`);

  revalidatePath("/helpdesk");
  revalidatePath(`/subscribers/${customerId}`);
  return id;
}

export async function moveTicket(formData: FormData) {
  const id = String(formData.get("ticketId"));
  const status = String(formData.get("status"));
  const patch: Partial<typeof s.tickets.$inferInsert> = { status };
  if (status === "assigned") patch.technician = TECHS[Math.floor(Math.random() * TECHS.length)];
  if (status === "resolved") patch.resolvedAt = new Date();

  await db.update(s.tickets).set(patch).where(eq(s.tickets.id, id));
  await logAudit("Ticket moved", "ticket", id, `→ ${status}${patch.technician ? ` (${patch.technician})` : ""}`);

  revalidatePath("/helpdesk");
}
