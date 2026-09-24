/* Deterministic seed for TrustForce OSS/BSS on Neon Postgres.
 * Ports the original in-memory generator (legacy-static-demo/assets/js/data/seed.js)
 * to real rows: same zones, same OLT/DN/SN topology, same ~550 subscribers.
 * Run with: npm run db:seed
 */
import { db } from "../lib/db";
import { Rand, DAY_MS, REFERENCE_NOW as NOW } from "../lib/rng";
import * as s from "../lib/schema";
import { sql } from "drizzle-orm";

const R = new Rand(20260918);
const pick = <T,>(a: T[]) => R.pick(a);
const int = (lo: number, hi: number) => R.int(lo, hi);
const chance = (p: number) => R.chance(p);

const FIRST_M = ["Aung", "Kyaw", "Zaw", "Thura", "Nay", "Myo", "Hein", "Wai", "Thet", "Ko", "Soe", "Min", "Phyo", "Yan"];
const FIRST_F = ["Ei", "Thiri", "Nilar", "Hnin", "Su", "Yamin", "Khin", "Moe", "Nandar", "Phyu", "Zin", "Thandar"];
const LAST = ["Win", "Naing", "Oo", "Htun", "Lwin", "Aye", "Maung", "Hlaing", "Myint", "Thein", "Zaw", "Kyi", "Moe", "Phyo"];
const ORGS = ["Shwe Pyi Trading", "Golden Valley Hotel", "Yangon Tech Hub", "Ayeyar Mart", "Sein Lan Clinic",
  "Mingalar Logistics", "Delta Coffee House", "Pyin Oo Lwin Resort", "Thiri Dental", "Star Print House",
  "Nova Coworking", "City Mart Express", "Bagan Tours", "Royal Textile", "Green Leaf Academy"];

const ZONES = [
  { zone: "Hlaing", lat: 16.8560, lng: 96.1250 },
  { zone: "Kamayut", lat: 16.8235, lng: 96.1315 },
  { zone: "Insein", lat: 16.9000, lng: 96.1050 },
  { zone: "Thingangyun", lat: 16.8250, lng: 96.1880 },
  { zone: "South Okkalapa", lat: 16.8420, lng: 96.1960 },
  { zone: "Mayangone", lat: 16.8700, lng: 96.1420 },
];

const BANDWIDTHS = [
  { id: "BW-10", name: "Home 10M", down: 10, up: 5, burst: 15, priority: 6 },
  { id: "BW-20", name: "Home 20M", down: 20, up: 10, burst: 28, priority: 5 },
  { id: "BW-30", name: "Home 30M", down: 30, up: 15, burst: 40, priority: 5 },
  { id: "BW-50", name: "Home 50M", down: 50, up: 25, burst: 65, priority: 4 },
  { id: "BW-100", name: "Pro 100M", down: 100, up: 50, burst: 120, priority: 3 },
  { id: "BW-200", name: "Business 200M", down: 200, up: 200, burst: null, priority: 2 },
  { id: "BW-500", name: "Dedicated 500M", down: 500, up: 500, burst: null, priority: 1 },
];

const IP_POOLS = [
  { id: "POOL-RES-A", name: "Residential A", range: "10.20.0.2/21", nas: "NAS-CORE-01" },
  { id: "POOL-RES-B", name: "Residential B", range: "10.21.0.2/21", nas: "NAS-CORE-01" },
  { id: "POOL-BIZ", name: "Business CGNAT", range: "10.40.0.2/22", nas: "NAS-CORE-02" },
  { id: "POOL-STATIC", name: "Public /24 block", range: "103.86.14.2/24", nas: "NAS-CORE-02" },
  { id: "POOL-HOTSPOT", name: "Hotspot captive", range: "172.22.0.2/22", nas: "NAS-EDGE-03" },
];

