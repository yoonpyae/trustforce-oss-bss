import { getChurnRetention } from "@/lib/queries/reports";
import { csvResponse } from "@/lib/csv";
import { dateStr } from "@/lib/format";
import { getSession } from "@/lib/auth-session";

export async function GET() {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  const { atRisk } = await getChurnRetention();
  return csvResponse(atRisk.map((c) => ({ id: c.id, name: c.fullName, zone: c.zone, expiry: dateStr(c.expiryDate) })), "at-risk.csv");
}
