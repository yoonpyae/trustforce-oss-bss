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
  const expiredBehavior = String(formData.get("expiredBehavior") || "suspend");
  const status = String(formData.get("status") || "active");
  const allowedNasIds = formData.getAll("allowedNasIds").map(String).filter(Boolean);

  // Pre-publish dependency check (NationNet review §5.4): bandwidth profile,
  // validity and price must all be resolvable before a plan goes live. IP
  // pool and VLAN are NOT required — a Traffic Plan is a bandwidth policy,
  // decoupled from any one pool/VLAN/NAS (see README § Traffic Plan & IP Pool
  // decoupling). Allowed NAS is an optional, informational many-to-many list;
  // leaving it empty means "any NAS".
  if (!name || !bandwidthProfileId || !validityDays || !priceMmk) {
    throw new Error("Pre-publish check failed: bandwidth profile, validity and price are all required.");
  }

  const newId = id || "TP-" + Math.floor(100 + Math.random() * 900);
  const values = { id: newId, name, status, billingType, accountType, priceMmk, validityDays, bandwidthProfileId, ipPoolId, expiredBehavior };

  if (id) {
    await db.update(s.tariffs).set(values).where(eq(s.tariffs.id, id));
    await logAudit("Plan updated", "plan", id, `${name}, ${priceMmk.toLocaleString()} MMK / ${validityDays}d`);
  } else {
    await db.insert(s.tariffs).values(values);
    await logAudit("Plan created", "plan", newId, `${name}, ${priceMmk.toLocaleString()} MMK / ${validityDays}d`);
  }

  // Replace the allowed-NAS set wholesale — simplest consistent way to
  // reconcile a multi-select against the existing join rows.
  await db.delete(s.tariffAllowedNas).where(eq(s.tariffAllowedNas.tariffId, newId));
  if (allowedNasIds.length) {
    await db.insert(s.tariffAllowedNas).values(allowedNasIds.map((nasId) => ({ id: `${newId}:${nasId}`, tariffId: newId, nasId })));
  }

  revalidatePath("/tariffs");
}
