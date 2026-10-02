import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { sql } from "drizzle-orm";

export async function listTariffsWithUsage() {
  const [tariffs, counts, allowedNas] = await Promise.all([
    db.select().from(s.tariffs),
    db.select({ tariffId: s.customers.tariffId, c: sql<number>`count(*)` }).from(s.customers).groupBy(s.customers.tariffId),
    db.select().from(s.tariffAllowedNas),
  ]);
  const countMap = new Map(counts.map((r) => [r.tariffId, Number(r.c)]));
  const nasByTariff = new Map<string, string[]>();
  for (const row of allowedNas) nasByTariff.set(row.tariffId, [...(nasByTariff.get(row.tariffId) ?? []), row.nasId]);

  return tariffs.map((t) => ({
    ...t,
    subscriberCount: countMap.get(t.id) ?? 0,
    allowedNasIds: nasByTariff.get(t.id) ?? [],
  }));
}
