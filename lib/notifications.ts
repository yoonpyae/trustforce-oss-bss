import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { desc, sql } from "drizzle-orm";

// Internal helper (not a server action) used by other actions to raise a
// role-targeted in-app notification — e.g. "new inquiry" to network_ops,
// "feasibility confirmed" back to sales. No external push/SMS/email: this is
// a real DB row surfaced by the notification bell, same real-vs-simulated
// split as the rest of the app (see README).
export async function notifyRole(
  forRole: string,
  title: string,
  body: string,
  opts: { link?: string; relatedType?: string; relatedId?: string } = {}
) {
  const [row] = await db.select({ id: s.notifications.id }).from(s.notifications).orderBy(desc(sql`substring(${s.notifications.id} from 6)::int`)).limit(1);
  const seq = row ? parseInt(row.id.replace("NTF-", ""), 10) + 1 : 1;
  const id = "NTF-" + String(seq).padStart(5, "0");
  await db.insert(s.notifications).values({ id, forRole, title, body, link: opts.link, relatedType: opts.relatedType, relatedId: opts.relatedId });
  return id;
}
