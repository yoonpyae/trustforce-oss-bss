"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { findFreeSnPort, nextOnuId, nextLocationCustomerId } from "@/lib/queries/customers";
import { getSystemSettings } from "@/lib/queries/settings";
import { hashPassword } from "@/lib/password";
import { randomBytes } from "crypto";

const DAY_MS = 86400000;

async function nextInvoiceId() {
  const [row] = await db.select({ id: s.invoices.id }).from(s.invoices).orderBy(desc(sql`substring(${s.invoices.id} from 5)::int`)).limit(1);
  const seq = row ? parseInt(row.id.replace("INV-", ""), 10) + 1 : 26100;
  return "INV-" + String(seq);
}
async function nextPaymentId() {
  const [row] = await db.select({ id: s.payments.id }).from(s.payments).orderBy(desc(sql`substring(${s.payments.id} from 5)::int`)).limit(1);
  const seq = row ? parseInt(row.id.replace("PMT-", ""), 10) + 1 : 41100;
  return "PMT-" + String(seq);
}

export async function recharge(formData: FormData) {
  const customerId = String(formData.get("customerId"));
  const method = String(formData.get("method") || "cash");

  const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, customerId)).limit(1);
  if (!customer || !customer.tariffId) return;
  // A plan change scheduled for "at next renewal" (changePlan, effective=renewal)
  // takes effect right here, at the renewal it was deferred to.
  const effectiveTariffId = customer.pendingTariffId ?? customer.tariffId;
  const [tariff] = await db.select().from(s.tariffs).where(eq(s.tariffs.id, effectiveTariffId)).limit(1);
  if (!tariff) return;
  const scheduledChangeNote = customer.pendingTariffId ? ` (scheduled plan change to ${tariff.name} applied)` : "";

  const now = Date.now();
  const wasDown = customer.status === "expired" || customer.status === "suspended" || customer.status === "inactive";
  const base = customer.expiryDate && new Date(customer.expiryDate).getTime() > now ? new Date(customer.expiryDate).getTime() : now;
  const newExpiry = new Date(base + tariff.validityDays * DAY_MS);

  // Billing calculation mode (System Settings): monthly always charges the
  // plan's full standard fee; daily excludes days the subscriber had no
  // service (down since their old expiry) from what's charged.
  const settings = await getSystemSettings();
  let amountMmk = tariff.priceMmk;
  let billingNote = "";
  if (settings.billingCalculationMode === "daily" && wasDown && customer.expiryDate) {
    const daysDown = Math.min(tariff.validityDays, Math.max(0, Math.round((now - new Date(customer.expiryDate).getTime()) / DAY_MS)));
    const dailyRate = tariff.priceMmk / tariff.validityDays;
    amountMmk = Math.round(dailyRate * (tariff.validityDays - daysDown));
    billingNote = ` (daily billing: ${tariff.validityDays - daysDown}/${tariff.validityDays} active days, ${daysDown}d excluded)`;
  }
  const tax = Math.round(amountMmk * 0.05);

  const invId = await nextInvoiceId();
  await db.insert(s.invoices).values({
    id: invId, customerId, tariffId: tariff.id, amountMmk, taxMmk: tax,
    issuedDate: new Date(now), dueDate: new Date(now), periodStart: new Date(now), periodEnd: newExpiry,
    status: "paid", method,
  });
  await db.insert(s.payments).values({ id: await nextPaymentId(), invoiceId: invId, customerId, amountMmk: amountMmk + tax, method, reconciled: true });

  // Renewal only extends validity/billing (and applies a scheduled plan
  // change, if one is pending) — it never touches vlan/ipPoolId, which are
  // the subscriber's own address-resource assignment (decoupled from the
  // Traffic Plan; see assignIpPool).
  await db.update(s.customers).set({
    status: "active", tariffId: effectiveTariffId, pendingTariffId: null,
    expiryDate: newExpiry, suspendedAt: null, updatedAt: new Date(),
  }).where(eq(s.customers.id, customerId));
  if (wasDown) await db.update(s.onus).set({ status: "online" }).where(eq(s.onus.customerId, customerId));
  await logAudit("Recharge", "customer", customerId, `${tariff.name} renewed via ${method}, new expiry ${newExpiry.toISOString().slice(0, 10)}${billingNote}${scheduledChangeNote}`);

  revalidatePath(`/subscribers/${customerId}`);
  revalidatePath("/subscribers");
  revalidatePath("/billing");
  revalidatePath("/dashboard");
}

