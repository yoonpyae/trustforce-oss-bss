export type Role = "sysadmin" | "sales" | "cashier" | "network_ops" | "management";

// Route prefixes each role may open. "*" means unrestricted. `/dashboard` and
// `/settings` are implicitly allowed for every authenticated role below —
// dashboard is the common landing page, settings is where anyone changes
// their own password (the page itself gates the admin-only parts).
export const ROLE_MODULES: Record<Role, string[]> = {
  sysadmin: ["*"],
  sales: ["/leads", "/subscribers", "/helpdesk", "/schedule", "/messaging"],
  cashier: ["/billing", "/subscribers"],
  network_ops: ["/odn", "/topology", "/network", "/alarms", "/tariffs", "/helpdesk", "/schedule", "/inventory"],
  management: ["/billing", "/reports"],
};

const ALWAYS_ALLOWED = ["/dashboard", "/settings"];

export function canAccess(role: string, pathname: string): boolean {
  const allowed = ROLE_MODULES[role as Role];
  if (!allowed) return false;
  if (allowed.includes("*")) return true;
  if (ALWAYS_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  return allowed.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

export function modulesForRole(role: string): string[] {
  return ROLE_MODULES[role as Role] ?? [];
}
