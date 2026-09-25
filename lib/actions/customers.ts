"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";
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
  const [tariff] = await db.select().from(s.tariffs).where(eq(s.tariffs.id, customer.tariffId)).limit(1);
  if (!tariff) return;

  const now = Date.now();
  const wasDown = customer.status === "expired" || customer.status === "suspended";
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

  await db.update(s.customers).set({ status: "active", expiryDate: newExpiry, vlan: tariff.vlan, updatedAt: new Date() }).where(eq(s.customers.id, customerId));
  await logAudit("Recharge", "customer", customerId, `${tariff.name} renewed via ${method}, new expiry ${newExpiry.toISOString().slice(0, 10)}${billingNote}`);

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

export async function changePlan(formData: FormData) {
  const customerId = String(formData.get("customerId"));
  const newTariffId = String(formData.get("tariffId"));

  const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, customerId)).limit(1);
  if (!customer) return;
  const [newTariff] = await db.select().from(s.tariffs).where(eq(s.tariffs.id, newTariffId)).limit(1);
  if (!newTariff) return;
  const oldTariff = customer.tariffId ? (await db.select().from(s.tariffs).where(eq(s.tariffs.id, customer.tariffId)).limit(1))[0] : null;

  let prorationNote = "no prior plan";
  if (oldTariff && customer.expiryDate) {
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

  await db.update(s.customers).set({ tariffId: newTariff.id, vlan: newTariff.vlan, updatedAt: new Date() }).where(eq(s.customers.id, customerId));
  await logAudit("Plan change", "customer", customerId, `${oldTariff?.name ?? "—"} → ${newTariff.name} (${prorationNote})`);

  revalidatePath(`/subscribers/${customerId}`);
  revalidatePath("/subscribers");
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
  const bankAccount = String(formData.get("bankAccount") || "").trim() || null;
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
    dateOfBirth, nationalId, contractId, contractEndDate, bankAccount, managementIp, useOwnRouter, referredBy,
    locationId: location.id, vlan: tariff.vlan, poeUsername, poePassword,
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
