import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { and, eq, inArray, lt } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { getSystemSettings } from "@/lib/queries/settings";

const DAY_MS = 86400000;

// Inactive-customer lifecycle, run daily (see app/api/cron/lifecycle/route.ts):
//
// 1. A customer past their expiry date, beyond the configured grace period,
//    with no payment, is auto-suspended — service cut (ONU offline) — and
//    `suspendedAt` is stamped to start the inactive countdown.
// 2. A customer who has stayed suspended past the configured
//    inactiveAfterSuspendedDays is marked "inactive" — the terminal churn
//    state. Inactive customers drop off the collections list (see
//    lib/queries/billing.ts#listCollections): once inactive, outstanding
//    amounts from before that point aren't chased further.
//
// This applies uniformly to prepaid and postpaid tariffs, since both already
// get an expiryDate (prepaid at recharge, postpaid would need its own
// end-of-month invoice-generation job — not built yet, see README).
//
// Both phases run as a single batched UPDATE...RETURNING each, not a loop of
// per-row updates: the neon-http driver pays a full HTTP round trip per
// query, and a per-row loop over a few hundred matching customers (routine
// on a catch-up run against realistic seed data) took minutes and would blow
// a serverless function's execution limit. A handful of round trips regardless
// of row count keeps this safely within a Vercel Cron invocation.
export async function runLifecycleSweep() {
  const settings = await getSystemSettings();
  const now = new Date();
  const graceCutoff = new Date(now.getTime() - settings.graceDays * DAY_MS);
  const inactiveCutoff = new Date(now.getTime() - settings.inactiveAfterSuspendedDays * DAY_MS);

  const suspended = await db
    .update(s.customers)
    .set({ status: "suspended", suspendedAt: now, updatedAt: now })
    .where(and(inArray(s.customers.status, ["active", "grace", "expired"]), lt(s.customers.expiryDate, graceCutoff)))
    .returning({ id: s.customers.id });

  if (suspended.length > 0) {
    const ids = suspended.map((c) => c.id);
    await db.update(s.onus).set({ status: "offline" }).where(inArray(s.onus.customerId, ids));
    await logAudit("Auto-suspended (batch)", "customer", null, `${ids.length} customer(s) past ${settings.graceDays}-day grace with no payment: ${ids.slice(0, 25).join(", ")}${ids.length > 25 ? `, +${ids.length - 25} more` : ""}`);
  }

  const inactivated = await db
    .update(s.customers)
    .set({ status: "inactive", updatedAt: now })
    .where(and(eq(s.customers.status, "suspended"), lt(s.customers.suspendedAt, inactiveCutoff)))
    .returning({ id: s.customers.id });

  if (inactivated.length > 0) {
    const ids = inactivated.map((c) => c.id);
    await logAudit("Marked inactive (batch)", "customer", null, `${ids.length} customer(s) suspended ${settings.inactiveAfterSuspendedDays}+ days: ${ids.slice(0, 25).join(", ")}${ids.length > 25 ? `, +${ids.length - 25} more` : ""}`);
  }

  return { suspended: suspended.length, inactivated: inactivated.length };
}
