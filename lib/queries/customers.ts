import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

export async function listCustomers(opts: { q?: string; status?: string; zone?: string; limit?: number }) {
  const conds = [];
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(s.customers.fullName, like), ilike(s.customers.id, like), ilike(s.customers.phone, like), ilike(s.customers.username, like)));
  }
  if (opts.status) conds.push(eq(s.customers.status, opts.status));
  if (opts.zone) conds.push(eq(s.customers.zone, opts.zone));

  const rows = await db
    .select()
    .from(s.customers)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(s.customers.installedDate))
    .limit(opts.limit ?? 200);

  const tariffs = await db.select().from(s.tariffs);
  const tMap = new Map(tariffs.map((t) => [t.id, t]));
  return rows.map((c) => ({ ...c, tariff: c.tariffId ? tMap.get(c.tariffId) : undefined }));
}

export async function getZones() {
  const rows = await db.select({ zone: s.customers.zone }).from(s.customers).groupBy(s.customers.zone);
  return rows.map((r) => r.zone).sort();
}

export async function getCustomerDetail(id: string) {
  const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, id)).limit(1);
  if (!customer) return null;

  const [tariff, onu, invoicesRows, paymentsRows, ticketsRows, asset] = await Promise.all([
    customer.tariffId ? db.select().from(s.tariffs).where(eq(s.tariffs.id, customer.tariffId)).limit(1) : Promise.resolve([]),
    db.select().from(s.onus).where(eq(s.onus.customerId, id)).limit(1),
    db.select().from(s.invoices).where(eq(s.invoices.customerId, id)).orderBy(desc(s.invoices.issuedDate)).limit(24),
    db.select().from(s.payments).where(eq(s.payments.customerId, id)).orderBy(desc(s.payments.timestamp)).limit(24),
    db.select().from(s.tickets).where(eq(s.tickets.customerId, id)).orderBy(desc(s.tickets.openedAt)).limit(20),
    db.select().from(s.assets).where(eq(s.assets.boundCustomerId, id)).limit(1),
  ]);

  let sn = null, dn = null, olt = null, ponPort = null;
  if (onu[0]) {
    const [snRow] = await db.select().from(s.splitterNodes).where(eq(s.splitterNodes.id, onu[0].snId)).limit(1);
    sn = snRow ?? null;
    if (sn) {
      const [dnRow] = await db.select().from(s.distributionNodes).where(eq(s.distributionNodes.id, sn.dnId)).limit(1);
      dn = dnRow ?? null;
      if (dn) {
        const [ponRow] = await db.select().from(s.ponPorts).where(eq(s.ponPorts.id, dn.ponPortId)).limit(1);
        ponPort = ponRow ?? null;
        if (ponPort) {
          const [oltRow] = await db.select().from(s.olts).where(eq(s.olts.id, ponPort.oltId)).limit(1);
          olt = oltRow ?? null;
        }
      }
    }
  }

  const bandwidthProfiles = await db.select().from(s.bandwidthProfiles);
  const bw = tariff[0] ? bandwidthProfiles.find((b) => b.id === tariff[0].bandwidthProfileId) : undefined;

  const location = customer.locationId
    ? (await db.select().from(s.locations).where(eq(s.locations.id, customer.locationId)).limit(1))[0] ?? null
    : null;

  return {
    customer, tariff: tariff[0] ?? null, bandwidth: bw ?? null, location,
    onu: onu[0] ?? null, sn, dn, ponPort, olt,
    invoices: invoicesRows, payments: paymentsRows, tickets: ticketsRows, asset: asset[0] ?? null,
  };
}

export async function findFreeSnPort(): Promise<{ snId: string; port: number } | null> {
  const sns = await db.select().from(s.splitterNodes);
  const onus = await db.select({ snId: s.onus.snId, snPort: s.onus.snPort }).from(s.onus);
  for (const sn of sns) {
    const used = new Set(onus.filter((o) => o.snId === sn.id).map((o) => o.snPort));
    for (let p = 1; p <= (sn.splitRatio ?? 16); p++) {
      if (!used.has(p)) return { snId: sn.id, port: p };
    }
  }
  return null;
}

export async function nextCustomerId(): Promise<{ custId: string; onuId: string; seq: number }> {
  const [row] = await db.select({ id: s.customers.id }).from(s.customers).orderBy(desc(sql`substring(${s.customers.id} from 5)::int`)).limit(1);
  const seq = row ? parseInt(row.id.replace("CUS-", ""), 10) + 1 : 1;
  return { custId: "CUS-" + String(seq).padStart(4, "0"), onuId: "ONU-" + String(seq).padStart(4, "0"), seq };
}

// ONU numbering stays a simple global sequence regardless of the customer ID
// format, since it isn't part of the location-based subscriber ID scheme.
export async function nextOnuId(): Promise<string> {
  const [row] = await db.select({ id: s.onus.id }).from(s.onus).orderBy(desc(sql`substring(${s.onus.id} from 5)::int`)).limit(1);
  const seq = row ? parseInt(row.id.replace("ONU-", ""), 10) + 1 : 1;
  return "ONU-" + String(seq).padStart(4, "0");
}

// Subscriber ID prefix & formatting rules: {serviceCode}{location.code}-{sequence,
// zero-padded to digitCount}, e.g. "TFYGN-000123". The location's own counter is
// incremented atomically in the same statement that reads it, so two concurrent
// onboardings can't collide even without an interactive transaction.
export async function nextLocationCustomerId(locationId: string, serviceCode: string, digitCount: number): Promise<string> {
  const result = await db.execute<{ code: string; next_sequence: number }>(
    sql`UPDATE ${s.locations} SET next_sequence = next_sequence + 1 WHERE id = ${locationId} RETURNING code, next_sequence - 1 AS next_sequence`
  );
  const row = result.rows[0];
  if (!row) throw new Error("Selected location was not found.");
  return `${serviceCode}${row.code}-${String(row.next_sequence).padStart(digitCount, "0")}`;
}
