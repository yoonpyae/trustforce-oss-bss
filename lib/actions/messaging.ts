"use server";

import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

const AUDIENCE_FILTER: Record<string, ReturnType<typeof sql> | undefined> = {
  all: undefined,
  active: sql`${s.customers.status} = 'active'`,
  expired: sql`${s.customers.status} in ('expired','grace')`,
  offline: sql`${s.customers.status} in ('suspended','disabled')`,
  business: sql`${s.customers.accountType} = 'business'`,
};

export async function sendCampaign(formData: FormData) {
  const audience = String(formData.get("audience") || "all");
  const channel = String(formData.get("channel") || "sms");
  const template = String(formData.get("template") || "TPL-WELCOME");
  const testMode = formData.get("testMode") === "on";

  const cond = AUDIENCE_FILTER[audience];
  const rows = cond ? await db.select({ id: s.customers.id }).from(s.customers).where(cond) : await db.select({ id: s.customers.id }).from(s.customers);
  const recipientCount = testMode ? Math.min(3, rows.length) : rows.length;

  const id = "CMP-" + Date.now().toString(36).toUpperCase();
  await db.insert(s.campaigns).values({ id, audience, channel, template, recipientCount, status: testMode ? "test_passed" : "sent", createdBy: "sales.team" });
  await logAudit(testMode ? "Campaign test sent" : "Campaign sent", "campaign", id, `${channel} · ${template} · ${recipientCount} recipients`);

  revalidatePath("/messaging");
}
