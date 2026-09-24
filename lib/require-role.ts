import { getSession, type SessionUser } from "@/lib/auth-session";

export async function requireRole(...roles: string[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session || !roles.includes(session.role)) {
    throw new Error("You don't have permission to do that.");
  }
  return session;
}
