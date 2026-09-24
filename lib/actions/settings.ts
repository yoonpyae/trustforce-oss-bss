"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-session";
import { hashPassword, verifyPassword } from "@/lib/password";

async function requireSysadmin() {
  const session = await getSession();
  if (!session || session.role !== "sysadmin") {
    throw new Error("Only a system administrator can manage staff accounts.");
  }
  return session;
}

export async function addStaff(formData: FormData) {
  await requireSysadmin();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "sales");
  const password = String(formData.get("password") || "");
  if (!name || !email || password.length < 8) {
    throw new Error("Name, email and an 8+ character temporary password are required.");
  }

  const [row] = await db.select({ id: s.staff.id }).from(s.staff).orderBy(sql`substring(${s.staff.id} from 3)::int desc`).limit(1);
  const seq = row ? parseInt(row.id.replace("U-", ""), 10) + 1 : 6;
  const id = "U-" + String(seq).padStart(3, "0");

  await db.insert(s.staff).values({ id, name, email, role, passwordHash: await hashPassword(password), mustChangePassword: true });
  await logAudit("Staff account created", "staff", id, `${name} (${role})`);
  revalidatePath("/settings");
}

export async function toggleStaffActive(formData: FormData) {
  await requireSysadmin();
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  await db.update(s.staff).set({ active: !active }).where(eq(s.staff.id, id));
  await logAudit(!active ? "Staff account reactivated" : "Staff account deactivated", "staff", id, "");
  revalidatePath("/settings");
}

export async function updateStaffRole(formData: FormData) {
  const admin = await requireSysadmin();
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  if (id === admin.id) throw new Error("You can't change your own role.");

  await db.update(s.staff).set({ role }).where(eq(s.staff.id, id));
  await logAudit("Role changed", "staff", id, `→ ${role}`);
  revalidatePath("/settings");
}

export async function resetStaffPassword(formData: FormData) {
  await requireSysadmin();
  const id = String(formData.get("id"));
  const password = String(formData.get("password") || "");
  if (password.length < 8) throw new Error("Temporary password must be at least 8 characters.");

  await db.update(s.staff).set({ passwordHash: await hashPassword(password), mustChangePassword: true }).where(eq(s.staff.id, id));
  await logAudit("Password reset by admin", "staff", id, "Temporary password issued, change required at next login");
  revalidatePath("/settings");
}

export async function changeMyPassword(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  if (newPassword.length < 8) throw new Error("New password must be at least 8 characters.");

  const [user] = await db.select().from(s.staff).where(eq(s.staff.id, session.id)).limit(1);
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new Error("Current password is incorrect.");
  }

  await db.update(s.staff).set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false }).where(eq(s.staff.id, session.id));
  await logAudit("Password changed", "staff", session.id, "Self-service password change");
  revalidatePath("/settings");
}
