"use client";

import { useState } from "react";
import { createLead } from "@/lib/actions/leads";

type Tariff = { id: string; name: string; priceMmk: number };

export function LeadForm({ zones, tariffs }: { zones: string[]; tariffs: Tariff[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>+ New inquiry</button>
      {open && (
        <div className="scrim" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3 style={{ flex: 1 }}>New lead / inquiry</h3>
              <button className="btn sm ghost" onClick={() => setOpen(false)}>✕</button>
            </header>
            <form action={async (fd) => { await createLead(fd); setOpen(false); }}>
              <div className="body">
                <div className="grid g2">
                  <div className="field"><label>Full name</label><input name="fullName" required /></div>
                  <div className="field"><label>Phone</label><input name="phone" required placeholder="09xxxxxxxxx" /></div>
                </div>
                <div className="grid g2">
                  <div className="field"><label>Email</label><input name="email" type="email" /></div>
                  <div className="field">
                    <label>Source</label>
                    <select name="source" defaultValue="website">
                      <option value="website">Website</option>
                      <option value="referral">Referral</option>
                      <option value="walk-in">Walk-in</option>
                      <option value="facebook">Facebook</option>
                      <option value="call">Call-in</option>
                      <option value="field-survey">Field survey</option>
                    </select>
                  </div>
                </div>
                <div className="grid g2">
                  <div className="field">
                    <label>Zone</label>
                    <select name="zone" defaultValue="">
                      <option value="">Unknown</option>
                      {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Interested plan</label>
                    <select name="tariffId" defaultValue="">
                      <option value="">Undecided</option>
                      {tariffs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field"><label>Address</label><input name="address" /></div>
                <div className="field"><label>Notes</label><textarea name="notes" /></div>
              </div>
              <footer>
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save lead</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
