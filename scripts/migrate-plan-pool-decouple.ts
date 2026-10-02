// One-time, idempotent migration for the Traffic Plan / IP Pool decoupling:
// copies VLAN off the plan and onto its matching pool, then backfills every
// existing subscriber's own pool_id/vlan from their current plan wherever
// their own value is still null — so dropping tariffs.vlan/nasId afterwards
// changes NOTHING about any existing subscriber's pool, VLAN or IP.
//
// Safe to run more than once: every write is guarded by "... IS NULL", so a
// second run touches zero rows.
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { and, eq, isNull, inArray, sql } from "drizzle-orm";

// Exported so it's directly exercised by tests/plan-pool-decoupling.test.ts
// (idempotency) rather than only ever run once by hand.
export async function runMigration() {
  // --- Step 1: copy plan VLANs onto their matching pool -------------------
  // tariffs.vlan was dropped once this migration had run in production, so
  // this step is permanently a no-op in this codebase now — kept for the
  // historical record of what the one-time migration actually did, and
  // because a tariffs row object may still carry a stray `vlan` property if
  // this ever runs against a pre-drop snapshot/branch.
  const tariffs = await db.select().from(s.tariffs);
  const pools = await db.select().from(s.ipPools);
  const poolMap = new Map(pools.map((p) => [p.id, p]));

  const vlanByPool = new Map<string, Set<number>>();
  for (const t of tariffs as Array<typeof tariffs[number] & { vlan?: number | null }>) {
    if (!t.ipPoolId || t.vlan == null) continue;
    const set = vlanByPool.get(t.ipPoolId) ?? new Set<number>();
    set.add(t.vlan);
    vlanByPool.set(t.ipPoolId, set);
  }

  let poolsUpdated = 0;
  for (const [poolId, vlans] of vlanByPool) {
    const pool = poolMap.get(poolId);
    if (!pool || pool.vlan != null) continue; // idempotent: only fill if still empty
    const vlan = [...vlans][0]; // first/only value; log if plans disagree
    if (vlans.size > 1) {
      console.warn(`  Pool ${poolId}: ${vlans.size} plans disagree on VLAN (${[...vlans].join(", ")}) — using ${vlan}`);
    }
    await db.update(s.ipPools).set({ vlan }).where(and(eq(s.ipPools.id, poolId), isNull(s.ipPools.vlan)));
    poolsUpdated++;
  }

  // --- Step 2: backfill every subscriber's own pool_id/vlan from their plan,
  //             wherever their own value is still null -------------------
  const tariffMap = new Map(tariffs.map((t) => [t.id, t]));
  const toBackfill = await db
    .select({ id: s.customers.id, tariffId: s.customers.tariffId, ipPoolId: s.customers.ipPoolId, vlan: s.customers.vlan })
    .from(s.customers)
    .where(sql`(${s.customers.ipPoolId} IS NULL OR ${s.customers.vlan} IS NULL)`);

  const byNewPool = new Map<string, string[]>(); // ipPoolId -> customerIds needing it set
  const byNewVlan = new Map<number, string[]>(); // vlan -> customerIds needing it set
  const auditRows: { actor: string; action: string; objectType: string; objectId: string; detail: string }[] = [];

  for (const c of toBackfill) {
    const tariff = c.tariffId ? (tariffMap.get(c.tariffId) as (typeof tariffs[number] & { vlan?: number | null }) | undefined) : undefined;
    if (!tariff) continue;
    const changed: string[] = [];
    if (c.ipPoolId == null && tariff.ipPoolId) {
      byNewPool.set(tariff.ipPoolId, [...(byNewPool.get(tariff.ipPoolId) ?? []), c.id]);
      changed.push(`pool→${tariff.ipPoolId}`);
    }
    if (c.vlan == null && tariff.vlan != null) {
      byNewVlan.set(tariff.vlan, [...(byNewVlan.get(tariff.vlan) ?? []), c.id]);
      changed.push(`vlan→${tariff.vlan}`);
    }
    if (changed.length) {
      auditRows.push({
        actor: "system", action: "Migration: backfilled plan→pool/vlan",
        objectType: "customer", objectId: c.id,
        detail: `${changed.join(", ")} (from plan ${tariff.id}, unchanged for this subscriber)`,
      });
    }
  }

  for (const [poolId, ids] of byNewPool) {
    await db.update(s.customers).set({ ipPoolId: poolId }).where(and(inArray(s.customers.id, ids), isNull(s.customers.ipPoolId)));
  }
  for (const [vlan, ids] of byNewVlan) {
    await db.update(s.customers).set({ vlan }).where(and(inArray(s.customers.id, ids), isNull(s.customers.vlan)));
  }
  if (auditRows.length) {
    // Bulk insert, chunked, so a very large backfill still stays a handful of
    // round trips rather than one-row-at-a-time (see lifecycle-sweep lesson).
    for (let i = 0; i < auditRows.length; i += 200) {
      await db.insert(s.auditLog).values(auditRows.slice(i, i + 200));
    }
  }

  return { poolsUpdated, subscribersBackfilled: auditRows.length };
}

if (require.main === module) {
  runMigration()
    .then((r) => {
      console.log(`Step 1: ${r.poolsUpdated} pool(s) given a VLAN from their plan(s).`);
      console.log(`Step 2: ${r.subscribersBackfilled} subscriber(s) backfilled (pool and/or vlan), 1 audit entry each.`);
      console.log("\nMigration complete. Re-run any time — already-filled rows are left untouched.");
      process.exit(0);
    })
    .catch((e) => { console.error(e); process.exit(1); });
}
