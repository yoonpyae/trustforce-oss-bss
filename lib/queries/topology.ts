import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq } from "drizzle-orm";

export type TraceNode = { kind: string; id: string; label: string; href: string };

async function chainFromSn(snId: string) {
  const [sn] = await db.select().from(s.splitterNodes).where(eq(s.splitterNodes.id, snId)).limit(1);
  if (!sn) return null;
  const [dn] = await db.select().from(s.distributionNodes).where(eq(s.distributionNodes.id, sn.dnId)).limit(1);
  const ponPort = dn ? (await db.select().from(s.ponPorts).where(eq(s.ponPorts.id, dn.ponPortId)).limit(1))[0] : undefined;
  const olt = ponPort ? (await db.select().from(s.olts).where(eq(s.olts.id, ponPort.oltId)).limit(1))[0] : undefined;
  return { sn, dn, ponPort, olt };
}

export async function resolveIdentifier(qRaw: string) {
  const q = qRaw.trim().toUpperCase();
  if (!q) return null;

  // Customer ID or phone
  let customer = (await db.select().from(s.customers).where(eq(s.customers.id, q)).limit(1))[0];
  if (!customer && /^09\d+/.test(qRaw.trim())) {
    customer = (await db.select().from(s.customers).where(eq(s.customers.phone, qRaw.trim())).limit(1))[0];
  }
  if (customer) {
    const onu = (await db.select().from(s.onus).where(eq(s.onus.customerId, customer.id)).limit(1))[0];
    const chain = onu ? await chainFromSn(onu.snId) : null;
    return buildResult({ customer, onu, ...chain });
  }

  // ONU by id, serial or MAC
  let onu = (await db.select().from(s.onus).where(eq(s.onus.id, q)).limit(1))[0];
  if (!onu) onu = (await db.select().from(s.onus).where(eq(s.onus.mac, qRaw.trim())).limit(1))[0];
  if (!onu) onu = (await db.select().from(s.onus).where(eq(s.onus.serial, qRaw.trim())).limit(1))[0];
  if (onu) {
    const cust = onu.customerId ? (await db.select().from(s.customers).where(eq(s.customers.id, onu.customerId)).limit(1))[0] : undefined;
    const chain = await chainFromSn(onu.snId);
    return buildResult({ customer: cust, onu, ...chain });
  }

  if (q.startsWith("SN-")) {
    const chain = await chainFromSn(q);
    if (chain) return buildResult(chain);
  }

  if (q.startsWith("DN-")) {
    const [dn] = await db.select().from(s.distributionNodes).where(eq(s.distributionNodes.id, q)).limit(1);
    if (dn) {
      const ponPort = (await db.select().from(s.ponPorts).where(eq(s.ponPorts.id, dn.ponPortId)).limit(1))[0];
      const olt = ponPort ? (await db.select().from(s.olts).where(eq(s.olts.id, ponPort.oltId)).limit(1))[0] : undefined;
      return buildResult({ dn, ponPort, olt });
    }
  }

  if (q.startsWith("OLT-")) {
    const [olt] = await db.select().from(s.olts).where(eq(s.olts.id, q)).limit(1);
    if (olt) return buildResult({ olt });
  }

  if (q.startsWith("F-")) {
    const [fiber] = await db.select().from(s.fibers).where(eq(s.fibers.id, q)).limit(1);
    if (fiber) {
      if (fiber.kind === "feeder") {
        const [dn] = await db.select().from(s.distributionNodes).where(eq(s.distributionNodes.feederFiberId, fiber.id)).limit(1);
        if (dn) {
          const ponPort = (await db.select().from(s.ponPorts).where(eq(s.ponPorts.id, dn.ponPortId)).limit(1))[0];
          const olt = ponPort ? (await db.select().from(s.olts).where(eq(s.olts.id, ponPort.oltId)).limit(1))[0] : undefined;
          return buildResult({ fiber, dn, ponPort, olt });
        }
      } else {
        const [sn] = await db.select().from(s.splitterNodes).where(eq(s.splitterNodes.distributionFiberId, fiber.id)).limit(1);
        if (sn) {
          const chain = await chainFromSn(sn.id);
          return buildResult({ fiber, ...chain });
        }
      }
    }
  }

  return null;
}

function buildResult(parts: {
  customer?: typeof s.customers.$inferSelect;
  onu?: typeof s.onus.$inferSelect;
  sn?: typeof s.splitterNodes.$inferSelect;
  dn?: typeof s.distributionNodes.$inferSelect;
  ponPort?: typeof s.ponPorts.$inferSelect;
  olt?: typeof s.olts.$inferSelect;
  fiber?: typeof s.fibers.$inferSelect;
}) {
  const path: TraceNode[] = [];
  if (parts.olt) path.push({ kind: "OLT", id: parts.olt.id, label: parts.olt.name, href: `/odn/olt/${parts.olt.id}` });
  if (parts.ponPort) path.push({ kind: "PON", id: parts.ponPort.id, label: `S${parts.ponPort.slot}/P${parts.ponPort.port}`, href: `/odn/olt/${parts.ponPort.oltId}` });
  if (parts.dn) path.push({ kind: "DN", id: parts.dn.id, label: parts.dn.name, href: `/odn/dn/${parts.dn.id}` });
  if (parts.sn) path.push({ kind: "SN", id: parts.sn.id, label: parts.sn.name, href: `/odn/sn/${parts.sn.id}` });
  if (parts.onu) path.push({ kind: "ONU", id: parts.onu.id, label: parts.onu.status, href: parts.customer ? `/subscribers/${parts.customer.id}` : `/odn` });
  if (parts.customer) path.push({ kind: "Customer", id: parts.customer.id, label: parts.customer.fullName, href: `/subscribers/${parts.customer.id}` });
  return { ...parts, path };
}

export async function computeImpact(objectType: "olt" | "dn" | "sn", objectId: string) {
  const tariffs = await db.select().from(s.tariffs);
  const priceMap = new Map(tariffs.map((t) => [t.id, t.priceMmk]));

  let sns: (typeof s.splitterNodes.$inferSelect)[] = [];
  if (objectType === "sn") {
    sns = await db.select().from(s.splitterNodes).where(eq(s.splitterNodes.id, objectId));
  } else if (objectType === "dn") {
    sns = await db.select().from(s.splitterNodes).where(eq(s.splitterNodes.dnId, objectId));
  } else {
    const ponPorts = await db.select().from(s.ponPorts).where(eq(s.ponPorts.oltId, objectId));
    const dns = await db.select().from(s.distributionNodes);
    const relevantDns = dns.filter((d) => ponPorts.some((p) => p.id === d.ponPortId));
    const allSns = await db.select().from(s.splitterNodes);
    sns = allSns.filter((sn) => relevantDns.some((d) => d.id === sn.dnId));
  }

  const snIds = sns.map((sn) => sn.id);
  const customers = snIds.length ? await db.select().from(s.customers) : [];
  const affected = customers.filter((c) => c.snId && snIds.includes(c.snId));
  const businessCount = affected.filter((c) => c.accountType === "business").length;
  const revenue = affected.reduce((a, c) => a + (c.tariffId ? priceMap.get(c.tariffId) ?? 0 : 0), 0);

  return { affectedSns: sns, customers: affected, businessCount, revenue };
}
