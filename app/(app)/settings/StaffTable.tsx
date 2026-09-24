"use client";

import { useState } from "react";
import { Pill } from "@/components/Pill";
import { toggleStaffActive, updateStaffRole, resetStaffPassword } from "@/lib/actions/settings";

type Staff = { id: string; name: string; email: string; role: string; active: boolean; lastLoginAt: Date | string | null };

const ROLES = [
  { id: "sales", name: "Sales & CS" },
  { id: "cashier", name: "Cashier / billing" },
  { id: "network_ops", name: "Network operations" },
  { id: "sysadmin", name: "System administrator" },
  { id: "management", name: "Management / finance" },
];

function ResetPasswordButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return <span className="hint" style={{ color: "var(--good)" }}>Password reset</span>;

  if (!open) return <button className="btn sm ghost" onClick={() => setOpen(true)}>Reset password</button>;

  return (
    <form
      className="row"
      action={async (fd) => {
        setError(null);
        fd.set("id", id);
        try {
          await resetStaffPassword(fd);
          setDone(true);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Reset failed.");
        }
      }}
    >
      <input className="plain" name="password" type="password" minLength={8} required placeholder="New temp password" style={{ width: 150 }} />
      <button className="btn sm primary" type="submit">Set</button>
      {error && <span className="hint" style={{ color: "var(--bad)" }}>{error}</span>}
    </form>
  );
}

export function StaffTable({ staff, myId, isSysadmin }: { staff: Staff[]; myId: string; isSysadmin: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Last login</th>{isSysadmin && <th></th>}</tr></thead>
        <tbody>
          {staff.map((u) => (
            <tr key={u.id}>
              <td><b>{u.name}</b>{u.id === myId && <span className="pill plain info" style={{ marginLeft: 6 }}>you</span>}<div className="hint">{u.email}</div></td>
              <td>
                {isSysadmin && u.id !== myId ? (
                  <form action={updateStaffRole} onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}>
                    <input type="hidden" name="id" value={u.id} />
                    <select className="plain" name="role" defaultValue={u.role}>
                      {ROLES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </form>
                ) : (
                  ROLES.find((r) => r.id === u.role)?.name ?? u.role
                )}
              </td>
              <td><Pill status={u.active ? "active" : "disabled"} /></td>
              <td className="hint">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "never"}</td>
              {isSysadmin && (
                <td>
                  {u.id !== myId && (
                    <div className="row">
                      <form action={toggleStaffActive}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="active" value={String(u.active)} />
                        <button className="btn sm ghost" type="submit">{u.active ? "Deactivate" : "Reactivate"}</button>
                      </form>
                      <ResetPasswordButton id={u.id} />
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
