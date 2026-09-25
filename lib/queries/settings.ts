import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function getSystemSettings() {
  const [row] = await db.select().from(s.systemSettings).where(eq(s.systemSettings.id, "default")).limit(1);
  if (row) return row;
  // Defensive fallback if the singleton row is ever missing (e.g. a fresh DB before seeding).
  const [created] = await db.insert(s.systemSettings).values({ id: "default" }).returning();
  return created;
}

export async function listLocations() {
  return db.select().from(s.locations);
}
