"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/auth-session";
import { logAudit } from "@/lib/audit";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const [user] = await db.select().from(s.staff).where(eq(s.staff.email, email)).limit(1);
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=1");
  }

  await createSession(user.id);
  await db.update(s.staff).set({ lastLoginAt: new Date() }).where(eq(s.staff.id, user.id));
  await logAudit("Signed in", "staff", user.id, "");

  redirect(user.mustChangePassword ? "/settings?mustChangePassword=1" : "/dashboard");
}

export async function signOut() {
  const { getSession } = await import("@/lib/auth-session");
  const session = await getSession();
  if (session) await logAudit("Signed out", "staff", session.id, "");
  await destroySession();
  redirect("/login");
}
