"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/require-role";

export async function saveTariff(formData: FormData) {
  await requireRole("sysadmin"); // network_ops has tariffs read-only per the permission matrix
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const billingType = String(formData.get("billingType"));
  const accountType = String(formData.get("accountType"));
  const priceMmk = parseInt(String(formData.get("priceMmk") || "0"), 10);
  const validityDays = parseInt(String(formData.get("validityDays") || "30"), 10);
  const bandwidthProfileId = String(formData.get("bandwidthProfileId"));
  const ipPoolId = String(formData.get("ipPoolId") || "").trim() || null;
  const nasId = String(formData.get("nasId"));
  const expiredBehavior = String(formData.get("expiredBehavior") || "suspend");
  const status = String(formData.get("status") || "active");
  const vlanRaw = String(formData.get("vlan") || "").trim();
  const vlan = vlanRaw ? parseInt(vlanRaw, 10) : null;

  // Pre-publish dependency check (NationNet review §5.4): bandwidth profile,
  // NAS and expiry behaviour must all be resolvable before a plan goes live.
  // IP pool is intentionally NOT required here — it's decoupled from the
  // Traffic Plan (bandwidth policy) and is only offered as a suggested
  // onboarding default; the binding assignment lives on the customer
  // (customers.ipPoolId), set independently via assignIpPool.
  if (!name || !bandwidthProfileId || !nasId || !validityDays || !priceMmk) {
    throw new Error("Pre-publish check failed: bandwidth profile, NAS, validity and price are all required.");
  }

  const newId = id || "TP-" + Math.floor(100 + Math.random() * 900);
  const values = { id: newId, name, status, billingType, accountType, priceMmk, validityDays, bandwidthProfileId, ipPoolId, nasId, expiredBehavior, vlan };

  if (id) {
    await db.update(s.tariffs).set(values).where(eq(s.tariffs.id, id));
    await logAudit("Plan updated", "plan", id, `${name}, ${priceMmk.toLocaleString()} MMK / ${validityDays}d`);
  } else {
    await db.insert(s.tariffs).values(values);
    await logAudit("Plan created", "plan", newId, `${name}, ${priceMmk.toLocaleString()} MMK / ${validityDays}d`);
  }

  revalidatePath("/tariffs");
}