const NAS_DEVICES = [
  { id: "NAS-CORE-01", name: "Hlaing Core BNG", ip: "10.10.0.1", type: "mikrotik" },
  { id: "NAS-CORE-02", name: "Kamayut Core BNG", ip: "10.10.0.2", type: "cisco" },
  { id: "NAS-EDGE-03", name: "Insein Edge", ip: "10.10.0.3", type: "mikrotik" },
  { id: "NAS-EDGE-04", name: "Thingangyun Edge", ip: "10.10.0.4", type: "huawei" },
];

const TARIFFS = [
  { id: "TP-101", name: "Home Fiber 10", bw: "BW-10", price: 18000, cycle: "prepaid", days: 30, pool: "POOL-RES-A", segment: "personal" },
  { id: "TP-102", name: "Home Fiber 20", bw: "BW-20", price: 25000, cycle: "prepaid", days: 30, pool: "POOL-RES-A", segment: "personal" },
  { id: "TP-103", name: "Home Fiber 30", bw: "BW-30", price: 33000, cycle: "prepaid", days: 30, pool: "POOL-RES-B", segment: "personal" },
  { id: "TP-104", name: "Home Fiber 50", bw: "BW-50", price: 45000, cycle: "prepaid", days: 30, pool: "POOL-RES-B", segment: "personal" },
  { id: "TP-201", name: "SME Fiber 100", bw: "BW-100", price: 95000, cycle: "postpaid", days: 30, pool: "POOL-BIZ", segment: "business" },
  { id: "TP-202", name: "Business Static 200", bw: "BW-200", price: 185000, cycle: "postpaid", days: 30, pool: "POOL-STATIC", segment: "business" },
  { id: "TP-203", name: "Dedicated Line 500", bw: "BW-500", price: 620000, cycle: "postpaid", days: 30, pool: "POOL-STATIC", segment: "business" },
];

const OLT_DEF = [
  { id: "OLT-01", name: "Hlaing Central OLT", vendor: "Huawei", model: "MA5800-X7", ip: "10.30.1.1", zone: "Hlaing", slots: 2, portsPerSlot: 8, degraded: false },
  { id: "OLT-02", name: "Kamayut OLT", vendor: "ZTE", model: "C320", ip: "10.30.1.2", zone: "Kamayut", slots: 2, portsPerSlot: 8, degraded: false },
  { id: "OLT-03", name: "Insein North OLT", vendor: "Huawei", model: "MA5608T", ip: "10.30.1.3", zone: "Insein", slots: 1, portsPerSlot: 8, degraded: true },
];

const ONU_VENDOR = [
  { v: "Huawei", m: "EG8145V5" },
  { v: "ZTE", m: "F670L" },
  { v: "Nokia", m: "G-140W-C" },
  { v: "VSOL", m: "V2802RH" },
];

function jitterRoute(a: [number, number], b: [number, number]): [number, number][] {
  const mid: [number, number] = [(a[0] + b[0]) / 2 + (R.float() - 0.5) * 0.004, (a[1] + b[1]) / 2 + (R.float() - 0.5) * 0.004];
  return [a, mid, b];
}

