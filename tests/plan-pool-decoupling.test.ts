// Integration tests against the real Neon dev database (this project never
// mocks Postgres — every other test/verification in this repo runs the same
// way). Each test creates its own TEST-prefixed fixtures and tears them down
// in `afterEach`, so nothing here ever touches real seeded demo data.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import { cidrsOverlap, parseCidr } from "@/lib/cidr";
import {
  changePlan, batchChangePlan, batchChangePlanByFilter, assignIpPool, recharge,
} from "@/lib/actions/customers";
import { savePool, deletePool, batchReassignPool } from "@/lib/actions/ip-pools";
import { runMigration } from "@/scripts/migrate-plan-pool-decouple";

const BW = "BW-10";
const NAS = "NAS-CORE-01";

async function makeTariff(id: string, priceMmk: number, ipPoolId: string | null = null) {
  await db.insert(s.tariffs).values({
    id, name: id, status: "active", billingType: "prepaid", accountType: "personal",
    priceMmk, validityDays: 30, bandwidthProfileId: BW, ipPoolId, expiredBehavior: "suspend",
  });
}

async function makePool(id: string, rangeCidr: string, vlan: number | null) {
  await db.insert(s.ipPools).values({ id, name: id, rangeCidr, routerId: NAS, vlan, status: "active", type: "dynamic" });
}

async function makeCustomer(id: string, tariffId: string, ipPoolId: string | null, vlan: number | null) {
  await db.insert(s.customers).values({
    id, username: id.toLowerCase(), fullName: id, phone: "09" + id.replace(/\D/g, "").padEnd(9, "0"),
    address: "Test address", accountType: "personal", zone: "Hlaing", lat: 16.85, lng: 96.13,
    status: "active", installedDate: new Date(), tariffId, expiryDate: new Date(Date.now() + 20 * 86400000),
    balanceMmk: 0, ipPoolId, vlan,
  });
}

async function cleanup(ids: { customers?: string[]; tariffs?: string[]; pools?: string[] }) {
  if (ids.customers?.length) {
    await db.delete(s.payments).where(inArray(s.payments.customerId, ids.customers));
    await db.delete(s.invoices).where(inArray(s.invoices.customerId, ids.customers));
    await db.delete(s.onus).where(inArray(s.onus.customerId, ids.customers));
    await db.delete(s.auditLog).where(inArray(s.auditLog.objectId, ids.customers));
    await db.delete(s.customers).where(inArray(s.customers.id, ids.customers));
  }
  if (ids.tariffs?.length) {
    await db.delete(s.auditLog).where(inArray(s.auditLog.objectId, ids.tariffs));
    await db.delete(s.tariffs).where(inArray(s.tariffs.id, ids.tariffs));
  }
  if (ids.pools?.length) {
    await db.delete(s.auditLog).where(inArray(s.auditLog.objectId, ids.pools));
    await db.delete(s.ipPools).where(inArray(s.ipPools.id, ids.pools));
  }
}

describe("CIDR overlap validation (pure, no DB)", () => {
  it("detects overlapping ranges", () => {
    expect(cidrsOverlap("10.20.0.0/21", "10.20.4.0/22")).toBe(true); // 10.20.4.0 is inside .0/21
    expect(cidrsOverlap("10.20.0.0/24", "10.21.0.0/24")).toBe(false);
  });
  it("rejects a malformed range", () => {
    expect(() => parseCidr("not-an-ip/21")).toThrow();
    expect(() => parseCidr("10.20.0.0/99")).toThrow();
  });
});

