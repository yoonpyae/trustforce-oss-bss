"use client";

import { useState } from "react";
import { createAppointment } from "@/lib/actions/schedule";

const TECHS = ["Ko Myo (Van 1)", "U Thura (Van 2)", "Ko Hein (Van 3)", "Daw Su (Indoor)"];

export function AppointmentForm({ customers }: { customers: { id: string; fullName: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>+ Schedule visit</button>
      {open && (
        <div className="scrim" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3 style={{ flex: 1 }}>Schedule a field visit</h3>
              <button className="btn sm ghost" onClick={() => setOpen(false)}>✕</button>
            </header>
            <form action={async (fd) => { await createAppointment(fd); setOpen(false); }}>
              <div className="body">
                <div className="grid g2">
                  <div className="field">
                    <label>Type</label>
                    <select name="type" defaultValue="installation">
                      <option value="installation">Installation</option>
                      <option value="repair">Repair</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="survey">Survey</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Technician</label>
                    <select name="technician" required defaultValue="">
                      <option value="" disabled>Select…</option>
                      {TECHS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Date &amp; time</label>
                  <input name="scheduledAt" type="datetime-local" required />
                </div>
                <div className="field">
                  <label>Customer (optional)</label>
                  <input name="customerId" list="cust-list" placeholder="CUS-0001" />
                  <datalist id="cust-list">
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                  </datalist>
                </div>
                <div className="field"><label>Notes</label><textarea name="notes" /></div>
              </div>
              <footer>
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn primary">Schedule</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
