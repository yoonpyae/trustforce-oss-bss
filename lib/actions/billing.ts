"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function settleInvoice(formData: FormData) {
  const invoiceId = String(formData.get("invoiceId"));
  const method = String(formData.get("method") || "cash");

  const [invoice] = await db.select().from(s.invoices).where(eq(s.invoices.id, invoiceId)).limit(1);
  if (!invoice || invoice.status === "paid") return;

  await db.update(s.invoices).set({ status: "paid", method }).where(eq(s.invoices.id, invoiceId));

  const [row] = await db.select({ id: s.payments.id }).from(s.payments).orderBy(desc(sql`substring(${s.payments.id} from 5)::int`)).limit(1);
  const seq = row ? parseInt(row.id.replace("PMT-", ""), 10) + 1 : 41100;
  await db.insert(s.payments).values({ id: "PMT-" + seq, invoiceId, customerId: invoice.customerId, amountMmk: invoice.amountMmk + invoice.taxMmk, method, reconciled: true });

  // Settling an overdue invoice fires a CoA reconnect if the customer had lapsed — matches the
  // "instant CoA re-activation on payment" behaviour described in the TrustForce deck.
  const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, invoice.customerId)).limit(1);
  if (customer && (customer.status === "suspended" || customer.status === "expired")) {
    await db.update(s.customers).set({ status: "active" }).where(eq(s.customers.id, invoice.customerId));
    await logAudit("CoA reconnect", "customer", invoice.customerId, `Auto-reconnect after settling ${invoiceId}`);
  }
  await logAudit("Payment recorded", "invoice", invoiceId, `${method} settlement, ${(invoice.amountMmk + invoice.taxMmk).toLocaleString()} MMK`);

  revalidatePath("/billing");
  revalidatePath(`/subscribers/${invoice.customerId}`);
  revalidatePath("/dashboard");
}

export async function generateVouchers(formData: FormData) {
  const tariffId = String(formData.get("tariffId"));
  const count = Math.min(100, Math.max(1, parseInt(String(formData.get("count") || "1"), 10)));
  if (!tariffId) return;

  const [row] = await db.select({ id: s.vouchers.id }).from(s.vouchers).orderBy(desc(s.vouchers.createdAt)).limit(1);
  const batch = "BATCH-" + new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const values = [];
  for (let i = 0; i < count; i++) {
    const code = "TF-" + Math.random().toString(36).slice(2, 8).toUpperCase() + "-" + Math.floor(100 + Math.random() * 900);
    values.push({ id: code, code, tariffId, status: "unused" as const, generatedBy: "cashier.mya" });
  }
  await db.insert(s.vouchers).values(values);
  await logAudit("Voucher batch generated", "voucher", batch, `${count} vouchers for ${tariffId}`);

  revalidatePath("/billing/vouchers");
}

export async function redeemVoucher(formData: FormData) {
  const code = String(formData.get("code") || "").trim().toUpperCase();
  const customerId = String(formData.get("customerId") || "").trim().toUpperCase();
  if (!code || !customerId) return;

  const [voucher] = await db.select().from(s.vouchers).where(eq(s.vouchers.code, code)).limit(1);
  if (!voucher || voucher.status === "used") return;
  const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, customerId)).limit(1);
  if (!customer) return;
  const [tariff] = await db.select().from(s.tariffs).where(eq(s.tariffs.id, voucher.tariffId)).limit(1);
  if (!tariff) return;

  await db.update(s.vouchers).set({ status: "used", redeemedByCustomerId: customerId, redeemedAt: new Date() }).where(eq(s.vouchers.id, voucher.id));

  const now = Date.now();
  const base = customer.expiryDate && new Date(customer.expiryDate).getTime() > now ? new Date(customer.expiryDate).getTime() : now;
  const newExpiry = new Date(base + tariff.validityDays * 86400000);
  await db.update(s.customers).set({ status: "active", expiryDate: newExpiry, tariffId: tariff.id }).where(eq(s.customers.id, customerId));

  await logAudit("Voucher redeemed", "voucher", voucher.id, `${customerId} redeemed ${code} for ${tariff.name}`);

  revalidatePath("/billing/vouchers");
  revalidatePath(`/subscribers/${customerId}`);
}