export async function addBalance(formData: FormData) {
  const customerId = String(formData.get("customerId"));
  const amount = Math.max(0, parseInt(String(formData.get("amount") || "0"), 10));
  if (!amount) return;

  await db.update(s.customers).set({ balanceMmk: sql`${s.customers.balanceMmk} + ${amount}`, updatedAt: new Date() }).where(eq(s.customers.id, customerId));
  await logAudit("Add balance", "customer", customerId, `Wallet top-up of ${amount.toLocaleString()} MMK`);

  revalidatePath(`/subscribers/${customerId}`);
}

export async function grantGrace(formData: FormData) {
  const customerId = String(formData.get("customerId"));
  const days = Math.min(5, Math.max(1, parseInt(String(formData.get("days") || "1"), 10)));

  const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, customerId)).limit(1);
  if (!customer) return;
  const base = customer.expiryDate ? new Date(customer.expiryDate).getTime() : Date.now();
  const newExpiry = new Date(base + days * DAY_MS);

  await db.update(s.customers).set({ status: "grace", expiryDate: newExpiry, updatedAt: new Date() }).where(eq(s.customers.id, customerId));
  await logAudit("Grace extension", "customer", customerId, `${days}-day grace period granted`);

  revalidatePath(`/subscribers/${customerId}`);
  revalidatePath("/subscribers");
}

export async function setStatus(formData: FormData) {
  const customerId = String(formData.get("customerId"));
  const status = String(formData.get("status"));
  if (!["active", "suspended", "disabled", "banned", "expired"].includes(status)) return;

  await db.update(s.customers).set({ status, updatedAt: new Date() }).where(eq(s.customers.id, customerId));
  await logAudit(status === "active" ? "CoA reconnect" : "CoA disconnect", "customer", customerId, `Status set to ${status}`);

  revalidatePath(`/subscribers/${customerId}`);
  revalidatePath("/subscribers");
  revalidatePath("/dashboard");
}

// Shared by the individual and batch plan-change actions. Only ever touches
// tariffId (bandwidth/pricing/validity) — vlan and ipPoolId are the
// subscriber's own address-resource assignment and are never affected by a
// Traffic Plan change (decoupled; see assignIpPool). `proration` defaults on;
// pass false to skip the partial-period invoice entirely.
async function applyPlanChange(customerId: string, newTariffId: string, proration = true) {
  const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, customerId)).limit(1);
  if (!customer) return { ok: false, reason: "Subscriber not found" };
  const [newTariff] = await db.select().from(s.tariffs).where(eq(s.tariffs.id, newTariffId)).limit(1);
  if (!newTariff) return { ok: false, reason: "Plan not found" };
  if (customer.tariffId === newTariffId) return { ok: false, reason: "Already on this plan" };
  const oldTariff = customer.tariffId ? (await db.select().from(s.tariffs).where(eq(s.tariffs.id, customer.tariffId)).limit(1))[0] : null;

  let prorationNote = proration ? "no prior plan" : "proration off";
  if (proration && oldTariff && customer.expiryDate) {
    const daysRemaining = Math.max(0, Math.round((new Date(customer.expiryDate).getTime() - Date.now()) / DAY_MS));
    const dailyOld = oldTariff.priceMmk / oldTariff.validityDays;
    const dailyNew = newTariff.priceMmk / newTariff.validityDays;
    const diff = Math.round((dailyNew - dailyOld) * daysRemaining);
    prorationNote = `${daysRemaining}d remaining, proration ${diff >= 0 ? "+" : ""}${diff.toLocaleString()} MMK`;
    if (diff > 0) {
      const invId = await nextInvoiceId();
      await db.insert(s.invoices).values({
        id: invId, customerId, tariffId: newTariff.id, amountMmk: diff, taxMmk: 0,
        issuedDate: new Date(), dueDate: new Date(Date.now() + 3 * DAY_MS),
        periodStart: new Date(), periodEnd: customer.expiryDate,
        status: "pending", method: null,
      });
    }
  }

  await db.update(s.customers).set({ tariffId: newTariff.id, updatedAt: new Date() }).where(eq(s.customers.id, customerId));
  await logAudit("Plan change", "customer", customerId, `${oldTariff?.name ?? "—"} → ${newTariff.name} (${prorationNote})`);
  return { ok: true, oldTariff, newTariff, prorationNote };
}

