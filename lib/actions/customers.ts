"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { findFreeSnPort, nextCustomerId } from "@/lib/queries/customers";

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
  const base = customer.expiryDate && new Date(customer.expiryDate).getTime() > now ? new Date(customer.expiryDate).getTime() : now;
  const newExpiry = new Date(base + tariff.validityDays * DAY_MS);
  const tax = Math.round(tariff.priceMmk * 0.05);

  const invId = await nextInvoiceId();
  await db.insert(s.invoices).values({
    id: invId, customerId, tariffId: tariff.id, amountMmk: tariff.priceMmk, taxMmk: tax,
    issuedDate: new Date(now), dueDate: new Date(now), periodStart: new Date(now), periodEnd: newExpiry,
    status: "paid", method,
  });
  await db.insert(s.payments).values({ id: await nextPaymentId(), invoiceId: invId, customerId, amountMmk: tariff.priceMmk + tax, method, reconciled: true });

  await db.update(s.customers).set({ status: "active", expiryDate: newExpiry, updatedAt: new Date() }).where(eq(s.customers.id, customerId));
  await logAudit("Recharge", "customer", customerId, `${tariff.name} renewed via ${method}, new expiry ${newExpiry.toISOString().slice(0, 10)}`);

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

  await db.update(s.customers).set({ tariffId: newTariff.id, updatedAt: new Date() }).where(eq(s.customers.id, customerId));
  await logAudit("Plan change", "customer", customerId, `${oldTariff?.name ?? "—"} → ${newTariff.name} (${prorationNote})`);

  revalidatePath(`/subscribers/${customerId}`);
  revalidatePath("/subscribers");
}

export async function addCustomer(formData: FormData) {
  const fullName = String(formData.get("fullName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const zone = String(formData.get("zone") || "").trim();
  const accountType = String(formData.get("accountType") || "personal");
  const tariffId = String(formData.get("tariffId") || "");
  if (!fullName || !phone || !zone || !tariffId) return;

  const [tariff] = await db.select().from(s.tariffs).where(eq(s.tariffs.id, tariffId)).limit(1);
  if (!tariff) return;

  const port = await findFreeSnPort();
  if (!port) throw new Error("No free splitter port available network-wide");
  const [sn] = await db.select().from(s.splitterNodes).where(eq(s.splitterNodes.id, port.snId)).limit(1);

  const { custId, onuId } = await nextCustomerId();
  const now = new Date();
  const expiry = new Date(now.getTime() + tariff.validityDays * DAY_MS);

  await db.insert(s.customers).values({
    id: custId, username: custId.toLowerCase().replace("cus-", "sub"), fullName, phone, address: address || `${zone}, Yangon`,
    accountType, zone, lat: (sn?.lat ?? 16.85) + (Math.random() - 0.5) * 0.006, lng: (sn?.lng ?? 96.13) + (Math.random() - 0.5) * 0.006,
    status: "active", installedDate: now, tariffId: tariff.id, expiryDate: expiry, balanceMmk: 0,
    snId: port.snId, snPort: port.port, pppoeUsername: custId.toLowerCase().replace("cus-", "sub"),
  });
  await db.insert(s.onus).values({
    id: onuId, serial: "NEWONU" + custId.replace("CUS-", ""), mac: "48:3F:DA:00:00:00",
    vendor: "Huawei", model: "EG8145V5", snId: port.snId, snPort: port.port, customerId: custId,
    installDate: now, status: "online", rxDbmBase: -19.5, txDbmBase: 2.1,
  });
  await logAudit("New subscriber onboarded", "customer", custId, `${tariff.name}, booked ${port.snId} port ${port.port}`);

  revalidatePath("/subscribers");
  revalidatePath("/dashboard");
  revalidatePath("/odn");
}
