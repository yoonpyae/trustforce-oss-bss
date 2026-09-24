import { redirect } from "next/navigation";
import { NAV } from "@/components/nav-items";
import { NavLink } from "@/components/NavLink";
import { OmniSearch } from "@/components/OmniSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSession } from "@/lib/auth-session";
import { signOut } from "@/lib/actions/auth";

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
        {NAV.map((g) => (
          <div className="rail-group" key={g.group}>
            <p>{g.group}</p>
            {g.items.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        ))}
      </nav>

      <main className="main">{children}</main>
    </div>
  );
}
