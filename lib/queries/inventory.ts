import { db } from "@/lib/db";
import * as s from "@/lib/schema";

export async function getProducts() {
  const [products, vendors] = await Promise.all([
    db.select().from(s.inventoryItems),
    db.select().from(s.vendors),
  ]);
  const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));
  return products.map((p) => ({ ...p, vendorName: p.vendorId ? vendorMap.get(p.vendorId) ?? "—" : "—" }));
}

export async function listItems(opts: { status?: string; q?: string }) {
  const [assets, customers, products] = await Promise.all([
    db.select().from(s.assets),
    db.select({ id: s.customers.id, fullName: s.customers.fullName }).from(s.customers),
    db.select({ id: s.inventoryItems.id, name: s.inventoryItems.name }).from(s.inventoryItems),
  ]);
  const custMap = new Map(customers.map((c) => [c.id, c.fullName]));
  const productMap = new Map(products.map((p) => [p.id, p.name]));

  return assets
    .filter((a) => (opts.status ? a.status === opts.status : true))
    .filter((a) => (opts.q ? `${a.serial} ${a.mac ?? ""} ${a.model}`.toLowerCase().includes(opts.q.toLowerCase()) : true))
    .map((a) => ({ ...a, customerName: a.boundCustomerId ? custMap.get(a.boundCustomerId) : undefined, productName: a.productId ? productMap.get(a.productId) : undefined }))
    .sort((a, b) => +new Date(b.issuedAt) - +new Date(a.issuedAt));
}

export async function getInventoryDashboard() {
  const products = await db.select().from(s.inventoryItems);
  const stockValue = products.reduce((a, p) => a + p.inStock * p.unitCostMmk, 0);
  const lowStock = products.filter((p) => p.inStock <= p.reorderLevel);
  const totalAssigned = products.reduce((a, p) => a + p.assigned, 0);
  const totalDamaged = products.reduce((a, p) => a + p.damaged, 0);
  const totalInTransit = products.reduce((a, p) => a + p.inTransit, 0);
  const totalReturned = products.reduce((a, p) => a + p.returned, 0);
  const assets = await db.select({ id: s.assets.id, boundCustomerId: s.assets.boundCustomerId, status: s.assets.status }).from(s.assets);
  const invoices = await db.select().from(s.supplierInvoices);
  const pendingInvoices = invoices.filter((i) => i.status === "pending");
  return {
    productCount: products.length, stockValue, lowStock, totalAssigned, totalDamaged, totalInTransit, totalReturned,
    itemCount: assets.length, boundItemCount: assets.filter((a) => a.boundCustomerId).length,
    pendingInvoiceCount: pendingInvoices.length, pendingInvoiceValue: pendingInvoices.reduce((a, i) => a + i.amountMmk, 0),
  };
}
