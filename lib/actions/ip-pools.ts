"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/require-role";
import { cidrsOverlap, parseCidr } from "@/lib/cidr";

export async function savePool(formData: FormData) {
  await requireRole("sysadmin", "network_ops");
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const rangeCidr = String(formData.get("rangeCidr") || "").trim();
  const routerId = String(formData.get("routerId") || "").trim();
  const gateway = String(formData.get("gateway") || "").trim() || null;
  const dns = String(formData.get("dns") || "").trim() || null;
  const zone = String(formData.get("zone") || "").trim() || null;
  const type = String(formData.get("type") || "dynamic");
  const status = String(formData.get("status") || "active");
  const vlanRaw = String(formData.get("vlan") || "").trim();
  const vlan = vlanRaw ? parseInt(vlanRaw, 10) : null;

  if (!name || !rangeCidr || !routerId) throw new Error("Name, CIDR range and NAS are all required.");
  if (vlan != null && (vlan < 1 || vlan > 4094)) throw new Error("VLAN must be between 1 and 4094.");

  // Validate the CIDR is parseable, and doesn't overlap any other pool's range.
  parseCidr(rangeCidr);
  const others = await db.select({ id: s.ipPools.id, rangeCidr: s.ipPools.rangeCidr, name: s.ipPools.name })
    .from(s.ipPools)
    .where(id ? ne(s.ipPools.id, id) : undefined);
  for (const other of others) {
    if (cidrsOverlap(rangeCidr, other.rangeCidr)) {
      throw new Error(`"${rangeCidr}" overlaps pool "${other.name}" (${other.rangeCidr}).`);
    }
  }

  const newId = id || "POOL-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const values = { id: newId, name, rangeCidr, routerId, gateway, dns, zone, type, status, vlan };

  if (id) {
    await db.update(s.ipPools).set(values).where(eq(s.ipPools.id, id));
    await logAudit("IP pool updated", "ip_pool", id, `${name}, ${rangeCidr}, VLAN ${vlan ?? "—"}`);
  } else {
    await db.insert(s.ipPools).values(values);
    await logAudit("IP pool created", "ip_pool", newId, `${name}, ${rangeCidr}, VLAN ${vlan ?? "—"}`);
  }

  revalidatePath("/ip-pools");
  revalidatePath("/tariffs");
}

export async function deletePool(formData: FormData) {
  await requireRole("sysadmin", "network_ops");
  const id = String(formData.get("id") || "");
  const assigned = await db.select({ id: s.customers.id }).from(s.customers).where(eq(s.customers.ipPoolId, id));
  if (assigned.length > 0) throw new Error(`Can't delete — ${assigned.length} subscriber(s) are still assigned to this pool. Move them first.`);

  const [pool] = await db.select({ name: s.ipPools.name }).from(s.ipPools).where(eq(s.ipPools.id, id)).limit(1);
  await db.delete(s.ipPools).where(eq(s.ipPools.id, id));
  await logAudit("IP pool deleted", "ip_pool", id, pool?.name ?? id);

  revalidatePath("/ip-pools");
}

// Batch pool reassignment — bounded by an explicit subscriber selection (not
// a full-table scan), same reasoning as batchChangePlan: a plain loop here
// stays fast because the set is human-chosen and realistically small.
export async function batchReassignPool(formData: FormData) {
  await requireRole("sysadmin", "network_ops");
  const customerIds = formData.getAll("customerIds").map(String).filter(Boolean);
  const newPoolId = String(formData.get("poolId") || "");
  if (!customerIds.length || !newPoolId) throw new Error("Select at least one subscriber and a destination pool.");

  const [pool] = await db.select().from(s.ipPools).where(eq(s.ipPools.id, newPoolId)).limit(1);
  if (!pool) throw new Error("Destination pool not found.");
  if (pool.status !== "active") throw new Error(`"${pool.name}" is retired and can't take new assignments.`);

  const rows = await db.select({ id: s.customers.id, ipPoolId: s.customers.ipPoolId }).from(s.customers).where(inArray(s.customers.id, customerIds));
  let moved = 0;
  for (const c of rows) {
    if (c.ipPoolId === newPoolId) continue; // idempotent: already there, nothing to do
    await db.update(s.customers).set({ ipPoolId: newPoolId, vlan: pool.vlan, updatedAt: new Date() }).where(eq(s.customers.id, c.id));
    await logAudit("IP pool reassigned (batch)", "customer", c.id, `→ ${pool.name} (VLAN ${pool.vlan ?? "—"}) — CoA refresh needed to pick up the new address`);
    moved++;
  }
  await logAudit("Batch IP pool reassignment", "ip_pool", newPoolId, `${moved}/${customerIds.length} subscriber(s) moved to ${pool.name}`);

  revalidatePath("/subscribers");
  revalidatePath("/ip-pools");
  return { moved, total: customerIds.length };
}
