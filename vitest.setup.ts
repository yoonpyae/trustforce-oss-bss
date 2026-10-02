import { loadEnvFile } from "node:process";
import { vi } from "vitest";

try {
  loadEnvFile(".env.local");
} catch {
  // .env.local not present (e.g. CI with env vars already injected) — fine.
}

// These tests run real server actions outside an actual Next.js request, so
// two Next-only runtime APIs need a stand-in:
// - revalidatePath has no request/response cycle to attach to here — no-op it.
// - getSession relies on cookies() (also request-scoped); stub a fixed
//   sysadmin session so requireRole-gated actions (savePool, deletePool,
//   batchReassignPool) can actually be exercised end-to-end instead of just
//   throwing at the auth check.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/auth-session")>();
  return {
    ...actual,
    getSession: async () => ({ id: "STAFF-TEST", name: "Test Admin", email: "test@trustforcemm.com", role: "sysadmin" }),
  };
});
