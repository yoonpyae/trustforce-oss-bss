import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { NAV } from "@/components/nav-items";
import { NavLink } from "@/components/NavLink";
import { OmniSearch } from "@/components/OmniSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSession } from "@/lib/auth-session";
import { signOut } from "@/lib/actions/auth";
import { canAccess } from "@/lib/permissions";

const ROLE_LABEL: Record<string, string> = {
  sysadmin: "System administrator",
  network_ops: "Network operations",
  cashier: "Cashier / billing",
  sales: "Sales & CS",
  management: "Management / finance",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const pathname = (await headers()).get("x-pathname") ?? "/dashboard";
  const allowed = canAccess(session.role, pathname);
  const visibleNav = NAV.map((g) => ({ ...g, items: g.items.filter((item) => canAccess(session.role, item.href)) })).filter((g) => g.items.length > 0);

  return (
    <div className="shell">
      <div className="brand">
        <div className="brand-mark">TF</div>
        <div>
          <div className="brand-name">TrustForce</div>
          <div className="brand-sub">OSS / BSS</div>
        </div>
      </div>

      <header className="topbar">
        <OmniSearch />
        <div className="topbar-actions">
          <ThemeToggle />
          <div className="whoami">
            <b>{session.name}</b>
            <span>{ROLE_LABEL[session.role] ?? session.role}</span>
          </div>
          <form action={signOut}>
            <button className="btn sm ghost" type="submit" title="Sign out">⏻</button>
          </form>
        </div>
      </header>

      <nav className="rail" aria-label="Main">
        {visibleNav.map((g) => (
          <div className="rail-group" key={g.group}>
            <p>{g.group}</p>
            {g.items.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        ))}
      </nav>

      <main className="main">
        {allowed ? (
          children
        ) : (
          <div className="card" style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
            <h2 style={{ color: "var(--bad)" }}>Access restricted</h2>
            <p className="hint" style={{ marginTop: 8 }}>
              Your role (<b>{ROLE_LABEL[session.role] ?? session.role}</b>) doesn&rsquo;t include this module. See the
              permission matrix on Settings for what your role can reach, or ask a system administrator.
            </p>
            <a href="/dashboard" className="btn primary" style={{ marginTop: 14, display: "inline-block" }}>Back to dashboard</a>
          </div>
        )}
      </main>
    </div>
  );
}
