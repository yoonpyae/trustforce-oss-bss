"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

const MOVE_BUCKETS = ["internalUsage", "rentCount", "sold", "assigned", "damaged", "inTransit"] as const;
type Bucket = (typeof MOVE_BUCKETS)[number];

function bucketDelta(bucket: Bucket, delta: number) {
  switch (bucket) {
    case "internalUsage": return { internalUsage: sql`${s.inventoryItems.internalUsage} + ${delta}` };
    case "rentCount": return { rentCount: sql`${s.inventoryItems.rentCount} + ${delta}` };
    case "sold": return { sold: sql`${s.inventoryItems.sold} + ${delta}` };
    case "assigned": return { assigned: sql`${s.inventoryItems.assigned} + ${delta}` };
    case "damaged": return { damaged: sql`${s.inventoryItems.damaged} + ${delta}` };
    case "inTransit": return { inTransit: sql`${s.inventoryItems.inTransit} + ${delta}` };
  }
}

function bucketValue(product: typeof s.inventoryItems.$inferSelect, bucket: Bucket): number {
  return product[bucket];
}

function revalidateInventory() {
  revalidatePath("/inventory");
  revalidatePath("/inventory/products");
  revalidatePath("/inventory/items");
}

export async function receiveStock(formData: FormData) {
  const productId = String(formData.get("productId"));
  const qty = Math.max(1, parseInt(String(formData.get("qty") || "1"), 10));

  await db.update(s.inventoryItems).set({ inStock: sql`${s.inventoryItems.inStock} + ${qty}` }).where(eq(s.inventoryItems.id, productId));
  await logAudit("Stock received", "inventory_item", productId, `${qty} pc received into stock`);
  revalidateInventory();
}

export async function moveStock(formData: FormData) {
  const productId = String(formData.get("productId"));
  const qty = Math.max(1, parseInt(String(formData.get("qty") || "1"), 10));
  const to = String(formData.get("to")) as Bucket;
  if (!MOVE_BUCKETS.includes(to)) throw new Error("Invalid destination bucket.");

  const [product] = await db.select().from(s.inventoryItems).where(eq(s.inventoryItems.id, productId)).limit(1);
  if (!product || product.inStock < qty) throw new Error("Not enough units in stock for that move.");

  await db.update(s.inventoryItems).set({
    inStock: sql`${s.inventoryItems.inStock} - ${qty}`,
    ...bucketDelta(to, qty),
  }).where(eq(s.inventoryItems.id, productId));
  await logAudit("Stock moved", "inventory_item", productId, `${qty} pc: in stock → ${to}`);
  revalidateInventory();
}

export async function returnStock(formData: FormData) {
  const productId = String(formData.get("productId"));
  const qty = Math.max(1, parseInt(String(formData.get("qty") || "1"), 10));
  const from = String(formData.get("from")) as Bucket;
  if (!MOVE_BUCKETS.includes(from)) throw new Error("Invalid source bucket.");

  const [product] = await db.select().from(s.inventoryItems).where(eq(s.inventoryItems.id, productId)).limit(1);
  if (!product || bucketValue(product, from) < qty) throw new Error("Not enough units in that bucket to return.");

  await db.update(s.inventoryItems).set({
    ...bucketDelta(from, -qty),
    returned: sql`${s.inventoryItems.returned} + ${qty}`,
  }).where(eq(s.inventoryItems.id, productId));
  await logAudit("Stock returned", "inventory_item", productId, `${qty} pc: ${from} → returned`);
  revalidateInventory();
}

export async function restockReturn(formData: FormData) {
  const productId = String(formData.get("productId"));
  const qty = Math.max(1, parseInt(String(formData.get("qty") || "1"), 10));

  const [product] = await db.select().from(s.inventoryItems).where(eq(s.inventoryItems.id, productId)).limit(1);
  if (!product || product.returned < qty) throw new Error("Not enough returned units to restock.");

  await db.update(s.inventoryItems).set({
    returned: sql`${s.inventoryItems.returned} - ${qty}`,
    inStock: sql`${s.inventoryItems.inStock} + ${qty}`,
  }).where(eq(s.inventoryItems.id, productId));
  await logAudit("Return restocked", "inventory_item", productId, `${qty} pc: returned → in stock`);
  revalidateInventory();
}

