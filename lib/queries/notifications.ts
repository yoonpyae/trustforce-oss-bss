import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export async function getNotificationsForRole(role: string, limit = 15) {
  const rows = await db
    .select()
    .from(s.notifications)
    .where(eq(s.notifications.forRole, role))
    .orderBy(desc(s.notifications.createdAt))
    .limit(limit);
  const [unreadRow] = await db
    .select({ c: sql<number>`count(*)` })
    .from(s.notifications)
    .where(and(eq(s.notifications.forRole, role), eq(s.notifications.read, false)));
  return { rows, unread: Number(unreadRow?.c ?? 0) };
}
