import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { desc } from "drizzle-orm";
import { csvResponse } from "@/lib/csv";
import { dateTimeStr } from "@/lib/format";
import { getSession } from "@/lib/auth-session";

export async function GET() {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  const rows = await db.select().from(s.auditLog).orderBy(desc(s.auditLog.timestamp)).limit(500);
  return csvResponse(
    rows.map((r) => ({ timestamp: dateTimeStr(r.timestamp), actor: r.actor, action: r.action, object: r.objectId ?? "", detail: r.detail ?? "" })),
    "audit-log.csv"
  );
}
