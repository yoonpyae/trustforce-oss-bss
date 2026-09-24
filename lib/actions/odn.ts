"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function setPonPort(formData: FormData) {
  const portId = String(formData.get("portId"));
  const nextState = String(formData.get("nextState")) === "up" ? "up" : "down";

  await db.update(s.ponPorts).set({ adminStatus: nextState, operStatus: nextState }).where(eq(s.ponPorts.id, portId));
  await logAudit("PON port " + (nextState === "up" ? "enabled" : "disabled"), "pon_port", portId, "Maintenance action");

  revalidatePath("/odn");
}

export async function rebootOnu(formData: FormData) {
  const onuId = String(formData.get("onuId"));
  await db.update(s.onus).set({ lastReboot: new Date(), status: "online" }).where(eq(s.onus.id, onuId));
  await logAudit("ONU reboot", "onu", onuId, "Remote reboot triggered from ODN console");

  revalidatePath("/odn");
  revalidatePath("/topology");
}

export async function setOnuStatus(formData: FormData) {
  const onuId = String(formData.get("onuId"));
  const status = String(formData.get("status")) === "online" ? "online" : "offline";
  await db.update(s.onus).set({ status }).where(eq(s.onus.id, onuId));
  await logAudit("ONU status changed", "onu", onuId, `Set to ${status}`);
  revalidatePath("/odn");
  revalidatePath("/topology");
}
