"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function issueStock(formData: FormData) {
  const itemId = String(formData.get("itemId"));
  const qty = Math.max(1, parseInt(String(formData.get("qty") || "1"), 10));
  const note = String(formData.get("note") || "").trim();

  await db.update(s.inventoryItems).set({ onHand: sql`${s.inventoryItems.onHand} - ${qty}` }).where(eq(s.inventoryItems.id, itemId));
  await logAudit("Stock issued", "inventory_item", itemId, `${qty} pc issued${note ? " — " + note : ""}`);
  revalidatePath("/inventory");
}

export async function receiveStock(formData: FormData) {
  const itemId = String(formData.get("itemId"));
  const qty = Math.max(1, parseInt(String(formData.get("qty") || "1"), 10));

  await db.update(s.inventoryItems).set({ onHand: sql`${s.inventoryItems.onHand} + ${qty}` }).where(eq(s.inventoryItems.id, itemId));
  await logAudit("Stock received", "inventory_item", itemId, `${qty} pc received`);
  revalidatePath("/inventory");
}
