import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { getSession } from "@/lib/auth-session";

export async function logAudit(action: string, objectType: string | null, objectId: string | null, detail: string) {
  let actor = "system";
  try {
    const session = await getSession();
    if (session) actor = `${session.name} <${session.email}>`;
  } catch {
    // getSession() needs a request-scoped cookie store; fall back to "system"
    // when logAudit is called from a context without one (e.g. the seed script).
  }
  await db.insert(s.auditLog).values({ actor, action, objectType, objectId, detail });
}
