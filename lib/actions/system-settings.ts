"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/require-role";

export async function updateSystemSettings(formData: FormData) {
  await requireRole("sysadmin");
  const subscriberIdServiceCode = String(formData.get("subscriberIdServiceCode") || "TF").trim().toUpperCase() || "TF";
  const subscriberIdDigitCount = Math.min(10, Math.max(3, parseInt(String(formData.get("subscriberIdDigitCount") || "6"), 10)));
  const defaultLocationId = String(formData.get("defaultLocationId") || "") || null;
  const billingCalculationMode = String(formData.get("billingCalculationMode")) === "daily" ? "daily" : "monthly";

  await db
    .insert(s.systemSettings)
    .values({ id: "default", subscriberIdServiceCode, subscriberIdDigitCount, defaultLocationId, billingCalculationMode })
    .onConflictDoUpdate({
      target: s.systemSettings.id,
      set: { subscriberIdServiceCode, subscriberIdDigitCount, defaultLocationId, billingCalculationMode },
    });
  await logAudit("System settings updated", "system_settings", "default", `ID format ${subscriberIdServiceCode}/${subscriberIdDigitCount}d, billing ${billingCalculationMode}`);

  revalidatePath("/settings");
  revalidatePath("/subscribers");
}

export async function addLocation(formData: FormData) {
  await requireRole("sysadmin");
  const name = String(formData.get("name") || "").trim();
  const code = String(formData.get("code") || "").trim().toUpperCase();
  if (!name || !code) throw new Error("Name and code are required.");
  if (!/^[A-Z0-9]{2,6}$/.test(code)) throw new Error("Code must be 2–6 letters/numbers (e.g. YGN).");

  const [existing] = await db.select({ id: s.locations.id }).from(s.locations).where(eq(s.locations.code, code)).limit(1);
  if (existing) throw new Error(`Location code "${code}" is already in use.`);

  const id = "LOC-" + code;
  await db.insert(s.locations).values({ id, name, code });
  await logAudit("Location added", "location", id, `${name} (${code})`);

  revalidatePath("/settings");
  revalidatePath("/subscribers");
}
