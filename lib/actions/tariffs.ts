"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function saveTariff(formData: FormData) {
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const billingType = String(formData.get("billingType"));
  const accountType = String(formData.get("accountType"));
  const priceMmk = parseInt(String(formData.get("priceMmk") || "0"), 10);
  const validityDays = parseInt(String(formData.get("validityDays") || "30"), 10);
  const bandwidthProfileId = String(formData.get("bandwidthProfileId"));
  const ipPoolId = String(formData.get("ipPoolId"));
  const nasId = String(formData.get("nasId"));
  const expiredBehavior = String(formData.get("expiredBehavior") || "suspend");
  const status = String(formData.get("status") || "active");

  // Pre-publish dependency check (NationNet review §5.4): bandwidth profile,
  // IP pool, NAS and expiry behaviour must all be resolvable before a plan goes live.
  if (!name || !bandwidthProfileId || !ipPoolId || !nasId || !validityDays || !priceMmk) {
    throw new Error("Pre-publish check failed: bandwidth profile, IP pool, NAS, validity and price are all required.");
  }

  const newId = id || "TP-" + Math.floor(100 + Math.random() * 900);
  const values = { id: newId, name, status, billingType, accountType, priceMmk, validityDays, bandwidthProfileId, ipPoolId, nasId, expiredBehavior };

  if (id) {
    await db.update(s.tariffs).set(values).where(eq(s.tariffs.id, id));
    await logAudit("Tariff updated", "tariff", id, `${name}, ${priceMmk.toLocaleString()} MMK / ${validityDays}d`);
  } else {
    await db.insert(s.tariffs).values(values);
    await logAudit("Tariff created", "tariff", newId, `${name}, ${priceMmk.toLocaleString()} MMK / ${validityDays}d`);
  }

  revalidatePath("/tariffs");
}
