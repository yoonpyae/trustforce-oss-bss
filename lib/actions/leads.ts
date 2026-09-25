"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { findFreeSnPort, nextOnuId, nextLocationCustomerId } from "@/lib/queries/customers";
import { getSystemSettings } from "@/lib/queries/settings";

const DAY_MS = 86400000;

async function nextLeadId() {
  const [row] = await db.select({ id: s.leads.id }).from(s.leads).orderBy(desc(sql`substring(${s.leads.id} from 4)::int`)).limit(1);
  const seq = row ? parseInt(row.id.replace("LD-", ""), 10) + 1 : 1;
  return "LD-" + String(seq).padStart(4, "0");
}

export async function createLead(formData: FormData) {
  const fullName = String(formData.get("fullName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  if (!fullName || !phone) return;

  const id = await nextLeadId();
  await db.insert(s.leads).values({
    id, fullName, phone,
    email: String(formData.get("email") || "").trim() || null,
    source: String(formData.get("source") || "website"),
    zone: String(formData.get("zone") || "").trim() || null,
    address: String(formData.get("address") || "").trim() || null,
    interestedTariffId: String(formData.get("tariffId") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
    assignedTo: "sales.team",
  });
  await logAudit("Lead captured", "lead", id, `${fullName} via ${formData.get("source") ?? "website"}`);

  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function updateLeadStatus(formData: FormData) {
  const id = String(formData.get("leadId"));
  const status = String(formData.get("status"));
  const lostReason = String(formData.get("lostReason") || "").trim();

  await db.update(s.leads).set({
    status, updatedAt: new Date(),
    lostReason: status === "lost" ? lostReason || "No reason given" : null,
  }).where(eq(s.leads.id, id));
  await logAudit("Lead status changed", "lead", id, `→ ${status}`);

  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function convertLeadToCustomer(formData: FormData) {
  const leadId = String(formData.get("leadId"));
  const tariffId = String(formData.get("tariffId"));
  const [lead] = await db.select().from(s.leads).where(eq(s.leads.id, leadId)).limit(1);
  if (!lead || !tariffId) return;
  const [tariff] = await db.select().from(s.tariffs).where(eq(s.tariffs.id, tariffId)).limit(1);
  if (!tariff) return;

  const port = await findFreeSnPort();
  if (!port) throw new Error("No free splitter port available network-wide");
  const [sn] = await db.select().from(s.splitterNodes).where(eq(s.splitterNodes.id, port.snId)).limit(1);

  const settings = await getSystemSettings();
  const locationId = String(formData.get("locationId") || "") || settings.defaultLocationId;
  if (!locationId) throw new Error("A location is required (set a default in Settings, or select one here).");
  const [location] = await db.select().from(s.locations).where(eq(s.locations.id, locationId)).limit(1);
  if (!location) throw new Error("Selected location was not found.");

  const custId = await nextLocationCustomerId(location.id, settings.subscriberIdServiceCode, settings.subscriberIdDigitCount);
  const onuId = await nextOnuId();
  const now = new Date();
  const expiry = new Date(now.getTime() + tariff.validityDays * DAY_MS);

  await db.insert(s.customers).values({
    id: custId, username: custId.toLowerCase(), fullName: lead.fullName,
    email: lead.email, phone: lead.phone, address: lead.address || `${lead.zone ?? "Yangon"}`,
    accountType: "personal", zone: lead.zone || (sn?.zone ?? "Hlaing"),
    lat: (sn?.lat ?? 16.85) + (Math.random() - 0.5) * 0.006, lng: (sn?.lng ?? 96.13) + (Math.random() - 0.5) * 0.006,
    status: "active", installedDate: now, tariffId: tariff.id, expiryDate: expiry, balanceMmk: 0,
    snId: port.snId, snPort: port.port, pppoeUsername: custId.toLowerCase(),
    locationId: location.id, vlan: tariff.vlan,
  });
  await db.insert(s.onus).values({
    id: onuId, serial: "NEWONU" + onuId.replace("ONU-", ""), mac: "48:3F:DA:00:00:01",
    vendor: "Huawei", model: "EG8145V5", snId: port.snId, snPort: port.port, customerId: custId,
    installDate: now, status: "online", rxDbmBase: -19.5, txDbmBase: 2.1,
  });
  await db.update(s.leads).set({ status: "won", convertedCustomerId: custId, updatedAt: new Date() }).where(eq(s.leads.id, leadId));
  await logAudit("Lead converted", "lead", leadId, `→ ${custId} on ${tariff.name}`);

  revalidatePath("/leads");
  revalidatePath("/subscribers");
  revalidatePath("/dashboard");
  revalidatePath("/odn");
}