export async function saveProduct(formData: FormData) {
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const sku = String(formData.get("sku") || "").trim();
  const vendorId = String(formData.get("vendorId") || "") || null;
  const category = String(formData.get("category") || "").trim() || null;
  const sellPriceMmk = parseInt(String(formData.get("sellPriceMmk") || "0"), 10);
  const rentPriceMmk = parseInt(String(formData.get("rentPriceMmk") || "0"), 10);
  const reorderLevel = parseInt(String(formData.get("reorderLevel") || "10"), 10);
  const unitCostMmk = parseInt(String(formData.get("unitCostMmk") || "0"), 10);
  const stockLocation = String(formData.get("stockLocation") || "").trim() || null;
  if (!name || !sku) throw new Error("Name and SKU are required.");

  if (id) {
    await db.update(s.inventoryItems).set({ name, sku, vendorId, category, sellPriceMmk, rentPriceMmk, reorderLevel, unitCostMmk, stockLocation }).where(eq(s.inventoryItems.id, id));
    await logAudit("Product updated", "inventory_item", id, name);
  } else {
    const initialStock = Math.max(0, parseInt(String(formData.get("inStock") || "0"), 10));
    const newId = "ITM-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    await db.insert(s.inventoryItems).values({ id: newId, name, sku, vendorId, category, sellPriceMmk, rentPriceMmk, reorderLevel, unitCostMmk, stockLocation, inStock: initialStock });
    await logAudit("Product created", "inventory_item", newId, name);
  }
  revalidateInventory();
}

export async function addVendor(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const id = "VND-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  await db.insert(s.vendors).values({ id, name });
  await logAudit("Vendor added", "vendor", id, name);
  revalidateInventory();
}

export async function saveSupplier(formData: FormData) {
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const contactName = String(formData.get("contactName") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const address = String(formData.get("address") || "").trim() || null;
  if (!name) throw new Error("Supplier name is required.");

  if (id) {
    await db.update(s.suppliers).set({ name, contactName, phone, email, address }).where(eq(s.suppliers.id, id));
    await logAudit("Supplier updated", "supplier", id, name);
  } else {
    const newId = "SUP-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    await db.insert(s.suppliers).values({ id: newId, name, contactName, phone, email, address });
    await logAudit("Supplier added", "supplier", newId, name);
  }
  revalidatePath("/inventory/supply/suppliers");
}

export async function addSupplierInvoice(formData: FormData) {
  const supplierId = String(formData.get("supplierId") || "");
  const invoiceNumber = String(formData.get("invoiceNumber") || "").trim();
  const amountMmk = parseInt(String(formData.get("amountMmk") || "0"), 10);
  const note = String(formData.get("note") || "").trim() || null;
  if (!supplierId || !invoiceNumber || !amountMmk) throw new Error("Supplier, invoice number and amount are required.");

  const id = "SINV-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  await db.insert(s.supplierInvoices).values({ id, supplierId, invoiceNumber, amountMmk, note, issuedDate: new Date() });
  await logAudit("Supplier invoice recorded", "supplier_invoice", id, `${invoiceNumber}, ${amountMmk.toLocaleString()} MMK`);
  revalidatePath("/inventory/supply/invoices");
}

export async function markInvoicePaid(formData: FormData) {
  const id = String(formData.get("id"));
  await db.update(s.supplierInvoices).set({ status: "paid" }).where(eq(s.supplierInvoices.id, id));
  await logAudit("Supplier invoice paid", "supplier_invoice", id, "");
  revalidatePath("/inventory/supply/invoices");
}
