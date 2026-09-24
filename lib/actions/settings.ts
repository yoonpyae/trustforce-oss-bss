"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function addStaff(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const role = String(formData.get("role") || "sales");
  if (!name || !email) return;

  const [row] = await db.select({ id: s.staff.id }).from(s.staff).orderBy(sql`substring(${s.staff.id} from 3)::int desc`).limit(1);
  const seq = row ? parseInt(row.id.replace("U-", ""), 10) + 1 : 6;
  const id = "U-" + String(seq).padStart(3, "0");

  await db.insert(s.staff).values({ id, name, email, role });
  await logAudit("Staff account created", "staff", id, `${name} (${role})`);
  revalidatePath("/settings");
}

export async function toggleStaffActive(formData: FormData) {
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  await db.update(s.staff).set({ active: !active }).where(eq(s.staff.id, id));
  await logAudit("Role changed", "staff", id, !active ? "Reactivated" : "Deactivated");
  revalidatePath("/settings");
}
