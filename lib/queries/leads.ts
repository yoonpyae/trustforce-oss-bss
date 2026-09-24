import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

export async function listLeads(opts: { status?: string; q?: string }) {
  const conds = [];
  if (opts.status) conds.push(eq(s.leads.status, opts.status));
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(s.leads.fullName, like), ilike(s.leads.phone, like), ilike(s.leads.id, like)));
  }
  const rows = await db.select().from(s.leads).where(conds.length ? and(...conds) : undefined).orderBy(desc(s.leads.createdAt)).limit(300);
  const tariffs = await db.select().from(s.tariffs);
  const tMap = new Map(tariffs.map((t) => [t.id, t]));
  return rows.map((l) => ({ ...l, tariff: l.interestedTariffId ? tMap.get(l.interestedTariffId) : undefined }));
}

export async function getLeadsFunnel() {
  const rows = await db.select({ status: s.leads.status, source: s.leads.source }).from(s.leads);
  const total = rows.length;
  const byStatus: Record<string, number> = { new: 0, contacted: 0, qualified: 0, quoted: 0, won: 0, lost: 0 };
  const bySource: Record<string, number> = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  }
  const closed = byStatus.won + byStatus.lost;
  const conversionRate = closed > 0 ? Math.round((byStatus.won / closed) * 100) : 0;
  const open = total - byStatus.won - byStatus.lost;
  return { total, open, byStatus, bySource, conversionRate };
}
