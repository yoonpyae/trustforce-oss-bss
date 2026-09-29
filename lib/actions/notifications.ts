"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-session";

export async function markNotificationsRead() {
  const session = await getSession();
  if (!session) return;
  await db.update(s.notifications).set({ read: true }).where(and(eq(s.notifications.forRole, session.role), eq(s.notifications.read, false)));
  revalidatePath("/", "layout");
}
