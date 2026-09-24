"use client";

import { useState } from "react";
import { addStaff } from "@/lib/actions/settings";

const ROLES = [
  { id: "sales", name: "Sales & CS" },
  { id: "cashier", name: "Cashier / billing" },
  { id: "network_ops", name: "Network operations" },
  { id: "sysadmin", name: "System administrator" },
  { id: "management", name: "Management / finance" },
];

export function AddStaffForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <div className="card">
      <header><h3>Add staff account</h3></header>
      <form
        className="stack"
        action={async (fd) => {
          setError(null);
          setDone(null);
          try {
            await addStaff(fd);
            setDone(`Account created. Temporary password must be changed at first login.`);
            (document.getElementById("add-staff-form") as HTMLFormElement)?.reset();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not create account.");
          }
        }}
        id="add-staff-form"
      >
        {error && <p className="hint" style={{ color: "var(--bad)" }}>{error}</p>}
        {done && <p className="hint" style={{ color: "var(--good)" }}>{done}</p>}
        <div className="field"><label>Name</label><input name="name" required /></div>
        <div className="field"><label>Email</label><input name="email" type="email" required /></div>
        <div className="field">
          <label>Role</label>
          <select name="role" defaultValue="sales">
            {ROLES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Temporary password</label>
          <input name="password" type="password" minLength={8} required placeholder="8+ characters" />
        </div>
        <button className="btn primary" type="submit">Create account</button>
      </form>
    </div>
  );
}
