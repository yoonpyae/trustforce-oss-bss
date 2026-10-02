import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { simSession } from "@/lib/sim";

export async function getNetworkOverview(limit = 80) {
  const [nasDevices, ipPools, bandwidthProfiles, customers, tariffs] = await Promise.all([
    db.select().from(s.nasDevices),
    db.select().from(s.ipPools),
    db.select().from(s.bandwidthProfiles),
    db.select().from(s.customers).where(sql`${s.customers.status} in ('active','grace')`).limit(limit),
    db.select().from(s.tariffs),
  ]);

  const tariffMap = new Map(tariffs.map((t) => [t.id, t]));
  const bwMap = new Map(bandwidthProfiles.map((b) => [b.id, b]));

  const sessions = customers.map((c) => {
    const tariff = c.tariffId ? tariffMap.get(c.tariffId) : undefined;
    const bw = tariff ? bwMap.get(tariff.bandwidthProfileId) : undefined;
    const online = c.status === "active";
    const sess = simSession(c.id, bw?.downKbps ?? 10000, bw?.upKbps ?? 5000, online);
    return { customer: c, tariff, bw, session: sess };
  });

  // Pool usage comes from the subscriber's own assigned ipPoolId — not from
  // their plan — since IP pool and Traffic Plan are decoupled.
  const poolUsage = ipPools.map((p) => ({ pool: p, used: customers.filter((c) => c.ipPoolId === p.id).length }));

  // A subscriber's NAS comes from their IP pool (ip_pools.routerId) — never
  // from their plan — since a pool, not a bandwidth policy, is what actually
  // terminates on a given NAS/BNG.
  const poolToNas = new Map(ipPools.map((p) => [p.id, p.routerId]));
  const nasSessions = nasDevices.map((n) => ({
    nas: n,
    sessions: customers.filter((c) => c.ipPoolId && poolToNas.get(c.ipPoolId) === n.id).length,
  }));

  return { nasDevices: nasSessions, ipPools: poolUsage, bandwidthProfiles, sessions };
}