describe("Plan change leaves pool/VLAN untouched", () => {
  const custId = "TEST-CUS-1";
  const tA = "TEST-TP-A", tB = "TEST-TP-B";
  const pool = "TEST-POOL-1";

  beforeEach(async () => {
    await makePool(pool, "10.250.0.0/24", 900);
    await makeTariff(tA, 10000);
    await makeTariff(tB, 20000);
    await makeCustomer(custId, tA, pool, 900);
  });
  afterEach(async () => cleanup({ customers: [custId], tariffs: [tA, tB], pools: [pool] }));

  it("individual changePlan changes tariffId only", async () => {
    const fd = new FormData();
    fd.set("customerId", custId);
    fd.set("tariffId", tB);
    fd.set("proration", "off");
    await changePlan(fd);

    const [after] = await db.select().from(s.customers).where(eq(s.customers.id, custId)).limit(1);
    expect(after.tariffId).toBe(tB);
    expect(after.ipPoolId).toBe(pool);
    expect(after.vlan).toBe(900);
  });

  it("batch changePlan (selected rows) changes tariffId only, and is idempotent", async () => {
    const fd = new FormData();
    fd.append("customerIds", custId);
    fd.set("tariffId", tB);
    fd.set("proration", "off");
    const first = await batchChangePlan(fd);
    expect(first.succeeded).toBe(1);

    const [after] = await db.select().from(s.customers).where(eq(s.customers.id, custId)).limit(1);
    expect(after.ipPoolId).toBe(pool);
    expect(after.vlan).toBe(900);

    // Idempotency: running the exact same batch again reports a skip, not a
    // second change.
    const second = await batchChangePlan(fd);
    expect(second.succeeded).toBe(0);
    expect(second.skipped).toHaveLength(1);
    expect(second.skipped[0].reason).toMatch(/already on this plan/i);
  });

  it("proration off skips the partial-period invoice", async () => {
    const before = await db.select().from(s.invoices).where(eq(s.invoices.customerId, custId));
    const fd = new FormData();
    fd.set("customerId", custId);
    fd.set("tariffId", tB);
    fd.set("proration", "off");
    await changePlan(fd);
    const after = await db.select().from(s.invoices).where(eq(s.invoices.customerId, custId));
    expect(after.length).toBe(before.length);
  });

  it("effective=renewal schedules the change without applying it, recharge applies it", async () => {
    const fd = new FormData();
    fd.set("customerId", custId);
    fd.set("tariffId", tB);
    fd.set("effective", "renewal");
    await changePlan(fd);

    const [scheduled] = await db.select().from(s.customers).where(eq(s.customers.id, custId)).limit(1);
    expect(scheduled.tariffId).toBe(tA); // unchanged yet
    expect(scheduled.pendingTariffId).toBe(tB);

    const rfd = new FormData();
    rfd.set("customerId", custId);
    rfd.set("method", "cash");
    await recharge(rfd);

    const [applied] = await db.select().from(s.customers).where(eq(s.customers.id, custId)).limit(1);
    expect(applied.tariffId).toBe(tB);
    expect(applied.pendingTariffId).toBeNull();
    expect(applied.ipPoolId).toBe(pool); // still untouched by the renewal
  });
});

describe("Pool reassignment leaves plan untouched", () => {
  const custId = "TEST-CUS-2";
  const tariffId = "TEST-TP-C";
  const poolX = "TEST-POOL-X", poolY = "TEST-POOL-Y";

  beforeEach(async () => {
    await makePool(poolX, "10.251.0.0/24", 910);
    await makePool(poolY, "10.252.0.0/24", 920);
    await makeTariff(tariffId, 15000);
    await makeCustomer(custId, tariffId, poolX, 910);
  });
  afterEach(async () => cleanup({ customers: [custId], tariffs: [tariffId], pools: [poolX, poolY] }));

  it("assignIpPool (individual) changes pool/vlan only", async () => {
    const fd = new FormData();
    fd.set("customerId", custId);
    fd.set("ipPoolId", poolY);
    fd.set("vlan", "920");
    await assignIpPool(fd);

    const [after] = await db.select().from(s.customers).where(eq(s.customers.id, custId)).limit(1);
    expect(after.ipPoolId).toBe(poolY);
    expect(after.vlan).toBe(920);
    expect(after.tariffId).toBe(tariffId);
  });

  it("batchReassignPool (batch) changes pool/vlan only, and is idempotent", async () => {
    const fd = new FormData();
    fd.append("customerIds", custId);
    fd.set("poolId", poolY);
    const first = await batchReassignPool(fd);
    expect(first.moved).toBe(1);

    const [after] = await db.select().from(s.customers).where(eq(s.customers.id, custId)).limit(1);
    expect(after.ipPoolId).toBe(poolY);
    expect(after.tariffId).toBe(tariffId);

    const second = await batchReassignPool(fd);
    expect(second.moved).toBe(0); // already there — idempotent, not re-logged
  });
});

