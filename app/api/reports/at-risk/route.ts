import { getChurnRetention } from "@/lib/queries/reports";
import { csvResponse } from "@/lib/csv";
import { dateStr } from "@/lib/format";

export async function GET() {
  const { atRisk } = await getChurnRetention();
  return csvResponse(atRisk.map((c) => ({ id: c.id, name: c.fullName, zone: c.zone, expiry: dateStr(c.expiryDate) })), "at-risk.csv");
}