export async function changePlan(formData: FormData) {
  const customerId = String(formData.get("customerId"));
  const newTariffId = String(formData.get("tariffId"));
  const effective = String(formData.get("effective") || "immediate");
  const proration = formData.get("proration") === "on";

  if (effective === "renewal") {
    await db.update(s.customers).set({ pendingTariffId: newTariffId, updatedAt: new Date() }).where(eq(s.customers.id, customerId));
    const [newTariff] = await db.select({ name: s.tariffs.name }).from(s.tariffs).where(eq(s.tariffs.id, newTariffId)).limit(1);
    await logAudit("Plan change scheduled", "customer", customerId, `→ ${newTariff?.name ?? newTariffId} at next renewal (not yet applied)`);
  } else {
    await applyPlanChange(customerId, newTariffId, proration);
  }

  revalidatePath(`/subscribers/${customerId}`);
  revalidatePath("/subscribers");
}

// Batch Traffic Plan change — selected rows. Bounded by the staff member's
// explicit checkbox selection (not a full-table scan), so a plain per-row
// loop is fine here — unlike a background sweep over the whole customer
// base, this only ever touches what was checked. Idempotent: a customer
// already on the target plan is reported as "skipped", not re-applied.
export async function batchChangePlan(formData: FormData) {
  const customerIds = formData.getAll("customerIds").map(String).filter(Boolean);
  const newTariffId = String(formData.get("tariffId"));
  const proration = formData.get("proration") === "on";
  if (!customerIds.length || !newTariffId) throw new Error("Select at least one subscriber and a plan.");

  let succeeded = 0;
  const skipped: { id: string; reason: string }[] = [];
  for (const customerId of customerIds) {
    const result = await applyPlanChange(customerId, newTariffId, proration);
    if (result.ok) succeeded++;
    else skipped.push({ id: customerId, reason: result.reason ?? "unknown" });
  }
  await logAudit("Batch plan change", "customer", null, `${succeeded}/${customerIds.length} subscriber(s) → ${newTariffId}${skipped.length ? `, ${skipped.length} skipped` : ""}`);

  revalidatePath("/subscribers");
  return { succeeded, failed: 0, skipped, total: customerIds.length };
}

// Batch Traffic Plan change — "all matching the current filter" (same
// filters as the Subscribers list) or "all subscribers on plan X". Resolves
// the matching set server-side at submit time (not limited to whatever page
// of rows the browser happened to have loaded). Two-phase: without
// `confirmed=true` it only returns a preview (count, sample, price impact);
// the client shows that and re-submits with confirmed=true to actually run.
// When proration is off this is a single batched UPDATE regardless of how
// many subscribers match; proration needs per-customer math, so that path is
// a bounded loop (capped — see MAX_PRORATION_BATCH) to stay within a request.
const MAX_PRORATION_BATCH = 300;

