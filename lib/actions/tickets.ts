"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

const TECHS = ["Ko Myo (Van 1)", "U Thura (Van 2)", "Ko Hein (Van 3)", "Daw Su (Indoor)"];

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
