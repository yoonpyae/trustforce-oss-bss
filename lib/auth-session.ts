import { cookies, headers } from "next/headers";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq, lt } from "drizzle-orm";

export const SESSION_COOKIE = "tf_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type SessionUser = { id: string; name: string; email: string; role: string };

export async function createSession(staffId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const ua = (await headers()).get("user-agent");

  await db.insert(s.sessions).values({ id: token, staffId, expiresAt, userAgent: ua });
  // Best-effort cleanup of stale sessions; never blocks login on failure.
  db.delete(s.sessions).where(lt(s.sessions.expiresAt, new Date())).catch(() => {});

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ staff: s.staff, expiresAt: s.sessions.expiresAt })
    .from(s.sessions)
    .innerJoin(s.staff, eq(s.sessions.staffId, s.staff.id))
    .where(eq(s.sessions.id, token))
    .limit(1);

  if (!row || row.expiresAt < new Date() || !row.staff.active) return null;
  return { id: row.staff.id, name: row.staff.name, email: row.staff.email, role: row.staff.role };
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(s.sessions).where(eq(s.sessions.id, token));
  jar.delete(SESSION_COOKIE);
}
