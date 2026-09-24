import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { signIn } from "@/lib/actions/auth";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const DEMO_PASSWORD = "trustforce123";

const ROLE_META: Record<string, { label: string; description: string; color: string }> = {
  sysadmin: { label: "System administrator", description: "All modules, settings, integrations and the full audit trail", color: "var(--cyan)" },
  network_ops: { label: "Network operations", description: "ODN plant, alarms, live sessions, NAS — tariffs read-only", color: "var(--violet)" },
  cashier: { label: "Cashier / billing", description: "Invoices, payments, vouchers, subscriber read access", color: "var(--good)" },
  sales: { label: "Sales & CS", description: "Leads, subscribers, tickets, messaging", color: "var(--warn)" },
  management: { label: "Management / finance", description: "Dashboards, reports and exports", color: "var(--cyan-deep)" },
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const sp = await searchParams;

  const demoStaff = await db.select().from(s.staff).where(eq(s.staff.active, true)).orderBy(s.staff.id);

  return (
    <div className="login-shell">
      <div className="login-hero">
        <div className="row">
          <div className="brand-mark">TF</div>
          <div>
            <div className="brand-name">TrustForce</div>
            <div className="brand-sub">OSS / BSS</div>
          </div>
        </div>
        <h1 style={{ marginTop: 40, fontSize: 34, maxWidth: 420 }}>One console for every subscriber&rsquo;s fibre journey.</h1>
        <p style={{ color: "var(--text-dim)", maxWidth: 420, marginTop: 10 }}>
          Leads, subscribers, billing, the ODN plant, helpdesk, inventory and reporting — all in one real,
          shared system backed by Neon Postgres.
        </p>
        <ul className="login-hero-points">
          <li>Leads pipeline through to a provisioned subscriber</li>
          <li>OLT → DN → SN → ONU plant, live on the map</li>
          <li>Billing, vouchers, tickets, scheduling and inventory</li>
        </ul>
      </div>

      <div className="login-panel">
        <div className="card" style={{ width: "min(420px, 100%)" }}>
          <header><h3>Sign in</h3></header>
          <p className="hint" style={{ marginTop: -6, marginBottom: 4 }}>Use your TrustForce account, or try one of the demo roles below.</p>
          <form action={signIn} className="stack" style={{ marginTop: 10 }}>
            {sp.error && <p className="hint" style={{ color: "var(--bad)" }}>Incorrect email or password.</p>}
            <div className="field">
              <label>Email</label>
              <input name="email" type="email" required autoFocus placeholder="you@trustforcemm.com" />
            </div>
            <div className="field">
              <label>Password</label>
              <input name="password" type="password" required />
            </div>
            <button className="btn primary" type="submit">Sign in</button>
          </form>
        </div>

        {demoStaff.length > 0 && (
          <div style={{ width: "min(420px, 100%)", marginTop: 22 }}>
            <div className="login-demo-divider"><span>Demo accounts · password {DEMO_PASSWORD}</span></div>
            <div className="stack" style={{ marginTop: 12 }}>
              {demoStaff.map((u) => {
                const meta = ROLE_META[u.role] ?? { label: u.role, description: "", color: "var(--cyan)" };
                return (
                  <form action={signIn} key={u.id}>
                    <input type="hidden" name="email" value={u.email} />
                    <input type="hidden" name="password" value={DEMO_PASSWORD} />
                    <button type="submit" className="demo-account-card">
                      <span className="demo-avatar" style={{ background: meta.color }}>{initials(u.name)}</span>
                      <span className="demo-account-text">
                        <b>{u.name} · {meta.label}</b>
                        <span>{meta.description} · {u.email}</span>
                      </span>
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
