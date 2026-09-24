"use server";

import { logAudit } from "@/lib/audit";
import { computeImpact } from "@/lib/queries/topology";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { revalidatePath } from "next/cache";

export async function notifyAffected(formData: FormData) {
  const objectType = String(formData.get("objectType")) as "olt" | "dn" | "sn";
  const objectId = String(formData.get("objectId"));
  const impact = await computeImpact(objectType, objectId);

  await db.insert(s.campaigns).values({
    id: "CMP-" + Date.now().toString(36).toUpperCase(),
    audience: "active", channel: "sms", template: "TPL-OUTAGE",
    recipientCount: impact.customers.length, status: "sent", createdBy: "noc.zaw",
  });
  await logAudit("Fault notification sent", objectType, objectId, `${impact.customers.length} customers notified of ${objectId} impact`);

  revalidatePath("/topology");
  revalidatePath("/messaging");
}
