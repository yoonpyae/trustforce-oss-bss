import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { signIn } from "@/lib/actions/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const sp = await searchParams;

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="card" style={{ width: "min(380px, 100%)" }}>
        <header style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
          <div className="row">
            <div className="brand-mark">TF</div>
            <div>
              <div className="brand-name">TrustForce</div>
              <div className="brand-sub">OSS / BSS</div>
            </div>
          </div>
        </header>
        <form action={signIn} className="stack" style={{ marginTop: 12 }}>
          {sp.error && <p className="hint" style={{ color: "var(--bad)" }}>Incorrect email or password.</p>}
          <div className="field">
            <label>Email</label>
            <input name="email" type="email" required autoFocus placeholder="hein@trustforcemm.com" />
          </div>
          <div className="field">
            <label>Password</label>
            <input name="password" type="password" required />
          </div>
          <button className="btn primary" type="submit">Sign in</button>
          <p className="hint">
            Seeded demo accounts use password <code>trustforce123</code> — see the README for the full list and roles.
          </p>
        </form>
      </div>
    </div>
  );
}
