import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq } from "drizzle-orm";
import { simOnuOptical, simOltPortTraffic } from "@/lib/sim";

export async function getPlantOverview() {
  const [olts, dns, sns, fibers, onus, ponPorts] = await Promise.all([
    db.select().from(s.olts),
    db.select().from(s.distributionNodes),
    db.select().from(s.splitterNodes),
    db.select().from(s.fibers),
    db.select({ snId: s.onus.snId }).from(s.onus),
    db.select({ id: s.ponPorts.id, oltId: s.ponPorts.oltId }).from(s.ponPorts),
  ]);
  const countBySn = new Map<string, number>();
  for (const o of onus) countBySn.set(o.snId, (countBySn.get(o.snId) ?? 0) + 1);
  const oltByPort = new Map(ponPorts.map((p) => [p.id, p.oltId]));

  return {
    olts,
    dns: dns.map((d) => ({ ...d, oltId: oltByPort.get(d.ponPortId) ?? "" })),
    sns: sns.map((sn) => ({ ...sn, customers: countBySn.get(sn.id) ?? 0 })),
    fibers,
  };
}

export async function getOltDetail(id: string) {
  const [olt] = await db.select().from(s.olts).where(eq(s.olts.id, id)).limit(1);
  if (!olt) return null;
  const ports = await db.select().from(s.ponPorts).where(eq(s.ponPorts.oltId, id));
  const dns = await db.select().from(s.distributionNodes);
  const onus = await db.select({ snId: s.onus.snId, status: s.onus.status }).from(s.onus);
  const sns = await db.select({ id: s.splitterNodes.id, dnId: s.splitterNodes.dnId }).from(s.splitterNodes);

  const portRows = ports.map((p) => {
    const dn = dns.find((d) => d.ponPortId === p.id);
    const snsUnderDn = dn ? sns.filter((sn) => sn.dnId === dn.id).map((sn) => sn.id) : [];
    const onusUnderPort = onus.filter((o) => snsUnderDn.includes(o.snId));
    const online = onusUnderPort.filter((o) => o.status === "online").length;
    const traffic = simOltPortTraffic(p.id, onusUnderPort.length);
    return { port: p, dn, onuCount: onusUnderPort.length, online, ...traffic };
  });

  return { olt, ports: portRows };
}

export async function getDnDetail(id: string) {
  const [dn] = await db.select().from(s.distributionNodes).where(eq(s.distributionNodes.id, id)).limit(1);
  if (!dn) return null;
  const [ponPort] = await db.select().from(s.ponPorts).where(eq(s.ponPorts.id, dn.ponPortId)).limit(1);
  const [feederFiber] = await db.select().from(s.fibers).where(eq(s.fibers.id, dn.feederFiberId)).limit(1);
  const [olt] = ponPort ? await db.select().from(s.olts).where(eq(s.olts.id, ponPort.oltId)).limit(1) : [];
  const sns = await db.select().from(s.splitterNodes).where(eq(s.splitterNodes.dnId, id));
  const onus = await db.select({ snId: s.onus.snId }).from(s.onus);
  const countBySn = new Map<string, number>();
  for (const o of onus) countBySn.set(o.snId, (countBySn.get(o.snId) ?? 0) + 1);

  const outputs = Array.from({ length: dn.splitRatio }, (_, i) => {
    const sn = sns[i];
    return sn ? { port: i + 1, sn, customers: countBySn.get(sn.id) ?? 0, state: "used" as const } : { port: i + 1, sn: null, state: "free" as const };
  });

  return { dn, ponPort, feederFiber, olt, outputs };
}

export async function getSnDetail(id: string) {
  const [sn] = await db.select().from(s.splitterNodes).where(eq(s.splitterNodes.id, id)).limit(1);
  if (!sn) return null;
  const [dn] = await db.select().from(s.distributionNodes).where(eq(s.distributionNodes.id, sn.dnId)).limit(1);
  const [distributionFiber] = await db.select().from(s.fibers).where(eq(s.fibers.id, sn.distributionFiberId)).limit(1);
  const onus = await db.select().from(s.onus).where(eq(s.onus.snId, id));
  const customerIds = onus.map((o) => o.customerId).filter((x): x is string => !!x);
  const customers = customerIds.length ? await db.select().from(s.customers).where(eq(s.customers.snId, id)) : [];
  const custMap = new Map(customers.map((c) => [c.id, c]));

  const ports = Array.from({ length: sn.splitRatio }, (_, i) => {
    const port = i + 1;
    const onu = onus.find((o) => o.snPort === port);
    if (!onu) return { port, state: "free" as const };
    const customer = onu.customerId ? custMap.get(onu.customerId) : undefined;
    const optical = simOnuOptical(onu.id, onu.rxDbmBase, onu.txDbmBase, onu.status);
    return { port, state: "used" as const, onu, customer, optical };
  });

  return { sn, dn, distributionFiber, ports };
}
