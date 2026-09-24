"use client";

import { useState } from "react";
import { changeMyPassword } from "@/lib/actions/settings";

export function ChangePasswordForm({ forced }: { forced?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <div className="card" style={forced ? { borderColor: "var(--warn)" } : undefined}>
      <header><h3>My account — change password</h3></header>
      {forced && <p className="hint" style={{ color: "var(--warn)" }}>An administrator issued you a temporary password. Set your own before continuing.</p>}
      {done ? (
        <p className="hint" style={{ color: "var(--good)" }}>Password updated.</p>
      ) : (
        <form
          className="stack"
          action={async (fd) => {
            setError(null);
            try {
              await changeMyPassword(fd);
              setDone(true);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not change password.");
            }
          }}
        >
          {error && <p className="hint" style={{ color: "var(--bad)" }}>{error}</p>}
          <div className="field"><label>Current password</label><input name="currentPassword" type="password" required /></div>
          <div className="field"><label>New password</label><input name="newPassword" type="password" minLength={8} required placeholder="8+ characters" /></div>
          <button className="btn primary" type="submit">Update password</button>
        </form>
      )}
    </div>
  );
}
