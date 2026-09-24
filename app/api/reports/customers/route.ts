import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { csvResponse } from "@/lib/csv";
import { dateStr } from "@/lib/format";
import { getSession } from "@/lib/auth-session";

export async function GET() {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  const rows = await db.select().from(s.customers);
  return csvResponse(
    rows.map((c) => ({ id: c.id, name: c.fullName, phone: c.phone, zone: c.zone, status: c.status, expiry: dateStr(c.expiryDate), balance: c.balanceMmk })),
    "subscribers.csv"
  );
}