async function main() {
  console.log("Seeding TrustForce OSS/BSS on Neon…");

  console.log("Clearing existing rows…");
  for (const table of [
    s.auditLog, s.campaigns, s.alarms, s.assets, s.inventoryItems, s.tickets, s.vouchers,
    s.payments, s.invoices, s.onus, s.splitterNodes, s.distributionNodes, s.fibers, s.ponPorts,
    s.olts, s.customers, s.tariffs, s.nasDevices, s.ipPools, s.bandwidthProfiles, s.staff,
  ]) {
    await db.execute(sql`TRUNCATE TABLE ${table} CASCADE`);
  }

  await db.insert(s.bandwidthProfiles).values(
    BANDWIDTHS.map((b) => ({
      id: b.id, name: b.name, downKbps: b.down * 1000, upKbps: b.up * 1000,
      burstKbps: b.burst ? b.burst * 1000 : null, priority: b.priority, fupThresholdGb: null,
    }))
  );

  await db.insert(s.ipPools).values(IP_POOLS.map((p) => ({ id: p.id, name: p.name, rangeCidr: p.range, routerId: p.nas })));

  await db.insert(s.nasDevices).values(
    NAS_DEVICES.map((n) => ({ id: n.id, name: n.name, ip: n.ip, type: n.type, linkedOltId: OLT_DEF.find((o) => o.id.endsWith("1") && n.id === "NAS-CORE-01") ? "OLT-01" : null }))
  );

  await db.insert(s.tariffs).values(
    TARIFFS.map((t) => ({
      id: t.id, name: t.name, status: "active", billingType: t.cycle, accountType: t.segment,
      priceMmk: t.price, validityDays: t.days, bandwidthProfileId: t.bw,
      ipPoolId: t.pool, nasId: IP_POOLS.find((p) => p.id === t.pool)!.nas, expiredBehavior: "suspend",
    }))
  );

  await db.insert(s.staff).values([
    { id: "U-001", name: "Hein Htet Aung", email: "hein@trustforcemm.com", role: "sysadmin" },
    { id: "U-002", name: "Ko Zaw Naing", email: "noc1@trustforcemm.com", role: "network_ops" },
    { id: "U-003", name: "Ma Mya Thein", email: "cashier@trustforcemm.com", role: "cashier" },
    { id: "U-004", name: "Ko Myo Set", email: "field1@trustforcemm.com", role: "network_ops" },
    { id: "U-005", name: "Daw Nilar Win", email: "finance@trustforcemm.com", role: "management" },
  ]);

  // ---------------- OLT / PON port / feeder fiber / DN / distribution fiber / SN ----------------
  let dnSeq = 0, snSeq = 0, fbSeq = 0;
  const oltRows: (typeof s.olts.$inferInsert)[] = [];
  const ponRows: (typeof s.ponPorts.$inferInsert)[] = [];
  const fiberRows: (typeof s.fibers.$inferInsert)[] = [];
  const dnRows: (typeof s.distributionNodes.$inferInsert)[] = [];
  const snRows: (typeof s.splitterNodes.$inferInsert)[] = [];
  const snMeta = new Map<string, { zone: string; oltId: string }>();

  for (let oi = 0; oi < OLT_DEF.length; oi++) {
    const def = OLT_DEF[oi];
    const zone = ZONES.find((z) => z.zone === def.zone)!;
    const oltLat = zone.lat + (R.float() - 0.5) * 0.012;
    const oltLng = zone.lng + (R.float() - 0.5) * 0.012;
    oltRows.push({
      id: def.id, name: def.name, vendor: def.vendor, model: def.model,
      serial: "SN" + (7100000 + oi * 137), site: def.zone + " POP",
      lat: oltLat, lng: oltLng, mgmtIp: def.ip,
      installDate: new Date(NOW - int(420, 1400) * DAY_MS),
      adminStatus: "enabled", operStatus: def.degraded ? "degraded" : "up",
      firmware: def.vendor === "Huawei" ? "V800R021C10" : "V2.1.0P3",
      temperatureC: 38 + int(0, 9),
    });

    for (let sl = 1; sl <= def.slots; sl++) {
      for (let p = 1; p <= def.portsPerSlot; p++) {
        const active = (sl - 1) * def.portsPerSlot + p <= (oi === 2 ? 4 : 6);
        const portId = `${def.id}/S${sl}/P${p}`;
        ponRows.push({
          id: portId, oltId: def.id, slot: sl, port: p,
          adminStatus: active ? "up" : "down", operStatus: active ? "up" : "down",
          txDbm: -(1.5 + R.float() * 1.2),
        });
        if (!active) continue;

        const feederId = "F-" + String(++fbSeq).padStart(3, "0");
        const dnLat = oltLat + (R.float() - 0.5) * 0.02;
        const dnLng = oltLng + (R.float() - 0.5) * 0.02;
        fiberRows.push({
          id: feederId, kind: "feeder", fromType: "pon_port", fromId: portId, toType: "dn", toId: "DN-" + String(dnSeq + 1).padStart(3, "0"),
          lengthM: int(420, 3400), coreCount: 24, lossBudgetDb: 21,
          route: jitterRoute([oltLat, oltLng], [dnLat, dnLng]),
        });

        const dnId = "DN-" + String(++dnSeq).padStart(3, "0");
        dnRows.push({
          id: dnId, name: `${def.zone} DN ${dnSeq}`, zone: def.zone, lat: dnLat, lng: dnLng,
          splitRatio: 4, ponPortId: portId, feederFiberId: feederId,
          installDate: new Date(NOW - int(120, 900) * DAY_MS),
          condition: chance(0.15) ? "attention" : "good",
        });

        const snCount = int(2, 4);
        for (let o = 1; o <= snCount; o++) {
          const snId = "SN-" + String(++snSeq).padStart(3, "0");
          const snLat = dnLat + (R.float() - 0.5) * 0.008;
          const snLng = dnLng + (R.float() - 0.5) * 0.008;
          const distFiberId = "F-" + String(++fbSeq).padStart(3, "0");
          fiberRows.push({
            id: distFiberId, kind: "distribution", fromType: "dn", fromId: dnId, toType: "sn", toId: snId,
            lengthM: int(80, 900), coreCount: 12, lossBudgetDb: 12,
            route: jitterRoute([dnLat, dnLng], [snLat, snLng]),
          });
          snRows.push({
            id: snId, name: `${def.zone} SN ${snSeq}`, zone: def.zone, lat: snLat, lng: snLng,
            splitRatio: 16, dnId, distributionFiberId: distFiberId,
            installDate: new Date(NOW - int(5, 90) * DAY_MS),
            condition: chance(0.12) ? "attention" : "good",
          });
          snMeta.set(snId, { zone: def.zone, oltId: def.id });
        }
      }
    }
  }

  await db.insert(s.olts).values(oltRows);
  await db.insert(s.ponPorts).values(ponRows);
  await db.insert(s.fibers).values(fiberRows);
  await db.insert(s.distributionNodes).values(dnRows);
  await db.insert(s.splitterNodes).values(snRows);

  // ---------------- customers + ONUs hanging off SN ports ----------------
  function rollStatus() {
    const r = R.float();
    if (r < 0.88) return "active";
    if (r < 0.92) return "grace";
    if (r < 0.95) return "suspended";
    return "expired";
  }

  const customerRows: (typeof s.customers.$inferInsert)[] = [];
  const onuRows: (typeof s.onus.$inferInsert)[] = [];
  let cusSeq = 0;

  for (const sn of snRows) {
    const meta = snMeta.get(sn.id as string)!;
    const dn = dnRows.find((d) => d.id === sn.dnId)!;
    const fill = int(8, 16);
    for (let p = 1; p <= 16; p++) {
      if (p > fill) continue;
      cusSeq++;
      const isBiz = chance(0.16);
      const gender = chance(0.5);
      const name = isBiz ? pick(ORGS) : `${gender ? pick(FIRST_M) : pick(FIRST_F)} ${pick(LAST)}`;
      const tariff = isBiz ? pick(TARIFFS.filter((t) => t.segment === "business")) : pick(TARIFFS.filter((t) => t.segment === "personal"));
      const status = rollStatus();
      const installed = NOW - int(20, 700) * DAY_MS;
      const dev = pick(ONU_VENDOR);
      const distance = int(620, 4200);
      const rx = -(8.5 + 3.2 * 0.45 + 13.8 * 0.55 + distance * 0.00035 * 3 + R.float() * 1.8);
      const offline = status === "suspended" || status === "expired" || chance(0.07);
      const custId = "CUS-" + String(cusSeq).padStart(4, "0");
      const onuId = "ONU-" + String(cusSeq).padStart(4, "0");
      const expiry = status === "expired" ? NOW - int(2, 40) * DAY_MS
        : status === "grace" ? NOW - int(1, 4) * DAY_MS
        : NOW + int(1, 29) * DAY_MS;

      customerRows.push({
        id: custId, username: (isBiz ? "biz" : "res") + String(cusSeq).padStart(4, "0"),
        fullName: name, email: (isBiz ? name.toLowerCase().replace(/[^a-z]+/g, ".") : "sub" + cusSeq) + "@example.mm",
        phone: "09" + int(700000000, 799999999), address: `No.${int(1, 240)}, ${int(1, 12)} Street, ${meta.zone}`,
        accountType: isBiz ? "business" : "personal", zone: meta.zone,
        lat: (sn.lat as number) + (R.float() - 0.5) * 0.006, lng: (sn.lng as number) + (R.float() - 0.5) * 0.006,
        status, installedDate: new Date(installed), tariffId: tariff.id, expiryDate: new Date(expiry),
        balanceMmk: chance(0.3) ? int(0, 60) * 1000 : 0,
        snId: sn.id as string, snPort: p,
        pppoeUsername: (isBiz ? "biz" : "res") + String(cusSeq).padStart(4, "0"),
      });

      onuRows.push({
        id: onuId, serial: dev.v.slice(0, 4).toUpperCase() + String(10000000 + cusSeq * 7919).slice(0, 8),
        mac: ["48", "3F", "DA", String(16 + (cusSeq % 200)).padStart(2, "0"), String(10 + (cusSeq % 90)).padStart(2, "0"), String(cusSeq % 100).padStart(2, "0")].join(":"),
        vendor: dev.v, model: dev.m, snId: sn.id as string, snPort: p, customerId: custId,
        installDate: new Date(installed), lastReboot: new Date(NOW - int(2, 300) * DAY_MS),
        status: offline ? "offline" : "online", rxDbmBase: +rx.toFixed(1), txDbmBase: +(1.6 + R.float() * 0.9).toFixed(1),
      });
    }
  }

  // batch insert (Postgres param limit safety)
  for (let i = 0; i < customerRows.length; i += 200) await db.insert(s.customers).values(customerRows.slice(i, i + 200));
  for (let i = 0; i < onuRows.length; i += 200) await db.insert(s.onus).values(onuRows.slice(i, i + 200));

  console.log(`Seeded ${oltRows.length} OLTs, ${dnRows.length} DNs, ${snRows.length} SNs, ${customerRows.length} customers/ONUs.`);

  // ---------------- billing ----------------
  const methods = ["kbzpay", "wavepay", "cash", "bank", "wallet"];
  const invoiceRows: (typeof s.invoices.$inferInsert)[] = [];
  const paymentRows: (typeof s.payments.$inferInsert)[] = [];
  let invSeq = 0, paySeq = 0;

  for (const c of customerRows) {
    const t = TARIFFS.find((x) => x.id === c.tariffId)!;
    const installedMs = (c.installedDate as Date).getTime();
    const expiryMs = (c.expiryDate as Date).getTime();
    const months = Math.min(6, Math.max(1, Math.floor((NOW - installedMs) / (30 * DAY_MS))));
    for (let m = months - 1; m >= 0; m--) {
      const issued = expiryMs - (m + 1) * 30 * DAY_MS;
      if (issued < installedMs - DAY_MS) continue;
      invSeq++;
      const id = "INV-" + String(26000 + invSeq);
      const due = issued + 7 * DAY_MS;
      let state: "paid" | "pending" | "overdue" = "paid";
      if (m === 0) {
        if (c.status === "expired") state = "overdue";
        else if (c.status === "grace") state = "pending";
        else if (NOW < due) state = chance(0.16) ? "pending" : "paid";
        else state = chance(0.05) ? "overdue" : "paid";
      } else if (chance(0.03)) state = "overdue";

      invoiceRows.push({
        id, customerId: c.id as string, tariffId: t.id, amountMmk: t.price, taxMmk: Math.round(t.price * 0.05),
        issuedDate: new Date(issued), dueDate: new Date(due),
        periodStart: new Date(issued), periodEnd: new Date(issued + 30 * DAY_MS),
        status: state, method: state === "paid" ? pick(methods) : null,
      });
      if (state === "paid") {
        paySeq++;
        paymentRows.push({
          id: "PMT-" + String(41000 + paySeq), invoiceId: id, customerId: c.id as string,
          amountMmk: t.price + Math.round(t.price * 0.05), method: pick(methods),
          timestamp: new Date(issued + int(0, 6) * DAY_MS), reconciled: true,
        });
      }
    }
  }
  for (let i = 0; i < invoiceRows.length; i += 200) await db.insert(s.invoices).values(invoiceRows.slice(i, i + 200));
  for (let i = 0; i < paymentRows.length; i += 200) await db.insert(s.payments).values(paymentRows.slice(i, i + 200));
  console.log(`Seeded ${invoiceRows.length} invoices, ${paymentRows.length} payments.`);

  // ---------------- vouchers ----------------
  const voucherRows: (typeof s.vouchers.$inferInsert)[] = [];
  for (let i = 1; i <= 60; i++) {
    const used = chance(0.45);
    voucherRows.push({
      id: "TF-" + String(100000 + i * 37).slice(0, 6) + "-" + String(900 + i),
      code: "TF-" + String(100000 + i * 37).slice(0, 6) + "-" + String(900 + i),
      tariffId: pick(TARIFFS).id, status: used ? "used" : "unused",
      generatedBy: "cashier.mya",
      redeemedByCustomerId: used ? pick(customerRows).id as string : null,
      redeemedAt: used ? new Date(NOW - int(1, 90) * DAY_MS) : null,
      createdAt: new Date(NOW - int(91, 160) * DAY_MS),
    });
  }
  await db.insert(s.vouchers).values(voucherRows);

  // ---------------- tickets ----------------
  const TECHS = ["Ko Myo (Van 1)", "U Thura (Van 2)", "Ko Hein (Van 3)", "Daw Su (Indoor)"];
  const TICKET_KINDS = [
    { t: "No internet — LOS on ONU", cat: "Fault" },
    { t: "Slow speed in the evening", cat: "Performance" },
    { t: "New installation request", cat: "Install" },
    { t: "Relocation to new address", cat: "Move" },
    { t: "Wi-Fi password change", cat: "Config" },
    { t: "Invoice dispute", cat: "Billing" },
    { t: "Router replacement under warranty", cat: "Hardware" },
    { t: "Intermittent disconnects at night", cat: "Fault" },
  ];
  const ticketRows: (typeof s.tickets.$inferInsert)[] = [];
  const stages = ["open", "assigned", "in-progress", "resolved"] as const;
  for (let i = 1; i <= 26; i++) {
    const c = pick(customerRows);
    const k = pick(TICKET_KINDS);
    const stage = i <= 5 ? "open" : i <= 10 ? "assigned" : i <= 15 ? "in-progress" : pick(stages);
    const created = NOW - int(1, 240) * 3600000;
    ticketRows.push({
      id: "TKT-" + String(3100 + i), customerId: c.id as string, category: k.cat,
      priority: k.cat === "Fault" ? pick(["high", "high", "critical"]) : pick(["low", "normal", "high"]),
      status: stage, technician: stage === "open" ? null : pick(TECHS),
      notes: "Reported by customer over the phone.",
      slaDueAt: new Date(created + (k.cat === "Fault" ? 8 : 48) * 3600000),
      openedAt: new Date(created), resolvedAt: stage === "resolved" ? new Date(created + int(2, 40) * 3600000) : null,
    });
  }
  await db.insert(s.tickets).values(ticketRows);

  // ---------------- inventory + assets ----------------
  await db.insert(s.inventoryItems).values([
    { id: "ITM-ONT-01", sku: "ONT-HW-EG8145", name: "Huawei EG8145V5 ONT", onHand: 142, reserved: 18, reorderLevel: 60, unitCostMmk: 42000, bin: "Hlaing warehouse" },
    { id: "ITM-ONT-02", sku: "ONT-ZTE-F670L", name: "ZTE F670L ONT", onHand: 58, reserved: 6, reorderLevel: 60, unitCostMmk: 46000, bin: "Hlaing warehouse" },
    { id: "ITM-RTR-01", sku: "RTR-MT-HAPAX", name: "MikroTik hAP ax lite", onHand: 37, reserved: 4, reorderLevel: 25, unitCostMmk: 88000, bin: "Kamayut store" },
    { id: "ITM-FIB-01", sku: "FIB-DROP-1C", name: "Drop cable 1-core (300m roll)", onHand: 24, reserved: 3, reorderLevel: 12, unitCostMmk: 165000, bin: "Hlaing warehouse" },
    { id: "ITM-FIB-02", sku: "FIB-ADSS-24C", name: "ADSS 24-core aerial (2km)", onHand: 6, reserved: 2, reorderLevel: 4, unitCostMmk: 2400000, bin: "Insein yard" },
    { id: "ITM-SPL-01", sku: "SPL-PLC-1X4", name: "PLC splitter 1:4 (SC/APC)", onHand: 44, reserved: 5, reorderLevel: 20, unitCostMmk: 28000, bin: "Hlaing warehouse" },
    { id: "ITM-SPL-02", sku: "SPL-PLC-1X16", name: "PLC splitter 1:16 (SC/APC)", onHand: 19, reserved: 7, reorderLevel: 20, unitCostMmk: 64000, bin: "Hlaing warehouse" },
    { id: "ITM-CLS-01", sku: "CLS-DOME-48F", name: "Fibre closure 48F dome", onHand: 31, reserved: 2, reorderLevel: 15, unitCostMmk: 52000, bin: "Insein yard" },
    { id: "ITM-PAT-01", sku: "PAT-SCAPC-3M", name: "Patch cord SC/APC 3m", onHand: 320, reserved: 40, reorderLevel: 150, unitCostMmk: 3200, bin: "Kamayut store" },
    { id: "ITM-CON-01", sku: "CON-SCAPC-FAST", name: "Fast connector SC/APC", onHand: 780, reserved: 120, reorderLevel: 400, unitCostMmk: 900, bin: "Hlaing warehouse" },
  ]);

  const assetRows = onuRows.slice(0, 400).map((o) => ({
    id: "AST-" + (o.id as string).replace("ONU-", ""), serial: o.serial as string, mac: o.mac as string,
    model: `${o.vendor} ${o.model}`, boundCustomerId: o.customerId as string, issuedBy: "field.myo",
    issuedAt: o.installDate as Date,
  }));
  for (let i = 0; i < assetRows.length; i += 200) await db.insert(s.assets).values(assetRows.slice(i, i + 200));

  // ---------------- alarms ----------------
  const ALARM_KINDS = [
    { code: "LOS", severity: "critical" },
    { code: "DYING-GASP", severity: "major" },
    { code: "OPTICAL-LOW", severity: "major" },
    { code: "TEMP-HIGH", severity: "minor" },
    { code: "LINK-DOWN", severity: "critical" },
    { code: "REBOOT", severity: "minor" },
    { code: "REG-FAIL", severity: "major" },
  ];
  const alarmRows: (typeof s.alarms.$inferInsert)[] = [];
  let alSeq = 0;
  const troubledOnus = onuRows.filter((o) => o.status === "offline" || (o.rxDbmBase as number) < -25).slice(0, 26);
  for (const o of troubledOnus) {
    const k = (o.rxDbmBase as number) < -25 ? ALARM_KINDS[2] : pick([ALARM_KINDS[0], ALARM_KINDS[1], ALARM_KINDS[6]]);
    alarmRows.push({
      id: "ALM-" + String(++alSeq).padStart(4, "0"), code: k.code, severity: k.severity,
      objectType: "onu", objectId: o.id as string,
      path: `${o.id} → ${o.snId} → ${(o.snId as string).replace("SN", "DN")}`,
      raisedAt: new Date(NOW - int(1, 72) * 3600000), state: "current",
      note: k.code === "OPTICAL-LOW" ? `RX ${o.rxDbmBase} dBm, below the -25.0 dBm threshold` : "No optical signal received from the ONU",
    });
  }
  alarmRows.push({
    id: "ALM-0101", code: "PSU-FAIL", severity: "major", objectType: "olt", objectId: "OLT-03",
    path: "OLT-03", raisedAt: new Date(NOW - 31 * 3600000), state: "current",
    note: "Power supply B reporting failed state; chassis running on single feed",
  });
  for (let i = 0; i < 18; i++) {
    const o = pick(onuRows);
    const k = pick(ALARM_KINDS);
    const raised = NOW - int(3, 40) * DAY_MS;
    alarmRows.push({
      id: "ALM-" + String(200 + i), code: k.code, severity: k.severity, objectType: "onu", objectId: o.id as string,
      path: `${o.id} → ${o.snId}`, raisedAt: new Date(raised), clearedAt: new Date(raised + int(1, 30) * 3600000),
      state: "cleared", note: "Auto-cleared after service restoration",
    });
  }
  await db.insert(s.alarms).values(alarmRows);

  // ---------------- messaging campaigns (historical, simulated sends) ----------------
  await db.insert(s.campaigns).values([
    { id: "CMP-014", audience: "expired", channel: "sms", template: "TPL-EXP-3", recipientCount: 214, status: "sent", createdBy: "sales.team", createdAt: new Date(NOW - 2 * DAY_MS) },
    { id: "CMP-013", audience: "active", channel: "whatsapp", template: "TPL-OUTAGE", recipientCount: 96, status: "sent", createdBy: "noc.zaw", createdAt: new Date(NOW - 9 * DAY_MS) },
    { id: "CMP-012", audience: "active", channel: "sms", template: "TPL-WELCOME", recipientCount: 180, status: "sent", createdBy: "sales.team", createdAt: new Date(NOW - 21 * DAY_MS) },
  ]);

  // ---------------- audit log ----------------
  const AUDIT_ACTS: [string, string, string, string][] = [
    ["cashier.mya", "Payment recorded", "INV-26014", "KBZPay auto-matched"],
    ["noc.zaw", "CoA disconnect", "CUS-0042", "Expired session cleared"],
    ["admin.hein", "Tariff updated", "TP-104", "Price 42,000 → 45,000 MMK"],
    ["noc.zaw", "ONU reboot", "ONU-0117", "Remote reboot after LOS"],
    ["field.myo", "Stock issued", "ITM-ONT-01", "1 pc to ticket TKT-3108"],
    ["admin.hein", "Role changed", "U-003", "cashier: export permission removed"],
    ["cashier.mya", "Voucher batch generated", "BATCH-2026-03", "20 vouchers"],
    ["noc.zaw", "PON port disabled", "OLT-03/S1/P4", "Maintenance window"],
  ];
  const auditRows = [];
  for (let i = 0; i < 40; i++) {
    const a = AUDIT_ACTS[i % AUDIT_ACTS.length];
    auditRows.push({
      timestamp: new Date(NOW - i * int(20, 180) * 60000),
      actor: a[0], action: a[1], objectType: null, objectId: a[2], detail: a[3],
    });
  }
  await db.insert(s.auditLog).values(auditRows);

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
