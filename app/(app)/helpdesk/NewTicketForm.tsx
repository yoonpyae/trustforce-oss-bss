"use client";

import { useState } from "react";
import { createTicket } from "@/lib/actions/tickets";

const CATEGORIES = ["Fault", "Performance", "Install", "Move", "Config", "Billing", "Hardware"];

export function NewTicketForm({ customers }: { customers: { id: string; fullName: string }[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>+ New ticket</button>
      {open && (
        <div className="scrim" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3 style={{ flex: 1 }}>New support ticket</h3>
              <button className="btn sm ghost" onClick={() => setOpen(false)}>✕</button>
            </header>
            <form
              action={async (fd) => {
                setError(null);
                try {
                  await createTicket(fd);
                  setOpen(false);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not create ticket.");
                }
              }}
            >
              <div className="body">
                {error && <p className="hint" style={{ color: "var(--bad)" }}>{error}</p>}
                <div className="field">
                  <label>Customer</label>
                  <input name="customerId" list="ticket-cust-list" required placeholder="CUS-0001" />
                  <datalist id="ticket-cust-list">
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                  </datalist>
                </div>
                <div className="grid g2">
                  <div className="field">
                    <label>Category</label>
                    <select name="category" defaultValue="Fault">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Priority</label>
                    <select name="priority" defaultValue="normal">
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="field"><label>Notes</label><textarea name="notes" placeholder="What the customer reported…" /></div>
              </div>
              <footer>
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn primary">Create ticket</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
