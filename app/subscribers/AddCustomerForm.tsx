"use client";

import { useState } from "react";
import { addCustomer } from "@/lib/actions/customers";

type Tariff = { id: string; name: string; priceMmk: number; accountType: string };

export function AddCustomerForm({ zones, tariffs }: { zones: string[]; tariffs: Tariff[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>+ New subscriber</button>
      {open && (
        <div className="scrim" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3 style={{ flex: 1 }}>New subscriber onboarding</h3>
              <button className="btn sm ghost" onClick={() => setOpen(false)}>✕</button>
            </header>
            <form
              action={async (fd) => {
                await addCustomer(fd);
                setOpen(false);
              }}
            >
              <div className="body">
                <div className="field">
                  <label>Full name / business name</label>
                  <input name="fullName" required />
                </div>
                <div className="grid g2">
                  <div className="field">
                    <label>Phone</label>
                    <input name="phone" required placeholder="09xxxxxxxxx" />
                  </div>
                  <div className="field">
                    <label>Account type</label>
                    <select name="accountType" defaultValue="personal">
                      <option value="personal">Personal</option>
                      <option value="business">Business</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Address</label>
                  <input name="address" placeholder="No., street" />
                </div>
                <div className="grid g2">
                  <div className="field">
                    <label>Zone</label>
                    <select name="zone" required defaultValue="">
                      <option value="" disabled>Select zone…</option>
                      {zones.map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Plan</label>
                    <select name="tariffId" required defaultValue="">
                      <option value="" disabled>Select plan…</option>
                      {tariffs.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} — {t.priceMmk.toLocaleString()} MMK</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="hint">
                  A free splitter port is booked automatically across the ODN plant network-wide, and a new ONU record is
                  provisioned. This confirms and creates real rows in Neon — matching the 4-point pre-action check.
                </p>
              </div>
              <footer>
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn primary">Create subscriber</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
