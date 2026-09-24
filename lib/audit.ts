import { db } from "@/lib/db";
import * as s from "@/lib/schema";

// No real auth session exists in this build (see README); actions are
// attributed to a fixed demo actor rather than fabricating a login system.
export const CURRENT_ACTOR = "admin.hein";

export async function logAudit(action: string, objectType: string | null, objectId: string | null, detail: string) {
  await db.insert(s.auditLog).values({ actor: CURRENT_ACTOR, action, objectType, objectId, detail });
}