describe("Pool CRUD guards", () => {
  const poolId = "TEST-POOL-DEL";
  const custId = "TEST-CUS-3";
  const tariffId = "TEST-TP-D";

  afterEach(async () => cleanup({ customers: [custId], tariffs: [tariffId], pools: [poolId] }));

  it("rejects an overlapping CIDR range on save", async () => {
    await makePool(poolId, "10.253.0.0/24", 930);
    const fd = new FormData();
    fd.set("name", "Overlap test");
    fd.set("rangeCidr", "10.253.0.128/25"); // inside 10.253.0.0/24
    fd.set("routerId", NAS);
    await expect(savePool(fd)).rejects.toThrow(/overlap/i);
  });

  it("blocks delete while a subscriber is assigned, allows it once moved", async () => {
    await makePool(poolId, "10.253.0.0/24", 930);
    await makeTariff(tariffId, 12000);
    await makeCustomer(custId, tariffId, poolId, 930);

    const fdDel = new FormData();
    fdDel.set("id", poolId);
    await expect(deletePool(fdDel)).rejects.toThrow(/subscriber/i);

    await db.update(s.customers).set({ ipPoolId: null }).where(eq(s.customers.id, custId));
    await deletePool(fdDel); // should now succeed
    const [gone] = await db.select().from(s.ipPools).where(eq(s.ipPools.id, poolId)).limit(1);
    expect(gone).toBeUndefined();
  });
});

describe("Batch plan change by filter (preview + confirm)", () => {
  const custId = "TEST-CUS-4";
  const tA = "TEST-TP-E", tB = "TEST-TP-F";
  const zone = "TEST-ZONE-FILTER";

  beforeEach(async () => {
    await makeTariff(tA, 10000);
    await makeTariff(tB, 30000);
    await db.insert(s.customers).values({
      id: custId, username: custId.toLowerCase(), fullName: custId, phone: "09000000001",
      address: "Test address", accountType: "personal", zone, lat: 16.85, lng: 96.13,
      status: "active", installedDate: new Date(), tariffId: tA, expiryDate: new Date(Date.now() + 20 * 86400000),
      balanceMmk: 0,
    });
  });
  afterEach(async () => cleanup({ customers: [custId], tariffs: [tA, tB] }));

  it("without confirmed=true, only returns a preview and makes no changes", async () => {
    const fd = new FormData();
    fd.set("tariffId", tB);
    fd.set("zone", zone);
    fd.set("proration", "off");
    const res = await batchChangePlanByFilter(fd) as { preview: boolean; count: number };
    expect(res.preview).toBe(true);
    expect(res.count).toBe(1);

    const [unchanged] = await db.select().from(s.customers).where(eq(s.customers.id, custId)).limit(1);
    expect(unchanged.tariffId).toBe(tA);
  });

  it("with confirmed=true, applies the change to every matching subscriber", async () => {
    const fd = new FormData();
    fd.set("tariffId", tB);
    fd.set("zone", zone);
    fd.set("proration", "off");
    fd.set("confirmed", "true");
    const res = await batchChangePlanByFilter(fd) as { succeeded: number; total: number };
    expect(res.succeeded).toBe(1);

    const [changed] = await db.select().from(s.customers).where(eq(s.customers.id, custId)).limit(1);
    expect(changed.tariffId).toBe(tB);
  });
});

describe("Migration backfill idempotency", () => {
  const custId = "TEST-CUS-5";
  const tariffId = "TEST-TP-G";
  const poolId = "TEST-POOL-MIG";

  beforeEach(async () => {
    await makePool(poolId, "10.254.0.0/24", 940);
    await makeTariff(tariffId, 11000, poolId);
    // Deliberately created with ipPoolId/vlan null, as a pre-decoupling
    // record would have been — this is exactly what the migration backfills.
    await db.insert(s.customers).values({
      id: custId, username: custId.toLowerCase(), fullName: custId, phone: "09000000002",
      address: "Test address", accountType: "personal", zone: "Hlaing", lat: 16.85, lng: 96.13,
      status: "active", installedDate: new Date(), tariffId, expiryDate: new Date(Date.now() + 20 * 86400000),
      balanceMmk: 0, ipPoolId: null, vlan: null,
    });
  });
  afterEach(async () => cleanup({ customers: [custId], tariffs: [tariffId], pools: [poolId] }));

  it("backfills ipPoolId from the tariff's suggested pool, then is a no-op on re-run", async () => {
    const first = await runMigration();
    expect(first.subscribersBackfilled).toBeGreaterThanOrEqual(1);

    const [after] = await db.select().from(s.customers).where(eq(s.customers.id, custId)).limit(1);
    expect(after.ipPoolId).toBe(poolId);

    const second = await runMigration();
    // Nothing left to backfill for THIS customer — re-running must not
    // change anything further or error.
    const [stillSame] = await db.select().from(s.customers).where(eq(s.customers.id, custId)).limit(1);
    expect(stillSame.ipPoolId).toBe(poolId);
    void second;
  });
});