export async function batchChangePlanByFilter(formData: FormData) {
  const newTariffId = String(formData.get("tariffId"));
  const proration = formData.get("proration") === "on";
  const confirmed = formData.get("confirmed") === "true";
  const filters = {
    q: String(formData.get("q") || "") || undefined,
    status: String(formData.get("status") || "") || undefined,
    zone: String(formData.get("zone") || "") || undefined,
    tariffId: String(formData.get("fromTariffId") || "") || undefined,
    ipPoolId: String(formData.get("fromIpPoolId") || "") || undefined,
  };
  if (!newTariffId) throw new Error("Choose a destination plan.");

  const { listCustomers } = await import("@/lib/queries/customers");
  const matches = await listCustomers({ ...filters, limit: 5000 });
  const eligible = matches.filter((c) => c.tariffId !== newTariffId);
  const [newTariff] = await db.select().from(s.tariffs).where(eq(s.tariffs.id, newTariffId)).limit(1);
  if (!newTariff) throw new Error("Destination plan not found.");

  if (!confirmed) {
    const priceDiffs = eligible.map((c) => (c.tariff ? newTariff.priceMmk - c.tariff.priceMmk : null)).filter((d): d is number => d != null);
    const avgDiff = priceDiffs.length ? Math.round(priceDiffs.reduce((a, b) => a + b, 0) / priceDiffs.length) : 0;
    return {
      preview: true, count: eligible.length, alreadyOnPlan: matches.length - eligible.length,
      sample: eligible.slice(0, 8).map((c) => ({ id: c.id, fullName: c.fullName, fromPlan: c.tariff?.name ?? "—" })),
      avgPriceDiffMmk: avgDiff, toPlanName: newTariff.name,
    };
  }

  if (proration && eligible.length > MAX_PRORATION_BATCH) {
    throw new Error(`${eligible.length} subscribers matched — that's over the ${MAX_PRORATION_BATCH}-subscriber cap for a prorated batch move. Turn proration off, or narrow the filter.`);
  }

  if (!proration) {
    // No per-customer math needed — one statement for any number of rows.
    const ids = eligible.map((c) => c.id);
    if (ids.length) {
      await db.update(s.customers).set({ tariffId: newTariffId, updatedAt: new Date() }).where(inArray(s.customers.id, ids));
      const rows = ids.map((id) => ({ actor: "system", action: "Plan change (batch, filter)", objectType: "customer", objectId: id, detail: `→ ${newTariff.name}, proration off` }));
      for (let i = 0; i < rows.length; i += 200) await db.insert(s.auditLog).values(rows.slice(i, i + 200));
    }
    await logAudit("Batch plan change (filter)", "plan", newTariffId, `${ids.length} subscriber(s) → ${newTariff.name}, proration off`);
    return { succeeded: ids.length, failed: 0, skipped: [], total: matches.length };
  }

  let succeeded = 0;
  const skipped: { id: string; reason: string }[] = [];
  for (const c of eligible) {
    const result = await applyPlanChange(c.id, newTariffId, true);
    if (result.ok) succeeded++;
    else skipped.push({ id: c.id, reason: result.reason ?? "unknown" });
  }
  await logAudit("Batch plan change (filter)", "plan", newTariffId, `${succeeded}/${matches.length} subscriber(s) → ${newTariff.name}`);
  return { succeeded, failed: 0, skipped, total: matches.length };
}

// Independent IP pool (and, since it's the same address-resource class,
// optionally VLAN) assignment — never triggered by a Traffic Plan change.
export async function assignIpPool(formData: FormData) {
  const customerId = String(formData.get("customerId"));
  const ipPoolId = String(formData.get("ipPoolId") || "").trim() || null;
  const vlanRaw = String(formData.get("vlan") || "").trim();
  const vlan = vlanRaw ? parseInt(vlanRaw, 10) : null;

  const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, customerId)).limit(1);
  if (!customer) return;

  await db.update(s.customers).set({ ipPoolId, vlan, updatedAt: new Date() }).where(eq(s.customers.id, customerId));
  await logAudit("IP pool reassigned", "customer", customerId, `Pool ${ipPoolId ?? "none"}, VLAN ${vlan ?? "none"}`);

  revalidatePath(`/subscribers/${customerId}`);
  revalidatePath("/network");
}

