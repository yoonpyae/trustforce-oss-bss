"use client";

import { useState } from "react";
import { addCustomer } from "@/lib/actions/customers";

type Tariff = { id: string; name: string; priceMmk: number; accountType: string };
type Location = { id: string; name: string; code: string };

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function AddCustomerForm({ zones, tariffs, locations }: { zones: string[]; tariffs: Tariff[]; locations: Location[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>+ New subscriber</button>
      {open && (
        <div className="scrim" onClick={() => setOpen(false)}>
          <div className="modal" style={{ width: "min(760px, 96vw)" }} onClick={(e) => e.stopPropagation()}>
            <header>
              <h3 style={{ flex: 1 }}>New subscriber onboarding</h3>
              <button className="btn sm ghost" onClick={() => setOpen(false)}>✕</button>
            </header>
            <form
              action={async (fd) => {
                setError(null);
                try {
                  await addCustomer(fd);
                  setOpen(false);
                  setPassword("");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not create subscriber.");
                }
              }}
            >
              <div className="body">
                {error && <p className="hint" style={{ color: "var(--bad)" }}>{error}</p>}

                <h4 className="hint" style={{ textTransform: "uppercase", letterSpacing: ".6px" }}>Portal access</h4>
                <div className="grid g2">
                  <div className="field">
                    <label>Portal login</label>
                    <div className="icon-input-group">
                      <input name="username" placeholder="Auto-assigned from customer ID" />
                      <button type="button" title="Auto-assigned" disabled>⚿</button>
                    </div>
                  </div>
                  <div className="field">
                    <label>Portal password</label>
                    <div className="icon-input-group">
                      <button type="button" onClick={() => setShowPassword((v) => !v)} title="Show/hide">{showPassword ? "◒" : "◓"}</button>
                      <input name="portalPassword" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Auto-generated if left blank" />
                      <button type="button" onClick={() => setPassword(generatePassword())} title="Generate">⟳</button>
                    </div>
                  </div>
                </div>
                <div className="grid g2">
                  <div className="field">
                    <label>Status</label>
                    <select name="status" defaultValue="active">
                      <option value="active">Active</option>
                      <option value="grace">Grace</option>
                      <option value="suspended">Suspended</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Custom status</label>
                    <input name="customStatus" defaultValue="customer" />
                  </div>
                </div>

                <h4 className="hint" style={{ textTransform: "uppercase", letterSpacing: ".6px", marginTop: 4 }}>Identity & contact</h4>
                <div className="grid g2">
                  <div className="field"><label>Full name / business name</label><input name="fullName" required /></div>
                  <div className="field">
                    <label>Account type</label>
                    <select name="accountType" defaultValue="personal">
                      <option value="personal">Individual</option>
                      <option value="business">Business</option>
                    </select>
                  </div>
                </div>
                <div className="grid g2">
                  <div className="field"><label>Phone</label><input name="phone" required placeholder="09xxxxxxxxx" /></div>
                  <div className="field"><label>Email</label><input name="email" type="email" /></div>
                </div>
                <div className="grid g2">
                  <div className="field"><label>Billing email</label><input name="billingEmail" type="email" placeholder="Defaults to email above" /></div>
                  <div className="field"><label>Date of birth</label><input name="dateOfBirth" type="date" /></div>
                </div>
                <div className="grid g2">
                  <div className="field"><label>Identification (NRC / registration no.)</label><input name="nationalId" /></div>
                  <div className="field"><label>Bank account</label><input name="bankAccount" /></div>
                </div>

                <h4 className="hint" style={{ textTransform: "uppercase", letterSpacing: ".6px", marginTop: 4 }}>Address & location</h4>
                <div className="grid g2">
                  <div className="field">
                    <label>Location (subscriber ID prefix)</label>
                    <select name="locationId" defaultValue="">
                      <option value="">Use system default</option>
                      {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                    </select>
                    <span className="hint">Determines the ID prefix — set once, not editable after creation.</span>
                  </div>
                  <div className="field">
                    <label>Zone</label>
                    <select name="zone" required defaultValue="">
                      <option value="" disabled>Select zone…</option>
                      {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid g2">
                  <div className="field"><label>Street</label><input name="street" placeholder="No., street" /></div>
                  <div className="field"><label>City</label><input name="city" defaultValue="Yangon" /></div>
                </div>
                <div className="grid g2">
                  <div className="field"><label>ZIP code</label><input name="zipCode" /></div>
                  <div className="field"><label>State / Province</label><input name="stateProvince" placeholder="Yangon Region" /></div>
                </div>
                <div className="field"><label>Full address (optional override)</label><input name="address" placeholder="Leave blank to build from street + city" /></div>

                <h4 className="hint" style={{ textTransform: "uppercase", letterSpacing: ".6px", marginTop: 4 }}>Service</h4>
                <div className="grid g2">
                  <div className="field">
                    <label>Plan</label>
                    <select name="tariffId" required defaultValue="">
                      <option value="" disabled>Select plan…</option>
                      {tariffs.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.priceMmk.toLocaleString()} MMK</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Management IP (static plans)</label><input name="managementIp" placeholder="103.86.14.x" /></div>
                </div>
                <div className="grid g2">
                  <div className="field"><label>Contract ID</label><input name="contractId" /></div>
                  <div className="field"><label>Contract end date</label><input name="contractEndDate" type="date" /></div>
                </div>
                <div className="grid g2">
                  <div className="field"><label>Referred by</label><input name="referredBy" placeholder="Existing customer or agent" /></div>
                  <div className="field" style={{ justifyContent: "flex-end" }}>
                    <label className="row" style={{ gap: 8, cursor: "pointer" }}>
                      <input name="useOwnRouter" type="checkbox" style={{ width: "auto" }} /> Customer uses their own router
                    </label>
                  </div>
                </div>

                <h4 className="hint" style={{ textTransform: "uppercase", letterSpacing: ".6px", marginTop: 4 }}>POE device (optional)</h4>
                <div className="grid g2">
                  <div className="field"><label>POE username</label><input name="poeUsername" /></div>
                  <div className="field"><label>POE password</label><input name="poePassword" type="password" /></div>
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
