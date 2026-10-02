import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq } from "drizzle-orm";
import { parseCidr } from "@/lib/cidr";

export async function listPoolsWithUsage() {
  const [pools, customers, nasDevices] = await Promise.all([
    db.select().from(s.ipPools),
    db.select({ ipPoolId: s.customers.ipPoolId }).from(s.customers),
    db.select().from(s.nasDevices),
  ]);
  const nasMap = new Map(nasDevices.map((n) => [n.id, n]));
  const usedBy = new Map<string, number>();
  for (const c of customers) {
    if (!c.ipPoolId) continue;
    usedBy.set(c.ipPoolId, (usedBy.get(c.ipPoolId) ?? 0) + 1);
  }
  return pools.map((p) => {
    let total = 0;
    try {
      const r = parseCidr(p.rangeCidr);
      total = Math.max(0, r.last - r.first + 1 - 2); // minus network/broadcast, floor at 0
    } catch {
      total = 0;
    }
    return { ...p, nas: nasMap.get(p.routerId) ?? null, used: usedBy.get(p.id) ?? 0, total };
  });
}

export async function getPoolDetail(id: string) {
  const [pool] = await db.select().from(s.ipPools).where(eq(s.ipPools.id, id)).limit(1);
  if (!pool) return null;
  const [nas, subscribers, tariffs] = await Promise.all([
    pool.routerId ? db.select().from(s.nasDevices).where(eq(s.nasDevices.id, pool.routerId)).limit(1).then((r) => r[0] ?? null) : null,
    db.select().from(s.customers).where(eq(s.customers.ipPoolId, id)),
    db.select().from(s.tariffs),
  ]);
  const tMap = new Map(tariffs.map((t) => [t.id, t]));
  return {
    pool, nas,
    subscribers: subscribers.map((c) => ({ ...c, tariff: c.tariffId ? tMap.get(c.tariffId) : undefined })),
  };
}