export async function addCustomer(formData: FormData) {
  const fullName = String(formData.get("fullName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const zone = String(formData.get("zone") || "").trim();
  const accountType = String(formData.get("accountType") || "personal");
  const tariffId = String(formData.get("tariffId") || "");
  if (!fullName || !phone || !zone || !tariffId) throw new Error("Full name, phone, zone and plan are required.");

  const [tariff] = await db.select().from(s.tariffs).where(eq(s.tariffs.id, tariffId)).limit(1);
  if (!tariff) throw new Error("Selected plan was not found.");

  // IP pool is picked independently of the plan (decoupled) — defaults to the
  // plan's suggested pool when left blank, but never re-derived afterwards.
  const ipPoolId = String(formData.get("ipPoolId") || "").trim() || tariff.ipPoolId || null;
  // VLAN now lives on the pool, not the plan — default to the chosen pool's
  // VLAN, with an optional manual override typed on the form.
  const pool = ipPoolId ? (await db.select().from(s.ipPools).where(eq(s.ipPools.id, ipPoolId)).limit(1))[0] : null;
  const vlanOverrideRaw = String(formData.get("vlan") || "").trim();
  const vlan = vlanOverrideRaw ? parseInt(vlanOverrideRaw, 10) : pool?.vlan ?? null;

  // Subscriber ID prefix & formatting: location is mandatory and drives the
  // ID's prefix; System Settings sets the service code and digit count.
  const settings = await getSystemSettings();
  const locationId = String(formData.get("locationId") || "") || settings.defaultLocationId;
  if (!locationId) throw new Error("A location is required (set a default in Settings, or select one here).");
  const [location] = await db.select().from(s.locations).where(eq(s.locations.id, locationId)).limit(1);
  if (!location) throw new Error("Selected location was not found.");

  // Contact & address
  const email = String(formData.get("email") || "").trim() || null;
  const billingEmail = String(formData.get("billingEmail") || "").trim() || email;
  const street = String(formData.get("street") || "").trim() || null;
  const city = String(formData.get("city") || "").trim() || "Yangon";
  const zipCode = String(formData.get("zipCode") || "").trim() || null;
  const stateProvince = String(formData.get("stateProvince") || "").trim() || null;
  const addressInput = String(formData.get("address") || "").trim();
  const address = addressInput || [street, city].filter(Boolean).join(", ") || `${zone}, Yangon`;

  // Identity & account
  const dobRaw = String(formData.get("dateOfBirth") || "");
  const dateOfBirth = dobRaw ? new Date(dobRaw) : null;
  const nationalId = String(formData.get("nationalId") || "").trim() || null;
  const contractId = String(formData.get("contractId") || "").trim() || null;
  const contractEndRaw = String(formData.get("contractEndDate") || "");
  const contractEndDate = contractEndRaw ? new Date(contractEndRaw) : null;
  const customStatus = String(formData.get("customStatus") || "customer").trim() || "customer";
  const managementIp = String(formData.get("managementIp") || "").trim() || null;
  const useOwnRouter = formData.get("useOwnRouter") === "on";
  const referredBy = String(formData.get("referredBy") || "").trim() || null;
  const poeUsername = String(formData.get("poeUsername") || "").trim() || null;
  const poePassword = String(formData.get("poePassword") || "").trim() || null;

  // Portal login: admin-set or auto-generated, always stored hashed (no client portal exists yet — see README)
  const portalPasswordInput = String(formData.get("portalPassword") || "").trim();
  const portalPassword = portalPasswordInput || randomBytes(6).toString("base64url");

  const ALLOWED_STATUSES = ["active", "grace", "suspended", "disabled"];
  const statusInput = String(formData.get("status") || "active");
  const status = ALLOWED_STATUSES.includes(statusInput) ? statusInput : "active";

  const port = await findFreeSnPort();
  if (!port) throw new Error("No free splitter port available network-wide");
  const [sn] = await db.select().from(s.splitterNodes).where(eq(s.splitterNodes.id, port.snId)).limit(1);

  const custId = await nextLocationCustomerId(location.id, settings.subscriberIdServiceCode, settings.subscriberIdDigitCount);
  const onuId = await nextOnuId();
  const now = new Date();
  const expiry = new Date(now.getTime() + tariff.validityDays * DAY_MS);

  const usernameInput = String(formData.get("username") || "").trim().toLowerCase();
  if (usernameInput) {
    const [taken] = await db.select({ id: s.customers.id }).from(s.customers).where(eq(s.customers.username, usernameInput)).limit(1);
    if (taken) throw new Error(`Portal login "${usernameInput}" is already in use.`);
  }
  const username = usernameInput || custId.toLowerCase();

  await db.insert(s.customers).values({
    id: custId, username, portalPasswordHash: await hashPassword(portalPassword),
    fullName, email, billingEmail, phone, address, street, city, zipCode, stateProvince,
    accountType, zone, lat: (sn?.lat ?? 16.85) + (Math.random() - 0.5) * 0.006, lng: (sn?.lng ?? 96.13) + (Math.random() - 0.5) * 0.006,
    status, customStatus, installedDate: now, tariffId: tariff.id, expiryDate: expiry, balanceMmk: 0,
    snId: port.snId, snPort: port.port, pppoeUsername: username,
    dateOfBirth, nationalId, contractId, contractEndDate, managementIp, useOwnRouter, referredBy,
    locationId: location.id, ipPoolId, vlan, poeUsername, poePassword,
  });
  await db.insert(s.onus).values({
    id: onuId, serial: "NEWONU" + onuId.replace("ONU-", ""), mac: "48:3F:DA:00:00:00",
    vendor: "Huawei", model: "EG8145V5", snId: port.snId, snPort: port.port, customerId: custId,
    installDate: now, status: "online", rxDbmBase: -19.5, txDbmBase: 2.1,
  });
  await logAudit("New subscriber onboarded", "customer", custId, `${tariff.name}, booked ${port.snId} port ${port.port}`);

  revalidatePath("/subscribers");
  revalidatePath("/dashboard");
  revalidatePath("/odn");
}
